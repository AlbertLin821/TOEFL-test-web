import { z } from 'zod';
import { ROLES, SECTION_TYPES } from './constants.js';

const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((email) => email.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: z.string().min(8).max(100),
});

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(ROLES),
  password: z.string().min(8).max(100),
  organization_id: z.string().uuid().nullable().optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    password: z.string().min(8).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' });

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
  organization_id: z.string().uuid().optional(),
});

export const updateClassSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    teacher_id: z.string().uuid().nullable().optional(),
    status: z.enum(['active', 'archived']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' });

export const addClassMembersSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1),
});

export const createExamPaperSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  organization_id: z.string().uuid().nullable().optional(),
});

export const updateExamPaperSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' });

export const updateExamVersionSchema = z
  .object({
    status: z.enum(['draft', 'published', 'archived']).optional(),
    total_score: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' });

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
    organization_id: z.string().uuid().optional(),
    opens_at: z.coerce.date(),
    closes_at: z.coerce.date(),
    max_attempts: z.number().int().min(1).max(10).default(1),
  })
  .refine((v) => v.closes_at > v.opens_at, {
    message: 'closes_at must be after opens_at',
    path: ['closes_at'],
  });

export const updateAssignmentSchema = z
  .object({
    opens_at: z.coerce.date().optional(),
    closes_at: z.coerce.date().optional(),
    max_attempts: z.number().int().min(1).max(10).optional(),
    status: z.enum(['scheduled', 'active', 'closed']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' });

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
