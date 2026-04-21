# Checki — Design Principles & Migration Plan

> Документ фиксирует язык дизайна, решает противоречия и описывает стратегию
> безопасного перехода без поломок. Написан перед началом работы над кодом.

---

## 1. Дизайн-язык

### 1.1 CSS-токены

Два набора — `theme-dark` и `theme-light`. Тема вешается классом на `<body>`.

```css
/* Accent — зелёный, oklch */
--accent-h: 148;
--accent-s: 0.17;
--accent-l: 0.76;
--accent:         oklch(var(--accent-l) var(--accent-s) var(--accent-h));
--accent-soft:    oklch(var(--accent-l) var(--accent-s) var(--accent-h) / 0.16);
--accent-strong:  oklch(0.82 0.18 var(--accent-h));

/* Warn / Danger */
--warn:       oklch(0.78 0.14 75);
--warn-soft:  oklch(0.78 0.14 75 / 0.14);
--danger:     oklch(0.62 0.2 25);

/* Dark theme */
--bg-0: #000;
--bg-1: #0a0a0b;
--bg-wash: radial-gradient(ellipse 120% 80% at 20% 0%,
             oklch(0.22 0.05 148 / 0.22), transparent 60%),
           radial-gradient(ellipse 100% 70% at 80% 100%,
             oklch(0.2 0.04 260 / 0.25), transparent 60%),
           #050506;
--surface:        rgba(255,255,255,0.06);
--surface-strong: rgba(255,255,255,0.09);
--surface-hi:     rgba(255,255,255,0.14);
--hairline:        rgba(255,255,255,0.08);
--hairline-strong: rgba(255,255,255,0.14);
--text-0: #fff;
--text-1: rgba(255,255,255,0.92);
--text-2: rgba(235,235,245,0.6);
--text-3: rgba(235,235,245,0.32);
--shine-top: rgba(255,255,255,0.18);
--shine-bot: rgba(255,255,255,0.04);
```

### 1.2 Базовые классы

```css
/* Стекло — карточки, пиллы, строки */
.glass {
  background: var(--surface);
  backdrop-filter: blur(24px) saturate(180%);
  border: 0.5px solid var(--hairline);
  box-shadow: inset 0 0.5px 0 var(--shine-top),
              inset 0 -0.5px 0 var(--shine-bot),
              0 1px 2px rgba(0,0,0,0.06),
              0 8px 24px rgba(0,0,0,0.1);
}

/* Сильное стекло — AddBar, stats plate */
.glass-strong {
  background: var(--surface-strong);
  backdrop-filter: blur(40px) saturate(200%);
  border: 0.5px solid var(--hairline-strong);
  box-shadow: inset 0 1px 0 var(--shine-top),
              inset 0 -1px 0 var(--shine-bot),
              0 2px 6px rgba(0,0,0,0.1),
              0 12px 40px rgba(0,0,0,0.18);
}

/* Pressable — нажимаемые элементы */
.pressable {
  transition: transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.pressable:active { transform: scale(0.96); }

/* Типография */
.display  { font-size: 28px; font-weight: 700; letter-spacing: -0.04em; }
.title1   { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
.footnote { font-size: 12px; font-weight: 500; letter-spacing: 0.01em; color: var(--text-2); }
.tabular  { font-variant-numeric: tabular-nums; }
```

### 1.3 GlassPill — навигационные кнопки

Единственный тип кнопки для навигации во всём приложении. Заменяет все старые `.btn` nav-кнопки (`← Back`, `← Checks` и т.д.).

```css
.glassPill {
  /* базовый размер */
  height: 32px;
  min-width: 32px;
  border-radius: 16px;       /* height/2 */
  padding: 0 12px;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-1);

  /* + все свойства .glass (backdrop-filter, border, box-shadow) */
}

/* Тоны */
.glassPill.danger {
  background: oklch(0.3 0.15 25 / 0.35);
  border-color: oklch(0.5 0.2 25 / 0.5);
}
.glassPill.accent {
  background: var(--accent-soft);
  border-color: oklch(var(--accent-l) var(--accent-s) var(--accent-h) / 0.3);
}

/* Help pill — квадратный (36×36), без текста */
.glassPill.square {
  height: 36px;
  width: 36px;
  padding: 0;
}
```

**Стрелка назад внутри пилла:**
- Иконка `chevron-left`, size=**13**, color=`var(--text-2)`
- Текст рядом: `var(--text-1)`, 13px/600
- Пример: `[‹ Open checks]`  `[‹ Back]`

**Где какой пилл используется:**

| Экран | Пиллы | Выравнивание |
|---|---|---|
| Check screen | `[‹ Open checks]` слева + `[Close check]` danger справа | `justify-content: space-between` |
| Settings screen | `[‹ Open checks]` | `display: flex` (flex-start) |
| New check screen | `[‹ Back]` | `justify-content: flex-end` |
| VenueHeader | `[?]` square 36×36 (help) | крайний правый в хедере |

**Старые кнопки, которые заменяем:**

| Было | Стало |
|---|---|
| `<button class="btn">← Checks</button>` | `<button class="glassPill">‹ Open checks</button>` |
| `<button class="btn danger">Close</button>` | `<button class="glassPill danger">Close check</button>` |
| `<button class="btn">← Back</button>` | `<button class="glassPill">‹ Back</button>` |
| `<button class="btnIcon">?</button>` | `<button class="glassPill square">?</button>` |

### 1.4 Иконки (все SVG из icons.jsx)

Все иконки — stroke, `strokeWidth: 1.75`, `strokeLinecap: round`, `strokeLinejoin: round`, `fill: none`.
Исключения: `logo` (fill), `tag` (dot fill), `help` (dot fill), `warn` (no fill).

#### Логотип (`logo`) — viewBox `0 0 144.8 144.8`, fill (не stroke)

```html
<svg viewBox="0 0 144.8 144.8" width="26" height="26" aria-hidden="true">
  <path fill="currentColor" d="M74.9,127.9c-14.2,0-28.4-5.4-39.3-16.2-21.6-21.6-21.6-56.9,0-78.5,21.6-21.6,56.9-21.6,78.5,0l-17.2,17.2c-12.1-12.1-31.9-12.1-44,0-12.1,12.1-12.1,31.9,0,44,12.1,12.1,31.9,12.1,44,0l17.2,17.2c-10.8,10.8-25,16.2-39.3,16.2Z"/>
  <circle cx="74.9" cy="72.4" r="18.5" fill="#48d07b"/>
</svg>
```

