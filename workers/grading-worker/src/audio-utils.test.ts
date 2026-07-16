import { describe, expect, it } from 'vitest';
import { analyzeWavQuality, formatTranscriptForDisplay } from './audio-utils.js';

function pcm16Wav(samples: number[], sampleRate = 16000): Buffer {
  const dataLength = samples.length * 2;
  const wav = Buffer.alloc(44 + dataLength);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataLength, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataLength, 40);
  samples.forEach((sample, index) => wav.writeInt16LE(sample, 44 + index * 2));
  return wav;
}

describe('audio quality analysis', () => {
  it('flags silent recordings before they are graded', () => {
    const metrics = analyzeWavQuality(pcm16Wav(Array.from({ length: 1600 }, () => 0)));

    expect(metrics.duration_seconds).toBe(0.1);
    expect(metrics.quality_flags).toEqual(expect.arrayContaining([
      'no_detectable_audio',
      'very_low_volume',
      'mostly_silence',
    ]));
  });

  it('detects clipping', () => {
    const metrics = analyzeWavQuality(pcm16Wav(Array.from({ length: 320 }, () => 32767)));

    expect(metrics.clipping_ratio).toBe(1);
    expect(metrics.quality_flags).toContain('clipping_detected');
  });
});

describe('transcript display formatting', () => {
  it('normalizes fillers without correcting the learner transcript', () => {
    expect(formatTranscriptForDisplay('Um, I am a studen. uh...')).toBe('Errr… I am a studen. Errr…');
  });
});
