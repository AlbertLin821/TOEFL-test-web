import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock3, FileText, Home, LoaderCircle, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

type JobState = 'queued' | 'processing' | 'succeeded' | 'failed';

const JOB_LABELS: Record<string, string> = {
  objective_feedback: '閱讀/聽力 AI 講評',
  writing_grading: '寫作 AI 批改',
  speaking_transcription: '口說逐字轉錄與聲學分析',
  speaking_grading: '口說 AI 批改',
  report_generation: '成績與報告產生',
  feedback_translation: '英文評語翻譯',
};

const JOB_STATUS_LABELS: Record<JobState, string> = {
  queued: '等待中',
  processing: '處理中',
  succeeded: '已完成',
  failed: '失敗',
};

const ATTEMPT_STATUS_LABELS: Record<string, string> = {
  submitted: '已提交，等待批改',
  grading: '批改中',
  completed: '批改完成',
  error: '批改失敗',
};

function normalizeJobStatus(status: string): JobState {
  if (['succeeded', 'completed', 'done'].includes(status)) return 'succeeded';
  if (['failed', 'error'].includes(status)) return 'failed';
  if (['processing', 'running', 'active', 'grading'].includes(status)) return 'processing';
  return 'queued';
}

function jobTone(status: JobState) {
  if (status === 'succeeded') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-800';
  if (status === 'processing') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-slate-200 bg-white text-slate-600';
}

function JobIcon({ status }: { status: JobState }) {
  if (status === 'succeeded') return <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />;
  if (status === 'failed') return <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />;
  if (status === 'processing') return <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />;
  return <Clock3 className="h-5 w-5 text-slate-400" aria-hidden="true" />;
}

export default function GradingPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['grading', attemptId],
    queryFn: () => api.gradingStatus(attemptId!),
    enabled: !!attemptId,
    refetchInterval: (q) => (
      ['completed', 'error'].includes(q.state.data?.attempt_status ?? '') ? false : 3000
    ),
  });

  const jobs = data?.jobs.map((job) => ({ ...job, normalizedStatus: normalizeJobStatus(job.status) })) ?? [];
  const failedJobs = jobs.filter((job) => job.normalizedStatus === 'failed');
  const completedJobs = jobs.filter((job) => job.normalizedStatus === 'succeeded').length;
  const progressText = jobs.length ? `${completedJobs} / ${jobs.length} 項完成` : '正在建立批改工作';
  const attemptStatus = data?.attempt_status ?? 'loading';
  const isComplete = attemptStatus === 'completed';
  const hasError = attemptStatus === 'error' || failedJobs.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <main className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scoring Pipeline</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                {ATTEMPT_STATUS_LABELS[attemptStatus] ?? '批改中'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                閱讀與聽力已由系統判分；寫作、口說與報告會在背景依序完成。
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${
                hasError
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : isComplete
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-blue-200 bg-blue-50 text-blue-800'
              }`}
            >
              {isComplete ? <CheckCircle2 className="h-4 w-4" /> : hasError ? <AlertCircle className="h-4 w-4" /> : <LoaderCircle className="h-4 w-4 animate-spin" />}
              {progressText}
            </span>
          </div>
        </section>

        {hasError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800" role="alert">
            批改暫時失敗。請聯絡老師或管理員重新執行失敗項目
            {failedJobs.length > 0 ? `（${failedJobs.map((job) => JOB_LABELS[job.job_type] ?? job.job_type).join('、')}）` : ''}。
          </div>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            {jobs.length ? (
              jobs.map((job) => (
                <div key={job.id} className={`flex items-center justify-between gap-4 rounded-md border p-4 ${jobTone(job.normalizedStatus)}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <JobIcon status={job.normalizedStatus} />
                    <span className="truncate font-medium">{JOB_LABELS[job.job_type] ?? job.job_type}</span>
                  </div>
                  <span className="shrink-0 text-sm">{JOB_STATUS_LABELS[job.normalizedStatus]}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-4 text-slate-600">
                <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
                正在讀取批改狀態
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          {isComplete ? (
            <Link to={`/reports/${attemptId}`} className="exam-btn-primary inline-flex items-center gap-2">
              <FileText className="h-4 w-4" aria-hidden="true" />
              查看報告
            </Link>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
              重新整理
            </button>
          )}
          <Link to="/student/exams" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <Home className="h-4 w-4" aria-hidden="true" />
            返回首頁
          </Link>
        </div>
      </main>
    </div>
  );
}
