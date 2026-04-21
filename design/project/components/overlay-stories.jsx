// How-to-use stories overlay — intentionally STYLIZED to look different from the UI
// so users don't try to tap the mock controls.

const STORY_STEPS = [
  {
    title: 'Open a check',
    body: 'Enter any name for the table or guest. Next time the same name will be suggested automatically from history.',
    demo: 'open',
  },
  {
    title: 'Quick-add chips',
    body: 'Tap a chip and the item name fills in instantly — no typing needed. To add a product to chips, open Catalog and tap ★ next to it.',
    demo: 'chips',
  },
  {
    title: 'Add items',
    body: "Type the item name. If it's already in your catalog — the price fills in automatically. If it's new — enter the price once and it'll be saved for next time. Use – and + to set quantity.",
    demo: 'add',
  },
  {
    title: 'Archive & reports',
    body: 'Closed checks land in Archive. Filter by date, search by guest or item, export as PDF for accounting.',
    demo: 'archive',
  },
  {
    title: 'Verify scanned items',
    body: "When you scan a paper check, items the camera wasn't 100% sure about get flagged in yellow. Tap the ⚠ to confirm.",
    demo: 'verify',
  },
];

// Cute illustrated demo for each step — purposely flat + monochrome,
// so it reads as a diagram, not an interactive control.
function StoryDemo({ kind }) {
  const bg = 'rgba(255,255,255,0.04)';
  const line = 'rgba(255,255,255,0.25)';
  const mute = 'rgba(255,255,255,0.5)';
  const fg = 'rgba(255,255,255,0.9)';
  const accent = 'oklch(0.85 0.18 142)';

  // Consistent, playful stroke look
  const card = {
    background: bg,
    border: `1px dashed ${line}`,
    borderRadius: 14,
    padding: '12px 14px',
    color: fg,
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '-0.01em',
  };
  const pill = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 10px', borderRadius: 999,
    border: `1px dashed ${active ? accent : line}`,
    background: active ? 'oklch(0.85 0.18 142 / 0.12)' : 'transparent',
    color: active ? accent : mute, fontSize: 12, fontWeight: 600,
  });

  if (kind === 'open') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={pill(false)}>Open checks</span>
        <span style={pill(false)}>Archive</span>
        <div style={{ flex: 1 }}/>
        <span style={{...pill(true), borderStyle: 'dashed'}}>+ New</span>
      </div>
      <Arrow label="tap to start a new check" color={accent}/>
      <div style={card}>Table 7 / Ira</div>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{
          padding: '8px 16px', borderRadius: 10,
          border: `1px dashed ${accent}`, color: accent,
          fontSize: 13, fontWeight: 700,
        }}>Open check</div>
      </div>
    </div>
  );

  if (kind === 'chips') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={pill(false)}>Beer Draft</span>
        <span style={pill(false)}>Whisky</span>
        <span style={pill(true)}>Khinkali</span>
      </div>
      <Arrow label="tap a chip — name fills instantly" color={accent}/>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1 }}>Beer Draft</span>
        <span style={{ color: mute, fontSize: 12 }}>4.00{LARI}</span>
        <span style={{
          width: 22, height: 22, borderRadius: 11,
          border: `1px dashed ${accent}`, color: accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12,
        }}>★</span>
        <span style={{ color: mute }}>›</span>
      </div>
      <Arrow label="tap ★ in Catalog — product appears as a chip" color={accent}/>
    </div>
  );

  if (kind === 'add') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={card}>Khinkali</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ ...pill(false), padding: '6px 10px' }}>–</span>
        <span style={{ ...pill(false), padding: '6px 10px', color: fg, borderColor: mute }}>2</span>
        <span style={{ ...pill(false), padding: '6px 10px' }}>+</span>
        <span style={{ ...pill(false), padding: '6px 10px', color: fg, borderColor: mute, flex: 1, textAlign: 'center' }}>12</span>
        <span style={{ ...pill(false), padding: '6px 10px', color: mute, flex: 1, textAlign: 'center' }}>24 {LARI}</span>
        <span style={{ ...pill(true), padding: '6px 14px' }}>Add</span>
      </div>
      <div style={{ color: accent, fontSize: 12, fontWeight: 600, padding: '2px 4px' }}>
        No catalog setup needed to start
      </div>
    </div>
  );

  if (kind === 'archive') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={pill(false)}>Today</span>
        <span style={pill(true)}>Week</span>
        <span style={pill(false)}>30 days</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ ...card, flex: 1, textAlign: 'center' }}>
          <div style={{ color: accent, fontWeight: 700, fontSize: 18 }}>17</div>
          <div style={{ color: mute, fontSize: 11 }}>Checks</div>
        </div>
        <div style={{ ...card, flex: 1, textAlign: 'center' }}>
          <div style={{ color: accent, fontWeight: 700, fontSize: 18 }}>905{LARI}</div>
          <div style={{ color: mute, fontSize: 11 }}>Revenue</div>
        </div>
      </div>
      <div style={{ ...card, display: 'flex', alignItems: 'center' }}>
        <span style={{ flex: 1 }}>#15 · Table 202</span>
        <span style={{ color: mute }}>71{LARI}</span>
      </div>
    </div>
  );

  if (kind === 'verify') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10,
        background: 'oklch(0.5 0.14 75 / 0.1)', borderColor: 'oklch(0.78 0.14 75 / 0.5)',
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 11,
          background: 'oklch(0.78 0.14 75)', color: '#3a2a00',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
        }}>!</span>
        <span style={{ flex: 1 }}>Hoegaarden</span>
        <span style={{ color: mute }}>34{LARI}</span>
      </div>
      <Arrow label="tap ⚠ to confirm the scan is correct" color="oklch(0.85 0.14 75)"/>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1 }}>Hoegaarden</span>
        <span style={{ color: mute }}>34{LARI}</span>
      </div>
    </div>
  );

  return null;
}

