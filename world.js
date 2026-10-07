'use strict';
// ===================== Chronicle: world generation =====================
// Seeded RNG, simplex noise, terrain with hydrology, biomes, named features.

function hashSeed(str) { // cyrb128
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

class RNG {
  constructor(seed) {
    const s = hashSeed(String(seed));
    this.a = s[0]; this.b = s[1]; this.c = s[2]; this.d = s[3];
    for (let i = 0; i < 15; i++) this.next();
  }
  next() { // sfc32
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  int(n) { return Math.floor(this.next() * n); }
  range(a, b) { return a + this.next() * (b - a); }
  irange(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  gauss() { let u = 0, v = 0; while (u === 0) u = this.next(); while (v === 0) v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  weighted(items, wfn) {
    let total = 0; for (let i = 0; i < items.length; i++) total += wfn(items[i], i);
    if (total <= 0) return items[this.int(items.length)];
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) { r -= wfn(items[i], i); if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
  fork(tag) { return new RNG(this.int(2147483647) + '#' + tag); }
}

const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
class Simplex {
  constructor(rng) {
    const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i;
    rng.shuffle(p);
    this.perm = new Uint8Array(512); for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  noise(xin, yin) {
    const perm = this.perm;
    const s = (xin + yin) * F2; const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2; const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1; if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0; if (t0 > 0) { const g = GRAD[perm[ii + perm[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1; if (t1 > 0) { const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2; if (t2 > 0) { const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  }
  fbm(x, y, oct = 6, lac = 2, gain = 0.5) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) { sum += a * this.noise(x * f, y * f); norm += a; a *= gain; f *= lac; }
    return sum / norm;
  }
}

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Biomes
const B = { DEEP: 0, OCEAN: 1, SHALLOW: 2, LAKE: 3, BEACH: 4, GRASS: 5, STEPPE: 6, FOREST: 7, JUNGLE: 8, SAVANNA: 9, DESERT: 10, SWAMP: 11, TAIGA: 12, TUNDRA: 13, SNOW: 14, MOUNTAIN: 15, PEAK: 16 };
const BIOMES = [
  { key: 'DEEP', name: 'deep ocean', fert: 0, land: false },
  { key: 'OCEAN', name: 'ocean', fert: 0, land: false },
  { key: 'SHALLOW', name: 'coastal waters', fert: 0, land: false },
  { key: 'LAKE', name: 'lake', fert: 0, land: false },
  { key: 'BEACH', name: 'coast', fert: 0.5, land: true },
  { key: 'GRASS', name: 'grassland', fert: 1.0, land: true },
  { key: 'STEPPE', name: 'steppe', fert: 0.5, land: true },
  { key: 'FOREST', name: 'forest', fert: 0.7, land: true },
  { key: 'JUNGLE', name: 'jungle', fert: 0.45, land: true },
  { key: 'SAVANNA', name: 'savanna', fert: 0.6, land: true },
  { key: 'DESERT', name: 'desert', fert: 0.08, land: true },
  { key: 'SWAMP', name: 'marsh', fert: 0.3, land: true },
  { key: 'TAIGA', name: 'taiga', fert: 0.3, land: true },
  { key: 'TUNDRA', name: 'tundra', fert: 0.12, land: true },
  { key: 'SNOW', name: 'ice', fert: 0.02, land: true },
  { key: 'MOUNTAIN', name: 'mountains', fert: 0.15, land: true },
  { key: 'PEAK', name: 'high peaks', fert: 0.02, land: true },
];

// Binary min-heap on (key, idx)
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop() {
    const k = this.k, v = this.v; const topV = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0; const n = k.length;
      for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < n && k[l] < k[m]) m = l; if (r < n && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; }
    }
    return topV;
  }
}

function generateTerrain(seed, W, H, rng) {
  const N = W * H;
  const sx = new Simplex(rng), sw = new Simplex(rng), sc = new Simplex(rng);
  const elev = new Float32Array(N), temp = new Float32Array(N), moist = new Float32Array(N);
  const aspect = W / H;
  const landTarget = rng.range(0.34, 0.44);
  const scale = rng.range(1.0, 1.35);
  const warp = rng.range(0.6, 1.1);
  const ox = rng.range(-100, 100), oy = rng.range(-100, 100);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const nx = (x / W - 0.5) * 2 * aspect, ny = (y / H - 0.5) * 2;
    const qx = sw.fbm(nx * 0.7 + ox, ny * 0.7 + oy, 4), qy = sw.fbm(nx * 0.7 + 5.2 + ox, ny * 0.7 + 1.3 + oy, 4);
    let e = sx.fbm(nx * scale + warp * qx, ny * scale + warp * qy, 7, 2.0, 0.52) * 0.5 + 0.5;
    const ex = Math.abs(nx) / aspect, ey = Math.abs(ny);
    const d = Math.max(ex, ey * 1.05);
    e = e * (1 - 0.9 * smoothstep(0.7, 1.0, d));
    elev[i] = e;
  }
  // Sea level by percentile
  const sorted = Float32Array.from(elev).sort();
  const sea = sorted[Math.floor(N * (1 - landTarget))];
  const mx = sorted[N - 1], mn = sorted[0];
  for (let i = 0; i < N; i++) {
    const e = elev[i];
    elev[i] = e >= sea ? 0.5 + 0.5 * (e - sea) / (mx - sea + 1e-6) : 0.5 * (e - mn) / (sea - mn + 1e-6);
  }
  // Depression filling (priority flood), tracking raise amounts for lakes
  const raised = new Float32Array(N);
  {
    const heap = new MinHeap(); const done = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (elev[i] < 0.5) { done[i] = 1; }
    // seed with ocean cells adjacent to land
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (elev[i] >= 0.5) continue;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        if (elev[yy * W + xx] >= 0.5) { edge = true; break; }
      }
      if (edge) heap.push(elev[i], i);
    }
    // land cells on map border also drain off the map edge
    for (let x = 0; x < W; x++) for (const yy of [0, H - 1]) { const i = yy * W + x; if (!done[i]) { done[i] = 1; heap.push(elev[i], i); } }
    for (let y = 0; y < H; y++) for (const xx of [0, W - 1]) { const i = y * W + xx; if (!done[i]) { done[i] = 1; heap.push(elev[i], i); } }
    while (heap.size) {
      const c = heap.pop(); const cx = c % W, cy = (c - cx) / W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = cx + dx, yy = cy + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx; if (done[n]) continue; done[n] = 1;
        const need = elev[c] + 0.0004;
        if (elev[n] < need) { raised[n] = need - elev[n]; elev[n] = need; }
        heap.push(elev[n], n);
      }
    }
  }
  // Temperature & moisture
  const latShift = rng.range(-0.15, 0.15);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const nx = (x / W - 0.5) * 2 * aspect, ny = (y / H - 0.5) * 2;
    let t = 1 - Math.pow(Math.abs(ny + latShift) / (1 + Math.abs(latShift)), 1.5);
    t += sc.fbm(nx * 1.6 + 11.3, ny * 1.6 + 7.7, 3) * 0.14;
    if (elev[i] >= 0.5) t -= (elev[i] - 0.5) * 1.3;
    temp[i] = clamp(t, 0, 1);
    let m = sc.fbm(nx * 1.3 + 41.2, ny * 1.3 - 17.9, 5) * 0.5 + 0.5;
    moist[i] = clamp(0.5 + (m - 0.5) * 2.1, 0, 1);
  }
  return { elev, temp, moist, raised, sea: 0.5 };
}

function bfsDistance(W, H, sources, maxD) {
  const N = W * H; const dist = new Int16Array(N).fill(-1); const q = new Int32Array(N); let qh = 0, qt = 0;
  for (const s of sources) { dist[s] = 0; q[qt++] = s; }
  while (qh < qt) {
    const c = q[qh++]; const d = dist[c]; if (d >= maxD) continue;
    const cx = c % W, cy = (c - cx) / W;
    if (cx > 0 && dist[c - 1] < 0) { dist[c - 1] = d + 1; q[qt++] = c - 1; }
    if (cx < W - 1 && dist[c + 1] < 0) { dist[c + 1] = d + 1; q[qt++] = c + 1; }
    if (cy > 0 && dist[c - W] < 0) { dist[c - W] = d + 1; q[qt++] = c - W; }
    if (cy < H - 1 && dist[c + W] < 0) { dist[c + W] = d + 1; q[qt++] = c + W; }
  }
  return dist;
}

function generateWorld(seed, W = 320, H = 200) {
  const rng = new RNG(seed + '|world');
  const N = W * H;
  const T = generateTerrain(seed, W, H, rng);
  const { elev, temp, moist, raised } = T;
  const biome = new Uint8Array(N);
  const isLand = new Uint8Array(N);
  for (let i = 0; i < N; i++) isLand[i] = elev[i] >= 0.5 ? 1 : 0;

  // coast distance for moisture
  const oceanCells = []; for (let i = 0; i < N; i++) if (!isLand[i]) oceanCells.push(i);
  const coastDist = bfsDistance(W, H, oceanCells, 30);
  for (let i = 0; i < N; i++) {
    if (!isLand[i]) continue;
    const cd = coastDist[i] < 0 ? 30 : coastDist[i];
    moist[i] = clamp(moist[i] * 0.82 + 0.28 * Math.exp(-cd / 7) - 0.04, 0, 1);
  }

  // Flow accumulation
  const down = new Int32Array(N).fill(-1);
  const flow = new Float32Array(N);
  const landIdx = []; for (let i = 0; i < N; i++) if (isLand[i]) landIdx.push(i);
  landIdx.sort((a, b) => elev[b] - elev[a]);
  for (const i of landIdx) {
    const x = i % W, y = (i - x) / W; let best = -1, be = elev[i];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx; if (elev[n] < be) { be = elev[n]; best = n; }
    }
    down[i] = best;
    flow[i] += 0.15 + moist[i];
    if (best >= 0 && isLand[best]) flow[best] += flow[i];
  }
  // River threshold: top ~2.5% of land by flow
  const flows = Float32Array.from(landIdx.map(i => flow[i])).sort();
  const riverT = flows[Math.floor(flows.length * 0.965)];
  const river = new Float32Array(N); // 0 or strength 1..3
  for (const i of landIdx) if (flow[i] >= riverT) river[i] = 1 + Math.min(2, Math.log(flow[i] / riverT + 1));

  // Mountains by land percentile
  const landH = Float32Array.from(landIdx.map(i => elev[i])).sort();
  const mtT = landH[Math.floor(landH.length * 0.90)], pkT = landH[Math.floor(landH.length * 0.975)];

  // Lakes: depressions raised by a visible amount
  const lake = new Uint8Array(N);
  for (const i of landIdx) if (raised[i] > 0.015) lake[i] = 1;

  // Biomes
  for (let i = 0; i < N; i++) {
    const h = elev[i], t = temp[i], m = moist[i];
    if (!isLand[i]) { biome[i] = h < 0.28 ? B.DEEP : B.OCEAN; continue; }
    if (lake[i]) { biome[i] = B.LAKE; continue; }
    if (h >= pkT) { biome[i] = B.PEAK; continue; }
    if (h >= mtT) { biome[i] = B.MOUNTAIN; continue; }
    if (t < 0.17) { biome[i] = m > 0.35 ? B.SNOW : B.TUNDRA; continue; }
    if (t < 0.36) { biome[i] = m > 0.42 ? B.TAIGA : B.TUNDRA; continue; }
    if (t < 0.68) {
      if (m > 0.74 && h < 0.555) biome[i] = B.SWAMP;
      else if (m > 0.58) biome[i] = B.FOREST;
      else if (m > 0.3) biome[i] = B.GRASS;
      else biome[i] = B.STEPPE;
      continue;
    }
    if (m < 0.3) biome[i] = B.DESERT;
    else if (m < 0.52) biome[i] = B.SAVANNA;
    else if (m > 0.8 && h < 0.555) biome[i] = B.SWAMP;
    else biome[i] = B.JUNGLE;
  }
  // Shallows and beaches
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let nearLand = false, nearOcean = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx; if (isLand[n] && !lake[n]) nearLand = true; if (!isLand[n]) nearOcean = true;
    }
    if (!isLand[i] && nearLand) biome[i] = B.SHALLOW;
    else if (isLand[i] && nearOcean && elev[i] < 0.535 && temp[i] > 0.36 && (biome[i] === B.GRASS || biome[i] === B.STEPPE || biome[i] === B.SAVANNA || biome[i] === B.DESERT || biome[i] === B.FOREST || biome[i] === B.JUNGLE)) biome[i] = B.BEACH;
  }
  // Fertility
  const fert = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!isLand[i] || lake[i]) continue;
    let f = BIOMES[biome[i]].fert;
    if (river[i] > 0) f += 0.45 + 0.1 * river[i];
    let nearWater = 0, nearRiver = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx; if (!isLand[n] || lake[n]) nearWater = 1; if (river[n] > 0) nearRiver = 1;
    }
    f += nearWater * 0.2 + nearRiver * 0.2;
    fert[i] = Math.min(1.6, f);
  }
  // Hillshade (for rendering), light from NW
  const shade = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const l = elev[y * W + Math.max(0, x - 1)], r = elev[y * W + Math.min(W - 1, x + 1)];
    const u = elev[Math.max(0, y - 1) * W + x], d = elev[Math.min(H - 1, y + 1) * W + x];
    const gx = (r - l) * 18, gy = (d - u) * 18;
    // light dir (-0.6,-0.6,0.55)
    const nz = 1; const len = Math.sqrt(gx * gx + gy * gy + nz * nz);
    const dot = (-gx * -0.6 + -gy * -0.6 + nz * 0.55) / len;
    shade[i] = clamp(dot, 0, 1);
  }
  const world = { seed, W, H, N, elev, temp, moist, biome, isLand, lake, river, flow, down, fert, shade, coastDist, landCount: landIdx.length };
  world.features = findFeatures(world, rng.fork('features'));
  return world;
}

