// Daily gameplay short for the SWISHBY Instagram / TikTok / YouTube Shorts (owner, 2026-11-17; the
// direction Jev chose: daily short gameplay videos, posted after the owner approves each one).
// Records the game playing itself (?demo=<stage>, src/demo.js) with its own sound in a portrait browser,
// then cuts it for impact (edit.mjs: hook from the peak, sped-up build-up, real-time climax, end card)
// and writes the captions. Output: marketing/out/<date>/ (not committed).
// Usage: node scripts/marketing/daily-short.mjs [date=today] [stage=pick by date]
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { getLevel } from '../../src/sim/levels.js';
import { shortCaption, pickStage, FILMABLE } from './caption.mjs';
import { planEdit, render } from './edit.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const PORT = 5420;
const VIEW = { width: 720, height: 1280 };
const MIN_PEAK = 500; // a run whose swarm never got this big is dull: film the next filmable stage
const TRIES = 3;

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const date = process.argv[2] ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const first = Number(process.argv[3] ?? pickStage(date));
const out = join(ROOT, 'marketing/out', date);
mkdirSync(out, { recursive: true });

/** Records one demo run with its sound and ball-count timeline. */
async function film(browser, stage, raw) {
  rmSync(raw, { recursive: true, force: true });
  mkdirSync(raw, { recursive: true });
  const context = await browser.newContext({ viewport: VIEW, recordVideo: { dir: raw, size: VIEW }, locale: 'ko-KR' });
  await context.addInitScript(() => localStorage.setItem('breaker3d.v1', JSON.stringify({ unlocked: 1000, serveTip: true, lang: 'ko' })));
  const page = await context.newPage();
  const t0 = Date.now(); // the recording starts with the page
  await page.goto(`http://127.0.0.1:${PORT}/?demo=${stage}`);
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 60_000 }); // loading screen gone
  const cut = (Date.now() - t0) / 1000;
  // From here: the game's own sound (audio.stream()) and the ball count every 0.2 s (for the edit).
  await page.evaluate(() => {
    const rec = { chunks: [], samples: [], t0: performance.now() };
    window.__rec = rec;
    const stream = window.__breaker?.audio?.stream();
    if (stream && window.MediaRecorder) {
      rec.mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      rec.mr.ondataavailable = (e) => rec.chunks.push(e.data);
      rec.mr.start(500);
    }
    rec.iv = setInterval(() => rec.samples.push([(performance.now() - rec.t0) / 1000, window.__breaker?.world?.balls?.n ?? 0]), 200);
  });
  const cleared = await page.waitForFunction(() => document.getElementById('screen-clear')?.hidden === false, null, { timeout: 55_000 }).then(() => true, () => false);
  const clearRec = cleared ? (Date.now() - t0) / 1000 - cut : null;
  const peak = await page.evaluate(() => window.__breaker?.world?.peakBalls ?? 0);
  await page.waitForTimeout(3000); // the clear screen
  const length = Math.min(60, (Date.now() - t0) / 1000 - cut);
  // The clear time as the clear screen shows it (its first stat row, e.g. "16.55초").
  const shown = await page.evaluate(() => document.querySelector('#screen-clear .stats')?.textContent ?? '');
  const clearAt = cleared ? Math.round(Number(/(\d+(?:\.\d+)?)\s*초/.exec(shown)?.[1] ?? NaN)) || null : null;
  const rec = await page.evaluate(async () => {
    const r = window.__rec;
    clearInterval(r.iv);
    if (r.mr) await new Promise((ok) => { r.mr.onstop = ok; r.mr.stop(); });
    const bytes = new Uint8Array(await new Blob(r.chunks, { type: 'audio/webm' }).arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { samples: r.samples, audio: bytes.length ? btoa(bin) : null };
  });
  await context.close();
  const webm = join(raw, readdirSync(raw).find((f) => f.endsWith('.webm'))); // the screen recording
  const audio = rec.audio ? join(raw, 'game-audio.webm') : null;
  if (audio) writeFileSync(audio, Buffer.from(rec.audio, 'base64'));
  const plain = join(raw, 'plain.mp4'); // no loading screen; the source of the cut
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', cut.toFixed(2), '-i', webm, '-t', length.toFixed(2),
    '-vf', 'fps=30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-an', plain]);
  return { stage, peak, cleared, clearAt, clearRec, length, samples: rec.samples, plain, audio };
}

