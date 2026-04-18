/* Archive module — date range, stats dashboard, grouped list */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const api = (...a) => CHK.api(...a);
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    (s || "").toString().replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const money = (x) => {
    const n = Number(x || 0);
    return isFinite(n) ? n.toFixed(2).replace(/\.00$/, "") : "0";
  };

  let limit = 30;
  let offset = 0;
  let total = 0;
  let items = [];

  /* ── date helpers ── */
  function toISO(d) { return d.toISOString().slice(0, 10); }
  function today() { return toISO(new Date()); }
  function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return toISO(d); }
  function startOfMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  function currentMonthName() {
    return new Date().toLocaleDateString("en-US", { month: "long" });
  }
  function labelDate(isoStr) {
    const d = new Date(isoStr);
    const now = new Date();
    const diff = Math.floor(
      (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000
    );
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return d.toLocaleDateString(undefined, {
      day: "numeric", month: "long",
      year: diff > 300 ? "numeric" : undefined,
    });
  }

  /* ── quick filter chips ── */
  function setQuick(q) {
    document.querySelectorAll(".archQuick").forEach((b) => b.classList.remove("primary"));
    const btn = document.querySelector(`.archQuick[data-q="${q}"]`);
    if (btn) btn.classList.add("primary");
    const from = $("archFrom");
    const to = $("archTo");
    if (!from || !to) return;
    if (q === "today")        { from.value = today();        to.value = today(); }
    else if (q === "week")    { from.value = daysAgo(6);     to.value = today(); }
    else if (q === "month")   { from.value = daysAgo(29);    to.value = today(); }
    else if (q === "curmonth"){ from.value = startOfMonth(); to.value = today(); }
    else                      { from.value = "";              to.value = ""; }
    window.CHK?.datepicker?.updateButtons?.();
  }

  /* ── query strings ── */
  function qs() {
    const q    = ($("archSearch")?.value || "").trim();
    const from = ($("archFrom")?.value   || "").trim();
    const to   = ($("archTo")?.value     || "").trim();
    const p = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q)    p.set("q",    q);
    if (from) p.set("from", from);
    if (to)   p.set("to",   to);
    return "?" + p.toString();
  }
  function statsQs() {
    const q    = ($("archSearch")?.value || "").trim();
    const from = ($("archFrom")?.value   || "").trim();
    const to   = ($("archTo")?.value     || "").trim();
    const p = new URLSearchParams();
    if (q)    p.set("q",    q);
    if (from) p.set("from", from);
    if (to)   p.set("to",   to);
    return "?" + p.toString();
  }

  /* ── load ── */
  async function load() {
    const [listRes, statsRes] = await Promise.all([
      api("/api/checks/archive" + qs(),        { method: "GET" }),
      api("/api/checks/archive/stats" + statsQs(), { method: "GET" }),
    ]);

    items  = Array.isArray(listRes.items) ? listRes.items : [];
    total  = Number(listRes.total  ?? items.length);
    limit  = Number(listRes.limit  ?? limit);
    offset = Number(listRes.offset ?? offset);

    renderStats(statsRes);
    renderList();
  }

  /* ── stats cards ── */
  function renderStats(s) {
    const el = $("archStats");
    if (!el) return;
    if (!s || !s.ok) { el.innerHTML = ""; return; }

    const top = (s.top_products || []).slice(0, 3)
      .map((p) => `${esc(p.name)} ×${Math.round(p.qty)}`)
      .join(", ") || "—";

    el.innerHTML = `
      <div class="archStatCard" style="grid-column:span 2">
        <div class="archStatRow">
          <div><div class="archStatVal">${s.check_count}</div><div class="archStatLabel">Checks</div></div>
          <div class="archStatDivider"></div>
          <div><div class="archStatVal">${money(s.total_revenue)} ₾</div><div class="archStatLabel">Revenue</div></div>
          <div class="archStatDivider"></div>
          <div><div class="archStatVal">${money(s.avg_check)} ₾</div><div class="archStatLabel">Avg</div></div>
        </div>
      </div>
      <div class="archStatCard" style="grid-column:span 2">
        <div class="archStatLabel" style="margin-bottom:4px">Top items</div>
        <div class="archStatTop">${esc(top)}</div>
      </div>
    `;
  }

  /* ── grouped list by day ── */
  function renderList() {
    const list  = $("archList");
    const hint  = $("archHint");
    const prev  = $("btnArchPrev");
    const next  = $("btnArchNext");
    const pager = $("archPager");

    if (!list) return;
    list.innerHTML = "";

    if (!items.length) {
      if (hint)  hint.textContent  = "No closed checks for this filter.";
      if (pager) pager.textContent = "—";
      if (prev)  prev.disabled = true;
      if (next)  next.disabled = true;
      return;
    }
    if (hint) hint.textContent = "";

    /* group by calendar day */
    const groups = [];
    let curDay = null, curGroup = null;
    items.forEach((c) => {
      const day = c.closed_at ? c.closed_at.slice(0, 10) : "unknown";
      if (day !== curDay) {
        curDay = day;
        curGroup = { day, checks: [] };
        groups.push(curGroup);
      }
      curGroup.checks.push(c);
    });

    groups.forEach(({ day, checks }) => {
      const dayEl = document.createElement("div");
      dayEl.className = "archDayLabel";
      dayEl.textContent = day === "unknown" ? "Unknown date" : labelDate(day);
      list.appendChild(dayEl);

      checks.forEach((c) => {
        const id    = c.id || c.check_id;
        const num   = (c.number ?? "").toString();
        const guest = c.guest_name_snapshot || "—";
        const time  = c.closed_at
          ? new Date(c.closed_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
          : "";
        const pay = c.payment_method ? ` · ${c.payment_method}` : "";

        const el = document.createElement("div");
        el.className = "item archItem";
        el.innerHTML = `
          <div style="min-width:0">
            <b>#${esc(num)} · ${esc(guest)}</b>
            <div><small class="muted">${esc(time)}${esc(pay)}</small></div>
          </div>
          <div class="lineTotal">${esc(money(c.total))} ₾</div>
        `;
        el.onclick = () => {
          if (typeof CHK.openCheck === "function") {
            CHK.openCheck(id, { readonly: true, backTo: "archive" });
          }
        };
        list.appendChild(el);
      });
    });

    const from = offset + 1;
    const to   = Math.min(offset + limit, total || offset + items.length);
    if (pager) pager.textContent = total ? `${from}–${to} of ${total}` : `${from}–${to}`;
    if (prev)  prev.disabled = offset <= 0;
    if (next)  next.disabled = total ? offset + limit >= total : items.length < limit;
  }

  /* ── bind events ── */
  function bind() {
    const back    = $("btnBackOpenFromArchive");
    const prev    = $("btnArchPrev");
    const next    = $("btnArchNext");
    const search  = $("archSearch");
    const fromInp = $("archFrom");
    const toInp   = $("archTo");
    const resetBtn  = $("btnArchReset");
    const shareBtn  = $("btnArchShare");

    if (shareBtn) shareBtn.onclick = () => shareReport();

    if (back) {
      back.onclick = () => {
        try { document.body.classList.remove("chk-readonly"); } catch (_) {}
        if (typeof CHK.show === "function") CHK.show("screenOpen", CHK.getToken?.() || "");
      };
    }

    if (resetBtn) {
      resetBtn.onclick = async () => {
        if (fromInp) fromInp.value = "";
        if (toInp)   toInp.value   = "";
        document.querySelectorAll(".archQuick").forEach((b) => b.classList.remove("primary"));
        window.CHK?.datepicker?.updateButtons?.();
        offset = 0;
        await load().catch((e) => CHK.toast?.("Archive: " + (e.message || e)));
      };
    }

    document.querySelectorAll(".archQuick").forEach((btn) => {
      btn.onclick = async () => {
        setQuick(btn.dataset.q);
        offset = 0;
        await load().catch((e) => CHK.toast?.("Archive: " + (e.message || e)));
      };
    });

    const onDateChange = async () => {
      document.querySelectorAll(".archQuick").forEach((b) => b.classList.remove("primary"));
      offset = 0;
      await load().catch((e) => CHK.toast?.("Archive: " + (e.message || e)));
    };
    if (fromInp) fromInp.addEventListener("change", onDateChange);
    if (toInp)   toInp.addEventListener("change",   onDateChange);

    if (search) {
      let t = null;
      search.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(async () => {
          offset = 0;
          await load().catch((e) => CHK.toast?.("Archive: " + (e.message || e)));
        }, 300);
      });
    }

    if (prev) prev.onclick = async () => { offset = Math.max(0, offset - limit); await load().catch((e) => CHK.toast?.("Archive: " + (e.message || e))); };
    if (next) next.onclick = async () => { offset += limit;                       await load().catch((e) => CHK.toast?.("Archive: " + (e.message || e))); };
  }

  function init() {
    try {
      const btnCurMonth = $("btnCurMonth");
      if (btnCurMonth) btnCurMonth.textContent = currentMonthName();
      bind();
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ── share / download PDF report ── */
  async function shareReport() {
    const btn = $("btnArchShare");
    if (btn) { btn.disabled = true; btn.textContent = "…"; btn.style.minWidth = btn.offsetWidth + "px"; }
    try {
      const from = ($("archFrom")?.value || "").trim();
      const to   = ($("archTo")?.value   || "").trim();
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to)   p.set("to",   to);
      const resp = await CHK.apiFetch("/api/checks/archive/report?" + p.toString());
      if (!resp.ok) throw new Error("Report error " + resp.status);
      const blob = await resp.blob();
      const fname = "checki-report.pdf";
      const file = new File([blob], fname, { type: "application/pdf" });
      // Use native share only on touch devices (mobile); desktop gets a direct download
      const isMobile = navigator.maxTouchPoints > 0;
      if (isMobile && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Checki Report" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fname;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      }
    } catch (e) {
      CHK.toast?.("Report: " + (e.message || String(e)));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> PDF'; }
    }
  }

  CHK.archive = CHK.archive || {};
  // Full load: resets filters to "today" (called when navigating TO archive fresh)
  CHK.archive.load = async () => {
    setQuick("today");
    offset = 0;
    await load();
  };
  // Reload: keeps current filters (called when returning from archived check)
  CHK.archive.reload = async () => {
    offset = 0;
    await load();
  };
})();
