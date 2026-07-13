export type WeatherGridCell =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'temperature'
  | 'wind'
  | 'outlook';

export const WEATHER_GRID_CELLS: WeatherGridCell[] = [
  'morning',
  'afternoon',
  'evening',
  'temperature',
  'wind',
  'outlook',
];

export function parseWeatherHighlightCell(value: unknown): WeatherGridCell | null {
  if (typeof value !== 'string') return null;
  return WEATHER_GRID_CELLS.includes(value as WeatherGridCell) ? (value as WeatherGridCell) : null;
}

export function formatSpeakingResponseTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `00:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function extractListenRepeatScenario(description?: string): string {
  if (!description) return '';
  const parts = description.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? '';
}

export function extractListenRepeatDirections(description?: string): string[] {
  if (!description) return [];
  const parts = description.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  const instructions = parts[0] ?? '';
  if (!instructions) return [];

  const noPrep = 'No time for preparation will be provided.';
  if (!instructions.includes(noPrep)) {
    return [instructions];
  }

  const beforeNoPrep = instructions.replace(noPrep, '').trim();
  const withActualTestWording = beforeNoPrep.replace(
    'The clock will indicate how much time you have to speak.',
    'In an actual test, the clock will indicate how much time you have to speak.',
  );

  return [withActualTestWording, noPrep];
}
