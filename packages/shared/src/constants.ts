export const ROLES = ['platform_admin', 'org_admin', 'teacher', 'student'] as const;
export type Role = (typeof ROLES)[number];

export const SECTION_TYPES = ['reading', 'listening', 'writing', 'speaking'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const ITEM_TYPES = [
  'reading_fill_blank',
  'reading_single_choice',
  'listening_single_choice',
  'writing_sentence_order',
  'writing_email',
  'writing_academic_discussion',
  'speaking_listen_repeat',
  'speaking_interview',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const GRADING_TYPES = ['auto', 'ai', 'manual'] as const;
export type GradingType = (typeof GRADING_TYPES)[number];

export const ATTEMPT_STATUSES = [
  'not_started',
  'hardware_check',
  'in_progress',
  'submitted',
  'grading',
  'completed',
  'expired',
  'error',
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const JOB_TYPES = [
  'writing_grading',
  'speaking_transcription',
  'speaking_grading',
  'report_generation',
  'email_send',
  'pdf_generation',
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['queued', 'processing', 'succeeded', 'failed', 'retrying'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const SCORE_SCALE_MAX = 30;
export const TOTAL_SCALE_MAX = 120;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  TENANT_SCOPE_VIOLATION: 'TENANT_SCOPE_VIOLATION',
  NOT_FOUND: 'NOT_FOUND',
  EXAM_NOT_OPEN: 'EXAM_NOT_OPEN',
  EXAM_CLOSED: 'EXAM_CLOSED',
  MAX_ATTEMPTS_REACHED: 'MAX_ATTEMPTS_REACHED',
  ATTEMPT_ALREADY_SUBMITTED: 'ATTEMPT_ALREADY_SUBMITTED',
  AUDIO_UPLOAD_FAILED: 'AUDIO_UPLOAD_FAILED',
  AI_GRADING_FAILED: 'AI_GRADING_FAILED',
  REPORT_NOT_READY: 'REPORT_NOT_READY',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const QUEUE_NAMES = {
  grading: 'grading',
  email: 'email',
  report: 'report',
} as const;

export const MOCK_DISCLAIMER =
  'This is a mock test report and not an official TOEFL score report.';
