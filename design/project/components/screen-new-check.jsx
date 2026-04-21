// New Check screen — enter name or scan
function NewCheckScreen({ onNavigate, onOpenCheck, onHelp, onExit, onOpenSettings, onLogoHold, venueName }) {
  const [name, setName] = useState('');

  const suggestions = ['Table 7 / Ira', 'Bar #2', 'Maya', 'Giorgi', 'VIP room'];

  const submit = () => {
    if (!name.trim()) return;
    const id = Math.floor(Math.random() * 90) + 10;
    onOpenCheck({ id, table: name.trim(), server: 'You', items: 0, opened: '15:00', total: 0, status: 'open', itemsData: [] });
  };

  return (
    <div data-screen-label="New Check" style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      color: 'var(--text-0)', position: 'relative',
    }}>
      <BgWash />

      <div style={{ paddingTop: 50, position: 'relative', zIndex: 2 }}>
        <VenueHeader
          venueName={venueName || 'Demo Venue'}
          onSettings={onOpenSettings}
          onHelp={onHelp}
          onLogoHold={onLogoHold}
        />

        <div style={{ padding: '0 14px 4px', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <GlassPill onClick={() => onNavigate('main')}>
            <Icon name="chevron-left" size={13} color="var(--text-2)"/> Back
          </GlassPill>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 20px', position: 'relative', zIndex: 1 }}>
        <div className="glass-strong" style={{
          borderRadius: 22, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
          animation: 'slide-up-in 0.32s cubic-bezier(0.32, 0.72, 0, 1) both',
        }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>New check</div>
            <div className="footnote" style={{ marginTop: 2 }}>Guest / table</div>
          </div>

          <div className="glass" style={{
            borderRadius: 12, padding: '0 14px', height: 48,
            display: 'flex', alignItems: 'center',
            background: 'var(--surface-strong)',
          }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              placeholder={`Example: "${suggestions[0]}"`}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              style={{
                flex: 1, background: 'transparent', border: 0, outline: 'none',
                fontSize: 16, fontWeight: 500, color: 'var(--text-0)',
                fontFamily: 'inherit', letterSpacing: '-0.01em',
              }}
            />
          </div>

          <div className="noscrollbar" style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginLeft: -2, marginRight: -2,
          }}>
            {suggestions.map(s => (
              <Press as="button" key={s} onClick={() => setName(s)} style={{
                border: '0.5px solid var(--hairline)',
                padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                background: 'var(--surface)', color: 'var(--text-2)',
                fontSize: 12, fontWeight: 500, flexShrink: 0,
              }}>{s}</Press>
            ))}
          </div>

          <Press as="button" onClick={submit} disabled={!name.trim()} style={{
            border: 0, height: 44, borderRadius: 12,
            background: name.trim() ? 'var(--accent)' : 'var(--surface)',
            color: name.trim() ? '#0a0f0a' : 'var(--text-3)',
            fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em',
            boxShadow: name.trim() ? '0 4px 16px oklch(var(--accent-l) var(--accent-s) var(--accent-h) / 0.4), inset 0 0.5px 0 rgba(255,255,255,0.4)' : 'none',
          }}>Open check</Press>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 0.5, background: 'var(--hairline)' }}/>
            <span className="footnote">or</span>
            <div style={{ flex: 1, height: 0.5, background: 'var(--hairline)' }}/>
          </div>

          <Press as="button" className="glass" style={{
            border: '0.5px solid var(--hairline-strong)',
            height: 52, borderRadius: 14, padding: '0 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            color: 'var(--text-0)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
            background: 'var(--surface)',
          }}>
            <Icon name="camera" size={20} color="var(--text-1)"/>
            Scan paper check
          </Press>

          <div className="footnote" style={{ textAlign: 'center', lineHeight: 1.4, color: 'var(--text-2)' }}>
            Take a photo of a handwritten check —<br/>items will be imported automatically
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NewCheckScreen });
