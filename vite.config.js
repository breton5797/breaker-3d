import { defineConfig } from 'vite';

// Relative asset paths so the build works from a sub-path such as
// https://<user>.github.io/breaker-3d/ (GitHub Pages) as well as from a domain root.
export default defineConfig({
  base: './',
});
