import {
  constructedGradeBatchSchema,
  objectiveFeedbackSchema,
  PROMPT_VERSION,
  translatedFeedbackBatchSchema,
  type ConstructedGradeBatch,
  type ObjectiveFeedback,
  type ObjectiveItemResult,
  type TranslatedFeedbackBatch,
} from '@toefl/shared';
import OpenAI from 'openai';
import {
  ACOUSTIC_ASSESSMENT_JSON_SCHEMA,
  acousticAssessmentSchema,
  mockAcousticEvidence,
  skippedAcousticEvidence,
  type AcousticEvidence,
} from './acoustic-evidence.js';
import { workerConfig } from './config.js';
import {
  ACOUSTIC_ANALYSIS_SYSTEM_PROMPT,
  CONSTRUCTED_GRADE_JSON_SCHEMA,
  OBJECTIVE_FEEDBACK_JSON_SCHEMA,
  OBJECTIVE_FEEDBACK_SYSTEM_PROMPT,
  SPEAKING_GRADING_SYSTEM_PROMPT,
  TRANSCRIPTION_PROMPT,
  TRANSLATED_FEEDBACK_JSON_SCHEMA,
  TRANSLATION_SYSTEM_PROMPT,
  WRITING_GRADING_SYSTEM_PROMPT,
} from './prompts.js';

const openai =
  workerConfig.aiMode === 'real' && workerConfig.openaiApiKey
    ? new OpenAI({ apiKey: workerConfig.openaiApiKey })
    : null;

export interface AiCallResult<T> {
  result: T;
  model: string;
  tokenUsage: { input: number; output: number };
  costEstimate: number | null;
}

export interface TranscriptionResult {
  text: string;
  displayText: string;
  model: string;
  confidence: number | null;
  meta: Record<string, unknown>;
}

export async function analyzeSpeechAcoustics(params: {
  wav: Buffer;
  taskType: string;
  referenceText: string;
  durationSeconds: number;
  audioQuality: Record<string, unknown>;
  qualityFlags: string[];
}): Promise<AcousticEvidence> {
  if (params.qualityFlags.includes('no_detectable_audio') || params.qualityFlags.includes('mostly_silence')) {
    return skippedAcousticEvidence(workerConfig.audioModel, params.qualityFlags);
  }
  if (workerConfig.aiMode === 'mock') return mockAcousticEvidence();
  if (!openai) throw new Error('OpenAI client is not configured for acoustic analysis');

  const completion = await openai.chat.completions.create({
    model: workerConfig.audioModel,
    temperature: 0,
    messages: [
      { role: 'system', content: ACOUSTIC_ANALYSIS_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              task_type: params.taskType,
              reference_text: params.referenceText,
              duration_seconds: params.durationSeconds,
              audio_quality: params.audioQuality,
            }),
          },
          {
            type: 'input_audio',
            input_audio: { data: params.wav.toString('base64'), format: 'wav' },
          },
        ],
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'submit_acoustic_assessment',
          description: 'Submit evidence-only acoustic observations for this learner recording.',
          parameters: ACOUSTIC_ASSESSMENT_JSON_SCHEMA,
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'submit_acoustic_assessment' } },
  });
  const toolCall = completion.choices[0]?.message.tool_calls?.find((call) => call.type === 'function');
  if (!toolCall || toolCall.type !== 'function') {
    throw new Error('OpenAI audio model did not return the required acoustic assessment');
  }
  const assessment = acousticAssessmentSchema.parse(JSON.parse(toolCall.function.arguments));
  return {
    provider: 'openai_gpt_audio',
    status: 'succeeded',
    model: workerConfig.audioModel,
    assessment,
    token_usage: {
      input: completion.usage?.prompt_tokens ?? 0,
      output: completion.usage?.completion_tokens ?? 0,
    },
    warnings: [],
  };
}

