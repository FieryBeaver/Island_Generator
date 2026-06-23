# ⚓ Island Forge

A browser-based fantasy island & city map generator built with **Svelte 5 + Vite**.
Inspired by [watabou's Medieval Fantasy City Generator](https://watabou.itch.io/medieval-fantasy-city-generator)
and [redblobgames mapgen2](https://www.redblobgames.com/maps/mapgen2/).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## What it does

**Procedural islands (Voronoi / mapgen2 pipeline)**
Poisson-disk sites → Lloyd-relaxed Voronoi cells → radial island-shape elevation
→ ocean/lake flood-fill → coastline → rivers (steepest descent + flow accumulation)
→ moisture diffusion → temperature/climate → Whittaker biomes. Everything is seeded,
so a given seed always reproduces the same island.

**Controls (left sidebar)**
- *Topology & shoreline*: island size, roundness (archipelago ↔ round), sea level,
  coastline roughness, **lakes**.
- *Climate*: temperature, latitude gradient, moisture (arid ↔ lush), river count.
- *Detail*: cell density.

**Map styles** — themes both terrain and pins: Fantasy, Old Map (parchment),
Atlas (political), Natural (satellite), Heightmap.

**Toolbar (top of map)**
- ✋ Pan / select
- 📍 Markers flyout — capital, city, town, village, castle, tower, port, temple,
  mine, ruins, forest, mountain, camp, generic marker (medieval SVG glyphs).
  Click to drop, drag to reposition, edit label/type in the sidebar.
- Terrain brushes — raise, lower, paint water, fill land, paint biome
  (brush size & strength in the sidebar; a preview ring shows the radius).
- Voronoi grid editing — move a cell site (✥) to reshape edges, add a site (＋),
  relax cells (↻), toggle the cell grid (▦). Edits re-derive coastline/rivers/biomes.

**Other**
- Auto-place settlements (scores coastal / riverside / flat sites).
- Save to browser, export/import JSON, export PNG (terrain + pins).

## Source layout

```
src/
  lib/
    rng.js        seeded PRNG
    poisson.js    Poisson-disk sampling
    mapgen.js     generate() + classify() + rebuildGeometry() engine
    biomes.js     Whittaker biome classification + palette
    styles.js     visual styles (terrain + pin theming)
    render.js     canvas renderer
    icons.js      inline medieval marker glyphs
    store.svelte.js  reactive state + actions
  components/
    Controls.svelte  sidebar
    Toolbar.svelte   floating tool toolbar
    MapView.svelte   canvas + pin overlay + interaction
```
