import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { api, type ExamItemDetail } from '../../lib/api';
import { getSpeakingResponseSeconds, waitForSpeakingStopDialogMinimum } from '../../lib/speaking-exam-utils';

export type SpeakingPhase = 'idle' | 'playing' | 'recording' | 'uploading';

interface UseSpeakingRecorderOptions {
  attemptId: string | undefined;
  volumeRef: MutableRefObject<number>;
  item: ExamItemDetail | undefined;
  active: boolean;
  alreadyUploaded: boolean;
}

export function useSpeakingRecorder({
  attemptId,
  volumeRef,
  item,
  active,
  alreadyUploaded,
}: UseSpeakingRecorderOptions) {
  const speakingPromptAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const activeSpeakItemIdRef = useRef<string | null>(null);
  const speakingTimedOutRef = useRef(false);
  const speakingStopDialogShownAtRef = useRef(0);
  const stopSpeakingRef = useRef<(timedOut?: boolean) => void>(() => {});
  const [speakingPhase, setSpeakingPhase] = useState<SpeakingPhase>('idle');
  const [speakingResponseLimit, setSpeakingResponseLimit] = useState(0);
  const [speakingResponseRemaining, setSpeakingResponseRemaining] = useState(0);
  const [showSpeakingStopDialog, setShowSpeakingStopDialog] = useState(false);

  const stopSpeaking = useCallback((timedOut = false) => {
    speakingTimedOutRef.current = timedOut;
    if (timedOut) {
      speakingStopDialogShownAtRef.current = Date.now();
      setShowSpeakingStopDialog(true);
    }

    const recorder = mediaRecorder.current;
    if (!recorder || recorder.state !== 'recording') {
      if (timedOut) {
        setSpeakingResponseLimit(0);
        setSpeakingPhase('uploading');
      }
      return;
    }

    setSpeakingResponseLimit(0);
    setSpeakingPhase('uploading');
    recorder.stop();
  }, []);

  stopSpeakingRef.current = stopSpeaking;

  useEffect(() => {
    if (speakingPhase !== 'recording' || speakingResponseLimit <= 0) {
      setSpeakingResponseRemaining(0);
      return;
    }

    setSpeakingResponseRemaining(speakingResponseLimit);
    const timer = window.setInterval(() => {
      setSpeakingResponseRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          stopSpeakingRef.current(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [speakingPhase, speakingResponseLimit]);

  const runSpeakingItem = useCallback(
    async (speakItem: ExamItemDetail) => {
      speakingTimedOutRef.current = false;
      speakingStopDialogShownAtRef.current = 0;
      setShowSpeakingStopDialog(false);
      setSpeakingPhase('playing');
      setSpeakingResponseLimit(0);
      const promptUrl = speakItem.assets[0]?.url;
      const responseSeconds = getSpeakingResponseSeconds(speakItem);

      const startRecording = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          mediaRecorder.current = recorder;
          activeSpeakItemIdRef.current = speakItem.id;
          const chunks: Blob[] = [];
          recorder.ondataavailable = (event) => chunks.push(event.data);
          recorder.onstop = async () => {
            if (activeSpeakItemIdRef.current !== speakItem.id) {
              stream.getTracks().forEach((track) => track.stop());
              return;
            }
            stream.getTracks().forEach((track) => track.stop());
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const timedOut = speakingTimedOutRef.current;
            if (timedOut) {
              if (speakingStopDialogShownAtRef.current === 0) {
                speakingStopDialogShownAtRef.current = Date.now();
              }
              setShowSpeakingStopDialog(true);
            }
            setSpeakingPhase('uploading');
            try {
              if (attemptId) {
                await api.uploadAudio(attemptId, speakItem.id, blob, responseSeconds * 1000);
              }
            } finally {
              if (timedOut) {
                await waitForSpeakingStopDialogMinimum(speakingStopDialogShownAtRef.current);
              }
              speakingTimedOutRef.current = false;
              speakingStopDialogShownAtRef.current = 0;
              setShowSpeakingStopDialog(false);
              setSpeakingResponseLimit(0);
              setSpeakingPhase('idle');
            }
          };
          recorder.start();
          setSpeakingResponseLimit(responseSeconds);
          setSpeakingPhase('recording');
        } catch {
          setSpeakingResponseLimit(0);
          setSpeakingPhase('idle');
          alert('The microphone is unavailable. Please return to Hardware Check and try again.');
        }
      };

      if (promptUrl) {
        speakingPromptAudioRef.current?.pause();
        const audio = new Audio(promptUrl);
        speakingPromptAudioRef.current = audio;
        audio.volume = volumeRef.current;
        audio.onended = () => void startRecording();
        audio.onerror = () => {
          setSpeakingPhase('idle');
        };
        try {
          await audio.play();
        } catch {
          setSpeakingPhase('idle');
        }
      } else {
        await startRecording();
      }
    },
    [attemptId, volumeRef],
  );

  useEffect(() => {
    if (!active || !item || alreadyUploaded) return;

    void runSpeakingItem(item);

    return () => {
      activeSpeakItemIdRef.current = null;
      speakingTimedOutRef.current = false;
      speakingStopDialogShownAtRef.current = 0;
      setShowSpeakingStopDialog(false);
      speakingPromptAudioRef.current?.pause();
      speakingPromptAudioRef.current = null;
      setSpeakingResponseLimit(0);
      setSpeakingResponseRemaining(0);
      const recorder = mediaRecorder.current;
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
      }
      mediaRecorder.current = null;
    };
  }, [active, alreadyUploaded, item, runSpeakingItem]);

  return {
    showSpeakingStopDialog,
    speakingPhase,
    speakingResponseRemaining,
    stopSpeaking,
  };
}
