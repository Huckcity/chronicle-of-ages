const W = require('./world.js'); require('./names.js'); const Hh = require('./history.js');
const seed = process.argv[2] || 'alpha'; const from = +(process.argv[3] || 200), to = +(process.argv[4] || 230);
const world = W.generateWorld(seed, 320, 200);
const S = Hh.simulateHistory(seed, world, 500);
for (const e of S.events) if (e.year >= from && e.year <= to) console.log(String(e.year).padStart(4), e.kind.padEnd(8), Hh.resolveText(S, e.text, null, e.year));
