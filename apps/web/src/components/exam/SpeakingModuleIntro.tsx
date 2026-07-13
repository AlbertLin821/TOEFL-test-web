import { extractListenRepeatDirections, extractListenRepeatScenario } from '../../lib/speaking-visuals';
import SpeakingWeatherGrid from './SpeakingWeatherGrid';

interface SpeakingModuleIntroProps {
  title: string;
  description?: string;
  moduleType?: string;
  step?: 'directions' | 'scenario' | 'default';
}

export default function SpeakingModuleIntro({
  title,
  description,
  moduleType,
  step = 'default',
}: SpeakingModuleIntroProps) {
  const paragraphs = String(description ?? '')
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const isListenRepeat = moduleType === 'speaking_listen_repeat';
  const scenarioText = extractListenRepeatScenario(description);
  const directionParagraphs = extractListenRepeatDirections(description);

  if (isListenRepeat && step === 'directions') {
    return (
      <div className="exam-flow-content speaking-module-intro space-y-8">
        <h1 className="exam-flow-title speaking-section-intro-title">{title}</h1>
        <div className="space-y-4 text-xl leading-9 text-slate-700 max-w-4xl">
          {directionParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    );
  }

  if (isListenRepeat && step === 'scenario') {
    return (
      <div className="exam-flow-content speaking-module-intro speaking-module-intro-visual">
        <p className="speaking-module-scenario">{scenarioText}</p>
        <SpeakingWeatherGrid grayscale />
      </div>
    );
  }

  return (
    <div className="exam-flow-content speaking-module-intro space-y-8">
      <h1 className="exam-flow-title speaking-section-intro-title">{title}</h1>
      <div className="space-y-4 text-xl leading-9 text-slate-700 max-w-4xl">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