#### Остальные иконки (stroke, strokeWidth=1.75)

| name | path |
|---|---|
| `gear` | circle r=3 + сложный gear path |
| `help` | circle r=9.5 + `M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5` + dot cx=12 cy=17 r=0.6 fill |
| `exit` | `M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3` + `M10 17l5-5-5-5M15 12H3` |
| `chevron-left` | `M15 18l-6-6 6-6` |
| `chevron-right` | `M9 18l6-6-6-6` |
| `close` | `M6 6l12 12M18 6L6 18` |
| `plus` | `M12 5v14M5 12h14` |
| `minus` | `M5 12h14` |
| `check` | `M4 12l5 5L20 6` |
| `warn` | `M12 3L2 20h20L12 3z` + `M12 10v4M12 17.5v0.1` |
| `trash` | `M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3` |
| `search` | circle cx=11 cy=11 r=7 + `M21 21l-4.5-4.5` |
| `clock` | circle r=9.5 + `M12 6v6l4 2` |
| `camera` | `M3 7h3l2-3h8l2 3h3a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1z` + circle cx=12 cy=13 r=4 |
| `receipt` | `M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z` + lines M8 8h8 / M8 12h8 / M8 16h4 |
| `sparkle` | `M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6` |
| `tag` | path + dot cx=7.5 cy=7.5 r=1.2 fill |
| `user` | circle cx=12 cy=8 r=4 + `M4 21a8 8 0 0116 0` |

### 1.5 VenueHeader

```
padding: 10px 14px   gap: 10px

[logo 26px] │ [Venue Name 22px/700][ ⚙ 20px pad:6 ] │ [? pill 36×36]
```

- Контейнер: `display:flex, alignItems:center, padding:10px 14px, gap:10`
- Логотип: `width:26, height:26, flexShrink:0, color:var(--text-0)` — hold 1500ms → easter egg
- Venue name + gear блок: `display:flex, alignItems:center, gap:2, flex:1, minWidth:0`
  - Название: `fontSize:22, fontWeight:700, letterSpacing:-0.03em, color:var(--text-0), whiteSpace:nowrap, overflow:hidden, textOverflow:ellipsis`
  - Gear кнопка: `border:0, background:transparent, padding:6, color:var(--text-2), display:flex, alignItems:center, flexShrink:0` + Icon `gear` size=20
- Help pill: GlassPill `size:36, pad:0, style:{width:36}` + Icon `help` size=20 color=`var(--text-2)`

### 1.6 Шрифт

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800
  &family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

```css
body {
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: 'ss01', 'cv11', 'cv03';
}
```

JetBrains Mono используется только в `.mono` классе (не в основном UI).

### 1.7 BgWash

Каждый экран имеет абсолютно позиционированный `div.bgWash` на z-index:0 с `background: var(--bg-wash)`. Контент поверх на z-index:1-2. `paddingTop:50` на контентном блоке чтобы учесть safe area / статус бар.

### 1.8 Анимации

```css
@keyframes slide-up-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes qty-bump {
  0%  { transform: scale(1); }
  40% { transform: scale(1.18); }
  100%{ transform: scale(1); }
}
@keyframes pop-in {
  0%  { opacity: 0; transform: scale(0.92); }
  60% { opacity: 1; transform: scale(1.02); }
  100%{ transform: scale(1); }
}
```

---

## 2. Детали компонентов (точные размеры из дизайна)

### 2.1 Stats plate

```
.glass-strong   borderRadius:16   padding:12px 4px
display:grid    gridTemplateColumns:1fr 1fr 1fr   gap:2

Каждая ячейка:
  textAlign:center
  borderLeft: 0.5px solid var(--hairline)  (2-я и 3-я)

Значение:
  fontSize:22   fontWeight:700   letterSpacing:-0.03em   tabular-nums
  color: var(--text-0)  — или var(--accent-strong) для Revenue

Метка:
  fontSize:11   fontWeight:500   letterSpacing:0.01em   color:var(--text-2)
  marginTop:2

На Settings screen: те же стили, fontSize значения: 20 (чуть меньше)
```

### 2.2 MainTabs (Open checks / Archive)

```
padding:0 18px 10px   gap:18   borderBottom:0.5px solid var(--hairline)

Активная вкладка:
  fontSize:20   fontWeight:700   letterSpacing:-0.03em   color:var(--text-0)
  + индикатор: position:absolute, left:0, right:0, bottom:-10.5px
                height:2, background:var(--accent), borderRadius:2

Неактивная вкладка:
  fontSize:20   fontWeight:500   color:var(--text-2)
```

### 2.3 Карточка открытого чека (OpenChecksList)

```
Кнопка "+ New check" (перед списком):
  width:100%   height:46   borderRadius:14   border:0
  background: linear-gradient(180deg,
    oklch(calc(var(--accent-l)+0.04) var(--accent-s) var(--accent-h)),
    var(--accent))
  color:#0a0f0a   fontWeight:700   fontSize:15   letterSpacing:-0.01em
  boxShadow: 0 4px 20px oklch(.../0.35), inset 0 0.5px 0 rgba(255,255,255,0.4)
  icon: plus size=16 color=#0a0f0a   gap:6

Список: padding:0 14px 20px   display:flex flexDirection:column   gap:8

Карточка чека (.glass):
  borderRadius:16   padding:12px 14px
  display:flex   alignItems:center   gap:10
  backgroundColor:var(--surface-hi)
  animation: slide-up-in 0.32s cubic-bezier(0.32,0.72,0,1) {i*30ms} backwards

  Левая часть (flex:1, minWidth:0):
    Строка 1 (whiteSpace:nowrap, overflow:hidden):
      #номер:  fontSize:11   fontWeight:600   color:var(--accent-strong)   tabular
      ·        fontSize:11   color:var(--text-3)
      Гость:   fontSize:15   fontWeight:600   letterSpacing:-0.01em   text-0
               flex:1, minWidth:0, overflow:hidden, textOverflow:ellipsis
    Строка 2 (footnote, gap:6, whiteSpace:nowrap):
      Официант · N items · HH:MM   (цвет var(--text-2), fontSize:12)

  Правая часть (flexShrink:0, whiteSpace:nowrap, textAlign:right):
    Сумма: fontSize:17   fontWeight:700   letterSpacing:-0.03em   tabular
    ₾:     fontSize:11   color:var(--text-2)

  ✕ кнопка (наше решение, не из дизайна):
    Круглая: width:28 height:28 borderRadius:14
    background:transparent   border:0.5px solid var(--hairline)
    color:var(--text-3)   display:flex alignItems:center justifyContent:center
    icon: close size=14
    При нажатии → подтверждение оплаты
```

