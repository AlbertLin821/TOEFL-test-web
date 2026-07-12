import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

type Step = 'intro' | 'volume' | 'mic' | 'success';

export default function HardwareCheckPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('intro');
  const [micError, setMicError] = useState('');
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const playTestTone = () => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    gain.gain.value = 0.1;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 800);
  };

  const startMicTest = async () => {
    setMicError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorder.current = mr;
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunks.current.length > 0) setStep('success');
        else setMicError('錄音失敗，請再試一次。');
      };
      mr.start();
      setRecording(true);
      setTimeout(() => {
        if (mr.state === 'recording') mr.stop();
        setRecording(false);
      }, 3000);
    } catch {
      setMicError('無法存取麥克風。請在瀏覽器設定中允許麥克風權限，然後重新整理頁面。');
    }
  };

  const finish = async () => {
    if (!attemptId) return;
    await api.hardwareCheckComplete(attemptId);
    navigate(`/exam/${attemptId}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="exam-topbar">
        <button type="button" className="exam-btn font-semibold" onClick={() => navigate('/student/exams')}>
          EXIT
        </button>
        <span>Hardware Check</span>
        <span />
      </header>
      <main className="max-w-2xl mx-auto p-8 space-y-6">
        {step === 'intro' && (
          <>
            <h1 className="text-2xl font-semibold">Hardware Check</h1>
            <p>開始正式考試前，請先確認耳機音量與麥克風錄音功能正常。</p>
            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
              <li>請使用耳機</li>
              <li>Speaking 部分需要麥克風錄音</li>
              <li>請在安靜環境進行測試</li>
            </ul>
            <button type="button" className="exam-btn-primary" onClick={() => setStep('volume')}>
              Continue
            </button>
          </>
        )}
        {step === 'volume' && (
          <>
            <h2 className="text-xl font-semibold">Adjust Volume</h2>
            <p>點選下方按鈕播放測試音，確認音量適中。</p>
            <button type="button" className="exam-btn-primary" onClick={playTestTone}>
              Play test sound
            </button>
            <button type="button" className="exam-btn-primary ml-2" onClick={() => setStep('mic')}>
              Continue to microphone test
            </button>
          </>
        )}
        {step === 'mic' && (
          <>
            <h2 className="text-xl font-semibold">Adjusting the Microphone</h2>
            <p>按 RECORD 錄製 3 秒測試音。成功後會顯示 Success 視窗。</p>
            {micError && (
              <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded text-sm" role="alert">
                {micError}
              </div>
            )}
            <button
              type="button"
              className="exam-btn-primary"
              disabled={recording}
              onClick={startMicTest}
            >
              {recording ? 'Recording...' : 'RECORD'}
            </button>
          </>
        )}
        {step === 'success' && (
          <div className="border border-green-300 bg-green-50 rounded p-6 text-center space-y-4">
            <p className="text-green-800 font-semibold text-lg">Success</p>
            <p className="text-sm text-green-700">麥克風測試成功。你可以進入正式考試。</p>
            <button type="button" className="exam-btn-primary" onClick={finish}>
              Continue
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
