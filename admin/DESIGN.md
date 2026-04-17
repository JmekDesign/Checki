# Checki Admin UI — Design System

Mobile-first dark UI. Target: iPhone Safari. Max content width 720px.
All styles live in `app.css`. No external CSS frameworks.

---

## Colors (CSS variables)

| Variable    | Value       | Usage                          |
|-------------|-------------|--------------------------------|
| `--bg`      | `#0b0d10`   | Page background                |
| `--card`    | `#12151b`   | Card / panel surface           |
| `--text`    | `#e8eef6`   | Primary text                   |
| `--muted`   | `#9aa4b2`   | Secondary text, labels, hints  |
| `--line`    | `#232a35`   | Dividers, stat card borders    |
| `--accent`  | `#49d17c`   | Green — primary CTA, totals, active states |
| `--danger`  | `#ff5a6a`   | Red — destructive actions, close check |
| `--shadow`  | `0 10px 30px rgba(0,0,0,.35)` | Card / modal shadow |
| `--r`       | `16px`      | Default border radius          |

### Common rgba patterns
- Surface overlay: `rgba(255,255,255,.06)` (inputs, buttons, items)
- Border: `rgba(255,255,255,.08–.14)` (cards, inputs, modals)
- Accent tint bg: `rgba(73,209,124,.16)` with border `rgba(73,209,124,.32)`
- Danger tint bg: `rgba(255,90,106,.14)` with border `rgba(255,90,106,.28)`
- Warning (scan): `rgba(255,170,0,.08)` bg + `#f0a500` left border

---

## Typography

- Font: `system-ui, -apple-system, Segoe UI, Roboto, Arial` (system stack)
- `.h1` — 22px, page titles
- Item names (`.lineTitle b`) — 16px, bold
- Meta / labels — 12–13px, `var(--muted)`
- Prices / totals — 16px bold; large total on check — accent color, ~24px

---

## Layout

```
.wrap          — max-width 720px, centered, padding 16px 14px, bottom 220px
.topWrap       — sticky top nav (top bar + tab bar), blurred background
.bottom        — fixed bottom bar (add-item form), z-index 30
```

Content scrolls between topWrap and bottom bar.
Bottom padding on `.wrap` (`220px`) prevents last item hiding behind bottom bar.

---

## Core Components

### Button — `.btn`

```html
<button class="btn">Default</button>
<button class="btn primary">Primary (green tint)</button>
<button class="btn danger">Danger (red tint)</button>
<button class="btn compact">Compact (less padding)</button>
```

- Default: dark glass, `rgba(255,255,255,.06)` bg
- Primary: green tint — use for confirm / save
- Danger: red tint — use for close check / delete
- Disabled: `opacity:.45`, `pointer-events:none`
- Active: `translateY(1px)` — tactile feedback

### Icon button — `.btnIcon`

```html
<button class="btnIcon">⚙</button>
<button class="btnIcon btnIconDanger">→</button>
```

Used in the top bar only. No border, no background. Tap area padded.

### Input — `.inp`

```html
<input class="inp" type="text" placeholder="…" />
```

- Full width by default (`width:100%`)
- `border-radius:14px`, `padding:12px`, `font-size:16px` (prevents iOS zoom)
- For narrow inline inputs: `.smallInp` (90px wide)
- For read-only total display: `.totalBox`

**Always use `font-size:16px` on inputs** — smaller values trigger iOS auto-zoom.

### Card — `.card`

```html
<div class="card">…</div>
<div class="card cardless">…</div>  <!-- no bg/border, just padding -->
```

Screens are wrapped in `.card`. `#screenCheck` and `#screenOpen` use `.cardless` (transparent, more space).

### Divider — `.hr`

```html
<div class="hr"></div>
```

1px line, `rgba(255,255,255,.08)`, margin 12px.

### Muted text — `.muted`

```html
<span class="muted">Secondary info</span>
```

### Row layout — `.row`

```html
<div class="row">…</div>  <!-- flex, gap:10px, flex-wrap, align-items:center -->
```

---

## List Items — `.item`

```html
<div class="list">
  <div class="item">
    <div class="lineLeft">
      <div class="lineTitle"><b>Product name</b></div>
      <div class="lineMeta">
        <span>2</span><span>×</span><span>17.00 ₾</span>
      </div>
    </div>
    <div class="lineRight">
      <div class="lineTotal">34.00 ₾</div>
      <div class="qtyCtl">
        <button class="btn" data-act="dec">–</button>
        <strong>2</strong>
        <button class="btn" data-act="inc">+</button>
      </div>
    </div>
  </div>
</div>
```

- `.lineTitle b` — truncates with ellipsis on overflow
- `.lineMeta span` — 12px muted
- `.qtyCtl button` — 34×34px, `border-radius:10px`