### 2.4 Check screen

```
GlassPill-навигация:
  padding:0 14px 4px   display:flex   justifyContent:space-between
  [← Open checks]  — обычный GlassPill (height:32), СЛЕВА
    icon: chevron-left size=13 color=var(--text-2) + текст "Open checks"
  [Close check]     — GlassPill.danger (height:32), СПРАВА
  (наше решение: в дизайне оба были flex-end, но space-between логичнее)

Check header:
  padding:4px 18px 14px
  display:flex   alignItems:flex-end   justifyContent:space-between   gap:12

  Левая часть (flex:1, minWidth:0):
    Строка 1:
      #N:    fontSize:15   fontWeight:600   color:var(--text-2)   tabular
      Гость: .display (fontSize:28, fontWeight:700, letterSpacing:-0.04em)
             color:var(--text-0), whiteSpace:nowrap, overflow:hidden, textOverflow:ellipsis
    Строка 2 (marginTop:4, gap:6, whiteSpace:nowrap):
      icon:clock size=13 color=var(--text-2)
      "opened HH:MM"  — footnote tabular
      · N items       — footnote

  Правая часть — Total pill (flexShrink:0):
    padding:6px 12px   borderRadius:10
    background:var(--accent-soft)
    border:0.5px solid oklch(var(--accent-l) var(--accent-s) var(--accent-h)/0.3)
    boxShadow:inset 0 0.5px 0 rgba(255,255,255,0.08)
    animation: qty-bump на изменение суммы
    Сумма: fontSize:26   fontWeight:700   letterSpacing:-0.04em   color:var(--accent-strong)   tabular
    ₾:     fontSize:14   fontWeight:700   color:var(--accent-strong)
```

### 2.5 ItemRow (строка в чеке)

```
Контейнер: position:relative   borderRadius:18   overflow:hidden

За строкой (delete reveal):
  position:absolute inset:0   justifyContent:flex-end   alignItems:stretch
  Кнопка Delete: width:100   background:gradient(red→red)
    icon:trash size=16 + "Delete"   fontWeight:600 fontSize:13

Сама строка (.glass):
  borderRadius:18   padding:11px 14px
  display:flex   alignItems:center
  swipe: translateX(0..-100px)   transition: 0.32s cubic-bezier(0.32,0.72,0,1)
  animation: slide-up-in 0.36s {index*40ms} both

  ⚠ warn badge (только needsCheck):
    width:22 height:22 borderRadius:11
    background:oklch(0.78 0.14 75)   color:#3a2a00
    icon:warn size=12 color=#3a2a00   marginRight:10
    boxShadow:0 0 12px oklch(0.78 0.14 75 / 0.5)

  Название (flex:1, minWidth:0, gap:2):
    fontSize:16   fontWeight:600   letterSpacing:-0.02em   color:var(--text-0)
    whiteSpace:nowrap   overflow:hidden   textOverflow:ellipsis

  Qty × price (footnote tabular, whiteSpace:nowrap):
    Цена — underline dotted (tap → inline edit input)

  Total + stepper (gap:10, flexShrink:0):
    Total: fontSize:19   fontWeight:700   letterSpacing:-0.03em   color:var(--text-0)   tabular
           animation: qty-bump при изменении
    ₾:     fontSize:12   fontWeight:600   color:var(--text-2)
    QuantityStepper size=26

QuantityStepper:
  display:flex   alignItems:center   gap:10
  Кнопки: width:26 height:26 borderRadius:13
    background:var(--surface-strong) (или --surface если disabled)
    boxShadow:inset 0 0.5px 0 var(--shine-top)
    border:0.5px solid var(--hairline-strong)
    icon:minus/plus size=12
  Число: fontSize:14   fontWeight:600   tabular   minWidth:16   textAlign:center
```

### 2.6 AddBar (нижняя панель добавления)

```
Контейнер (.glass-strong):
  borderRadius:22   padding:12   display:flex flexDirection:column   gap:10

Строка 1 — поиск:
  display:flex   alignItems:center   gap:10
  icon:search size=16 color=var(--text-2) style:{marginLeft:4}
  input: flex:1   background:transparent   border:0   outline:none
         fontSize:15   fontWeight:500   letterSpacing:-0.01em   color:var(--text-0)
         placeholder: "Add item…"

Строка 2 — qty + price + add:
  display:flex   alignItems:center   gap:6

  QuantityStepper size=26 (min:1)

  Price pill (.glass):
    flex:1   height:32   borderRadius:9   padding:0 10px
    display:flex   alignItems:center   gap:4   minWidth:0
    "per":   fontSize:10   fontWeight:600   textTransform:uppercase
             letterSpacing:0.3   color:var(--text-3)   whiteSpace:nowrap
    input:   flex:1   background:transparent   border:0   outline:none
             fontSize:14   fontWeight:600   textAlign:right   tabular-nums
             color:var(--text-0)   minWidth:0
    "₾":     fontSize:12   fontWeight:600   color:var(--text-2)

  Add кнопка:
    height:32   borderRadius:9   padding:0 12px   flexShrink:0   minWidth:58
    Активная:   background:var(--accent)   color:#0a0f0a   fontWeight:700 fontSize:13
                boxShadow:0 4px 16px oklch(.../0.4), inset 0 0.5px 0 rgba(255,255,255,0.4)
    Неактивная: background:var(--surface)   color:var(--text-3)

Running total (когда qty>1 и цена введена):
  display:flex gap:6   padding:0 6px   color:var(--text-2)   fontSize:11
  "N × P₾ ="   +   total: color:var(--accent-strong) fontWeight:700 fontSize:13 tabular

Quick chips (горизонтальный скролл, noscrollbar):
  gap:6   paddingBottom:2   marginLeft:-2 marginRight:-2
  Чип (.glass): borderRadius:999   padding:7px 12px
    color:var(--text-1)   fontSize:13   fontWeight:500   letterSpacing:-0.01em
    whiteSpace:nowrap   flexShrink:0   background:var(--surface)
    Цена в чипе: color:var(--text-2)   marginLeft:6   fontSize:11
```

