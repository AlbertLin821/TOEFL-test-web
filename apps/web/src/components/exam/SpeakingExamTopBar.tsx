import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VolumeSmallIcon } from './HardwareCheckIcons';
import { formatTimeHms } from '../../lib/reading-exam-utils';

interface SpeakingExamTopBarProps {
  questionLabel: string;
  timerSeconds: number;
  showTimer: boolean;
  onToggleTimer: () => void;
  volume: number;
  volumeOpen: boolean;
  onToggleVolume: () => void;
  onVolumeChange: (level: number) => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  exitTo?: string;
}

export default function SpeakingExamTopBar({
  questionLabel,
  timerSeconds,
  showTimer,
  onToggleTimer,
  volume,
  volumeOpen,
  onToggleVolume,
  onVolumeChange,
  onNext,
  nextDisabled,
  exitTo = '/student/exams',
}: SpeakingExamTopBarProps) {
  const navigate = useNavigate();

  return (
    <header className="relative">
      <div className="exam-reading-toolbar">
        <button type="button" className="exam-flow-exit" onClick={() => navigate(exitTo)}>
          EXIT
        </button>
        <div className="flex items-center gap-2">
          <button type="button" className="exam-flow-header-btn" onClick={onToggleVolume}>
            Volume
            <VolumeSmallIcon />
          </button>
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
      {volumeOpen && (
        <div className="absolute right-4 top-[2.75rem] z-10 bg-white border border-slate-300 rounded shadow-md px-4 py-3 min-w-[200px]">
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <VolumeSmallIcon className="w-5 h-5 text-exam-bar shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="flex-1 accent-exam-bar"
              aria-label="Volume"
            />
          </label>
        </div>
      )}
      <div className="exam-reading-subheader">
        <span>Speaking | {questionLabel}</span>
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
