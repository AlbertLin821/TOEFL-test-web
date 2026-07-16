import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
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
  onExit?: () => void | Promise<void>;
}

function formatTime(s: number) {
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
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
  onExit,
}: ExamTopBarProps) {
  const navigate = useNavigate();
  return (
    <div className="exam-item-header">
      <header className="exam-topbar">
        <button
          type="button"
          className="exam-btn font-semibold"
          onClick={() => {
            if (onExit) void onExit();
            else navigate(exitTo);
          }}
        >
          EXIT
        </button>
        <div className="flex items-center gap-2">
          {onReview && (
            <button type="button" className="exam-btn" onClick={onReview}>
              Review
            </button>
          )}
          {onBack && (
            <button type="button" className="exam-btn exam-btn-back" disabled={backDisabled} onClick={onBack}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          )}
          {extra}
          {onNext && (
            <button type="button" className="exam-btn exam-btn-next" disabled={nextDisabled} onClick={onNext}>
              {nextLabel}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      <div className="exam-item-subheader">
        <div className="flex items-center gap-5">
          <span className="font-medium">{sectionName}</span>
          <span className="text-slate-500">{questionLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          {showTimer && timerSeconds !== null && timerSeconds !== undefined && (
            <span aria-label="Time remaining" className="font-mono tabular-nums">
              {formatTime(timerSeconds)}
            </span>
          )}
          <button type="button" className="exam-time-toggle" onClick={onToggleTimer}>
            {showTimer ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
            {showTimer ? 'Hide Time' : 'Show Time'}
          </button>
        </div>
      </div>
    </div>
  );
}