### 2.7 New Check screen

```
VenueHeader
GlassPill [← Back] (один, не "← Open checks"):
  padding:0 14px 4px   display:flex   justifyContent:flex-end

Карточка (.glass-strong):
  borderRadius:22   padding:20   display:flex flexDirection:column   gap:14
  animation:slide-up-in 0.32s

  Заголовок: fontSize:26   fontWeight:700   letterSpacing:-0.03em
  Подзаголовок: footnote "Guest / table"

  Input (.glass):
    borderRadius:12   padding:0 14px   height:48
    background:var(--surface-strong)
    input: fontSize:16   fontWeight:500

  Suggestion chips: border:0.5px hairline   padding:6px 12px   borderRadius:999
    background:var(--surface)   color:var(--text-2)   fontSize:12   fontWeight:500

  Open check button:
    height:44   borderRadius:12   fontWeight:700   fontSize:15
    Активная: background:var(--accent)   color:#0a0f0a + glow

  Разделитель "or": hairline + footnote

  Scan button (.glass):
    height:52   borderRadius:14   padding:0 14px   gap:10
    color:var(--text-0)   fontSize:15   fontWeight:600
    icon:camera size=20 color=var(--text-1) + "Scan paper check"

  Footnote под кнопкой: textAlign:center   lineHeight:1.4   color:var(--text-2)
```

### 2.8 Settings screen (Venue)

```
VenueHeader (onSettings — no-op, шестерёнка не реагирует)
GlassPill [← Open checks] — один, выровнен ВЛЕВО:
  padding:0 14px 10px   display:flex  (без justifyContent — flex-start по умолчанию)

Stats plate (glass-strong, borderRadius:16, fontSize значений: 20)

SettingsGroup (margin-bottom:14):
  Заголовок группы:
    padding:4px 18px 6px   textTransform:uppercase
    fontSize:11   fontWeight:600   letterSpacing:0.5   color:var(--text-2)
    + action (кнопка "+ Add") справа

  Тело группы (.glass):
    margin:0 14px   borderRadius:16   overflow:hidden

SettingsRow (строка в группе):
  padding:11px 14px   gap:12   display:flex   alignItems:center

  Иконка-бейдж: width:30 height:30 borderRadius:8   background:gradient
    boxShadow:inset 0 0.5px 0 var(--shine-top)
    Icon size=15 color=#fff

  Контент (flex:1, minWidth:0):
    Название: fontSize:15   fontWeight:600   letterSpacing:-0.01em
    Подзаголовок (detail): footnote   marginTop:1

  Справа: chevron-right size=14 color=var(--text-3)
    или ThemeToggle
    или role badge

  Разделитель (не на последнем): height:0.5 hairline
    left: 56px (если есть иконка) или 14px

StaffRow (строка сотрудника):
  padding:12px 14px   gap:10

  Имя: fontSize:15   fontWeight:600   letterSpacing:-0.01em
  Role badge: fontSize:9.5   fontWeight:700   letterSpacing:0.4   textTransform:uppercase
    padding:2px 6px   borderRadius:4
    MANAGER: background:var(--accent-soft)   color:var(--accent-strong)
    STAFF:   background:var(--surface-hi)    color:var(--text-2)
    border:0.5px solid var(--hairline)

  Login: footnote   marginTop:2

  Online dot (если online): width:9 height:9 borderRadius:5
    background:oklch(0.78 0.18 142)
    boxShadow:0 0 0 2px oklch(0.78 0.18 142 / 0.22)

  chevron-right size=14 color=var(--text-3)

ThemeToggle:
  background:var(--surface-hi)   padding:2px   borderRadius:9
  border:0.5px solid var(--hairline)
  Кнопки: padding:5px 10px   borderRadius:7   fontSize:12   fontWeight:600
  Активная: background:var(--surface-strong)   color:var(--text-0)
    boxShadow:inset 0 0.5px 0 var(--shine-top), 0 1px 2px rgba(0,0,0,0.1)

Версия (footer): padding:4px 18px 0   color:var(--text-3)   fontSize:11   lineHeight:1.4
```

### 2.9 Archive screen

```
Search (.glass): height:38   borderRadius:11   padding:0 12px
  icon:search size=15 + input fontSize:14

Filter pills (horizontal scroll, gap:6):
  Активный: background:var(--accent-soft)   color:var(--accent-strong)
    border:0.5px solid oklch(.../0.3)
  Неактивный: background:var(--surface)   color:var(--text-1)
    border:0.5px solid var(--hairline)
  padding:7px 14px   borderRadius:999   fontSize:13   fontWeight:600

Date row: два .glass блока (flex:1, padding:8px 12px, borderRadius:10, textAlign:center, fontSize:13)
  + PDF кнопка: height:34 borderRadius:10 padding:0 14px background:accent color:#0a0f0a

Stats plate (archive): borderRadius:14   fontSize значений:19   color:var(--accent-strong)

Top items card (.glass): padding:12   borderRadius:14
  "Top items" — footnote + items text fontSize:13 fontWeight:500

Группа по дню:
  Заголовок: footnote uppercase fontSize:11 letterSpacing:0.4 marginTop:8 marginBottom:6 paddingLeft:4

Карточка архивного чека (.glass): padding:10px 14px   borderRadius:14
  Номер: color:var(--text-2) fontWeight:600 fontSize:14
  Гость: fontSize:14 fontWeight:600 letterSpacing:-0.01em
  Время · метод: footnote marginTop:2
  Сумма: fontSize:16 fontWeight:700 letterSpacing:-0.03em tabular
```

---

## 3. Карта экранов: дизайн ↔ продакшен

| Дизайн-экран | Продакшен ID | Статус |
|---|---|---|
| MainScreen (Open checks + Archive tabs) | `screenOpen` + `screenArchive` | Объединить визуально |
| CheckScreen | `screenCheck` | Рестайлинг |
| NewCheckScreen | `screenNew` | Рестайлинг |
| SettingsScreen | `screenVenue` | Рестайлинг |
| —нет в дизайне— | `screenLogin` / `screenForgot` / `screenReset` | Без изменений |
| —нет в дизайне— | `screenCatalog` / `screenSupplies` | Только токены |

---

## 3. Системные сообщения и модальные окна

