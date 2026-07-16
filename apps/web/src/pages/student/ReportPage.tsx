import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AudioLines,
  CheckCircle2,
  ChevronDown,
  Languages,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
} from 'lucide-react';
import { api, type AiFeedbackItem, type TranslatedFeedbackItem } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

const TASK_LABELS: Record<string, string> = {
  reading_analysis: 'Reading 閱讀分析',
  listening_analysis: 'Listening 聽力分析',
  writing_email: 'Write an Email',
  writing_academic_discussion: 'Academic Discussion',
  speaking_listen_repeat: 'Listen and Repeat',
  speaking_interview: 'Take an Interview',
};

const CATEGORY_LABELS: Record<string, string> = {
  complete_the_words: 'Complete the Words',
  campus_context: 'Campus Context',
  academic_reading: 'Academic Reading',
  best_responses: 'Best Responses',
  campus_conversations: 'Campus Conversations',
  campus_announcements: 'Campus Announcements',
  academic_talks: 'Academic Talks',
};

const RUBRIC_LABELS: Record<string, string> = {
  organization: '組織結構',
  grammar_accuracy: '文法準確度',
  task_fulfillment: '任務完成度',
  vocabulary_range: '詞彙運用',
  content_development: '內容發展',
  relevance: '切題度',
  idea_development: '觀點發展',
  elaboration: '內容發展',
  fluency: '流暢度',
  completeness: '完整度',
  pronunciation: '發音',
  pronunciation_intelligibility: '發音與可理解度',
  content_accuracy: '內容準確度',
  grammar_structure: '文法結構',
};

const ACOUSTIC_CONFIDENCE_LABELS: Record<string, string> = { low: '低', medium: '中', high: '高' };
const SPEECH_RATE_LABELS: Record<string, string> = {
  slow: '偏慢',
  appropriate: '適中',
  fast: '偏快',
  variable: '變化較大',
  unknown: '無法判斷',
};

