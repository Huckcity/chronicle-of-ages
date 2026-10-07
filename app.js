'use strict';
// ===================== Chronicle: interface =====================
(() => {
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const BIOME_RGB = { DEEP: [28, 52, 82], OCEAN: [38, 72, 106], SHALLOW: [64, 112, 146], LAKE: [72, 122, 156], BEACH: [210, 194, 148], GRASS: [132, 158, 90], STEPPE: [176, 168, 106], FOREST: [76, 112, 66], JUNGLE: [54, 102, 60], SAVANNA: [184, 164, 90], DESERT: [218, 190, 130], SWAMP: [96, 120, 88], TAIGA: [86, 110, 84], TUNDRA: [160, 160, 140], SNOW: [228, 230, 232], MOUNTAIN: [132, 122, 112], PEAK: [212, 208, 202] };
const BIOME_COLORS = BIOMES.map(b => BIOME_RGB[b.key]);
const WORDS1 = 'amber ashen bitter broken cold copper crimson drowned ember far golden grey hollow iron ivory jade lonely misty old pale red salt silent silver sunken thorn white wild winter'.split(' ');
const WORDS2 = 'anvil bay crag crown dawn fen fjord harbour isle keep lantern marsh mere moor oak peak reach river shore spire star stone tide tower vale wall weald wyrm'.split(' ');
const KIND_LABEL = { human: 'humans', elf: 'elves', dwarf: 'dwarves', orc: 'orcs' };
const fmtPop = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + ' million' : n >= 1000 ? Math.round(n / 1000) + ' thousand' : String(Math.round(n));
const fmtPopShort = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(Math.round(n));
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Yield to the browser between work chunks without timer throttling (background tabs clamp setTimeout to ~1 Hz).
const yieldNext = (() => { try { const ch = new MessageChannel(); let cb = null; ch.port1.onmessage = () => { const f = cb; cb = null; if (f) f(); }; return fn => { cb = fn; ch.port2.postMessage(0); }; } catch (e) { return fn => setTimeout(fn, 0); } })();

function hslToRgb(h, s, l) {
  s /= 100; l /= 100; const k = n => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

// ---------- state ----------
let world = null, S = null, year = 1, playing = false, speed = 3, selected = -1, filter = 'all', filterWar = -1, tab = 'chronicle';
let seed = '', ready = false, detailOpen = false;
let terrain = null, polCv = null, polCtx = null, polImg = null, ownerBuf = null, ownerYear = -1, polYear = -1, polSel = -2;
let borderPath = null, borderYear = -1, selPath = null, selPathCiv = -2, selPathYear = -1;
let yearData = null; // per-year derived (cell counts, label cells)
let civRGB = [], civCss = [], civDark = [];
const view = { scale: 4, ox: 0, oy: 0, min: 1 };
let canvas, ctx, dpr = 1, cw = 0, ch = 0;
let drawQueued = false, lastT = 0, acc = 0;
let hover = null; // {x,y,cell}
let chronRendered = { count: 0, lastYear: 0, key: '' };
let userScrolledUp = false;
let flash = null; // {cell, t0}

// ---------- seeds ----------
function randomSeed() { const r = Math.random; return `${WORDS1[Math.floor(r() * WORDS1.length)]}-${WORDS2[Math.floor(r() * WORDS2.length)]}-${Math.floor(r() * 90 + 10)}`; }
function cleanSeed(s) { return String(s || '').trim().replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }

// ---------- world creation ----------
function forgeWorld(newSeed, startYear) {
  seed = cleanSeed(newSeed) || randomSeed();
  $('#seedInput').value = seed; $('#seedName').textContent = seed;
  try { history.replaceState(null, '', '#' + seed); } catch (e) {}
  playing = false; ready = false; updatePlayButton(); selected = -1; filter = 'all'; filterWar = -1; hover = null; civRGB = []; civCss = []; civDark = []; yearData = null; chronRendered = { count: 0, lastYear: 0, key: '' };
  const loading = $('#loading'); loading.hidden = false; $('#loadbar').style.width = '0%'; $('#loadmsg').textContent = 'Raising the mountains and cutting the rivers…';
  setTimeout(() => {
    world = generateWorld(seed, 320, 200);
    S = simulateHistory(seed, world, 0);
    terrain = buildTerrain(world);
    ownerBuf = new Int16Array(world.N); ownerYear = -1; polYear = -1; polSel = -2; borderYear = -1; selPathYear = -1;
    polCv = document.createElement('canvas'); polCv.width = world.W; polCv.height = world.H; polCtx = polCv.getContext('2d'); polImg = polCtx.createImageData(world.W, world.H);
    const target = 500;
    const step = () => {
      const n = Math.min(25, target - S.simulated); S.advance(n);
      $('#loadbar').style.width = (100 * S.simulated / target).toFixed(0) + '%';
      const alive = S.civs.filter(c => c.fell < 0).length, wars = S.wars.filter(w => w.end < 0).length;
      $('#loadmsg').textContent = `Year ${S.simulated}: ${alive} realms, ${wars} war${wars === 1 ? '' : 's'} raging, ${S.events.length} entries written`;
      if (S.simulated < target) yieldNext(step); else finishWorld(startYear);
    };
    yieldNext(step);
  }, 30);
}
function finishWorld(startYear) {
  civColors(); ready = true;
  $('#tl').max = S.totalYears; $('#loading').hidden = true;
  setYear(startYear || 1, true);
  fitView(); drawTimeline(); renderAll();
  if (!reduceMotion && !startYear) { playing = true; updatePlayButton(); }
  requestDraw();
}
function extendHistory(n) {
  const btn = $('#btnExtend'); if (btn) { btn.disabled = true; btn.textContent = 'The scribes are writing…'; }
  const target = S.totalYears + n;
  const step = () => { S.advance(Math.min(25, target - S.simulated)); if (S.simulated < target) yieldNext(step); else { civColors(); $('#tl').max = S.totalYears; drawTimeline(); renderAll(); requestDraw(); playing = !reduceMotion; updatePlayButton(); } };
  yieldNext(step);
}
function civColors() {
  for (let i = civRGB.length; i < S.civs.length; i++) { const c = S.civs[i]; civRGB[i] = hslToRgb(c.hue, c.sat, 52); civCss[i] = `hsl(${c.hue.toFixed(0)} ${c.sat.toFixed(0)}% 48%)`; civDark[i] = `hsl(${c.hue.toFixed(0)} ${Math.min(80, c.sat + 10).toFixed(0)}% 24%)`; }
}

// ---------- terrain ----------
function buildTerrain(world) {
  const { W, H, N, biome, shade, river, isLand, elev } = world;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c2 = cv.getContext('2d'); const img = c2.createImageData(W, H); const d = img.data;
  for (let i = 0; i < N; i++) {
    const b = biome[i]; const col = BIOME_COLORS[b]; let r = col[0], g = col[1], bl = col[2];
    if (!isLand[i]) { const depth = Math.min(1, (0.5 - elev[i]) * 2.2); r *= 1 - depth * 0.3; g *= 1 - depth * 0.25; bl *= 1 - depth * 0.12; }
    const sh = isLand[i] ? 0.7 + shade[i] * 0.46 : 0.92 + shade[i] * 0.12;
    const n = ((Math.imul(i, 2654435761) >>> 0) % 11) - 5;
    r = r * sh + n; g = g * sh + n; bl = bl * sh + n;
    if (river[i] > 0 && isLand[i] && b !== B.LAKE) { const a = 0.4 + 0.17 * river[i]; r = r * (1 - a) + 66 * a; g = g * (1 - a) + 116 * a; bl = bl * (1 - a) + 156 * a; }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = bl; d[i * 4 + 3] = 255;
  }
  c2.putImageData(img, 0, 0); return cv;
}

// ---------- year-dependent layers ----------
function ownerFor(y) { if (ownerYear !== y) { ownerAt(S, y, ownerBuf); ownerYear = y; } return ownerBuf; }
function buildPolitical(y) {
  if (polYear === y && polSel === selected) return;
  const ob = ownerFor(y); const d = polImg.data; const N = world.N;
  for (let i = 0; i < N; i++) {
    const o = ob[i]; const k = i * 4;
    if (o < 0) { d[k + 3] = 0; continue; }
    const c = civRGB[o]; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2];
    d[k + 3] = selected < 0 ? 112 : o === selected ? 165 : 60;
  }
  polCtx.putImageData(polImg, 0, 0); polYear = y; polSel = selected;
}
function buildBorders(y) {
  if (borderYear === y) return;
  const ob = ownerFor(y); const { W, H } = world; const p = new Path2D();
  for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) {
    const i = yy * W + x; const o = ob[i];
    if (x < W - 1 && ob[i + 1] !== o) { p.moveTo(x + 1, yy); p.lineTo(x + 1, yy + 1); }
    if (yy < H - 1 && ob[i + W] !== o) { p.moveTo(x, yy + 1); p.lineTo(x + 1, yy + 1); }
  }
  borderPath = p; borderYear = y;
}
function buildSelPath(y) {
  if (selPathYear === y && selPathCiv === selected) return;
  selPath = null; selPathYear = y; selPathCiv = selected; if (selected < 0) return;
  const ob = ownerFor(y); const { W, H } = world; const p = new Path2D();
  for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) {
    const i = yy * W + x; const o = ob[i]; const me = o === selected;
    if (x < W - 1 && (ob[i + 1] === selected) !== me) { p.moveTo(x + 1, yy); p.lineTo(x + 1, yy + 1); }
    if (yy < H - 1 && (ob[i + W] === selected) !== me) { p.moveTo(x, yy + 1); p.lineTo(x + 1, yy + 1); }
    if (x === 0 && me) { p.moveTo(0, yy); p.lineTo(0, yy + 1); }
    if (yy === 0 && me) { p.moveTo(x, 0); p.lineTo(x + 1, 0); }
  }
  selPath = p;
}
function computeYearData(y) {
  if (yearData && yearData.year === y && yearData.nciv === S.civs.length) return yearData;
  const ob = ownerFor(y); const { W, H, N } = world; const n = S.civs.length;
  const cnt = new Int32Array(n), sx = new Float64Array(n), sy = new Float64Array(n);
  for (let i = 0; i < N; i++) { const o = ob[i]; if (o < 0) continue; cnt[o]++; sx[o] += i % W; sy[o] += (i / W) | 0; }
  const labels = [];
  for (let c = 0; c < n; c++) {
    if (!cnt[c]) continue;
    let cx = sx[c] / cnt[c], cy = sy[c] / cnt[c];
    let lx = Math.round(cx), ly = Math.round(cy);
    if (ob[ly * W + lx] !== c) { // spiral search for owned cell nearest centroid
      let found = false;
      for (let r = 1; r < 40 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; const xx = lx + dx, yy = ly + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        if (ob[yy * W + xx] === c) { lx = xx; ly = yy; found = true; break; }
      }
    }
    labels.push({ civ: c, cells: cnt[c], x: lx + 0.5, y: ly + 0.5 });
  }
  const aliveN = S.civs.filter(c => c.founded <= y && (c.fell < 0 || c.fell > y)).length;
  yearData = { year: y, nciv: n, cnt, labels, aliveN };
  return yearData;
}

