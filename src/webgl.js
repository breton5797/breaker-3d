const KINDS = ['webgl2', 'webgl', 'experimental-webgl'];

/**
 * Tries each WebGL version and keeps the browser's own reason when none works,
 * so the error screen can say why (a blocked GPU, Lockdown Mode, a crashed GPU process).
 * @param {Document} doc
 * @returns {{ ok: boolean, version: string, reason: string }}
 */
export function webglReport(doc = document) {
  try {
    const c = doc.createElement('canvas');
    let status = '';
    c.addEventListener?.('webglcontextcreationerror', (e) => { status = e?.statusMessage || status; });
    const version = KINDS.find((k) => c.getContext(k));
    return version ? { ok: true, version, reason: '' } : { ok: false, version: '', reason: status || 'no context' };
  } catch (err) {
    return { ok: false, version: '', reason: err instanceof Error ? err.message : String(err) };
  }
}

/** @param {Document} doc @returns {boolean} whether this browser can draw WebGL at all */
export function hasWebGL(doc = document) {
  return webglReport(doc).ok;
}