### 3.1 Цветовая система сообщений

Всё строится на одном паттерне — как баннер подтверждения скана в check screen.
Четыре типа, цвет задаётся тремя переменными: фон / бордер / текст.

```
Тип        Фон (oklch)                    Бордер                         Текст / иконка
────────────────────────────────────────────────────────────────────────────────────────
neutral    var(--surface-hi)              var(--hairline-strong)          text-1 / —
success    oklch(0.5 0.14 148 / 0.12)    oklch(0.7 0.14 148 / 0.28)     oklch(0.88 0.14 148) / check
warning    oklch(0.5 0.14 75 / 0.12)     oklch(0.7 0.14 75 / 0.28)      oklch(0.88 0.14 75)  / warn
error      oklch(0.5 0.2 25 / 0.12)      oklch(0.7 0.2 25 / 0.28)       oklch(0.88 0.2 25)   / warn или close
```

Зелёный (148) = accent = успех. Янтарный (75) = предупреждение. Красный (25) = ошибка/опасность.

---

### 3.2 Toast (мимолётное уведомление)

**Текущее**: просто текст, одно состояние, нет иконки.

**Новое**: пилюля снизу по центру, цветная, с иконкой, auto-dismiss 2.5s.

```
Форма:
  position: fixed   bottom: 24px   left: 50%   transform: translateX(-50%)
  display: inline-flex   align-items: center   gap: 8
  padding: 10px 16px   border-radius: 999px
  font-size: 14px   font-weight: 600   letter-spacing: -0.01em
  white-space: nowrap
  z-index: 9999
  animation: slide-up-in 0.28s   fade-out при исчезновении

Варианты (CSS-классы или data-type):
  .toast-neutral  — .glass-strong + text-1 (без иконки)
  .toast-success  — зелёный фон/бордер + icon:check size=15
  .toast-warning  — янтарный фон/бордер + icon:warn size=15
  .toast-error    — красный фон/бордер + icon:warn size=15

Типичное применение:
  toast("Added")               → success
  toast("Check closed")        → success
  toast("Saved")               → success
  toast("Deleted")             → neutral
  toast("Read-only")           → warning
  toast("Login error: ...")    → error
  toast("Close error: ...")    → error

API расширяем:
  CHK.toast("Saved")                         → success (строка = success по умолчанию)
  CHK.toast("Error: ...", "error")           → error
  CHK.toast("Read-only", "warning")          → warning
  CHK.toast("Logged out", "neutral")         → neutral
```

---

### 3.3 Inline banner (встроенное сообщение в экране)

Тот же паттерн что и баннер скана в check screen. Используется внутри модалок (ошибки формы) и на экранах.

```
display: flex   align-items: center   gap: 8
padding: 8px 12px   border-radius: 12
font-size: 12.5px   font-weight: 500
border: 0.5px solid {бордер типа}
background: {фон типа}
color: {текст типа}
animation: slide-up-in 0.32s ease both

[icon size=14]  Текст сообщения

Использование в модалках: вместо alert/toast для ошибок валидации формы
(пример: поле "Name and login required" — красный баннер внутри модалки)
```

---

### 3.4 Confirm modal (подтверждение действия)

**Текущее**: `.modal` в HTML, стандартный стиль.

**Новое**: glass-strong, скруглённый, кнопки как GlassPill.

```
Backdrop:
  position: fixed   inset: 0   z-index: 500
  background: rgba(0,0,0,0.5)
  backdrop-filter: blur(8px)
  display: flex   align-items: flex-end   justify-content: center
  padding-bottom: 20px
  (появляется снизу — как шит на iOS)

Контейнер (.glass-strong):
  width: min(92vw, 400px)
  border-radius: 22px
  padding: 20px
  animation: slide-up-in 0.32s cubic-bezier(0.32, 0.72, 0, 1)

Заголовок:
  font-size: 19px   font-weight: 700   letter-spacing: -0.03em
  margin-bottom: 6px

Текст:
  font-size: 14px   color: var(--text-2)   line-height: 1.4
  margin-bottom: 18px

Кнопки (display:flex, gap:8, margin-top:0):
  Для danger: [Cancel (glassPill regular)]  [Действие (glassPill.danger)]
  Для normal: [Cancel (glassPill regular)]  [OK (glassPill.accent)]
  justify-content: flex-end
```

---

### 3.5 Форма-модалка (staff, scan edit, catalog product)

Один шаблон для всех модалок с полями ввода.

```
Backdrop: то же что confirm (blur overlay, slide from bottom)

Контейнер (.glass-strong):
  width: min(92vw, 420px)
  border-radius: 22px
  padding: 20px
  display: flex   flex-direction: column   gap: 14px

Заголовок: font-size: 19px / 700 / letter-spacing: -0.03em

Поля (display:flex, flex-direction:column, gap:10):
  Input (.glass):
    height: 44px   border-radius: 10px   padding: 0 14px
    font-size: 15px   font-weight: 500   color: var(--text-0)
    background: transparent (glass даёт фон)
    border: none (glass даёт бордер)
    outline: none
    ::placeholder → color: var(--text-3)

  Readonly input: opacity: 0.5

  Checkbox-строка (Manager / Active):
    display: flex   align-items: center   gap: 10
    font-size: 14px   cursor: pointer   padding: 4px 0
    checkbox: width:18 height:18 accent-color:var(--accent)

  Inline error banner: красный тип, появляется при ошибке

Кнопки (display:flex, justify-content:space-between, margin-top:4):
  Слева (если есть): [Delete] (glassPill.danger)
  Справа: [Cancel] (glassPill regular) + [Save/Create] (glassPill.accent), gap:8
```

---

### 3.6 Receipt modal (оплата чека)

