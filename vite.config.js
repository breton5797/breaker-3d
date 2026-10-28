import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Relative asset paths so the build works from a sub-path such as
// https://<user>.github.io/breaker-3d/ (GitHub Pages) as well as from a domain root.
export default defineConfig({
  base: './',
  // Shown on the title screen, so players can tell which version they are on.
  define: { __APP_VERSION__: JSON.stringify(version) },
  // three.js in its own file: it rarely changes, so returning players keep it
  // cached across deploys instead of downloading it with every game update.
  build: {
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]build[\\/]/ }] } },
    },
  },
});
