'use strict';
// ===================== Chronicle: history simulation =====================
if (typeof require !== 'undefined') { Object.assign(globalThis, require('./world.js'), require('./names.js')); }

const KEYFRAME = 10;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
const ORD = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
const KIND_MIL = { human: 1.0, elf: 1.1, dwarf: 1.25, orc: 1.45 };
const KIND_HOSTILITY = (a, b) => (a === 'orc') !== (b === 'orc') ? -1.6 : (a === 'elf' && b === 'dwarf') || (a === 'dwarf' && b === 'elf') ? -0.4 : a === b ? 0.5 : 0;

const BEASTS = 'wyrm|lindworm|great boar|troll|hydra|manticore|chimera|basilisk|wendigo|roc|sea serpent|cockatrice|black bear|wolf-king|giant|wight|sphinx|leviathan'.split('|');
const WONDER_ADJ = 'Great|Grand|High|Eternal|Hanging|White|Sunken|Winged|Golden|Silent'.split('|');
const WONDER_NOUN = 'Temple|Library|Lighthouse|Walls|Colossus|Observatory|Tower|Mausoleum|Gardens|Amphitheatre|Bridge|Aqueduct|Cathedral|Forge|Granary'.split('|');
const ART_NOUN = 'Crown|Blade|Hammer|Orb|Ring|Shield|Sceptre|Chalice|Helm|Spear|Horn|Mirror|Lantern|Harp'.split('|');
const ART_ADJ = 'Amber|Black|Silver|Sunfire|Moon|Thorn|Iron|Storm|Jade|Ember|Winter|Dragon|Star|Salt|Dawn'.split('|');
const PLAGUE_NAMES = ['the Red Death', 'the Grey Fever', 'the Weeping Pox', 'the Shaking Sickness', 'the Black Cough', 'the Sweating Plague', 'the Pale Rot', 'the Marsh Fever', 'the Blue Death', 'the Burning Fever'];
const EPITHET_FLAVOR = 'the Fat|the Bald|the Red|the Quiet|the Lame|the Fair|the Black|the Tall|the Stammerer|the Bold|the Short|the Hunter|the Sailor|the Dreamer|the Grey|the Hawk|the Fox|the Unwashed|the Silent|the Lion'.split('|');
const ORDERS = 'Flame|Rose|Sword|Veil|Lantern|Oak|Tide|Thorn|Star|Key'.split('|');

const romanize = n => ROMAN[n] || String(n);
const C = c => `[[c${c.id}]]`, Cd = c => `[[c${c.id}|d]]`, Cr = c => `[[c${c.id}|r]]`, Ca = c => `[[c${c.id}|a]]`;
const P = p => `[[p${p.id}]]`, Pn = p => `[[p${p.id}|n]]`, Pb = p => `[[p${p.id}|b]]`;
const T = t => `[[t${t.id}]]`, F = f => `[[f${f.id}]]`, A = a => `[[a${a.id}]]`, Wn = w => `[[w${w.id}]]`;

