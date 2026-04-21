// Main screen — Open checks / Archive tabs
const MAIN_CHECKS = [
  { id: 6, status: 'open', table: 'Table 202', server: 'Evgenii', items: 5, opened: '14:42', total: 66, hasCheck: true },
  { id: 7, status: 'open', table: 'Ira', server: 'Jmek', items: 3, opened: '15:12', total: 42 },
  { id: 5, status: 'closed', table: 'Scan', server: 'Manager', items: 4, opened: '17:57', total: 66, pay: 'card', group: 'Today' },
  { id: 4, status: 'closed', table: 'Table 7', server: 'Evgenii', items: 6, opened: '16:30', total: 94, pay: 'cash', group: 'Today' },
  { id: 3, status: 'closed', table: 'Bar', server: 'Evgenii', items: 2, opened: '11:13', total: 71, pay: 'card', group: 'Yesterday' },
  { id: 2, status: 'closed', table: '101', server: 'Jmek', items: 8, opened: '09:42', total: 142, pay: 'cash', group: 'Yesterday' },
];

function MainTabs({ value, onChange }) {
  const tabs = [
    { label: 'Open checks', value: 'open' },
    { label: 'Archive', value: 'archive' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 18px 10px', gap: 18, borderBottom: '0.5px solid var(--hairline)' }}>
      {tabs.map(t => (
        <Press as="button" key={t.value} onClick={() => onChange(t.value)} style={{
          border: 0, background: 'transparent', padding: '6px 0',
          position: 'relative',
          fontSize: 20, fontWeight: value === t.value ? 700 : 500,
          letterSpacing: '-0.03em',
          color: value === t.value ? 'var(--text-0)' : 'var(--text-2)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>
          {t.label}
          {value === t.value && (
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: -10.5, height: 2,
              background: 'var(--accent)', borderRadius: 2,
            }}/>
          )}
        </Press>
      ))}
    </div>
  );
}

function OpenChecksList({ checks, onOpen, onNew }) {
  const openList = checks.filter(c => c.status === 'open');
  return (
    <>
      {/* New button */}
      <div style={{ padding: '12px 14px 10px' }}>
        <Press as="button" onClick={onNew} style={{
          width: '100%', height: 46, borderRadius: 14, border: 0,
          background: 'linear-gradient(180deg, oklch(calc(var(--accent-l) + 0.04) var(--accent-s) var(--accent-h)), var(--accent))',
          color: '#0a0f0a', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: '0 4px 20px oklch(var(--accent-l) var(--accent-s) var(--accent-h) / 0.35), inset 0 0.5px 0 rgba(255,255,255,0.4)',
        }}>
          <Icon name="plus" size={16} color="#0a0f0a"/>
          New check
        </Press>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: '0 14px 20px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {openList.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-2)' }}>
            <div style={{ fontSize: 14 }}>No open checks</div>
            <div className="footnote" style={{ marginTop: 4 }}>Tap «New check» above to start</div>
          </div>
        )}
        {openList.map((c, i) => (
          <Press as="button" key={c.id} onClick={() => onOpen(c)} className="glass" style={{
            border: 'none', padding: '12px 14px', textAlign: 'left',
            borderRadius: 16, display: 'flex', alignItems: 'center', gap: 10,
            animation: `slide-up-in 0.32s cubic-bezier(0.32, 0.72, 0, 1) ${i * 30}ms backwards`,
            color: 'var(--text-0)',
            backgroundColor: 'var(--surface-hi)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <span className="tabular" style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--accent-strong)',
                }}>#{c.id}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }}>·</span>
                <span style={{
                  fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-0)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0,
                }}>{c.table}</span>
                {c.hasCheck && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '1px 5px', borderRadius: 4,
                    background: 'oklch(0.5 0.14 75 / 0.22)',
                    color: 'oklch(0.88 0.14 75)',
                    fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
                    flexShrink: 0,
                  }}>check</span>
                )}
              </div>
              <div className="footnote" style={{ marginTop: 2, display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                <span>{c.server}</span>
                <span>·</span>
                <span>{c.items} item{c.items !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span className="tabular">{c.opened}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
              <div className="tabular" style={{
                fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-0)',
              }}>{c.total}<span style={{ fontSize: 11, color: 'var(--text-2)' }}>{LARI}</span></div>
            </div>
          </Press>
        ))}
      </div>
    </>
  );
}