// ---------- Features (named regions) ----------
function components(world, pred, conn8) {
  const { W, H, N } = world; const comp = new Int32Array(N).fill(-1); const list = [];
  const q = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (comp[s] >= 0 || !pred(s)) continue;
    const id = list.length; const cells = []; let qh = 0, qt = 0; q[qt++] = s; comp[s] = id;
    while (qh < qt) {
      const c = q[qh++]; cells.push(c); const cx = c % W, cy = (c - cx) / W;
      const r = conn8 ? 1 : 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; if (!conn8 && dx && dy) continue;
        const xx = cx + dx, yy = cy + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx; if (comp[n] >= 0 || !pred(n)) continue; comp[n] = id; q[qt++] = n;
      }
    }
    list.push(cells);
  }
  return { comp, list };
}

function labelPoint(world, cells) {
  // cell of the component farthest from its boundary (approximate pole of inaccessibility)
  const { W, H } = world; const inSet = new Set(cells);
  let cx = 0, cy = 0; for (const c of cells) { cx += c % W; cy += Math.floor(c / W); } cx /= cells.length; cy /= cells.length;
  // BFS distance from boundary
  const dist = new Map(); const q = [];
  for (const c of cells) {
    const x = c % W, y = (c - x) / W; let edge = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || !inSet.has(yy * W + xx)) { edge = true; break; } }
    if (edge) { dist.set(c, 0); q.push(c); }
  }
  let qh = 0; let best = cells[0], bestScore = -1e9;
  while (qh < q.length) {
    const c = q[qh++]; const d = dist.get(c); const x = c % W, y = (c - x) / W;
    const score = d * 3 - Math.hypot(x - cx, y - cy) * 0.5;
    if (score > bestScore) { bestScore = score; best = c; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const n = yy * W + xx; if (inSet.has(n) && !dist.has(n)) { dist.set(n, d + 1); q.push(n); } }
  }
  return { x: best % W, y: Math.floor(best / W), cx, cy };
}

