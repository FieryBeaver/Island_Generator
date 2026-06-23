// Shared reactive state (Svelte 5 runes) + actions for generation & pins.
import { DEFAULTS, generate, classify, rebuildGeometry, cellsInRadius, suggestSites, WORLD } from './mapgen.js';
import { registerTheme, unregisterTheme, makeTheme, isCustom } from './styles.js';

let nextId = 1;
const uid = () => nextId++;
let themeSeq = 1;

export const EDIT_TOOLS = ['raise', 'lower', 'water', 'land', 'paint'];
export const CELL_TOOLS = ['move-site', 'add-site'];
export const isEditTool = (t) => EDIT_TOOLS.includes(t);
export const isCellTool = (t) => CELL_TOOLS.includes(t);

export const store = $state({
  params: { ...DEFAULTS },
  map: null,
  revision: 0, // bump to force a canvas redraw after in-place edits
  pins: [],
  view: { scale: 1, x: 0, y: 0 },
  tool: 'pan',
  style: 'fantasy',
  themes: [], // custom user themes (persisted)
  themeRev: 0, // bump to force a recolour when a custom theme is edited
  brush: { size: 55, strength: 0.14, biome: 'GRASSLAND' },
  options: { showRivers: true, showCoast: true, showCells: false, shading: 'flat', forests: true, grass: false, contours: false, texture: 'none' },
  selectedPin: null,
  generating: false,
  api: null, // set by MapView: { fitView, exportPng }
});

export function regenerate() {
  store.generating = true;
  // yield a frame so the UI can show the busy state before the heavy sync work
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      store.map = generate({ ...store.params });
      store.generating = false;
      resolve(store.map);
    });
  });
}

// ---- terrain editing (brush) ----
function provisionalLand(map, c) {
  const b = map.biome[c];
  return b === 'OCEAN' || b === 'OCEAN_DEEP' || b === 'LAKE' ? 'GRASSLAND' : b;
}

function editCell(map, c, tool, s) {
  switch (tool) {
    case 'raise':
      map.elevation[c] = Math.min(1, Math.max(map.elevation[c], 0) + s);
      map.isWater[c] = 0; map.isOcean[c] = 0; map.isLake[c] = 0;
      map.biome[c] = map.paint[c] || provisionalLand(map, c);
      break;
    case 'lower':
      map.elevation[c] -= s;
      if (map.elevation[c] <= 0) { map.isWater[c] = 1; map.biome[c] = 'LAKE'; }
      else { map.biome[c] = map.paint[c] || provisionalLand(map, c); }
      break;
    case 'water':
      map.isWater[c] = 1; map.elevation[c] = Math.min(map.elevation[c], -0.1); map.biome[c] = 'LAKE';
      break;
    case 'land':
      map.isWater[c] = 0; map.isOcean[c] = 0; map.isLake[c] = 0;
      if (map.elevation[c] < 0.08) map.elevation[c] = 0.12;
      map.biome[c] = map.paint[c] || provisionalLand(map, c);
      break;
    case 'paint':
      map.paint[c] = store.brush.biome;
      map.isWater[c] = 0; map.isOcean[c] = 0; map.isLake[c] = 0;
      if (map.elevation[c] < 0.08) map.elevation[c] = 0.12;
      map.biome[c] = store.brush.biome;
      break;
  }
}

export function paintAt(wx, wy) {
  const map = store.map;
  if (!map || !isEditTool(store.tool)) return;
  const cells = cellsInRadius(map, wx, wy, store.brush.size);
  for (const c of cells) editCell(map, c, store.tool, store.brush.strength);
  store.revision++; // live preview
}

// Re-derive ocean/lake/coast/rivers/moisture/biomes from the edited heightmap.
export function finalizeEdit() {
  if (!store.map) return;
  classify(store.map, { computeElevation: false, addLakes: false });
  store.revision++;
}

// ---- Voronoi grid editing (sites) ----
export function moveSite(index, x, y) {
  const map = store.map;
  if (!map || index == null || index < 0) return;
  const pts = map.points.map((p) => p.slice());
  const m = 2;
  pts[index] = [Math.max(m, Math.min(WORLD - m, x)), Math.max(m, Math.min(WORLD - m, y))];
  store.map = rebuildGeometry(map, pts);
}