```
Backdrop: то же (blur overlay)

Контейнер: .glass-strong   border-radius: 22px   padding: 20px
  width: min(92vw, 360px)

Шапка:
  Логотип Checki (новый SVG, 22px, color: var(--text-0))   margin-bottom: 8px
  #номер: font-size:22 / 700 / tabular / accent-strong
  Гость: font-size:15 / 500 / text-2   margin-bottom: 12px

Разделитель: dashed line — height:0, border-top:1.5px dashed var(--hairline-strong)

Items list (margin: 12px 0):
  Каждая строка: display:flex, gap:6
    Название: flex:1   font-size:13 / 500
    ×qty:     font-size:12   color:var(--text-3)   tabular
    Сумма:    font-size:13 / 600   tabular   min-width:40   text-align:right

Разделитель

Итого:
  "Total": font-size:12 / 600 / uppercase / letter-spacing:0.5 / text-2
  Сумма:   font-size:28 / 700 / tabular / accent-strong / letter-spacing:-0.04em
  Время:   font-size:11 / text-3   margin-bottom: 16px

Разделитель

Кнопки оплаты (display:flex, gap:8, margin-bottom:10):
  [💵 Cash] и [💳 Card] — оба glassPill, height:46, border-radius:14
    Cash:  обычный glass
    Card:  glassPill.accent (зелёный)
    font-size:15 / 700   gap:8   width:100% (flex:1)

[Don't close]: отдельная строка, glassPill regular, width:100%, height:40
  font-size:13 / color:text-2
```

---

### 3.7 Сводка: когда что использовать

| Ситуация | Компонент |
|---|---|
| Действие выполнено (add, save, close) | Toast success |
| Ошибка сети / API | Toast error |
| Предупреждение (readonly, scan needed) | Toast warning или inline banner |
| Нейтральное (logout, info) | Toast neutral |
| Ошибка в форме (поле пустое) | Inline error banner внутри модалки |
| Подтверждение опасного действия | Confirm modal (danger) |
| Подтверждение обычного действия | Confirm modal (normal) |
| Редактирование записи | Форма-модалка |
| Закрытие чека | Receipt modal |

---

## 4. Help Stories (онбординг-оверлей)

### 4.1 Структура оверлея (сохраняем из дизайна)

```
Backdrop (position:absolute inset:0 z-index:100):
  background: linear-gradient(180deg,
    oklch(0.22 0.07 142 / 0.96),   ← тёмно-зелёный вверху
    oklch(0.14 0.05 142 / 0.98))   ← ещё темнее внизу
  backdrop-filter: blur(20px) saturate(160%)
  animation: slide-up-in 0.32s

Пунктирная рамка (визуально отделяет от интерфейса):
  position:absolute inset:12
  border: 1.5px dashed oklch(0.85 0.18 142 / 0.45)
  border-radius: 22px   pointer-events: none

Шапка (padding: 60px 26px 14px):
  "HOW TO USE" — font-size:11 / 700 / uppercase / letter-spacing:2
                  color: oklch(0.85 0.18 142) (светло-зелёный)
  [✕ кнопка] — справа, icon:close size=20 color=rgba(255,255,255,0.9)

Demo card (padding: 0 26px, flex:1):
  Карточка: background:oklch(0.18 0.06 142/0.6)
            border:1px solid oklch(0.85 0.18 142/0.25)
            border-radius:18   padding:18   min-height:220
            animation: slide-up-in при смене шага (key={step})

Текст под карточкой (padding: 22px 2px 0):
  Заголовок: font-size:22 / 700 / letter-spacing:-0.02em
  Описание:  font-size:14 / 400 / lineHeight:1.45 / color:rgba(255,255,255,0.72)

Навигация (padding: 18px 22px 40px):
  [← круг 44×44] [• • • • •] [→ круг 44×44]
  Prev/Next круги: border-radius:22
    background: oklch(0.25 0.06 142/0.6) (неактивный) или oklch(0.85 0.18 142) (Next/Done)
    icon: chevron-left/right size=18 или check size=18 на последнем шаге
  Точки-индикаторы: width:6→22 active, height:6, border-radius:3
    active: oklch(0.85 0.18 142)   inactive: rgba(255,255,255,0.2)
    transition: width 0.32s
```

### 4.2 Визуальный язык внутри demo карточки

Все элементы — **намеренно плоские и пунктирные** (не стеклянные), чтобы пользователь
не пытался их нажать. Это educational diagram, не копия UI.

```css
/* Карточка-заглушка */
.demo-card {
  background: rgba(255,255,255,0.04);
  border: 1px dashed rgba(255,255,255,0.25);
  border-radius: 14px;   padding: 12px 14px;
  color: rgba(255,255,255,0.9);
  font-size: 14px;   font-weight: 500;
}

/* Пилл-заглушка */
.demo-pill {
  display: inline-flex;   align-items: center;   gap: 4px;
  padding: 4px 10px;   border-radius: 999px;
  border: 1px dashed rgba(255,255,255,0.25);
  color: rgba(255,255,255,0.5);   font-size: 12px;   font-weight: 600;
}
.demo-pill.active {
  border-color: oklch(0.85 0.18 142);
  background: oklch(0.85 0.18 142 / 0.12);
  color: oklch(0.85 0.18 142);
}

/* Arrow (пунктирная стрелка-указатель) */
<svg> path d="M7 2v10M3 6l4-4 4 4" stroke={color} strokeDasharray="2 2" .../>
+ label text
```

### 4.3 Шаги и обновлённые demo (под новый интерфейс)

**Шаг 1 — "Open a check"**
```
Было: tab bar с "Open checks | Archive | + New"
Стало: большая кнопка "+ New check" — полная ширина, зелёная

Demo показывает:
  ┌─ .demo-card ──────────────────────────────────────────────────────┐
  │  [+ New check]  ← demo-pill.active, полная ширина, стрелка вниз   │
  └───────────────────────────────────────────────────────────────────┘
  ↓ (Arrow) "tap to start a new check"
  ┌─ .demo-card ── input ─────────────────────────────────────────────┐
  │  "Table 7 / Ira"                                                   │
  └───────────────────────────────────────────────────────────────────┘
  [Open check] ← demo-pill.active

Текст: "Tap «+ New check», enter any name for the table or guest.
       Next time the same name will be suggested automatically."
```

**Шаг 2 — "Quick-add chips"**
```
Demo показывает (без изменений по смыслу, обновить стиль пиллов):
  [Beer Draft] [Whisky] [Khinkali ← active]
  ↓ "tap a chip — name fills instantly"
  ┌─ .demo-card ─ [name] [× qty] [per price] [Add.active] ───────────┐
  └───────────────────────────────────────────────────────────────────┘
  ↓ "tap ★ in Catalog — product appears as a chip"
  ┌─ .demo-card ─ Beer Draft  [★]  › ──────────────────────────────── ┐
  └───────────────────────────────────────────────────────────────────┘

Текст: без изменений
```

