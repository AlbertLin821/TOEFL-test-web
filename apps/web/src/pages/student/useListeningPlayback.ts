import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExamItemDetail } from '../../lib/api';

interface PlayListeningOptions {
  audioScene: boolean;
  onAudioSceneEnd?: () => void;
}

export function useListeningPlayback(volume: number) {
  const [listeningLocked, setListeningLocked] = useState(true);
  const [listeningGroupIntroSeen, setListeningGroupIntroSeen] = useState<Record<string, boolean>>({});
  const [listeningAudioError, setListeningAudioError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const playListeningItem = useCallback((targetItem: ExamItemDetail, options: PlayListeningOptions) => {
    const audioAsset = targetItem.assets.find((asset) => asset.asset_type === 'audio');
    if (!audioAsset) {
      setListeningLocked(true);
      setListeningAudioError('The listening audio is unavailable. Select Retry after checking the connection.');
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(audioAsset.url);
    audio.volume = volumeRef.current;
    audioRef.current = audio;
    setListeningLocked(true);
    setListeningAudioError('');

    const fail = (reason?: unknown) => {
      if (audioRef.current !== audio) return;
      console.error('Listening audio playback failed.', reason, audio.error);
      setListeningLocked(true);
      setListeningAudioError('The listening audio could not be played. Select Retry to try again.');
    };

    audio.onended = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      setListeningLocked(false);
      if (options.audioScene) options.onAudioSceneEnd?.();
    };
    audio.onerror = () => fail(audio.error);
    void audio.play().catch(fail);
  }, []);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  return {
    listeningAudioError,
    listeningGroupIntroSeen,
    listeningLocked,
    playListeningItem,
    setListeningAudioError,
    setListeningGroupIntroSeen,
    setListeningLocked,
  };
}
