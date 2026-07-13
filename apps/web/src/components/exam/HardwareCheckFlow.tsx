import { useState } from 'react';
import { api } from '../../lib/api';
import ExamFlowShell from './ExamFlowShell';
import { HeadphonesIcon, MicrophoneIcon, SpeakerIcon } from './HardwareCheckIcons';
import MicrophoneAdjustStep from './MicrophoneAdjustStep';
import MicrophoneRecordStep from './MicrophoneRecordStep';

type Step = 'intro' | 'volume' | 'mic' | 'record';

interface HardwareCheckFlowProps {
  attemptId: string;
  attemptStatus: string;
  replayMode?: boolean;
  onComplete: () => void;
}

const SAVED_STEPS: Step[] = ['volume', 'mic', 'record'];

export default function HardwareCheckFlow({
  attemptId,
  attemptStatus,
  replayMode = false,
  onComplete,
}: HardwareCheckFlowProps) {
  const storageKey = `hw-check-step:${attemptId}`;
  const [step, setStep] = useState<Step>(() => {
    if (replayMode) return 'intro';
    const saved = sessionStorage.getItem(storageKey);
    if (saved && SAVED_STEPS.includes(saved as Step)) return saved as Step;
    return 'intro';
  });
  const [volumePanelOpen, setVolumePanelOpen] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0.7);

  const playTestTone = (level = volumeLevel) => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    gain.gain.value = level * 0.15;
    osc.start();
    setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, 800);
  };

  const handleVolumeChange = (level: number) => {
    setVolumeLevel(level);
    playTestTone(level);
  };

  const goToStep = (next: Step) => {
    setStep(next);
    if (!replayMode) sessionStorage.setItem(storageKey, next);
  };

  const finish = async () => {
    if (attemptStatus === 'hardware_check') {
      await api.hardwareCheckComplete(attemptId);
    }
    sessionStorage.removeItem(storageKey);
    onComplete();
  };

  const volumeControlProps = {
    open: volumePanelOpen,
    level: volumeLevel,
    onToggle: () => setVolumePanelOpen((v) => !v),
    onChange: handleVolumeChange,
  };

  if (step === 'intro') {
    return (
      <ExamFlowShell sectionLabel="Reading" volumeControl={volumeControlProps} onContinue={() => goToStep('volume')}>
        <div className="exam-flow-content space-y-8">
          <h1 className="exam-flow-title">Hardware Check</h1>
          <p className="text-slate-700">
            Before the test begins, we will check the microphone and headset volume.
          </p>
          <div className="flex items-center justify-center gap-16 py-8 text-exam-bar">
            <MicrophoneIcon />
            <HeadphonesIcon />
            <SpeakerIcon />
          </div>
          <p className="text-slate-700 leading-relaxed max-w-4xl">
            Please make sure your headset is on, Follow the instructions on each screen. Be sure that your microphone
            is properly positioned and adjusted to allow for the best possible recording. Speak directly into the
            microphone and in your normal speaking voice.
          </p>
        </div>
      </ExamFlowShell>
    );
  }

  if (step === 'volume') {
    return (
      <ExamFlowShell sectionLabel="Reading" volumeControl={volumeControlProps} onContinue={() => goToStep('mic')}>
        <div className="exam-flow-content space-y-8">
          <h1 className="exam-flow-title">Adjust the volume</h1>
          <div className="space-y-4 text-slate-700 leading-relaxed max-w-4xl">
            <p>
              To adjust the volume, select the <strong>Volume</strong> icon at the top of the screen. The volume
              control will appear. Move the volume indicator to the left or the right to change the volume.
            </p>
            <p>
              To close the volume control, select the <strong>Volume</strong> icon again.
            </p>
            <p>You will be able to change the volume during the test if you need to.</p>
          </div>
          <div className="flex items-center gap-6 pt-4 text-exam-bar">
            <SpeakerIcon className="w-28 h-28 shrink-0" strokeWidth={1.25} />
            <p className="text-slate-700 text-lg">You now have the option to adjust the volume.</p>
          </div>
        </div>
      </ExamFlowShell>
    );
  }

  if (step === 'mic') {
    return <MicrophoneAdjustStep volumeControl={volumeControlProps} onContinue={() => goToStep('record')} />;
  }

  if (step === 'record') {
    return (
      <MicrophoneRecordStep volumeControl={volumeControlProps} onRecorded={() => void finish()} />
    );
  }

  return null;
}
