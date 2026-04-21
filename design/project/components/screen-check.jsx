// Open Check screen — no category chips, yellow = scan-check flag only
const { useState: useStateC, useRef: useRefC, useEffect: useEffectC, useMemo } = React;

// ── Swipeable row with inline edit ─────────────────────────
function ItemRow({ item, index, onChangeQty, onDelete, onEditPrice, onCheck, style, bumpKey }) {
  const [swipe, setSwipe] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftPrice, setDraftPrice] = useState(String(item.price));
  const rowRef = useRef(null);
  const startXRef = useRef(null);
  const startYRef = useRef(null);
  const swipeRef = useRef(0);
  const lockedRef = useRef(null); // 'x' | 'y' | null

  useEffect(() => { setDraftPrice(String(item.price)); }, [item.price]);

  const commit = () => {
    const v = parseFloat(draftPrice);
    if (!isNaN(v) && v >= 0) onEditPrice(v);
    else setDraftPrice(String(item.price));
    setEditing(false);
  };

  const onPD = (e) => {
    if (editing) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    swipeRef.current = swipe;
    lockedRef.current = null;
  };
  const onPM = (e) => {
    if (startXRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (!lockedRef.current) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        lockedRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (lockedRef.current === 'x') {
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch(_) {}
        }
      }
    }
    if (lockedRef.current === 'x') {
      const next = Math.max(-120, Math.min(20, swipeRef.current + dx));
      setSwipe(next);
    }
  };
  const onPU = (e) => {
    if (startXRef.current === null) return;
    startXRef.current = null;
    startYRef.current = null;
    if (lockedRef.current === 'x') {
      if (swipe < -60) setSwipe(-100);
      else setSwipe(0);
    }
    lockedRef.current = null;
  };

  const checkStatus = item.needsCheck;

  // Yellow row styling for needsCheck (scan verification flag)
  const rowBg = checkStatus
    ? 'linear-gradient(var(--surface), var(--surface)), linear-gradient(90deg, oklch(0.5 0.14 75 / 0.16), oklch(0.5 0.14 75 / 0.08))'
    : 'linear-gradient(var(--surface), var(--surface))';

  return (
    <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', ...style }}>
      {/* behind: delete */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end',
        alignItems: 'stretch',
      }}>
        <Press as="button" onClick={onDelete} style={{
          width: 100, border: 0,
          background: 'linear-gradient(90deg, oklch(0.5 0.2 25 / 0), oklch(0.5 0.2 25))',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, fontWeight: 600, fontSize: 13,
        }}>
          <Icon name="trash" size={16} color="#fff" /> Delete
        </Press>
      </div>

      {/* row */}
      <div
        ref={rowRef}
        onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU}
        className="glass"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          borderRadius: 18, padding: '11px 14px',
          transform: `translateX(${swipe}px)`,
          transition: startXRef.current === null ? 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
          animation: 'slide-up-in 0.36s cubic-bezier(0.32, 0.72, 0, 1) both',
          animationDelay: `${index * 40}ms`,
          cursor: 'grab',
          touchAction: 'pan-y',
          background: 'var(--bg-1)',
          backgroundImage: rowBg,
          border: checkStatus
            ? '0.5px solid oklch(0.7 0.14 75 / 0.35)'
            : undefined,
          boxShadow: checkStatus
            ? 'inset 0 0.5px 0 var(--shine-top), 0 0 0 0.5px oklch(0.7 0.14 75 / 0.15), 0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.1)'
            : undefined,
        }}
      >
        {/* scan warning icon (left) — only if needsCheck */}
        {checkStatus && (
          <Press as="button" onClick={(e) => { e.stopPropagation(); onCheck(); }}
            title="Verify this item"
            style={{
              width: 22, height: 22, borderRadius: 11, padding: 0, flexShrink: 0,
              background: 'oklch(0.78 0.14 75)',
              border: 0, color: '#3a2a00',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginRight: 10,
              boxShadow: '0 0 12px oklch(0.78 0.14 75 / 0.5)',
            }}>
            <Icon name="warn" size={12} color="#3a2a00"/>
          </Press>
        )}

        {/* left: name + qty×price */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, marginRight: 8 }}>
          <span style={{
            fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em',
            color: 'var(--text-0)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            minWidth: 0,
          }}>{item.name}</span>
          <span className="footnote tabular" style={{ whiteSpace: 'nowrap' }}>
            {item.qty} × {editing ? (
              <input
                autoFocus
                value={draftPrice}
                onChange={e => setDraftPrice(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraftPrice(String(item.price)); setEditing(false); } }}
                style={{
                  width: 50, background: 'var(--surface-hi)', color: 'var(--text-0)',
                  border: '0.5px solid var(--accent)', borderRadius: 5,
                  padding: '1px 5px', fontSize: 12, fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            ) : (
              <Press as="span" onClick={e => { e.stopPropagation(); setEditing(true); }}
                style={{ textDecoration: 'underline dotted', textUnderlineOffset: 2, color: 'var(--text-2)' }}
              >{item.price}{LARI}</Press>
            )}
          </span>
        </div>

        {/* right: total (bumps on qty change) + stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div
            key={`total-${bumpKey}`}
            className="tabular"
            style={{
              display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end',
              animation: bumpKey ? 'qty-bump 0.36s cubic-bezier(0.32, 1.6, 0.4, 1) both' : undefined,
              transformOrigin: 'right center',
            }}>
            <span style={{
              fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-0)',
            }}>{item.qty * item.price}</span>
            <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>{LARI}</span>
          </div>
          <QuantityStepper value={item.qty} onChange={onChangeQty} size={26} />
        </div>
      </div>
    </div>
  );
}

// ── Add bar ────────────────────────────────────────────────
function AddBar({ onAdd, suggestions }) {
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 8);
    return suggestions.filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, suggestions]);

  const priceN = parseFloat(price) || 0;
  const total = priceN * qty;
  const canAdd = query.trim() && priceN > 0;

  const submit = () => {
    if (!canAdd) return;
    onAdd({ name: query.trim(), qty, price: priceN });
    setQuery(''); setPrice(''); setQty(1);
  };

  return (
    <div className="glass-strong" style={{
      borderRadius: 22, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="search" size={16} color="var(--text-2)" style={{ marginLeft: 4 }}/>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Add item… (type or tap a chip)"
          style={{
            flex: 1, background: 'transparent', border: 0, outline: 'none',
            fontSize: 15, fontWeight: 500, color: 'var(--text-0)',
            fontFamily: 'inherit', letterSpacing: '-0.01em',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <QuantityStepper value={qty} onChange={setQty} min={1} size={26} />
        {/* Price — now wider with "per unit" label and running total */}
        <div className="glass" style={{
          flex: 1, height: 32, borderRadius: 9, padding: '0 10px',
          display: 'flex', alignItems: 'center', gap: 4, minWidth: 0,
          position: 'relative',
        }}>
          <span style={{
            color: 'var(--text-3)', fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
            textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>per</span>
          <input
            value={price} onChange={e => setPrice(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            style={{
              flex: 1, background: 'transparent', border: 0, outline: 'none',
              color: 'var(--text-0)', fontSize: 14, fontWeight: 600,
              textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 0,
            }}
          />
          <span style={{ color: 'var(--text-2)', fontWeight: 600, fontSize: 12 }}>{LARI}</span>
        </div>
        <Press as="button" onClick={submit} disabled={!canAdd} style={{
          border: 0, height: 32, padding: '0 12px', borderRadius: 9, flexShrink: 0,
          minWidth: 58,
          background: !canAdd ? 'var(--surface)' : 'var(--accent)',
          color: !canAdd ? 'var(--text-3)' : '#0a0f0a',
          fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em',
          boxShadow: !canAdd ? 'none' : '0 4px 16px oklch(var(--accent-l) var(--accent-s) var(--accent-h) / 0.4), inset 0 0.5px 0 rgba(255,255,255,0.4)',
        }}>Add</Press>
      </div>

      {/* Running total hint — shows when user is entering price */}
      {canAdd && qty > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px',
          color: 'var(--text-2)', fontSize: 11,
        }}>
          <span>{qty} × {priceN}{LARI} =</span>
          <span className="tabular" style={{ color: 'var(--accent-strong)', fontWeight: 700, fontSize: 13 }}>
            {total}{LARI}
          </span>
        </div>
      )}

      {/* Quick-add chips */}
      <div className="noscrollbar" style={{
        display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
        marginLeft: -2, marginRight: -2,
      }}>
        {filtered.map(s => (
          <Press as="button" key={s.name} onClick={() => {
            setQuery(s.name);
            if (s.price) setPrice(String(s.price));
          }} className="glass" style={{
            border: 0, padding: '7px 12px', borderRadius: 999,
            color: 'var(--text-1)', fontSize: 13, fontWeight: 500,
            whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '-0.01em',
            background: 'var(--surface)',
          }}>
            {s.name}
            {s.price && <span style={{ color: 'var(--text-2)', marginLeft: 6, fontSize: 11 }}>{s.price}{LARI}</span>}
          </Press>
        ))}
      </div>
    </div>
  );
}

