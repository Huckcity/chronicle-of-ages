const W = require('./world.js'); require('./names.js'); const Hh = require('./history.js');
const seed = process.argv[2] || 'alpha'; const years = +(process.argv[3] || 500);
const world = W.generateWorld(seed, 320, 200);
const S = Hh.simulateHistory(seed, world, years);
const reasons = {}; for (const w of S.wars) reasons[w.reason] = (reasons[w.reason] || 0) + 1;
console.log('wars by reason', reasons);
const kinds = {}; for (const e of S.events) kinds[e.kind] = (kinds[e.kind] || 0) + 1; console.log('events', JSON.stringify(kinds));
// coverage over time
const buf = new Int16Array(world.N);
const line = [];
for (let y = 50; y <= years; y += 50) { Hh.ownerAt(S, y, buf); let o = 0; for (let i = 0; i < buf.length; i++) if (buf[i] >= 0) o++; const st = S.stats[y - 1]; line.push(`${y}:${(100 * o / world.landCount).toFixed(0)}%/${st.alive}civs/${(st.pop / 1e6).toFixed(1)}M`); }
console.log(line.join('  '));
const alive = S.civs.filter(c => c.fell < 0).sort((a, b) => b.cells.length - a.cells.length);
console.log('alive sizes', alive.map(c => c.cells.length).join(','));
console.log('lifespans of dead', S.civs.filter(c => c.fell >= 0).map(c => c.fell - c.founded).sort((a, b) => a - b).join(','));
const battles = S.events.filter(e => e.kind === 'battle').length; console.log('battles/war', (battles / S.wars.length).toFixed(2), 'avg war len', (S.wars.reduce((s, w) => s + ((w.end < 0 ? years : w.end) - w.start), 0) / S.wars.length).toFixed(1));
