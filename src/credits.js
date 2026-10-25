// Photo credits for the landmark backgrounds (public/landmarks/credits.json,
// written by scripts/fetch-photos.mjs). Every field is checked before use.

const SOURCE = /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/;
/** Licences free enough to ship (shared with scripts/fetch-photos.mjs). */
export const FREE_LICENSE = /^(public domain|cc0|cc by(-sa)? [\d.]+( \w+)?)$/i;

/** @returns {{ artist:string, license:string, source:string } | null} a valid credit entry */
export function cleanCredit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const artist = typeof raw.artist === 'string' ? raw.artist.slice(0, 120) : '';
  const license = typeof raw.license === 'string' ? raw.license : '';
  const source = typeof raw.source === 'string' ? raw.source : '';
  if (!artist || !FREE_LICENSE.test(license) || !SOURCE.test(source)) return null;
  return { artist, license, source };
}

/** @returns {Promise<Record<string, {artist:string, license:string, source:string}>>} credits by landmark id ({} on failure) */
export async function loadCredits() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}landmarks/credits.json`);
    if (!res.ok) return {};
    const raw = await res.json();
    return Object.fromEntries(Object.entries(raw).map(([id, c]) => [id, cleanCredit(c)]).filter(([, c]) => c));
  } catch {
    return {}; // offline or blocked: the game runs without the credits list
  }
}
