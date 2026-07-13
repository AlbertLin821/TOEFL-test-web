import ExamFlowShell, { type VolumeControlProps } from './ExamFlowShell';
import { MicrophoneMeterExamples } from './MicrophoneLevelMeter';

const SAMPLE_PARAGRAPH =
  'There are several reasons why I would prefer to live in a large city. Some of the greatest advantages would include the number of job opportunities and career options, public transportation, greater diversity, and a wealth of entertainment. Also, large cities typically have a great deal to offer in terms of history, art and culture.';

interface MicrophoneAdjustStepProps {
  volumeControl: VolumeControlProps;
  onContinue: () => void;
}

export default function MicrophoneAdjustStep({ volumeControl, onContinue }: MicrophoneAdjustStepProps) {
  return (
    <ExamFlowShell sectionLabel="Reading" volumeControl={volumeControl} onContinue={onContinue}>
      <div className="exam-flow-content space-y-8">
        <h1 className="exam-flow-title">Adjusting the Microphone</h1>
        <p className="text-slate-700 leading-relaxed max-w-4xl">
          In order to check your <strong>microphone volume</strong>, you will speak into the microphone using your
          normal tone and volume. For best recording results, your voice level should remain generally within the Good
          Range. While you speak the microphone will adjust automatically.
        </p>
        <p className="text-slate-700 font-medium">Example:</p>
        <MicrophoneMeterExamples />
      </div>
    </ExamFlowShell>
  );
}

export { SAMPLE_PARAGRAPH };
