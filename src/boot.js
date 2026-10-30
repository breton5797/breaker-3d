// Entry point. Checks the browser can run the game before loading it, shows a
// clear message instead of a blank page when it can't, and registers the
// offline cache in production builds.
import { hasWebGL } from './webgl.js';

const $ = (id) => document.getElementById(id);
const CONTEXT_GRACE_MS = 2500; // a lost GPU context usually comes back within this

// These show before the game (and its dictionaries) has loaded: Korean for Korean devices, else English.
const KO = (navigator.language ?? '').toLowerCase().startsWith('ko');
const MSG = KO ? {
  webgl: '이 브라우저에서는 3D 그래픽(WebGL)을 쓸 수 없어 게임을 시작할 수 없습니다. 최신 Chrome·Safari·Edge·Firefox에서 열거나, 브라우저 설정에서 하드웨어 가속을 켜 주세요.',
  load: '게임을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.',
  gpu: '그래픽이 잠시 멈췄습니다. 새로고침하면 이어서 할 수 있어요(진행 상황은 저장되어 있습니다).',
  reload: '새로고침',
} : {
  webgl: 'This browser cannot run 3D graphics (WebGL), so the game cannot start. Open it in a recent Chrome, Safari, Edge or Firefox, or turn on hardware acceleration in the browser settings.',
  load: 'The game could not be loaded. Check your internet connection and reload.',
  gpu: 'The graphics stalled for a moment. Reload to carry on (your progress is saved).',
  reload: 'Reload',
};

function fail(text) {
  $('boot-error-text').textContent = text ?? MSG.webgl;
  $('boot-error-reload').textContent = MSG.reload;
  $('boot-error').hidden = false;
  $('splash')?.remove();
}

$('boot-error-reload').addEventListener('click', () => location.reload());

if (!hasWebGL()) {
  fail();
} else {
  import('./main.js').catch(() => fail(MSG.load));

  // The GPU can drop the WebGL context (driver reset, too many tabs). The browser
  // often restores it; if it doesn't come back soon, offer a reload.
  const canvas = $('game');
  let lostTimer = 0;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // allow the browser to restore it
    lostTimer = setTimeout(() => fail(MSG.gpu), CONTEXT_GRACE_MS);
  });
  canvas.addEventListener('webglcontextrestored', () => clearTimeout(lostTimer));
}

// The offline cache is for the web; the app already has every file on the device.
const inApp = Boolean(window.Capacitor?.isNativePlatform?.());
if (import.meta.env.PROD && 'serviceWorker' in navigator && !inApp) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // no offline cache (private mode, file://): the game still works online
    });
  });
}
