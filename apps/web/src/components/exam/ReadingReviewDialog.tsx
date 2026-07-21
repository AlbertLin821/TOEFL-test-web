import { useEffect } from 'react';

export interface ReadingReviewEntry {
  label: string;
  itemIdx: number;
  answered: boolean;
}

interface ReadingReviewDialogProps {
  entries: ReadingReviewEntry[];
  onJump: (itemIdx: number) => void;
  onClose: () => void;
}

export default function ReadingReviewDialog({ entries, onJump, onClose }: ReadingReviewDialogProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-review-title"
      >
        <h3 id="reading-review-title" className="font-semibold mb-3">
          Review
        </h3>
        <ul className="space-y-1 text-sm max-h-[60vh] overflow-y-auto">
          {entries.map((entry, index) => (
            <li key={`${entry.itemIdx}-${entry.label}-${index}`}>
              <button
                type="button"
                className="text-left w-full hover:underline"
                onClick={() => onJump(entry.itemIdx)}
              >
                {entry.label} {entry.answered ? '(answered)' : '(unanswered)'}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="mt-4 exam-btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
