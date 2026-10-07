'use strict';
// ===================== Chronicle: languages and names =====================

const LANGS = [
  { id: 'northern', kind: 'human', label: 'Northern', lifespan: 68,
    onset: 'b d f g h k l m n r s t v th sk st br dr fr gr hr kr sv sn'.split(' '), vowel: 'a e i o u y ei au o a e i'.split(' '), coda: ' l r n s k t ld nd rn st rk ng rd'.split(' '),
    placeEnd: 'heim gard vik berg dal fjord havn by stad mark ness holm'.split(' '), m: 'ulf ar ik mund vald leif rik olf'.split(' '), f: 'hild run dis gerd a ny veig frid'.split(' '),
    realm: [['the Kingdom of {R}', 'King', 'Queen'], ['the {R} Jarldoms', 'High Jarl', 'High Jarl'], ['{R}', 'King', 'Queen']], demonym: [['the {R}ish', '{R}ish'], ['the {R}men', '{R}ish']], syl: [1, 2] },
  { id: 'classical', kind: 'human', label: 'Classical', lifespan: 66,
    onset: 'b c d f g l m n p r s t v cl pr tr qu fl gr s t m'.split(' '), vowel: 'a e i o u ae au a e i o'.split(' '), coda: '  s n r l m x nt'.split(' '),
    placeEnd: 'ia ium ona ica entum anum is ara ossa'.split(' '), m: 'us ius o an ix ar'.split(' '), f: 'a ia illa ina ora'.split(' '),
    realm: [['the Republic of {R}', 'Consul', 'Consul'], ['the {R} Empire', 'Emperor', 'Empress'], ['the Kingdom of {R}', 'King', 'Queen']], demonym: [['the {R}ans', '{R}an'], ['the {R}ii', '{R}ian']], syl: [2, 3] },
  { id: 'sylvan', kind: 'elf', label: 'Sylvan', lifespan: 420,
    onset: 'l n r s th v f m y c g el ael '.split(' '), vowel: 'a e i o ia ae ie ea ai e'.split(' '), coda: '  l n r th s nd ll'.split(' '),
    placeEnd: 'dor lin ion ias wen lith mar thil ael loth'.split(' '), m: 'ion dir las thir ael oril'.split(' '), f: 'iel wen ia eth nia lis'.split(' '),
    realm: [['the Realm of {R}', 'Lord', 'Lady'], ['the {R} Court', 'High King', 'High Queen'], ['{R}', 'Lord', 'Lady']], demonym: [['the {R}i', '{R}i'], ['the elves of {R}', '{R}']], syl: [2, 3] },
  { id: 'stonefolk', kind: 'dwarf', label: 'Stonefolk', lifespan: 210,
    onset: 'b d g k th kh gr dr br thr kr z v m n r'.split(' '), vowel: 'a o u i e a o u'.split(' '), coda: 'k r n m d g rn rk nd ld zd '.split(' '),
    placeEnd: 'dum heim barak gund rak hold dur garn zad'.split(' '), m: 'in ur ak rim ok ar dun'.split(' '), f: 'a is ild ra dis'.split(' '),
    realm: [['the {R} Hold', 'Thane', 'Thane'], ['the Kingdom of {R}', 'King Under the Mountain', 'Queen Under the Mountain'], ['the Deep Halls of {R}', 'Thane', 'Thane']], demonym: [['the dwarves of {R}', '{R}'], ['the {R}folk', '{R}']], syl: [1, 2] },
  { id: 'dune', kind: 'human', label: 'Dune', lifespan: 64,
    onset: 's sh kh z r m n h q j d t b f l y w'.split(' '), vowel: 'a i u aa ai ou a i'.split(' '), coda: '  r n l m d sh q f'.split(' '),
    placeEnd: 'abad ar iyah an ir ah oum uk'.split(' '), m: 'im ir ad an ul ar'.split(' '), f: 'a ah iya ima ara'.split(' '),
    realm: [['the Sultanate of {R}', 'Sultan', 'Sultana'], ['the Emirate of {R}', 'Emir', 'Emira'], ['the {R} Caliphate', 'Caliph', 'Caliph']], demonym: [['the {R}i', '{R}i'], ['the {R}is', '{R}i']], syl: [2, 3] },
  { id: 'eastern', kind: 'human', label: 'Eastern', lifespan: 66,
    onset: 'k s t n h m y r w sh ch ts z j g d b p'.split(' '), vowel: 'a i u e o a o'.split(' '), coda: '     n'.split(' '),
    placeEnd: 'kyo shima gawa yama to sen kai shan'.split(' '), m: 'ro shi ta ki hiro mon'.split(' '), f: 'ko mi ka na yo'.split(' '),
    realm: [['the Empire of {R}', 'Emperor', 'Empress'], ['the {R} Shogunate', 'Shogun', 'Shogun'], ['the Kingdom of {R}', 'King', 'Queen']], demonym: [['the {R}ese', '{R}ese'], ['the people of {R}', '{R}']], syl: [2, 3] },
  { id: 'celtic', kind: 'human', label: 'Celtic', lifespan: 64,
    onset: 'b c d f g l m n r s t bl br gw ll rh dw ff'.split(' '), vowel: 'a e i o u ae ai ei wy a e'.split(' '), coda: '  n l r ch dd th ll s nt'.split(' '),
    placeEnd: 'wyn mor dun caer llan bryn aber nant'.split(' '), m: 'wyn an ric gan eth'.split(' '), f: 'wen eth a wyn ia'.split(' '),
    realm: [['the Kingdom of {R}', 'King', 'Queen'], ['the {R} Clans', 'Chieftain', 'Chieftain'], ['{R}', 'High King', 'High Queen']], demonym: [['the {R}ish', '{R}ish'], ['the {R}ic', '{R}ic']], syl: [1, 2] },
  { id: 'orcish', kind: 'orc', label: 'Orcish', lifespan: 44,
    onset: 'g gr k kr z d dr b br m n r sk th ug ur'.split(' '), vowel: 'a o u i a o u'.split(' '), coda: 'k g z r sh ash uk rg gh d'.split(' '),
    placeEnd: 'gor rak mog uz gash dur thrak'.split(' '), m: 'ash uk g ok ar uz gor'.split(' '), f: 'a ash uk ra ish'.split(' '),
    realm: [['the {R} Horde', 'Warlord', 'Warlord'], ['{R}', 'Warchief', 'Warchief'], ['the {R} Clans', 'Chieftain', 'Chieftain']], demonym: [['the {R} orcs', '{R}'], ['the {R}-kin', '{R}']], syl: [1, 2] },
  { id: 'riverfolk', kind: 'human', label: 'Riverfolk', lifespan: 65,
    onset: 'b d g k l m n p r s t v z dr br vl st zl sv ml mr'.split(' '), vowel: 'a e i o u ya ye a o'.split(' '), coda: '  v n r l k sk st ch'.split(' '),
    placeEnd: 'grad ov sk ich nitsa gorod ava ets'.split(' '), m: 'mir slav ek ov an ko'.split(' '), f: 'a ana ina mila slava ka'.split(' '),
    realm: [['the Principality of {R}', 'Prince', 'Princess'], ['the Tsardom of {R}', 'Tsar', 'Tsarina'], ['the Kingdom of {R}', 'King', 'Queen']], demonym: [['the {R}ians', '{R}ian'], ['the {R}ovs', '{R}ov']], syl: [2, 3] },
  { id: 'islander', kind: 'human', label: 'Islander', lifespan: 66,
    onset: 'k t m n p r h l w v ng  '.split(' '), vowel: 'a e i o u ai au oa a'.split(' '), coda: '      '.split(' '),
    placeEnd: 'nui moana tua kea ola rapa'.split(' '), m: 'nui ko tane ma wha'.split(' '), f: 'na lani a hine ani'.split(' '),
    realm: [['the Kingdom of {R}', 'King', 'Queen'], ['the {R} Atolls', 'Ariki', 'Ariki'], ['{R}', 'High Chief', 'High Chief']], demonym: [['the {R}ans', '{R}an'], ['the people of {R}', '{R}']], syl: [2, 3] },
];