async function structuredCompletion<T>(params: {
  systemPrompt: string;
  payload: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  parse: (value: unknown) => T;
}): Promise<AiCallResult<T>> {
  if (!openai) throw new Error('OpenAI client is not configured');
  const completion = await openai.chat.completions.create({
    model: workerConfig.gradingModel,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: params.schemaName,
        strict: true,
        schema: params.schema,
      },
    },
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: JSON.stringify(params.payload) },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error(`OpenAI returned an empty ${params.schemaName} response`);
  const parsed = params.parse(JSON.parse(raw));
  return {
    result: parsed,
    model: workerConfig.gradingModel,
    tokenUsage: {
      input: completion.usage?.prompt_tokens ?? 0,
      output: completion.usage?.completion_tokens ?? 0,
    },
    costEstimate: null,
  };
}

function mockConstructedBatch(
  items: { itemId: string; taskType: string; responseText: string; rubric: Record<string, string>; hasAcousticEvidence?: boolean }[],
): ConstructedGradeBatch {
  return {
    items: items.map((item) => {
      const wordCount = item.responseText.trim().split(/\s+/).filter(Boolean).length;
      const itemScore = wordCount >= 80 ? 4 : wordCount >= 20 ? 3.5 : wordCount >= 5 ? 3 : 1.5;
      const acousticMissing = item.taskType.startsWith('speaking_') && item.hasAcousticEvidence === false;
      return {
        item_id: item.itemId,
        task_type: item.taskType,
        item_score: itemScore,
        rubric_scores: Object.keys(item.rubric).map((criterion) => ({
          criterion,
          score: itemScore,
          comment: `此項目目前為模擬批改結果（${criterion}）。`,
        })),
        overall_comment: '此為本機模擬批改，用於驗證完整流程與畫面呈現。',
        strengths: ['已完成作答並回應任務'],
        weaknesses: wordCount < 20 ? ['作答內容較短'] : [],
        improvement_suggestions: ['加入更具體的細節並檢查表達完整度。'],
        confidence_flag: acousticMissing ? 'low_confidence' : 'normal',
        evidence_flags: acousticMissing ? ['no_acoustic_evidence', 'mock_grading'] : ['mock_grading'],
      };
    }),
  };
}

function mockObjectiveFeedback(sectionType: 'reading' | 'listening', items: ObjectiveItemResult[]): ObjectiveFeedback {
  const incorrect = items.filter((item) => !item.is_correct);
  const categoryKeys = [...new Set(items.map((item) => item.category_key))];
  return {
    overall_comment: incorrect.length === 0
      ? `${sectionType === 'reading' ? '閱讀' : '聽力'}各題皆答對，請繼續維持目前的解題方式。`
      : `系統判定共有 ${incorrect.length} 個項目需要加強；以下評語不會改變系統分數。`,
    categories: categoryKeys.map((categoryKey) => ({
      category_key: categoryKey,
      incorrect_item_labels: incorrect.filter((item) => item.category_key === categoryKey).map((item) => item.item_label),
      comment: '此為本機模擬講評，正式模式會依逐題結果產生中文分析。',
    })),
    item_feedback: incorrect.map((item) => ({
      item_label: item.item_label,
      explanation: item.system_rationale ?? `你的答案與系統答案「${Array.isArray(item.correct_answer) ? item.correct_answer.join(' / ') : item.correct_answer}」不一致。`,
      focus: item.skill_tags.join('、') || '題意理解',
    })),
    strengths: items.length > incorrect.length ? ['部分題目能正確掌握關鍵資訊'] : [],
    weaknesses: incorrect.length > 0 ? ['需要針對錯題題型進行回顧'] : [],
    improvement_suggestions: ['依錯題題號重做一次，並說明每個答案的文字或語音證據。'],
    confidence_flag: 'normal',
    evidence_flags: ['mock_grading'],
  };
}

