// The punchy cut of the daily short (owner, 2026-11-17: make viewers want to play it themselves, with
// sound). From the raw recording and its ball-count timeline: a 2 s hook from the peak (thousands of
// balls) with a headline, the build-up sped up to at most ~10 s, the climax at real speed through the
// clear screen, and an end card with where to play. planEdit is the plan (tested); render() runs ffmpeg.
import { execFileSync } from 'node:child_process';

const HOOK = 2; // seconds of peak shown first
const BUILD_MAX = 10; // the build-up is squeezed into at most this many seconds
const END_CARD = 2.5;
const AFTER_CLEAR = 3; // seconds of the clear screen kept
const AFTER_PEAK = 6; // when the run never clears

/**
 * @param {{ length: number, samples: Array<[number, number]>, clearAt: number|null }} rec
 *   samples: [seconds since recording start, balls on screen]; clearAt: seconds when the clear screen showed
 */
export function planEdit({ length, samples, clearAt }) {
  const peak = Math.max(...samples.map(([, n]) => n));
  // The moment the swarm first reaches 90% of its peak: the "whoa" frame.
  const peakAt = samples.find(([, n]) => n >= peak * 0.9)?.[0] ?? length / 2;
  const hookFrom = Math.max(0, Math.min(length - HOOK, peakAt + 0.5));
  const buildTo = Math.max(0.5, peakAt - 1);
  const speed = buildTo > BUILD_MAX ? +(buildTo / BUILD_MAX).toFixed(3) : 1;
  const end = Math.min(length, clearAt !== null ? clearAt + AFTER_CLEAR : peakAt + AFTER_PEAK);
  const segments = [
    { kind: 'hook', from: hookFrom, to: hookFrom + HOOK, speed: 1 },
    { kind: 'build', from: 0, to: buildTo, speed },
    { kind: 'climax', from: buildTo, to: end, speed: 1 },
  ];
  const total = segments.reduce((s, x) => s + (x.to - x.from) / x.speed, 0) + END_CARD;
  return { peak, peakAt, segments, endCard: END_CARD, total };
}

/** ffmpeg atempo only takes 0.5..2 per filter: chain them for bigger factors. */
export function atempoChain(speed) {
  const parts = [];
  let left = speed;
  while (left > 2) { parts.push(2); left /= 2; }
  parts.push(+left.toFixed(4));
  return parts.map((f) => `atempo=${f}`).join(',');
}

/**
 * Renders the cut: video (and audio when there is a track) of each segment, the hook headline and the
 * end card laid over as transparent PNGs (this ffmpeg has no drawtext). Output 1080x1920 30 fps H.264 + AAC.
 * @param {{ video: string, audio: string|null, plan: ReturnType<typeof planEdit>, hookPng: string, endPng: string, out: string }} o
 */
export function render({ video, audio, plan, hookPng, endPng, out }) {
  const a = audio ? 1 : null; // input index of the sound
  const hookIn = audio ? 2 : 1;
  const endIn = hookIn + 1;
  const inputs = ['-i', video, ...(audio ? ['-i', audio] : []), '-loop', '1', '-i', hookPng, '-loop', '1', '-i', endPng];
  const f = [];
  plan.segments.forEach((s, k) => {
    f.push(`[0:v]trim=${s.from.toFixed(3)}:${s.to.toFixed(3)},setpts=(PTS-STARTPTS)/${s.speed},scale=1080:1920:flags=lanczos,fps=30,setsar=1[v${k}]`);
    if (a) f.push(`[${a}:a]atrim=${s.from.toFixed(3)}:${s.to.toFixed(3)},asetpts=PTS-STARTPTS,${atempoChain(s.speed)},aformat=sample_rates=48000:channel_layouts=stereo[a${k}]`);
  });
  const last = plan.segments[2];
  f.push(`[0:v]trim=${Math.max(0, last.to - 0.1).toFixed(3)}:${last.to.toFixed(3)},setpts=PTS-STARTPTS,scale=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration=${plan.endCard},boxblur=12:2,eq=brightness=-0.25,setsar=1[bg3]`);
  f.push(`[bg3][${endIn}:v]overlay=0:0:shortest=1,setsar=1[v3]`);
  if (a) f.push(`anullsrc=r=48000:cl=stereo,atrim=0:${plan.endCard}[a3]`);
  f.push(`[v0][${hookIn}:v]overlay=0:0:shortest=1,setsar=1[v0t]`);
  const vs = ['[v0t]', '[v1]', '[v2]', '[v3]'];
  if (audio) {
    f.push(`${vs.map((v, k) => `${v}[a${k}]`).join('')}concat=n=4:v=1:a=1[v][a]`);
  } else {
    f.push(`${vs.join('')}concat=n=4:v=1:a=0[v]`);
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', f.join(';'),
    '-map', '[v]', ...(audio ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '160k'] : ['-an']),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-maxrate', '10M', '-bufsize', '20M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
}
