const { generateWorld, B, BIOMES } = require('./world.js');
const seed = process.argv[2] || 'alpha';
const t0 = Date.now();
const w = generateWorld(seed, 160, 100);
console.log('gen ms', Date.now() - t0, 'land%', (100 * w.landCount / w.N).toFixed(1));
const counts = {}; for (let i = 0; i < w.N; i++) { const k = BIOMES[w.biome[i]].key; counts[k] = (counts[k] || 0) + 1; }
console.log(counts);
let rc = 0; for (let i = 0; i < w.N; i++) if (w.river[i] > 0) rc++; console.log('river cells', rc);
const ch = { DEEP: ' ', OCEAN: '.', SHALLOW: ',', LAKE: '~', BEACH: ':', GRASS: '"', STEPPE: "'", FOREST: 'T', JUNGLE: 'J', SAVANNA: 'v', DESERT: '-', SWAMP: '%', TAIGA: 't', TUNDRA: '_', SNOW: '*', MOUNTAIN: 'A', PEAK: 'M' };
for (let y = 0; y < w.H; y += 2) { let s = ''; for (let x = 0; x < w.W; x++) { const i = y * w.W + x; s += w.river[i] > 0 && w.isLand[i] ? '|' : ch[BIOMES[w.biome[i]].key]; } console.log(s); }
console.log(w.features.map(f => `${f.kind}:${f.size}@${f.x},${f.y}`).join('  '));
