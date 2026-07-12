import { useState } from 'react';
import { formatTime } from './useCountdown';

export interface TopBarProps {
  sectionName: string;
  questionLabel?: string | null;
  remainingSeconds?: number | null;
  showBack?: boolean;
  showNext?: boolean;
  nextDisabled?: boolean;
  onBack?: () => void;
  onNext?: () => void;
  onExit?: () => void;
  onReview?: () => void;
  showReview?: boolean;
  volumeControl?: boolean;
  volume?: number;
  onVolumeChange?: (v: number) => void;
  nextLabel?: string;
}

export default function TopBar(props: TopBarProps) {
  const [timeHidden, setTimeHidden] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  return (
    <div className="bg-exam-bar text-white">
      <div className="flex items-center justify-between px-4 py-2 gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <button className="btn-bar" onClick={props.onExit} aria-label="Exit exam">
            EXIT
          </button>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{props.sectionName}</div>
            {props.questionLabel && <div className="text-xs text-indigo-200">{props.questionLabel}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {props.remainingSeconds !== undefined && props.remainingSeconds !== null && (
            <>
              {!timeHidden && (
                <span className="font-mono text-sm bg-exam-barDark rounded px-2 py-1" aria-live="off">
                  {formatTime(props.remainingSeconds)}
                </span>
              )}
              <button className="btn-bar" onClick={() => setTimeHidden((h) => !h)}>
                {timeHidden ? 'Show Time' : 'Hide Time'}
              </button>
            </>
          )}
          {props.volumeControl && (
            <div className="relative">
              <button className="btn-bar" onClick={() => setShowVolume((s) => !s)}>
                Volume
              </button>
              {showVolume && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded shadow-lg p-3 z-20 w-40">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round((props.volume ?? 1) * 100)}
                    onChange={(e) => props.onVolumeChange?.(Number(e.target.value) / 100)}
                    className="w-full"
                    aria-label="Volume"
                  />
                </div>
              )}
            </div>
          )}
          {props.showReview && (
            <button className="btn-bar" onClick={props.onReview}>
              Review
            </button>
          )}
          {props.showBack && (
            <button className="btn-bar" onClick={props.onBack}>
              Back
            </button>
          )}
          {props.showNext && (
            <button className="btn-bar bg-white/20" onClick={props.onNext} disabled={props.nextDisabled}>
              {props.nextLabel ?? 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
