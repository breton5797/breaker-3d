// Apps in Toss mini-app (owner, 2026-11-23). Build: `npm run app:toss` -> vite build --mode toss, then
// `ait build` packs dist/ into the .ait bundle uploaded in the Apps in Toss console.
// appName must match the app registered in the console (change it here once the console gives it).
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'breaker-3d',
  webView: {},
  permissions: [],
  webBundleDir: 'dist',
});
