import {
  aiGradeResultSchema,
  PROMPT_VERSION,
  SPEAKING_RUBRICS,
  WRITING_RUBRICS,
  type AiGradeResult,
} from '@toefl/shared';
import OpenAI from 'openai';
import { workerConfig } from './config.js';

const openai =
  workerConfig.aiMode === 'real' && workerConfig.openaiApiKey
    ? new OpenAI({ apiKey: workerConfig.openaiApiKey })
    : null;

function mockWritingGrade(taskType: string, text: string): AiGradeResult {
  const len = text.trim().split(/\s+/).filter(Boolean).length;
  const base = len >= 100 ? 22 : len >= 50 ? 18 : len >= 20 ? 14 : 10;
  return {
    skill: 'writing',
    task_type: taskType,
    overall_score: base,
    score_scale: '0-30',
    rubric_scores: {
      task_fulfillment: 4,
      content_development: len >= 80 ? 4 : 3,
      organization: 4,
      grammar_accuracy: 3,
      vocabulary_range: 3,
    },
    comments: {
      overall: 'The response addresses the task with reasonable organization. (Mock grading)',
      task_fulfillment: 'Main requirements are addressed.',
      content_development: len >= 80 ? 'Ideas are developed with some detail.' : 'More specific examples would help.',
      organization: 'The structure is generally clear.',
      grammar_accuracy: 'Some sentence-level errors may be present.',
      vocabulary_range: 'Vocabulary is adequate for the task.',
    },
    strengths: ['Relevant response to the prompt'],
    weaknesses: len < 80 ? ['Response could be more developed'] : ['Some grammar refinement needed'],
    improvement_suggestions: ['Add one concrete example.', 'Review sentence variety.'],
    confidence_flag: 'normal',
  };
}

function mockSpeakingGrade(taskType: string, transcript: string): AiGradeResult {
  const len = transcript.trim().split(/\s+/).filter(Boolean).length;
  const base = len >= 15 ? 21 : len >= 8 ? 17 : len >= 3 ? 12 : 8;
  return {
    skill: 'speaking',
    task_type: taskType,
    overall_score: base,
    score_scale: '0-30',
    rubric_scores: {
      content_accuracy: len >= 10 ? 4 : 3,
      fluency: 3,
      pronunciation: 3,
      grammar_structure: 3,
      completeness: len >= 8 ? 4 : 3,
    },
    comments: {
      overall: 'The spoken response was evaluated based on transcript. (Mock grading)',
      content_accuracy: 'Key content partially addressed.',
      fluency: 'Delivery appears moderately fluent based on transcript length.',
      pronunciation: 'Pronunciation inferred cautiously from transcript.',
      grammar_structure: 'Some structural issues may be present.',
      vocabulary_range: 'Vocabulary is appropriate for the task.',
    },
    strengths: len >= 8 ? ['Adequate response length'] : ['Attempted the task'],
    weaknesses: len < 8 ? ['Response was very brief'] : ['Could include more detail'],
    improvement_suggestions: ['Practice speaking in complete sentences.', 'Include specific examples.'],
    confidence_flag: len < 3 ? 'low_confidence' : 'normal',
  };
}

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<{ text: string; model: string }> {
  if (workerConfig.aiMode === 'mock' || !openai) {
    return { text: '[Mock transcript] The student provided a spoken response for evaluation.', model: 'mock-whisper' };
  }
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([buffer], `audio.${ext}`, { type: mimeType });
  const result = await openai.audio.transcriptions.create({
    file,
    model: workerConfig.transcriptionModel,
  });
  return { text: result.text, model: workerConfig.transcriptionModel };
}

export async function gradeWriting(params: {
  taskType: string;
  prompt: string;
  studentResponse: string;
  rubricKey: string;
}): Promise<{ result: AiGradeResult; model: string; tokenUsage: Record<string, number>; costEstimate: number }> {
  if (workerConfig.aiMode === 'mock' || !openai) {
    const result = mockWritingGrade(params.taskType, params.studentResponse);
    aiGradeResultSchema.parse(result);
    return { result, model: 'mock-gpt', tokenUsage: { input: 0, output: 0 }, costEstimate: 0 };
  }

  const rubric = WRITING_RUBRICS[params.rubricKey] ?? WRITING_RUBRICS.writing_email;
  const rubricText = Object.entries(rubric)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: workerConfig.gradingModel,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an English assessment rater for a TOEFL-style mock test platform.
Return only valid JSON matching the required schema. This is a mock test score, not an official TOEFL score.`,
      },
      {
        role: 'user',
        content: `Task Type: ${params.taskType}
Prompt: ${params.prompt}
Student Response: ${params.studentResponse}
Rubric:\n${rubricText}
Give overall_score 0-30 and rubric scores 1-5. Return JSON only.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = aiGradeResultSchema.parse(JSON.parse(raw));
  const usage = completion.usage;
  return {
    result: parsed,
    model: workerConfig.gradingModel,
    tokenUsage: {
      input: usage?.prompt_tokens ?? 0,
      output: usage?.completion_tokens ?? 0,
    },
    costEstimate: ((usage?.prompt_tokens ?? 0) * 0.00000015 + (usage?.completion_tokens ?? 0) * 0.0000006),
  };
}

export async function gradeSpeaking(params: {
  taskType: string;
  questionText: string;
  expectedKeyContent: string;
  transcript: string;
  durationSeconds: number;
  responseTimeSeconds: number;
  rubricKey: string;
}): Promise<{ result: AiGradeResult; model: string; tokenUsage: Record<string, number>; costEstimate: number }> {
  if (workerConfig.aiMode === 'mock' || !openai) {
    const result = mockSpeakingGrade(params.taskType, params.transcript);
    aiGradeResultSchema.parse(result);
    return { result, model: 'mock-gpt', tokenUsage: { input: 0, output: 0 }, costEstimate: 0 };
  }

  const rubric = SPEAKING_RUBRICS[params.rubricKey] ?? SPEAKING_RUBRICS.speaking_interview;
  const rubricText = Object.entries(rubric)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: workerConfig.gradingModel,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an English speaking assessment rater for a TOEFL-style mock test platform.
Return only valid JSON. This is a mock test score, not an official TOEFL score.`,
      },
      {
        role: 'user',
        content: `Task Type: ${params.taskType}
Question: ${params.questionText}
Expected Key Content: ${params.expectedKeyContent}
Student Transcript: ${params.transcript}
Audio Metadata: duration ${params.durationSeconds}s, limit ${params.responseTimeSeconds}s
Rubric:\n${rubricText}
Return JSON only.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = aiGradeResultSchema.parse(JSON.parse(raw));
  const usage = completion.usage;
  return {
    result: parsed,
    model: workerConfig.gradingModel,
    tokenUsage: {
      input: usage?.prompt_tokens ?? 0,
      output: usage?.completion_tokens ?? 0,
    },
    costEstimate: ((usage?.prompt_tokens ?? 0) * 0.00000015 + (usage?.completion_tokens ?? 0) * 0.0000006),
  };
}

export { PROMPT_VERSION };
