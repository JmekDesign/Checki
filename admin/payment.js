/* Payment confirm modal — paper-receipt UI with QR + cash/card buttons */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const $ = (id) => document.getElementById(id);

  const _rcptEsc = (s) =>
    (s || "").toString().replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const _rcptMoney = (x) => {
    const n = Number(x || 0);
    return isFinite(n) ? n.toFixed(2).replace(/\.00$/, "") : "0";
  };

  // Payment method picker — renders a paper-receipt modal.
  // Resolves "cash" | "card" | null (cancel).
  const paymentConfirm = (opts) => {
    const o    = opts || {};
    const back = $("payBack");
    if (!back) return Promise.resolve(null);

    const num   = String(o.number || "");
    const guest = String(o.guest  || "—");
    const total = Number(o.total  || 0);
    const items = Array.isArray(o.items) ? o.items : [];

    const now = new Date();
    const ts  = now.toLocaleDateString(undefined, { day: "numeric", month: "short" })
              + " · "
              + now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

    const itemsHtml = items.length
      ? items.map((it) => {
          const name = String(it.name || it.name_snapshot || "—");
          const qty  = Number(it.qty  || 1);
          const lt   = Number(it.line_total || 0);
          return `<div class="rcptRow">
            <span class="rcptName">${_rcptEsc(name)}</span>
            <span class="rcptQty">×${qty}</span>
            <span class="rcptAmt">${_rcptMoney(lt)}</span>
          </div>`;
        }).join("")
      : `<div class="rcptEmpty">Empty check</div>`;

    back.innerHTML = `
      <div class="rcptModal" role="dialog" aria-modal="true">
        <button class="rcptClose" id="payCancel" aria-label="Close">✕</button>
        <div class="rcptBrand">Checki</div>
        <div class="rcptCheckNum">#${_rcptEsc(num)}</div>
        <div class="rcptGuest">${_rcptEsc(guest)}</div>
        <div class="rcptDash"></div>
        <div class="rcptItems">${itemsHtml}</div>
        <div class="rcptDash"></div>
        <div class="rcptBottom">
          <div class="rcptQRWrap"><div id="rcptQRCanvas" class="rcptQR"></div><div class="rcptQRLabel">${CHK.t("scan_to_view")}</div></div>
          <div class="rcptTotalWrap">
            <div class="rcptTotalLabel">${CHK.t("total")}</div>
            <div class="rcptTotalVal">${_rcptMoney(total)} ₾</div>
            <div class="rcptTs">${_rcptEsc(ts)}</div>
          </div>
        </div>
        <div class="rcptPayBtns">
          <button class="rcptBtnPay" id="payCash">${CHK.t("pay_cash")}</button>
          <button class="rcptBtnPay" id="payCard">${CHK.t("pay_card")}</button>
        </div>
      </div>
    `;
    back.classList.remove("hide");

    if (o.checkId && CHK.api)
      CHK.api(`/api/checks/${o.checkId}/receipt-token`, { method: "POST" })
        .then((r) => {
          const el = $("rcptQRCanvas");
          if (!el || !r.url || typeof QRCodeStyling === "undefined") return;
          new QRCodeStyling({
            type: "canvas",
            width: 160, height: 160, margin: 4, data: r.url,
            dotsOptions:          { type: "dots",          color: "#111" },
            cornersSquareOptions: { type: "extra-rounded", color: "#111" },
            cornersDotOptions:    { type: "dot",           color: "#111" },
            backgroundOptions:    { color: "#f7f5f0" },
          }).append(el);
        })
        .catch(() => {});

    return new Promise((resolve) => {
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        back.classList.add("hide");
        document.removeEventListener("keydown", onKey);
      };
      const finish = (val) => { cleanup(); resolve(val); };
      const onKey  = (e) => { if (e.key === "Escape") finish(null); };

      $("payCash").onclick   = () => finish("cash");
      $("payCard").onclick   = () => finish("card");
      $("payCancel").onclick = () => finish(null);
      back.onclick = (e) => { if (e.target === back) finish(null); };
      document.addEventListener("keydown", onKey);
      setTimeout(() => { try { $("payCash").focus(); } catch (_) {} }, 0);
    });
  };

  CHK.paymentConfirm = paymentConfirm;
})();