function compactObjectivePayload(items: ObjectiveItemResult[]) {
  const contexts = new Map<string, { id: string; title: string | null; text: string }>();
  const compactItems = items.map((item) => {
    let contextId: string | null = null;
    if (item.context_text) {
      const existing = [...contexts.values()].find((context) => context.text === item.context_text);
      if (existing) contextId = existing.id;
      else {
        contextId = `context-${contexts.size + 1}`;
        contexts.set(contextId, { id: contextId, title: item.context_title, text: item.context_text });
      }
    }
    return {
      item_id: item.item_id,
      item_label: item.item_label,
      module_no: item.module_no,
      question_no: item.question_no,
      task_type: item.task_type,
      category_key: item.category_key,
      skill_tags: item.skill_tags,
      student_answer: item.student_answer,
      correct_answer: item.correct_answer,
      is_correct: item.is_correct,
      question_text: item.question_text,
      options: item.options,
      context_id: contextId,
      system_rationale: item.system_rationale,
    };
  });
  return { contexts: [...contexts.values()], items: compactItems };
}

export async function gradeObjectiveSection(params: {
  sectionType: 'reading' | 'listening';
  systemScore: number;
  correctCount: number;
  totalQuestions: number;
  items: ObjectiveItemResult[];
}): Promise<AiCallResult<ObjectiveFeedback>> {
  if (workerConfig.aiMode === 'mock') {
    const result = mockObjectiveFeedback(params.sectionType, params.items);
    objectiveFeedbackSchema.parse(result);
    return { result, model: 'mock-gpt', tokenUsage: { input: 0, output: 0 }, costEstimate: 0 };
  }
  return structuredCompletion({
    systemPrompt: OBJECTIVE_FEEDBACK_SYSTEM_PROMPT,
    payload: {
      locale: 'zh-TW',
      score_authority: 'system',
      section_type: params.sectionType,
      system_score_0_30: params.systemScore,
      correct_count: params.correctCount,
      total_questions: params.totalQuestions,
      ...compactObjectivePayload(params.items),
    },
    schemaName: `${params.sectionType}_feedback_v2`,
    schema: OBJECTIVE_FEEDBACK_JSON_SCHEMA as unknown as Record<string, unknown>,
    parse: (value) => objectiveFeedbackSchema.parse(value),
  });
}

export async function gradeWritingBatch(items: {
  itemId: string;
  taskType: string;
  prompt: string;
  responseText: string;
  rubric: Record<string, string>;
}[]): Promise<AiCallResult<ConstructedGradeBatch>> {
  if (workerConfig.aiMode === 'mock') {
    const result = mockConstructedBatch(items);
    constructedGradeBatchSchema.parse(result);
    return { result, model: 'mock-gpt', tokenUsage: { input: 0, output: 0 }, costEstimate: 0 };
  }
  return structuredCompletion({
    systemPrompt: WRITING_GRADING_SYSTEM_PROMPT,
    payload: {
      locale: 'zh-TW',
      score_authority: 'ai_item_0_5_only',
      items: items.map((item) => ({
        item_id: item.itemId,
        task_type: item.taskType,
        prompt: item.prompt,
        student_response: item.responseText,
        rubric: item.rubric,
      })),
    },
    schemaName: 'writing_grades_v2',
    schema: CONSTRUCTED_GRADE_JSON_SCHEMA as unknown as Record<string, unknown>,
    parse: (value) => constructedGradeBatchSchema.parse(value),
  });
}

