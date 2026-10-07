const W = require('./world.js'); require('./names.js'); const Hh = require('./history.js');
const world = W.generateWorld('alpha', 320, 200); const S = Hh.simulateHistory('alpha', world, 0);
S.advance(100); S.advance(100); S.advance(300);
console.log('resumed events', S.events.length, 'years', S.totalYears, 'kf', S.keyframes.length);
const world2 = W.generateWorld('alpha', 320, 200); const S2 = Hh.simulateHistory('alpha', world2, 500);
console.log('same as one-shot?', S.events.length === S2.events.length && S.events[S.events.length-1].text === S2.events[S2.events.length-1].text);
