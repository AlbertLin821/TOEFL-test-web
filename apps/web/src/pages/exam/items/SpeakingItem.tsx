import { useEffect, useRef, useState } from 'react';
import type { ExamItemDto } from '../../../api/client';

type Phase = 'ready' | 'playing_prompt' | 'recording' | 'uploading' | 'done' | 'error';

interface Props {
  item: ExamItemDto;
  volume: number;
  alreadyAnswered: boolean;
  onUpload: (blob: Blob, durationMs: number) => Promise<void>;
  onComplete: () => void;
}

export default function SpeakingItem({ item, volume, alreadyAnswered, onUpload, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>(alreadyAnswered ? 'done' : 'ready');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const responseSeconds = Number(item.content.response_seconds ?? 45);
  const questionText = item.content.question_text as string | null;
  const promptAudio = item.assets.find((a) => a.asset_type === 'audio');

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      recorderRef.current?.state === 'recording' && recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  function begin() {
    if (!promptAudio) {
      void startRecording();
      return;
    }
    setPhase('playing_prompt');
    const audio = new Audio(promptAudio.url);
    audio.volume = volume;
    audioRef.current = audio;
    audio.onended = () => void startRecording();
    audio.onerror = () => {
      setErrorMsg('題目音檔播放失敗');
      setPhase('error');
    };
    void audio.play().catch(() => {
      setErrorMsg('無法播放音檔，請點擊頁面後重試');
      setPhase('error');
    });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        clearInterval(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());
        const durationMs = Date.now() - startTimeRef.current;
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        setPhase('uploading');
        try {
          await onUpload(blob, durationMs);
          setPhase('done');
          setTimeout(onComplete, 800);
        } catch {
          setErrorMsg('錄音上傳失敗，請按 Retry 重試');
          setPhase('error');
        }
      };
      startTimeRef.current = Date.now();
      recorder.start();
      setPhase('recording');
      setRemaining(responseSeconds);
      timerRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r === null) return null;
          if (r <= 1) {
            clearInterval(timerRef.current);
            if (recorder.state === 'recording') recorder.stop();
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    } catch {
      setErrorMsg('無法使用麥克風，請確認瀏覽器已允許麥克風權限');
      setPhase('error');
    }
  }

  function stopEarly() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }

  return (
    <div className="max-w-3xl mx-auto text-center">
      {questionText && (
        <div className="card p-6 mb-8 text-left">
          <p className="text-[15px] leading-7 whitespace-pre-wrap">{questionText}</p>
        </div>
      )}

      {phase === 'ready' && (
        <div>
          <p className="text-slate-600 mb-6">
            按下 Start 後會播放題目音檔，播放結束後立即開始錄音（{responseSeconds} 秒）。
          </p>
          <button className="btn-primary" onClick={begin}>
            Start
          </button>
        </div>
      )}

      {phase === 'playing_prompt' && (
        <div className="py-8">
          <div className="inline-flex items-center gap-3 text-indigo-700 font-semibold">
            <span className="h-3 w-3 rounded-full bg-indigo-600 animate-pulse" aria-hidden />
            Playing question audio...
          </div>
          <p className="mt-2 text-sm text-slate-500">音檔播放結束後將自動開始錄音。</p>
        </div>
      )}

      {phase === 'recording' && (
        <div className="py-8">
          <div className="inline-flex items-center gap-3 text-red-600 font-bold text-lg">
            <span className="h-3 w-3 rounded-full bg-red-600 animate-pulse" aria-hidden />
            Recording... {remaining !== null ? `00:${String(remaining).padStart(2, '0')}` : ''}
          </div>
          <p className="mt-2 text-sm text-slate-500">時間到會自動停止錄音並送出。</p>
          <button className="btn-secondary mt-6" onClick={stopEarly}>
            Stop Speaking
          </button>
        </div>
      )}

      {phase === 'uploading' && <p className="py-8 text-slate-600">上傳錄音中...</p>}

      {phase === 'done' && (
        <div className="py-8">
          <p className="text-green-700 font-semibold">已完成本題錄音。</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="py-8">
          <p className="text-red-600">{errorMsg}</p>
          <button className="btn-primary mt-4" onClick={() => { setErrorMsg(null); setPhase('ready'); }}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
