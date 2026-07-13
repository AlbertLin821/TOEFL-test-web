import { useRef } from 'react';
import {
  parseFillBlankTemplate,
  resolveMissingLengths,
  splitFillBlankInstructions,
} from '../../lib/fill-blank-template';

interface ReadingFillBlankQuestionProps {
  instructions: string;
  template: string;
  content: Record<string, unknown>;
  blanks: string[];
  onChange: (blanks: string[]) => void;
}

function BlankInput({
  blankIndex,
  length,
  value,
  onChange,
}: {
  blankIndex: number;
  length: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const slots = Array.from({ length }, (_, i) => value[i] ?? '_');

  return (
    <span className="reading-blank-box" onClick={() => inputRef.current?.focus()}>
      <span className="reading-blank-slots" aria-hidden="true">
        {slots.map((char, i) => (
          <span
            key={i}
            className={value[i] ? 'reading-blank-letter' : 'reading-blank-underscore'}
          >
            {char}
          </span>
        ))}
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={length}
        value={value}
        className="reading-blank-input-overlay"
        aria-label={`Question ${blankIndex + 1}`}
        onChange={(e) => {
          const letters = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, length);
          onChange(letters);
        }}
      />
    </span>
  );
}

export default function ReadingFillBlankQuestion({
  instructions,
  template,
  content,
  blanks,
  onChange,
}: ReadingFillBlankQuestionProps) {
  const blankCount = Number(content.blank_count ?? 10);
  const missingLengths = resolveMissingLengths(content, blankCount);
  const parts = parseFillBlankTemplate(template, missingLengths);
  const { title, subtitle } = splitFillBlankInstructions(instructions);

  const setBlank = (index: number, value: string) => {
    const next = [...blanks];
    while (next.length < blankCount) next.push('');
    next[index] = value;
    onChange(next);
  };

  return (
    <div className="reading-fill-content">
      <div className="reading-fill-heading">
        <p className="reading-fill-title">{title}</p>
        {subtitle && <p className="reading-fill-subtitle">{subtitle}</p>}
      </div>
      <p className="reading-fill-paragraph">
        {parts.map((part, i) => {
          if (part.type === 'text') {
            return <span key={i}>{part.value}</span>;
          }

          return (
            <span key={i} className="reading-blank-group">
              <span className="reading-blank-prefix">{part.prefix}</span>
              <BlankInput
                blankIndex={part.blankIndex}
                length={part.length}
                value={blanks[part.blankIndex] ?? ''}
                onChange={(value) => setBlank(part.blankIndex, value)}
              />
            </span>
          );
        })}
      </p>
    </div>
  );
}
