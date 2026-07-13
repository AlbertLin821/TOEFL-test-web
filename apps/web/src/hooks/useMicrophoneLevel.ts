import { useCallback, useEffect, useRef, useState } from 'react';
import { RECORD_BAR_COUNT } from '../components/exam/MicrophoneLevelMeter';

/** Map RMS (0–1) to meter bars with log-like scaling tuned for speech. */
export function rmsToMeterBars(rms: number): number {
  const floor = 0.004;
  const boosted = Math.max(rms - floor, 0) / (0.22 - floor);
  const curved = Math.pow(Math.min(1, boosted), 0.55);
  return Math.min(RECORD_BAR_COUNT, Math.max(0, Math.round(curved * RECORD_BAR_COUNT)));
}

export function computeMicRms(analyser: AnalyserNode): number {
  const buffer = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const sample = (buffer[i] - 128) / 128;
    sum += sample * sample;
  }
  return Math.sqrt(sum / buffer.length);
}

interface UseMicrophoneLevelOptions {
  /** Start listening as soon as the hook mounts (Record page preview). */
  autoStart?: boolean;
  smoothing?: number;
}

export function useMicrophoneLevel(options: UseMicrophoneLevelOptions = {}) {
  const { autoStart = false, smoothing = 0.35 } = options;
  const [levelBars, setLevelBars] = useState(0);
  const [micReady, setMicReady] = useState(false);
  const [micError, setMicError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothedRef = useRef(0);

  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    stopMeter();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    smoothedRef.current = 0;
    setLevelBars(0);
    setMicReady(false);
  }, [stopMeter]);

  const startMeter = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current;
    setMicError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      await ctx.resume();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const tick = () => {
        if (!analyserRef.current) return;
        const rms = computeMicRms(analyserRef.current);
        smoothedRef.current = smoothedRef.current * (1 - smoothing) + rms * smoothing;
        setLevelBars(rmsToMeterBars(smoothedRef.current));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      setMicReady(true);
      return stream;
    } catch {
      setMicError(
        'Unable to access the microphone. Please allow microphone access in your browser settings and refresh the page.',
      );
      releaseStream();
      return null;
    }
  }, [releaseStream, smoothing]);

  useEffect(() => {
    if (autoStart) void startMeter();
    return () => releaseStream();
  }, [autoStart, releaseStream, startMeter]);

  return {
    levelBars,
    micReady,
    micError,
    setMicError,
    startMeter,
    releaseStream,
    getStream: () => streamRef.current,
    getAudioContext: () => audioCtxRef.current,
  };
}
