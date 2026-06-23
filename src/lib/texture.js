// Procedural tile textures. Each texture is a transparent tile of light/dark
// marks that is overlaid on top of a cell's (already hillshaded) colour, so it
// adds surface detail without throwing away the shading or the palette.
//
// Tiles are drawn at high resolution (TILE_RES) but mapped to a small number of
// WORLD units via a pattern transform, so they scale with the map yet stay
// crisp at any zoom and in the high-res PNG export.

const TILE_RES = 96;

export const TEXTURES = [
  { id: 'none', label: 'None' },
  { id: 'grain', label: 'Grain', world: 16 },
  { id: 'dots', label: 'Stipple', world: 22 },
  { id: 'hatch', label: 'Hatch', world: 20 },
  { id: 'cross', label: 'Cross-hatch', world: 20 },
  { id: 'waves', label: 'Waves', world: 40 },
  { id: 'scales', label: 'Scales', world: 30 },
  { id: 'bricks', label: 'Bricks', world: 44 },
];

const WORLD = Object.fromEntries(TEXTURES.map((t) => [t.id, t.world || 24]));
const tiles = new Map(); // type -> offscreen canvas

const DARK = 'rgba(0,0,0,0.16)';
const LIGHT = 'rgba(255,255,255,0.13)';

function drawTile(x, type, S) {
  x.clearRect(0, 0, S, S);
  x.lineCap = 'round';
  if (type === 'grain') {
    const n = Math.floor(S * S * 0.16);
    for (let i = 0; i < n; i++) {
      x.fillStyle = Math.random() < 0.5 ? DARK : LIGHT;
      x.fillRect(Math.random() * S, Math.random() * S, 1.8, 1.8);
    }
  } else if (type === 'dots') {
    const step = S / 4;
    x.fillStyle = DARK;
    for (let gy = 0; gy < 4; gy++)
      for (let gx = 0; gx < 4; gx++) {
        const ox = (gy % 2) * step / 2;
        x.beginPath();
        x.arc(gx * step + step / 2 + ox, gy * step + step / 2, S * 0.045, 0, Math.PI * 2);
        x.fill();
      }
  } else if (type === 'hatch' || type === 'cross') {
    x.strokeStyle = DARK; x.lineWidth = S * 0.035;
    const d = S / 4;
    for (let k = -4; k <= 8; k++) {
      x.beginPath(); x.moveTo(k * d, 0); x.lineTo(k * d + S, S); x.stroke();
    }
    if (type === 'cross') {
      x.strokeStyle = LIGHT;
      for (let k = -4; k <= 8; k++) {
        x.beginPath(); x.moveTo(k * d, S); x.lineTo(k * d + S, 0); x.stroke();
      }
    }
  } else if (type === 'waves') {
    x.strokeStyle = LIGHT; x.lineWidth = S * 0.03;
    const rows = 4, period = S / 2, amp = S * 0.05;
    for (let r = 0; r <= rows; r++) {
      const y = (r / rows) * S;
      x.beginPath();
      for (let px = 0; px <= S; px += 2) {
        const py = y + Math.sin((px / period) * Math.PI * 2) * amp;
        px === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.stroke();
    }
  } else if (type === 'scales') {
    x.strokeStyle = DARK; x.lineWidth = S * 0.03;
    const rows = 3, cols = 3, rw = S / cols, rh = S / rows;
    for (let r = 0; r < rows; r++)
      for (let c = -1; c <= cols; c++) {
        const cxp = c * rw + (r % 2) * rw / 2;
        x.beginPath();
        x.arc(cxp + rw / 2, r * rh, rw / 2, 0, Math.PI);
        x.stroke();
      }
  } else if (type === 'bricks') {
    x.strokeStyle = DARK; x.lineWidth = S * 0.025;
    const rows = 4, rh = S / rows;
    for (let r = 0; r <= rows; r++) {
      x.beginPath(); x.moveTo(0, r * rh); x.lineTo(S, r * rh); x.stroke();
    }
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (S / 4);
      for (let c = 0; c <= 2; c++) {
        const px = c * (S / 2) + off;
        x.beginPath(); x.moveTo(px, r * rh); x.lineTo(px, (r + 1) * rh); x.stroke();
      }
    }
  }
}

function tileCanvas(type) {
  if (tiles.has(type)) return tiles.get(type);
  const c = document.createElement('canvas');
  c.width = c.height = TILE_RES;
  drawTile(c.getContext('2d'), type, TILE_RES);
  tiles.set(type, c);
  return c;
}

// A repeating CanvasPattern for `type`, sized to WORLD[type] world units.
export function makePattern(ctx, type) {
  if (!type || type === 'none') return null;
  const pat = ctx.createPattern(tileCanvas(type), 'repeat');
  if (pat && pat.setTransform) {
    const k = (WORLD[type] || 24) / TILE_RES;
    pat.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
  }
  return pat;
}
