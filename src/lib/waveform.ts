/** Bar heights (0..1) for a waveform, from decoded audio or, failing that, a stand-in. */

/** Peak level of `bars` equal slices of one channel, scaled so the loudest is 1. */
export function peaksOf(samples: Float32Array, bars: number): number[] {
  if (!samples.length || bars < 1) return [];
  const step = Math.max(1, Math.floor(samples.length / bars));
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    let peak = 0;
    const end = Math.min(samples.length, (i + 1) * step);
    // sampling every few points is plenty for a bar that is a few pixels wide
    for (let j = i * step; j < end; j += Math.max(1, step >> 6)) {
      const v = Math.abs(samples[j]);
      if (v > peak) peak = v;
    }
    out.push(peak);
  }
  const max = Math.max(...out, 1e-6);
  return out.map((p) => Math.max(0.06, p / max));
}

/**
 * A steady, speech-shaped stand-in used while a real waveform loads or when
 * the audio cannot be decoded. Seeded, so the same clip always looks the same.
 */
export function standInPeaks(seed: string, bars: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return Array.from({ length: bars }, (_, i) => {
    const swell = 0.5 + 0.5 * Math.sin((i / bars) * Math.PI * 3 + rand() * 2);
    return Math.max(0.1, Math.min(1, 0.25 + swell * 0.55 + rand() * 0.25));
  });
}
