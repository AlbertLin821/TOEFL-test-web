import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import ExamFlowShell, { type VolumeControlProps } from './ExamFlowShell';
import ExamSuccessDialog from './ExamSuccessDialog';
import MicrophoneLevelMeter from './MicrophoneLevelMeter';
import { SAMPLE_PARAGRAPH } from './MicrophoneAdjustStep';
import { useMicrophoneLevel } from '../../hooks/useMicrophoneLevel';

interface MicrophoneRecordStepProps {
  volumeControl: VolumeControlProps;
  onRecorded: () => void;
}

type RecordPhase = 'idle' | 'countdown' | 'recording';

const SUCCESS_MESSAGE = 'Your microphone volume has been successfully adjusted.';

export default function MicrophoneRecordStep({ volumeControl, onRecorded }: MicrophoneRecordStepProps) {
  const [phase, setPhase] = useState<RecordPhase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [showSuccess, setShowSuccess] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const { levelBars, micError, setMicError, startMeter, releaseStream, getStream } = useMicrophoneLevel({
    autoStart: true,
  });

  useEffect(() => () => releaseStream(), [releaseStream]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      void beginRecording();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  const beginRecording = async () => {
    if (mediaRecorder.current?.state === 'recording') return;
    setMicError('');
    const stream = getStream() ?? (await startMeter());
    if (!stream) {
      setPhase('idle');
      return;
    }

    try {
      const mr = new MediaRecorder(stream);
      mediaRecorder.current = mr;
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => {
        setPhase('idle');
        if (chunks.current.length > 0) setShowSuccess(true);
        else {
          setMicError('Recording failed. Please try again.');
        }
      };
      mr.start();
      setPhase('recording');
      setTimeout(() => {
        if (mr.state === 'recording') mr.stop();
      }, 15000);
    } catch {
      setMicError('Unable to start recording. Please try again.');
      setPhase('idle');
    }
  };

  const handleRecordClick = () => {
    if (phase !== 'idle') return;
    setCountdown(3);
    setPhase('countdown');
  };

  const isBusy = phase === 'countdown' || phase === 'recording';

  return (
    <>
      <ExamFlowShell sectionLabel="Reading" volumeControl={volumeControl} showContinue={false}>
      <div className="flex-1 bg-[#e8e8e8] min-h-[calc(100vh-88px)] flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-md border border-slate-200 w-full max-w-4xl p-8 md:p-10">
          <div className="grid md:grid-cols-[220px_1fr] gap-8 items-start">
            <div className="flex justify-center md:justify-start">
              <button
                type="button"
                disabled={isBusy}
                onClick={handleRecordClick}
                className="relative flex items-center justify-center w-44 h-44 rounded-full border-2 border-slate-300 bg-white disabled:opacity-60 hover:enabled:border-slate-400 transition-colors"
                aria-label="Record"
              >
                <span className="absolute inset-3 rounded-full border border-slate-200 pointer-events-none" />
                <span className="relative z-10 flex flex-col items-center justify-center w-32 h-32 rounded-full bg-exam-bar text-white">
                  <Mic className="w-10 h-10 mb-1" strokeWidth={1.75} aria-hidden="true" />
                  <span className="text-lg font-bold tracking-wide">RECORD</span>
                </span>
              </button>
            </div>

            <div className="space-y-5 text-slate-800">
              <p>
                Select the &apos;Record&apos; button, A timer will count down until the system is ready to record.
              </p>
              <p>
                To check your microphone level, you will record the following paragraph using your normal tone and
                volume.
              </p>
              <p className="leading-relaxed">{SAMPLE_PARAGRAPH}</p>

              {phase === 'countdown' && (
                <p className="text-exam-bar font-semibold text-lg" role="status" aria-live="polite">
                  Recording begins in {countdown}...
                </p>
              )}
              {phase === 'recording' && (
                <p className="text-exam-bar font-semibold" role="status" aria-live="polite">
                  Recording... Please read the paragraph aloud.
                </p>
              )}
              {phase === 'idle' && levelBars > 0 && (
                <p className="text-sm text-slate-500" role="status">
                  Microphone level preview — speak to check your volume before recording.
                </p>
              )}

              <MicrophoneLevelMeter filledBars={levelBars} mode="live" variant="record" />

              {micError && (
                <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded text-sm" role="alert">
                  {micError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </ExamFlowShell>

      {showSuccess && (
        <ExamSuccessDialog
          message={SUCCESS_MESSAGE}
          onContinue={() => {
            setShowSuccess(false);
            releaseStream();
            onRecorded();
          }}
        />
      )}
    </>
  );
}
