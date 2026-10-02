/*
 * Wedding finale: night sky, fireworks, falling petals, a blooming sunflower
 * and the names reveal. Exposes window.Finale = { countdown, play, close }.
 *
 * Fireworks use the classic canvas technique: rockets climb, explode into
 * particles that drift under friction + gravity, and each frame the canvas is
 * faded slightly (instead of cleared) so every spark leaves a glowing trail.
 */
(() => {
  "use strict";

  const root = document.getElementById("finale");
  if (!root) return;

  const fwCanvas = document.getElementById("fireworksCanvas");
  const ptCanvas = document.getElementById("petalsCanvas");
  const fw = fwCanvas.getContext("2d");
  const pt = ptCanvas.getContext("2d");
  const countEl = document.getElementById("finalCount");
  const closeBtn = document.getElementById("finaleClose");
  const bloomEl = document.getElementById("bloom");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[(Math.random() * list.length) | 0];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ---------- One-time DOM decoration ---------- */

  // Names: split into letters so each one can rise into place.
  let letterIndex = 0;
  root.querySelectorAll(".name").forEach((el) => {
    el.setAttribute("aria-hidden", "true");
    [...el.dataset.text].forEach((ch) => {
      const span = document.createElement("span");
      span.className = "ch";
      span.textContent = ch;
      span.style.setProperty("--d", `${1500 + letterIndex * 130}ms`);
      el.appendChild(span);
      letterIndex += 1;
    });
    letterIndex += 1;
  });

  // Sunflower: two rings of petals around a seed head laid out with the
  // golden angle (the same pattern real sunflowers use).
  (function buildBloom() {
    const NS = "http://www.w3.org/2000/svg";
    const petal = (i, count, scale, fill, layer) => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("transform", `rotate(${(i / count) * 360 + layer * 7})`);
      const p = document.createElementNS(NS, "path");
      p.setAttribute(
        "d",
        `M0,-26 C${13 * scale},-46 ${12 * scale},-82 0,-${94 * scale} C${-12 * scale},-82 ${-13 * scale},-46 0,-26 Z`
      );
      p.setAttribute("fill", fill);
      p.setAttribute("stroke", "rgba(120,70,10,.35)");
      p.setAttribute("stroke-width", "0.8");
      p.setAttribute("class", "bloom-petal");
      p.style.setProperty("--i", String(i + layer * 5));
      g.appendChild(p);
      return g;
    };

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.innerHTML = `
      <defs>
        <linearGradient id="petalBack" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#d9880f"/><stop offset="1" stop-color="#f4bb2b"/>
        </linearGradient>
        <linearGradient id="petalFront" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#f0a818"/><stop offset="1" stop-color="#ffe27a"/>
        </linearGradient>
        <radialGradient id="seedBase" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="#4a2a10"/><stop offset="1" stop-color="#2a1608"/>
        </radialGradient>
      </defs>`;

    const flower = document.createElementNS(NS, "g");
    flower.setAttribute("transform", "translate(100 100)");
    flower.setAttribute("class", "bloom-spin");

    const back = document.createElementNS(NS, "g");
    for (let i = 0; i < 24; i += 1) back.appendChild(petal(i, 24, 1, "url(#petalBack)", 0));
    const front = document.createElementNS(NS, "g");
    for (let i = 0; i < 24; i += 1) front.appendChild(petal(i, 24, 0.82, "url(#petalFront)", 1));
    flower.append(back, front);

    const seedBase = document.createElementNS(NS, "circle");
    seedBase.setAttribute("r", "30");
    seedBase.setAttribute("fill", "url(#seedBase)");
    seedBase.setAttribute("class", "bloom-seeds");
    flower.appendChild(seedBase);

    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let n = 1; n <= 170; n += 1) {
      const r = 2.15 * Math.sqrt(n);
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", (r * Math.cos(n * golden)).toFixed(2));
      dot.setAttribute("cy", (r * Math.sin(n * golden)).toFixed(2));
      dot.setAttribute("r", (0.9 + (n / 170) * 0.9).toFixed(2));
      dot.setAttribute("fill", n % 3 === 0 ? "#a8691f" : "#6b3d14");
      dot.setAttribute("class", "bloom-seeds");
      flower.appendChild(dot);
    }

    svg.appendChild(flower);
    bloomEl.appendChild(svg);
  })();

  /* ---------- Canvas sizing ---------- */

  let W = 0;
  let H = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    [fwCanvas, ptCanvas].forEach((c) => {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    });
    fw.setTransform(dpr, 0, 0, dpr, 0, 0);
    pt.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  /* ---------- Fireworks ---------- */

  // Warm, romantic palettes that match the site: gold, rose, peach, champagne.
  const PALETTES = {
    gold: ["#ffd76a", "#ffb627", "#fff1b8", "#ffe08a"],
    rose: ["#ff8fab", "#ff5d8f", "#ffc2d1", "#ffffff"],
    peach: ["#ffd3b0", "#ffb38a", "#ff9d76", "#fff0e0"],
    champagne: ["#ffffff", "#ffeeb5", "#f6c94d", "#ffe9d6"],
    blush: ["#ffb3c6", "#f7a1c4", "#ffd6e0", "#ffe8a3"],
  };
  const PALETTE_NAMES = Object.keys(PALETTES);

  const rockets = [];
  const sparks = [];
  const flashes = [];
  const MAX_SPARKS = 2600;

  const ROCKET_GRAVITY = 0.16;

  function shoot({ kind, palette, tx, apex }) {
    const x0 = clamp(tx + rand(-40, 40), 30, W - 30);
    const apexY = apex * H;
    const vy = -Math.sqrt(2 * ROCKET_GRAVITY * Math.max(H - apexY, 80));
    const frames = -vy / ROCKET_GRAVITY;
    rockets.push({
      x: x0,
      y: H + 8,
      vx: (tx - x0) / frames,
      vy,
      kind,
      palette,
    });
  }

  function addSpark(x, y, vx, vy, opts) {
    if (sparks.length >= MAX_SPARKS) return;
    sparks.push({
      x,
      y,
      px: x,
      py: y,
      vx,
      vy,
      life: 1,
      decay: opts.decay,
      color: opts.color,
      size: opts.size || 2.2,
      friction: opts.friction,
      gravity: opts.gravity,
      twinkle: !!opts.twinkle,
      crackle: !!opts.crackle,
    });
  }

  function burst(x, y, kind, paletteName) {
    const pal = PALETTES[paletteName];
    const s = clamp(Math.min(W, H) / 720, 0.55, 1.3);
    flashes.push({ x, y, r: 260 * s, life: 1, color: pal[0] });

    if (kind === "peony" || kind === "crackle") {
      const n = Math.round(130 * clamp(s + 0.25, 0.7, 1.2));
      const power = rand(5.4, 6.6) * s;
      for (let i = 0; i < n; i += 1) {
        const a = rand(0, TAU);
        const sp = power * (Math.random() < 0.7 ? rand(0.88, 1) : rand(0.4, 0.88));
        addSpark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
          decay: rand(0.011, 0.017),
          color: pick(pal),
          friction: 0.957,
          gravity: 0.05,
          twinkle: Math.random() < 0.25,
          crackle: kind === "crackle" && Math.random() < 0.3,
        });
      }
    } else if (kind === "ring") {
      const n = 72;
      const tilt = rand(0.3, 1);
      const rot = rand(0, TAU);
      const power = 5.6 * s;
      const color = pick(pal);
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * TAU;
        const cx = Math.cos(a) * power;
        const cy = Math.sin(a) * power * tilt;
        addSpark(x, y, cx * Math.cos(rot) - cy * Math.sin(rot), cx * Math.sin(rot) + cy * Math.cos(rot), {
          decay: 0.014,
          color,
          friction: 0.95,
          gravity: 0.03,
        });
      }
    } else if (kind === "heart") {
      // Classic parametric heart curve, expanded outward from the burst point.
      const layers = [
        { n: 90, power: 6.6 * s, color: pal[1], size: 2.2 },
        { n: 52, power: 3.7 * s, color: pal[2], size: 1.8 },
      ];
      layers.forEach(({ n, power, color, size }) => {
        for (let i = 0; i < n; i += 1) {
          const t = (i / n) * TAU;
          const hx = 16 * Math.pow(Math.sin(t), 3);
          const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          addSpark(x, y, (hx / 16) * power, (hy / 16) * power, {
            decay: 0.0085,
            color,
            size,
            friction: 0.94,
            gravity: 0.012,
            twinkle: true,
          });
        }
      });
    } else if (kind === "willow") {
      for (let i = 0; i < 95; i += 1) {
        const a = rand(0, TAU);
        const sp = rand(1.4, 5.6) * s;
        addSpark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
          decay: rand(0.0055, 0.009),
          color: pick(PALETTES.gold),
          size: 1.4,
          friction: 0.972,
          gravity: 0.07,
          twinkle: true,
        });
      }
    }
  }

  const KINDS = ["peony", "peony", "crackle", "crackle", "ring", "willow", "willow", "heart"];

  function randomShot() {
    shoot({
      kind: pick(KINDS),
      palette: pick(PALETTE_NAMES),
      // keep most bursts to the sides so the names stay readable
      tx: (Math.random() < 0.5 ? rand(0.07, 0.33) : rand(0.67, 0.93)) * W,
      apex: rand(0.14, 0.48),
    });
  }

  function volley(count, gap) {
    for (let i = 0; i < count; i += 1) {
      const at = i * gap;
      schedule(at, () =>
        shoot({
          kind: pick(["peony", "crackle", "ring"]),
          palette: pick(PALETTE_NAMES),
          tx: ((i + 0.5) / count) * W,
          apex: rand(0.15, 0.42),
        })
      );
    }
  }

  function updateFireworks(dt) {
    // Fade the previous frame so sparks leave glowing trails.
    fw.globalCompositeOperation = "destination-out";
    fw.fillStyle = `rgba(0,0,0,${clamp(0.13 * dt, 0.08, 0.4)})`;
    fw.fillRect(0, 0, W, H);
    fw.globalCompositeOperation = "lighter";
    fw.lineCap = "round";

    for (let i = rockets.length - 1; i >= 0; i -= 1) {
      const r = rockets[i];
      const ox = r.x;
      const oy = r.y;
      r.vy += ROCKET_GRAVITY * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      // lay the trail along the whole path travelled this frame (no gaps)
      for (let k = 1; k <= 4; k += 1) {
        const f = k / 4;
        addSpark(ox + (r.x - ox) * f, oy + (r.y - oy) * f, rand(-0.2, 0.2), rand(0.1, 0.6), {
          decay: rand(0.045, 0.07),
          color: "#ffe6b0",
          size: 1.5,
          friction: 0.9,
          gravity: 0.02,
        });
      }
      fw.globalAlpha = 1;
      fw.fillStyle = "#fff6dc";
      fw.beginPath();
      fw.arc(r.x, r.y, 2, 0, TAU);
      fw.fill();
      if (r.vy >= -0.4) {
        burst(r.x, r.y, r.kind, r.palette);
        rockets.splice(i, 1);
      }
    }

    for (let i = flashes.length - 1; i >= 0; i -= 1) {
      const f = flashes[i];
      f.life -= 0.055 * dt;
      if (f.life <= 0) {
        flashes.splice(i, 1);
        continue;
      }
      const g = fw.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, f.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      fw.globalAlpha = f.life * f.life * 0.22;
      fw.fillStyle = g;
      fw.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }

    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const p = sparks[i];
      p.px = p.x;
      p.py = p.y;
      const fr = Math.pow(p.friction, dt);
      p.vx *= fr;
      p.vy = p.vy * fr + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;

      if (p.crackle && p.life < 0.22) {
        p.crackle = false;
        for (let k = 0; k < 4; k += 1) {
          addSpark(p.x, p.y, rand(-2.2, 2.2), rand(-2.2, 2.2), {
            decay: rand(0.05, 0.09),
            color: "#ffffff",
            size: 1.1,
            friction: 0.92,
            gravity: 0.03,
          });
        }
      }

      if (p.life <= 0 || p.y > H + 40) {
        sparks.splice(i, 1);
        continue;
      }

      let alpha = clamp(p.life * 1.4, 0, 1);
      if (p.twinkle && Math.random() < 0.28) alpha *= 0.25;
      const w = p.size * (0.6 + p.life * 0.9);
      fw.strokeStyle = p.color;
      fw.beginPath();
      fw.moveTo(p.px, p.py);
      fw.lineTo(p.x, p.y);
      // soft halo, then a brighter core
      fw.globalAlpha = alpha * 0.28;
      fw.lineWidth = w * 4;
      fw.stroke();
      fw.globalAlpha = alpha;
      fw.lineWidth = w;
      fw.stroke();
    }
    fw.globalAlpha = 1;
    fw.globalCompositeOperation = "source-over";
  }

  /* ---------- Falling petals & hearts ---------- */

  const PETAL_COLORS = [
    ["#ffb3c1", "#ffd6de"],
    ["#f28ba0", "#ffc1cd"],
    ["#ffd76a", "#fff0b3"],
    ["#ffe9c9", "#fffaf0"],
    ["#f6c94d", "#ffe9a0"],
  ];
  const petals = [];

  function makePetal(fromTop) {
    const size = rand(7, 15) * clamp(Math.min(W, H) / 760 + 0.35, 0.7, 1.2);
    return {
      x: rand(-20, W + 20),
      y: fromTop ? rand(-60, -10) : rand(0, H),
      size,
      vy: rand(0.55, 1.35) * (size / 11),
      sway: rand(18, 48),
      swaySpeed: rand(0.008, 0.02),
      phase: rand(0, TAU),
      rot: rand(0, TAU),
      rotSpeed: rand(-0.02, 0.02),
      flip: rand(0, TAU),
      flipSpeed: rand(0.02, 0.055),
      colors: pick(PETAL_COLORS),
      heart: Math.random() < 0.12,
    };
  }

  function drawPetal(p) {
    const s = p.size;
    pt.save();
    pt.translate(p.x + Math.sin(p.phase) * p.sway, p.y);
    pt.rotate(p.rot);
    pt.scale(1, Math.max(0.18, Math.abs(Math.cos(p.flip))));
    pt.globalAlpha = 0.9;
    pt.fillStyle = p.colors[0];
    pt.beginPath();
    if (p.heart) {
      pt.moveTo(0, s * 0.45);
      pt.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.5, -s * 1.05, 0, -s * 0.4);
      pt.bezierCurveTo(s * 0.5, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.45);
    } else {
      pt.moveTo(0, -s);
      pt.bezierCurveTo(s * 0.95, -s * 0.6, s * 0.85, s * 0.55, 0, s);
      pt.bezierCurveTo(-s * 0.85, s * 0.55, -s * 0.95, -s * 0.6, 0, -s);
    }
    pt.fill();
    if (!p.heart) {
      pt.strokeStyle = p.colors[1];
      pt.globalAlpha = 0.75;
      pt.lineWidth = Math.max(0.8, s * 0.09);
      pt.beginPath();
      pt.moveTo(0, -s * 0.8);
      pt.quadraticCurveTo(s * 0.12, 0, 0, s * 0.8);
      pt.stroke();
    }
    pt.restore();
  }

  function updatePetals(dt, elapsed) {
    pt.clearRect(0, 0, W, H);
    const maxPetals = W < 600 ? 42 : 85;
    const target = clamp(Math.floor((elapsed - 1200) / 70), 0, maxPetals);
    while (petals.length < target) petals.push(makePetal(true));

    for (let i = 0; i < petals.length; i += 1) {
      const p = petals[i];
      p.y += p.vy * dt;
      p.phase += p.swaySpeed * dt;
      p.rot += p.rotSpeed * dt;
      p.flip += p.flipSpeed * dt;
      if (p.y > H + 30) {
        petals[i] = makePetal(true);
        continue;
      }
      drawPetal(p);
    }
  }

  /* ---------- Timeline + main loop ---------- */

  let running = false;
  let celebrating = false;
  let counting = false;
  let startedAt = 0;
  let lastFrame = 0;
  let nextAmbient = 0;
  let nextVolley = 0;
  let queue = [];
  let stopTimer = 0;
  let previousFocus = null;

  function schedule(delay, fn) {
    queue.push({ at: performance.now() - startedAt + delay, fn });
  }

  function frame(now) {
    if (!running) return;
    const dt = clamp((now - lastFrame) / 16.667, 0.2, 3);
    lastFrame = now;
    const elapsed = now - startedAt;

    for (let i = queue.length - 1; i >= 0; i -= 1) {
      if (queue[i].at <= elapsed) {
        const { fn } = queue[i];
        queue.splice(i, 1);
        fn();
      }
    }

    if (celebrating) {
      if (elapsed > nextAmbient) {
        randomShot();
        nextAmbient = elapsed + rand(600, 1150);
      }
      if (elapsed > nextVolley) {
        volley(9, 130);
        nextVolley = elapsed + 16000;
      }
    }

    updateFireworks(dt);
    updatePetals(dt, celebrating ? elapsed : 0);
    requestAnimationFrame(frame);
  }

  function startLoop() {
    clearTimeout(stopTimer);
    if (running || reduceMotion) return;
    running = true;
    lastFrame = performance.now();
    requestAnimationFrame(frame);
  }

  function open() {
    if (!root.classList.contains("is-on")) {
      previousFocus = document.activeElement;
      root.classList.add("is-on");
      root.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    startLoop();
  }

  let lastCount = 0;
  function countdown(n) {
    if (celebrating || n === lastCount) return;
    lastCount = n;
    counting = true;
    open();
    root.classList.add("is-counting");
    countEl.textContent = String(n);
    countEl.classList.remove("pop");
    void countEl.offsetWidth;
    countEl.classList.add("pop");
    if (n <= 3 && !reduceMotion) {
      shoot({ kind: "peony", palette: "gold", tx: rand(0.3, 0.7) * W, apex: rand(0.25, 0.4) });
    }
  }

  function play() {
    if (celebrating) return;
    celebrating = true;
    counting = false;
    root.classList.remove("is-counting", "is-celebrating");
    countEl.classList.remove("pop");
    open();
    void root.offsetWidth; // restart the CSS animations on replays
    root.classList.add("is-celebrating");

    startedAt = performance.now();
    queue = [];
    petals.length = 0;
    nextAmbient = 4600;
    nextVolley = 9000;

    if (!reduceMotion) {
      schedule(250, () => shoot({ kind: "peony", palette: "gold", tx: W * 0.5, apex: 0.3 }));
      schedule(650, () => shoot({ kind: "peony", palette: "rose", tx: W * 0.25, apex: 0.36 }));
      schedule(850, () => shoot({ kind: "peony", palette: "peach", tx: W * 0.75, apex: 0.34 }));
      schedule(2100, () => shoot({ kind: "heart", palette: "rose", tx: W * 0.5, apex: 0.3 }));
      schedule(3400, () => shoot({ kind: "ring", palette: "champagne", tx: W * 0.22, apex: 0.3 }));
      schedule(3600, () => shoot({ kind: "ring", palette: "gold", tx: W * 0.78, apex: 0.3 }));
    }
    setTimeout(() => closeBtn.focus({ preventScroll: true }), 2800);
  }

  function close() {
    if (!root.classList.contains("is-on")) return;
    celebrating = false;
    counting = false;
    root.classList.remove("is-on", "is-celebrating", "is-counting");
    if (typeof api.onClose === "function") api.onClose();
    root.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (previousFocus && previousFocus.focus) previousFocus.focus({ preventScroll: true });
    stopTimer = setTimeout(() => {
      running = false;
      rockets.length = 0;
      sparks.length = 0;
      flashes.length = 0;
      petals.length = 0;
      queue = [];
      fw.clearRect(0, 0, W, H);
      pt.clearRect(0, 0, W, H);
    }, 1800);
  }

  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && celebrating) close();
  });

  const api = { countdown, play, close, onClose: null };
  window.Finale = api;
})();
