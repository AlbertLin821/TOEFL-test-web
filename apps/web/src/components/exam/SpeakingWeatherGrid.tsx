import type { WeatherGridCell } from '../../lib/speaking-visuals';

interface SpeakingWeatherGridProps {
  highlightCell?: WeatherGridCell | null;
  grayscale?: boolean;
}

function SunIcon({ muted }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={`speaking-weather-icon ${muted ? 'speaking-weather-icon-muted' : ''}`} aria-hidden="true">
      <circle cx="24" cy="24" r="10" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <rect
          key={angle}
          x="22"
          y="4"
          width="4"
          height="8"
          rx="2"
          fill="currentColor"
          transform={`rotate(${angle} 24 24)`}
        />
      ))}
    </svg>
  );
}

function SunCloudIcon({ muted }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 64 48" className={`speaking-weather-icon ${muted ? 'speaking-weather-icon-muted' : ''}`} aria-hidden="true">
      <circle cx="22" cy="18" r="9" fill="currentColor" />
      <ellipse cx="38" cy="28" rx="18" ry="12" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

function RainCloudIcon({ accent }: { accent?: boolean }) {
  return (
    <svg viewBox="0 0 64 48" className={`speaking-weather-icon ${accent ? 'speaking-weather-icon-accent' : 'speaking-weather-icon-muted'}`} aria-hidden="true">
      <ellipse cx="34" cy="20" rx="18" ry="12" fill="currentColor" />
      <line x1="26" y1="34" x2="24" y2="42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="36" y1="34" x2="34" y2="42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="46" y1="34" x2="44" y2="42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ThermometerIcon({ muted }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 32 48" className={`speaking-weather-icon ${muted ? 'speaking-weather-icon-muted' : ''}`} aria-hidden="true">
      <rect x="11" y="6" width="10" height="28" rx="5" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="16" cy="38" r="8" fill="currentColor" />
      <rect x="14" y="12" width="4" height="18" rx="2" fill="currentColor" />
    </svg>
  );
}

function WindIcon({ muted }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 64 32" className={`speaking-weather-icon ${muted ? 'speaking-weather-icon-muted' : ''}`} aria-hidden="true">
      <path d="M6 8 H42 C48 8 48 2 42 2 H34" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M6 18 H52 C58 18 58 12 52 12 H44" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M6 28 H36 C42 28 42 22 36 22 H28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function OutlookIcon({ muted }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={`speaking-weather-icon ${muted ? 'speaking-weather-icon-muted' : ''}`} aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="18" r="7" fill="currentColor" />
      <ellipse cx="30" cy="28" rx="12" ry="8" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

function WeatherCell({
  cell,
  highlightCell,
  grayscale,
  label,
  detail,
}: {
  cell: WeatherGridCell;
  highlightCell?: WeatherGridCell | null;
  grayscale?: boolean;
  label?: string;
  detail?: string;
}) {
  const highlighted = !grayscale && highlightCell === cell;
  const muted = grayscale || (!highlighted && !!highlightCell);

  return (
    <div className={`speaking-weather-cell ${highlighted ? 'speaking-weather-cell-highlighted' : ''}`}>
      {cell === 'morning' && <SunIcon muted={muted} />}
      {cell === 'afternoon' && <SunCloudIcon muted={muted} />}
      {cell === 'evening' && <RainCloudIcon accent={highlighted} />}
      {cell === 'temperature' && (
        <div className="speaking-weather-temperature">
          <ThermometerIcon muted={muted} />
          <span>15-20 °C</span>
        </div>
      )}
      {cell === 'wind' && (
        <div className="speaking-weather-wind">
          <WindIcon muted={muted} />
          <span>10 KM</span>
        </div>
      )}
      {cell === 'outlook' && <OutlookIcon muted={muted} />}
      {label && (
        <div className={`speaking-weather-label ${highlighted ? 'speaking-weather-label-highlighted' : ''}`}>
          {label}
        </div>
      )}
      {detail && <div className="speaking-weather-detail">{detail}</div>}
    </div>
  );
}

export default function SpeakingWeatherGrid({ highlightCell = null, grayscale = false }: SpeakingWeatherGridProps) {
  return (
    <div className={`speaking-weather-grid ${grayscale ? 'speaking-weather-grid-grayscale' : ''}`}>
      <WeatherCell cell="morning" highlightCell={highlightCell} grayscale={grayscale} label="Morning" detail="84%" />
      <WeatherCell cell="afternoon" highlightCell={highlightCell} grayscale={grayscale} label="Afternoon" detail="90%" />
      <WeatherCell cell="evening" highlightCell={highlightCell} grayscale={grayscale} label="Evening" detail="93%" />
      <WeatherCell cell="temperature" highlightCell={highlightCell} grayscale={grayscale} />
      <WeatherCell cell="wind" highlightCell={highlightCell} grayscale={grayscale} />
      <WeatherCell cell="outlook" highlightCell={highlightCell} grayscale={grayscale} />
    </div>
  );
}