### Scan warning state (low confidence)

```javascript
el.style.cssText = "background:rgba(255,170,0,0.08);border-left:2px solid #f0a500;cursor:pointer";
// badge inside .lineTitle:
'<span style="color:#f0a500;font-size:11px">⚠ check</span>'
```

---

## Modals

All modals use the same two-layer pattern:

```html
<div class="modalBack hide" id="myModalBack">      <!-- overlay, flex center -->
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="myTitle">
    <div class="modalTitle" id="myTitle">Title</div>
    <div class="modalText">Optional description in muted style</div>

    <!-- form fields if needed -->
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
      <input class="inp" type="text" placeholder="Field" />
    </div>

    <div class="modalBtns">                         <!-- right-aligned, gap:10px -->
      <button class="btn" id="myCancel">Cancel</button>
      <button class="btn primary" id="myOk">OK</button>
    </div>
  </div>
</div>
```

**Rules:**
- Modal width: `min(92vw, 520px)` — fills screen on mobile
- Fields always stack **vertically** (column flex) — no horizontal rows
- Cancel left, confirm right in `.modalBtns`
- Close on backdrop click: `if (e.target === back) back.classList.add("hide")`
- Always `aria-modal="true"` + `aria-labelledby`

### Special modal — Paper receipt (`.rcptModal`)

Light-themed (white background `#f7f5f0`, dark text `#111`). Used for payment flow.
Width: `min(92vw, 380px)`. Don't use `.modal` class — use `.rcptModal` directly.

---

## Navigation

### Top bar
- Left: brand logo + venue name
- Right: icon buttons (help `?`, logout `→`)
- Sticky, blurred background

### Tab bar
```
Open | Archive | [flex spacer] | [action button slot]
```
Active tab: `color:var(--text)`, `border-bottom: 2px solid var(--accent)`.

### Screen switching

Screens are hidden with `.hide`. `CHK.show(screenId, token)` in `ui.js` switches visibility.
Screen IDs: `screenLogin`, `screenOpen`, `screenNew`, `screenCheck`, `screenArchive`,
`screenVenue`, `screenCatalog`, `screenSupplies`, `screenStaff`.

---

## Bottom Bar (add-item form)

Fixed to bottom, `z-index:30`. Contains:
1. Text input (`#itemName`) — full width, typeahead
2. Row: qty `–/+`, price input (`.smallInp`), total display (`.totalBox`), Add button
3. Quick chips (`.chips`) — horizontal scroll, `border-radius:999px`

Safe area: `padding-bottom: calc(10px + env(safe-area-inset-bottom))`.

---

## Toast

```javascript
CHK.toast("Message");  // auto-dismisses after ~2.5s
```

Position: `bottom:148px` (above bottom bar), centered, pill shape.

---

## Suggest / Autocomplete (`.suggestBox`)

Appears **above** the input, not below. `position` not fixed — flows in document.
`max-height:34vh`, scrollable. Items: `.suggestItem` with name + price.

---

## Quick Chips

```html
<div class="chips">
  <button class="chip">Beer</button>
  <button class="chip">Hoegaarden</button>
</div>
```

Horizontal scroll, no scrollbar visible. `flex:0 0 auto` on each chip.

---

## Animations

- **Flash row** on qty change: `.flashRow` class (keyframe 900ms, white glow)
- **Tap feedback**: `btn:active { transform:translateY(1px) }`
- **Help pulse**: `hpPulse` keyframe (green glow, 1.8s loop)

---

## Archive / Read-only mode

Body gets `.chk-readonly` class. Effects:
- Bottom bar hidden
- Qty `+/–` buttons hidden, qty number stays visible
- Item list buttons `pointer-events:none`
- Back button remains functional

---

## JS Conventions

- All code in `CHK` namespace (`window.CHK`)
- API calls via `CHK.api(path, opts)` — handles auth header + base URL
- `CHK.toast(msg)` — show notification
- `CHK.confirm(opts)` — async confirm dialog `{ title, text, okText, cancelText, danger }`
- `$(id)` — shorthand for `document.getElementById`
- No inline `onclick` in HTML — always `addEventListener` in JS
- New screens/features get their own JS file, loaded in `main.js` via `await load("./feature.js")`

---

## Do / Don't

| Do | Don't |
|----|-------|
| Stack form fields vertically in modals | Put price + qty side by side |
| Use `class="inp"` for all text/number inputs | Use `class="input"` (wrong class name) |
| `font-size:16px` on inputs (prevents iOS zoom) | Use 14px or smaller on inputs |
| Use `var(--accent)` for positive/confirm actions | Hardcode `#49d17c` |
| Use `var(--danger)` for destructive actions | Hardcode red |
| Close modal on backdrop click | Require button click only |
| `flex-direction:column` in modal content | Horizontal flex in modals |
