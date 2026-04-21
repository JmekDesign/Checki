// Settings — single-page
function SettingsRow({ icon, iconBg, title, detail, toggle, onToggle, last, onClick, role, right }) {
  return (
    <Press as="button" onClick={onClick} style={{
      border: 0, background: 'transparent', textAlign: 'left',
      width: '100%', padding: '11px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      position: 'relative', color: 'var(--text-0)',
    }}>
      {icon && (
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: iconBg || 'var(--surface-strong)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 0.5px 0 var(--shine-top)',
        }}>
          <Icon name={icon} size={15} color="#fff" />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
          {role && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
              padding: '2px 6px', borderRadius: 4,
              background: role === 'MANAGER' ? 'var(--accent-soft)' : 'var(--surface-hi)',
              color: role === 'MANAGER' ? 'var(--accent-strong)' : 'var(--text-2)',
              border: '0.5px solid var(--hairline)',
              flexShrink: 0,
            }}>{role}</span>
          )}
        </div>
        {detail && <div className="footnote" style={{ marginTop: 1 }}>{detail}</div>}
      </div>
      {right}
      {typeof toggle === 'boolean' ? (
        <div onClick={(e) => { e.stopPropagation(); onToggle && onToggle(!toggle); }}
          style={{
            width: 42, height: 26, borderRadius: 13, flexShrink: 0,
            background: toggle ? 'var(--accent)' : 'var(--surface-hi)',
            border: '0.5px solid var(--hairline-strong)',
            position: 'relative',
            transition: 'background 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          }}>
          <div style={{
            position: 'absolute', top: 1, left: toggle ? 17 : 1,
            width: 22, height: 22, borderRadius: 11, background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          }}/>
        </div>
      ) : !last && (
        <Icon name="chevron-right" size={14} color="var(--text-3)"/>
      )}
      {!last && (
        <div style={{
          position: 'absolute', left: icon ? 56 : 14, right: 0, bottom: 0, height: 0.5,
          background: 'var(--hairline)',
        }}/>
      )}
    </Press>
  );
}

