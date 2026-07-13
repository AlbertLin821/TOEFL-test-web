import { useNavigate } from 'react-router-dom';
import { VolumeSmallIcon } from './HardwareCheckIcons';

export interface VolumeControlProps {
  open: boolean;
  level: number;
  onToggle: () => void;
  onChange: (level: number) => void;
}

interface ExamFlowShellProps {
  sectionLabel: string;
  onExit?: () => void;
  exitTo?: string;
  onVolume?: () => void;
  volumeControl?: VolumeControlProps;
  onContinue?: () => void;
  continueDisabled?: boolean;
  showVolume?: boolean;
  showContinue?: boolean;
  /** Header action label. Defaults to Continue; use Begin for section intro pages. */
  actionLabel?: string;
  children: React.ReactNode;
}

export default function ExamFlowShell({
  sectionLabel,
  onExit,
  exitTo = '/student/exams',
  onVolume,
  volumeControl,
  onContinue,
  continueDisabled = false,
  showVolume = true,
  showContinue = true,
  actionLabel = 'Continue',
  children,
}: ExamFlowShellProps) {
  const navigate = useNavigate();

  const handleExit = () => {
    if (onExit) onExit();
    else navigate(exitTo);
  };

  const handleVolumeClick = () => {
    if (volumeControl) volumeControl.onToggle();
    else if (onVolume) onVolume();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="exam-flow-header relative">
        <button type="button" className="exam-flow-exit" onClick={handleExit}>
          EXIT
        </button>
        <div className="flex items-center gap-2">
          {showVolume && (volumeControl || onVolume) && (
            <button type="button" className="exam-flow-header-btn" onClick={handleVolumeClick}>
              Volume
              <VolumeSmallIcon />
            </button>
          )}
          {showContinue && onContinue && (
            <button
              type="button"
              className="exam-flow-continue"
              disabled={continueDisabled}
              onClick={onContinue}
            >
              {actionLabel}
              <span aria-hidden="true">&gt;</span>
            </button>
          )}
        </div>
        {volumeControl?.open && (
          <div className="absolute right-4 top-full mt-1 z-10 bg-white border border-slate-300 rounded shadow-md px-4 py-3 min-w-[200px]">
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <VolumeSmallIcon className="w-5 h-5 text-exam-bar shrink-0" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volumeControl.level}
                onChange={(e) => volumeControl.onChange(Number(e.target.value))}
                className="flex-1 accent-exam-bar"
                aria-label="Volume"
              />
            </label>
          </div>
        )}
      </header>
      <div className="exam-flow-subheader">{sectionLabel}</div>
      <main className="flex-1">{children}</main>
    </div>
  );
}
