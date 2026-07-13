import { ChevronLeft, ChevronRight, Eye, EyeOff, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatTimeHms } from '../../lib/reading-exam-utils';

interface ReadingExamTopBarProps {
  sectionName: string;
  questionLabel: string;
  timerSeconds: number;
  showTimer: boolean;
  onToggleTimer: () => void;
  onReview?: () => void;
  onBack?: () => void;
  onNext?: () => void;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  exitTo?: string;
}

export default function ReadingExamTopBar({
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
  exitTo = '/student/exams',
}: ReadingExamTopBarProps) {
  const navigate = useNavigate();

  return (
    <header className="exam-reading-header">
      <div className="exam-reading-toolbar">
        <button type="button" className="exam-flow-exit" onClick={() => navigate(exitTo)}>
          EXIT
        </button>
        <div className="flex items-center gap-2">
          {onReview && (
            <button type="button" className="exam-reading-review-btn" onClick={onReview}>
              Review
              <List className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {onBack && (
            <button
              type="button"
              className="exam-reading-back-btn"
              disabled={backDisabled}
              onClick={onBack}
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Back
            </button>
          )}
          {onNext && (
            <button
              type="button"
              className="exam-reading-next-btn"
              disabled={nextDisabled}
              onClick={onNext}
            >
              Next
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className="exam-reading-subheader">
        <span>
          {sectionName} | {questionLabel}
        </span>
        <div className="flex items-center gap-3">
          {showTimer && (
            <span aria-live="polite" className="font-mono tabular-nums">
              {formatTimeHms(timerSeconds)}
            </span>
          )}
          <button type="button" className="exam-reading-hide-time-btn" onClick={onToggleTimer}>
            {showTimer ? 'Hide Time' : 'Show Time'}
            {showTimer ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
