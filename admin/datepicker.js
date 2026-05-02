/* Lightweight date-range picker — replaces native date inputs in archive */
window.CHK = window.CHK || {};

(function () {
  const $ = (id) => document.getElementById(id);

  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const DOWS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

  let popup = null;
  let mode  = null; // "from" | "to"
  let vYear = 0, vMonth = 0;

  // Active context — can be switched per screen
  let _fromId    = "archFrom";
  let _toId      = "archTo";
  let _fromBtnId = "dpBtnFrom";
  let _toBtnId   = "dpBtnTo";

  function setContext(fromId, toId, fromBtnId, toBtnId) {
    _fromId    = fromId;
    _toId      = toId;
    _fromBtnId = fromBtnId;
    _toBtnId   = toBtnId;
    _bindButtons();
    updateButtons();
  }

  /* ── helpers ── */
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function isoDate(y, m1, d) {
    return `${y}-${String(m1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }

  function fmtBtn(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function getFrom() { return ($(_fromId) || {}).value || ""; }
  function getTo()   { return ($(_toId)   || {}).value || ""; }

  function setFrom(v) {
    const el = $(_fromId);
    if (!el) return;
    el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setTo(v) {
    const el = $(_toId);
    if (!el) return;
    el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function updateButtons() {
    const bf = $(_fromBtnId), bt = $(_toBtnId);
    if (bf) bf.textContent = fmtBtn(getFrom()) || bf.dataset.i18nDefault || "From…";
    if (bt) bt.textContent = fmtBtn(getTo())   || bt.dataset.i18nDefault || "To…";
  }

  /* ── popup ── */
  function openPopup(m) {
    mode = m;
    const ref = $(m === "from" ? _fromBtnId : _toBtnId);
    if (!ref) return;

    const iso = m === "from" ? getFrom() : getTo();
    if (iso) {
      const [y, mo] = iso.split("-").map(Number);
      vYear = y; vMonth = mo - 1;
    } else {
      const now = new Date(); vYear = now.getFullYear(); vMonth = now.getMonth();
    }

    if (!popup) {
      popup = document.createElement("div");
      popup.className = "dpPopup";
      document.body.appendChild(popup);
    }

    renderPopup();
    popup.style.display = "block";
    positionPopup(ref);
    setTimeout(() => document.addEventListener("click", outsideClick, { once: true }), 0);
  }

  function closePopup() {
    if (popup) popup.style.display = "none";
    mode = null;
  }

  function outsideClick(e) {
    if (
      popup && !popup.contains(e.target) &&
      e.target !== $(_fromBtnId) && e.target !== $(_toBtnId)
    ) closePopup();
  }

  function positionPopup(ref) {
    if (!popup) return;
    const r  = ref.getBoundingClientRect();
    const pw = 284, ph = 290;
    let left = r.left;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (left < 8) left = 8;
    const top = (window.innerHeight - r.bottom >= ph)
      ? (r.bottom + 6)
      : (r.top - ph - 6);
    Object.assign(popup.style, { left: left + "px", top: top + "px", width: pw + "px" });
  }

  /* ── calendar grid ── */
  function renderPopup() {
    if (!popup) return;

    const tISO  = todayISO();
    const fISO  = getFrom();
    const toISO = getTo();

    const firstDow  = (new Date(vYear, vMonth, 1).getDay() + 6) % 7; // Mon=0
    const daysInMon = new Date(vYear, vMonth + 1, 0).getDate();

    let cells = "";
    for (let i = 0; i < firstDow; i++) cells += "<div></div>";

    for (let d = 1; d <= daysInMon; d++) {
      const iso     = isoDate(vYear, vMonth + 1, d);
      const future  = iso > tISO;
      const isToday = iso === tISO;
      const isFr    = iso === fISO;
      const isTo    = iso === toISO;
      const inRange = fISO && toISO && iso > fISO && iso < toISO;

      let cls = "dpDay";
      if (future)  cls += " dpFuture";
      if (isToday) cls += " dpToday";
      if (isFr)    cls += " dpSel dpSelL";
      if (isTo)    cls += " dpSel dpSelR";
      if (inRange) cls += " dpRange";
      cells += `<div class="${cls}" data-iso="${iso}">${d}</div>`;
    }

    popup.innerHTML = `
      <div class="dpHeader">
        <button class="dpNav" id="dpPrev">‹</button>
        <span class="dpTitle">${MONTHS[vMonth]} ${vYear}</span>
        <button class="dpNav" id="dpNext">›</button>
      </div>
      <div class="dpGrid">
        ${DOWS.map((d) => `<div class="dpDow">${d}</div>`).join("")}
        ${cells}
      </div>
    `;

    popup.querySelector("#dpPrev").onclick = (e) => {
      e.stopPropagation();
      vMonth--; if (vMonth < 0) { vMonth = 11; vYear--; }
      renderPopup();
    };
    popup.querySelector("#dpNext").onclick = (e) => {
      e.stopPropagation();
      vMonth++; if (vMonth > 11) { vMonth = 0; vYear++; }
      renderPopup();
    };

    popup.querySelectorAll(".dpDay:not(.dpFuture)").forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const iso = el.dataset.iso;
        if (mode === "from") {
          setFrom(iso);
          if (getTo() && getTo() < iso) setTo("");
        } else {
          if (getFrom() && iso < getFrom()) { setTo(getFrom()); setFrom(iso); }
          else setTo(iso);
        }
        updateButtons();
        closePopup();
      };
    });
  }

  /* ── bind buttons for current context ── */
  function _bindButtons() {
    const bf = $(_fromBtnId), bt = $(_toBtnId);
    if (bf) bf.onclick = (e) => { e.stopPropagation(); mode ? closePopup() : openPopup("from"); };
    if (bt) bt.onclick = (e) => { e.stopPropagation(); mode ? closePopup() : openPopup("to"); };
  }

  /* ── init ── */
  function init() {
    _bindButtons();
    updateButtons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  CHK.datepicker = { updateButtons, setContext };
})();