const KINDS = {
  human: { label: 'humans', pref: {}, aggression: 0.5 },
  elf: { label: 'elves', pref: { FOREST: 2.2, JUNGLE: 1.6, TAIGA: 1.4, MOUNTAIN: 0.6 }, aggression: 0.3 },
  dwarf: { label: 'dwarves', pref: { MOUNTAIN: 4.5, PEAK: 2.0, TAIGA: 1.3, FOREST: 0.8, GRASS: 0.7 }, aggression: 0.45 },
  orc: { label: 'orcs', pref: { STEPPE: 1.8, TUNDRA: 2.5, SAVANNA: 1.4, DESERT: 1.5, MOUNTAIN: 1.5, FOREST: 0.6 }, aggression: 0.8 },
};
// language-specific terrain preferences on top of kind
const LANG_PREF = { dune: { DESERT: 6, SAVANNA: 1.8, STEPPE: 1.3 }, islander: { BEACH: 2.5 }, northern: { TAIGA: 1.8, TUNDRA: 1.6, SNOW: 1.3 }, eastern: { JUNGLE: 1.4 }, riverfolk: { SWAMP: 2.0, TAIGA: 1.4 } };

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const ROMANS = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

class Namer {
  constructor(rng) { this.rng = rng; this.used = new Set(); }
  syllable(L, first) {
    const r = this.rng;
    let on = r.pick(L.onset); if (first && r.chance(0.18)) on = '';
    const v = r.pick(L.vowel); const co = r.pick(L.coda);
    return on + v + co;
  }
  raw(L, min, max) {
    const n = this.rng.irange(min, max); let s = '';
    const isV = ch => 'aeiouy'.includes(ch);
    for (let i = 0; i < n; i++) {
      let sy = this.syllable(L, i === 0);
      if (i > 0 && s.length) {
        const last = s.charAt(s.length - 1);
        if (!isV(last) && sy.length > 1 && !isV(sy.charAt(0)) && !isV(sy.charAt(1))) s = s.slice(0, -1); // avoid 3-consonant pileups
        if (s.endsWith(sy.charAt(0))) sy = sy.slice(1);
      }
      s += sy;
    }
    s = s.replace(/(.)\1\1+/g, '$1$1');
    s = s.replace(/([^aeiouy])([^aeiouy])([^aeiouy])/g, (m, a, b, c) => (a + b === 'th' || a + b === 'sh' || a + b === 'ch' || a + b === 'kh' || a + b === 'ng' || a + b === 'll' || a + b === 'dd' || a + b === 'ff') ? a + b + c : a + c);
    s = s.replace(/([aeiou])([aeiou])([aeiou])/g, '$1$2');
    return s;
  }
  unique(fn, maxLen = 11) {
    for (let k = 0; k < 40; k++) { const n = fn(); const key = n.toLowerCase(); if (!this.used.has(key) && n.length >= 3 && n.length <= maxLen) { this.used.add(key); return n; } }
    for (let k = 0; k < 40; k++) { const n = fn(); const key = n.toLowerCase(); if (!this.used.has(key)) { this.used.add(key); return n; } }
    const n = fn() + ' ' + ROMANS[this.rng.irange(1, 6)]; this.used.add(n.toLowerCase()); return n;
  }
  root(L) { return this.unique(() => cap(this.raw(L, L.syl[0], L.syl[1])), 10); }
  place(L) {
    return this.unique(() => { const r = this.raw(L, 1, 2); const e = this.rng.chance(r.length > 5 ? 0.4 : 0.7) ? this.rng.pick(L.placeEnd) : ''; let s = r + e; if (r.slice(-1) === e.charAt(0)) s = r + e.slice(1); return cap(s); }, 11);
  }
  person(L, female) {
    const ends = female ? L.f : L.m;
    for (let k = 0; k < 20; k++) {
      const r = this.raw(L, 1, this.rng.chance(0.6) ? 1 : 2); const e = this.rng.pick(ends); let s = r + e;
      if (r.slice(-1) === e.charAt(0)) s = r + e.slice(1);
      s = cap(s).replace(/(.)\1\1+/g, '$1$1');
      if (s.length >= 3 && s.length <= 10) return s;
    }
    return cap(this.raw(L, 1, 2));
  }
}

