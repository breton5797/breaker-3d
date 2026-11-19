import { t } from './i18n.js';

/** The serve hint in the player's language (aimInput.aimLabel is the Korean original, kept for its tests). */
export function aimText(angle, held) {
  if (!held) return t('aim.hint');
  const deg = Math.round((Math.abs(angle) * 180) / Math.PI);
  if (deg === 0) return t('aim.vertical');
  return t('aim.angle', { angle: angle < 0 ? `◀ ${deg}°` : `${deg}° ▶` });
}

/** The touch serve hint for each step (serveInput.js). @param {object} serve the touch serve state */
export function serveText(serve) {
  if (serve.phase === 'place') return `◀ ${t('serve.place')} ▶`;
  if (serve.id === null) return t('serve.aim');
  return serve.cancel ? t('serve.cancel') : aimText(serve.angle, true);
}
