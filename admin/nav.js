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

  CHK.nav = nav;
})();