export default function ReportPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['report', attemptId],
    queryFn: () => api.getReport(attemptId!),
    enabled: !!attemptId,
    retry: 2,
    refetchInterval: (query) => {
      const status = query.state.data?.feedback_locales.en.status;
      return status === 'queued' || status === 'processing' ? 2500 : false;
    },
  });
  const translationMutation = useMutation({
    mutationFn: () => api.generateEnglishFeedback(attemptId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report', attemptId] }),
  });

  async function downloadPdf() {
    if (!attemptId) return;
    const { download_url } = await api.getReportPdf(attemptId);
    window.open(download_url, '_blank');
  }

  if (isLoading) return <div className="p-8">Loading report...</div>;
  if (error) return <div className="p-8 text-red-700">報告尚未完成或無法讀取。</div>;
  if (!data) return null;

  const skills = [
    ['reading', 'Reading', data.scores.reading],
    ['listening', 'Listening', data.scores.listening],
    ['writing', 'Writing', data.scores.writing],
    ['speaking', 'Speaking', data.scores.speaking],
  ] as const;
  const englishStatus = data.feedback_locales.en.status;
  const englishPending = englishStatus === 'queued' || englishStatus === 'processing' || translationMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">四技能英語模擬測驗報告</h1>
          {user?.role !== 'student' && (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
              {data.disclaimer}
            </p>
          )}
        </div>
        <button type="button" className="exam-btn-primary shrink-0" onClick={() => void downloadPdf()}>
          Download PDF
        </button>
      </header>
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <section className="bg-white rounded border p-5">
          <h2 className="font-semibold mb-2">學生資料</h2>
          <p>{data.student.name}</p>
          <p className="text-sm text-slate-600">{data.student.email}</p>
          <p className="text-sm mt-2">
            考卷：{data.exam_title} ({data.exam_version})
          </p>
        </section>
        <section className="bg-white rounded border p-5">
          <h2 className="font-semibold mb-3">分數總覽</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="pb-2">科目</th>
                <th className="pb-2 text-right">0–30</th>
                <th className="pb-2 text-right">Band</th>
                <th className="pb-2 text-right">CEFR</th>
              </tr>
            </thead>
            <tbody>
              {skills.map(([skill, name, score]) => {
                const profile = data.score_profile?.skills[skill];
                return (
                <tr key={skill} className="border-t">
                  <td className="py-2 font-medium">{name}</td>
                  <td className="py-2 text-right">{score ?? '批改中'}</td>
                  <td className="py-2 text-right">{profile ? `${profile.band_6} / 6` : '—'}</td>
                  <td className="py-2 text-right font-medium text-teal-800">{profile?.cefr ?? '—'}</td>
                </tr>
                );
              })}
              <tr className="border-t font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{data.scores.total ?? '批改中'}</td>
                <td className="py-2 text-right text-slate-400">—</td>
                <td className="py-2 text-right text-slate-400">—</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">Band 與 CEFR 由系統依固定版本換算，AI 不會修改分數。</p>
        </section>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">評語語言</h2>
            <p className="mt-1 text-xs text-slate-600">中文評語已預先產生；英文評語只翻譯既有內容，不會重新評分。</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => translationMutation.mutate()}
            disabled={englishPending || englishStatus === 'succeeded'}
          >
            {englishPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            {englishStatus === 'succeeded' ? '英文評語已產生' : englishPending ? '正在產生英文評語' : '產生英文評語'}
          </button>
        </section>
        {(translationMutation.isError || englishStatus === 'failed') && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            英文評語暫時無法產生，請稍後再試。
          </div>
        )}
        {data.ai_feedback.reading.length > 0 && (
          <AiFeedbackSection title="Reading AI 評語" skill="reading" items={data.ai_feedback.reading} />
        )}
        {data.ai_feedback.listening.length > 0 && (
          <AiFeedbackSection title="Listening AI 評語" skill="listening" items={data.ai_feedback.listening} />
        )}
        {data.ai_feedback.writing.length > 0 && (
          <AiFeedbackSection title="Writing AI 評語" skill="writing" items={data.ai_feedback.writing} />
        )}
        {data.ai_feedback.speaking.length > 0 && (
          <AiFeedbackSection title="Speaking AI 評語" skill="speaking" items={data.ai_feedback.speaking} />
        )}
        {englishStatus === 'succeeded' && data.feedback_locales.en.items.length > 0 && (
          <EnglishFeedbackSection items={data.feedback_locales.en.items} />
        )}
        {data.teacher_comments.map((c) => (
          <section key={c.comment_text} className="bg-white rounded border p-5">
            <h2 className="font-semibold">Teacher Comment ({c.teacher_name})</h2>
            <p className="mt-2">{c.comment_text}</p>
          </section>
        ))}
        <Link to="/student/exams" className="text-sm text-blue-600">
          返回考試列表
        </Link>
      </main>
    </div>
  );
}

