// Visual styles ("skins"). Each style themes the terrain palette/rendering AND
// the pin look (color treatment, label font, drop shadow).

import { BIOME_COLORS } from './biomes.js';

function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = pa >> 16, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = pb >> 16, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

// elevation-banded ramp helper
function ramp(stops, e) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [e0, c0] = stops[i];
    const [e1, c1] = stops[i + 1];
    if (e <= e1) return lerpColor(c0, c1, (e - e0) / Math.max(1e-6, e1 - e0));
  }
  return stops[stops.length - 1][1];
}

export const STYLES = [
  {
    id: 'fantasy',
    label: 'Fantasy',
    background: '#2f5680',
    coast: 'rgba(20,40,60,0.85)',
    coastWidth: 1.6,
    river: '#36699e',
    palette: BIOME_COLORS,
    pin: { font: '600 11px Segoe UI, sans-serif', shadow: true, monochrome: null, labelColor: '#fff' },
  },
  {
    id: 'oldmap',
    label: 'Old Map (parchment)',
    background: '#e7d4ad',
    coast: '#5c4326',
    coastWidth: 2.2,
    river: '#7c6a45',
    foam: 'rgba(231,212,173,0.7)',
    contour: 'rgba(92,67,38,0.4)',
    cell(map, i) {
      if (map.isOcean[i]) return lerpColor('#e7d4ad', '#cdb589', map.oceanDepth[i]);
      if (map.isLake[i]) return '#cdbd92';
      return ramp([
        [0, '#dac79c'], [0.35, '#cbb381'], [0.65, '#bb9c63'], [1, '#9c7c48'],
      ], map.elevation[i]);
    },
    pin: { font: '600 11px Georgia, serif', shadow: false, monochrome: '#4a3417', labelColor: '#3a2912' },
    paper: true,
  },
  {
    id: 'atlas',
    label: 'Atlas (political)',
    background: '#bcdcea',
    coast: 'rgba(40,70,90,0.7)',
    coastWidth: 1.4,
    river: '#6fa8d6',
    cell(map, i) {
      if (map.isOcean[i]) return lerpColor('#cfe6f2', '#9cc4dc', map.oceanDepth[i]);
      if (map.isLake[i]) return '#bfe0ee';
      return ramp([
        [0, '#dce6c8'], [0.25, '#cddda6'], [0.5, '#d9d3a0'], [0.72, '#d3bf95'], [1, '#efe9df'],
      ], map.elevation[i]);
    },
    pin: { font: '600 11px Segoe UI, sans-serif', shadow: true, monochrome: null, labelColor: '#1c2b38' },
  },
  {
    id: 'natural',
    label: 'Natural (satellite)',
    background: '#1d3f5e',
    coast: 'rgba(10,25,40,0.55)',
    coastWidth: 1.0,
    river: '#2e6f9e',
    palette: {
      ...BIOME_COLORS,
      OCEAN: '#27557a', OCEAN_DEEP: '#1d3f5e', LAKE: '#2f6f93',
      GRASSLAND: '#7d9a4a', TEMPERATE_DECIDUOUS_FOREST: '#4a7a3c',
      TROPICAL_RAIN_FOREST: '#2f6b39', BEACH: '#cdbd8e',
    },
    pin: { font: '600 11px Segoe UI, sans-serif', shadow: true, monochrome: null, labelColor: '#fff' },
  },
  {
    id: 'heightmap',
    label: 'Heightmap',
    background: '#05070a',
    coast: 'rgba(255,255,255,0.25)',
    coastWidth: 1.0,
    river: '#6fb7ff',
    contour: 'rgba(255,255,255,0.28)',
    cell(map, i) {
      if (map.isOcean[i]) return lerpColor('#0a1626', '#1d3350', 1 - map.oceanDepth[i]);
      // lakes shade by their real elevation (so highland lakes read as high),
      // with a faint blue tint so they still read as water.
      if (map.isLake[i]) {
        const lg = Math.round(60 + map.elevation[i] * 195);
        return `rgb(${Math.round(lg * 0.72)},${Math.round(lg * 0.82)},${Math.min(255, lg + 18)})`;
      }
      const g = Math.round(60 + map.elevation[i] * 195);
      return `rgb(${g},${g},${g})`;
    },
    pin: { font: '600 11px Segoe UI, sans-serif', shadow: true, monochrome: '#ff5252', labelColor: '#fff' },
  },
];

const BY_ID = Object.fromEntries(STYLES.map((s) => [s.id, s]));

// ---- custom (user) themes ----
// Palette-based themes (no procedural cell() so they serialize cleanly).
const CUSTOM = new Map();

export function registerTheme(theme) { CUSTOM.set(theme.id, theme); }
export function unregisterTheme(id) { CUSTOM.delete(id); }
export function isCustom(id) { return CUSTOM.has(id); }

export const getStyle = (id) => CUSTOM.get(id) || BY_ID[id] || STYLES[0];

// All biome keys a theme palette can define (used by the theme builder).
export const THEME_PALETTE_KEYS = Object.keys(BIOME_COLORS);

// Create a fresh editable theme, seeded from an existing style's palette
// (or the default biome colours) so the user starts from something sensible.
export function makeTheme(id, label, fromId) {
  const src = fromId ? getStyle(fromId) : null;
  const palette = { ...BIOME_COLORS, ...(src && src.palette ? src.palette : {}) };
  return {
    id, label,
    custom: true,
    background: (src && src.background) || '#2f5680',
    coast: (src && src.coast) || 'rgba(20,40,60,0.85)',
    coastWidth: (src && src.coastWidth) || 1.6,
    foam: (src && src.foam) || 'rgba(255,255,255,0.35)',
    river: (src && src.river) || '#36699e',
    contour: (src && src.contour) || 'rgba(40,30,15,0.45)',
    paper: !!(src && src.paper),
    palette,
    pin: { font: '600 11px Segoe UI, sans-serif', shadow: true, monochrome: null, labelColor: '#ffffff' },
    __rev: 0,
  };
}

// Fill color for a cell under a given style.
export function styleColor(style, map, i) {
  if (style.cell) return style.cell(map, i);
  return (style.palette && style.palette[map.biome[i]]) || '#888';
}
