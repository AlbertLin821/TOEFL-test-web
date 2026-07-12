import { z } from 'zod';
import { ROLES, SECTION_TYPES } from './constants.js';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(ROLES),
  password: z.string().min(8).max(100),
});

export const importUsersSchema = z.object({
  class_id: z.string().uuid().optional(),
  students: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        password: z.string().min(8).max(100).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const createClassSchema = z.object({
  name: z.string().min(1).max(100),
  teacher_id: z.string().uuid().optional(),
});

export const addClassMembersSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1),
});

export const createExamPaperSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const createExamVersionSchema = z.object({
  version_no: z.string().min(1).max(20),
  total_score: z.number().int().positive().optional(),
  sections: z
    .array(
      z.object({
        section_type: z.enum(SECTION_TYPES),
        title: z.string().min(1).max(100),
        order_no: z.number().int().min(1),
        score_max: z.number().int().min(0).default(30),
      }),
    )
    .optional(),
});

export const createAssignmentSchema = z
  .object({
    exam_version_id: z.string().uuid(),
    class_id: z.string().uuid(),
    opens_at: z.coerce.date(),
    closes_at: z.coerce.date(),
    max_attempts: z.number().int().min(1).max(10).default(1),
  })
  .refine((v) => v.closes_at > v.opens_at, {
    message: 'closes_at must be after opens_at',
    path: ['closes_at'],
  });

export const startAttemptSchema = z.object({
  assignment_id: z.string().uuid(),
});

export const saveResponseSchema = z.object({
  exam_item_id: z.string().uuid(),
  response_json: z.unknown(),
  client_saved_at: z.coerce.date().optional(),
});

export const updateSectionStateSchema = z.object({
  section_id: z.string().uuid(),
  module_id: z.string().uuid().nullable().optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  remaining_seconds: z.number().int().min(0).optional(),
  current_item_id: z.string().uuid().nullable().optional(),
});

export const teacherCommentSchema = z.object({
  comment_text: z.string().min(1).max(5000),
});

export const emailReportSchema = z.object({
  recipients: z.array(z.enum(['student', 'teacher'])).min(1),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});