function findFeatures(world, rng) {
  const { W, H, N, biome, isLand, river, down, flow } = world;
  const feats = [];
  const featureOf = new Int16Array(N).fill(-1);
  const bi = (i) => biome[i];
  const cats = [
    { kind: 'mountains', pred: i => bi(i) === B.MOUNTAIN || bi(i) === B.PEAK, min: 14, max: 10 },
    { kind: 'forest', pred: i => bi(i) === B.FOREST || bi(i) === B.TAIGA, min: 40, max: 9 },
    { kind: 'jungle', pred: i => bi(i) === B.JUNGLE, min: 40, max: 4 },
    { kind: 'desert', pred: i => bi(i) === B.DESERT, min: 40, max: 5 },
    { kind: 'swamp', pred: i => bi(i) === B.SWAMP, min: 12, max: 5 },
    { kind: 'frost', pred: i => bi(i) === B.TUNDRA || bi(i) === B.SNOW, min: 80, max: 4 },
    { kind: 'plains', pred: i => bi(i) === B.GRASS || bi(i) === B.STEPPE || bi(i) === B.SAVANNA, min: 90, max: 8 },
    { kind: 'lake', pred: i => bi(i) === B.LAKE, min: 4, max: 8 },
  ];
  for (const cat of cats) {
    const { list } = components(world, cat.pred, false);
    list.sort((a, b) => b.length - a.length);
    let n = 0;
    for (const cells of list) {
      if (cells.length < cat.min || n >= cat.max) break;
      const lp = labelPoint(world, cells);
      const id = feats.length;
      feats.push({ id, kind: cat.kind, cells, size: cells.length, x: lp.x, y: lp.y, cx: lp.cx, cy: lp.cy });
      for (const c of cells) featureOf[c] = id;
      n++;
    }
  }
  // Seas: ocean components; largest is "the ocean", others are seas/bays
  {
    const { list } = components(world, i => !isLand[i], false);
    list.sort((a, b) => b.length - a.length);
    let n = 0;
    for (let k = 0; k < list.length; k++) {
      const cells = list[k];
      if (k === 0) {
        const lp = labelPoint(world, cells);
        feats.push({ id: feats.length, kind: 'ocean', cells: [], size: cells.length, x: lp.x, y: lp.y, cx: lp.cx, cy: lp.cy });
        for (const c of cells) featureOf[c] = feats.length - 1;
        continue;
      }
      if (cells.length < 12 || n >= 8) continue;
      const lp = labelPoint(world, cells);
      const id = feats.length;
      feats.push({ id, kind: 'sea', cells, size: cells.length, x: lp.x, y: lp.y, cx: lp.cx, cy: lp.cy });
      for (const c of cells) featureOf[c] = id; n++;
    }
    // Bays: large concavities of the main ocean — approximate by shallow components adjacent to main ocean; skipped for simplicity
  }
  // Islands: small land components
  {
    const { list } = components(world, i => isLand[i] === 1, true);
    list.sort((a, b) => b.length - a.length);
    let n = 0;
    for (const cells of list) {
      if (cells.length > 260 || cells.length < 5) continue; if (n >= 8) break;
      const lp = labelPoint(world, cells);
      feats.push({ id: feats.length, kind: 'island', cells, size: cells.length, x: lp.x, y: lp.y, cx: lp.cx, cy: lp.cy });
      // islands are secondary: don't overwrite featureOf for biomes
      n++;
    }
    // continents: the big ones get names too
    let cN = 0;
    for (const cells of list) { if (cells.length <= 260) break; if (cN >= 4) break; const lp = labelPoint(world, cells); feats.push({ id: feats.length, kind: 'continent', cells: [], size: cells.length, x: lp.x, y: lp.y, cx: lp.cx, cy: lp.cy }); cN++; }
  }
  // Rivers: trace from each mouth upstream along max-flow predecessor
  {
    const ups = new Map();
    for (let i = 0; i < N; i++) if (river[i] > 0 && down[i] >= 0) { const d = down[i]; if (!ups.has(d)) ups.set(d, []); ups.get(d).push(i); }
    const mouths = []; for (let i = 0; i < N; i++) if (river[i] > 0 && down[i] >= 0 && (!isLand[down[i]] || biome[down[i]] === B.LAKE) && biome[i] !== B.LAKE) mouths.push(i);
    const used = new Uint8Array(N); const rivers = [];
    mouths.sort((a, b) => flow[b] - flow[a]);
    for (const m of mouths) {
      const path = []; let c = m;
      while (c >= 0 && river[c] > 0 && !used[c] && biome[c] !== B.LAKE) {
        path.push(c); used[c] = 1; const u = ups.get(c); if (!u) break;
        let best = -1, bf = -1; for (const p of u) if (!used[p] && flow[p] > bf) { bf = flow[p]; best = p; }
        c = best;
      }
      if (path.length >= Math.max(6, Math.round(W / 32))) rivers.push(path);
    }
    rivers.sort((a, b) => b.length - a.length);
    for (let k = 0; k < Math.min(10, rivers.length); k++) {
      const path = rivers[k]; const mid = path[Math.floor(path.length * 0.45)];
      feats.push({ id: feats.length, kind: 'river', cells: path, size: path.length, x: mid % W, y: Math.floor(mid / W), cx: mid % W, cy: Math.floor(mid / W) });
    }
  }
  world.featureOf = featureOf;
  return feats;
}

if (typeof module !== 'undefined') module.exports = { RNG, Simplex, B, BIOMES, generateWorld, clamp, smoothstep, bfsDistance, components };
