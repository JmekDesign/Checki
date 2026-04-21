/* Checki Easter Egg — Flappy Fish 🐟
   Trigger: hold the logo in the top-left corner for 2 seconds */
(function () {
  "use strict";

  const GRAVITY    = 0.38;
  const FLAP_V     = -7;
  const PIPE_SPEED = 2.4;
  const PIPE_GAP   = 138;
  const PIPE_W     = 52;
  const SPAWN_MS   = 1700;
  const FISH_X_PCT = 0.25; // fish horizontal position as fraction of W

  let canvas, ctx, W, H;
  let raf = null;
  let fish, pipes, score, state, lastSpawn;

  /* ── BUILD DOM ─────────────────────────────────────────────────────── */
  const overlay = document.createElement("div");
  overlay.id = "checkilGameOverlay";
  Object.assign(overlay.style, {
    display: "none", position: "fixed", inset: "0",
    zIndex: "3000", background: "#0f1116", touchAction: "none",
    userSelect: "none", WebkitUserSelect: "none",
  });

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  Object.assign(closeBtn.style, {
    position: "absolute", top: "14px", right: "16px",
    background: "none", border: "none", color: "#7a8497",
    fontSize: "22px", cursor: "pointer", zIndex: "1",
    padding: "10px", lineHeight: "1",
  });

  canvas = document.createElement("canvas");
  Object.assign(canvas.style, { display: "block" });

  overlay.appendChild(canvas);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
  ctx = canvas.getContext("2d");

  /* ── RESIZE ────────────────────────────────────────────────────────── */
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);

  /* ── OPEN / CLOSE ──────────────────────────────────────────────────── */
  function openGame() {
    resize();
    overlay.style.display = "block";
    initGame();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function closeGame() {
    overlay.style.display = "none";
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  closeBtn.addEventListener("click",     e => { e.stopPropagation(); closeGame(); });
  closeBtn.addEventListener("touchend",  e => { e.stopPropagation(); closeGame(); });
  document.addEventListener("keydown",   e => { if (e.key === "Escape") closeGame(); });

  /* ── LONG PRESS TRIGGER ────────────────────────────────────────────── */
  let holdTimer = null;

  function attachLongPress() {
    const logo = document.querySelector(".topLeft svg");
    if (!logo) return;
    logo.style.cursor = "pointer";
    logo.style.userSelect = "none";
    logo.style.webkitUserSelect = "none";
    logo.style.webkitTouchCallout = "none";

    const startHold = () => { holdTimer = setTimeout(openGame, 2000); };
    const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };

    logo.addEventListener("touchstart",  startHold,  { passive: true });
    logo.addEventListener("touchend",    cancelHold);
    logo.addEventListener("touchcancel", cancelHold);
    logo.addEventListener("mousedown",   startHold);
    logo.addEventListener("mouseup",     cancelHold);
    logo.addEventListener("mouseleave",  cancelHold);
  }

  // Wait for DOM to be ready (script may load before venue name is set)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachLongPress);
  } else {
    attachLongPress();
  }

  /* ── GAME STATE ────────────────────────────────────────────────────── */
  function initGame() {
    fish     = { y: H / 2, vy: 0 };
    pipes    = [];
    score    = 0;
    state    = "waiting";
    lastSpawn = 0;
  }

  /* ── INPUT ─────────────────────────────────────────────────────────── */
  function handleTap() {
    if (state === "dead") {
      initGame();
      return;
    }
    if (state === "waiting") state = "playing";
    fish.vy = FLAP_V;
  }

  overlay.addEventListener("touchstart", e => { e.preventDefault(); handleTap(); }, { passive: false });
  overlay.addEventListener("mousedown",  () => handleTap());

  /* ── SPAWN ─────────────────────────────────────────────────────────── */
  function spawnPipe() {
    const margin = 90;
    const gapY   = margin + Math.random() * (H - margin * 2 - PIPE_GAP);
    pipes.push({ x: W, gapY, passed: false });
  }

  /* ── DRAWING ───────────────────────────────────────────────────────── */
  function drawFish(x, y) {
    ctx.save();
    const tilt = Math.max(-0.45, Math.min(0.65, fish.vy * 0.065));
    ctx.translate(x, y);
    ctx.rotate(tilt);

    // tail
    ctx.fillStyle = "#2eb865";
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-28, -10);
    ctx.lineTo(-28,  10);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.fillStyle = "#49d17c";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // eye white
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(10, -3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // pupil
    ctx.fillStyle = "#0f1116";
    ctx.beginPath();
    ctx.arc(11, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function pipe_roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();
    ctx.stroke();
  }

  function drawPipe(p) {
    ctx.fillStyle   = "#1a2130";
    ctx.strokeStyle = "#2a3545";
    ctx.lineWidth   = 1.5;

    const topH = p.gapY;
    pipe_roundRect(p.x, 0, PIPE_W, topH, [0, 0, 8, 8]);

    const botY = p.gapY + PIPE_GAP;
    pipe_roundRect(p.x, botY, PIPE_W, H - botY, [8, 8, 0, 0]);
  }

  function drawScore() {
    ctx.fillStyle  = "rgba(240,242,245,0.9)";
    ctx.font       = "bold 32px system-ui, sans-serif";
    ctx.textAlign  = "center";
    ctx.textBaseline = "top";
    ctx.fillText(score, W / 2, 22);
  }

  function drawWaiting() {
    ctx.fillStyle    = "#7a8497";
    ctx.font         = "15px system-ui, sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("tap to start", W / 2, H / 2 + 56);
  }

  function drawDead() {
    ctx.fillStyle = "rgba(15,17,22,0.72)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#f0f2f5";
    ctx.font      = "bold 30px system-ui, sans-serif";
    ctx.fillText("Game over", W / 2, H / 2 - 22);

    ctx.fillStyle = "#49d17c";
    ctx.font      = "22px system-ui, sans-serif";
    ctx.fillText("Score: " + score, W / 2, H / 2 + 14);

    ctx.fillStyle = "#7a8497";
    ctx.font      = "14px system-ui, sans-serif";
    ctx.fillText("tap to try again", W / 2, H / 2 + 46);
  }

  /* ── GAME LOOP ─────────────────────────────────────────────────────── */
  function loop(ts) {
    raf = requestAnimationFrame(loop);

    // clear
    ctx.fillStyle = "#0f1116";
    ctx.fillRect(0, 0, W, H);

    const fishX = W * FISH_X_PCT;

    if (state === "playing") {
      // physics
      fish.vy += GRAVITY;
      fish.y  += fish.vy;

      // spawn pipes
      if (lastSpawn === 0) lastSpawn = ts;
      if (ts - lastSpawn > SPAWN_MS) {
        spawnPipe();
        lastSpawn = ts;
      }

      // move & score pipes
      for (const p of pipes) {
        p.x -= PIPE_SPEED;
        if (!p.passed && p.x + PIPE_W < fishX) {
          p.passed = true;
          score++;
        }
      }
      pipes = pipes.filter(p => p.x + PIPE_W > 0);

      // collision: walls
      if (fish.y + 11 > H || fish.y - 11 < 0) state = "dead";

      // collision: pipes (slightly forgiving hitbox)
      for (const p of pipes) {
        if (fishX + 15 > p.x && fishX - 15 < p.x + PIPE_W) {
          if (fish.y - 9 < p.gapY || fish.y + 9 > p.gapY + PIPE_GAP) {
            state = "dead";
          }
        }
      }
    }

    // idle float animation
    if (state === "waiting") {
      fish.y = H / 2 + Math.sin(ts / 600) * 14;
    }

    // draw pipes
    for (const p of pipes) drawPipe(p);

    // draw fish
    drawFish(fishX, fish.y);

    // HUD
    if (state === "playing")             drawScore();
    if (state === "waiting")             drawWaiting();
    if (state === "dead")  { drawScore(); drawDead(); }
  }
})();
