import { Check } from 'lucide-react';

interface ExamSuccessDialogProps {
  message: string;
  onContinue: () => void;
}

export default function ExamSuccessDialog({ message, onContinue }: ExamSuccessDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-success-title"
    >
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-8">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-300">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-exam-bar shrink-0">
            <Check className="w-4 h-4 text-white stroke-[3]" aria-hidden="true" />
          </span>
          <h2 id="exam-success-title" className="text-2xl font-normal text-slate-700">
            Success
          </h2>
        </div>
        <p className="text-slate-700 text-center leading-relaxed py-10 px-4">{message}</p>
        <button type="button" className="exam-flow-success-continue" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
