import OpenAI from 'openai';
import {
  aiGradeResultSchema,
  WRITING_RUBRICS,
  SPEAKING_RUBRICS,
  PROMPT_VERSION,
  type AiGradeResult,
} from '@toefl/shared';
import { config } from '../config.js';

export interface GradeOutcome {
  result: AiGradeResult;
  modelName: string;
  promptVersion: string;
  tokenUsage: { input_tokens: number; output_tokens: number };
  costEstimate: number;
}

export interface WritingGradeInput {
  taskType: 'writing_email' | 'writing_academic_discussion';
  prompt: string;
  studentResponse: string;
}

export interface SpeakingGradeInput {
  taskType: 'speaking_listen_repeat' | 'speaking_interview';
  questionText: string;
  expectedKeyContent: string;
  transcript: string;
  durationSeconds: number | null;
  responseTimeSeconds: number;
}

const openai = config.aiMode === 'real' ? new OpenAI({ apiKey: config.openaiApiKey }) : null;

const WRITING_SYSTEM = `You are an English assessment rater for a TOEFL-style mock test platform.

You must evaluate the student's response according to the provided rubric.
Return only valid JSON that matches the required schema.
Do not include markdown.
Do not include explanations outside the JSON.

This is a mock test score, not an official TOEFL score.`;

const SPEAKING_SYSTEM = `You are an English speaking assessment rater for a TOEFL-style mock test platform.

You will evaluate a student's spoken response based on transcript and available audio metadata.
Return only valid JSON that matches the required schema.
Do not include markdown.
Do not include explanations outside the JSON.

This is a mock test score, not an official TOEFL score.`;

function schemaDescription(skill: 'writing' | 'speaking', taskType: string, rubricKeys: string[]): string {
  return `Required JSON schema:
{
  "skill": "${skill}",
  "task_type": "${taskType}",
  "overall_score": <number 0-30>,
  "score_scale": "0-30",
  "rubric_scores": { ${rubricKeys.map((k) => `"${k}": <number 1-5>`).join(', ')} },
  "comments": { "overall": <string>, ${rubricKeys.map((k) => `"${k}": <string>`).join(', ')} },
  "strengths": [<string>...],
  "weaknesses": [<string>...],
  "improvement_suggestions": [<string>...],
  "confidence_flag": "normal" | "low_confidence"
}`;
}

// ---------------- Mock mode ----------------

function mockGrade(skill: 'writing' | 'speaking', taskType: string, responseText: string): AiGradeResult {
  const rubric = skill === 'writing' ? WRITING_RUBRICS[taskType] : SPEAKING_RUBRICS[taskType];
  const keys = Object.keys(rubric ?? { quality: '' });
  const words = responseText.trim().split(/\s+/).filter(Boolean).length;
  // Deterministic heuristic score so the demo pipeline behaves consistently.
  const base = words === 0 ? 0 : Math.min(5, 2 + Math.floor(Math.log2(1 + words / 15)));
  const rubricScores = Object.fromEntries(keys.map((k, i) => [k, Math.max(1, Math.min(5, base - (i % 2)))]));
  const avg = Object.values(rubricScores).reduce((a, b) => a + b, 0) / keys.length;
  const overall = Math.round((avg / 5) * 30);
  return {
    skill,
    task_type: taskType,
    overall_score: words === 0 ? 0 : overall,
    score_scale: '0-30',
    rubric_scores: rubricScores,
    comments: {
      overall:
        words === 0
          ? 'No response was provided.'
          : 'This is a mock AI evaluation generated in local development mode. The response is on topic and understandable.',
      ...Object.fromEntries(keys.map((k) => [k, `Mock feedback for ${k.replace(/_/g, ' ')}.`])),
    },
    strengths: words === 0 ? [] : ['Addresses the task', 'Understandable main idea'],
    weaknesses: words === 0 ? ['No response provided'] : ['Could include more specific examples'],
    improvement_suggestions:
      words === 0 ? ['Provide a response within the time limit.'] : ['Add one concrete example.', 'Vary sentence structures.'],
    confidence_flag: 'normal',
  };
}