**Шаг 3 — "Add items"**
```
Было: одна строка с [–][qty][+] [price] [total] [Add]
Стало: новый AddBar — две строки: поиск сверху, qty+price+add снизу

Demo показывает:
  ┌─ .demo-card ─ строка 1: [🔍 "Khinkali"] ───────────────────────── ┐
  └───────────────────────────────────────────────────────────────────┘
  ┌─ .demo-card ─ строка 2: [–][2][+]  [per 12 ₾]  [Add.active] ──── ┐
  └───────────────────────────────────────────────────────────────────┘
  → "2 × 12₾ = 24₾"  (running total hint)

  Текст: "Type the item name — if it's in your catalog, price fills automatically.
         Set quantity with – and +. «per» field shows the unit price."
```

**Шаг 4 — "Archive & reports"**
```
Demo показывает (незначительные изменения):
  [Today] [Week.active] [30 days]
  ┌──────────────────────────────── stats plate ───────────────────────┐
  │    17 Checks   │   905₾ Revenue   │   53₾ Avg                      │
  └───────────────────────────────────────────────────────────────────┘
  ┌─ .demo-card ─ #15 · Table 202  ····  71₾ ──────────────────────── ┐
  └───────────────────────────────────────────────────────────────────┘

Текст: без изменений
```

**Шаг 5 — "Verify scanned items"**
```
Было и остаётся: жёлтый баннер + жёлтый badge на строке
НО: убрать "Close" кнопку с карточки в списке (её там больше нет)

Demo показывает:
  ┌─ баннер warn ─────────────────────────────────────────────────────┐
  │  ⚠  2 items need verification — tap ⚠ to confirm                  │
  └───────────────────────────────────────────────────────────────────┘
  ┌─ .demo-card yellow ─ [!] Hoegaarden  ·  34₾ ──────────────────── ┐
  └───────────────────────────────────────────────────────────────────┘
  ↓ "tap ⚠ to confirm the scan is correct"
  ┌─ .demo-card normal ─ Hoegaarden  ·  34₾ ───────────────────────── ┐
  └───────────────────────────────────────────────────────────────────┘

Текст: без изменений
```

### 4.4 Что менять в коде help.js / overlay-stories.jsx

| Элемент | Что изменить |
|---|---|
| Шаг 1 demo | Убрать tab bar, добавить большую кнопку "+ New check" |
| Шаг 3 demo | Переделать под новый AddBar (2 строки, "per" label) |
| Шаг 5 demo | Убрать Close кнопку с карточки в demo |
| Все стили | Проверить соответствие demo-pill стилю (они намеренно flat — ok) |
| Тексты шагов | Обновить упоминания UI элементов (напр. "+ New" → "+ New check") |

---

## 5. Противоречия и решения

### 3.1 Кнопка Close в списке открытых чеков

**Дизайн**: нет кнопки Close на карточке чека. Но это дизайнерское умолчание — дизайн не описывал эту потребность явно.

**Продакшен**: каждая карточка имеет кнопку Close (быстрое закрытие без входа в чек) — реальная рабочая потребность барменов.

**Решение**: **оставляем Close на карточке**, но переделываем визуально:
- Иконка ✕ (крестик) в виде маленького `glassPill` или просто иконка-кнопка справа на карточке
- Без текста «Close» — только крестик, 28–30px круглая кнопка
- Тап по карточке (вне крестика) → открывает чек
- Тап по крестику → вызывает подтверждение оплаты и закрывает
- Внутри чека кнопка `Close check` тоже остаётся как `GlassPill.danger`

### 3.2 Кнопка Logout (выход)

**Дизайн**: logout только на экране настроек (venue screen). В хедере нет.

**Продакшен**: logout-иконка в хедере, всегда видна.

**Решение**: убрать из хедера, добавить в venue screen. Экран настроек доступен менеджерам — для staff logout можно добавить как отдельный пункт в нижней части venue screen. Нет риска: staff и менеджеры оба могут попасть на venue screen через gear icon.

### 3.3 Tab bar (Open checks / Archive)

**Дизайн**: табы находятся внутри MainScreen, ниже stats plate, выше списка.

**Продакшен**: `.tabBar` — отдельная полоса, прикреплена к `.topWrap` (sticky).

**Решение**: перенести табы внутрь `screenOpen`. `topWrap` после рестайлинга содержит только VenueHeader. Таб-бар становится частью контента экрана, не sticky.

### 3.4 Stats plate (Open now / Closed today / Revenue)

**Дизайн**: есть на обоих экранах — Open checks и Settings.

**Продакшен**: сейчас нет на Open checks; есть на venue screen (`archStatCard`).

**Решение**: добавить stats plate на `screenOpen` (силently фетчим `/api/venue`; для staff 403 → не показываем). На venue screen оставить тоже.

### 3.5 Readonly-режим для архивных чеков

**Дизайн**: не описан отдельно — дизайн предполагает только открытые чеки в CheckScreen.

**Продакшен**: есть режим `chk-readonly` — при просмотре архивного чека меняется кнопка Close → "← Back", скрывается bottom bar.

**Решение**: сохранить readonly-логику без изменений. Только визуально адаптировать кнопки под новый стиль.

### 3.6 Gear icon — менеджер vs staff

**Дизайн**: gear icon всегда виден в VenueHeader (для всех).

**Продакшен**: `btnVenue` скрыт для non-managers.

**Решение**: показывать gear всем, но:
- Менеджер → полный venue screen со staff-листом и настройками
- Staff → упрощённый venue screen (только свой профиль + logout)
- Это уже так работает через `CHK.getUserProfile().role`.

---

## 4. Новая структура навигации

```
Все экраны:
  ┌─────────────────────────────┐
  │ [лого] Venue Name [⚙] [?]  │  ← VenueHeader (высота ~46px)
  └─────────────────────────────┘
  + BgWash (абсолютный)

screenOpen (Main):
  VenueHeader
  Stats plate (glass-strong, 3 колонки — только если manager)
  Tabs: Open checks | Archive
  --- если Open: ---
  [+ New check] (accent кнопка)
  Список чеков (glass карточки)
  --- если Archive: ---
  Search, date filters, stats, список

screenCheck:
  VenueHeader
  [← Open checks]  [Close check] ← GlassPills, justify:flex-end
  #N  GuestName        [TOTAL ₾]  ← check header row
  ⏰ opened HH:MM · N items
  Список items (glass строки, swipe-to-delete)
  AddBar (glass-strong, снизу)

screenNew:
  VenueHeader
  [← Back] ← GlassPill
  glass-strong карточка: New check / guest input / Open button / Scan

screenVenue (Settings):
  VenueHeader  ← onSettings={() => {}}  (шестерёнка — no-op, мы уже здесь)
  [← Open checks]  ← GlassPill, один, выровнен влево (display:flex, без justify)
  Stats plate (glass-strong)
  "Staff" группа (заголовок + [+ Add] action справа) (glass)
  Безымянная группа: Catalog / Supplies / Subscription (glass)
  "Appearance" группа: Theme toggle (glass)
  "Account" группа: Activity log / Sign out (glass)

screenLogin / screenForgot / screenReset:
  Без VenueHeader — старый дизайн, только CSS-токены
```

