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

  function getFrom() { return ($("archFrom") || {}).value || ""; }
  function getTo()   { return ($("archTo")   || {}).value || ""; }

  function setFrom(v) {
    const el = $("archFrom");
    if (!el) return;
    el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setTo(v) {
    const el = $("archTo");
    if (!el) return;
    el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function updateButtons() {
    const bf = $("dpBtnFrom"), bt = $("dpBtnTo");
    if (bf) bf.textContent = fmtBtn(getFrom()) || "From…";
    if (bt) bt.textContent = fmtBtn(getTo())   || "To…";
  }

  /* ── popup ── */
  function openPopup(m) {
    mode = m;
    const ref = $(m === "from" ? "dpBtnFrom" : "dpBtnTo");
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
      e.target !== $("dpBtnFrom") && e.target !== $("dpBtnTo")
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

  /* ── init ── */
  function init() {
    const bf = $("dpBtnFrom"), bt = $("dpBtnTo");
    if (!bf || !bt) return;
    bf.onclick = (e) => { e.stopPropagation(); mode ? closePopup() : openPopup("from"); };
    bt.onclick = (e) => { e.stopPropagation(); mode ? closePopup() : openPopup("to"); };
    updateButtons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  CHK.datepicker = { updateButtons };
})();
