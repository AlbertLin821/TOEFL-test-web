export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let errBody: ApiErrorBody;
    try {
      errBody = await res.json();
    } catch {
      errBody = { code: 'UNKNOWN', message: res.statusText };
    }
    throw new ApiClientError(res.status, errBody);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  postForm: async <T>(path: string, form: FormData): Promise<T> => {
    const res = await fetch(`/api/v1${path}`, { method: 'POST', credentials: 'include', body: form });
    if (!res.ok) {
      let errBody: ApiErrorBody;
      try {
        errBody = await res.json();
      } catch {
        errBody = { code: 'UNKNOWN', message: res.statusText };
      }
      throw new ApiClientError(res.status, errBody);
    }
    return res.json() as Promise<T>;
  },
};

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: 'platform_admin' | 'org_admin' | 'teacher' | 'student';
  organization_id: string | null;
}

export interface ExamAssetDto {
  id: string;
  asset_type: string;
  mime_type: string;
  url: string;
}

export interface ExamItemDto {
  id: string;
  item_type: string;
  order_no: number;
  content: Record<string, unknown>;
  grading_type: string;
  time_limit_seconds: number | null;
  score_max: number;
  assets: ExamAssetDto[];
}

export interface ExamModuleDto {
  id: string;
  module_type: string;
  title: string;
  description: string | null;
  order_no: number;
  time_limit_seconds: number | null;
  allow_back: boolean;
  allow_review: boolean;
  allow_replay: boolean;
  items: ExamItemDto[];
}

export interface ExamSectionDto {
  id: string;
  section_type: 'reading' | 'listening' | 'writing' | 'speaking';
  title: string;
  order_no: number;
  score_max: number;
  modules: ExamModuleDto[];
}

export interface ExamVersionDto {
  id: string;
  exam_paper_id: string;
  exam_title: string;
  version_no: string;
  status: string;
  total_score: number;
  sections: ExamSectionDto[];
}

export interface AttemptDto {
  id: string;
  status: string;
  exam_version_id: string;
  current_section_id: string | null;
  current_item_id: string | null;
  last_saved_at: string | null;
  section_states: {
    section_id: string;
    module_id: string | null;
    status: string;
    remaining_seconds: number | null;
    current_item_id: string | null;
  }[];
  responses: { exam_item_id: string; response: unknown; saved_at: string }[];
  audio_responses: { exam_item_id: string; status: string; duration_ms: number | null }[];
}

export interface AvailableExamDto {
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
