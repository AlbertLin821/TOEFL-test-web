import { Mic } from 'lucide-react';
import type { ExamItemDetail } from '../../lib/api';
import {
  extractListenRepeatScenario,
  formatSpeakingResponseTime,
  parseWeatherHighlightCell,
} from '../../lib/speaking-visuals';
import SpeakingInterviewerPortrait from './SpeakingInterviewerPortrait';
import SpeakingWeatherGrid from './SpeakingWeatherGrid';

interface SpeakingQuestionPanelProps {
  item: ExamItemDetail;
  moduleDescription?: string;
  speakingPhase: 'idle' | 'playing' | 'recording' | 'uploading';
  responseSeconds: number;
  responseRemaining: number;
  onStopSpeaking: () => void;
}

export default function SpeakingQuestionPanel({
  item,
  moduleDescription,
  speakingPhase,
  responseSeconds,
  responseRemaining,
  onStopSpeaking,
}: SpeakingQuestionPanelProps) {
  const questionNumber = Number(item.content.question_number ?? item.order_no);
  const isListenRepeat = item.item_type === 'speaking_listen_repeat';
  const isInterview = item.item_type === 'speaking_interview';
  const visualType = String(item.content.visual_type ?? '');
  const highlightCell = parseWeatherHighlightCell(item.content.highlight_cell);
  const showWeatherVisual = isListenRepeat && visualType === 'weather_report';
  const scenarioText = extractListenRepeatScenario(moduleDescription);
  const showResponseTimer = speakingPhase === 'recording' || speakingPhase === 'playing';
  const listenRepeatInstruction =
    showWeatherVisual && questionNumber <= 2 && scenarioText
      ? scenarioText
      : 'Listen and repeat only once';

  return (
    <div className="speaking-question-content">
      {isListenRepeat ? (
        <p className="speaking-question-instructions">{listenRepeatInstruction}</p>
      ) : (
        <p className="speaking-question-instructions">{item.item_type === 'speaking_interview' ? 'Take an Interview' : 'Speaking'}</p>
      )}

      {showWeatherVisual && (
        <SpeakingWeatherGrid highlightCell={highlightCell} grayscale={!highlightCell} />
      )}

      {isInterview && <SpeakingInterviewerPortrait />}

      {(showWeatherVisual || isInterview) && showResponseTimer && (
        <div className="speaking-response-time">
          <div className="speaking-response-time-header">RESPONSE TIME</div>
          <div className="speaking-response-time-body">
            <Mic className="w-5 h-5 text-slate-700" aria-hidden="true" />
            <span className="font-mono tabular-nums">
              {formatSpeakingResponseTime(
                speakingPhase === 'recording' ? responseRemaining : responseSeconds,
              )}
            </span>
          </div>
        </div>
      )}

      {isInterview && speakingPhase === 'playing' && (
        <p className="speaking-status-body text-center" role="status">
          Playing question audio... Recording will begin when the audio ends.
        </p>
      )}

      {isInterview && speakingPhase === 'recording' && (
        <div className="text-center">
          <button type="button" className="exam-reading-next-btn mt-2" onClick={onStopSpeaking}>
            Stop Speaking
          </button>
        </div>
      )}

      {isInterview && speakingPhase === 'uploading' && (
        <p className="speaking-status-body text-center" role="status">
          Uploading response...
        </p>
      )}

      {isInterview && speakingPhase === 'idle' && (
        <p className="speaking-status-body text-center" role="status">
          Response saved. Select Next to continue.
        </p>
      )}

      {!showWeatherVisual && !isInterview && (
        <div className="speaking-status-panel" role="status">
          {speakingPhase === 'playing' && (
            <>
              <p className="speaking-status-title">Playing question audio...</p>
              <p className="speaking-status-body">Recording will begin when the audio ends.</p>
            </>
          )}
          {speakingPhase === 'recording' && (
            <>
              <p className="speaking-status-title speaking-status-recording">Recording</p>
              <p className="speaking-status-body">
                You have up to {responseSeconds} seconds to respond.
              </p>
              <button type="button" className="exam-reading-next-btn mt-6" onClick={onStopSpeaking}>
                Stop Speaking
              </button>
            </>
          )}
          {speakingPhase === 'uploading' && (
            <>
              <p className="speaking-status-title">Uploading response...</p>
              <p className="speaking-status-body">Please wait while your answer is saved.</p>
            </>
          )}
          {speakingPhase === 'idle' && (
            <>
              <p className="speaking-status-title">Response saved</p>
              <p className="speaking-status-body">Select Next to continue.</p>
            </>
          )}
        </div>
      )}

      {showWeatherVisual && speakingPhase === 'uploading' && (
        <p className="speaking-status-body text-center" role="status">
          Uploading response...
        </p>
      )}

      {showWeatherVisual && speakingPhase === 'idle' && (
        <p className="speaking-status-body text-center" role="status">
          Response saved. Select Next to continue.
        </p>
      )}

      {showWeatherVisual && speakingPhase === 'recording' && (
        <div className="text-center">
          <button type="button" className="exam-reading-next-btn mt-2" onClick={onStopSpeaking}>
            Stop Speaking
          </button>
        </div>
      )}
    </div>
  );
}
