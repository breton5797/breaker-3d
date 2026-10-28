// A sound for every button press, so menus feel as alive as the game.
// Listens in the capture phase, so buttons that stop propagation still click.

/** Button id -> sound name (see audio.js). */
export const UI_SOUNDS = Object.freeze({
  'btn-start': 'confirm',
  'btn-next': 'confirm',
  'btn-retry': 'confirm',
  'btn-over-retry': 'confirm',
  // Pause and resume sound from togglePause (so P / Esc get them too).
  'btn-resume': null,
  'btn-pause': null,
  'btn-menu': 'back',
  'btn-over-menu': 'back',
  'btn-pause-menu': 'back',
  'btn-achv-back': 'back',
  'btn-credits-back': 'back',
  'btn-achv': 'open',
  // Buying a charge plays the coin sound from the game itself (or nothing when it can't be bought).
  'btn-buy-split': null,
  'btn-buy-meteor': null,
  'btn-revive': 'confirm',
  'btn-double-gold': 'confirm',
  'btn-remove-ads': 'open',
  'btn-restore': 'tap',
  'btn-credits': 'open',
  'btn-mute': 'toggle',
  'btn-vibe': 'toggle',
  'btn-full': 'toggle',
  'btn-full-pause': 'toggle',
  // The startup error screen shows before the game (and its audio) has loaded.
  'boot-error-reload': null,
  // Skills already play their own sound in the game.
  'skill-split': null,
  'skill-meteor': null,
});

/**
 * @param {{ id:string, classList:{ contains:(c:string)=>boolean } }} button
 * @returns {string|null} sound name, or null for silent buttons
 */
export function soundForButton(button) {
  if (button.id && button.id in UI_SOUNDS) return UI_SOUNDS[button.id];
  return button.classList.contains('stage-btn') ? 'confirm' : 'tap';
}

/**
 * @param {Document} doc
 * @param {(name:string)=>void} play
 */
export function bindUiSounds(doc, play) {
  doc.addEventListener('click', (e) => {
    const button = e.target instanceof Element ? e.target.closest('button') : null;
    if (!button || button.disabled) return;
    const name = soundForButton(button);
    if (name) play(name);
  }, true);
}
