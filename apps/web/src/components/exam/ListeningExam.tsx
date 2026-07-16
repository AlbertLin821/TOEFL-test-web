import type { ExamItemDetail } from '../../lib/api';

export const LISTENING_RESPONSE_VISUAL = '/exam/listening/listen-response-speaker.png';
export const LISTENING_GROUP_VISUAL = '/exam/listening/conversation-speakers.png';

const LISTENING_TASKS = [
  {
    type: 'Listen and Choose a Response',
    description: 'Listen to a question or statement and choose the best response.',
  },
  {
    type: 'Conversations',
    description: 'Answer questions about short conversations.',
  },
  {
    type: 'Announcements and Academic Talks',
    description: 'Answer questions about announcements and academic talks.',
  },
] as const;

export function ListeningSectionIntro() {
  return (
    <div className="exam-flow-content max-w-4xl space-y-7 pt-16">
      <h1 className="exam-flow-title text-4xl">Listening Section</h1>
      <div className="max-w-4xl text-lg leading-8 text-slate-700">
        <p>
          In the Listening section, you will answer 35–45 questions to demonstrate how well you understand spoken
          English. There are three types of tasks.
        </p>
      </div>
      <table className="exam-section-task-table listening-section-table w-full max-w-2xl text-base">
        <thead>
          <tr>
            <th scope="col">Type of Task</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {LISTENING_TASKS.map((task) => (
            <tr key={task.type}>
              <td>{task.type}</td>
              <td>{task.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-lg leading-8 text-slate-700">You WILL NOT be able to return to previous questions.</p>
    </div>
  );
}

export function ListeningModuleIntro({ moduleOrder }: { moduleOrder: number }) {
  return (
    <div className="exam-flow-content space-y-6">
      <h1 className="exam-flow-title">Listening Section, Module {moduleOrder}</h1>
      <div className="max-w-4xl space-y-4 text-lg leading-8 text-slate-700">
        <p>In an actual test, the clock will show how much time you have to answer each question.</p>
        <p>
          Use <strong>Next</strong> to move to the next question. You WILL NOT be able to return to previous
          questions.
        </p>
        <p>
          First, you will listen to a sentence or question. Then read four sentences and choose the best response.
        </p>
      </div>
    </div>
  );
}

export function ListeningGroupIntro() {
  return (
    <div className="exam-flow-content space-y-6">
      <h1 className="exam-flow-title">Conversation, Announcement, and Academic Talk</h1>
      <div className="max-w-4xl space-y-4 text-lg leading-8 text-slate-700">
        <p>You will listen to each conversation, announcement, or academic talk only once.</p>
        <p>After the audio finishes, answer the questions about what you heard.</p>
        <p>The clock will show how much time you have to answer each question.</p>
      </div>
    </div>
  );
}

export function ListeningModuleEnd({ moduleOrder, nextModuleOrder }: { moduleOrder: number; nextModuleOrder: number }) {
  return (
    <div className="exam-flow-content space-y-6">
      <h1 className="exam-flow-title">End of Module {moduleOrder}</h1>
      <p className="max-w-4xl text-xl leading-9 text-slate-700">
        Select <strong>Next</strong> to begin Module {nextModuleOrder}.
      </p>
    </div>
  );
}

export function ListeningSectionEnd() {
  return (
    <div className="exam-flow-content space-y-6">
      <h1 className="exam-flow-title text-4xl">End of Listening Section</h1>
      <p className="max-w-4xl text-xl leading-9 text-slate-700">
        Thank you for completing the listening section.
      </p>
    </div>
  );
}

function ListeningVisual({ source, alt, compact = false }: { source: string; alt: string; compact?: boolean }) {
  return (
    <div className={`listening-visual ${compact ? 'listening-visual-compact' : ''}`}>
      <img src={source} alt={alt} />
    </div>
  );
}

export function ListeningAudioScene({ instructions, visualSource }: { instructions: string; visualSource: string }) {
  return (
    <div className="listening-audio-scene" aria-live="polite">
      <p className="listening-scene-title">{instructions}</p>
      <ListeningVisual source={visualSource} alt="People speaking in the listening task" />
      <p className="text-sm text-slate-500">The audio will play once. Questions appear when it finishes.</p>
    </div>
  );
}

interface ListeningQuestionProps {
  item: ExamItemDetail;
  selected?: number;
  locked: boolean;
  visualSource: string;
  onSelect: (optionIndex: number) => void;
}

export function ListeningQuestion({ item, selected, locked, visualSource, onSelect }: ListeningQuestionProps) {
  const options = (item.content.options as string[]) ?? [];
  const question = String(item.content.question_text ?? item.content.instructions ?? 'Choose the best response.');

  return (
    <div className="listening-question-layout">
      <div className="listening-question-visual-panel">
        <ListeningVisual source={visualSource} alt="Speaker for this listening task" compact />
      </div>
      <fieldset className="listening-question-options" disabled={locked} aria-describedby={locked ? 'listening-status' : undefined}>
        <legend>{question}</legend>
        <div className="space-y-3">
          {options.map((option, index) => (
            <label
              key={`${item.id}-${index}`}
              className={`listening-option ${locked ? 'listening-option-locked' : ''} ${
                selected === index ? 'listening-option-selected' : ''
              }`}
            >
              <input
                type="radio"
                name={item.id}
                checked={selected === index}
                onChange={() => onSelect(index)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {locked && (
          <p id="listening-status" className="mt-4 text-sm text-slate-500" role="status">
            The choices will be available after the audio finishes.
          </p>
        )}
      </fieldset>
    </div>
  );
}
