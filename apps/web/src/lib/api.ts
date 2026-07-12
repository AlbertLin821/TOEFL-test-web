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

export const api = {
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
  getReportPdf: (attemptId: string) => request<{ download_url: string }>(`/reports/${attemptId}/pdf`),
  teacherResults: () => request<{ data: TeacherResultRow[] }>('/teacher/results'),
  getClasses: () => request<{ data: ClassRow[] }>('/classes'),
  getAssignments: () => request<{ data: AssignmentRow[] }>('/assignments'),
};

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
  ai_feedback: { writing: unknown[]; speaking: unknown[] };
  teacher_comments: { comment_text: string; teacher_name: string }[];
  disclaimer: string;
}

export interface TeacherResultRow {
  student_id: string;
  student_name: string;
  attempt_id: string;
  status: string;
  exam_title: string;
  total_score: number | null;
  reading_score: number | null;
  listening_score: number | null;
  writing_score: number | null;
  speaking_score: number | null;
}

export interface ClassRow {
  id: string;
  name: string;
  teacher_name: string | null;
  student_count: number;
}

export interface AssignmentRow {
  id: string;
  exam_title: string;
  class_name: string | null;
  status: string;
  opens_at: string;
  closes_at: string;
}
