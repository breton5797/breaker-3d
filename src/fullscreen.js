// Fullscreen toggle (standard API, with the webkit prefix for older Safari and
// Samsung Internet). iPhone Safari has no element fullscreen at all: there the
// game reports unsupported and players use "Add to Home Screen" instead (the
// web manifest launches it without browser bars).

/** @param {Document} doc */
export function createFullscreen(doc = document) {
  const el = doc.documentElement;
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
  const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  const supported = Boolean(request && exit && (doc.fullscreenEnabled || doc.webkitFullscreenEnabled));
  const isActive = () => Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  const listeners = [];
  const notify = () => listeners.forEach((fn) => fn(isActive()));
  doc.addEventListener('fullscreenchange', notify);
  doc.addEventListener('webkitfullscreenchange', notify);

  /** @returns {Promise<boolean>} whether the switch happened */
  async function toggle() {
    if (!supported) return false;
    try {
      if (isActive()) await exit.call(doc);
      else await request.call(el, { navigationUI: 'hide' });
      return true;
    } catch {
      return false; // refused (no user gesture, or blocked by the browser)
    }
  }

  return {
    toggle,
    supported,
    get active() { return isActive(); },
    /** @param {(on:boolean)=>void} fn */
    onChange(fn) { listeners.push(fn); },
  };
}