// --- Geographic feature naming (English descriptive patterns + old-tongue roots) ---
const ADJ = 'Grey White Black Red Ashen Silent Howling Broken Iron Golden Hollow Thorn Misty Shadow Old Pale Amber Weeping Sunken Crooked Bitter Green Blue Wild Lonely Wandering Burning Sleeping Cold Far High Long Bright Dim Still Hidden Last Shivering Drowned Singing Whispering Crimson Silver Copper Dun Fallow'.split(' ');
const FEATURE_PATTERNS = {
  mountains: ['the {A} Peaks', 'the {A} Mountains', 'the {A} Spires', 'the {A} Teeth', 'the {A} Crags', 'the {N} Mountains', 'the {N} Range', 'the {A} Heights', 'the Mountains of {N}', 'the {A} Reach', 'the {N} Fells'],
  forest: ['the {A}wood', 'the {N} Forest', 'the {A} Wood', 'the Forest of {N}', 'the {A} Thicket', 'the {N} Weald', 'the {A} Pines', 'the {A} Oaks'],
  jungle: ['the {A} Jungle', 'the {N} Jungle', 'the Tangle of {N}', 'the {A} Canopy', 'the {N} Wilds'],
  desert: ['the {A} Waste', 'the {N} Desert', 'the Sea of {M}', 'the {A} Expanse', 'the {N} Sands', 'the {A} Dunes', 'the Salt of {N}'],
  swamp: ['the {A} Fens', 'the {N} Marsh', 'the {A} Mire', 'the {N} Fen', 'the {A} Bog', 'the Marshes of {N}'],
  frost: ['the {A} Wastes', 'the {N} Barrens', 'the Frozen {P}', 'the {A} Tundra', 'the {N} Ice', 'the Wastes of {N}'],
  plains: ['the {A} Plains', 'the {N} Steppe', 'the Fields of {N}', 'the {A} Reach', 'the {N} Plain', 'the {A} Downs', 'the Vale of {N}', 'the {N} Flats', 'the {A} Meadows'],
  lake: ['Lake {N}', 'the {A} Mere', '{N} Water', 'the Mirror of {N}', 'Lake {A}water', 'the {A} Tarn'],
  sea: ['the Sea of {N}', 'the {A} Sea', 'the Bay of {N}', 'the Gulf of {N}', '{N} Sound', 'the {A} Strait', 'the {A} Deep'],
  ocean: ['the Great Sea', 'the Sundering Sea', 'the Endless Ocean', 'the {A} Ocean', 'the Outer Sea', 'the Sea of {N}', 'the Boundless Deep'],
  river: ['the {N}', 'the River {N}', 'the {A}water', 'the {A} Run', 'the {N} River', 'the {A}flow'],
  island: ['the Isle of {N}', '{N} Isle', 'the {A} Isle', '{N}', 'the Isle of {A} Stones'],
  continent: ['{N}', 'the {N} Lands', 'Greater {N}', 'the {A} Continent', 'the Lands of {N}'],
};
const SAND_WORDS = 'Sand Dust Glass Bones Salt Thirst Ash'.split(' ');
const FROZEN_WORDS = 'Reach Marches March Shore Waste'.split(' ');

