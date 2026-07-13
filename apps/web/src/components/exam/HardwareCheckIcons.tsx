import { Headphones, Mic, Volume2, type LucideProps } from 'lucide-react';

type IconProps = Pick<LucideProps, 'className' | 'size' | 'strokeWidth'>;

export function MicrophoneIcon({ className = 'w-24 h-24', strokeWidth = 1.5 }: IconProps) {
  return <Mic className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export function HeadphonesIcon({ className = 'w-24 h-24', strokeWidth = 1.5 }: IconProps) {
  return <Headphones className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export function SpeakerIcon({ className = 'w-24 h-24', strokeWidth = 1.5 }: IconProps) {
  return <Volume2 className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export function VolumeSmallIcon({ className = 'w-4 h-4', strokeWidth = 2 }: IconProps) {
  return <Volume2 className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