// ---------------- Real mode helpers ----------------

async function callOpenAiJson(system: string, userMessage: string): Promise<{ json: unknown; usage: { input_tokens: number; output_tokens: number } }> {
  const completion = await openai!.chat.completions.create({
    model: config.gradingModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  const content = completion.choices[0]?.message?.content ?? '{}';
  return {
    json: JSON.parse(content),
    usage: {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

function estimateCost(usage: { input_tokens: number; output_tokens: number }): number {
  // Rough gpt-4o-mini pricing estimate; adjust per deployed model.
  return usage.input_tokens * 0.15e-6 + usage.output_tokens * 0.6e-6;
}

// ---------------- Public API ----------------

export async function gradeWriting(input: WritingGradeInput): Promise<GradeOutcome> {
  const rubric = WRITING_RUBRICS[input.taskType];
  if (config.aiMode === 'mock') {
    return {
      result: mockGrade('writing', input.taskType, input.studentResponse),
      modelName: 'mock-grader',
      promptVersion: PROMPT_VERSION,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
      costEstimate: 0,
    };
  }
  const userMessage = `Task Type:
${input.taskType}

Prompt:
${input.prompt}

Student Response:
${input.studentResponse || '(no response)'}

Rubric:
${JSON.stringify(rubric, null, 2)}

Scoring Requirement:
- Give an overall score from 0 to 30.
- Give each rubric score from 1 to 5.
- Provide concise but useful comments.
- Provide strengths, weaknesses, and improvement suggestions.
- If the response is too short or off-topic, reflect that in the score.
- Return JSON only.

${schemaDescription('writing', input.taskType, Object.keys(rubric))}`;

  const { json, usage } = await callOpenAiJson(WRITING_SYSTEM, userMessage);
  const parsed = aiGradeResultSchema.parse(json);
  return {
    result: parsed,
    modelName: config.gradingModel,
    promptVersion: PROMPT_VERSION,
    tokenUsage: usage,
    costEstimate: estimateCost(usage),
  };
}

export async function gradeSpeaking(input: SpeakingGradeInput): Promise<GradeOutcome> {
  const rubric = SPEAKING_RUBRICS[input.taskType];
  if (config.aiMode === 'mock') {
    return {
      result: mockGrade('speaking', input.taskType, input.transcript),
      modelName: 'mock-grader',
      promptVersion: PROMPT_VERSION,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
      costEstimate: 0,
    };
  }
  const userMessage = `Task Type:
${input.taskType}

Question:
${input.questionText}

Expected Key Content:
${input.expectedKeyContent}

Student Transcript:
${input.transcript || '(no speech detected)'}

Audio Metadata:
- Duration: ${input.durationSeconds ?? 'unknown'} seconds
- Response time limit: ${input.responseTimeSeconds} seconds

Rubric:
${JSON.stringify(rubric, null, 2)}

Scoring Requirement:
- Give an overall score from 0 to 30.
- Give each rubric score from 1 to 5.
- For pronunciation and fluency, infer cautiously from transcript and metadata.
- If audio/transcript quality is insufficient, set confidence_flag to "low_confidence".
- Return JSON only.

${schemaDescription('speaking', input.taskType, Object.keys(rubric))}`;

  const { json, usage } = await callOpenAiJson(SPEAKING_SYSTEM, userMessage);
  const parsed = aiGradeResultSchema.parse(json);
  return {
    result: parsed,
    modelName: config.gradingModel,
    promptVersion: PROMPT_VERSION,
    tokenUsage: usage,
    costEstimate: estimateCost(usage),
  };
}

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<{ text: string; model: string }> {
  if (config.aiMode === 'mock') {
    return {
      text: '(mock transcript) This is a simulated transcription generated in local development mode.',
      model: 'mock-transcriber',
    };
  }
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm';
  const file = new File([new Uint8Array(buffer)], `speech.${ext}`, { type: mimeType });
  const result = await openai!.audio.transcriptions.create({
    model: config.transcriptionModel,
    file,
  });
  return { text: result.text, model: config.transcriptionModel };
}
