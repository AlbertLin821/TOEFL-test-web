import {
  isAcademicPassageStimulus,
  isEmailStimulus,
  isNoticeStimulus,
  parseEmailStimulus,
  splitPassageInsertionMarkers,
} from '../../lib/reading-stimulus';

interface ReadingStimulusPanelProps {
  instructions?: string;
  stimulusTitle?: string;
  stimulusText?: string;
}

export default function ReadingStimulusPanel({
  instructions,
  stimulusTitle,
  stimulusText,
}: ReadingStimulusPanelProps) {
  if (!stimulusText) return null;

  if (isEmailStimulus(instructions, stimulusTitle, stimulusText)) {
    const { subject, body } = parseEmailStimulus(stimulusText);
    return (
      <div className="reading-email-panel">
        {subject && (
          <div className="reading-email-subject-row">
            <span className="reading-email-subject-label">Subject:</span>
            <span className="reading-email-subject-value">{subject}</span>
          </div>
        )}
        <div className="reading-email-body">{subject ? body : stimulusText}</div>
      </div>
    );
  }

  const isNotice = isNoticeStimulus(instructions, stimulusTitle);
  const isAcademic = isAcademicPassageStimulus(instructions);

  return (
    <div className="reading-choice-passage-inner">
      {stimulusTitle && (
        <h2
          className={
            isAcademic ? 'reading-choice-passage-heading' : 'reading-choice-passage-title'
          }
        >
          {isNotice ? stimulusTitle.toUpperCase() : stimulusTitle}
        </h2>
      )}
      <div className="reading-choice-passage-body">
        {splitPassageInsertionMarkers(stimulusText).map((segment, i) =>
          segment.type === 'marker' ? (
            <span key={i} className="font-bold">
              {segment.value}
            </span>
          ) : (
            <span key={i}>{segment.value}</span>
          ),
        )}
      </div>
    </div>
  );
}
