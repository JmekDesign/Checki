/* Stack-based navigator — wraps CHK._show with history */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;

  // Push a guard state so browser swipe-back triggers popstate instead of leaving the SPA
  function _pushGuard() {
    history.pushState({ checki: true }, "");
  }

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

  // Intercept browser back gesture (swipe-left on mobile, browser back button)
  window.addEventListener("popstate", () => {
    if (nav._stack.length > 1) {
      nav._stack.pop();
      CHK._show(nav._stack[nav._stack.length - 1]);
    }
    // Restore guard so the next swipe is also caught
    _pushGuard();
  });

  // Install guard on load
  _pushGuard();

  CHK.nav = nav;
})();