export async function gradeSpeakingBatch(items: {
  itemId: string;
  taskType: string;
  questionText: string;
  expectedText: string;
  transcript: string;
  durationSeconds: number;
  responseTimeSeconds: number;
  rubric: Record<string, string>;
  acousticEvidence: unknown;
  audioQuality: unknown;
}[]): Promise<AiCallResult<ConstructedGradeBatch>> {
  if (workerConfig.aiMode === 'mock') {
    const result = mockConstructedBatch(items.map((item) => ({
      itemId: item.itemId,
      taskType: item.taskType,
      responseText: item.transcript,
      rubric: item.rubric,
      hasAcousticEvidence: (item.acousticEvidence as { status?: string } | null)?.status === 'succeeded',
    })));
    constructedGradeBatchSchema.parse(result);
    return { result, model: 'mock-gpt', tokenUsage: { input: 0, output: 0 }, costEstimate: 0 };
  }
  return structuredCompletion({
    systemPrompt: SPEAKING_GRADING_SYSTEM_PROMPT,
    payload: {
      locale: 'zh-TW',
      score_authority: 'ai_item_0_5_only',
      items: items.map((item) => ({
        item_id: item.itemId,
        task_type: item.taskType,
        question_text: item.questionText,
        expected_text: item.expectedText,
        verbatim_transcript: item.transcript,
        duration_seconds: item.durationSeconds,
        response_time_seconds: item.responseTimeSeconds,
        rubric: item.rubric,
        acoustic_evidence: item.acousticEvidence,
        audio_quality: item.audioQuality,
      })),
    },
    schemaName: 'speaking_grades_v2',
    schema: CONSTRUCTED_GRADE_JSON_SCHEMA as unknown as Record<string, unknown>,
    parse: (value) => constructedGradeBatchSchema.parse(value),
  });
}

export async function translateFeedback(items: unknown[]): Promise<AiCallResult<TranslatedFeedbackBatch>> {
  if (workerConfig.aiMode === 'mock') {
    const result: TranslatedFeedbackBatch = {
      items: (items as { result_key: string; feedback: Record<string, unknown> }[]).map((item) => ({
        result_key: item.result_key,
        overall_comment: '[Mock English translation] Feedback is available for this result.',
        rubric_comments: [],
        categories: [],
        item_feedback: [],
        strengths: [],
        weaknesses: [],
        improvement_suggestions: [],
      })),
    };
    translatedFeedbackBatchSchema.parse(result);
    return { result, model: 'mock-gpt', tokenUsage: { input: 0, output: 0 }, costEstimate: 0 };
  }
  return structuredCompletion({
    systemPrompt: TRANSLATION_SYSTEM_PROMPT,
    payload: { source_locale: 'zh-TW', target_locale: 'en', items },
    schemaName: 'feedback_translation_en_v2',
    schema: TRANSLATED_FEEDBACK_JSON_SCHEMA as unknown as Record<string, unknown>,
    parse: (value) => translatedFeedbackBatchSchema.parse(value),
  });
}

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
  if (workerConfig.aiMode === 'mock') {
    const text = 'Er... I think the studen completed the spoken response.';
    return {
      text,
      displayText: 'Errr… I think the studen completed the spoken response.',
      model: 'mock-transcribe',
      confidence: 0.9,
      meta: { mock: true },
    };
  }
  if (!openai) throw new Error('OpenAI client is not configured for transcription');
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : mimeType.includes('mpeg') ? 'mp3' : 'webm';
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const file = new File([arrayBuffer], `audio.${ext}`, { type: mimeType });
  const result = await openai.audio.transcriptions.create({
    file,
    model: workerConfig.transcriptionModel,
    language: 'en',
    response_format: 'json',
    prompt: TRANSCRIPTION_PROMPT,
    include: ['logprobs'],
  });
  const response = result as unknown as {
    text: string;
    logprobs?: { token?: string; logprob?: number }[];
  };
  const logprobs = response.logprobs?.map((entry) => entry.logprob).filter((value): value is number => typeof value === 'number') ?? [];
  const averageLogprob = logprobs.length > 0 ? logprobs.reduce((sum, value) => sum + value, 0) / logprobs.length : null;
  const confidence = averageLogprob === null ? null : Math.max(0, Math.min(1, Math.exp(averageLogprob)));
  return {
    text: response.text,
    displayText: response.text,
    model: workerConfig.transcriptionModel,
    confidence,
    meta: {
      average_logprob: averageLogprob,
      token_count: logprobs.length,
      prompt_version: PROMPT_VERSION,
    },
  };
}

export { PROMPT_VERSION };
