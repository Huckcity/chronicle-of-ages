const { RNG } = require('./world.js');
const { LANGS, Namer, nameFeature } = require('./names.js');
const rng = new RNG(process.argv[2] || 'names');
const nm = new Namer(rng);
for (const L of LANGS) {
  const roots = []; for (let i = 0; i < 4; i++) roots.push(nm.root(L));
  const places = []; for (let i = 0; i < 4; i++) places.push(nm.place(L));
  const men = []; for (let i = 0; i < 4; i++) men.push(nm.person(L, false));
  const women = []; for (let i = 0; i < 4; i++) women.push(nm.person(L, true));
  console.log(L.label.padEnd(10), 'R:', roots.join(', '), '| P:', places.join(', '), '| M:', men.join(', '), '| F:', women.join(', '));
}
const geo = LANGS[6];
for (const k of ['mountains', 'forest', 'desert', 'swamp', 'plains', 'lake', 'sea', 'river', 'island', 'ocean']) { const a = []; for (let i = 0; i < 4; i++) a.push(nameFeature(nm, geo, k)); console.log(k.padEnd(10), a.join(' | ')); }
