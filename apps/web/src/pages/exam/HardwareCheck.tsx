import { useEffect, useRef, useState } from 'react';

type Step = 'intro' | 'volume' | 'microphone';

export default function HardwareCheck({
  onComplete,
  onExit,
}: {
  onComplete: () => void;
  onExit: () => void;
}) {
  const [step, setStep] = useState<Step>('intro');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-exam-bar text-white flex items-center justify-between px-4 py-2">
        <button className="btn-bar" onClick={onExit}>
          EXIT
        </button>
        <div className="text-sm font-bold">Hardware Check</div>
        <div className="w-16" />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        {step === 'intro' && <IntroStep onContinue={() => setStep('volume')} />}
        {step === 'volume' && <VolumeStep onContinue={() => setStep('microphone')} />}
        {step === 'microphone' && <MicrophoneStep onContinue={onComplete} />}
      </div>
    </div>
  );
}

function IntroStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="card max-w-xl w-full p-8 text-center">
      <div className="mb-4 flex justify-center gap-4 text-xs font-semibold text-indigo-700" aria-hidden>
        <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-2">Headset</span>
        <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-2">Microphone</span>
        <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-2">Speaker</span>
      </div>
      <h2 className="text-xl font-bold">Hardware Check</h2>
      <p className="mt-4 text-sm text-slate-600 leading-relaxed">
        考試開始前，請先完成耳機音量與麥克風測試。
        <br />
        請確認你已佩戴耳機，並且允許瀏覽器使用麥克風。
        <br />
        完成硬體檢查後才能進入正式考試。
      </p>
      <button className="btn-primary mt-6" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}

function VolumeStep({ onContinue }: { onContinue: () => void }) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);

  function playTestTone() {
    const ctx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = volume * 0.3;
    osc.frequency.value = 440;
    osc.connect(gain);
    gain.connect(ctx.destination);
    setPlaying(true);
    osc.start();
    osc.stop(ctx.currentTime + 1.5);
    osc.onended = () => {
      setPlaying(false);
      setPlayed(true);
    };
  }

  useEffect(() => () => void audioCtxRef.current?.close(), []);

  return (
    <div className="card max-w-xl w-full p-8 text-center">
      <h2 className="text-xl font-bold">Adjust Volume</h2>
      <p className="mt-4 text-sm text-slate-600">請播放測試音檔並調整音量，直到你可以清楚聽到聲音。</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <span className="text-xs text-slate-500">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          className="w-56"
          aria-label="Volume"
        />
        <span className="text-xs text-slate-500 w-8">{Math.round(volume * 100)}</span>
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <button className="btn-secondary" onClick={playTestTone} disabled={playing}>
          {playing ? 'Playing...' : played ? 'Play Again' : 'Play Test Sound'}
        </button>
        <button className="btn-primary" onClick={onContinue} disabled={!played}>
          Continue
        </button>
      </div>
      {!played && <p className="mt-3 text-xs text-slate-400">請先播放測試音檔</p>}
    </div>
  );
}

function MicrophoneStep({ onContinue }: { onContinue: () => void }) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'success' | 'denied' | 'error'>('idle');
  const [level, setLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>();

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevel(Math.min(100, Math.round((data.reduce((a, b) => a + b, 0) / data.length / 255) * 300)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        cancelAnimationFrame(rafRef.current!);
        void ctx.close();
        stream.getTracks().forEach((t) => t.stop());
        if (chunks.length > 0 && chunks.some((c) => c.size > 0)) {
          setStatus('success');
        } else {
          setStatus('error');
        }
      };
      recorder.start();
      setStatus('recording');
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 3000);
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
        setStatus('denied');
      } else {
        setStatus('error');
      }
    }
  }

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return (
    <div className="card max-w-xl w-full p-8 text-center">
      <h2 className="text-xl font-bold">Adjusting the Microphone</h2>
      <p className="mt-4 text-sm text-slate-600">
        按 RECORD 進行 3 秒錄音測試。錄音成功後才能進入正式考試。
      </p>

      <div className="mt-6 h-4 bg-slate-200 rounded-full overflow-hidden max-w-sm mx-auto" aria-hidden>
        <div
          className={`h-full transition-all ${level > 80 ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${level}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {status === 'recording' ? (level > 80 ? 'Too Loud' : level > 5 ? 'Good' : '請對麥克風說話') : ''}
      </p>

      <div className="mt-6">
        {status !== 'success' && (
          <button className="btn-primary" onClick={startRecording} disabled={status === 'recording'}>
            {status === 'recording' ? 'Recording...' : 'RECORD'}
          </button>
        )}
      </div>

      {status === 'denied' && (
        <div className="mt-4 rounded bg-red-50 border border-red-200 p-4 text-sm text-red-700 text-left">
          <p className="font-semibold">瀏覽器已拒絕麥克風權限。</p>
          <p className="mt-1">
            請點擊網址列左側的鎖頭圖示，將「麥克風」權限設為「允許」，然後重新整理頁面再試一次。
          </p>
        </div>
      )}
      {status === 'error' && (
        <div className="mt-4 rounded bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
          錄音失敗，請確認麥克風已連接後重新測試。
        </div>
      )}
      {status === 'success' && (
        <div className="mt-6">
          <div className="rounded bg-green-50 border border-green-200 p-4 text-sm text-green-700">
            <p className="font-semibold">Success</p>
            <p className="mt-1">麥克風測試成功，你可以開始考試了。</p>
          </div>
          <button className="btn-primary mt-4" onClick={onContinue}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
