import type { ExamItemDto } from '../../../api/client';

interface Props {
  item: ExamItemDto;
  value: { selected_option_index?: number } | null;
  onChange: (v: { selected_option_index: number }) => void;
  disabled?: boolean;
  showStimulus?: boolean;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function ChoiceItem({ item, value, onChange, disabled = false, showStimulus = true }: Props) {
  const options = (item.content.options ?? []) as string[];
  const stimulusTitle = item.content.stimulus_title as string | null;
  const stimulusText = item.content.stimulus_text as string | null;
  const questionText = item.content.question_text as string | null;
  const instructions = item.content.instructions as string | null;

  const hasStimulus = showStimulus && stimulusText;

  return (
    <div className={`mx-auto ${hasStimulus ? 'max-w-6xl grid md:grid-cols-2 gap-8' : 'max-w-3xl'}`}>
      {hasStimulus && (
        <div className="card p-6 max-h-[65vh] overflow-y-auto">
          {stimulusTitle && <h3 className="font-bold mb-3">{stimulusTitle}</h3>}
          <div className="text-[15px] leading-7 whitespace-pre-wrap">{stimulusText}</div>
        </div>
      )}
      <div>
        {instructions && <p className="font-semibold mb-2 text-sm text-slate-600">{instructions}</p>}
        {questionText && <p className="font-semibold mb-4 whitespace-pre-wrap">{questionText}</p>}
        <div className="space-y-2" role="radiogroup" aria-label="Answer options">
          {options.map((opt, i) => {
            const selected = value?.selected_option_index === i;
            return (
              <button
                key={i}
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange({ selected_option_index: i })}
                className={`w-full text-left flex items-start gap-3 rounded border px-4 py-3 text-[15px] transition-colors ${
                  disabled
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                    : selected
                      ? 'border-indigo-600 bg-indigo-50 text-slate-900'
                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-900'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    selected && !disabled ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-400'
                  }`}
                >
                  {LETTERS[i]}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
        {disabled && (
          <p className="mt-3 text-xs text-slate-400">音檔播放中，播放結束後即可選擇答案。</p>
        )}
      </div>
    </div>
  );
}
