/* admin/help.js — CHK.help: onboarding stories overlay */
(function () {
  'use strict';

  var SEEN_KEY = 'chk_help_seen';

  var SLIDES = [
    {
      title: 'Open a check',
      preview: [
        '<div class="hpTabBar">',
        '  <span class="hpTab">Open checks</span>',
        '  <span class="hpTab">Archive</span>',
        '  <span class="hpTabNew hpPulse">+ New</span>',
        '</div>',
        '<div class="hpArrow">↑ tap to start a new check</div>',
        '<div class="hpForm">',
        '  <div class="inp hpInpDemo">Table 7 / Ira</div>',
        '  <div class="hpFormBtn btn primary">Open check</div>',
        '</div>'
      ].join(''),
      tip: 'Enter any name for the table or guest. Next time the same name will be suggested automatically from history.'
    },
    {
      title: 'Add items',
      preview: [
        '<div class="hpBottom">',
        '  <div class="inp hpInpDemo">Khinkali</div>',
        '  <div class="hpRow2">',
        '    <div class="qtyCtl">',
        '      <div class="btn hpBtn">–</div>',
        '      <strong style="min-width:18px;text-align:center">2</strong>',
        '      <div class="btn hpBtn">+</div>',
        '    </div>',
        '    <div class="smallInp hpPriceDemo">12</div>',
        '    <div class="totalBox hpTotalDemo">24 ₾</div>',
        '    <div class="btn primary hpBtn">Add</div>',
        '  </div>',
        '</div>',
        '<div class="hpBadge">No catalog setup needed to start</div>'
      ].join(''),
      tip: 'Type the item name. If it\'s already in your catalog — the price fills in automatically. If it\'s new — enter the price once and it\'ll be saved for next time. Use – and + to set quantity.'
    },
    {
      title: 'Quick-add chips',
      preview: [
        '<div class="hpChips">',
        '  <div class="hpChip">Beer Draft</div>',
        '  <div class="hpChip">Whisky</div>',
        '  <div class="hpChip hpChipActive">Khinkali</div>',
        '</div>',
        '<div class="hpArrow">↑ tap a chip — name fills instantly</div>',
        '<div class="hpStarRow">',
        '  <div class="hpStarItem">',
        '    <span>Beer Draft</span>',
        '    <div style="display:flex;align-items:center;gap:10px;margin-left:auto">',
        '      <span class="muted" style="font-size:13px">4.00 ₾</span>',
        '      <span class="hpStar hpPulse">★</span>',
        '      <span class="muted" style="font-size:16px">›</span>',
        '    </div>',
        '  </div>',
        '  <div class="hpArrow" style="margin-top:6px">↑ tap ★ in Catalog — product appears as a chip</div>',
        '</div>'
      ].join(''),
      tip: 'Tap a chip and the item name fills in instantly — no typing needed. To add a product to chips, open Catalog and tap ★ next to it.'
    },
    {
      title: 'Close a check',
      preview: [
        '<div class="hpReceipt">',
        '  <div class="hpReceiptHead">Table 7 · #42</div>',
        '  <div class="hpReceiptItems">',
        '    <div class="hpReceiptRow"><span>Beer Draft × 3</span><span>12.00</span></div>',
        '    <div class="hpReceiptRow"><span>Khinkali × 4</span><span>24.00</span></div>',
        '  </div>',
        '  <div class="hpReceiptTotal">36.00 ₾</div>',
        '  <div class="hpPayBtns">',
        '    <div class="btn primary hpPayBtn">💵 Cash</div>',
        '    <div class="btn primary hpPayBtn">💳 Card</div>',
        '  </div>',
        '</div>'
      ].join(''),
      tip: 'Tap "Close" on the check or directly from the open checks list. A receipt preview appears — choose the payment method and the check moves to Archive.'
    },
    {
      title: 'Archive & stats',
      preview: [
        '<div class="hpArch">',
        '  <div class="hpArchFilters">',
        '    <div class="btn archQuick hpArchActive">Today</div>',
        '    <div class="btn archQuick">Week</div>',
        '    <div class="btn archQuick">30 days</div>',
        '    <div class="btn archQuick">All</div>',
        '  </div>',
        '  <div class="hpStats">',
        '    <div class="hpStat"><div class="muted" style="font-size:11px">Checks</div><div class="hpStatVal">12</div></div>',
        '    <div class="hpStat"><div class="muted" style="font-size:11px">Revenue</div><div class="hpStatVal">486 ₾</div></div>',
        '    <div class="hpStat"><div class="muted" style="font-size:11px">Avg</div><div class="hpStatVal">40.5</div></div>',
        '    <div class="hpStat"><div class="muted" style="font-size:11px">Top item</div><div class="hpStatVal" style="font-size:14px">Beer ×28</div></div>',
        '  </div>',
        '</div>'
      ].join(''),
      tip: 'All closed checks are here. Filter by date, view stats for any period, and download a PDF report.'
    }
  ];

  var current = 0;
  /** @type {HTMLElement|null} */
  var overlayEl = null;
  var keysBound = false;

  function buildOverlay() {
    var el = document.createElement('div');
    el.id = 'helpOverlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('hidden', '');
    el.innerHTML =
      '<div class="helpModal">' +
        '<div class="helpHead">' +
          '<span class="helpHeadTitle">How to use</span>' +
          '<button class="helpCloseBtn" id="helpCloseBtn" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="helpBody">' +
          '<div class="helpSlidesWrap" id="helpSlidesWrap"></div>' +
        '</div>' +
        '<div class="helpFoot">' +
          '<button class="helpNavBtn" id="helpPrev" aria-label="Previous">←</button>' +
          '<div class="helpDots" id="helpDots"></div>' +
          '<button class="helpNavBtn" id="helpNext" aria-label="Next">→</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function renderSlides() {
    var wrap = document.getElementById('helpSlidesWrap');
    var dots = document.getElementById('helpDots');
    if (!wrap || !dots) return;
    wrap.innerHTML = SLIDES.map(function (s, i) {
      return '<div class="helpSlide' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '">' +
        '<div class="helpPreview">' + s.preview + '</div>' +
        '<div class="helpSlideTitle">' + s.title + '</div>' +
        '<div class="helpSlideTip">' + s.tip + '</div>' +
        '</div>';
    }).join('');
    dots.innerHTML = SLIDES.map(function (_, i) {
      return '<button class="helpDot' + (i === 0 ? ' on' : '') + '" data-idx="' + i + '" aria-label="Slide ' + (i + 1) + '"></button>';
    }).join('');
  }

  function goTo(idx) {
    current = Math.max(0, Math.min(SLIDES.length - 1, idx));
    document.querySelectorAll('.helpSlide').forEach(function (el, i) {
      el.classList.toggle('active', i === current);
    });
    document.querySelectorAll('.helpDot').forEach(function (el, i) {
      el.classList.toggle('on', i === current);
    });
    var prev = document.getElementById('helpPrev');
    var next = document.getElementById('helpNext');
    if (prev) prev.disabled = (current === 0);
    if (next) next.disabled = (current === SLIDES.length - 1);
  }

  function show() {
    if (!overlayEl) {
      overlayEl = buildOverlay();
      renderSlides();
      var closeBtn = document.getElementById('helpCloseBtn');
      var prevBtn  = document.getElementById('helpPrev');
      var nextBtn  = document.getElementById('helpNext');
      var dotsEl   = document.getElementById('helpDots');
      if (closeBtn) closeBtn.addEventListener('click', hide);
      if (prevBtn)  prevBtn.addEventListener('click', function () { goTo(current - 1); });
      if (nextBtn)  nextBtn.addEventListener('click', function () { goTo(current + 1); });
      if (dotsEl)   dotsEl.addEventListener('click', function (e) {
        var btn = /** @type {HTMLElement} */ (e.target);
        if (btn && btn.classList.contains('helpDot')) goTo(Number(btn.dataset.idx));
      });
      overlayEl.addEventListener('click', function (e) {
        if (e.target === overlayEl) hide();
      });
      var touchStartX = 0;
      overlayEl.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; }, { passive: true });
      overlayEl.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 50) goTo(dx < 0 ? current + 1 : current - 1);
      });
    }
    current = 0;
    goTo(0);
    overlayEl.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function hide() {
    if (!overlayEl) return;
    overlayEl.setAttribute('hidden', '');
    document.body.style.overflow = '';
    localStorage.setItem(SEEN_KEY, '1');
  }

  function onKey(/** @type {KeyboardEvent} */ e) {
    if (!overlayEl || overlayEl.hasAttribute('hidden')) return;
    if (e.key === 'Escape')      hide();
    if (e.key === 'ArrowLeft')   goTo(current - 1);
    if (e.key === 'ArrowRight')  goTo(current + 1);
  }

  // Wire up the ? button click — always, as soon as the script loads
  function wireBtn() {
    var btn = document.getElementById('btnHelp');
    if (btn) btn.addEventListener('click', show);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireBtn);
  } else {
    wireBtn();
  }

  // Called after successful login only
  function init() {
    if (!keysBound) {
      document.addEventListener('keydown', onKey);
      keysBound = true;
    }
    if (!localStorage.getItem(SEEN_KEY)) show();
  }

  window.CHK = window.CHK || {};
  window.CHK.help = { show: show, hide: hide, init: init };
})();