function ArchiveView({ checks, onOpen }) {
  const [range, setRange] = useState('week');
  const ranges = [
    { l: 'Today', v: 'today' }, { l: 'Week', v: 'week' },
    { l: '30 days', v: '30' }, { l: 'April', v: 'month' }, { l: 'All', v: 'all' },
  ];
  const closed = checks.filter(c => c.status === 'closed');
  const total = closed.reduce((s, c) => s + c.total, 0);
  const avg = closed.length ? (total / closed.length).toFixed(2) : '0';

  // group
  const groups = {};
  closed.forEach(c => { (groups[c.group || 'Earlier'] = groups[c.group || 'Earlier'] || []).push(c); });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="glass" style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 38, borderRadius: 11,
      }}>
        <Icon name="search" size={15} color="var(--text-2)"/>
        <input placeholder="Search: guest, item, amount…" style={{
          flex: 1, background: 'transparent', border: 0, outline: 'none',
          fontSize: 14, color: 'var(--text-0)', fontFamily: 'inherit',
        }}/>
      </div>
      <div className="noscrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
        {ranges.map(r => (
          <Press as="button" key={r.v} onClick={() => setRange(r.v)} style={{
            padding: '7px 14px', borderRadius: 999, whiteSpace: 'nowrap',
            background: range === r.v ? 'var(--accent-soft)' : 'var(--surface)',
            color: range === r.v ? 'var(--accent-strong)' : 'var(--text-1)',
            fontSize: 13, fontWeight: 600,
            border: `0.5px solid ${range === r.v ? 'oklch(var(--accent-l) var(--accent-s) var(--accent-h) / 0.3)' : 'var(--hairline)'}`,
          }}>{r.l}</Press>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="glass" style={{ flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 13, color: 'var(--text-1)', textAlign: 'center' }}>Apr 12</div>
        <span className="footnote">—</span>
        <div className="glass" style={{ flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 13, color: 'var(--text-1)', textAlign: 'center' }}>Apr 18</div>
        <Press as="button" style={{
          border: 0, padding: '0 14px', height: 34, borderRadius: 10,
          background: 'var(--accent)', color: '#0a0f0a', fontWeight: 700, fontSize: 13,
        }}>PDF</Press>
      </div>

      <div className="glass-strong" style={{
        borderRadius: 14, padding: '12px 4px',
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2,
      }}>
        {[
          { v: closed.length, l: 'Checks' },
          { v: `${total}${LARI}`, l: 'Revenue' },
          { v: `${avg}${LARI}`, l: 'Avg' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center', borderLeft: i ? '0.5px solid var(--hairline)' : 'none' }}>
            <div className="tabular" style={{ fontSize: 19, fontWeight: 700, color: 'var(--accent-strong)', letterSpacing: '-0.03em' }}>{s.v}</div>
            <div className="footnote" style={{ fontSize: 11 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="glass" style={{ padding: 12, borderRadius: 14 }}>
        <div className="footnote" style={{ marginBottom: 4 }}>Top items</div>
        <div style={{ fontSize: 13, color: 'var(--text-0)', fontWeight: 500 }}>Hoegaarden ×22, Absolut ×10, Lager ×10</div>
      </div>

      {Object.entries(groups).map(([gName, items]) => (
        <div key={gName}>
          <div className="footnote" style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.4, marginTop: 8, marginBottom: 6, paddingLeft: 4 }}>{gName}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(i => (
              <Press as="button" key={i.id} onClick={() => onOpen && onOpen(i)} className="glass" style={{
                border: 'none', padding: '10px 14px', borderRadius: 14,
                display: 'flex', alignItems: 'center', textAlign: 'left',
                color: 'var(--text-0)',
                background: 'var(--bg-1)',
                backgroundImage: 'linear-gradient(var(--surface), var(--surface))',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>#{i.id}</span> · {i.table}
                  </div>
                  <div className="footnote" style={{ marginTop: 2, whiteSpace: 'nowrap' }}>{i.opened} · {i.pay}</div>
                </div>
                <div className="tabular" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em', flexShrink: 0 }}>
                  {i.total}<span style={{ fontSize: 11, color: 'var(--text-2)' }}>{LARI}</span>
                </div>
              </Press>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MainScreen({ onOpenCheck, onNewCheck, onOpenSettings, onHelp, onExit, onLogoHold, venueName }) {
  const [tab, setTab] = useState('open');
  const checks = MAIN_CHECKS;
  const openCount = checks.filter(c => c.status === 'open').length;
  const closedToday = checks.filter(c => c.status === 'closed' && c.group === 'Today').length;
  const revenueToday = checks.filter(c => c.status === 'closed' && c.group === 'Today').reduce((s, c) => s + c.total, 0);

  return (
    <div data-screen-label="Main" style={{
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

        {/* stats plate — numbers only, no icons, no labels in the card title */}
        <div style={{ padding: '4px 14px 12px' }}>
          <div className="glass-strong" style={{
            borderRadius: 16, padding: '12px 4px',
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2,
          }}>
            {[
              { v: openCount, l: 'Open now' },
              { v: closedToday, l: 'Closed today' },
              { v: `${revenueToday}${LARI}`, l: 'Revenue today', accent: true },
            ].map((s, i) => (
              <div key={i} style={{
                textAlign: 'center',
                borderLeft: i ? '0.5px solid var(--hairline)' : 'none',
                padding: '0 4px',
              }}>
                <div className="tabular" style={{
                  fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em',
                  color: s.accent ? 'var(--accent-strong)' : 'var(--text-0)',
                }}>{s.v}</div>
                <div className="footnote" style={{ marginTop: 2, fontSize: 11 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <MainTabs value={tab} onChange={setTab}/>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', zIndex: 1 }}>
        {tab === 'open'
          ? <OpenChecksList checks={checks} onOpen={onOpenCheck} onNew={onNewCheck}/>
          : <ArchiveView checks={checks} onOpen={onOpenCheck}/>
        }
      </div>
    </div>
  );
}

Object.assign(window, { MainScreen });
