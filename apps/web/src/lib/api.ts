export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  organization_id: string | null;
}

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(body.code ?? 'ERROR', body.message ?? res.statusText, res.status);
  }
  return body as T;
}

function withQuery(path: string, params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<{ user: ApiUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ user: ApiUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<ApiUser>('/users/me'),
  availableExams: () =>
    request<{ data: AvailableExam[] }>('/student/available-exams'),
  startAttempt: (assignment_id: string) =>
    request<{ attempt_id: string; status: string; exam_version_id: string }>('/attempts/start', {
      method: 'POST',
      body: JSON.stringify({ assignment_id }),
    }),
  getAttempt: (id: string) => request<AttemptState>(`/attempts/${id}`),
  getExamVersion: (id: string) => request<ExamVersionDetail>(`/exam-versions/${id}`),
  saveResponse: (attemptId: string, exam_item_id: string, response_json: unknown) =>
    request<{ saved: boolean }>(`/attempts/${attemptId}/response`, {
      method: 'PATCH',
      body: JSON.stringify({ exam_item_id, response_json }),
    }),
  saveSectionState: (attemptId: string, body: Record<string, unknown>) =>
    request<{ saved: boolean }>(`/attempts/${attemptId}/section-state`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  hardwareCheckComplete: (attemptId: string) =>
    request<{ status: string }>(`/attempts/${attemptId}/hardware-check-complete`, { method: 'POST' }),
  submitAttempt: (attemptId: string) =>
    request<{ status: string; grading_job_ids: string[] }>(`/attempts/${attemptId}/submit`, { method: 'POST' }),
  uploadAudio: async (attemptId: string, examItemId: string, blob: Blob, durationMs: number) => {
    const fd = new FormData();
    fd.append('exam_item_id', examItemId);
    fd.append('duration_ms', String(durationMs));
    fd.append('audio', blob, 'recording.webm');
    const res = await fetch(`/api/v1/attempts/${attemptId}/audio`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    });
    const body = await res.json();
    if (!res.ok) throw new ApiClientError(body.code, body.message, res.status);
    return body;
  },
  gradingStatus: (attemptId: string) =>
    request<{ attempt_status: string; jobs: { id: string; job_type: string; status: string }[] }>(
      `/attempts/${attemptId}/grading-status`,
    ),
  getReport: (attemptId: string) => request<ReportDetail>(`/reports/${attemptId}`),
  generateEnglishFeedback: (attemptId: string) =>
    request<{ status: string; grading_job_id?: string; cached?: boolean }>(
      `/reports/${attemptId}/feedback-translations/en`,
      { method: 'POST' },
    ),
  getReportPdf: (attemptId: string) => request<{ download_url: string }>(`/reports/${attemptId}/pdf`),
  teacherResults: (organizationId?: string) =>
    request<{ data: TeacherResultRow[] }>(withQuery('/teacher/results', { organization_id: organizationId })),
  getClasses: (organizationId?: string) =>
    request<{ data: ClassRow[] }>(withQuery('/classes', { organization_id: organizationId })),
  getAssignments: (organizationId?: string) =>
    request<{ data: AssignmentRow[] }>(withQuery('/assignments', { organization_id: organizationId })),
  getOrganizations: () => request<{ data: OrganizationRow[] }>('/organizations'),
  getOrganization: (id: string) => request<OrganizationRow>(`/organizations/${id}`),
  createOrganization: (body: Record<string, unknown>) => request<OrganizationRow>('/organizations', { method: 'POST', body: JSON.stringify(body) }),
  updateOrganization: (id: string, body: Record<string, unknown>) => request<OrganizationRow>(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteOrganization: (id: string) => request<{ deleted: boolean }>(`/organizations/${id}`, { method: 'DELETE' }),
  getUsers: (organizationId?: string, page = 1, pageSize = 100) =>
    request<{ data: AdminUserRow[]; pagination: Pagination }>(withQuery('/users', { organization_id: organizationId, page, page_size: pageSize })),
  createUser: (body: Record<string, unknown>) => request<AdminUserRow>('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: Record<string, unknown>) => request<AdminUserRow>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id: string) => request<{ deleted: boolean }>(`/users/${id}`, { method: 'DELETE' }),
  createClass: (body: Record<string, unknown>) => request<ClassRow>('/classes', { method: 'POST', body: JSON.stringify(body) }),
  updateClass: (id: string, body: Record<string, unknown>) => request<ClassRow>(`/classes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteClass: (id: string) => request<{ deleted: boolean }>(`/classes/${id}`, { method: 'DELETE' }),
  getExamPapers: (organizationId?: string) => request<{ data: ExamPaperRow[] }>(withQuery('/exam-papers', { organization_id: organizationId })),
  createExamPaper: (body: Record<string, unknown>) => request<ExamPaperRow>('/exam-papers', { method: 'POST', body: JSON.stringify(body) }),
  updateExamPaper: (id: string, body: Record<string, unknown>) => request<ExamPaperRow>(`/exam-papers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteExamPaper: (id: string) => request<{ deleted: boolean }>(`/exam-papers/${id}`, { method: 'DELETE' }),
  updateExamVersion: (id: string, body: Record<string, unknown>) => request<ExamVersionRow>(`/exam-versions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createAssignment: (body: Record<string, unknown>) => request<AssignmentRow>('/assignments', { method: 'POST', body: JSON.stringify(body) }),
  updateAssignment: (id: string, body: Record<string, unknown>) => request<AssignmentRow>(`/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAssignment: (id: string) => request<{ deleted: boolean }>(`/assignments/${id}`, { method: 'DELETE' }),
};

export interface Pagination { page: number; page_size: number; total: number }

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  plan_type: string | null;
  student_quota: number;
  exam_quota: number;
  ai_credit_quota: number;
  user_count: number;
  class_count: number;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: 'platform_admin' | 'org_admin' | 'teacher' | 'student';
  status: 'active' | 'inactive';
  createdAt?: string;
}

export interface ExamVersionRow { id: string; version_no: string; status: string; total_score: number }

export interface ExamPaperRow {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  organization_id: string | null;
  latest_version: string | null;
  versions: ExamVersionRow[];
}

export interface AvailableExam {
  assignment_id: string;
  exam_title: string;
  version_no: string;
  teacher_name: string | null;
  opens_at: string;
  closes_at: string;
  max_attempts: number;
  attempts_used: number;
  status: string;
  active_attempt_id: string | null;
  active_attempt_status: string | null;
  latest_attempt_id: string | null;
}

export interface AttemptState {
  id: string;
  status: string;
  exam_version_id: string;
  current_section_id: string | null;
  current_item_id: string | null;
  section_states: {
    section_id: string;
    module_id: string | null;
    status: string;
    remaining_seconds: number | null;
    current_item_id: string | null;
  }[];
  responses: { exam_item_id: string; response: unknown }[];
  audio_responses: { exam_item_id: string; status: string }[];
}

export interface ExamVersionDetail {
  id: string;
  exam_title: string;
  version_no: string;
  sections: ExamSectionDetail[];
}

export interface ExamSectionDetail {
  id: string;
  section_type: string;
  title: string;
  order_no: number;
  modules: ExamModuleDetail[];
}

export interface ExamModuleDetail {
  id: string;
  module_type: string;
  title: string;
  description: string | null;
  order_no: number;
  time_limit_seconds: number | null;
  allow_back: boolean;
  allow_review: boolean;
  items: ExamItemDetail[];
}

export interface ExamItemDetail {
  id: string;
  item_type: string;
  order_no: number;
  content: Record<string, unknown>;
  grading_type: string;
  time_limit_seconds: number | null;
  assets: { id: string; asset_type: string; url: string }[];
}

export interface ReportDetail {
  attempt_id: string;
  status: string;
  student: { name: string; email: string };
  exam_title: string;
  exam_version: string;
  scores: {
    reading: number | null;
    listening: number | null;
    writing: number | null;
    speaking: number | null;
    total: number | null;
  };
  score_profile: {
    conversion_version: string;
    skills: Record<'reading' | 'listening' | 'writing' | 'speaking', SkillScoreProfile | null>;
  } | null;
  ai_feedback: {
    reading: AiFeedbackItem[];
    listening: AiFeedbackItem[];
    writing: AiFeedbackItem[];
    speaking: AiFeedbackItem[];
  };
  feedback_locales: {
    'zh-TW': { status: string };
    en: {
      status: string;
      generated_at: string | null;
      items: TranslatedFeedbackItem[];
    };
  };
  teacher_comments: { comment_text: string; teacher_name: string }[];
  disclaimer: string;
}

export interface SkillScoreProfile {
  score_30: number;
  band_6: number;
  cefr: string;
  raw_score?: number;
  raw_max?: number;
  repeat_average_5?: number | null;
  interview_average_5?: number | null;
  composite_5?: number | null;
}

export interface AiFeedbackItem {
  result_key: string;
  exam_item_id: string | null;
  overall_score: number | null;
  rubric?: Record<string, number>;
  feedback?: {
    comments?: Record<string, string>;
    strengths?: string[];
    weaknesses?: string[];
    improvement_suggestions?: string[];
    transcript?: string | null;
    display_transcript?: string | null;
    acoustic_evidence?: {
      provider: string;
      status: string;
      model?: string;
      assessment?: {
        intelligibility_score: number;
        rhythm_score: number;
        pausing_score: number;
        prosody_score: number;
        speech_rate: string;
        filler_count_estimate: number;
        observations: {
          intelligibility: string;
          rhythm: string;
          pausing: string;
          prosody: string;
        };
        possible_word_level_issues: {
          reference_word: string;
          heard_as: string;
          observation: string;
          confidence: string;
        }[];
        confidence: string;
        evidence_flags: string[];
      } | null;
    };
    task_type?: string;
    score_scale?: string;
    item_score?: number;
    confidence_flag?: string;
    evidence_flags?: string[];
    category_stats?: { category_key: string; correct_count: number; total_questions: number }[];
    categories?: { category_key: string; incorrect_item_labels: string[]; comment: string }[];
    item_feedback?: { item_label: string; explanation: string; focus: string }[];
  };
  status?: string;
  model_name?: string;
}

export interface TeacherResultRow {
  student_id: string;
  student_name: string;
  attempt_id: string;
  status: string;
  exam_title: string;
  class_name: string | null;
  submitted_at: string | null;
  total_score: number | null;
  reading_score: number | null;
  listening_score: number | null;
  writing_score: number | null;
  speaking_score: number | null;
}

export interface ClassRow {
  id: string;
  name: string;
  status: 'active' | 'archived';
  teacher_id: string | null;
  teacher_name: string | null;
  student_count: number;
}

export interface AssignmentRow {
  id: string;
  exam_version_id: string;
  exam_title: string;
  version_no: string;
  class_id: string | null;
  class_name: string | null;
  status: string;
  opens_at: string;
  closes_at: string;
  max_attempts: number;
  attempt_count: number;
}

export interface TranslatedFeedbackItem {
  result_key: string;
  overall_comment: string;
  rubric_comments: { criterion: string; comment: string }[];
  categories: { category_key: string; comment: string }[];
  item_feedback: { item_label: string; explanation: string; focus: string }[];
  strengths: string[];
  weaknesses: string[];
  improvement_suggestions: string[];
}