function Arrow({ label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
        <path d="M7 2v10M3 6l4-4 4 4" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 2"/>
      </svg>
      <span style={{ color, fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em' }}>{label}</span>
    </div>
  );
}

function StoriesOverlay({ onClose }) {
  const [step, setStep] = useState(0);
  const total = STORY_STEPS.length;

  const next = () => setStep(s => Math.min(total - 1, s + 1));
  const prev = () => setStep(s => Math.max(0, s - 1));

  const s = STORY_STEPS[step];

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, oklch(0.22 0.07 142 / 0.96), oklch(0.14 0.05 142 / 0.98))',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      animation: 'slide-up-in 0.32s cubic-bezier(0.32, 0.72, 0, 1) both',
      color: '#fff',
    }}>
      {/* Dotted "educational" border pattern to visually differentiate from UI */}
      <div style={{
        position: 'absolute', inset: 12,
        border: '1.5px dashed oklch(0.85 0.18 142 / 0.45)', borderRadius: 22,
        pointerEvents: 'none',
      }}/>

      {/* eyebrow */}
      <div style={{ padding: '60px 26px 14px', display: 'flex', alignItems: 'center' }}>
        <div style={{
          color: 'oklch(0.85 0.18 142)', fontSize: 11, fontWeight: 700,
          letterSpacing: 2, textTransform: 'uppercase',
        }}>How to use</div>
        <div style={{ flex: 1 }}/>
        <Press as="button" onClick={onClose} style={{
          border: 0, background: 'transparent', color: 'rgba(255,255,255,0.7)',
          padding: 6, display: 'flex', alignItems: 'center',
        }}><Icon name="close" size={20} color="rgba(255,255,255,0.9)"/></Press>
      </div>

      {/* demo card */}
      <div style={{ padding: '0 26px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: 'oklch(0.18 0.06 142 / 0.6)',
          border: '1px solid oklch(0.85 0.18 142 / 0.25)',
          borderRadius: 18, padding: 18,
          minHeight: 220,
          animation: 'slide-up-in 0.3s cubic-bezier(0.32, 0.72, 0, 1) both',
        }} key={step}>
          <StoryDemo kind={s.demo}/>
        </div>

        <div style={{ padding: '22px 2px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{s.title}</div>
          <div style={{
            marginTop: 8, fontSize: 14, lineHeight: 1.45,
            color: 'rgba(255,255,255,0.72)', fontWeight: 400,
          }}>{s.body}</div>
        </div>
      </div>

      {/* nav */}
      <div style={{
        padding: '18px 22px 40px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Press as="button" onClick={prev} disabled={step === 0} style={{
          width: 44, height: 44, borderRadius: 22, border: 0,
          background: 'oklch(0.25 0.06 142 / 0.6)',
          color: step === 0 ? 'rgba(255,255,255,0.3)' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="chevron-left" size={18} color={step === 0 ? 'rgba(255,255,255,0.3)' : '#fff'}/></Press>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 8 }}>
          {STORY_STEPS.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{
              width: i === step ? 22 : 6, height: 6, borderRadius: 3,
              background: i === step ? 'oklch(0.85 0.18 142)' : 'rgba(255,255,255,0.2)',
              transition: 'all 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
              cursor: 'pointer',
            }}/>
          ))}
        </div>

        <Press as="button" onClick={step === total - 1 ? onClose : next} style={{
          width: 44, height: 44, borderRadius: 22, border: 0,
          background: 'oklch(0.85 0.18 142)',
          color: '#0a2010',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {step === total - 1
            ? <Icon name="check" size={18} color="#0a2010"/>
            : <Icon name="chevron-right" size={18} color="#0a2010"/>}
        </Press>
      </div>
    </div>
  );
}

Object.assign(window, { StoriesOverlay });