function AiFeedbackSection({
  title,
  skill,
  items,
}: {
  title: string;
  skill: 'reading' | 'listening' | 'writing' | 'speaking';
  items: AiFeedbackItem[];
}) {
  return (
    <section className="overflow-hidden rounded border border-slate-200 bg-white" aria-labelledby={`${skill}-feedback-title`}>
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 id={`${skill}-feedback-title`} className="font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">選擇題目查看能力評分與具體建議。</p>
      </div>

      <div className="divide-y divide-slate-200">
        {items.map((item, index) => {
          const taskType = item.feedback?.task_type ?? '';
          const occurrence = items
            .slice(0, index + 1)
            .filter((candidate) => (candidate.feedback?.task_type ?? '') === taskType).length;
          const sameTypeCount = items.filter(
            (candidate) => (candidate.feedback?.task_type ?? '') === taskType,
          ).length;
          const taskLabel = TASK_LABELS[taskType] || formatLabel(taskType) || `第 ${index + 1} 題`;
          const displayLabel = sameTypeCount > 1 ? `${taskLabel} · 第 ${occurrence} 題` : taskLabel;
          const itemScale = item.feedback?.score_scale === '0-5' ? 5 : 30;

          return (
            <details key={item.result_key || item.exam_item_id || `${skill}-${index}`} className="group" open={index === 0}>
              <summary className="report-feedback-summary flex cursor-pointer select-none list-none items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{displayLabel}</p>
                  <p className="mt-0.5 text-xs text-slate-600">第 {index + 1} 項評語</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-right">
                    <span className="text-xl font-bold text-teal-800">{item.overall_score ?? '—'}</span>
                    <span className="ml-1 text-sm text-slate-600">/ {itemScale}</span>
                  </p>
                  <ChevronDown className="report-feedback-chevron h-5 w-5 text-slate-500" aria-hidden="true" />
                </div>
              </summary>

              <div className="report-feedback-body">
                <FeedbackDetails item={item} />
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function FeedbackDetails({ item }: { item: AiFeedbackItem }) {
  const feedback = item.feedback ?? {};
  const comments = feedback.comments ?? {};
  const rubric = item.rubric ?? {};
  const rubricEntries = Object.entries(rubric);
  const strengths = feedback.strengths ?? [];
  const weaknesses = feedback.weaknesses ?? [];
  const suggestions = feedback.improvement_suggestions ?? [];
  const categories = feedback.categories ?? [];
  const categoryStats = feedback.category_stats ?? [];
  const itemFeedback = feedback.item_feedback ?? [];
  const acousticAssessment = feedback.acoustic_evidence?.assessment;

  return (
    <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5">
      {item.status === 'manual_review_required' && (
        <div className="mb-5 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>此題需要老師進一步確認評分。</p>
        </div>
      )}

      {comments.overall && (
        <div className="mb-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MessageSquareText className="h-4 w-4 text-teal-800" aria-hidden="true" />
            整體評語
          </h3>
          <p className="mt-2 max-w-[72ch] text-sm leading-6 text-slate-700">{comments.overall}</p>
        </div>
      )}

      {rubricEntries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">能力評分</h3>
          <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {rubricEntries.map(([key, score]) => (
              <div key={key}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800">{RUBRIC_LABELS[key] ?? formatLabel(key)}</span>
                  <span className="font-semibold text-slate-900">{score} / 5</span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-label={RUBRIC_LABELS[key] ?? formatLabel(key)}
                  aria-valuemin={0}
                  aria-valuemax={5}
                  aria-valuenow={score}
                >
                  <div
                    className="report-rubric-fill h-full rounded-full bg-teal-700"
                    style={{ width: `${Math.max(0, Math.min(5, score)) * 20}%` }}
                  />
                </div>
                {comments[key] && <p className="mt-1.5 text-xs leading-5 text-slate-600">{comments[key]}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {acousticAssessment && (
        <div className="mt-6 rounded-lg border border-sky-200 bg-sky-50/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <AudioLines className="h-4 w-4 text-sky-700" aria-hidden="true" />
                AI 聲學觀察
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                由原始音訊判斷，作為口說 Rubric 的輔助證據，不是額外考試分數，也不評價音色。
              </p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-sky-200">
              信心：{ACOUSTIC_CONFIDENCE_LABELS[acousticAssessment.confidence] ?? formatLabel(acousticAssessment.confidence)}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            語速：{SPEECH_RATE_LABELS[acousticAssessment.speech_rate] ?? formatLabel(acousticAssessment.speech_rate)}
            {' · '}填充詞估計：{acousticAssessment.filler_count_estimate} 次
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ['可理解度', acousticAssessment.intelligibility_score],
              ['節奏', acousticAssessment.rhythm_score],
              ['停頓運用', acousticAssessment.pausing_score],
              ['語調', acousticAssessment.prosody_score],
            ] as const).map(([label, score]) => (
              <div key={label} className="rounded-md bg-white p-3 ring-1 ring-sky-100">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{score}<span className="ml-1 text-xs font-normal text-slate-500">/ 100</span></p>
              </div>
            ))}
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {Object.entries(acousticAssessment.observations).map(([key, observation]) => (
              <div key={key}>
                <dt className="font-medium text-slate-800">{{ intelligibility: '可理解度', rhythm: '節奏', pausing: '停頓', prosody: '語調' }[key] ?? formatLabel(key)}</dt>
                <dd className="mt-1 leading-6 text-slate-600">{observation}</dd>
              </div>
            ))}
          </dl>
          {acousticAssessment.possible_word_level_issues.length > 0 && (
            <div className="mt-4 border-t border-sky-200 pt-4">
              <p className="text-xs font-semibold text-slate-800">可能的單字層級發音現象（非音素測量）</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
                {acousticAssessment.possible_word_level_issues.map((issue, index) => (
                  <li key={`${issue.reference_word}-${index}`}>
                    {issue.reference_word && <strong>{issue.reference_word}</strong>}
                    {issue.heard_as && ` → 聽感接近「${issue.heard_as}」`}
                    {`：${issue.observation}（信心${ACOUSTIC_CONFIDENCE_LABELS[issue.confidence] ?? formatLabel(issue.confidence)}）`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {categories.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900">題型分析</h3>
          <div className="mt-3 space-y-3">
            {categories.map((category) => {
              const stats = categoryStats.find((value) => value.category_key === category.category_key);
              return (
                <div key={category.category_key} className="rounded border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      {CATEGORY_LABELS[category.category_key] ?? formatLabel(category.category_key)}
                    </h4>
                    {stats && <span className="text-xs font-medium text-slate-600">{stats.correct_count} / {stats.total_questions} 正確</span>}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{category.comment}</p>
                  {category.incorrect_item_labels.length > 0 && (
                    <p className="mt-2 text-xs text-amber-800">錯題：{category.incorrect_item_labels.join('、')}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {itemFeedback.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900">錯題說明</h3>
          <div className="mt-3 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
            {itemFeedback.map((feedbackItem) => (
              <div key={feedbackItem.item_label} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-900">{feedbackItem.item_label}</span>
                  <span className="text-xs text-slate-500">重點：{feedbackItem.focus}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{feedbackItem.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {strengths.length > 0 && (
            <FeedbackList
              title="表現優點"
              items={strengths}
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />}
            />
          )}
          {weaknesses.length > 0 && (
            <FeedbackList
              title="待加強項目"
              items={weaknesses}
              icon={<AlertCircle className="h-4 w-4 text-amber-700" aria-hidden="true" />}
            />
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-6 rounded-lg bg-teal-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-teal-950">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            改善建議
          </h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-teal-950">
            {suggestions.map((suggestion, index) => (
              <li key={`${suggestion}-${index}`}>{suggestion}</li>
            ))}
          </ol>
        </div>
      )}

      {(feedback.display_transcript || feedback.transcript) && (
        <details className="mt-5 rounded border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
            查看語音轉寫文字
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {feedback.display_transcript ?? feedback.transcript}
          </p>
        </details>
      )}
    </div>
  );
}

function EnglishFeedbackSection({ items }: { items: TranslatedFeedbackItem[] }) {
  return (
    <section className="overflow-hidden rounded border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Languages className="h-4 w-4 text-teal-800" aria-hidden="true" />
          English Feedback
        </h2>
        <p className="mt-1 text-sm text-slate-600">This is a translation of the completed Chinese feedback; scores are unchanged.</p>
      </div>
      <div className="divide-y divide-slate-200">
        {items.map((item) => (
          <details key={item.result_key} className="group">
            <summary className="report-feedback-summary flex cursor-pointer select-none list-none items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold text-slate-900">{formatLabel(item.result_key.replace(/^(section|item):/, ''))}</span>
              <ChevronDown className="report-feedback-chevron h-5 w-5 text-slate-500" aria-hidden="true" />
            </summary>
            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5 text-sm leading-6 text-slate-700">
              <p>{item.overall_comment}</p>
              {item.categories.map((category) => (
                <div key={category.category_key} className="mt-4">
                  <h3 className="font-semibold text-slate-900">{CATEGORY_LABELS[category.category_key] ?? formatLabel(category.category_key)}</h3>
                  <p className="mt-1">{category.comment}</p>
                </div>
              ))}
              {item.item_feedback.length > 0 && (
                <div className="mt-4 space-y-2">
                  {item.item_feedback.map((feedbackItem) => (
                    <p key={feedbackItem.item_label}>
                      <strong>{feedbackItem.item_label}:</strong> {feedbackItem.explanation}
                    </p>
                  ))}
                </div>
              )}
              {item.improvement_suggestions.length > 0 && (
                <ul className="mt-4 list-disc space-y-1 pl-5">
                  {item.improvement_suggestions.map((suggestion, index) => (
                    <li key={`${item.result_key}-suggestion-${index}`}>{suggestion}</li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function FeedbackList({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </h3>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2">
            <span className="text-slate-400" aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
