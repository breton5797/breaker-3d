// Delayed effects (follow-up toasts, staggered fireworks) that belong to one
// stage. They are kept together so leaving the stage can call them all off,
// instead of an old "BOSS 출현" popping up over the menu or the next stage.

export function createTimers() {
  let ids = new Set();
  return {
    /** Like setTimeout, but cancelled by cancelAll(). */
    later(fn, ms) {
      const id = setTimeout(() => {
        ids = new Set([...ids].filter((x) => x !== id));
        fn();
      }, ms);
      ids = new Set([...ids, id]);
      return id;
    },
    cancelAll() {
      ids.forEach((id) => clearTimeout(id));
      ids = new Set();
    },
    pending: () => ids.size,
  };
}
