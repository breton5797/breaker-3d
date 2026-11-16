// Daily gameplay short for the SWISHBY Instagram / TikTok / YouTube Shorts (owner, 2026-11-17; the
// direction Jev chose: daily short gameplay videos, posted after the owner approves each one).
// Records the game playing itself (?demo=<stage>, src/demo.js) in a portrait browser, converts it to
// a 1080x1920 H.264 MP4 and writes the captions. Output: marketing/out/<date>/ (not committed).
// Usage: node scripts/marketing/daily-short.mjs [date=today] [stage=pick by date]
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { getLevel } from '../../src/sim/levels.js';
import { scout } from './demo-scout.mjs';
import { shortCaption, pickStage } from './caption.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const PORT = 5420;
const VIEW = { width: 720, height: 1280 };

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const date = process.argv[2] ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const stage = Number(process.argv[3] ?? pickStage(date));
const out = join(ROOT, 'marketing/out', date);
mkdirSync(out, { recursive: true });

// How long to film: until the bot clears (measured in the sim), plus the clear screen.
const run = scout(stage, 90);
const seconds = Math.min(60, Math.ceil((run.state === 'clear' ? run.t : 45) + 6));
console.log(`stage ${stage} (${run.name}): ${run.state} at ${run.t.toFixed(0)}s, peak ${run.peak} balls -> film ${seconds}s`);

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 4000));
  // The Mac's GPU (Metal): software WebGL (SwiftShader) runs the game at ~2 fps, which films nothing.
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const raw = join(out, 'raw');
  mkdirSync(raw, { recursive: true });
  const context = await browser.newContext({ viewport: VIEW, recordVideo: { dir: raw, size: VIEW }, locale: 'ko-KR' });
  await context.addInitScript(() => localStorage.setItem('breaker3d.v1', JSON.stringify({ unlocked: 1000, serveTip: true, lang: 'ko' })));
  const page = await context.newPage();
  const t0 = Date.now(); // the recording starts with the page
  await page.goto(`http://127.0.0.1:${PORT}/?demo=${stage}`);
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 60_000 }); // loading screen gone
  const cut = (Date.now() - t0) / 1000; // seconds of loading to cut from the front
  // Film until the clear screen has been up for 3 s (the browser often clears sooner than the sim run).
  await page.waitForFunction(() => document.getElementById('screen-clear')?.hidden === false, null, { timeout: 55_000 }).catch(() => {});
  // The caption quotes this run's own figures (the dev build exposes the world as window.__breaker).
  const clip = await page.evaluate(() => ({ peak: window.__breaker?.world?.peakBalls ?? 0, cleared: window.__breaker?.world?.state === 'clear' }));
  await page.waitForTimeout(3000);
  const length = Math.min(60, (Date.now() - t0) / 1000 - cut);
  // The clear time as the clear screen shows it (its first stat row, e.g. "16.55초").
  const shown = await page.evaluate(() => document.querySelector('#screen-clear .stats')?.textContent ?? '');
  const clearAt = clip.cleared ? Math.round(Number(/(\d+(?:\.\d+)?)\s*초/.exec(shown)?.[1] ?? NaN)) || null : null;
  await context.close();
  await browser.close();
  const webm = join(raw, readdirSync(raw).find((f) => f.endsWith('.webm')));
  const mp4 = join(out, `breaker3d-${date}-stage${stage}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', cut.toFixed(2), '-i', webm, '-t', length.toFixed(2),
    '-vf', 'scale=1080:1920:flags=lanczos,fps=30', '-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-crf', '24', '-maxrate', '10M', '-bufsize', '20M', '-movflags', '+faststart', '-an', mp4]);
  rmSync(raw, { recursive: true, force: true });
  // A small copy (<= 9.5 MB, 720x1280) for browser upload tools that cap a file at 10 MB.
  const small = mp4.replace(/\.mp4$/, '-upload.mp4');
  const kbps = Math.floor((9.5 * 8192) / length) - 32;
  const enc = (pass) => ['-y', '-loglevel', 'error', '-i', mp4, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow',
    '-b:v', `${kbps}k`, '-pass', String(pass), '-passlogfile', join(out, 'x264'), '-pix_fmt', 'yuv420p', '-an'];
  execFileSync('ffmpeg', [...enc(1), '-f', 'mp4', '/dev/null']);
  execFileSync('ffmpeg', [...enc(2), '-movflags', '+faststart', small]);
  for (const f of readdirSync(out)) if (f.startsWith('x264')) rmSync(join(out, f));
  const level = getLevel(stage - 1);
  writeFileSync(join(out, 'caption.md'), shortCaption({ date, stage, id: level.id, peak: clip.peak, seconds: clearAt }));
  console.log(`done: ${mp4}\n      ${join(out, 'caption.md')}`);
} finally {
  server.kill();
}