// ---------- drawing ----------
function requestDraw() { if (drawQueued) return; drawQueued = true; requestAnimationFrame(draw); }
function fitView() {
  const s = Math.min(cw / world.W, ch / world.H) * 0.98; view.min = s * 0.9; view.scale = s;
  view.ox = (cw - world.W * s) / 2; view.oy = (ch - world.H * s) / 2;
}
function clampView() {
  const mw = world.W * view.scale, mh = world.H * view.scale;
  if (mw <= cw) view.ox = (cw - mw) / 2; else view.ox = Math.min(0, Math.max(cw - mw, view.ox));
  if (mh <= ch) view.oy = (ch - mh) / 2; else view.oy = Math.min(0, Math.max(ch - mh, view.oy));
}
function zoomAt(f, px, py) {
  const ns = Math.max(view.min, Math.min(view.min * 14, view.scale * f)); const k = ns / view.scale;
  view.ox = px - (px - view.ox) * k; view.oy = py - (py - view.oy) * k; view.scale = ns; clampView(); requestDraw();
}
function toCell(px, py) { const x = Math.floor((px - view.ox) / view.scale), y = Math.floor((py - view.oy) / view.scale); if (x < 0 || y < 0 || x >= world.W || y >= world.H) return -1; return y * world.W + x; }
function cityVisible(city, y) { return city.founded >= 0 && city.founded <= y && (city.destroyed < 0 || city.destroyed > y) && cityOwnerAt(city, y) >= 0; }