// ── Main Check screen ─────────────────────────────────────
function CheckScreen({ onNavigate, onHelp, onExit, onOpenSettings, onLogoHold, check, onClose, venueName }) {
  const [items, setItems] = useState(check?.itemsData || [
    { id: 'i1', name: 'Hoegaarden',   qty: 2, price: 17, needsCheck: true },
    { id: 'i2', name: 'Hoegaarden S', qty: 2, price: 10, needsCheck: true },
    { id: 'i3', name: 'Peanuts',      qty: 1, price: 6 },
  ]);
  const [highlightId, setHighlightId] = useState(null);
  const [bumpMap, setBumpMap] = useState({}); // id -> bumpKey for animation

  const suggestions = [
    { name: 'Beer Draft', price: 8 },
    { name: 'Hoegaarden', price: 17 },
    { name: 'Whisky', price: 12 },
    { name: 'Chacha', price: 12 },
    { name: 'Khinkali', price: 12 },
    { name: 'Jerky', price: 9 },
    { name: 'Wine Glass', price: 14 },
  ];

  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const checkCount = items.filter(i => i.needsCheck).length;

  const bumpItem = (id) => {
    setBumpMap(m => ({ ...m, [id]: (m[id] || 0) + 1 }));
  };

  const addItem = (it) => {
    const id = 'i' + Date.now();
    setItems(s => [...s, { id, ...it }]);
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 900);
  };

  const changeQty = (id, newQty) => {
    if (newQty === 0) {
      setItems(s => s.filter(x => x.id !== id));
    } else {
      setItems(s => s.map(x => x.id === id ? { ...x, qty: newQty } : x));
      bumpItem(id);
    }
  };

  const checkTitle = check?.table || 'Table 202';
  const checkId = check?.id || 6;
  const checkTime = check?.opened || '14:42';

  return (
    <div data-screen-label="Open Check" style={{
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

        {/* meta row: Back to open checks */}
        <div style={{ padding: '0 14px 4px', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <GlassPill onClick={() => onNavigate('main')}>
            <Icon name="chevron-left" size={13} color="var(--text-2)"/> Open checks
          </GlassPill>
          <GlassPill tone="danger" onClick={onClose}>Close check</GlassPill>
        </div>

        {/* check header */}
        <div style={{
          padding: '4px 18px 14px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap' }}>
              <span className="tabular" style={{
                fontSize: 15, fontWeight: 600, color: 'var(--text-2)',
              }}>#{checkId}</span>
              <span className="display tabular" style={{
                color: 'var(--text-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
              }}>{checkTitle}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, whiteSpace: 'nowrap' }}>
              <Icon name="clock" size={13} color="var(--text-2)"/>
              <span className="footnote tabular" style={{ whiteSpace: 'nowrap' }}>opened {checkTime}</span>
              <span className="footnote">·</span>
              <span className="footnote">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div
            key={`tot-${total}`}
            style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 4,
              padding: '6px 12px', borderRadius: 10, flexShrink: 0,
              background: 'var(--accent-soft)',
              border: '0.5px solid oklch(var(--accent-l) var(--accent-s) var(--accent-h) / 0.3)',
              boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.08)',
              animation: 'qty-bump 0.36s cubic-bezier(0.32, 1.6, 0.4, 1) both',
            }}>
            <span className="tabular" style={{
              fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em',
              color: 'var(--accent-strong)',
            }}>{total}</span>
            <span style={{ color: 'var(--accent-strong)', fontWeight: 700, fontSize: 14 }}>{LARI}</span>
          </div>
        </div>
      </div>

      {/* scrollable items */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '0 14px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
        position: 'relative', zIndex: 1,
      }}>
        {checkCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', marginBottom: 2,
            borderRadius: 12,
            background: 'oklch(0.5 0.14 75 / 0.12)',
            border: '0.5px solid oklch(0.7 0.14 75 / 0.28)',
            color: 'oklch(0.88 0.14 75)', fontSize: 12.5, fontWeight: 500,
            animation: 'slide-up-in 0.32s ease both',
          }}>
            <Icon name="warn" size={14}/>
            {checkCount} {checkCount === 1 ? 'item needs' : 'items need'} verification — tap <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 14, height: 14, borderRadius: 7, background: 'oklch(0.78 0.14 75)',
              color: '#3a2a00', margin: '0 2px',
            }}><Icon name="warn" size={8} color="#3a2a00"/></span> to confirm
          </div>
        )}

        {items.map((it, i) => (
          <div key={it.id} style={{
            animation: highlightId === it.id ? 'highlight-flash 0.9s ease both, pop-in 0.4s cubic-bezier(0.32, 1.4, 0.4, 1) both' : undefined,
            borderRadius: 18,
          }}>
            <ItemRow
              item={it} index={i}
              bumpKey={bumpMap[it.id]}
              onChangeQty={(q) => changeQty(it.id, q)}
              onDelete={() => setItems(s => s.filter(x => x.id !== it.id))}
              onEditPrice={(p) => setItems(s => s.map(x => x.id === it.id ? { ...x, price: p } : x))}
              onCheck={() => setItems(s => s.map(x => x.id === it.id ? { ...x, needsCheck: false } : x))}
            />
          </div>
        ))}

        {items.length === 0 && (
          <div style={{
            padding: '40px 20px', textAlign: 'center', color: 'var(--text-2)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>No items yet</div>
            <div className="footnote" style={{ marginTop: 4 }}>Add one below to get started</div>
          </div>
        )}
      </div>

      {/* bottom: add bar */}
      <div style={{ padding: '0 12px 12px', position: 'relative', zIndex: 2 }}>
        <AddBar onAdd={addItem} suggestions={suggestions} />
      </div>
    </div>
  );
}

Object.assign(window, { CheckScreen });
