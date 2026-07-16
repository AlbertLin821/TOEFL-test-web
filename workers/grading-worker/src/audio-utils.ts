import { spawn } from 'node:child_process';

export interface AudioQualityMetrics {
  duration_seconds: number;
  rms_dbfs: number;
  peak_dbfs: number;
  clipping_ratio: number;
  silence_ratio: number;
  quality_flags: string[];
}

export async function convertToAssessmentWav(input: Buffer, ffmpegPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const process = spawn(
      ffmpegPath,
      ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1'],
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
    );
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    process.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    process.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    process.on('error', reject);
    process.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(output));
      else reject(new Error(`ffmpeg audio conversion failed (${code}): ${Buffer.concat(errors).toString('utf8')}`));
    });
    process.stdin.end(input);
  });
}

function findWavDataChunk(wav: Buffer): { offset: number; length: number } {
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const length = wav.readUInt32LE(offset + 4);
    if (id === 'data') return { offset: offset + 8, length: Math.min(length, wav.length - offset - 8) };
    offset += 8 + length + (length % 2);
  }
  throw new Error('Invalid WAV: data chunk not found');
}

export function analyzeWavQuality(wav: Buffer): AudioQualityMetrics {
  const { offset, length } = findWavDataChunk(wav);
  const sampleCount = Math.floor(length / 2);
  let sumSquares = 0;
  let peak = 0;
  let clipped = 0;
  let silent = 0;
  const silenceThreshold = 32768 * 0.0032; // approximately -50 dBFS

  for (let i = 0; i < sampleCount; i++) {
    const sample = wav.readInt16LE(offset + i * 2);
    const absolute = Math.abs(sample);
    sumSquares += sample * sample;
    peak = Math.max(peak, absolute);
    if (absolute >= 32700) clipped += 1;
    if (absolute <= silenceThreshold) silent += 1;
  }

  const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
  const toDbfs = (value: number) => value > 0 ? 20 * Math.log10(value / 32768) : -100;
  const clippingRatio = sampleCount > 0 ? clipped / sampleCount : 0;
  const silenceRatio = sampleCount > 0 ? silent / sampleCount : 1;
  const qualityFlags: string[] = [];
  if (sampleCount === 0 || rms === 0) qualityFlags.push('no_detectable_audio');
  if (toDbfs(rms) < -38) qualityFlags.push('very_low_volume');
  if (clippingRatio > 0.01) qualityFlags.push('clipping_detected');
  if (silenceRatio > 0.85) qualityFlags.push('mostly_silence');

  return {
    duration_seconds: sampleCount / 16000,
    rms_dbfs: Math.round(toDbfs(rms) * 100) / 100,
    peak_dbfs: Math.round(toDbfs(peak) * 100) / 100,
    clipping_ratio: Math.round(clippingRatio * 10000) / 10000,
    silence_ratio: Math.round(silenceRatio * 10000) / 10000,
    quality_flags: qualityFlags,
  };
}

export function formatTranscriptForDisplay(rawTranscript: string): string {
  return rawTranscript
    .replace(/\b(?:er+|uh+|um+)\b[,.…]*/gi, 'Errr…')
    .replace(/(?:Errr…\s*){2,}/g, 'Errr… ')
    .trim();
}