function draw(ts) {
  drawQueued = false;
  if (!world || !S || !ready) return;
  if (playing) { if (lastT) { acc += (ts - lastT) / 1000 * speed; } lastT = ts; if (acc >= 1) { const n = Math.floor(acc); acc -= n; if (year + n > S.totalYears) { setYear(S.totalYears); playing = false; updatePlayButton(); } else setYear(year + n); } requestAnimationFrame(draw); drawQueued = true; }
  else { lastT = 0; acc = 0; }
  const y = year; const { W, H } = world;
  buildPolitical(y); buildBorders(y); buildSelPath(y); const yd = computeYearData(y);
  const styles = getComputedStyle(document.documentElement); const dark = styles.getPropertyValue('--is-dark').trim() === '1';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = styles.getPropertyValue('--map-bg').trim() || '#1c3452'; ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = false;
  const s = view.scale;
  ctx.drawImage(terrain, view.ox, view.oy, W * s, H * s);
  if (dark) { ctx.fillStyle = 'rgba(10,14,24,0.12)'; ctx.fillRect(view.ox, view.oy, W * s, H * s); }
  ctx.drawImage(polCv, view.ox, view.oy, W * s, H * s);
  // borders
  ctx.save(); ctx.translate(view.ox, view.oy); ctx.scale(s, s);
  ctx.lineWidth = Math.max(0.35, 1.1 / s); ctx.strokeStyle = 'rgba(20,16,12,0.55)'; ctx.stroke(borderPath);
  if (selPath) { ctx.lineWidth = Math.max(0.6, 2.4 / s); ctx.strokeStyle = dark ? 'rgba(255,245,220,0.95)' : 'rgba(255,255,255,0.95)'; ctx.stroke(selPath); ctx.lineWidth = Math.max(0.3, 1 / s); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke(selPath); }
  ctx.restore();
  ctx.imageSmoothingEnabled = true;
  // feature labels
  const zoomF = s / view.min;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const feats = world.features;
  for (const f of feats) {
    if (!f.name || f.kind === 'field' || f.kind === 'continent') continue;
    const big = f.size >= (f.kind === 'river' ? 40 : f.kind === 'lake' ? 25 : f.kind === 'sea' ? 60 : f.kind === 'island' ? 30 : 300);
    if (!big && zoomF < 2.2) continue;
    if (s < 2.4 && !(f.kind === 'ocean' || f.kind === 'sea' || (f.kind === 'mountains' && f.size > 150))) continue;
    if (s < 1.6) continue;
    if (f.kind === 'ocean' && zoomF > 3) continue;
    const px = view.ox + f.x * s + s / 2, py = view.oy + f.y * s + s / 2; if (px < -200 || py < -50 || px > cw + 200 || py > ch + 50) continue;
    const water = f.kind === 'sea' || f.kind === 'ocean' || f.kind === 'lake' || f.kind === 'river';
    const size = Math.max(10, Math.min(18, (big ? 12.5 : 10.5) * Math.sqrt(Math.min(2.5, zoomF))));
    ctx.font = `italic 500 ${size}px "Alegreya", Georgia, serif`;
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = water ? 'rgba(14,34,58,0.75)' : 'rgba(250,246,236,0.72)';
    ctx.fillStyle = water ? 'rgba(205,224,240,0.95)' : 'rgba(44,36,28,0.9)';
    const txt = f.kind === 'river' ? f.name : f.name;
    ctx.strokeText(txt, px, py); ctx.fillText(txt, px, py);
  }
  // cities
  const showAllNames = zoomF >= 2.6;
  for (const city of S.cities) {
    if (!cityVisible(city, y)) continue;
    const o = cityOwnerAt(city, y); const civ = S.civs[o]; const isCap = capitalAt(civ, y) === city.id;
    const px = view.ox + (city.x + 0.5) * s, py = view.oy + (city.y + 0.5) * s; if (px < -30 || py < -30 || px > cw + 30 || py > ch + 30) continue;
    const r = isCap ? Math.max(3.2, 1.1 * Math.sqrt(s)) : Math.max(2, 0.8 * Math.sqrt(s));
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fillStyle = dark ? '#f3ead8' : '#fffdf6'; ctx.fill(); ctx.lineWidth = isCap ? 1.6 : 1; ctx.strokeStyle = '#1d1711'; ctx.stroke();
    if (isCap) { ctx.beginPath(); ctx.arc(px, py, r + 2.2, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(29,23,17,0.75)'; ctx.stroke(); }
    const hov = hover && hover.city === city.id;
    if ((isCap && s >= 2.4) || showAllNames || hov || (o === selected && s >= 2.4)) {
      const size = isCap ? Math.max(10, Math.min(14, 9 + zoomF * 1.3)) : Math.max(9, Math.min(12, 8 + zoomF));
      ctx.font = `${isCap ? '700' : '500'} ${size}px "Alegreya Sans", system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(250,246,236,0.8)'; ctx.fillStyle = '#1d1711';
      ctx.strokeText(city.name, px + r + 3, py); ctx.fillText(city.name, px + r + 3, py);
    }
  }
  // realm labels
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const L of yd.labels) {
    const civ = S.civs[L.civ]; if (civ.fell >= 0 && civ.fell <= y) continue;
    if (L.cells < 12 && L.civ !== selected && zoomF < 2) continue;
    if (s < 2.4 && L.cells < 120 && L.civ !== selected) continue;
    const px = view.ox + L.x * s, py = view.oy + L.y * s; if (px < -150 || py < -40 || px > cw + 150 || py > ch + 40) continue;
    const size = Math.max(s < 2.4 ? 8 : 10, Math.min(30, (7 + Math.sqrt(L.cells) * 0.55) * Math.sqrt(Math.min(3, zoomF)) * (s < 2.4 ? 0.75 : 1)));
    ctx.font = `700 ${size}px "Alegreya SC", "Alegreya", Georgia, serif`;
    const t = civ.name.toUpperCase();
    ctx.save(); ctx.letterSpacing = `${(size * 0.12).toFixed(1)}px`;
    ctx.lineWidth = Math.max(2.5, size * 0.22); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(250,246,236,0.78)'; ctx.strokeText(t, px, py - (L.cells > 40 ? 0 : 0));
    ctx.fillStyle = L.civ === selected ? '#000' : civDark[L.civ]; ctx.fillText(t, px, py);
    ctx.restore();
  }
  // event markers for recent years
  for (let k = S.events.length - 1; k >= 0; k--) {
    const e = S.events[k]; if (e.year > y) continue; if (e.year < y - 3) break; if (e.loc < 0) continue;
    const age = y - e.year; const alpha = 1 - age * 0.3;
    const px = view.ox + (e.loc % W + 0.5) * s, py = view.oy + (((e.loc / W) | 0) + 0.5) * s;
    if (e.kind === 'battle' || e.kind === 'fall' || e.kind === 'war') drawBurst(px, py, e.kind === 'fall' ? '#2a0a0a' : '#c8322b', alpha, e.kind === 'fall' ? 9 : 7);
    else if (e.kind === 'city' || e.kind === 'found') { ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.strokeStyle = `rgba(212,164,58,${alpha})`; ctx.lineWidth = 2; ctx.stroke(); }
    else if (e.kind === 'plague') { ctx.beginPath(); ctx.arc(px, py, 6 + age * 2, 0, Math.PI * 2); ctx.fillStyle = `rgba(108,52,140,${alpha * 0.35})`; ctx.fill(); }
    else if (e.kind === 'wonder' || e.kind === 'golden') drawStar(px, py - 8, 5, `rgba(240,196,70,${alpha})`);
  }
  if (flash) { const age = (performance.now() - flash.t0) / 1000; if (age < 1.6) { const px = view.ox + (flash.cell % W + 0.5) * s, py = view.oy + (((flash.cell / W) | 0) + 0.5) * s; ctx.beginPath(); ctx.arc(px, py, 6 + age * 26, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,255,255,${1 - age / 1.6})`; ctx.lineWidth = 2.5; ctx.stroke(); requestDraw(); } else flash = null; }
}
function drawBurst(px, py, color, alpha, r) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4 + Math.PI / 8; ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * r, py - Math.sin(a) * r); ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(px, py, r * 0.45, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
function drawStar(px, py, r, color) {
  ctx.save(); ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5; const rr = k % 2 ? r * 0.45 : r; ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = 'rgba(40,30,10,0.7)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
}

// ---------- timeline ----------
function drawTimeline() {
  const cv = $('#tlCanvas'); const w = cv.clientWidth, h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h); const Y = S.totalYears; const bars = new Float32Array(Y + 1); const marks = [];
  for (const e of S.events) { if (e.kind === 'battle') bars[e.year] += 1; else if (e.kind === 'fall') marks.push([e.year, '#1a1a1a']); else if (e.kind === 'plague' && /first|appeared/.test(e.text)) marks.push([e.year, '#8a4bb0']); else if (e.kind === 'found') marks.push([e.year, '#d4a43a']); }
  let mx = 1; for (let i = 1; i <= Y; i++) mx = Math.max(mx, bars[i]);
  const styles = getComputedStyle(document.documentElement);
  c.fillStyle = styles.getPropertyValue('--tl-bar').trim() || 'rgba(200,50,43,0.6)';
  for (let i = 1; i <= Y; i++) { if (!bars[i]) continue; const x = (i - 1) / Y * w; const bh = Math.max(2, bars[i] / mx * (h - 6)); c.fillRect(x, h - bh, Math.max(1, w / Y), bh); }
  for (const [yy, col] of marks) { const x = (yy - 1) / Y * w; c.fillStyle = col; c.fillRect(x - 0.5, 0, 1.5, 5); }
}

// ---------- year & panels ----------
function setYear(y, silent) {
  y = Math.max(1, Math.min(S.totalYears, y | 0)); if (y === year && !silent) return;
  const back = y < year; year = y;
  $('#yearNum').textContent = year; $('#tl').value = year;
  updateStatline();
  if (detailOpen) renderDetail();
  else if (tab === 'chronicle') renderChronicle(back);
  else if (tab === 'realms') renderRealms(); else if (tab === 'figures') renderFigures();
  requestDraw();
}
function updateStatline() {
  const yd = computeYearData(year);
  const wars = S.wars.filter(w => w.start <= year && (w.end < 0 || w.end > year)).length;
  let pop = 0; for (const c of S.civs) if (c.founded <= year && (c.fell < 0 || c.fell > year)) { let p = 0; for (const h of c.hist) { if (h[0] <= year) p = h[1]; else break; } pop += p || c.pop * 0.3; }
  const plague = S.plagues.find(p => p.start <= year && (p.end < 0 || p.end >= year));
  const parts = [`${yd.aliveN} realm${yd.aliveN === 1 ? '' : 's'}`, wars ? `${wars} war${wars === 1 ? '' : 's'} raging` : 'peace, for now', `${fmtPop(pop)} souls`];
  if (plague) parts.push(`${plague.name} abroad`);
  $('#statline').textContent = parts.join(' · ');
}
function refLink(kind, id, label) { return `<a class="ref ref-${kind}" data-ref="${kind}${id}" href="#">${esc(label)}</a>`; }
function eventHTML(e) {
  const txt = resolveText(S, e.text, refLink, e.year);
  const civ = e.civs.length ? e.civs[0] : -1;
  const sw = civ >= 0 ? `<span class="sw" style="background:${civCss[civ]}"></span>` : '<span class="sw none"></span>';
  return `<article class="entry k-${e.kind} imp${e.imp}" data-id="${e.id}">${sw}<p>${txt}</p></article>`;
}
function eventPasses(e) {
  if (filterWar >= 0) return e.war === filterWar;
  if (filter === 'major') return e.imp >= 2;
  if (filter === 'wars') return e.kind === 'war' || e.kind === 'battle' || e.kind === 'peace' || e.kind === 'fall' || e.kind === 'capital';
  if (filter === 'realm') return selected >= 0 && e.civs.includes(selected);
  if (filter === 'lore') return e.kind === 'hero' || e.kind === 'omen' || e.kind === 'wonder' || e.kind === 'artifact' || e.kind === 'golden' || e.kind === 'plague';
  return true;
}
function renderChronicle(back) {
  const pane = $('#pane-chronicle'); const key = `${filter}|${filterWar}|${selected}|${S.events.length}`;
  const full = back || key !== chronRendered.key;
  if (full) { pane.innerHTML = ''; chronRendered = { count: 0, lastYear: 0, key }; }
  const frag = document.createDocumentFragment(); let k = chronRendered.count; let lastYear = chronRendered.lastYear; let added = 0;
  for (; k < S.events.length; k++) {
    const e = S.events[k]; if (e.year > year) break; if (!eventPasses(e)) continue;
    if (e.year !== lastYear) { const h = document.createElement('h4'); h.className = 'yearhead'; h.textContent = `Year ${e.year}`; h.dataset.year = e.year; frag.appendChild(h); lastYear = e.year; }
    const tmp = document.createElement('template'); tmp.innerHTML = eventHTML(e); frag.appendChild(tmp.content.firstChild); added++;
  }
  chronRendered.count = k; chronRendered.lastYear = lastYear;
  if (added) pane.appendChild(frag);
  if (full && !pane.children.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = filterWar >= 0 ? 'Nothing has been written of this war yet.' : filter === 'realm' ? 'Nothing has been written of this realm yet.' : 'The chronicle has not yet begun.'; pane.appendChild(p); }
  if (year >= S.totalYears) {
    let ext = $('#extendRow'); if (!ext) { ext = document.createElement('div'); ext.id = 'extendRow'; ext.innerHTML = `<p class="endnote">Here the chronicle ends, in the year ${S.totalYears}.</p><button id="btnExtend" class="btn">Let the scribes continue (+100 years)</button>`; pane.appendChild(ext); $('#btnExtend').addEventListener('click', () => extendHistory(100)); } else pane.appendChild(ext);
  } else { const ext = $('#extendRow'); if (ext) ext.remove(); }
  if (added && !userScrolledUp) { pane.scrollTop = pane.scrollHeight; }
  if (full) { userScrolledUp = false; pane.scrollTop = pane.scrollHeight; }
}
function civAlive(c, y) { return c.founded <= y && (c.fell < 0 || c.fell > y); }
function rulerAt(civ, y) { let r = null; for (const id of civ.rulers) { const p = S.persons[id]; if (p.reignStart <= y && (p.reignEnd < 0 || p.reignEnd >= y)) { r = p; } } return r; }
function civPopAt(c, y) { let p = -1; for (const h of c.hist) { if (h[0] <= y) p = h[1]; else break; } return p < 0 ? Math.round(c.pop * 0.3) : p; }
function renderRealms() {
  const pane = $('#pane-realms'); const yd = computeYearData(year);
  const alive = S.civs.filter(c => civAlive(c, year)).sort((a, b) => yd.cnt[b.id] - yd.cnt[a.id]);
  const dead = S.civs.filter(c => c.fell >= 0 && c.fell <= year).sort((a, b) => b.fell - a.fell);
  let html = '';
  for (const c of alive) {
    const r = rulerAt(c, year); const wars = S.wars.filter(w => (w.a === c.id || w.b === c.id) && w.start <= year && (w.end < 0 || w.end > year)).length;
    html += `<button class="realm${c.id === selected ? ' sel' : ''}" data-civ="${c.id}"><span class="sw" style="background:${civCss[c.id]}"></span><span class="rname">${esc(capFirst(c.fullName))}</span><span class="rmeta">${KIND_LABEL[c.kind]} · ${c.lang.label} tongue${wars ? ` · <em class="warn">at war</em>` : ''}</span><span class="rruler">${r ? esc(personName(S, r, '', year)) : '—'}</span><span class="rnums"><b>${yd.cnt[c.id]}</b> lands <b>${S.cities.filter(ct => cityVisible(ct, year) && cityOwnerAt(ct, year) === c.id).length}</b> towns <b>${fmtPopShort(civPopAt(c, year))}</b> souls</span></button>`;
  }
  if (dead.length) { html += `<details class="fallen"><summary>Fallen realms (${dead.length})</summary>`; for (const c of dead) html += `<button class="realm dead" data-civ="${c.id}"><span class="sw" style="background:${civCss[c.id]}"></span><span class="rname">${esc(capFirst(c.fullName))}</span><span class="rmeta">${c.founded}–${c.fell} · ${KIND_LABEL[c.kind]}</span></button>`; html += '</details>'; }
  pane.innerHTML = html || '<p class="empty">No realms yet.</p>';
}
function personSummary(p) {
  const civ = S.civs[p.civ]; const bits = [];
  if (p.role === 'ruler' && p.reignStart >= 0) { const end = p.reignEnd >= 0 ? Math.min(p.reignEnd, year) : year; bits.push(`ruled ${civ.name} ${p.reignStart}–${p.reignEnd >= 0 && p.reignEnd <= year ? p.reignEnd : ''}`); const d = p.deeds; const dd = []; if (d.won) dd.push(`won ${d.won} battle${d.won > 1 ? 's' : ''}`); if (d.lost) dd.push(`lost ${d.lost}`); if (d.conquests) dd.push(`${d.conquests} conquest${d.conquests > 1 ? 's' : ''}`); if (d.wonders) dd.push(`${d.wonders} wonder${d.wonders > 1 ? 's' : ''}`); if (d.cities) dd.push(`founded ${d.cities} town${d.cities > 1 ? 's' : ''}`); if (dd.length) bits.push(dd.join(', ')); }
  else if (p.note) bits.push(p.note); else bits.push(p.role);
  if (p.traits.length) bits.push(p.traits.join(' and '));
  return bits.join(' · ');
}
function fameOf(p) { let f = p.fame; const d = p.deeds; f += d.won * 1.5 + d.conquests * 4 + d.wonders * 3 + d.cities + (p.epithet && !/^the (Fat|Bald|Red|Quiet|Lame|Fair|Black|Tall|Stammerer|Bold|Short|Hunter|Sailor|Dreamer|Grey|Hawk|Fox|Unwashed|Silent|Lion)$/.test(p.epithet) ? 3 : 0); if (p.reignStart >= 0) f += Math.min(6, ((p.reignEnd >= 0 ? p.reignEnd : year) - p.reignStart) / 10); return f; }
function renderFigures() {
  const pane = $('#pane-figures');
  const people = S.persons.filter(p => p.born <= year && (p.reignStart < 0 || p.reignStart <= year) && (p.role !== 'ruler' || p.reignStart >= 0) && (p.role !== 'hero' || S.events.some(e => e.persons.includes(p.id) && e.year <= year)));
  people.sort((a, b) => fameOf(b) - fameOf(a));
  let html = '';
  for (const p of people.slice(0, 80)) {
    const civ = S.civs[p.civ]; const died = p.died >= 0 && p.died <= year;
    html += `<button class="fig" data-person="${p.id}"><span class="sw" style="background:${civCss[civ.id]}"></span><span class="fname">${esc(personName(S, p, '', year))}</span><span class="fmeta">${p.role === 'hero' ? 'hero' : p.role === 'rebel' ? 'rebel' : 'ruler'} of ${esc(civ.name)} · born ${p.born}${died ? `, died ${p.died}` : ''}</span><span class="fsum">${esc(personSummary(p))}</span></button>`;
  }
  pane.innerHTML = html || '<p class="empty">No one of note yet.</p>';
}
function renderDetail() {
  const pane = $('#pane-detail'); if (selected < 0) { pane.hidden = true; return; }
  const c = S.civs[selected]; const yd = computeYearData(year); const y = year;
  const r = rulerAt(c, y); const alive = civAlive(c, y);
  const stab = c.stability; // final-year stability; approximate wording only when alive at final year
  const capId = capitalAt(c, y); const cap = capId >= 0 ? S.cities[capId] : null;
  let html = `<div class="dhead"><span class="sw big" style="background:${civCss[c.id]}"></span><div><h3>${esc(capFirst(c.fullName))}</h3><p class="dmeta">${KIND_LABEL[c.kind]} of the ${c.lang.label} tongue · founded ${c.founded}${c.fell >= 0 && c.fell <= y ? ` · fell ${c.fell}` : ''}${c.parent >= 0 ? ` · broke away from ${refLink('c', c.parent, S.civs[c.parent].name)}` : ''}</p></div><button class="btn small" id="btnCloseDetail" aria-label="Close">✕</button></div>`;
  html += `<div class="dactions"><button class="btn small" id="btnRealmChron">Chronicle of this realm</button><button class="btn small" id="btnGoCap">Find on map</button></div>`;
  if (alive) {
    html += `<dl class="dstats"><div><dt>Lands</dt><dd>${yd.cnt[c.id]}</dd></div><div><dt>Towns</dt><dd>${S.cities.filter(ct => cityVisible(ct, y) && cityOwnerAt(ct, y) === c.id).length}</dd></div><div><dt>Souls</dt><dd>${fmtPopShort(civPopAt(c, y))}</dd></div><div><dt>Capital</dt><dd>${cap ? refLink('t', cap.id, cap.name) : '—'}</dd></div></dl>`;
    if (r) { const age = y - r.born; html += `<section class="dsec"><h4>Reigning</h4><p><b>${refLink('p', r.id, personName(S, r, '', y))}</b>, aged ${age}, ${r.traits.join(' and ')}, of the ${esc(r.dynasty)}. On the throne since ${r.reignStart}.</p></section>`; }
    const wars = S.wars.filter(w => (w.a === c.id || w.b === c.id) && w.start <= y && (w.end < 0 || w.end > y));
    if (wars.length) html += `<section class="dsec"><h4>At war</h4><ul>${wars.map(w => `<li>${refLink('w', w.id, w.name)} against ${refLink('c', w.a === c.id ? w.b : w.a, S.civs[w.a === c.id ? w.b : w.a].fullName)}, since ${w.start}</li>`).join('')}</ul></section>`;
    const allies = [...c.allies].filter(id => civAlive(S.civs[id], y)); // approximate: current alliances
  }
  // population chart
  const hist = c.hist.filter(h => h[0] <= y); if (hist.length > 2) html += `<section class="dsec"><h4>Souls and lands over time</h4><canvas id="popChart" class="popchart" width="300" height="70"></canvas></section>`;
  // rulers
  const rulers = c.rulers.map(id => S.persons[id]).filter(p => p.reignStart >= 0 && p.reignStart <= y);
  if (rulers.length) {
    html += `<section class="dsec"><h4>Rulers</h4><ol class="rulers">`; let dyn = '';
    for (const p of rulers) { if (p.dynasty !== dyn) { dyn = p.dynasty; html += `<li class="dyn">${esc(dyn)}</li>`; } const end = p.reignEnd >= 0 && p.reignEnd <= y ? p.reignEnd : ''; html += `<li>${refLink('p', p.id, personName(S, p, '', y))}<span class="yrs">${p.reignStart}–${end}</span><span class="tr">${p.traits.join(', ')}</span></li>`; }
    html += '</ol></section>';
  }
  const pastWars = S.wars.filter(w => (w.a === c.id || w.b === c.id) && w.start <= y && w.end >= 0 && w.end <= y).reverse();
  if (pastWars.length) html += `<section class="dsec"><h4>Wars</h4><ul class="wars">${pastWars.map(w => { const foe = S.civs[w.a === c.id ? w.b : w.a]; const res = w.result === c.id ? 'victory' : w.result === foe.id ? 'defeat' : 'no victor'; return `<li>${refLink('w', w.id, w.name)} <span class="yrs">${w.start}–${w.end}</span> against ${refLink('c', foe.id, foe.name)} · ${res}</li>`; }).join('')}</ul></section>`;
  const towns = S.cities.filter(ct => cityVisible(ct, y) && cityOwnerAt(ct, y) === c.id).sort((a, b) => a.founded - b.founded);
  if (towns.length) html += `<section class="dsec"><h4>Towns</h4><p class="towns">${towns.map(t => refLink('t', t.id, t.name) + (t.id === capId ? ' (capital)' : '') + (t.founder !== c.id ? ' (taken)' : '')).join(', ')}</p></section>`;
  const wonders = S.cities.flatMap(ct => ct.wonders).filter(w => w.civ === c.id && w.year <= y);
  const arts = S.artifacts.filter(a => artifactHolderAt(a, y) === c.id);
  if (wonders.length || arts.length) html += `<section class="dsec"><h4>Treasures</h4><ul>${wonders.map(w => `<li>${esc(w.name)} (${w.year})${w.destroyed >= 0 && w.destroyed <= y ? ' — destroyed ' + w.destroyed : ''}</li>`).join('')}${arts.map(a => `<li>${esc(a.name)}${a.origin !== c.id ? ', taken from ' + esc(S.civs[a.origin].name) : ''}</li>`).join('')}</ul></section>`;
  pane.innerHTML = html; pane.hidden = false;
  $('#btnCloseDetail').addEventListener('click', () => selectCiv(-1));
  $('#btnRealmChron').addEventListener('click', () => { filter = 'realm'; filterWar = -1; switchTab('chronicle'); syncFilterChips(); });
  $('#btnGoCap').addEventListener('click', () => { const yd2 = computeYearData(year); const L = yd2.labels.find(l => l.civ === c.id); if (L) flyTo(Math.floor(L.x) + Math.floor(L.y) * world.W); else if (cap) flyTo(cap.cell); });
  const pc = $('#popChart'); if (pc) drawPopChart(pc, hist);
}
function drawPopChart(cv, hist) {
  const w = cv.clientWidth || 300, h = 70; cv.width = w * dpr; cv.height = h * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const styles = getComputedStyle(document.documentElement); const fg = styles.getPropertyValue('--muted').trim(); const acc = styles.getPropertyValue('--accent').trim(); const line = styles.getPropertyValue('--line').trim();
  const y0 = hist[0][0], y1 = hist[hist.length - 1][0]; let mp = 1, mc = 1; for (const hh of hist) { mp = Math.max(mp, hh[1]); mc = Math.max(mc, hh[2]); }
  const X = yy => 4 + (yy - y0) / Math.max(1, y1 - y0) * (w - 8);
  c.strokeStyle = line; c.lineWidth = 1; c.beginPath(); c.moveTo(0, h - 12.5); c.lineTo(w, h - 12.5); c.stroke();
  c.beginPath(); for (let i = 0; i < hist.length; i++) { const p = hist[i]; const x = X(p[0]), yy = h - 13 - p[2] / mc * (h - 20); if (i) c.lineTo(x, yy); else c.moveTo(x, yy); } c.strokeStyle = fg; c.lineWidth = 1.2; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
  c.beginPath(); for (let i = 0; i < hist.length; i++) { const p = hist[i]; const x = X(p[0]), yy = h - 13 - p[1] / mp * (h - 20); if (i) c.lineTo(x, yy); else c.moveTo(x, yy); } c.strokeStyle = acc; c.lineWidth = 2; c.stroke();
  c.fillStyle = fg; c.font = '10px "Alegreya Sans", system-ui, sans-serif'; c.textAlign = 'left'; c.fillText(String(y0), 4, h - 2); c.textAlign = 'right'; c.fillText(String(y1), w - 4, h - 2);
  c.textAlign = 'left'; c.fillStyle = acc; c.fillText('souls ' + fmtPopShort(mp), 4, 10); c.fillStyle = fg; c.fillText('lands ' + mc + ' (dashed)', 4, 21);
}
function selectCiv(id, opts = {}) {
  selected = id; polSel = -2; selPathYear = -1; detailOpen = id >= 0;
  if (filter === 'realm' && id < 0) filter = 'all';
  showPanes();
  syncFilterChips(); requestDraw();
}
function showPanes() {
  $('#pane-detail').hidden = !detailOpen;
  $('#pane-chronicle').hidden = detailOpen || tab !== 'chronicle'; $('#pane-realms').hidden = detailOpen || tab !== 'realms'; $('#pane-figures').hidden = detailOpen || tab !== 'figures';
  $('#filters').hidden = detailOpen || tab !== 'chronicle';
  $$('.tabs button').forEach(b => b.classList.toggle('active', !detailOpen && b.dataset.tab === tab));
  if (detailOpen) renderDetail(); else if (tab === 'chronicle') renderChronicle(true); else if (tab === 'realms') renderRealms(); else renderFigures();
}
function flyTo(cell) {
  const { W } = world; const x = (cell % W) + 0.5, y = ((cell / W) | 0) + 0.5;
  const target = Math.max(view.scale, view.min * 2.6); view.scale = target; view.ox = cw / 2 - x * target; view.oy = ch / 2 - y * target; clampView();
  flash = { cell, t0: performance.now() }; requestDraw();
}
function switchTab(name) { tab = name; detailOpen = false; showPanes(); }
function syncFilterChips() {
  $$('#filters button').forEach(b => { const f = b.dataset.filter; b.classList.toggle('active', filterWar < 0 && f === filter); b.hidden = f === 'realm' && selected < 0; });
  const wc = $('#warChip'); if (filterWar >= 0) { wc.hidden = false; wc.innerHTML = `${esc(S.wars[filterWar].name)} <span class="x">✕</span>`; } else wc.hidden = true;
  const br = $('#btnBackRealm'); br.hidden = selected < 0; if (selected >= 0) br.textContent = `${S.civs[selected].name} ›`;
}
function renderAll() { syncFilterChips(); showPanes(); updateStatline(); }
function updatePlayButton() { const b = $('#btnPlay'); b.textContent = playing ? 'Pause' : (ready && year >= S.totalYears ? 'Replay' : 'Play'); b.setAttribute('aria-pressed', playing ? 'true' : 'false'); if (playing) { lastT = 0; requestDraw(); } }
function handleRef(ref) {
  const kind = ref.charAt(0), id = +ref.slice(1);
  if (kind === 'c') { selectCiv(id); const yd = computeYearData(year); const L = yd.labels.find(l => l.civ === id); if (L) flyTo(Math.floor(L.x) + Math.floor(L.y) * world.W); else { const cap = capitalAt(S.civs[id], Math.min(year, S.civs[id].fell >= 0 ? S.civs[id].fell - 1 : year)); if (cap >= 0) flyTo(S.cities[cap].cell); } }
  else if (kind === 'p') { const p = S.persons[id]; selectCiv(p.civ); const el = $(`#pane-detail a[data-ref="p${id}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }); el.classList.add('hl'); setTimeout(() => el.classList.remove('hl'), 1600); } }
  else if (kind === 't') { flyTo(S.cities[id].cell); }
  else if (kind === 'f') { const f = world.features[id]; flyTo(f.y * world.W + f.x); }
  else if (kind === 'w') { filterWar = id; switchTab('chronicle'); syncFilterChips(); }
  else if (kind === 'a') { const a = S.artifacts[id]; const h = artifactHolderAt(a, year); if (h >= 0) { const cap = capitalAt(S.civs[h], year); if (cap >= 0) flyTo(S.cities[cap].cell); selectCiv(h); } else if (a.lostAt >= 0) { const f = world.features[a.lostAt]; flyTo(f.y * world.W + f.x); } }
}

// ---------- tooltip ----------
function updateTooltip(px, py) {
  const tip = $('#tooltip'); const cell = toCell(px, py); if (cell < 0) { tip.hidden = true; hover = null; return; }
  const { W } = world; const cx = cell % W, cy = (cell / W) | 0;
  let city = null, bd = 1.5; for (const ct of S.cities) { if (!cityVisible(ct, year)) continue; const d = Math.hypot(ct.x - cx, ct.y - cy); if (d < bd) { bd = d; city = ct; } }
  const o = ownerFor(year)[cell]; const fid = world.featureOf[cell]; const f = fid >= 0 ? world.features[fid] : null;
  const lines = [];
  if (city) { const oc = cityOwnerAt(city, year); const civ = S.civs[oc]; lines.push(`<b>${esc(city.name)}</b>${capitalAt(civ, year) === city.id ? ' · capital' : ''}`); lines.push(`${esc(capFirst(civ.fullName))} · founded ${city.founded}${city.founder !== oc ? ` by ${esc(S.civs[city.founder].name)}` : ''}${city.sacked ? ` · sacked ${city.sacked}×` : ''}`); if (city.wonders.length) lines.push(city.wonders.filter(w => w.year <= year).map(w => esc(w.name)).join(', ')); }
  else {
    const bio = BIOMES[world.biome[cell]].name; lines.push(`<b>${f && f.kind !== 'continent' ? esc(f.name) : bio.charAt(0).toUpperCase() + bio.slice(1)}</b>${f && f.kind !== 'continent' ? ` · ${bio}` : ''}`);
    if (o >= 0) lines.push(`${esc(capFirst(S.civs[o].fullName))}`); else if (world.isLand[cell]) lines.push('unclaimed');
    if (f && f.kind === 'field' && f.year <= year) lines.push('a battlefield');
  }
  hover = { cell, city: city ? city.id : -1 };
  tip.innerHTML = lines.join('<br>'); tip.hidden = false;
  const wrap = $('.mapwrap').getBoundingClientRect(); let tx = px + 14, ty = py + 14; if (tx + 230 > wrap.width) tx = px - 240; if (ty + 70 > wrap.height) ty = py - 70; tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
}

// ---------- events ----------
function bind() {
  canvas = $('#map'); ctx = canvas.getContext('2d');
  const wrap = $('.mapwrap');
  const resize = () => { dpr = Math.min(2, window.devicePixelRatio || 1); const r = wrap.getBoundingClientRect(); cw = Math.max(50, r.width); ch = Math.max(50, r.height); canvas.width = cw * dpr; canvas.height = ch * dpr; canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; if (world) { const wasFit = Math.abs(view.scale - view.min / 0.9) < 1e-6; fitView(); if (!wasFit) {} clampView(); drawTimeline(); requestDraw(); } };
  new ResizeObserver(resize).observe(wrap); resize();
  // pointer: pan, pinch, click
  const ptrs = new Map(); let dragging = false, moved = false, pinchD = 0, lastPinchMid = null;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); dragging = true; moved = false; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); lastPinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; } });
  canvas.addEventListener('pointermove', e => {
    if (!world) return;
    if (ptrs.has(e.pointerId)) {
      const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; if (pinchD > 0) zoomAt(d / pinchD, mid.x, mid.y); view.ox += mid.x - lastPinchMid.x; view.oy += mid.y - lastPinchMid.y; clampView(); pinchD = d; lastPinchMid = mid; moved = true; requestDraw(); return; }
      const dx = e.offsetX - prev.x, dy = e.offsetY - prev.y; if (Math.abs(dx) + Math.abs(dy) > 0) { if (Math.abs(e.offsetX - prev.x) + Math.abs(e.offsetY - prev.y) > 2) moved = true; view.ox += dx; view.oy += dy; clampView(); requestDraw(); }
      $('#tooltip').hidden = true;
    } else if (e.pointerType === 'mouse') updateTooltip(e.offsetX, e.offsetY);
  });
  const up = e => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (ptrs.size === 0) { dragging = false; if (!moved && world) { const cell = toCell(e.offsetX, e.offsetY); if (cell >= 0) { const o = ownerFor(year)[cell]; let city = null, bd = 1.5; for (const ct of S.cities) { if (!cityVisible(ct, year)) continue; const d = Math.hypot(ct.x - cell % world.W, ct.y - ((cell / world.W) | 0)); if (d < bd) { bd = d; city = ct; } } const id = city ? cityOwnerAt(city, year) : o; selectCiv(id >= 0 ? (id === selected && !city ? -1 : id) : -1); } } } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { $('#tooltip').hidden = true; hover = null; requestDraw(); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); if (!world) return; zoomAt(Math.pow(1.0015, -e.deltaY), e.offsetX, e.offsetY); }, { passive: false });
  canvas.addEventListener('dblclick', e => zoomAt(1.8, e.offsetX, e.offsetY));
  $('#zoomIn').addEventListener('click', () => zoomAt(1.5, cw / 2, ch / 2)); $('#zoomOut').addEventListener('click', () => zoomAt(1 / 1.5, cw / 2, ch / 2)); $('#zoomFit').addEventListener('click', () => { fitView(); requestDraw(); });
  // playback
  $('#btnPlay').addEventListener('click', () => { if (!S) return; if (!playing && year >= S.totalYears) setYear(1); playing = !playing; updatePlayButton(); });
  $$('.speed button').forEach(b => b.addEventListener('click', () => { speed = +b.dataset.speed; $$('.speed button').forEach(x => x.classList.toggle('active', x === b)); }));
  $('#tl').addEventListener('input', e => { setYear(+e.target.value); });
  $('#btnStart').addEventListener('click', () => setYear(1)); $('#btnEnd').addEventListener('click', () => setYear(S.totalYears));
  document.addEventListener('keydown', e => { if (!S || e.target.tagName === 'INPUT') return; if (e.key === ' ') { e.preventDefault(); $('#btnPlay').click(); } else if (e.key === 'ArrowRight') setYear(year + (e.shiftKey ? 10 : 1)); else if (e.key === 'ArrowLeft') setYear(year - (e.shiftKey ? 10 : 1)); else if (e.key === 'Escape') selectCiv(-1); });
  // seed
  $('#seedForm').addEventListener('submit', e => { e.preventDefault(); forgeWorld($('#seedInput').value); });
  $('#btnRandom').addEventListener('click', () => forgeWorld(randomSeed()));
  $('#btnCopySeed').addEventListener('click', () => { const b = $('#btnCopySeed'); const done = () => { b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy seed', 1400); }; try { navigator.clipboard.writeText(seed).then(done, () => { $('#seedInput').select(); }); } catch (err) { $('#seedInput').select(); } });
  // tabs & filters
  $$('.tabs button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $$('#filters button[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; filterWar = -1; syncFilterChips(); renderChronicle(true); }));
  $('#btnBackRealm').addEventListener('click', () => { if (selected >= 0) { detailOpen = true; showPanes(); } });
  $('#btnCopyText').addEventListener('click', () => {
    const b = $('#btnCopyText'); const lines = [`CHRONICLE OF AGES — world of ${seed}, years 1 to ${year}`, ''];
    let last = 0; for (const e of S.events) { if (e.year > year) break; if (!eventPasses(e)) continue; if (e.year !== last) { lines.push(`Year ${e.year}`); last = e.year; } lines.push('  ' + resolveText(S, e.text, null, e.year)); }
    const text = lines.join('\n'); const done = () => { b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy text', 1400); };
    try { navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done)); } catch (err) { fallbackCopy(text, done); }
  });
  $('#warChip').addEventListener('click', () => { filterWar = -1; syncFilterChips(); renderChronicle(true); });
  const pane = $('#pane-chronicle'); pane.addEventListener('scroll', () => { userScrolledUp = pane.scrollTop + pane.clientHeight < pane.scrollHeight - 60; });
  document.addEventListener('click', e => { const a = e.target.closest('a.ref'); if (a) { e.preventDefault(); handleRef(a.dataset.ref); return; } const r = e.target.closest('button.realm'); if (r) { selectCiv(+r.dataset.civ); const yd = computeYearData(year); const L = yd.labels.find(l => l.civ === +r.dataset.civ); if (L) flyTo(Math.floor(L.x) + Math.floor(L.y) * world.W); return; } const f = e.target.closest('button.fig'); if (f) { handleRef('p' + f.dataset.person); } });
  // theme changes
  if (window.matchMedia) { try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { drawTimeline(); requestDraw(); }); } catch (e) {} }
  new MutationObserver(() => { drawTimeline(); requestDraw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  // hot reload snapshot
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ seed, year, selected })); } catch (e) {}
}
function fallbackCopy(text, done) { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
function start(data) {
  bind();
  const fromHash = cleanSeed((location.hash || '').slice(1));
  const sd = (data && data.seed) || fromHash || randomSeed();
  const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => requestDraw());
  forgeWorld(sd, data && data.year ? data.year : 0);
  if (data && data.selected >= 0) setTimeout(() => { if (S && S.civs[data.selected]) selectCiv(data.selected); }, 1500);
}
const boot = () => { try { (window.claude && window.claude.hot && window.claude.hot.ready) ? window.claude.hot.ready(start) : start((window.claude && window.claude.hot && window.claude.hot.data) || {}); } catch (e) { start({}); } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
