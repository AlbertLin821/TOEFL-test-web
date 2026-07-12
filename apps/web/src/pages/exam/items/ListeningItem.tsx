import { useEffect, useRef, useState } from 'react';
import type { ExamItemDto } from '../../../api/client';
import ChoiceItem from './ChoiceItem';

interface Props {
  item: ExamItemDto;
  value: { selected_option_index?: number } | null;
  volume: number;
  onChange: (v: { selected_option_index: number }) => void;
  onTimeExpired: () => void;
}

/**
 * Listening question: plays the prompt audio once (options grayed out while
 * playing), then enables options and starts the answer countdown.
 */
export default function ListeningItem({ item, value, volume, onChange, onTimeExpired }: Props) {
  const audioAsset = item.assets.find((a) => a.asset_type === 'audio');
  const [audioDone, setAudioDone] = useState(!audioAsset);
  const [remaining, setRemaining] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const onTimeExpiredRef = useRef(onTimeExpired);
  onTimeExpiredRef.current = onTimeExpired;

  const answerSeconds = item.time_limit_seconds ?? 20;

  useEffect(() => {
    setAudioDone(!audioAsset);
    setRemaining(null);
    clearInterval(timerRef.current);

    if (audioAsset) {
      const audio = new Audio(audioAsset.url);
      audio.volume = volume;
      audioRef.current = audio;
      audio.onended = () => setAudioDone(true);
      audio.onerror = () => setAudioDone(true);
      void audio.play().catch(() => setAudioDone(true));
    }
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audioDone) return;
    setRemaining(answerSeconds);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r === null) return null;
        if (r <= 1) {
          clearInterval(timerRef.current);
          onTimeExpiredRef.current();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioDone, item.id]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-center gap-3 text-sm" aria-live="polite">
        {!audioDone ? (
          <span className="inline-flex items-center gap-2 text-indigo-700 font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 animate-pulse" aria-hidden />
            Playing audio... 音檔僅播放一次
          </span>
        ) : (
          <span className="text-slate-500">
            請作答{remaining !== null ? `（剩餘 ${remaining} 秒）` : ''}
          </span>
        )}
      </div>
      <ChoiceItem item={item} value={value} onChange={onChange} disabled={!audioDone} showStimulus={false} />
    </div>
  );
}
