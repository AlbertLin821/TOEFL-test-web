import { createPortal } from 'react-dom';

interface SpeakingStopDialogProps {
  open: boolean;
}

export default function SpeakingStopDialog({ open }: SpeakingStopDialogProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="speaking-stop-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="speaking-stop-dialog-title"
    >
      <div className="speaking-stop-dialog">
        <h2 id="speaking-stop-dialog-title" className="speaking-stop-dialog-title">
          Stop Speaking
        </h2>
        <div className="speaking-stop-dialog-body">
          <p>Response time has ended.</p>
          <p>Please wait. We are currently saving your response.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