---

## 5. Стратегия миграции (по фазам)

### Принцип: каждая фаза — отдельный коммит + деплой + проверка

Не делаем несколько фаз в одном коммите. Если фаза сломала что-то → откат одного коммита.

---

### Фаза 1: CSS-токены (только добавление)

**Файл**: `admin/app.css`

**Что делаем**: добавляем в начало файла новые CSS-переменные и классы, НЕ удаляя старые.
- Новые токены (`--bg-wash`, `--surface`, `--hairline`, `--shine-top/bot`, `--text-0/1/2/3`)
- Новые классы: `.glass`, `.glass-strong`, `.pressable`, `.glassPill`, `.bgWash`, `.footnote`, `.tabular`, `.display`
- Анимации: `slide-up-in`, `qty-bump`, `pop-in`, `highlight-flash`
- Шрифт: Inter (Google Fonts link в HTML)

**Риск**: минимальный. Новые классы ни на что не применены.

**Тест**: открыть в браузере, убедиться что старый UI не сломан.

---

### Фаза 2: Фон + шрифт

**Файл**: `admin/app.css`, `admin/index.html`

**Что делаем**:
- `<body class="theme-dark">` (или через `app.js` сразу)
- `body { background: var(--bg-wash); font-family: Inter, ... }`
- Убираем старый `--bg: #0b0d10` с body

**Риск**: низкий. Может измениться цвет фона. Текст не затронут.

---

### Фаза 3: VenueHeader

**Файлы**: `admin/index.html`, `admin/app.css`, `admin/app.js`

**Что делаем**:
- Заменяем `.topWrap > .top` на новую HTML-структуру VenueHeader
- Новый логотип SVG (C-форма)
- Venue name вместо "Checki" (берём из `CHK.getUserProfile().venue_name`)
- Gear button inline с venue name
- Help pill как `.glassPill`
- Logout убираем из хедера (временно — до фазы 6)
- Таб-бар `.tabBar` пока оставляем на месте, только рестайлим

**Зависимости**:
- `app.js`: функция `setToken()` обращается к `btnLogout` — нужно обновить
- `app.js`: `btnVenue` — нужно перепривязать к новому элементу

**Тест**: логин, переключение экранов, проверка venue name в хедере.

---

### Фаза 4: Stats plate + список чеков

**Файлы**: `admin/app.js`, `admin/app.css`

**Что делаем**:
- В `loadOpen()` добавляем тихий fetch `/api/venue` для stats (try/catch, для staff пропускаем)
- Рендерим stats plate над табами (для менеджеров)
- Переделываем `renderOpen()`: `.item` → `.glass` карточки
- Убираем Close кнопку с карточек
- Добавляем кнопку "+ New check" (accent, полная ширина) перед списком
- Убираем `<input id="openSearch">` из HTML → переносим внутрь `screenOpen` через JS (или оставляем пока)

**Тест**: список чеков, фильтрация по поиску, открытие чека.

---

### Фаза 5: Check screen

**Файлы**: `admin/index.html`, `admin/app.js`, `admin/app.css`

**Что делаем**:
- Новая HTML-структура `screenCheck`: убираем старый `.row` с кнопками, добавляем:
  - GlassPill-строка: `[← Open checks] [Close check]`
  - Check header: `#N GuestName` слева + `[TOTAL ₾]` pill справа
  - `opened HH:MM · N items` — footnote строка
- `renderCheck()`: переписываем стили `.item` → `.glass` строки
- Bottom bar `#bottomBar`: рестайлинг под AddBar из дизайна
  - search icon + input (без border)
  - qty stepper
  - `per` label + price input + `₾` + Add button
  - quick chips (горизонтальный скролл)

**Зависимости**:
- Readonly-режим: `setReadonly()` меняет текст кнопки Close — нужно обновить под новую структуру
- `btnBackFromCheck`, `btnCloseCheck` — ID сохраняем, только стили

**Тест**: открыть чек, добавить item, изменить qty, закрыть чек.

---

### Фаза 6: Venue/Settings screen + Logout

**Файлы**: `admin/index.html`, `admin/venue.js`, `admin/app.css`

**Что делаем**:
- Новая HTML-структура `screenVenue`:
  - GlassPill `[← Open checks]`
  - Stats plate
  - Staff group (glass)
  - Features group (glass)
  - Account group: Activity log + Sign out
- Logout переносим в Sign out в venue screen
- Удаляем `btnLogout` из хедера

**Тест**: gear → venue screen, кнопки staff, logout, навигация назад.

---

### Фаза 7: New Check screen + Archive + финальный polish

**Что делаем**:
- `screenNew`: рестайл под дизайн (glass-strong карточка)
- Archive: glass строки, filter pills, stats plate
- Удаляем все устаревшие CSS-классы
- Light/dark theme переключатель

---

## 6. Правила безопасной работы

1. **Один файл за раз** если возможно. Начинаем с CSS.
2. **ID элементов не меняем** — JS привязан к ID. Меняем только классы и структуру внутри.
3. **Перед каждым коммитом**: проверяем что login работает, список чеков открывается, чек открывается, item добавляется.
4. **Деплоим каждую фазу** и смотрим на реальном устройстве.
5. **Если что-то сломалось** — `git revert HEAD`, не чиним поверх.

---

## 7. Что НЕ меняем

- Вся логика работы с API (fetch, parse, toast, confirm)
- ID всех HTML-элементов к которым привязан JS
- Readonly-режим для архивных чеков (только рестайл кнопок)
- Scan-функционал (lowConfidenceIds, scanEditBack modal)
- Password reset flow (screenForgot, screenReset)
- Все backend-файлы