function simulateHistory(seed, world, totalYears = 500) {
  const rng = new RNG(seed + '|history');
  const namer = new Namer(rng.fork('names'));
  const { W, H, N, biome, isLand, lake, fert, featureOf, features } = world;
  const geoLang = rng.pick(LANGS);
  for (const f of features) f.name = nameFeature(namer, geoLang, f.kind);

  const S = {
    seed, world, year: 0, totalYears, civs: [], persons: [], cities: [], events: [], wars: [], artifacts: [], plagues: [],
    owner: new Int16Array(N).fill(-1), keyframes: [], deltas: [], cellPos: new Int32Array(N), featureNames: true,
    stats: [], // per year: {alive, pop, wars}
  };
  const owner = S.owner, cellPos = S.cellPos;
  let curDelta = [];

  // ---------- helpers ----------
  const ev = (kind, text, o = {}) => { const e = { id: S.events.length, year: S.year, kind, text, civs: o.civs || [], persons: o.persons || [], loc: o.loc == null ? -1 : o.loc, imp: o.imp || 1, war: o.war == null ? -1 : o.war }; S.events.push(e); return e; };
  const pickT = (arr) => rng.pick(arr);
  const cellX = i => i % W, cellY = i => Math.floor(i / W);
  const dist = (a, b) => Math.hypot(cellX(a) - cellX(b), cellY(a) - cellY(b));
  const neighbors4 = (i, fn) => { const x = cellX(i), y = cellY(i); if (x > 0) fn(i - 1); if (x < W - 1) fn(i + 1); if (y > 0) fn(i - W); if (y < H - 1) fn(i + W); };
  const alive = () => S.civs.filter(c => c.fell < 0);

  function setOwner(i, civId) {
    const prev = owner[i]; if (prev === civId) return;
    if (prev >= 0) { const c = S.civs[prev]; const p = cellPos[i]; const last = c.cells.pop(); if (last !== i) { c.cells[p] = last; cellPos[last] = p; } }
    owner[i] = civId;
    if (civId >= 0) { const c = S.civs[civId]; cellPos[i] = c.cells.length; c.cells.push(i); c.frontier.push(i); }
    else neighbors4(i, n => { const o = owner[n]; if (o >= 0) S.civs[o].frontier.push(n); });
    curDelta.push(i, civId);
  }

  function makePerson(civ, o) {
    const L = civ.lang; const female = o.female != null ? o.female : rng.chance(0.42);
    const name = o.name || namer.person(L, female);
    const p = { id: S.persons.length, name, female, born: o.born, died: -1, civ: civ.id, role: o.role || 'ruler', traits: [], lifespan: Math.round(L.lifespan * rng.range(0.82, 1.2)), reignStart: -1, reignEnd: -1, epithet: '', num: 0, deeds: { won: 0, lost: 0, conquests: 0, wonders: 0, cities: 0, warsStarted: 0 }, fame: 0, parent: o.parent == null ? -1 : o.parent, dynasty: o.dynasty || '', note: o.note || '' };
    S.persons.push(p); return p;
  }
  function assignTraits(p) {
    const pool = TRAITS.slice(); rng.shuffle(pool); p.traits = [pool[0].id, pool[1].id];
  }
  const traitObj = id => TRAITS.find(t => t.id === id);
  const has = (p, t) => p.traits.includes(t);
  function civAggression(civ) {
    const r = S.persons[civ.ruler]; let a = civ.baseAggr;
    if (r) for (const t of r.traits) a += traitObj(t).aggr;
    return clamp(a, 0.05, 1.2);
  }
  function regnalNumber(civ, name) { let n = 0; for (const rid of civ.rulers) if (S.persons[rid].name === name) n++; return n + 1; }

  function crown(civ, p, o = {}) {
    p.role = 'ruler'; p.reignStart = S.year; p.civ = civ.id; p.num = regnalNumber(civ, p.name);
    if (!p.traits.length) assignTraits(p);
    civ.ruler = p.id; civ.rulers.push(p.id);
    if (o.dynasty) { civ.dynasty = o.dynasty; civ.dynasties.push({ name: o.dynasty, start: S.year, founder: p.id }); }
    p.dynasty = civ.dynasty;
  }

  function makeCity(civ, cell, o = {}) {
    const city = { id: S.cities.length, name: o.name || namer.place(civ.lang), civ: civ.id, founder: civ.id, cell, x: cellX(cell), y: cellY(cell), founded: S.year, destroyed: -1, ownerHist: [[S.year, civ.id]], pop: 0, wonders: [], sacked: 0 };
    S.cities.push(city); civ.cities.push(city.id); return city;
  }
  function transferCity(city, toCiv) {
    const from = S.civs[city.civ]; from.cities = from.cities.filter(id => id !== city.id);
    city.civ = toCiv.id; toCiv.cities.push(city.id); city.ownerHist.push([S.year, toCiv.id]);
  }
  function makeArtifact(civ, o = {}) {
    const name = namer.unique(() => rng.chance(0.5) ? `the ${rng.pick(ART_ADJ)} ${rng.pick(ART_NOUN)}` : `the ${rng.pick(ART_NOUN)} of ${rng.chance(0.5) ? civ.name : cap(namer.raw(geoLang, 1, 2))}`, 60);
    const a = { id: S.artifacts.length, name, holder: civ.id, origin: civ.id, made: S.year, lostAt: -1, hist: [] };
    S.artifacts.push(a); civ.artifacts.push(a.id); return a;
  }

  function nearestCity(cell, maxD, pred) {
    let best = null, bd = maxD;
    for (const c of S.cities) { if (c.destroyed >= 0) continue; if (pred && !pred(c)) continue; const d = dist(c.cell, cell); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  function nearestFeature(cell, kinds, maxD = 1e9) {
    let best = null, bd = maxD;
    for (const f of features) { if (kinds && !kinds.includes(f.kind)) continue; const d = Math.hypot(f.cx - cellX(cell), f.cy - cellY(cell)); if (d < bd) { bd = d; best = f; } }
    return best;
  }
  function placeName(cell, civForLang) {
    // name for a battle site: city, feature, or a new battlefield
    const city = nearestCity(cell, 4.5);
    if (city) return { text: T(city), city };
    const fid = featureOf[cell];
    if (fid >= 0 && features[fid].kind !== 'ocean' && features[fid].kind !== 'continent') return { text: F(features[fid]) };
    const near = nearestFeature(cell, ['river', 'lake', 'mountains', 'forest', 'swamp', 'desert', 'plains', 'jungle', 'frost', 'sea'], 6);
    if (near && rng.chance(0.6)) return { text: F(near) };
    // coin a battlefield
    const L = civForLang ? civForLang.lang : geoLang;
    const name = namer.unique(() => rng.chance(0.5) ? `${rng.pick(ADJ)} Field` : `${cap(namer.raw(L, 1, 2))} ${rng.pick(['Field', 'Ford', 'Hill', 'Moor', 'Heath', 'Bridge', 'Cross', 'Hollow'])}`, 60);
    const f = { id: features.length, kind: 'field', name, cells: [cell], size: 1, x: cellX(cell), y: cellY(cell), cx: cellX(cell), cy: cellY(cell), year: S.year };
    features.push(f);
    const x0 = cellX(cell), y0 = cellY(cell);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x0 + dx, yy = y0 + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const n = yy * W + xx; if (featureOf[n] < 0 && isLand[n]) featureOf[n] = f.id; }
    return { text: F(f) };
  }

  // ---------- civ creation ----------
  const langUse = new Map();
  function pickLang(parentLang) {
    if (parentLang) return parentLang;
    return rng.weighted(LANGS, L => 1 / (1 + 2.5 * (langUse.get(L.id) || 0)));
  }
  function compilePref(L) {
    const pref = new Float32Array(BIOMES.length).fill(1);
    const kp = KINDS[L.kind].pref, lp = LANG_PREF[L.id] || {};
    for (let b = 0; b < BIOMES.length; b++) { const k = BIOMES[b].key; if (kp[k]) pref[b] *= kp[k]; if (lp[k]) pref[b] *= lp[k]; }
    return pref;
  }
  let hueCursor = rng.range(0, 360);
  function makeCiv(cell, o = {}) {
    const L = o.lang || pickLang(); langUse.set(L.id, (langUse.get(L.id) || 0) + 1);
    const root = namer.root(L);
    const form = rng.pick(L.realm);
    const fullName = form[0].replace('{R}', root);
    const demPair = rng.pick(L.demonym); const dem = demPair[0].replace('{R}', root), adj = demPair[1].replace('{R}', root);
    let hue;
    if (o.parentHue != null) hue = (o.parentHue + rng.range(25, 50) * (rng.chance(0.5) ? 1 : -1) + 360) % 360;
    else { hue = hueCursor; hueCursor = (hueCursor + 137.508) % 360; }
    const civ = { id: S.civs.length, name: root, fullName, demonym: dem, adj, lang: L, kind: L.kind, hue, sat: rng.range(45, 70), titleM: form[1], titleF: form[2],
      founded: S.year, fell: -1, capital: -1, cities: [], cells: [], pop: o.pop || 4000, stability: 0.65, baseAggr: KINDS[L.kind].aggression * 0.5 + rng.range(0, 0.3),
      ruler: -1, rulers: [], dynasty: '', dynasties: [], wars: [], rel: {}, truce: {}, allies: new Set(), artifacts: [], wonders: [], plague: 0, plagueId: -1, famine: 0, calm: 0, goldenAges: 0,
      parent: o.parent == null ? -1 : o.parent, hist: [], pref: compilePref(L), fame: 0, cap: 0, lastBattle: -100, stalemate: 0, frontier: [], goldenAge: 0, lastWarEnd: -100 };
    S.civs.push(civ);
    let city; if (o.city) { city = o.city; transferCity(city, civ); } else city = makeCity(civ, cell, {});
    civ.capital = city.id; civ.capitalHist = [[S.year, city.id]];
    // seed territory
    const r = o.radius || 2; const x0 = cellX(cell), y0 = cellY(cell);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x0 + dx, yy = y0 + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const n = yy * W + xx; if (isLand[n] && !lake[n] && owner[n] < 0 && dx * dx + dy * dy <= r * r + 1) setOwner(n, civ.id); }
    if (owner[cell] !== civ.id) setOwner(cell, civ.id);
    const ruler = o.ruler || makePerson(civ, { born: S.year - rng.irange(20, 40) });
    const dyn = `House of ${ruler.name}`;
    crown(civ, ruler, { dynasty: dyn });
    return civ;
  }

  function spawnSites(count) {
    // score candidate cells by local fertility; enforce spacing
    const sites = []; const cand = [];
    for (let k = 0; k < 6000; k++) { const i = rng.int(N); if (!isLand[i] || lake[i] || fert[i] < 0.5) continue; cand.push(i); }
    const minD = Math.max(12, Math.sqrt(world.landCount / count) * 0.7);
    const score = i => { let s = 0; const x0 = cellX(i), y0 = cellY(i); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x0 + dx, yy = y0 + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; s += fert[yy * W + xx]; } return s; };
    cand.sort((a, b) => score(b) - score(a));
    for (const i of cand) { if (sites.length >= count) break; if (sites.every(s => dist(s, i) >= minD)) sites.push(i); }
    return sites;
  }

  // ---------- yearly processes ----------
  function updateCapacity(civ) {
    let f = 0; for (const i of civ.cells) f += fert[i] * (0.6 + 0.4 * Math.min(2, civ.pref[biome[i]]));
    civ.cap = f * 380 * (1 + 0.12 * civ.cities.length) + 1500;
  }
  function growPop(civ) {
    updateCapacity(civ);
    let r = 0.028; if (civ.goldenAge > 0) r += 0.012; if (civ.plague > 0) r = -0.16; if (civ.famine > 0) r -= 0.1;
    if (civ.pop > civ.cap) civ.pop += (civ.cap - civ.pop) * 0.1 + civ.pop * Math.min(0, r); else civ.pop += civ.pop * r * (1 - civ.pop / civ.cap);
    civ.pop = Math.max(300, civ.pop);
  }
  const nbuf = [0, 0, 0, 0];
  function expand(civ) {
    const pressure = civ.pop / Math.max(1, civ.cap); // near capacity -> more pressure to expand
    let attempts = 2 + 0.55 * Math.sqrt(civ.cells.length) + civ.pop / 5000;
    attempts *= pressure > 0.7 ? 1.2 : 0.7; if (civ.plague) attempts *= 0.3; if (civ.stability < 0.3) attempts *= 0.5;
    attempts = clamp(Math.round(attempts), 2, 45);
    const fr = civ.frontier;
    for (let k = 0; k < attempts && fr.length; k++) {
      const fi = rng.int(fr.length); const c = fr[fi];
      if (owner[c] !== civ.id) { fr[fi] = fr[fr.length - 1]; fr.pop(); continue; }
      let cnt = 0; neighbors4(c, n => { if (isLand[n] && !lake[n] && owner[n] < 0) nbuf[cnt++] = n; });
      if (!cnt) { fr[fi] = fr[fr.length - 1]; fr.pop(); continue; }
      const n = nbuf[rng.int(cnt)];
      const desir = fert[n] * civ.pref[biome[n]];
      if (rng.chance(clamp(desir / 1.0, 0.04, 0.95))) setOwner(n, civ.id);
    }
  }
  function maybeFoundCity(civ) {
    const ratio = civ.cells.length / Math.max(1, civ.cities.length);
    if (ratio < 85 || !rng.chance(0.25)) return;
    let best = -1, bs = 0;
    for (let k = 0; k < 50; k++) {
      const c = civ.cells[rng.int(civ.cells.length)];
      if (nearestCity(c, 9)) continue;
      const s = fert[c] * civ.pref[biome[c]] * rng.range(0.8, 1.2);
      if (s > bs) { bs = s; best = c; }
    }
    if (best < 0) return;
    const city = makeCity(civ, best);
    const ruler = S.persons[civ.ruler]; ruler.deeds.cities++;
    const fid = featureOf[best]; const near = fid >= 0 && features[fid].kind !== 'ocean' ? features[fid] : nearestFeature(best, ['river', 'lake', 'sea', 'mountains', 'forest'], 5);
    ev('city', pickT([
      `${Ca(civ)} settlers founded ${T(city)}${near ? ` on the edge of ${F(near)}` : ''}.`,
      `${P(ruler)} granted a charter to the new town of ${T(city)}.`,
      `The town of ${T(city)} was founded${near ? ` beside ${F(near)}` : ''} by ${Ca(civ)} colonists.`,
      `A market town, ${T(city)}, grew up${near ? ` near ${F(near)}` : ' on the frontier'} under ${Ca(civ)} rule.`,
    ]), { civs: [civ.id], loc: best, persons: [ruler.id] });
  }
  function updateStability(civ) {
    const r = S.persons[civ.ruler]; let target = 0.62;
    for (const t of r.traits) target += traitObj(t).stab;
    target -= 0.07 * civ.wars.length;
    const over = Math.max(0, civ.cells.length / (civ.cities.length * 60) - 1); target -= over * 0.15;
    if (civ.plague) target -= 0.15; if (civ.famine) target -= 0.1;
    target += Math.min(0.1, civ.wonders.length * 0.02); if (civ.kind === 'dwarf') target += 0.05;
    if (civ.pop > civ.cap * 1.1) target -= 0.1;
    civ.stability = clamp(civ.stability + (target - civ.stability) * 0.12 + rng.gauss() * 0.015, 0, 1);
  }
  function strength(civ) {
    const r = S.persons[civ.ruler]; let bonus = 1;
    if (has(r, 'brave')) bonus += 0.15; if (has(r, 'craven')) bonus -= 0.2; if (has(r, 'cunning')) bonus += 0.1; if (has(r, 'mad')) bonus -= 0.05;
    return Math.pow(civ.pop / 1000, 0.85) * (0.6 + civ.stability * 0.8) * KIND_MIL[civ.kind] * (1 - Math.min(0.5, Math.max(0, civ.wars.length - 1) * 0.18)) * bonus;
  }

  // --- rulers ---
  function epithetFor(p, civ) {
    const d = p.deeds, age = S.year - p.born, reign = S.year - p.reignStart;
    const opts = [];
    if (d.conquests >= 2 || (d.won >= 5 && d.conquests >= 1)) opts.push('the Great', 'the Conqueror', 'the Great');
    if (d.lost >= 3 && d.won <= 1) opts.push('the Unlucky', 'the Unready', 'the Lesser');
    if (d.wonders >= 1) opts.push('the Builder', 'the Magnificent');
    if (has(p, 'cruel')) opts.push('the Cruel', 'the Terrible'); if (has(p, 'mad')) opts.push('the Mad');
    if (age < 24) opts.push('the Young', 'the Boy', 'the Child');
    if (reign >= p.lifespan * 0.6) opts.push('the Old', 'the Ancient');
    if ((has(p, 'just') || has(p, 'wise')) && reign >= 15 && d.warsStarted === 0) opts.push('the Just', 'the Wise', 'the Peaceful', 'the Good');
    if (has(p, 'pious')) opts.push('the Pious', 'the Blessed');
    if (has(p, 'generous')) opts.push('the Generous', 'the Openhanded');
    if (has(p, 'scholarly') && reign >= 10) opts.push('the Learned');
    if (has(p, 'brave') && d.won >= 2) opts.push('the Bold', 'Ironhand', 'the Lion');
    if (opts.length) return rng.pick(opts);
    return rng.chance(0.3) ? rng.pick(EPITHET_FLAVOR) : '';
  }
  function rulerDies(civ, p, cause) {
    p.died = S.year; p.reignEnd = S.year; p.epithet = epithetFor(p, civ);
    const age = S.year - p.born;
    const txt = cause === 'age' ? pickT([`${P(p)} of ${Cr(civ)} died at the age of ${age}, having reigned ${S.year - p.reignStart} years.`, `${P(p)} died peacefully in ${T(S.cities[civ.capital])} after ${S.year - p.reignStart} years on the throne.`, `In this year died ${P(p)}, aged ${age}, who had ruled ${Cr(civ)} for ${S.year - p.reignStart} years.`])
      : cause === 'plague' ? pickT([`${P(p)} of ${Cr(civ)} was carried off by the plague.`, `The plague took ${P(p)} of ${Cr(civ)}; the court fled ${T(S.cities[civ.capital])}.`])
      : cause === 'murder' ? pickT([`${P(p)} of ${Cr(civ)} was murdered in ${T(S.cities[civ.capital])}, ${rng.pick(['stabbed at prayer', 'poisoned at a feast', 'smothered in sleep', 'thrown from a tower', 'struck down by a kinsman', 'betrayed by the palace guard'])}.`, `Conspirators ${rng.pick(['slew', 'poisoned', 'strangled'])} ${P(p)} of ${Cr(civ)}.`])
      : cause === 'accident' ? pickT([`${P(p)} of ${Cr(civ)} ${rng.pick(['died in a hunting accident', 'was killed when a bridge collapsed beneath the royal procession', 'died of a fall from a horse', 'died in a fire that consumed the old palace', 'died of a surfeit of eels', 'drowned crossing a swollen river', 'choked on a fishbone at a feast'])}.`])
      : `${P(p)} of ${Cr(civ)} died.`;
    const e = ev('death', txt, { civs: [civ.id], persons: [p.id], loc: S.cities[civ.capital] ? S.cities[civ.capital].cell : -1 });
    succession(civ, p, e);
  }
  function succession(civ, dead, deathEvent) {
    const crisisP = 0.1 + (civ.stability < 0.4 ? 0.25 : 0) + (S.year - dead.reignStart < 3 ? 0.15 : 0) + (civ.kind === 'orc' ? 0.2 : 0);
    const deadAge = S.year - dead.born;
    if (!rng.chance(crisisP) || civ.cities.length === 0) {
      // heir
      const ageOfHeir = deadAge < 36 ? rng.irange(6, 15) : rng.irange(16, Math.min(50, Math.max(17, deadAge - 18)));
      const heir = makePerson(civ, { born: S.year - ageOfHeir, parent: dead.id });
      crown(civ, heir);
      const rel = heir.female ? (dead.female ? 'daughter' : 'daughter') : 'son';
      const regency = ageOfHeir < 16;
      const txt = regency ? pickT([`${Pn(heir)}, ${rel} of ${Pb(dead)}, was crowned at the age of ${ageOfHeir}; a council of regents ruled in the child's name.`, `The child ${Pn(heir)} inherited the throne, and the court was ruled by regents.`])
        : pickT([`${Pn(heir)}, ${dead.female ? 'her' : 'his'} ${rel}, succeeded to the throne.`, `${P(heir)} was crowned in ${T(S.cities[civ.capital])}.`, `The crown passed to ${Pn(heir)}, ${rel} of ${Pb(dead)}.`, `${Pn(heir)} succeeded ${dead.female ? 'her' : 'his'} ${dead.female ? 'mother' : 'father'}.`]);
      if (deathEvent) { deathEvent.text += ' ' + txt; deathEvent.persons.push(heir.id); }
      else ev('crown', txt, { civs: [civ.id], persons: [heir.id], imp: 1 });
      return;
    }
    // crisis
    const roll = rng.next();
    if (roll < 0.62 || civ.cities.length < 3 || civ.cells.length < 60) {
      const u = makePerson(civ, { born: S.year - rng.irange(25, 50) });
      crown(civ, u, { dynasty: `House of ${u.name}` });
      ev('crown', pickT([`${Pb(dead)} left no clear heir. ${Pn(u)}, ${rng.pick(['a general', 'the master of the household', 'a distant cousin', 'the captain of the guard', 'a powerful lord', 'the high priest'])}, seized the throne of ${Cr(civ)}.`, `After ${Pb(dead)}'s death the succession was disputed; ${Pn(u)} prevailed and founded a new dynasty in ${Cr(civ)}.`, `${Pn(u)} took the crown of ${Cr(civ)} by force, ending the ${dead.dynasty}.`]), { civs: [civ.id], persons: [u.id], imp: 2 });
      civ.stability -= 0.1;
      return;
    }
    // civil war
    const heir = makePerson(civ, { born: S.year - rng.irange(18, 45), parent: dead.id });
    crown(civ, heir);
    const pretender = makePerson(civ, { born: S.year - rng.irange(22, 50), parent: rng.chance(0.5) ? dead.id : -1 });
    const rebel = secede(civ, pretender, 'succession');
    if (!rebel) { ev('crown', `${Pn(heir)} succeeded ${Pb(dead)} in ${Cr(civ)} after a brief struggle.`, { civs: [civ.id], persons: [heir.id] }); return; }
    const war = declareWar(rebel, civ, 'succession', { quiet: true });
    war.name = namer.unique(() => `the War of the ${civ.name} Succession`, 60);
    ev('war', `${Pb(dead)} died and the succession of ${Cr(civ)} was contested. ${Pn(heir)} was crowned in ${T(S.cities[civ.capital])}, but ${Pn(pretender)}, ${pretender.parent === dead.id ? 'a rival child of the old ruler' : 'claiming descent from an older line'}, raised the banner of ${C(rebel)} at ${T(S.cities[rebel.capital])}. Thus began ${Wn(war)}.`, { civs: [civ.id, rebel.id], persons: [heir.id, pretender.id], imp: 3, war: war.id, loc: S.cities[rebel.capital].cell });
  }
  function secede(civ, leader, kind) {
    // split territory around the largest non-capital city
    const others = civ.cities.filter(id => id !== civ.capital); if (!others.length) return null;
    const rc = S.cities[rng.pick(others)]; const capCell = S.cities[civ.capital].cell;
    const take = civ.cells.filter(c => dist(c, rc.cell) < dist(c, capCell) * 0.95);
    if (take.length < 8) return null;
    const rebel = makeCiv(rc.cell, { lang: civ.lang, parent: civ.id, parentHue: civ.hue, pop: civ.pop * take.length / civ.cells.length, radius: 0, ruler: leader, city: rc });
    for (const c of take) setOwner(c, rebel.id);
    for (const cid of civ.cities.slice()) { const ct = S.cities[cid]; if (owner[ct.cell] === rebel.id && cid !== civ.capital) transferCity(ct, rebel); }
    civ.pop -= rebel.pop; civ.stability = clamp(civ.stability - 0.05, 0, 1); rebel.stability = 0.5;
    rebel.rel[civ.id] = -80; civ.rel[rebel.id] = -80;
    rebel.lineage = kind;
    return rebel;
  }

  // --- diplomacy & war ---
  const contacts = new Map();
  const pairKey = (a, b) => a < b ? a * 4096 + b : b * 4096 + a;
  function scanContacts() {
    contacts.clear();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; const a = owner[i]; if (a < 0) continue;
      if (x < W - 1) { const j = i + 1, b = owner[j]; if (b >= 0 && b !== a) touch(a, b, i, j); }
      if (y < H - 1) { const j = i + W, b = owner[j]; if (b >= 0 && b !== a) touch(a, b, i, j); }
    }
  }
  function touch(a, b, i, j) {
    const k = pairKey(a, b); let c = contacts.get(k);
    if (!c) { c = { len: 0, cells: {} }; contacts.set(k, c); }
    c.len++;
    if (rng.int(c.len) === 0) { c.cells[a] = i; c.cells[b] = j; }
  }
  const atWar = (a, b) => a.wars.some(wid => { const w = S.wars[wid]; return w.end < 0 && (w.a === b.id || w.b === b.id); });
  const warBetween = (a, b) => S.wars.find(w => w.end < 0 && ((w.a === a.id && w.b === b.id) || (w.a === b.id && w.b === a.id)));

  function diplomacy() {
    const civs = alive(); const omen = S.omenYear === S.year;
    for (const [k, c] of contacts) {
      const a = S.civs[Math.floor(k / 4096)], b = S.civs[k % 4096]; if (a.fell >= 0 || b.fell >= 0) continue;
      for (const [x, y] of [[a, b], [b, a]]) {
        let r = x.rel[y.id] || 0;
        r -= c.len * 0.02 * (0.4 + civAggression(x));
        r += KIND_HOSTILITY(x.kind, y.kind) * 0.8;
        if (x.lang === y.lang && x.kind !== 'orc') r += 0.5;
        if (x.allies.has(y.id)) r += 1.5;
        r *= 0.985; x.rel[y.id] = clamp(r, -100, 100);
      }
      // alliance
      if (!a.allies.has(b.id) && (a.rel[b.id] || 0) > 45 && (b.rel[a.id] || 0) > 45 && !atWar(a, b) && rng.chance(0.04)) {
        a.allies.add(b.id); b.allies.add(a.id);
        ev('pact', pickT([`${C(a)} and ${C(b)} swore a pact of alliance${rng.chance(0.5) ? `, sealed by the marriage of ${Pn(S.persons[a.ruler])}'s kin to the house of ${Pn(S.persons[b.ruler])}` : ''}.`, `Envoys of ${Cr(a)} and ${Cr(b)} exchanged gifts and oaths; the two realms became allies.`]), { civs: [a.id, b.id], imp: 2 });
      }
      // war declaration
      for (const [x, y] of [[a, b], [b, a]]) {
        if (atWar(x, y) || (x.truce[y.id] || -1) > S.year || x.wars.length >= 2 || x.allies.has(y.id)) continue;
        const rel = x.rel[y.id] || 0; const aggr = civAggression(x);
        const sr = strength(x) / Math.max(0.01, strength(y));
        let reason = 'border', mult = 1;
        const lostCity = S.cities.find(ct => ct.civ === y.id && ct.destroyed < 0 && ct.ownerHist.some(h => h[1] === x.id) && ct.founder === x.id);
        const lostArt = S.artifacts.find(ar => ar.holder === y.id && ar.origin === x.id);
        if (lostCity && rng.chance(0.6)) { reason = 'reclaim'; mult = 2.2; }
        else if (lostArt && rng.chance(0.6)) { reason = 'artifact'; mult = 2.0; }
        else if (KIND_HOSTILITY(x.kind, y.kind) < -1 && rng.chance(0.5)) { reason = 'ancient'; mult = 1.4; }
        else if (rng.chance(0.3)) reason = 'insult';
        else if (aggr > 0.7 && rng.chance(0.5)) reason = 'ambition';
        let p = 0.007 * (0.3 + aggr * 2.2) * (rel < -30 ? 2.5 : rel < 0 ? 1.2 : 0.3) * (sr > 0.7 ? 1 : 0.3) * (x.stability > 0.35 ? 1 : 0.35) * mult * (omen ? 1.6 : 1);
        if (S.year - x.lastWarEnd < 8) p *= 0.4;
        if (rng.chance(p)) { declareWar(x, y, reason, { lostCity, lostArt, contact: c }); break; }
      }
    }
  }
  function warName(a, b, reason, o) {
    const count = S.wars.filter(w => (w.a === a.id && w.b === b.id) || (w.a === b.id && w.b === a.id)).length;
    if (reason === 'reclaim' && o.lostCity) return namer.unique(() => `the ${o.lostCity.name} War`, 60);
    if (reason === 'artifact' && o.lostArt) return namer.unique(() => `the War of ${o.lostArt.name}`, 60);
    if (reason === 'rebellion') return namer.unique(() => `the ${a.name} ${rng.pick(['Rebellion', 'Rising', 'Revolt'])}`, 60);
    if (count >= 1) return namer.unique(() => `the ${ORD[Math.min(10, count + 1)]} ${a.name}–${b.name} War`, 60);
    const cell = o.contact ? o.contact.cells[b.id] : -1;
    const fid = cell >= 0 ? featureOf[cell] : -1;
    if (fid >= 0 && features[fid].kind !== 'ocean' && features[fid].kind !== 'continent' && rng.chance(0.6)) return namer.unique(() => `the War of ${features[fid].name}`, 60);
    return namer.unique(() => rng.chance(0.5) ? `the ${a.name}–${b.name} War` : `the ${rng.pick(['Long', 'Short', 'Bitter', 'Burning', 'Winter', 'Summer', 'Hundred Days', 'Seven Years', 'Thirty Years', 'Broken', 'Silent', 'Salt'])} War`, 60);
  }
  function declareWar(a, b, reason, o = {}) {
    const war = { id: S.wars.length, name: '', a: a.id, b: b.id, start: S.year, end: -1, reason, battles: 0, aWins: 0, bWins: 0, aCells: 0, bCells: 0, aCas: 0, bCas: 0, result: '', stalemate: 0 };
    war.name = warName(a, b, reason, o);
    S.wars.push(war); a.wars.push(war.id); b.wars.push(war.id);
    const ra = S.persons[a.ruler], rb = S.persons[b.ruler]; ra.deeds.warsStarted++;
    a.calm = 0; b.calm = 0;
    if (a.allies.has(b.id)) { a.allies.delete(b.id); b.allies.delete(a.id); }
    if (!o.quiet) {
      let why;
      switch (reason) {
        case 'reclaim': why = `to reclaim ${T(o.lostCity)}, lost in an earlier war`; break;
        case 'artifact': why = `to recover ${A(o.lostArt)}, carried off by ${Ca(b)} raiders`; break;
        case 'ancient': why = pickT([`and the old hatred between ${KINDS[a.kind].label} and ${KINDS[b.kind].label} flared again`, `for ${KINDS[a.kind].label} and ${KINDS[b.kind].label} have never shared a border in peace`]); break;
        case 'insult': why = pickT([`after ${P(rb)} ${rng.pick(['insulted', 'imprisoned', 'mocked', 'refused to receive', 'had whipped'])} the envoys of ${Cr(a)}`, `after the murder of a ${Ca(a)} merchant in ${T(S.cities[b.capital])}`, `over a matter of tolls on the border roads`, `after ${P(rb)} refused a marriage offered by ${P(ra)}`]); break;
        case 'ambition': why = pickT([`for ${ra.female ? 'she' : 'he'} hungered for glory`, `for ${ra.female ? 'she' : 'he'} had sworn to rule from sea to sea`, `at the urging of ${ra.female ? 'her' : 'his'} generals`]); break;
        default: {
          const cell = o.contact ? o.contact.cells[b.id] : -1; const fid = cell >= 0 ? featureOf[cell] : -1;
          why = fid >= 0 && features[fid].kind !== 'ocean' ? pickT([`over the disputed lands of ${F(features[fid])}`, `after raids across ${F(features[fid])}`, `for mastery of ${F(features[fid])}`]) : pickT([`over disputed borderlands`, `after a season of cattle raids`, `over grazing rights on the frontier`]);
        }
      }
      ev('war', pickT([`${C(a)} declared war on ${C(b)} ${why}. The chroniclers call it ${Wn(war)}.`, `${P(ra)} led ${Cr(a)} to war against ${C(b)} ${why}; thus began ${Wn(war)}.`, `${Wn(war)} began when ${C(a)} marched against ${C(b)} ${why}.`]), { civs: [a.id, b.id], persons: [ra.id, rb.id], imp: 3, war: war.id, loc: o.contact ? o.contact.cells[b.id] : -1 });
      // allies join
      for (const alId of b.allies) { const al = S.civs[alId]; if (al.fell >= 0 || atWar(al, a) || al.wars.length >= 2 || al.allies.has(a.id)) continue; if (rng.chance(0.55)) { const w2 = declareWar(al, a, 'pact', { quiet: true }); w2.name = war.name; ev('war', `Honouring its pact with ${Cr(b)}, ${C(al)} entered ${Wn(war)} against ${C(a)}.`, { civs: [al.id, a.id], imp: 2, war: w2.id }); } }
    }
    return war;
  }
  function endWar(war, how) {
    const a = S.civs[war.a], b = S.civs[war.b];
    war.end = S.year; a.wars = a.wars.filter(id => id !== war.id); b.wars = b.wars.filter(id => id !== war.id);
    a.lastWarEnd = S.year; b.lastWarEnd = S.year;
    a.truce[b.id] = S.year + 25; b.truce[a.id] = S.year + 25;
    if (how === 'fall') return;
    const net = war.aCells - war.bCells;
    const winner = net > 5 ? a : net < -5 ? b : null; const loser = winner === a ? b : winner === b ? a : null;
    a.rel[b.id] = -40; b.rel[a.id] = -40;
    if (winner) { const rw = S.persons[winner.ruler]; if (Math.abs(net) >= 20) rw.deeds.conquests++; war.result = winner.id; }
    const treatyCity = S.cities[rng.chance(0.5) ? a.capital : b.capital];
    const treaty = namer.unique(() => `the ${rng.pick(['Peace', 'Treaty', 'Truce', 'Concord'])} of ${treatyCity ? treatyCity.name : 'the Field'}`, 60);
    const civil = war.reason === 'rebellion' || war.reason === 'succession';
    if (civil) {
      const rebelWon = winner === a || (!winner && how !== 'stalemate' && rng.chance(0.5));
      const txt = rebelWon ? pickT([`${Wn(war)} ended with ${treaty}: ${C(b)} recognised the independence of ${C(a)}.`, `Unable to crush the revolt, ${P(S.persons[b.ruler])} signed ${treaty}, and ${C(a)} took its place among the realms.`])
        : pickT([`${Wn(war)} ended with ${treaty}; ${C(a)} kept its independence in name, but ${rng.pick(['paid tribute', 'bent the knee', 'sent hostages'])} to ${Cr(b)}.`, `${Wn(war)} ended; the two halves of the old realm were never reunited.`]);
      ev('peace', txt, { civs: [a.id, b.id], imp: 2, war: war.id, loc: treatyCity ? treatyCity.cell : -1 });
      return;
    }
    const txt = how === 'stalemate' ? pickT([`${Wn(war)} petered out; the armies of ${Cr(a)} and ${Cr(b)} went home without a treaty.`, `With no border left to fight over, ${Wn(war)} ended in an uneasy silence.`])
      : !winner ? pickT([`${Wn(war)} ended with ${treaty}, which restored the old borders between ${Cr(a)} and ${Cr(b)}.`, `Exhausted after ${S.year - war.start} years of fighting, ${C(a)} and ${C(b)} signed ${treaty}; nothing had changed but the graves.`])
      : pickT([`${Wn(war)} ended with ${treaty}. ${C(loser)} ceded ${Math.abs(net) >= 20 ? 'wide lands' : 'the borderlands'} to ${C(winner)}.`, `${C(winner)} dictated ${treaty} to a beaten ${Cr(loser)}, ending ${Wn(war)} after ${S.year - war.start} years.`, `${P(S.persons[loser.ruler])} sued for peace; by ${treaty}, ${Wn(war)} ended in victory for ${Cr(winner)}.`]);
    ev('peace', txt, { civs: [a.id, b.id], imp: 2, war: war.id, loc: treatyCity ? treatyCity.cell : -1 });
  }
  function fightWars() {
    for (const war of S.wars) {
      if (war.end >= 0) continue;
      const a = S.civs[war.a], b = S.civs[war.b];
      if (a.fell >= 0 || b.fell >= 0) { endWar(war, 'fall'); continue; }
      const c = contacts.get(pairKey(a.id, b.id));
      if (!c) { war.stalemate++; if (war.stalemate >= 4) endWar(war, 'stalemate'); continue; }
      war.stalemate = 0;
      const dur = S.year - war.start;
      if (rng.chance(0.68)) battle(war, a, b, c);
      if (a.fell >= 0 || b.fell >= 0) { endWar(war, 'fall'); continue; }
      const lostFrac = Math.max(war.aCells / Math.max(1, b.cells.length + war.aCells), war.bCells / Math.max(1, a.cells.length + war.bCells));
      let pEnd = 0.03 + 0.025 * war.battles + (lostFrac > 0.35 ? 0.3 : 0) + (dur > 12 ? 0.15 : 0);
      if (rng.chance(pEnd)) endWar(war, 'treaty');
    }
  }
  function lognormal(s) { return Math.exp(rng.gauss() * s); }
  function battle(war, a, b, c) {
    const ra = S.persons[a.ruler], rb = S.persons[b.ruler];
    let sa = strength(a) * lognormal(0.4), sb = strength(b) * 1.1 * lognormal(0.4);
    const siteB = c.cells[b.id], siteA = c.cells[a.id];
    const bb = biome[siteB]; if (bb === B.MOUNTAIN || bb === B.PEAK) sb *= 1.5; else if (bb === B.FOREST || bb === B.JUNGLE || bb === B.SWAMP) sb *= 1.2; if (world.river[siteB] > 0) sb *= 1.2;
    const attackerWins = sa > sb; const winner = attackerWins ? a : b, loser = attackerWins ? b : a;
    const site = attackerWins ? siteB : siteA;
    const margin = Math.abs(Math.log(sa / sb));
    const cellsTaken = clamp(Math.round((2 + margin * 8) * (1 + Math.sqrt(loser.cells.length) / 9)), 2, 140);
    const loserCas = Math.round(loser.pop * clamp(0.015 + 0.03 * margin, 0.01, 0.09)), winnerCas = Math.round(winner.pop * clamp(0.008 + 0.01 * margin, 0.005, 0.03));
    loser.pop -= loserCas; winner.pop -= winnerCas;
    if (attackerWins) { war.aWins++; war.aCas += winnerCas; war.bCas += loserCas; } else { war.bWins++; war.bCas += winnerCas; war.aCas += loserCas; }
    war.battles++;
    const rw = S.persons[winner.ruler], rl = S.persons[loser.ruler]; rw.deeds.won++; rl.deeds.lost++; rw.fame += 2;
    // capture cells by BFS from site over loser's cells
    const taken = []; const q = [site]; const seen = new Set([site]);
    while (q.length && taken.length < cellsTaken) { const cur = q.shift(); if (owner[cur] !== loser.id) continue; taken.push(cur); neighbors4(cur, n => { if (!seen.has(n) && owner[n] === loser.id) { seen.add(n); q.push(n); } }); }
    for (const t of taken) setOwner(t, winner.id);
    if (attackerWins) war.aCells += taken.length; else war.bCells += taken.length;
    // cities captured?
    const captured = S.cities.filter(ct => ct.civ === loser.id && ct.destroyed < 0 && owner[ct.cell] === winner.id);
    const pn = placeName(site, loser);
    const dead = [];
    // ruler at battle
    for (const [side, ruler, won] of [[a, ra, attackerWins], [b, rb, !attackerWins]]) {
      const leads = has(ruler, 'brave') || has(ruler, 'brash') || has(ruler, 'ambitious') ? 0.55 : has(ruler, 'craven') ? 0.08 : 0.3;
      if (rng.chance(leads) && rng.chance(won ? 0.03 : 0.13)) dead.push([side, ruler]);
    }
    const bName = captured.length && pn.city && captured.includes(pn.city) ? `the Siege of ${T(pn.city)}` : `the Battle of ${pn.text}`;
    const sideAdv = attackerWins ? 'attacking' : 'defending';
    let txt; let battleEvent = null;
    if (captured.length) {
      const ct = captured[0];
      const sacked = rng.chance(0.45) || has(rw, 'cruel');
      txt = pickT([`${C(winner)} won ${bName}; ${T(ct)} ${sacked ? 'was stormed and put to the sack' : 'opened its gates to the victors'}.`, `After ${bName}, the ${Ca(loser)} garrison of ${T(ct)} ${sacked ? `was put to the sword by ${P(rw)}'s men and the town burned` : `surrendered to ${P(rw)}`}.`, `${P(rw)} took ${T(ct)} after ${bName}${sacked ? ' and gave the town over to plunder for three days' : ''}.`]);
      battleEvent = ev('battle', txt, { civs: [winner.id, loser.id], persons: [rw.id, rl.id], loc: site, imp: 2, war: war.id });
      for (const city of captured) {
        transferCity(city, winner);
        if (sacked) { city.sacked++; loser.pop -= Math.round(loser.pop * 0.03); for (const wid of city.wonders) { const wo = winner === a ? null : null; } for (const wo of loser.wonders.slice()) { if (wo.city === city.id && rng.chance(0.5)) { wo.destroyed = S.year; loser.wonders = loser.wonders.filter(x => x !== wo); ev('wonder', `In the sack of ${T(city)}, ${wo.name} ${rng.pick(['was burned', 'was torn down for its stone', 'was looted and left a ruin'])}.`, { civs: [loser.id, winner.id], loc: city.cell, imp: 2 }); } } }
        if (city.id === loser.capital) {
          // loot artifacts
          for (const aid of loser.artifacts.slice()) { const ar = S.artifacts[aid]; loser.artifacts = loser.artifacts.filter(x => x !== aid); winner.artifacts.push(aid); ar.holder = winner.id; ar.hist.push([S.year, winner.id]); ev('artifact', `${A(ar)} was carried off from ${T(city)} as plunder by the ${Ca(winner)} host.`, { civs: [winner.id, loser.id], loc: city.cell, imp: 2 }); }
          const rest = loser.cities.filter(id => id !== city.id && S.cities[id].destroyed < 0);
          if (rest.length) { loser.capital = rest[0]; loser.capitalHist.push([S.year, rest[0]]); ev('capital', `The court of ${Cr(loser)} fled to ${T(S.cities[rest[0]])}.`, { civs: [loser.id], loc: S.cities[rest[0]].cell }); }
          else { fallOfCiv(loser, winner, war); }
        }
      }
    } else {
      const n = Math.round(loserCas / 100) * 100;
      txt = pickT([`At ${bName}, the ${sideAdv} host of ${Cr(winner)} broke the army of ${Cr(loser)}; some ${n.toLocaleString()} fell.`, `${P(rw)} ${rng.pick(['routed', 'defeated', 'scattered', 'crushed'])} ${Cd(loser)} at ${bName}.`, `${C(winner)} won ${bName}${margin > 0.8 ? ', a slaughter from which the ' + Ca(loser) + ' army never recovered' : ''}.`, `${Cd(loser)} were driven back at ${bName}, and ${Cr(winner)} seized the lands beyond.`]);
    }
    if (!battleEvent) battleEvent = ev('battle', txt, { civs: [winner.id, loser.id], persons: [rw.id, rl.id], loc: site, imp: 1, war: war.id });
    for (const [side, ruler] of dead) {
      if (side.fell >= 0) continue;
      ruler.died = S.year; ruler.reignEnd = S.year; ruler.epithet = epithetFor(ruler, side) || (rng.chance(0.5) ? 'the Fallen' : '');
      ev('death', pickT([`${P(ruler)} of ${Cr(side)} fell at ${bName}.`, `${P(ruler)} was slain at ${bName}, ${rng.pick(['cut down in the rout', 'fighting at the fore', 'struck by an arrow', 'unhorsed and trampled'])}.`]), { civs: [side.id], persons: [ruler.id], loc: site, imp: 2, war: war.id });
      succession(side, ruler);
    }
    a.stability -= 0.02; b.stability -= 0.02;
  }
  function fallOfCiv(civ, conqueror, war) {
    civ.fell = S.year;
    for (const c of civ.cells.slice()) setOwner(c, conqueror ? conqueror.id : -1);
    for (const cid of civ.cities.slice()) { const ct = S.cities[cid]; if (conqueror) transferCity(ct, conqueror); else ct.destroyed = S.year; }
    for (const w of S.wars) if (w.end < 0 && (w.a === civ.id || w.b === civ.id)) { w.end = S.year; const o = S.civs[w.a === civ.id ? w.b : w.a]; o.wars = o.wars.filter(id => id !== w.id); }
    civ.wars = [];
    for (const o of S.civs) { o.allies.delete(civ.id); }
    if (conqueror) { conqueror.pop += civ.pop * 0.6; const rc = S.persons[conqueror.ruler]; rc.deeds.conquests += 2; rc.fame += 5; for (const aid of civ.artifacts) { const ar = S.artifacts[aid]; ar.holder = conqueror.id; ar.hist.push([S.year, conqueror.id]); conqueror.artifacts.push(aid); } civ.artifacts = []; }
    ev('fall', conqueror ? pickT([`With the fall of ${T(S.cities[civ.capital])}, ${C(civ)} was no more. Its lands passed to ${C(conqueror)}, ${civ.founded > 0 ? `${S.year - civ.founded} years after its founding` : 'ending a realm older than the chronicle'}.`, `${C(civ)} fell to ${C(conqueror)}. ${P(S.persons[civ.ruler])} ${rng.pick(['was led away in chains', 'fled into exile', 'was put to death', 'took the black and vanished into a monastery', 'was never seen again'])}.`])
      : `${C(civ)} faded from the chronicles.`, { civs: [civ.id, conqueror ? conqueror.id : -1].filter(x => x >= 0), imp: 3, loc: S.cities[civ.capital].cell, war: war ? war.id : -1 });
  }

  // --- rebellions, plagues, heroes, wonders, artifacts, omens ---
  function rebellions(civ) {
    if (civ.stability > 0.28) return;
    if (civ.cities.length >= 2 && civ.cells.length >= 24 && rng.chance(0.09)) {
      const leader = makePerson(civ, { born: S.year - rng.irange(22, 50), role: 'rebel' });
      const rebel = secede(civ, leader, 'rebellion'); if (!rebel) return;
      const war = declareWar(rebel, civ, 'rebellion', { quiet: true });
      ev('war', pickT([`The ${rng.pick(['provinces', 'lords', 'towns', 'hill-clans', 'peasants', 'merchants'])} of ${T(S.cities[rebel.capital])} rose against ${P(S.persons[civ.ruler])}. Led by ${Pn(leader)}, they proclaimed ${C(rebel)}; thus began ${Wn(war)}.`, `${Pn(leader)} raised the standard of revolt at ${T(S.cities[rebel.capital])} and declared the independence of ${C(rebel)} from ${Cr(civ)}. ${Wn(war)} had begun.`]), { civs: [rebel.id, civ.id], persons: [leader.id], imp: 3, war: war.id, loc: S.cities[rebel.capital].cell });
      return;
    }
    if (civ.stability < 0.2 && rng.chance(0.08)) {
      const old = S.persons[civ.ruler]; old.died = S.year; old.reignEnd = S.year; old.epithet = epithetFor(old, civ) || (rng.chance(0.4) ? 'the Deposed' : '');
      const u = makePerson(civ, { born: S.year - rng.irange(25, 50) });
      crown(civ, u, { dynasty: `House of ${u.name}` });
      civ.stability = 0.5;
      ev('crown', pickT([`${P(old)} of ${Cr(civ)} was overthrown by ${Pn(u)}, who ${rng.pick(['took the throne', 'was acclaimed by the army', 'was raised on the shields of the soldiers', 'ruled in all but name until the coronation'])}.`, `A mob stormed the palace at ${T(S.cities[civ.capital])}; ${P(old)} was ${rng.pick(['slain', 'driven out', 'blinded and exiled'])}, and ${Pn(u)} proclaimed a new dynasty in ${Cr(civ)}.`]), { civs: [civ.id], persons: [old.id, u.id], imp: 2, loc: S.cities[civ.capital].cell });
    }
  }
  function plagues() {
    const active = S.plagues.filter(p => p.end < 0);
    for (const pl of active) {
      let any = false;
      for (const civ of alive()) {
        if (civ.plagueId === pl.id && civ.plague > 0) {
          any = true; civ.plague--; if (civ.plague === 0) civ.plagueId = -1;
          // spread
          for (const [k, c] of contacts) { const x = Math.floor(k / 4096), y = k % 4096; const o = x === civ.id ? S.civs[y] : y === civ.id ? S.civs[x] : null; if (!o || o.fell >= 0 || o.plague > 0 || pl.hit.has(o.id)) continue; if (rng.chance(0.22)) infect(o, pl); }
        }
      }
      if (!any) { pl.end = S.year; ev('plague', pickT([`${pl.name} burned itself out at last, ${S.year - pl.start} years after it first appeared.`, `The last outbreaks of ${pl.name} died away; the survivors reckoned a third of the world had perished.`]), { imp: 2 }); }
    }
    if (!active.length && rng.chance(0.011) && alive().length) {
      const civ = rng.pick(alive());
      const pl = { id: S.plagues.length, name: rng.pick(PLAGUE_NAMES.filter(n => !S.plagues.some(p => p.name === n))) || `the ${rng.pick(ADJ)} Plague`, start: S.year, end: -1, hit: new Set() };
      S.plagues.push(pl);
      infect(civ, pl, true);
    }
  }
  function infect(civ, pl, first) {
    civ.plague = rng.irange(3, 6); civ.plagueId = pl.id; pl.hit.add(civ.id); civ.calm = 0;
    const capc = S.cities[civ.capital];
    ev('plague', first ? pickT([`A sickness appeared ${rng.pick(['among the dockworkers', 'in the poor quarter', 'among the rats of the granaries', 'in a caravan from the east', 'after the floods'])} of ${T(capc)}. The chroniclers would call it ${pl.name}.`, `${pl.name} first struck ${C(civ)}; in ${T(capc)} the dead were piled in the streets.`])
      : pickT([`${pl.name} crossed into ${Cr(civ)}; ${T(capc)} shut its gates, to no avail.`, `${pl.name} reached ${C(civ)}. Whole villages were left to the crows.`, `The sickness spread to ${Cr(civ)}, where ${P(S.persons[civ.ruler])} ordered the roads closed.`]), { civs: [civ.id], imp: 2, loc: capc.cell });
  }
  function famine(civ) {
    if (civ.famine > 0) { civ.famine--; return; }
    if (rng.chance(0.0045)) {
      civ.famine = 2; civ.pop *= 0.86; civ.calm = 0;
      ev('famine', pickT([`${rng.pick(['The harvest failed', 'Rains drowned the fields', 'A drought withered the crops', 'Locusts stripped the fields', 'A late frost killed the seedlings'])} in ${Cr(civ)}; famine followed, and ${rng.pick(['the people ate the seed corn', 'bread cost its weight in silver', 'the roads filled with beggars', 'whole villages were abandoned'])}.`]), { civs: [civ.id], imp: 1, loc: S.cities[civ.capital].cell });
    }
  }
  function heroes(civ) {
    if (!rng.chance(0.011)) return;
    const hero = makePerson(civ, { born: S.year - rng.irange(18, 40), role: 'hero' });
    hero.fame = 5;
    const roll = rng.next(); const capc = S.cities[civ.capital];
    const wild = nearestFeature(capc.cell, ['mountains', 'forest', 'swamp', 'jungle', 'lake', 'frost', 'desert'], 60);
    const lost = S.artifacts.filter(a => a.lostAt >= 0);
    let txt, loc = capc.cell;
    if (lost.length && roll < 0.2) { const ar = rng.pick(lost); const f = features[ar.lostAt]; ar.lostAt = -1; ar.holder = civ.id; civ.artifacts.push(ar.id); ar.hist.push([S.year, civ.id]); txt = pickT([`${Pn(hero)} of ${Cr(civ)} ${rng.pick(['recovered', 'brought back', 'won'])} ${A(ar)} from ${F(f)}, where it had lain lost for ${S.year - ar.lostYear} years.`]); loc = f.cells[0] != null ? f.cells[0] : capc.cell; hero.note = `recovered ${ar.name}`; }
    else if (roll < 0.42 && wild) { const beast = rng.pick(BEASTS); txt = pickT([`${Pn(hero)} of ${Cr(civ)} slew the ${beast} of ${F(wild)}${rng.chance(0.5) ? ', which had terrorised the borderlands for a generation' : ''}.`, `A ${beast} came out of ${F(wild)} and ${rng.pick(['burned the outlying farms', 'devoured the flocks', 'carried off travellers'])}; ${Pn(hero)} tracked it to its lair and killed it.`]); loc = wild.cells.length ? wild.cells[rng.int(wild.cells.length)] : capc.cell; hero.note = `slew the ${beast} of ${wild.name}`; }
    else if (roll < 0.55 && civ.wars.length) { const w = S.wars[civ.wars[0]]; const foe = S.civs[w.a === civ.id ? w.b : w.a]; txt = pickT([`${Pn(hero)} held ${rng.pick(['the bridge', 'the pass', 'the gate', 'the ford'])} at ${T(capc)} against ${Cd(foe)} ${rng.pick(['with a dozen companions', 'alone for a day and a night', 'until relief came'])}, and the song of it is still sung.`]); hero.note = `held the gate against the ${foe.demonym}`; }
    else if (roll < 0.68) { const sea = nearestFeature(capc.cell, ['sea', 'ocean'], 80); const far = rng.pick(features.filter(f => f.kind === 'island' || f.kind === 'continent' || f.kind === 'desert' || f.kind === 'frost')) || wild; txt = pickT([`${Pn(hero)} of ${Cr(civ)} ${sea && rng.chance(0.5) ? `sailed ${F(sea)}` : `crossed ${F(far || wild)}`} and returned with ${rng.pick(['maps', 'strange seeds', 'tales of a city of glass', 'a cargo of spices', 'the bones of a giant'])}.`]); hero.note = 'explorer'; }
    else if (roll < 0.8) { const epic = namer.unique(() => `the ${rng.pick(['Lay', 'Song', 'Saga', 'Book', 'Dream'])} of ${rng.chance(0.5) ? cap(namer.raw(civ.lang, 1, 2)) : rng.pick(ADJ) + ' ' + rng.pick(['Kings', 'Ships', 'Winters', 'Stars', 'Swords'])}`, 60); txt = pickT([`${Pn(hero)}, a ${rng.pick(['bard', 'scribe', 'poet', 'blind singer'])} of ${T(capc)}, composed ${epic}, which is still ${rng.pick(['sung', 'recited', 'copied'])} in ${Cr(civ)}.`]); hero.note = `composed ${epic}`; }
    else if (roll < 0.9) { const ord = namer.unique(() => `the Order of the ${rng.pick(ADJ)} ${rng.pick(ORDERS)}`, 60); txt = pickT([`${Pn(hero)} founded ${ord} at ${T(capc)}, ${rng.pick(['vowing poverty and the sword', 'to tend the sick', 'to guard the roads', 'to keep the old rites'])}.`]); civ.stability += 0.05; hero.note = `founded ${ord}`; }
    else { const ar = makeArtifact(civ); ar.lostYear = -1; txt = pickT([`${Pn(hero)}, master smith of ${T(capc)}, forged ${A(ar)} for ${P(S.persons[civ.ruler])}.`, `In the forges of ${T(capc)}, ${Pn(hero)} made ${A(ar)}, said to be ${rng.pick(['unbreakable', 'warm to the touch', 'heavier than it looked', 'cursed', 'lit from within'])}.`]); hero.note = `forged ${ar.name}`; }
    ev('hero', txt, { civs: [civ.id], persons: [hero.id], loc, imp: 1 });
  }
  function wonders(civ) {
    const r = S.persons[civ.ruler];
    let p = 0.0035; if (has(r, 'pious') || has(r, 'vain') || has(r, 'scholarly')) p *= 2.2;
    if (civ.stability < 0.55 || civ.pop < 14000 || civ.wars.length) return;
    if (!rng.chance(p)) return;
    const capc = S.cities[civ.capital];
    const name = namer.unique(() => `the ${rng.pick(WONDER_ADJ)} ${rng.pick(WONDER_NOUN)} of ${capc.name}`, 60);
    const w = { name, city: capc.id, year: S.year, civ: civ.id, destroyed: -1 }; civ.wonders.push(w); capc.wonders.push(w); r.deeds.wonders++; r.fame += 3; civ.fame += 3;
    ev('wonder', pickT([`${P(r)} completed ${name}, ${rng.irange(9, 40)} years in the building.`, `${name} was consecrated in the presence of ${P(r)}; pilgrims came from every realm to see it.`, `The masons of ${Cr(civ)} finished ${name}, ${rng.pick(['the tallest work of hands in the known world', 'faced with white marble', 'whose like had never been seen', 'visible from three days away'])}.`]), { civs: [civ.id], persons: [r.id], loc: capc.cell, imp: 2 });
  }
  function artifacts(civ) {
    for (const aid of civ.artifacts.slice()) {
      if (!rng.chance(0.003)) continue;
      const ar = S.artifacts[aid]; const f = nearestFeature(S.cities[civ.capital].cell, ['mountains', 'forest', 'swamp', 'lake', 'sea', 'jungle', 'desert'], 80); if (!f) continue;
      ar.holder = -1; ar.lostAt = f.id; ar.lostYear = S.year; ar.hist.push([S.year, -1]); civ.artifacts = civ.artifacts.filter(x => x !== aid);
      ev('artifact', pickT([`${A(ar)} was lost in ${F(f)} ${rng.pick(['when the royal barge sank', 'in a snowstorm', 'to bandits', 'with a party that never returned', 'in circumstances no two chroniclers agree on'])}.`]), { civs: [civ.id], imp: 1, loc: f.cells[0] != null ? f.cells[0] : -1 });
    }
  }
  function omens() {
    if (!rng.chance(0.022)) return;
    S.omenYear = S.year;
    const civs = alive(); const civ = civs.length ? rng.pick(civs) : null;
    const txt = rng.pick([
      `A great comet hung in the sky for ${rng.irange(20, 90)} nights, and was taken everywhere as an ill omen.`,
      `The sun was darkened at midday${civ ? `, and in ${T(S.cities[civ.capital])} the people wailed in the streets` : ''}.`,
      `The moon rose red for seven nights.`,
      `An earthquake shook ${civ ? T(S.cities[civ.capital]) : 'the eastern lands'}; ${rng.pick(['towers fell', 'the river changed its course', 'a chasm opened in the market square'])}.`,
      `A white stag was seen ${civ ? `at the gates of ${T(S.cities[civ.capital])}` : 'in the forests'}; the wise read it as a sign of ${rng.pick(['war', 'a great king to come', 'famine', 'the end of an age'])}.`,
      `Fire fell from the sky over the ${rng.pick(['northern', 'western', 'southern'])} sea.`,
      `It snowed in midsummer${civ ? ` in ${Cr(civ)}` : ''}, and the vines died.`,
      `A child was born ${civ ? `in ${T(S.cities[civ.capital])}` : ''} with ${rng.pick(['a full set of teeth', 'eyes like a cat', 'a caul, and was declared a prophet'])}.`,
      `The rivers ran ${rng.pick(['black', 'red', 'dry', 'backwards'])} for a season.`,
    ]);
    ev('omen', txt, { civs: civ ? [civ.id] : [], imp: 0, loc: civ ? S.cities[civ.capital].cell : -1 });
  }
  function goldenAge(civ) {
    if (civ.goldenAge > 0) { civ.goldenAge--; return; }
    if (civ.wars.length || civ.plague || civ.famine || civ.stability < 0.75) { civ.calm = 0; return; }
    civ.calm++;
    if (civ.calm > 20 && rng.chance(0.08)) {
      civ.goldenAge = 30; civ.calm = 0; civ.goldenAges++; const r = S.persons[civ.ruler]; r.fame += 3;
      ev('golden', pickT([`Under ${P(r)}, ${C(civ)} entered a golden age: ${rng.pick(['the granaries overflowed', 'roads were paved from ' + S.cities[civ.capital].name + ' to the border', 'poets and philosophers flocked to the court', 'the harbours were full of foreign sails', 'the law was written down for the first time'])}.`]), { civs: [civ.id], persons: [r.id], imp: 2, loc: S.cities[civ.capital].cell });
    }
  }
  function rulerYear(civ) {
    const p = S.persons[civ.ruler]; const age = S.year - p.born;
    let hazard = 0.002 + 0.15 * Math.exp((age - p.lifespan) / (0.09 * p.lifespan));
    if (civ.plague) hazard += 0.05;
    let murder = 0.003 + ((has(p, 'cruel') || has(p, 'mad') || has(p, 'paranoid')) ? 0.012 : 0) + (civ.stability < 0.3 ? 0.015 : 0);
    const r = rng.next();
    if (r < hazard) rulerDies(civ, p, civ.plague && rng.chance(0.7) ? 'plague' : 'age');
    else if (r < hazard + murder) rulerDies(civ, p, 'murder');
    else if (r < hazard + murder + 0.0025) rulerDies(civ, p, 'accident');
  }
  function migrations() {
    const n = alive().length; if (n >= 16 || !rng.chance(n < 6 ? 0.06 : 0.022)) return;
    const occ = []; for (let i = 0; i < N; i++) if (owner[i] >= 0) occ.push(i);
    const od = bfsDistance(W, H, occ, 12);
    let best = -1, bs = 0;
    for (let k = 0; k < 400; k++) { const i = rng.int(N); if (!isLand[i] || lake[i] || owner[i] >= 0 || od[i] >= 0) continue; const s = fert[i] * rng.range(0.7, 1.3); if (s > bs) { bs = s; best = i; } }
    if (best < 0 || bs < 0.5) return;
    const civ = makeCiv(best, { radius: 2, pop: 3500 });
    const sea = nearestFeature(best, ['sea', 'ocean'], 12); const mts = nearestFeature(best, ['mountains', 'desert', 'frost', 'forest'], 25);
    ev('found', pickT([`${Ca(civ)} ${rng.pick(['ships', 'longboats', 'rafts'])}${sea ? ` crossed ${F(sea)}` : ' came out of the fog'} and their people settled at ${T(S.cities[civ.capital])}. ${P(S.persons[civ.ruler])} was their ${civ.titleM === civ.titleF ? civ.titleM.toLowerCase() : 'first ruler'}.`, `A new people, ${Cd(civ)}, came ${mts ? `out of ${F(mts)}` : 'from lands beyond the map'} and raised the walls of ${T(S.cities[civ.capital])}. Thus was ${C(civ)} founded.`, `${KINDS[civ.kind].label.charAt(0).toUpperCase() + KINDS[civ.kind].label.slice(1)} speaking the ${civ.lang.label} tongue settled ${T(S.cities[civ.capital])} under ${P(S.persons[civ.ruler])}; they called their realm ${C(civ)}.`]), { civs: [civ.id], persons: [civ.ruler], imp: 3, loc: best });
  }

  // ---------- founding ----------
  S.year = 1; curDelta = []; S.deltas[1] = curDelta;
  const nCivs = clamp(Math.round(world.landCount / 2600) + rng.irange(-1, 2), 6, 13);
  const sites = spawnSites(nCivs);
  for (const site of sites) {
    const civ = makeCiv(site, { radius: rng.irange(2, 3), pop: rng.irange(3000, 7000) });
    const capc = S.cities[civ.capital]; const near = nearestFeature(site, ['river', 'lake', 'sea', 'mountains', 'forest', 'plains'], 8);
    ev('found', pickT([`In the first years of the chronicle, ${Cd(civ)} ${rng.pick(['raised the walls', 'built the first halls', 'laid the stones'])} of ${T(capc)}${near ? ` beside ${F(near)}` : ''}. ${P(S.persons[civ.ruler])} ruled them.`, `${C(civ)} was founded at ${T(capc)}${near ? ` near ${F(near)}` : ''} by ${P(S.persons[civ.ruler])}.`, `${P(S.persons[civ.ruler])} united the ${KINDS[civ.kind].label} of ${near ? F(near) : 'the region'} and was crowned at ${T(capc)}; so began ${C(civ)}.`]), { civs: [civ.id], persons: [civ.ruler], imp: 3, loc: site });
  }
  // give founders a few years of head start territory
  for (let k = 0; k < 6; k++) for (const civ of S.civs) expand(civ);

  // ---------- main loop ----------
  S.keyframes[0] = Int16Array.from(owner);
  S.simulated = 0;
  S.advance = function (n) { const end = S.simulated + n; runYears(S.simulated + 1, end); S.simulated = end; S.totalYears = end; };
  function runYears(from, to) {
  for (let year = from; year <= to; year++) {
    S.year = year; if (!S.deltas[year]) S.deltas[year] = []; curDelta = S.deltas[year];
    scanContacts();
    omens();
    const civs = alive();
    for (const civ of civs) { if (civ.fell >= 0) continue; growPop(civ); expand(civ); maybeFoundCity(civ); updateStability(civ); }
    diplomacy();
    fightWars();
    for (const civ of alive()) { rulerYear(civ); if (civ.fell >= 0) continue; rebellions(civ); famine(civ); heroes(civ); wonders(civ); artifacts(civ); goldenAge(civ); }
    plagues();
    migrations();
    // civs with no cells die quietly
    for (const civ of alive()) if (civ.cells.length === 0 || civ.cities.length === 0) fallOfCiv(civ, null, null);
    if (year % 5 === 0) for (const civ of alive()) civ.hist.push([year, Math.round(civ.pop), civ.cells.length]);
    let pop = 0; for (const civ of alive()) pop += civ.pop;
    S.stats.push({ year, alive: alive().length, pop: Math.round(pop), wars: S.wars.filter(w => w.end < 0).length });
    if (year % KEYFRAME === 0) S.keyframes[year / KEYFRAME] = Int16Array.from(owner);
  }
  }
  if (totalYears > 0) S.advance(totalYears);
  return S;
}

// ---------- reconstruction & text ----------
function ownerAt(S, year, buf) {
  const k = Math.floor(year / KEYFRAME); const base = S.keyframes[k];
  const out = buf || new Int16Array(base.length); out.set(base);
  for (let y = k * KEYFRAME + 1; y <= year; y++) { const d = S.deltas[y]; if (!d) continue; for (let i = 0; i < d.length; i += 2) out[d[i]] = d[i + 1]; }
  return out;
}
function cityOwnerAt(city, year) { let o = -1; for (const [y, c] of city.ownerHist) { if (y <= year) o = c; else break; } return o; }
function capitalAt(civ, year) { let o = -1; for (const [y, c] of civ.capitalHist) { if (y <= year) o = c; else break; } return o; }
function artifactHolderAt(a, year) { if (year < a.made) return -1; let o = a.origin; for (const [y, c] of a.hist) { if (y <= year) o = c; else break; } return o; }
function personTitle(S, p) { const civ = S.civs[p.civ]; if (p.role !== 'ruler' || p.reignStart < 0) return ''; return p.female ? civ.titleF : civ.titleM; }
function personName(S, p, mode, year) {
  const num = p.num > 1 ? ' ' + romanize(p.num) : '';
  if (mode === 'b') return p.name;
  if (mode === 'n') return p.name + num;
  const title = personTitle(S, p);
  const showEp = p.epithet && (year == null || (p.died >= 0 && p.died <= year));
  return (title ? title + ' ' : '') + p.name + num + (showEp ? ' ' + p.epithet : '');
}
const TOKEN_RE = /\[\[([cptfwa])(\d+)(?:\|(\w+))?\]\]/g;
function resolveText(S, text, render, year) {
  const r = render || ((kind, id, label) => label);
  let out = text.replace(TOKEN_RE, (m, kind, idS, mode) => {
    const id = +idS;
    switch (kind) {
      case 'c': { const c = S.civs[id]; return r('c', id, mode === 'd' ? c.demonym : mode === 'r' ? c.name : mode === 'a' ? c.adj : c.fullName); }
      case 'p': { const p = S.persons[id]; return r('p', id, personName(S, p, mode, year)); }
      case 't': return r('t', id, S.cities[id].name);
      case 'f': return r('f', id, S.world.features[id].name);
      case 'w': return r('w', id, S.wars[id].name);
      case 'a': return r('a', id, S.artifacts[id].name);
    }
    return m;
  });
  // capitalise sentence starts (handles leading "the ...")
  out = out.replace(/(^|[.!?]\s+)(<[^>]+>)?([a-z])/g, (m, a, tag, ch) => a + (tag || '') + ch.toUpperCase());
  return out;
}

if (typeof module !== 'undefined') module.exports = { simulateHistory, ownerAt, cityOwnerAt, capitalAt, artifactHolderAt, resolveText, personName, personTitle, KEYFRAME };
