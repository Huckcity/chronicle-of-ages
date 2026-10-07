const W = require('./world.js'); const Nn = require('./names.js'); const Hh = require('./history.js');
const seed = process.argv[2] || 'alpha'; const years = +(process.argv[3] || 500);
let t0 = Date.now();
const world = W.generateWorld(seed, 320, 200);
const tw = Date.now() - t0; t0 = Date.now();
const S = Hh.simulateHistory(seed, world, years);
const th = Date.now() - t0;
console.log(`world ${tw}ms history ${th}ms | civs ${S.civs.length} alive ${S.civs.filter(c=>c.fell<0).length} | events ${S.events.length} wars ${S.wars.length} persons ${S.persons.length} cities ${S.cities.length} plagues ${S.plagues.length} artifacts ${S.artifacts.length}`);
const kinds = {}; for (const e of S.events) kinds[e.kind] = (kinds[e.kind] || 0) + 1; console.log(kinds);
const last = S.stats[S.stats.length - 1]; console.log('final', last);
let owned = 0; for (let i = 0; i < S.owner.length; i++) if (S.owner[i] >= 0) owned++; console.log('owned land %', (100 * owned / world.landCount).toFixed(1));
if (process.argv[4] === 'text') {
  for (const e of S.events) if (e.year <= +(process.argv[5] || 80) || e.imp >= 3) console.log(String(e.year).padStart(4), e.kind.padEnd(8), Hh.resolveText(S, e.text, null, e.year));
}
if (process.argv[4] === 'civs') {
  for (const c of S.civs) console.log(c.id, c.fullName, '|', c.demonym, '|', c.kind, c.lang.id, '| founded', c.founded, 'fell', c.fell, '| cells', c.cells.length, 'cities', c.cities.length, 'pop', Math.round(c.pop), 'rulers', c.rulers.length, 'stab', c.stability.toFixed(2));
}
// consistency: reconstruct owner at final year and compare
const rec = Hh.ownerAt(S, years); let diff = 0; for (let i = 0; i < rec.length; i++) if (rec[i] !== S.owner[i]) diff++; console.log('reconstruction diff', diff);
