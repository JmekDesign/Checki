// Icons
const Icon = ({ name, size = 20, color = 'currentColor', style = {} }) => {
  const s = { width: size, height: size, ...style };
  const sw = 1.75;
  const common = { fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'gear': return (
      <svg viewBox="0 0 24 24" style={s}>
        <circle cx="12" cy="12" r="3" {...common} />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" {...common} />
      </svg>
    );
    case 'help': return (
      <svg viewBox="0 0 24 24" style={s}>
        <circle cx="12" cy="12" r="9.5" {...common} />
        <path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" {...common} />
        <circle cx="12" cy="17" r="0.6" fill={color} />
      </svg>
    );
    case 'exit': return (
      <svg viewBox="0 0 24 24" style={s}>
        <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" {...common} />
        <path d="M10 17l5-5-5-5M15 12H3" {...common} />
      </svg>
    );
    case 'chevron-left': return (<svg viewBox="0 0 24 24" style={s}><path d="M15 18l-6-6 6-6" {...common} /></svg>);
    case 'chevron-right': return (<svg viewBox="0 0 24 24" style={s}><path d="M9 18l6-6-6-6" {...common} /></svg>);
    case 'close': return (<svg viewBox="0 0 24 24" style={s}><path d="M6 6l12 12M18 6L6 18" {...common} /></svg>);
    case 'plus': return (<svg viewBox="0 0 24 24" style={s}><path d="M12 5v14M5 12h14" {...common} /></svg>);
    case 'minus': return (<svg viewBox="0 0 24 24" style={s}><path d="M5 12h14" {...common} /></svg>);
    case 'check': return (<svg viewBox="0 0 24 24" style={s}><path d="M4 12l5 5L20 6" {...common} /></svg>);
    case 'warn': return (
      <svg viewBox="0 0 24 24" style={s}>
        <path d="M12 3L2 20h20L12 3z" {...common} />
        <path d="M12 10v4M12 17.5v0.1" {...common} strokeLinecap="round" />
      </svg>
    );
    case 'trash': return (
      <svg viewBox="0 0 24 24" style={s}>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" {...common} />
      </svg>
    );
    case 'search': return (
      <svg viewBox="0 0 24 24" style={s}>
        <circle cx="11" cy="11" r="7" {...common} />
        <path d="M21 21l-4.5-4.5" {...common} />
      </svg>
    );
    case 'clock': return (
      <svg viewBox="0 0 24 24" style={s}>
        <circle cx="12" cy="12" r="9.5" {...common} />
        <path d="M12 6v6l4 2" {...common} />
      </svg>
    );
    case 'user': return (
      <svg viewBox="0 0 24 24" style={s}>
        <circle cx="12" cy="8" r="4" {...common} />
        <path d="M4 21a8 8 0 0116 0" {...common} />
      </svg>
    );
    case 'camera': return (
      <svg viewBox="0 0 24 24" style={s}>
        <path d="M3 7h3l2-3h8l2 3h3a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1z" {...common}/>
        <circle cx="12" cy="13" r="4" {...common}/>
      </svg>
    );
    case 'receipt': return (
      <svg viewBox="0 0 24 24" style={s}>
        <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z" {...common}/>
        <path d="M8 8h8M8 12h8M8 16h4" {...common}/>
      </svg>
    );
    case 'sparkle': return (
      <svg viewBox="0 0 24 24" style={s}>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" {...common}/>
      </svg>
    );
    case 'tag': return (
      <svg viewBox="0 0 24 24" style={s}>
        <path d="M20 13L13 20a2 2 0 01-2.8 0L3 12.8V4h8.8L20 12.2a.6.6 0 010 .8z" {...common}/>
        <circle cx="7.5" cy="7.5" r="1.2" fill={color}/>
      </svg>
    );
    case 'logo': return (
      <svg viewBox="0 0 144.8 144.8" style={s} fill="none">
        <path fill="currentColor" d="M74.9,127.9c-14.2,0-28.4-5.4-39.3-16.2-21.6-21.6-21.6-56.9,0-78.5,21.6-21.6,56.9-21.6,78.5,0l-17.2,17.2c-12.1-12.1-31.9-12.1-44,0-12.1,12.1-12.1,31.9,0,44,12.1,12.1,31.9,12.1,44,0l17.2,17.2c-10.8,10.8-25,16.2-39.3,16.2Z"/>
        <circle cx="74.9" cy="72.4" r="18.5" fill="#48d07b"/>
      </svg>
    );
    default: return null;
  }
};

Object.assign(window, { Icon });