/** Transparent 1080x1920 PNG with centred text lines (ffmpeg here has no drawtext): [text, px, y, colour]. */
async function textCard(browser, lines, file) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const html = lines.map(([t, size, y, color = '#fff']) => `<div style="position:absolute;left:0;right:0;top:${y}px;text-align:center;font:900 ${size}px 'Apple SD Gothic Neo','Pretendard',sans-serif;color:${color};-webkit-text-stroke:${Math.round(size / 14)}px #000;paint-order:stroke fill;letter-spacing:-1px">${t}</div>`).join('');
  await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
  await page.screenshot({ path: file, omitBackground: true });
  await page.close();
}

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 4000));
  // The Mac's GPU (Metal): software WebGL (SwiftShader) runs the game at ~2 fps, which films nothing.
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const raw = join(out, 'raw');
  let clip = null;
  const order = [first, ...FILMABLE.filter((s) => s !== first)];
  for (let k = 0; k < TRIES; k++) {
    clip = await film(browser, order[k], raw);
    console.log(`take ${k + 1}: stage ${clip.stage} peak ${clip.peak} ${clip.cleared ? `cleared ${clip.clearAt}s` : 'not cleared'}`);
    if (clip.peak >= MIN_PEAK) break;
  }
  const level = getLevel(clip.stage - 1);
  const balls = clip.peak.toLocaleString('en-US');
  const hook = join(raw, 'hook.png');
  const end = join(raw, 'end.png');
  await textCard(browser, [[`공 1개 → ${balls}개?!`, 112, 230, '#fff'], ['과일 하나로 공이 폭발한다 🍉', 60, 390, '#ffe066']], hook);
  await textCard(browser, [['BREAKER 3D', 128, 700, '#fff'], ['지금 무료로 해 보세요', 72, 900, '#ffe066'], ['Free on Google Play · App Store', 52, 1020, '#fff']], end);
  await browser.close();
  const plan = planEdit({ length: clip.length, samples: clip.samples, clearAt: clip.clearRec });
  const mp4 = join(out, `breaker3d-${date}-stage${clip.stage}.mp4`);
  render({ video: clip.plain, audio: clip.audio, plan, hookPng: hook, endPng: end, out: mp4 });
  console.log(`cut: ${plan.segments.map((x) => `${x.kind} ${x.from.toFixed(1)}-${x.to.toFixed(1)}s x${x.speed}`).join(' | ')} + end ${plan.endCard}s = ${plan.total.toFixed(1)}s, sound ${clip.audio ? 'yes' : 'no'}`);
  // A small copy (~8.8 MB, 720x1280) for browser upload tools that cap a file at 10 MB.
  const small = mp4.replace(/\.mp4$/, '-upload.mp4');
  const kbps = Math.floor((8.8 * 8192) / plan.total) - 32 - (clip.audio ? 96 : 0);
  const enc = (pass) => ['-y', '-loglevel', 'error', '-i', mp4, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow',
    '-b:v', `${kbps}k`, '-pass', String(pass), '-passlogfile', join(out, 'x264'), '-pix_fmt', 'yuv420p'];
  execFileSync('ffmpeg', [...enc(1), '-an', '-f', 'mp4', '/dev/null']);
  execFileSync('ffmpeg', [...enc(2), ...(clip.audio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']), '-movflags', '+faststart', small]);
  for (const f of readdirSync(out)) if (f.startsWith('x264')) rmSync(join(out, f));
  rmSync(raw, { recursive: true, force: true });
  writeFileSync(join(out, 'caption.md'), shortCaption({ date, stage: clip.stage, id: level.id, peak: clip.peak, seconds: clip.clearAt }));
  console.log(`done: ${mp4}\n      ${join(out, 'caption.md')}`);
} finally {
  server.kill();
}
