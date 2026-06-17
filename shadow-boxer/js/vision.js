/* vision.js — the camera. Pulls webcam frames, diffs them into a motion grid,
   and exposes "how much movement is happening where" so the fight engine can
   tell punches/blocks/slips apart. Also renders the mirrored video plus the
   equipped boxing gloves that track your hands. Falls back to keyboard/touch
   controls when there's no camera. Exposes SB.vision. */
(function (global) {
  const SB = (global.SB = global.SB || {});

  // processing resolution (small = fast) and the motion grid laid over it
  const PW = 96, PH = 72, COLS = 8, ROWS = 6;
  const CW = PW / COLS, CH = PH / ROWS;

  let video = null, proc = null, pctx = null;     // capture
  let disp = null, dctx = null;                    // visible canvas
  let stream = null;
  let running = false, rafId = null, frameOK = false;
  let mode = 'idle';                               // 'camera' | 'manual'

  let prev = null;                                  // previous gray frame
  const cells = new Float32Array(COLS * ROWS);      // smoothed motion 0..1
  let total = 0, stillEMA = 1;
  const left = { x: 0.3, y: 0.45, mag: 0 };
  const right = { x: 0.7, y: 0.45, mag: 0 };
  const trailL = [], trailR = [];

  let glove = SB.data.glove('classic');
  let sens = 1.0;

  // manual fallback state
  const manual = { left: 0, right: 0, guard: false };

  function init(displayCanvas) {
    disp = displayCanvas;
    dctx = disp.getContext('2d');
    video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.autoplay = true;
    proc = document.createElement('canvas'); proc.width = PW; proc.height = PH;
    pctx = proc.getContext('2d', { willReadFrequently: true });
  }

  async function start() {
    sens = SB.store.settings().sensitivity || 1.0;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      mode = 'camera';
      frameOK = true;
    } catch (e) {
      console.warn('camera unavailable -> manual mode', e);
      mode = 'manual';
      frameOK = false;
    }
    prev = null;
    if (!running) { running = true; renderLoop(); }
    return mode === 'camera';
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (video) video.srcObject = null;
    mode = 'idle';
  }

  function setGlove(g) { glove = g || glove; }
  function setSensitivity(v) { sens = v; }

  // ---------- per-frame motion analysis ----------
  function analyse() {
    if (mode !== 'camera' || video.readyState < 2) return;
    // mirror the draw so the player sees a mirror and motion x matches
    pctx.save();
    pctx.scale(-1, 1);
    pctx.drawImage(video, -PW, 0, PW, PH);
    pctx.restore();

    const img = pctx.getImageData(0, 0, PW, PH).data;
    const gray = new Float32Array(PW * PH);
    for (let i = 0, p = 0; i < img.length; i += 4, p++)
      gray[p] = (img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114);

    if (!prev) { prev = gray; return; }

    const raw = new Float32Array(COLS * ROWS);
    for (let y = 0; y < PH; y++) {
      const row = y * PW, cy = (y / CH) | 0;
      for (let x = 0; x < PW; x++) {
        const d = Math.abs(gray[row + x] - prev[row + x]);
        if (d > 20) raw[cy * COLS + ((x / CW) | 0)] += 1;
      }
    }
    prev = gray;

    // normalise + smooth, then find the strongest cell in each half (hands)
    const cellPix = CW * CH;
    let sum = 0, lBest = -1, rBest = -1, lIdx = 0, rIdx = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const v = Math.min(1, raw[i] / cellPix);
        cells[i] = cells[i] * 0.5 + v * 0.5;
        sum += cells[i];
        // ignore the very bottom row (torso sway) for hand peaks
        if (r < ROWS - 1) {
          if (c < COLS / 2) { if (cells[i] > lBest) { lBest = cells[i]; lIdx = i; } }
          else { if (cells[i] > rBest) { rBest = cells[i]; rIdx = i; } }
        }
      }
    }
    total = sum / (COLS * ROWS);
    stillEMA = stillEMA * 0.6 + (1 - Math.min(1, total * 9)) * 0.4;

    updatePeak(left, lIdx, lBest, trailL);
    updatePeak(right, rIdx, rBest, trailR);
  }

  function updatePeak(peak, idx, mag, trail) {
    const c = idx % COLS, r = (idx / COLS) | 0;
    const nx = (c + 0.5) / COLS, ny = (r + 0.5) / ROWS;
    const m = Math.min(1, mag * 1.4);
    if (m > 0.06) { peak.x = peak.x * 0.4 + nx * 0.6; peak.y = peak.y * 0.4 + ny * 0.6; }
    peak.mag = peak.mag * 0.5 + m * 0.5;
    trail.push({ x: peak.x, y: peak.y, m: peak.mag });
    if (trail.length > 7) trail.shift();
  }

  function manualDecay() {
    manual.left *= 0.8; manual.right *= 0.8;
    left.mag = left.mag * 0.5 + manual.left * 0.5;
    right.mag = right.mag * 0.5 + manual.right * 0.5;
    left.x = 0.28; left.y = 0.46; right.x = 0.72; right.y = 0.46;
    total = Math.max(manual.left, manual.right);
    stillEMA = manual.guard ? 1 : 1 - total;
    if (left.mag > 0.05) trailL.push({ x: left.x, y: left.y, m: left.mag });
    if (right.mag > 0.05) trailR.push({ x: right.x, y: right.y, m: right.mag });
    if (trailL.length > 7) trailL.shift();
    if (trailR.length > 7) trailR.shift();
  }

  // ---------- public motion queries (normalised 0..1 coords) ----------
  // average smoothed motion inside a rect; scaled by the player's sensitivity
  function motionInRect(x0, y0, x1, y1) {
    if (mode === 'manual') {
      const cx = (x0 + x1) / 2;
      const v = cx < 0.5 ? manual.left : manual.right;
      return manual.guard ? v * 0.3 : v;
    }
    const c0 = Math.max(0, Math.floor(x0 * COLS)), c1 = Math.min(COLS - 1, Math.ceil(x1 * COLS) - 1);
    const r0 = Math.max(0, Math.floor(y0 * ROWS)), r1 = Math.min(ROWS - 1, Math.ceil(y1 * ROWS) - 1);
    let s = 0, n = 0;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { s += cells[r * COLS + c]; n++; }
    return n ? Math.min(1, (s / n) * 2.2 * sens) : 0;
  }
  const totalMotion = () => Math.min(1, total * 2.2 * sens);
  const stillness = () => stillEMA;

  // ---------- rendering ----------
  function renderLoop() {
    if (!running) return;
    if (mode === 'camera') analyse(); else manualDecay();
    draw();
    rafId = requestAnimationFrame(renderLoop);
  }

  function fit() {
    const r = disp.getBoundingClientRect();
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (disp.width !== w || disp.height !== h) { disp.width = w; disp.height = h; }
  }

  function draw() {
    if (!dctx) return;
    fit();
    const W = disp.width, H = disp.height;
    dctx.clearRect(0, 0, W, H);

    if (mode === 'camera' && frameOK && video.readyState >= 2) {
      // cover-fit, mirrored
      const vw = video.videoWidth || 4, vh = video.videoHeight || 3;
      const scale = Math.max(W / vw, H / vh);
      const dw = vw * scale, dh = vh * scale;
      dctx.save();
      dctx.translate(W, 0); dctx.scale(-1, 1);
      dctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
      dctx.restore();
      // darken slightly so HUD pops
      dctx.fillStyle = 'rgba(8,8,12,0.28)';
      dctx.fillRect(0, 0, W, H);
    } else {
      // manual / no-camera backdrop
      const g = dctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#15151f'); g.addColorStop(1, '#0a0a10');
      dctx.fillStyle = g; dctx.fillRect(0, 0, W, H);
      dctx.fillStyle = 'rgba(255,255,255,.06)';
      dctx.font = `${Math.round(H * 0.04)}px system-ui`;
      dctx.textAlign = 'center';
      dctx.fillText('NO CAMERA — KEYBOARD / TAP MODE', W / 2, H * 0.5);
    }

    drawGlove(trailL, left, W, H);
    drawGlove(trailR, right, W, H);
  }

  function drawGlove(trail, peak, W, H) {
    if (peak.mag < 0.05) return;
    const t = global.performance.now() / 1000;
    const hueShift = glove.shimmer ? Math.sin(t * 3) * 0.5 + 0.5 : 0;
    // trail
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const a = (i / trail.length) * 0.35 * p.m;
      dctx.beginPath();
      dctx.arc(p.x * W, p.y * H, (10 + p.m * 26) * (i / trail.length + 0.4), 0, Math.PI * 2);
      dctx.fillStyle = hexA(glove.glow, a);
      dctx.fill();
    }
    const x = peak.x * W, y = peak.y * H, R = 16 + peak.mag * 34;
    // glow
    dctx.shadowColor = glove.glow; dctx.shadowBlur = 24 + peak.mag * 30;
    // glove body — radial gradient a->b
    const grad = dctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.2, x, y, R);
    grad.addColorStop(0, glove.a);
    grad.addColorStop(1, shimmerMix(glove.b, glove.a, hueShift));
    dctx.beginPath(); dctx.arc(x, y, R, 0, Math.PI * 2);
    dctx.fillStyle = grad; dctx.fill();
    dctx.shadowBlur = 0;
    // knuckle highlight
    dctx.beginPath(); dctx.arc(x - R * 0.25, y - R * 0.28, R * 0.28, 0, Math.PI * 2);
    dctx.fillStyle = 'rgba(255,255,255,.5)'; dctx.fill();
    // thumb
    dctx.beginPath(); dctx.arc(x + R * 0.7, y + R * 0.4, R * 0.42, 0, Math.PI * 2);
    dctx.fillStyle = grad; dctx.fill();
  }

  // ---------- colour helpers ----------
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function shimmerMix(b, a, t) {
    if (!t) return b;
    const pb = parseInt(b.slice(1), 16), pa = parseInt(a.slice(1), 16);
    const mix = (x, y) => Math.round(x + (y - x) * t * 0.6);
    const r = mix((pb >> 16) & 255, (pa >> 16) & 255);
    const g = mix((pb >> 8) & 255, (pa >> 8) & 255);
    const bl = mix(pb & 255, pa & 255);
    return `rgb(${r},${g},${bl})`;
  }

  // ---------- manual control hooks (used in fallback) ----------
  function punch(side, power) {
    if (side === 'left') manual.left = power || 1; else manual.right = power || 1;
  }
  function setGuard(on) { manual.guard = on; }

  SB.vision = {
    init, start, stop, setGlove, setSensitivity,
    motionInRect, totalMotion, stillness,
    punch, setGuard,
    get mode() { return mode; },
    get isCamera() { return mode === 'camera'; },
    get left() { return left; },
    get right() { return right; },
  };
})(window);
