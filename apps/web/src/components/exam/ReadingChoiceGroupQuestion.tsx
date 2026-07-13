import type { ExamItemDetail } from '../../lib/api';
import ReadingStimulusPanel from './ReadingStimulusPanel';

interface ReadingChoiceGroupQuestionProps {
  groupItems: ExamItemDetail[];
  answers: Record<string, unknown>;
  onSelect: (itemId: string, optionIndex: number) => void;
}

function ReadingChoiceOption({
  name,
  optionText,
  selected,
  onSelect,
}: {
  name: string;
  optionText: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="reading-choice-option">
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span className={`reading-choice-radio ${selected ? 'reading-choice-radio-selected' : ''}`} aria-hidden="true">
        {selected && <span className="reading-choice-radio-dot" />}
      </span>
      <span className="reading-choice-option-text">{optionText}</span>
    </label>
  );
}

function renderQuestionText(questionNumber: number | string, questionText: string) {
  const quotedMatch = questionText.match(/\n\n"([^"]*)"\n\n/);

  if (!quotedMatch || quotedMatch.index === undefined) {
    return (
      <span className="font-bold">
        {questionNumber}. {questionText}
      </span>
    );
  }

  const before = questionText.slice(0, quotedMatch.index);
  const quoted = `"${quotedMatch[1]}"`;
  const after = questionText.slice(quotedMatch.index + quotedMatch[0].length);

  return (
    <>
      <span className="font-bold">
        {questionNumber}. {before}
      </span>
      {'\n\n'}
      <span className="font-normal">{quoted}</span>
      {'\n\n'}
      <span className="font-bold">{after}</span>
    </>
  );
}

function ReadingQuestionBlock({
  groupItem,
  answers,
  onSelect,
}: {
  groupItem: ExamItemDetail;
  answers: Record<string, unknown>;
  onSelect: (itemId: string, optionIndex: number) => void;
}) {
  const questionNumber = groupItem.content.question_number ?? groupItem.order_no;
  const questionText = String(groupItem.content.question_text ?? '');
  const options = (groupItem.content.options as string[]) ?? [];
  const ans = answers[groupItem.id] as Record<string, unknown> | undefined;
  const selected = ans?.selected_option_index as number | undefined;

  return (
    <div className="reading-group-question-block">
      <p className="reading-group-question-text">
        {renderQuestionText(questionNumber, questionText)}
      </p>
      <ul className="reading-choice-options">
        {options.map((opt, i) => (
          <li key={i}>
            <ReadingChoiceOption
              name={groupItem.id}
              optionText={opt}
              selected={selected === i}
              onSelect={() => onSelect(groupItem.id, i)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ReadingChoiceGroupQuestion({
  groupItems,
  answers,
  onSelect,
}: ReadingChoiceGroupQuestionProps) {
  const first = groupItems[0];
  const instructions = groupItems.find((it) => it.content.instructions)?.content.instructions;
  const stimulusTitle = first.content.stimulus_title as string | undefined;
  const stimulusText = first.content.stimulus_text as string | undefined;
  const instructionText = instructions ? String(instructions) : undefined;

  return (
    <div className="reading-choice-content">
      {instructionText && <p className="reading-choice-instructions">{instructionText}</p>}

      <div className="reading-choice-split">
        <div className="reading-choice-passage-panel">
          <ReadingStimulusPanel
            instructions={instructionText}
            stimulusTitle={stimulusTitle}
            stimulusText={stimulusText}
          />
        </div>

        <div className="reading-choice-answer-panel">
          <div className="reading-split-questions">
            {groupItems.map((groupItem) => (
              <ReadingQuestionBlock
                key={groupItem.id}
                groupItem={groupItem}
                answers={answers}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
