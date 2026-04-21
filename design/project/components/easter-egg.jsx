// Fish easter-egg — hold the logo to reveal a parallax Flappy-fish.
// Smoother physics + parallax starscape.

function FishGame({ onClose }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [state, setState] = useState('intro'); // 'intro' | 'play' | 'over'
  const stateRef = useRef('intro');
  const scoreRef = useRef(0);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const DPR = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.scale(DPR, DPR);

    // Parallax layers — stars & bubbles
    const layers = [
      { count: 40, speed: 0.3, r: 1.0, alpha: 0.25 },
      { count: 25, speed: 0.8, r: 1.6, alpha: 0.45 },
      { count: 12, speed: 1.5, r: 2.4, alpha: 0.7 },
    ].map(l => ({
      ...l,
      dots: Array.from({ length: l.count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
      })),
    }));

    let fish = { x: 80, y: H / 2, vy: 0 };
    let pipes = [];
    let frame = 0;
    let running = true;

    const GRAVITY = 0.28;
    const FLAP = -5.8;
    const PIPE_GAP = 170;
    const PIPE_W = 48;
    const PIPE_SPEED = 1.8;

    const reset = () => {
      fish = { x: 80, y: H / 2, vy: 0 };
      pipes = [];
      frame = 0;
      scoreRef.current = 0;
      setScore(0);
    };

    const flap = () => {
      if (stateRef.current === 'intro') {
        reset();
        setState('play'); stateRef.current = 'play';
      } else if (stateRef.current === 'over') {
        reset();
        setState('play'); stateRef.current = 'play';
      } else {
        fish.vy = FLAP;
      }
    };

    const onTap = () => flap();
    canvas.addEventListener('pointerdown', onTap);

    const drawFish = (x, y, tilt) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      // body
      const grad = ctx.createRadialGradient(-4, -3, 2, 0, 0, 18);
      grad.addColorStop(0, 'oklch(0.88 0.18 142)');
      grad.addColorStop(1, 'oklch(0.55 0.15 142)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // tail
      ctx.fillStyle = 'oklch(0.65 0.16 142)';
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-26, -8);
      ctx.lineTo(-26, 8);
      ctx.closePath();
      ctx.fill();
      // eye
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(7, -3, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a2010';
      ctx.beginPath(); ctx.arc(8, -3, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const tick = () => {
      if (!running) return;
      frame++;
      ctx.clearRect(0, 0, W, H);

      // background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0a0f14');
      bg.addColorStop(1, '#050810');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // parallax layers
      layers.forEach(l => {
        ctx.fillStyle = `oklch(0.85 0.18 142 / ${l.alpha})`;
        l.dots.forEach(d => {
          d.x -= l.speed * (stateRef.current === 'play' ? 1 : 0.25);
          if (d.x < -3) { d.x = W + 3; d.y = Math.random() * H; }
          ctx.beginPath();
          ctx.arc(d.x, d.y, l.r, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      if (stateRef.current === 'play') {
        fish.vy += GRAVITY;
        fish.y += fish.vy;

        // spawn pipes
        if (frame % 90 === 0) {
          const topY = 60 + Math.random() * (H - PIPE_GAP - 160);
          pipes.push({ x: W + 20, topY, passed: false });
        }

        pipes.forEach(p => { p.x -= PIPE_SPEED; });
        pipes = pipes.filter(p => p.x + PIPE_W > -10);

        // collisions
        pipes.forEach(p => {
          if (!p.passed && p.x + PIPE_W < fish.x - 18) {
            p.passed = true;
            scoreRef.current++;
            setScore(scoreRef.current);
          }
          const hitX = fish.x + 18 > p.x && fish.x - 18 < p.x + PIPE_W;
          const hitY = fish.y - 12 < p.topY || fish.y + 12 > p.topY + PIPE_GAP;
          if (hitX && hitY) { setState('over'); stateRef.current = 'over'; }
        });

        if (fish.y > H - 20 || fish.y < 20) { setState('over'); stateRef.current = 'over'; }
      } else if (stateRef.current === 'intro') {
        fish.y = H / 2 + Math.sin(frame * 0.05) * 12;
      } else {
        fish.vy += GRAVITY;
        fish.y = Math.min(H - 20, fish.y + fish.vy);
      }

      // draw pipes
      pipes.forEach(p => {
        const grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
        grad.addColorStop(0, 'oklch(0.2 0.05 142 / 0.7)');
        grad.addColorStop(0.5, 'oklch(0.28 0.08 142 / 0.8)');
        grad.addColorStop(1, 'oklch(0.18 0.04 142 / 0.7)');
        ctx.fillStyle = grad;
        ctx.strokeStyle = 'oklch(0.45 0.12 142 / 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(p.x, 0, PIPE_W, p.topY, 6); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(p.x, p.topY + PIPE_GAP, PIPE_W, H - p.topY - PIPE_GAP, 6); ctx.fill(); ctx.stroke();
      });

      // draw score top
      if (stateRef.current === 'play' || stateRef.current === 'over') {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = 'bold 64px Inter, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(scoreRef.current, W / 2, 80);
      }

      const tilt = Math.max(-0.4, Math.min(0.8, fish.vy * 0.07));
      drawFish(fish.x, fish.y, tilt);

      requestAnimationFrame(tick);
    };
    tick();

    return () => {
      running = false;
      canvas.removeEventListener('pointerdown', onTap);
    };
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 110,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      animation: 'slide-up-in 0.32s cubic-bezier(0.32, 0.72, 0, 1) both',
    }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        touchAction: 'none', cursor: 'pointer',
      }}/>

      <div style={{
        position: 'absolute', top: 52, right: 18, zIndex: 2,
      }}>
        <Press as="button" onClick={onClose} style={{
          width: 36, height: 36, borderRadius: 18, border: 0,
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="close" size={18} color="rgba(255,255,255,0.8)"/></Press>
      </div>

      {state === 'intro' && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '60%',
          textAlign: 'center', pointerEvents: 'none',
          color: 'rgba(255,255,255,0.7)', fontSize: 14, letterSpacing: '-0.01em',
        }}>tap to start</div>
      )}

      {state === 'over' && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '38%',
          textAlign: 'center', pointerEvents: 'none',
          animation: 'pop-in 0.4s cubic-bezier(0.32, 1.4, 0.4, 1) both',
        }}>
          <div style={{ color: '#fff', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>Game over</div>
          <div style={{ color: 'oklch(0.85 0.18 142)', fontSize: 17, fontWeight: 600, marginTop: 4 }}>Score: {score}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 10 }}>tap to try again</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { FishGame });
