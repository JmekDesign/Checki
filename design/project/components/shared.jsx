// Shared primitives
const { useState, useEffect, useRef, useLayoutEffect, useCallback } = React;

const LARI = '₾';

const Press = React.forwardRef(({ as: As = 'div', children, style, onClick, className, ...rest }, ref) => {
  const props = {
    ref, className: (className || '') + ' pressable', style,
    onClick, ...rest,
  };
  return <As {...props}>{children}</As>;
});

function GlassPill({ children, onClick, tone = 'default', style, size = 32, pad = 12, ...rest }) {
  const tones = {
    default: {},
    danger: { background: 'oklch(0.3 0.15 25 / 0.35)', borderColor: 'oklch(0.5 0.2 25 / 0.5)' },
    accent: { background: 'var(--accent-soft)', borderColor: 'oklch(var(--accent-l) var(--accent-s) var(--accent-h) / 0.3)' },
  };
  return (
    <Press as="button" onClick={onClick} className="glass" style={{
      height: size, minWidth: size, borderRadius: size/2,
      padding: `0 ${pad}px`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: 6, color: 'var(--text-1)', fontSize: 13, fontWeight: 600,
      background: tones[tone].background || 'var(--surface)',
      borderColor: tones[tone].borderColor || 'var(--hairline)',
      letterSpacing: '-0.01em',
      ...style,
    }} {...rest}>{children}</Press>
  );
}

function QuantityStepper({ value, onChange, min = 0, max = 99, size = 30 }) {
  const holdRef = useRef(null);
  const gap = size >= 30 ? 10 : 6;

  const bump = (delta) => {
    onChange(Math.max(min, Math.min(max, value + delta)));
  };
  const startHold = (delta) => {
    bump(delta);
    let t = 0;
    const step = () => {
      bump(delta);
      t = Math.max(50, 400 - t * 20);
      holdRef.current = setTimeout(step, t);
    };
    holdRef.current = setTimeout(step, 500);
  };
  const stopHold = () => clearTimeout(holdRef.current);

  const btn = (icon, delta, disabled) => (
    <Press as="button" disabled={disabled} style={{
      width: size, height: size, borderRadius: size/2, padding: 0,
      background: disabled ? 'var(--surface)' : 'var(--surface-strong)',
      color: disabled ? 'var(--text-3)' : 'var(--text-0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: 'inset 0 0.5px 0 var(--shine-top)',
      border: '0.5px solid var(--hairline-strong)',
    }}
      onPointerDown={() => !disabled && startHold(delta)}
      onPointerUp={stopHold} onPointerLeave={stopHold}
    >
      <Icon name={icon} size={size >= 30 ? 14 : 12} />
    </Press>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {btn('minus', -1, value <= min)}
      <div className="tabular" style={{
        minWidth: size >= 30 ? 22 : 16, textAlign: 'center',
        fontSize: size >= 30 ? 16 : 14, fontWeight: 600,
      }}>{value}</div>
      {btn('plus', +1, value >= max)}
    </div>
  );
}

// Venue header — logo doubles as easter-egg trigger (hold)
function VenueHeader({ venueName, onSettings, onHelp, onLogoHold }) {
  const holdRef = useRef(null);
  const triggeredRef = useRef(false);

  const onLogoDown = () => {
    triggeredRef.current = false;
    holdRef.current = setTimeout(() => {
      triggeredRef.current = true;
      onLogoHold && onLogoHold();
    }, 1500);
  };
  const onLogoUp = () => { clearTimeout(holdRef.current); };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '10px 14px',
      gap: 10, position: 'relative',
    }}>
      <div
        onPointerDown={onLogoDown} onPointerUp={onLogoUp} onPointerLeave={onLogoUp}
        style={{ width: 26, height: 26, flexShrink: 0, cursor: 'pointer', userSelect: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-0)' }}>
        <Icon name="logo" size={26} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em',
          color: 'var(--text-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{venueName}</span>
        <Press as="button" onClick={onSettings} style={{
          border: 0, background: 'transparent', padding: 6, color: 'var(--text-2)',
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}><Icon name="gear" size={20} /></Press>
      </div>

      <GlassPill onClick={onHelp} size={36} pad={0} style={{ width: 36 }}>
        <Icon name="help" size={20} color="var(--text-2)" />
      </GlassPill>
    </div>
  );
}

function BgWash() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: 'var(--bg-wash)',
    }} />
  );
}

Object.assign(window, {
  Press, GlassPill, QuantityStepper, VenueHeader, BgWash, LARI,
});
