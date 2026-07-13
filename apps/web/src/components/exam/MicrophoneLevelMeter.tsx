import { Check, X } from 'lucide-react';

export const EXAMPLE_BAR_COUNT = 24;
export const EXAMPLE_QUIET_BARS = 8;
export const EXAMPLE_GOOD_BARS = 8;

export const RECORD_BAR_COUNT = 18;
export const RECORD_QUIET_BARS = 4;
export const RECORD_GOOD_BARS = 10;
export const RECORD_LOUD_BARS = 4;

export type MeterFillMode = 'good' | 'too_loud' | 'live';

interface MicrophoneLevelMeterProps {
  filledBars: number;
  mode: MeterFillMode;
  showResult?: 'good' | 'too_loud';
  variant?: 'example' | 'record';
}

function exampleBarColor(index: number, filledBars: number, mode: MeterFillMode): string {
  if (index >= filledBars) return 'bg-white border border-slate-300';
  if (mode === 'too_loud') return 'bg-[#c8232c] border border-[#c8232c]';
  return 'bg-exam-bar border border-exam-bar';
}

function recordBarColor(index: number, filledBars: number): string {
  if (index >= filledBars) return 'bg-white border border-slate-400';
  if (index >= RECORD_QUIET_BARS + RECORD_GOOD_BARS) return 'bg-[#c8232c] border border-[#c8232c]';
  return 'bg-exam-bar border border-exam-bar';
}

function ExampleMeterBars({ filledBars, mode }: { filledBars: number; mode: MeterFillMode }) {
  return (
    <div className="relative">
      <div className="flex items-end gap-[3px] h-16">
        {Array.from({ length: EXAMPLE_BAR_COUNT }, (_, i) => (
          <div key={i} className={`w-[10px] h-full rounded-sm ${exampleBarColor(i, filledBars, mode)}`} />
        ))}
      </div>
      <div
        className="absolute top-0 bottom-0 border-l border-dashed border-slate-400 pointer-events-none"
        style={{ left: `${(EXAMPLE_QUIET_BARS / EXAMPLE_BAR_COUNT) * 100}%` }}
      />
      <div
        className="absolute top-0 bottom-0 border-l border-dashed border-slate-400 pointer-events-none"
        style={{ left: `${((EXAMPLE_QUIET_BARS + EXAMPLE_GOOD_BARS) / EXAMPLE_BAR_COUNT) * 100}%` }}
      />
      <div className="flex text-xs text-slate-600 mt-2">
        <span className="text-center" style={{ width: `${(EXAMPLE_QUIET_BARS / EXAMPLE_BAR_COUNT) * 100}%` }}>
          Too Quiet
        </span>
        <span className="text-center" style={{ width: `${(EXAMPLE_GOOD_BARS / EXAMPLE_BAR_COUNT) * 100}%` }}>
          Good
        </span>
        <span className="text-center flex-1">Too Loud</span>
      </div>
    </div>
  );
}

function RecordMeterBars({ filledBars }: { filledBars: number }) {
  const barWidth = 14;
  const barGap = 3;
  const meterWidth = RECORD_BAR_COUNT * barWidth + (RECORD_BAR_COUNT - 1) * barGap;
  const goodLeft = RECORD_QUIET_BARS * (barWidth + barGap);
  const goodWidth = RECORD_GOOD_BARS * barWidth + (RECORD_GOOD_BARS - 1) * barGap;
  const loudLeft = goodLeft + goodWidth + barGap;

  return (
    <div className="inline-block">
      <div className="relative" style={{ width: meterWidth, height: 40 }}>
        <div
          className="absolute top-0 h-10 bg-slate-100 border-y border-slate-300 pointer-events-none"
          style={{ left: goodLeft, width: goodWidth }}
        />
        <div className="relative flex items-end h-10" style={{ gap: barGap }}>
          {Array.from({ length: RECORD_BAR_COUNT }, (_, i) => (
            <div
              key={i}
              className={`rounded-sm ${recordBarColor(i, filledBars)}`}
              style={{ width: barWidth, height: 40 }}
            />
          ))}
        </div>
        <div className="absolute top-0 h-10 border-l border-slate-500 pointer-events-none" style={{ left: goodLeft }} />
        <div className="absolute top-0 h-10 border-l border-slate-500 pointer-events-none" style={{ left: loudLeft }} />
      </div>
      <div className="flex text-xs text-slate-600 mt-2" style={{ width: meterWidth }}>
        <span style={{ width: goodLeft, textAlign: 'center' }}>
          Too Quiet
        </span>
        <span style={{ width: goodWidth, textAlign: 'center' }}>
          Good
        </span>
        <span className="flex-1 text-center">Too Loud</span>
      </div>
    </div>
  );
}

export default function MicrophoneLevelMeter({
  filledBars,
  mode,
  showResult,
  variant = 'example',
}: MicrophoneLevelMeterProps) {
  return (
    <div className="space-y-3">
      {variant === 'record' ? (
        <RecordMeterBars filledBars={filledBars} />
      ) : (
        <ExampleMeterBars filledBars={filledBars} mode={mode} />
      )}
      {showResult === 'good' && (
        <div className="flex items-center gap-2 text-slate-700">
          <Check className="w-8 h-8 text-exam-bar stroke-[3]" aria-hidden="true" />
          <span className="text-xl font-semibold">Good</span>
        </div>
      )}
      {showResult === 'too_loud' && (
        <div className="flex items-center gap-2 text-slate-700">
          <X className="w-8 h-8 text-[#c8232c] stroke-[3]" aria-hidden="true" />
          <span className="text-xl font-semibold">Too Loud</span>
        </div>
      )}
    </div>
  );
}

export function MicrophoneMeterExamples() {
  return (
    <div className="grid md:grid-cols-2 gap-12 max-w-3xl">
      <MicrophoneLevelMeter filledBars={11} mode="good" showResult="good" />
      <MicrophoneLevelMeter filledBars={22} mode="too_loud" showResult="too_loud" />
    </div>
  );
}