function SettingsGroup({ header, action, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {header && (
        <div style={{ padding: '4px 18px 6px', display: 'flex', alignItems: 'center' }}>
          <div style={{
            textTransform: 'uppercase', color: 'var(--text-2)',
            fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
          }}>{header}</div>
          <div style={{ flex: 1 }}/>
          {action}
        </div>
      )}
      <div className="glass" style={{ margin: '0 14px', borderRadius: 16, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function ThemeToggle({ value, onChange }) {
  const opts = [{ v: 'dark', l: 'Dark' }, { v: 'light', l: 'Light' }, { v: 'auto', l: 'Auto' }];
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--surface-hi)', padding: 2, borderRadius: 9, border: '0.5px solid var(--hairline)' }}>
      {opts.map(o => (
        <button key={o.v} onClick={(e) => { e.stopPropagation(); onChange(o.v); }} style={{
          border: 0, padding: '5px 10px', borderRadius: 7,
          background: value === o.v ? 'var(--surface-strong)' : 'transparent',
          color: value === o.v ? 'var(--text-0)' : 'var(--text-2)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          boxShadow: value === o.v ? 'inset 0 0.5px 0 var(--shine-top), 0 1px 2px rgba(0,0,0,0.1)' : 'none',
        }}>{o.l}</button>
      ))}
    </div>
  );
}

function SettingsScreen({ onNavigate, theme, onThemeChange, onHelp, onExit, onLogoHold, venueName }) {
  return (
    <div data-screen-label="Venue Settings" style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      color: 'var(--text-0)', position: 'relative',
    }}>
      <BgWash />

      <div style={{ paddingTop: 50, position: 'relative', zIndex: 2 }}>
        <VenueHeader
          venueName={venueName || 'Demo Venue'}
          onSettings={() => {}}
          onHelp={onHelp}
          onLogoHold={onLogoHold}
        />
        <div style={{ padding: '0 14px 10px', display: 'flex' }}>
          <GlassPill onClick={() => onNavigate('main')}>
            <Icon name="chevron-left" size={13} color="var(--text-2)"/> Open checks
          </GlassPill>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20, position: 'relative', zIndex: 1 }}>

        {/* Stats plate */}
        <div style={{ padding: '0 14px 14px' }}>
          <div className="glass-strong" style={{
            borderRadius: 16, padding: '12px 4px',
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2,
          }}>
            {[
              { v: 2, l: 'Open now' },
              { v: 1, l: 'Closed today' },
              { v: `66${LARI}`, l: 'Revenue today', accent: true },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', borderLeft: i ? '0.5px solid var(--hairline)' : 'none' }}>
                <div className="tabular" style={{
                  fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em',
                  color: s.accent ? 'var(--accent-strong)' : 'var(--text-0)',
                }}>{s.v}</div>
                <div className="footnote" style={{ marginTop: 2, fontSize: 11 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <SettingsGroup header="Staff" action={
          <Press as="button" style={{
            border: 0, padding: '4px 10px', borderRadius: 999,
            background: 'var(--accent-soft)', color: 'var(--accent-strong)',
            fontSize: 11, fontWeight: 700, letterSpacing: '-0.01em',
            border: '0.5px solid oklch(var(--accent-l) var(--accent-s) var(--accent-h) / 0.25)',
          }}>+ Add</Press>
        }>
          <StaffRow name="Manager" role="MANAGER" login="demo_manager" online/>
          <StaffRow name="Evgenii Zolotukhin" role="STAFF" login="jmek" online/>
          <StaffRow name="Jmek" role="STAFF" login="jmek3" online last/>
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow title="Product catalog" detail="87 items" icon="tag" iconBg="linear-gradient(135deg,#ff9f0a,#ff6a00)"/>
          <SettingsRow title="Supplies" detail="Track stock" icon="receipt" iconBg="linear-gradient(135deg,#34c759,#30b050)"/>
          <SettingsRow title="Subscription" detail="Pro · renews Apr 30" icon="sparkle" iconBg="linear-gradient(135deg,#bf5af2,#5e5ce6)" last/>
        </SettingsGroup>

        <SettingsGroup header="Appearance">
          <SettingsRow title="Theme" icon="sparkle" iconBg="linear-gradient(135deg,#48484a,#1c1c1e)"
            right={<ThemeToggle value={theme} onChange={onThemeChange}/>} last/>
        </SettingsGroup>

        <SettingsGroup header="Account">
          <SettingsRow title="Activity log" icon="clock" iconBg="linear-gradient(135deg,#32ade6,#0a84ff)"/>
          <SettingsRow title="Sign out" icon="exit" iconBg="linear-gradient(135deg,#ff453a,#c30e00)" onClick={onExit} last/>
        </SettingsGroup>

        <div style={{ padding: '4px 18px 0', color: 'var(--text-3)', fontSize: 11, lineHeight: 1.4 }}>
          Checki.ge v3.2.1 · admin.checki.ge
        </div>
      </div>
    </div>
  );
}

function StaffRow({ name, role, login, online, last }) {
  return (
    <Press as="button" style={{
      border: 0, background: 'transparent', textAlign: 'left',
      width: '100%', padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      position: 'relative', color: 'var(--text-0)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{name}</span>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
            padding: '2px 6px', borderRadius: 4,
            background: role === 'MANAGER' ? 'var(--accent-soft)' : 'var(--surface-hi)',
            color: role === 'MANAGER' ? 'var(--accent-strong)' : 'var(--text-2)',
            border: '0.5px solid var(--hairline)',
          }}>{role}</span>
        </div>
        <div className="footnote" style={{ marginTop: 2 }}>{login}</div>
      </div>
      {online && <div style={{
        width: 9, height: 9, borderRadius: 5,
        background: 'oklch(0.78 0.18 142)',
        boxShadow: '0 0 0 2px oklch(0.78 0.18 142 / 0.22)',
      }}/>}
      <Icon name="chevron-right" size={14} color="var(--text-3)"/>
      {!last && (
        <div style={{ position: 'absolute', left: 14, right: 0, bottom: 0, height: 0.5, background: 'var(--hairline)' }}/>
      )}
    </Press>
  );
}

Object.assign(window, { SettingsScreen });
