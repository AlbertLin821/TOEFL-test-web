import { useNavigate } from 'react-router-dom';

interface ExamTopBarProps {
  sectionName: string;
  questionLabel: string;
  timerSeconds?: number | null;
  showTimer: boolean;
  onToggleTimer: () => void;
  onReview?: () => void;
  onBack?: () => void;
  onNext?: () => void;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  nextLabel?: string;
  extra?: React.ReactNode;
  exitTo?: string;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function ExamTopBar({
  sectionName,
  questionLabel,
  timerSeconds,
  showTimer,
  onToggleTimer,
  onReview,
  onBack,
  onNext,
  backDisabled,
  nextDisabled,
  nextLabel = 'Next',
  extra,
  exitTo = '/student/exams',
}: ExamTopBarProps) {
  const navigate = useNavigate();
  return (
    <header className="exam-topbar">
      <div className="flex items-center gap-4">
        <button type="button" className="exam-btn font-semibold" onClick={() => navigate(exitTo)}>
          EXIT
        </button>
        <span className="font-medium">{sectionName}</span>
        <span className="text-white/80">{questionLabel}</span>
      </div>
      <div className="flex items-center gap-2">
        {showTimer && timerSeconds !== null && timerSeconds !== undefined && (
          <span aria-live="polite" className="font-mono mr-2">
            {formatTime(timerSeconds)}
          </span>
        )}
        <button type="button" className="exam-btn" onClick={onToggleTimer}>
          {showTimer ? 'Hide Time' : 'Show Time'}
        </button>
        {onReview && (
          <button type="button" className="exam-btn" onClick={onReview}>
            Review
          </button>
        )}
        {onBack && (
          <button type="button" className="exam-btn" disabled={backDisabled} onClick={onBack}>
            Back
          </button>
        )}
        {extra}
        {onNext && (
          <button type="button" className="exam-btn bg-white/20" disabled={nextDisabled} onClick={onNext}>
            {nextLabel}
          </button>
        )}
      </div>
    </header>
  );
}
