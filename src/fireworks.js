// fireworks.js — sparkly fireworks for a dark page background (glowing dot streaks).
// Drop a <canvas> behind your content and call startFireworks(canvas, { avoid: cardEl }).
// No dependencies. Respects prefers-reduced-motion and pauses when the tab is hidden.

/** Yellow, gold, silver, and cream — Diwali-friendly on maroon backgrounds. */
export const PALETTE = [
  '#ffe566',
  '#f8c94e',
  '#e8b923',
  '#f2a145',
  '#d4a017',
  '#c9890a',
  '#e8e4dc',
  '#c9c5bd',
  '#b0aca4',
  '#fff8eb',
  '#fff3d6',
  '#f5e6c8',
];

export const PRESETS = {
  calm: { every: [2600, 4200], double: 0.10 },
  festive: { every: [1200, 2400], double: 0.25 },
  finale: { every: [250, 600], double: 0.40 },
};

export function startFireworks(canvas, opts = {}) {
  const o = {
    preset: 'calm',
    avoid: null,
    avoidPad: 40,
    colors: PALETTE,
    clickToLaunch: true,
    ...opts,
  };
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { set() {}, burst() {}, stop() {} };
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let raf = 0;
  let timer = 0;
  let running = true;
  const rockets = [];
  const bursts = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spot() {
    const r = o.avoid?.getBoundingClientRect();
    for (let i = 0; i < 30; i++) {
      const x = rand(W * 0.04, W * 0.96);
      const y = rand(H * 0.08, H * 0.55);
      if (!r) return { x, y };
      const p = o.avoidPad;
      if (x < r.left - p || x > r.right + p || y < r.top - p || y > r.bottom + p) return { x, y };
    }
    return {
      x: Math.random() < 0.5 ? rand(20, W * 0.12) : rand(W * 0.88, W - 20),
      y: rand(H * 0.1, H * 0.4),
    };
  }

  function launch(at) {
    const t = at || spot();
    rockets.push({
      x0: t.x + rand(-30, 30),
      y0: H + 10,
      x: 0,
      y: 0,
      tx: t.x,
      ty: t.y,
      t: 0,
      dur: rand(900, 1300),
      wob: rand(0, 6.28),
      trail: [],
      color: pick(o.colors),
    });
  }

  function burstSpread() {
    const span = Math.min(W, H) || 800;
    return rand(span * 0.12, span * 0.21);
  }

  function explode(x, y) {
    const n = rand(32, 44) | 0;
    const R = burstSpread();
    const c1 = pick(o.colors);
    const c2 = Math.random() < 0.5 ? c1 : pick(o.colors);
    const rays = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.08, 0.08);
      rays.push({ a, len: R * rand(0.9, 1.1), color: i % 2 ? c1 : c2 });
    }
    const nFill = (n * 0.55) | 0;
    for (let i = 0; i < nFill; i++) {
      const a = (i / nFill) * Math.PI * 2 + Math.PI / nFill + rand(-0.06, 0.06);
      rays.push({ a, len: R * rand(0.78, 1.02), color: pick(o.colors) });
    }
    bursts.push({
      x,
      y,
      rays,
      t: 0,
      dur: rand(1300, 1800),
      R,
      crackle: Math.random() < 0.6,
    });
  }

  function schedule() {
    clearTimeout(timer);
    if (!running) return;
    const p = PRESETS[o.preset] || PRESETS.calm;
    timer = setTimeout(() => {
      if (!document.hidden) {
        launch();
        if (Math.random() < p.double) setTimeout(() => launch(), rand(150, 400));
      }
      schedule();
    }, rand(...p.every));
  }

  const easeOut = (t) => 1 - (1 - t) ** 3;

  function drawRocket(r, dt) {
    r.t += dt / r.dur;
    const e = easeOut(Math.min(1, r.t));
    r.x = r.x0 + (r.tx - r.x0) * e + Math.sin(r.wob + r.t * 9) * 2.5;
    r.y = r.y0 + (r.ty - r.y0) * e;
    r.trail.push([r.x, r.y]);
    if (r.trail.length > 14) r.trail.shift();
    ctx.lineCap = 'round';
    for (let i = 1; i < r.trail.length; i++) {
      ctx.globalAlpha = (i / r.trail.length) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(...r.trail[i - 1]);
      ctx.lineTo(...r.trail[i]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(r.x, r.y, 1.8, 0, 7);
    ctx.fill();
    return r.t >= 1;
  }

  function drawBurst(b, dt) {
    b.t += dt / b.dur;
    const t = Math.min(1, b.t);
    const grow = easeOut(Math.min(1, t * 1.45));
    const fade = 1 - Math.max(0, (t - 0.35) / 0.65);
    const sag = 14 * t * t;
    for (const r of b.rays) {
      const ca = Math.cos(r.a);
      const sa = Math.sin(r.a);
      const outer = r.len * grow;
      const steps = 9;
      for (let k = 0; k < steps; k++) {
        const f = 0.36 + (1 - 0.36) * (1 - k / (steps - 1));
        const dist = outer * f;
        if (dist < b.R * 0.14 * grow) continue;
        const px = b.x + ca * dist;
        const py = b.y + sa * dist + sag * f;
        ctx.globalAlpha = fade * (0.92 - k * 0.07);
        ctx.fillStyle = r.color;
        const dotR = 1.55 - k * 0.08;
        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, 7);
        ctx.fill();
      }
    }
    if (b.crackle && t > 0.45 && t < 0.95) {
      ctx.fillStyle = '#fff3d6';
      for (let i = 0; i < 24; i++) {
        if (Math.random() < 0.22) continue;
        const ray = b.rays[(Math.random() * b.rays.length) | 0];
        const d = ray.len * grow * rand(0.45, 1.05);
        ctx.globalAlpha = fade * rand(0.45, 1);
        ctx.fillRect(
          b.x + Math.cos(ray.a) * d,
          b.y + Math.sin(ray.a) * d + sag * (d / ray.len),
          1.4,
          1.4,
        );
      }
    }
    ctx.globalAlpha = 1;
    return b.t >= 1;
  }

  let last = performance.now();

  function frame(now) {
    if (document.hidden) {
      raf = 0;
      return;
    }
    const dt = Math.min(50, now - last);
    last = now;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = rockets.length - 1; i >= 0; i--) {
      if (drawRocket(rockets[i], dt)) {
        explode(rockets[i].tx, rockets[i].ty);
        rockets.splice(i, 1);
      }
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      if (drawBurst(bursts[i], dt)) bursts.splice(i, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    raf = running ? requestAnimationFrame(frame) : 0;
  }

  function drawStill() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      const s = spot();
      explode(s.x, s.y);
    }
    bursts.forEach((b) => {
      b.t = 0.5;
      drawBurst(b, 0.0001);
    });
    bursts.length = 0;
  }

  function onClick(e) {
    if (!o.clickToLaunch || reduce) return;
    if (e.target.closest('button,a,input,textarea,select,label,[role=button]')) return;
    const r = o.avoid?.getBoundingClientRect();
    if (r && e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) {
      return;
    }
    launch({ x: e.clientX, y: e.clientY });
  }

  function onVis() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (running && !raf && !reduce) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  resize();
  addEventListener('resize', reduce ? () => { resize(); drawStill(); } : resize);
  document.addEventListener('visibilitychange', onVis);
  addEventListener('pointerdown', onClick);
  if (reduce) drawStill();
  else {
    launch();
    schedule();
    raf = requestAnimationFrame(frame);
  }

  return {
    set(next) {
      Object.assign(o, next);
      schedule();
    },
    burst(x, y) {
      launch(x != null ? { x, y } : undefined);
    },
    stop() {
      running = false;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      raf = 0;
      removeEventListener('pointerdown', onClick);
      document.removeEventListener('visibilitychange', onVis);
      ctx.clearRect(0, 0, W, H);
    },
  };
}
