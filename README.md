# Chronicle of Ages

A procedurally generated fantasy world that simulates five centuries of history, then lets you
scrub through it on a map while reading the chronicle that history wrote.

Everything runs in the browser from a single HTML file. No build tools, no dependencies beyond
Google Fonts.

## What it does

- **World**: 320×200 cells of domain-warped terrain, depression-filled hydrology with
  flow-accumulation rivers and lakes, climate-driven biomes, and named geography (seas, ranges,
  forests, marshes, isles, rivers, battlefields).
- **Peoples**: six to thirteen realms drawn from ten invented languages, each with its own
  phonology, realm titles, demonyms and terrain preferences (dwarves take to mountains, elves to
  forests, the Dune folk to deserts).
- **History**: expansion and towns, population against carrying capacity, rulers with traits and
  lifespans, heirs and regencies, usurpers, succession wars and rebellions, diplomacy and
  alliances, named wars with battles and sieges, sacked towns and fallen realms, plagues that
  spread along borders, famines, heroes, wonders, artifacts that get looted and lost, golden
  ages, and omens.
- **Chronicle**: every event is written as prose with linked names. Rulers earn epithets at death,
  revealed only once the chronicle reaches that year.
- **Map**: any year is reconstructed exactly from keyframes and per-year deltas, so the timeline
  scrubs freely. Click a realm or town for its dynasties, wars, towns, treasures and a population
  chart.

Worlds are seeded: the same seed always produces the same world and the same history.

## Run it

Open `index.html` in a browser. To work on the source, rebuild after editing:

```sh
python3 build.py        # writes index.html (standalone) and artifact.html (body only)
```

The engine also runs headless in Node for tuning and tests:

```sh
node test_world.js alpha            # ASCII map and biome counts
node test_names.js                  # sample names from every language
node test_history.js alpha 500      # 500 years: counts and a reconstruction check
node test_slice.js alpha 240 262    # print the chronicle for a span of years
node test_stats.js alpha            # war reasons, land coverage over time
node test_resume.js                 # resumable simulation matches one-shot
```

## Layout

| File | Purpose |
| --- | --- |
| `world.js` | seeded RNG, simplex noise, terrain, hydrology, biomes, feature detection |
| `names.js` | language templates, name generation, feature naming, ruler traits |
| `history.js` | the simulation, event text, keyframe/delta store, text resolution |
| `app.js` | map renderer, timeline, panels, interaction |
| `template.html` | markup and styles; `build.py` inlines the scripts into it |

## Controls

Drag to pan, scroll to zoom, click a realm or town. Space plays and pauses, arrow keys step a
year (Shift for ten). Type a seed and press Forge, or pick a random world; the seed lands in the
link hash. At the end of the chronicle, the scribes can be asked to continue for another century.
