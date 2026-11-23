// The Apps in Toss build (owner, 2026-11-23; `vite build --mode toss`). Toss's game checklist asks
// that the system back button always leads somewhere and that nothing sits under the safe area.
// The SDK (@apps-in-toss/web-framework) is loaded only in this build; every piece is optional, so
// a missing or failing SDK never stops the game.

/**
 * What the system back button does now.
 * @param {{ mode: string, picking?: boolean, subscreen?: boolean }} s
 * @returns {'closePicker'|'pause'|'menu'|'closeSubscreen'|'exit'}
 */
export function backAction({ mode, picking = false, subscreen = false }) {
  if (picking) return 'closePicker';
  if (mode === 'play' || mode === 'paused') return 'pause'; // pauses, or resumes from the pause menu
  if (mode === 'outro') return 'menu'; // clear / game-over screen -> title
  return subscreen ? 'closeSubscreen' : 'exit'; // the bare title: leave the mini-app
}

const px = (v) => `${Number.isFinite(v) && v > 0 ? Math.round(v) : 0}px`;

/** @param {{ top?: number, bottom?: number }|null} insets @returns {Record<string, string>} CSS variables */
export const safeAreaVars = (insets) => ({ '--safe-top': px(insets?.top), '--safe-bottom': px(insets?.bottom) });

/**
 * @param {() => Promise<object>} loadSdk imports @apps-in-toss/web-framework
 * @param {{ style: { setProperty: (k: string, v: string) => void }, state: () => object,
 *   closePicker?: () => void, pause?: () => void, menu?: () => void, closeSubscreen?: () => void }} io
 */
export async function startToss(loadSdk, io) {
  let sdk;
  try { sdk = await loadSdk(); } catch { return; } // no SDK: plain web behaviour
  try {
    for (const [k, v] of Object.entries(safeAreaVars(sdk.SafeArea?.get?.()))) io.style.setProperty(k, v);
  } catch { /* keep the CSS env() fallback */ }
  const exit = () => sdk.closeView?.().catch?.(() => {});
  try {
    sdk.graniteEvent?.addEventListener?.('backEvent', {
      onEvent: () => {
        const act = backAction(io.state());
        if (act === 'exit') exit();
        else io[act]?.();
      },
      onError: () => {},
    });
  } catch { /* Toss handles back itself */ }
}
