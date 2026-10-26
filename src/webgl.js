/** @param {Document} doc @returns {boolean} whether this browser can draw WebGL at all */
export function hasWebGL(doc = document) {
  try {
    const c = doc.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false; // disabled by policy or a blocklisted GPU
  }
}
