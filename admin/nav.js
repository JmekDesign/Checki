/* Stack-based navigator — wraps CHK._show with history */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;

  const nav = {
    _stack: [],

    // Push screen onto stack and show it
    go(screen) {
      this._stack.push(screen);
      CHK._show(screen);
    },

    // Go back to previous screen in history
    back() {
      if (this._stack.length > 1) this._stack.pop();
      CHK._show(this._stack[this._stack.length - 1] || "screenOpen");
    },

    // Replace current screen without adding to history
    replace(screen) {
      if (this._stack.length > 0) {
        this._stack[this._stack.length - 1] = screen;
      } else {
        this._stack.push(screen);
      }
      CHK._show(screen);
    },

    // Clear stack and show screen (tabs, login, initial load)
    reset(screen) {
      this._stack = [screen];
      CHK._show(screen);
    },

    current() {
      return this._stack[this._stack.length - 1] || null;
    },
  };

  // In-app swipe right→left = go back (only when there is somewhere to go back to)
  let _tx = 0;
  let _ty = 0;
  window.addEventListener("touchstart", (e) => {
    _tx = e.touches[0].clientX;
    _ty = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener("touchend", (e) => {
    if (nav._stack.length <= 1) return;
    // Skip when any modal/overlay is open
    if (document.querySelector(".back:not(.hide)")) return;
    const dx = e.changedTouches[0].clientX - _tx;
    const dy = e.changedTouches[0].clientY - _ty;
    // Must be mostly horizontal and cover ≥45% of screen width
    if (dx < -(window.innerWidth * 0.45) && Math.abs(dx) > Math.abs(dy) * 1.5) {
      nav.back();
    }
  }, { passive: true });

  CHK.nav = nav;
})();
