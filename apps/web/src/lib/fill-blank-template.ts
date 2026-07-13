export type FillBlankPart =
  | { type: 'text'; value: string }
  | { type: 'blank'; blankIndex: number; prefix: string; length: number };

export function parseFillBlankTemplate(template: string, missingLengths: number[]): FillBlankPart[] {
  const parts: FillBlankPart[] = [];
  const re = /([A-Za-z]*)\{\{(\d+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(template)) !== null) {
    const textBefore = template.slice(lastIndex, match.index);
    if (textBefore) parts.push({ type: 'text', value: textBefore });

    const blankIndex = Number(match[2]) - 1;
    parts.push({
      type: 'blank',
      blankIndex,
      prefix: match[1],
      length: missingLengths[blankIndex] ?? 3,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < template.length) {
    parts.push({ type: 'text', value: template.slice(lastIndex) });
  }

  return parts;
}

export function splitFillBlankInstructions(instructions: string): { title: string; subtitle: string } {
  const match = instructions.match(/^(.+?)\s*(\([^)]+\))\s*$/);
  if (match) {
    return { title: match[1].trim(), subtitle: match[2].trim() };
  }
  return { title: instructions, subtitle: '' };
}

export function resolveMissingLengths(
  content: Record<string, unknown>,
  blankCount: number,
): number[] {
  const fromContent = content.missing_lengths;
  if (Array.isArray(fromContent) && fromContent.length === blankCount) {
    return fromContent.map((n) => Number(n));
  }

  const template = String(content.template ?? '');
  if (template.includes('Mesopotamia')) {
    return [2, 7, 5, 5, 4, 3, 2, 3, 5, 3];
  }
  if (template.includes('Consciousness')) {
    return [2, 2, 3, 4, 3, 3, 2, 1, 2, 2];
  }

  return Array.from({ length: blankCount }, () => 3);
}