export function addSite(x, y) {
  const map = store.map;
  if (!map) return;
  const pts = map.points.map((p) => p.slice());
  pts.push([x, y]);
  store.map = rebuildGeometry(map, pts);
}

export function relaxCells() {
  const map = store.map;
  if (!map) return;
  // move each site toward its cell centroid (Lloyd) to even out edges
  const pts = map.points.map((p, i) => {
    const poly = map.polygons[i];
    if (!poly || poly.length < 3) return p.slice();
    let cx = 0, cy = 0;
    for (const [px, py] of poly) { cx += px; cy += py; }
    return [cx / poly.length, cy / poly.length];
  });
  store.map = rebuildGeometry(map, pts);
}

// ---- custom themes ----
export function createTheme(fromId = store.style) {
  const id = 'theme-' + (themeSeq++);
  const theme = makeTheme(id, 'Custom ' + (store.themes.length + 1), fromId);
  registerTheme(theme);
  store.themes.push(theme);
  store.style = id;
  store.themeRev++;
  return theme;
}

export function deleteTheme(id) {
  unregisterTheme(id);
  store.themes = store.themes.filter((t) => t.id !== id);
  if (store.style === id) store.style = 'fantasy';
  store.themeRev++;
}

// called by the builder whenever a theme value changes -> recolour
export function themeChanged() { store.themeRev++; }

export function exportTheme(id = store.style) {
  const theme = store.themes.find((t) => t.id === id);
  if (!theme) return;
  const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `theme-${theme.label.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importTheme(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !data.palette) throw new Error('not a theme');
        data.id = 'theme-' + (themeSeq++);
        data.custom = true;
        if (!data.label) data.label = 'Imported theme';
        if (!data.pin) data.pin = { font: '600 11px Segoe UI, sans-serif', shadow: true, monochrome: null, labelColor: '#ffffff' };
        registerTheme(data);
        store.themes.push(data);
        store.style = data.id;
        store.themeRev++;
        resolve(data);
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function randomizeSeed() {
  const words = ['aurelia', 'thalassa', 'verdwyn', 'kaldspire', 'morgath', 'sunderly',
    'eldermere', 'brackmoor', 'isengard', 'caldera', 'vornholt', 'driftwen'];
  const w = words[Math.floor(store.params.seed.length * 7 % words.length)];
  store.params.seed = w + '-' + Math.floor(performance.now() % 100000);
}

export function addPin(type, x, y) {
  const pin = { id: uid(), type, x, y, label: '' };
  store.pins.push(pin);
  store.selectedPin = pin.id;
  return pin;
}

export function removePin(id) {
  store.pins = store.pins.filter((p) => p.id !== id);
  if (store.selectedPin === id) store.selectedPin = null;
}

export function clearPins() {
  store.pins = [];
  store.selectedPin = null;
}

export function autoSettlements() {
  if (!store.map) return;
  const sites = suggestSites(store.map, 7);
  const types = ['capital', 'city', 'city', 'town', 'town', 'port', 'village'];
  sites.forEach((s, i) => addPin(types[i] || 'town', s.x, s.y));
}

const LS_KEY = 'island-generator-save';

export function saveLocal() {
  const data = { params: store.params, pins: store.pins, style: store.style, themes: store.themes };
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.params) Object.assign(store.params, data.params);
    if (Array.isArray(data.themes)) {
      store.themes = data.themes;
      let max = 0;
      for (const t of data.themes) { registerTheme(t); const n = +(t.id || '').replace('theme-', ''); if (n > max) max = n; }
      themeSeq = max + 1;
    }
    if (data.style) store.style = data.style;
    if (Array.isArray(data.pins)) {
      store.pins = data.pins;
      nextId = Math.max(0, ...data.pins.map((p) => p.id)) + 1;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function exportJson() {
  const data = JSON.stringify({ params: store.params, pins: store.pins }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `island-${store.params.seed}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.params) Object.assign(store.params, data.params);
        if (data.style) store.style = data.style;
        if (Array.isArray(data.pins)) {
          store.pins = data.pins;
          nextId = Math.max(0, ...data.pins.map((p) => p.id || 0)) + 1;
        }
        resolve(true);
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export { WORLD };