function nameFeature(namer, geoLang, kind) {
  const pats = FEATURE_PATTERNS[kind] || FEATURE_PATTERNS.plains;
  return namer.unique(() => {
    const p = namer.rng.pick(pats);
    return p.replace('{A}', namer.rng.pick(ADJ)).replace('{N}', cap(namer.raw(geoLang, 1, 2))).replace('{M}', namer.rng.pick(SAND_WORDS)).replace('{P}', namer.rng.pick(FROZEN_WORDS));
  }, 40);
}

const TRAITS = [
  { id: 'ambitious', aggr: 0.25, stab: 0, desc: 'ambitious' },
  { id: 'cruel', aggr: 0.2, stab: -0.15, desc: 'cruel' },
  { id: 'just', aggr: -0.1, stab: 0.15, desc: 'just' },
  { id: 'pious', aggr: -0.05, stab: 0.08, desc: 'pious' },
  { id: 'craven', aggr: -0.3, stab: -0.05, desc: 'craven' },
  { id: 'brave', aggr: 0.15, stab: 0.05, desc: 'brave' },
  { id: 'scholarly', aggr: -0.15, stab: 0.05, desc: 'scholarly' },
  { id: 'mad', aggr: 0.2, stab: -0.25, desc: 'mad' },
  { id: 'greedy', aggr: 0.15, stab: -0.1, desc: 'greedy' },
  { id: 'generous', aggr: -0.1, stab: 0.12, desc: 'generous' },
  { id: 'cunning', aggr: 0.1, stab: 0.05, desc: 'cunning' },
  { id: 'brash', aggr: 0.3, stab: -0.1, desc: 'brash' },
  { id: 'patient', aggr: -0.15, stab: 0.1, desc: 'patient' },
  { id: 'vain', aggr: 0.05, stab: -0.05, desc: 'vain' },
  { id: 'wise', aggr: -0.1, stab: 0.15, desc: 'wise' },
  { id: 'paranoid', aggr: 0.05, stab: -0.12, desc: 'paranoid' },
];

if (typeof module !== 'undefined') module.exports = { LANGS, KINDS, LANG_PREF, Namer, nameFeature, TRAITS, ADJ, cap };
