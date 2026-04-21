// App shell
const ACCENT_MAP = {
  green:  { h: 148, s: 0.17, l: 0.76 },
  blue:   { h: 240, s: 0.15, l: 0.72 },
  amber:  { h: 75,  s: 0.15, l: 0.82 },
  violet: { h: 295, s: 0.18, l: 0.7  },
  mono:   { h: 260, s: 0.02, l: 0.78 },
};

function App() {
  const [tweaks, setTweaks] = useState(window.TWEAKS);
  const [transitioning, setTransitioning] = useState(false);
  const [screen, setScreenState] = useState('main'); // main | check | settings | newCheck
  const [activeCheck, setActiveCheck] = useState(null);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [fishOpen, setFishOpen] = useState(false);

  // Theme: resolve 'auto' -> dark/light via prefers-color-scheme
  const resolvedTheme = (() => {
    if (tweaks.theme === 'auto') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      return 'dark';
    }
    return tweaks.theme;
  })();

  useEffect(() => {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${resolvedTheme}`);
    const a = ACCENT_MAP[tweaks.accent] || ACCENT_MAP.green;
    document.documentElement.style.setProperty('--accent-h', a.h);
    document.documentElement.style.setProperty('--accent-s', a.s);
    document.documentElement.style.setProperty('--accent-l', a.l);
  }, [resolvedTheme, tweaks.accent]);

  const goScreen = (next) => {
    if (next === screen) return;
    setTransitioning(true);
    setTimeout(() => {
      setScreenState(next);
      setTimeout(() => setTransitioning(false), 40);
    }, 140);
  };

  const updateTweak = (k, v) => {
    setTweaks(t => {
      const next = { ...t, [k]: v };
      try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*'); } catch(e) {}
      return next;
    });
    document.querySelectorAll(`[data-tweak="${k}"] button`).forEach(b => {
      b.classList.toggle('on', b.dataset.val === String(v));
    });
  };

  useEffect(() => {
    const handler = (e) => {
      const btn = e.target.closest('[data-tweak] button');
      if (!btn) return;
      const key = btn.parentElement.dataset.tweak;
      updateTweak(key, btn.dataset.val);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    const listener = (e) => {
      if (!e.data || !e.data.type) return;
      if (e.data.type === '__activate_edit_mode') document.getElementById('tweaks').classList.add('on');
      if (e.data.type === '__deactivate_edit_mode') document.getElementById('tweaks').classList.remove('on');
    };
    window.addEventListener('message', listener);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch(e) {}
    return () => window.removeEventListener('message', listener);
  }, []);

  useEffect(() => {
    Object.entries(tweaks).forEach(([k, v]) => {
      document.querySelectorAll(`[data-tweak="${k}"] button`).forEach(b => {
        b.classList.toggle('on', b.dataset.val === String(v));
      });
    });
  }, []);

  const dark = resolvedTheme === 'dark';
  const venueName = 'Demo Venue';

  const commonProps = {
    venueName,
    onHelp: () => setStoriesOpen(true),
    onExit: () => {},
    onLogoHold: () => setFishOpen(true),
    onOpenSettings: () => goScreen('settings'),
  };

  let screenEl;
  if (screen === 'main') {
    screenEl = <MainScreen
      {...commonProps}
      onOpenCheck={(c) => { setActiveCheck(c); goScreen('check'); }}
      onNewCheck={() => goScreen('newCheck')}
    />;
  } else if (screen === 'settings') {
    screenEl = <SettingsScreen
      {...commonProps}
      onNavigate={goScreen}
      theme={tweaks.theme}
      onThemeChange={(v) => updateTweak('theme', v)}
    />;
  } else if (screen === 'newCheck') {
    screenEl = <NewCheckScreen
      {...commonProps}
      onNavigate={goScreen}
      onOpenCheck={(c) => { setActiveCheck(c); goScreen('check'); }}
    />;
  } else {
    screenEl = <CheckScreen
      {...commonProps}
      onNavigate={goScreen}
      dark={dark}
      check={activeCheck}
      onClose={() => goScreen('main')}
    />;
  }

  const frameBg = dark ? '#050506' : '#F3F3F6';

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        width: 402, height: 874, borderRadius: 55, overflow: 'hidden',
        position: 'relative',
        background: frameBg,
        boxShadow: '0 40px 100px rgba(0,0,0,0.5), 0 0 0 12px #1d1d1f, 0 0 0 13px rgba(255,255,255,0.04)',
        WebkitFontSmoothing: 'antialiased',
      }}>
        <div style={{
          position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
          width: 126, height: 37, borderRadius: 24, background: '#000', zIndex: 50,
        }}/>

        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40 }}>
          <IOSStatusBar dark={dark} time="15:00"/>
        </div>

        <div style={{
          height: '100%', width: '100%',
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? 'scale(0.985)' : 'scale(1)',
          transition: 'opacity 0.2s ease, transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        }}>
          {screenEl}
        </div>

        {storiesOpen && <StoriesOverlay onClose={() => setStoriesOpen(false)}/>}
        {fishOpen && <FishGame onClose={() => setFishOpen(false)}/>}

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 60,
          height: 34, display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
          paddingBottom: 8, pointerEvents: 'none',
        }}>
          <div style={{
            width: 139, height: 5, borderRadius: 100,
            background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.35)',
          }}/>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
