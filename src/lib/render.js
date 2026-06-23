// Canvas renderer. Draws in world coordinates via a {scale,x,y} view transform.
//
// Architecture: per-frame work is just transform + polygon fills + strokes.
// The expensive per-cell passes (base colour, neighbour blend, hillshade relief)
// are computed once and memoised in a WeakMap keyed by the map object, keyed
// again by revision (terrain edits) and style id. Pan/zoom never recomputes them.

import { getStyle, styleColor } from './styles.js';
import { makePattern } from './texture.js';

const cache = new WeakMap();

function parseColor(s) {
  if (s[0] === '#') { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = s.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  return m ? [+m[1], +m[2], +m[3]] : [136, 136, 136];
}

// Relief shading: estimate each land cell's surface normal from neighbouring
// elevations, light it with a fixed sun direction -> brightness multiplier.
function computeHillshade(map) {
  const { N, neighbors, elevation, cx, cy, isLand } = map;
  const hs = new Float32Array(N);
  // sun from the north-west, fairly high
  let lx = -0.5, ly = -0.6, lz = 0.62;
  const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
  const EXAG = 520; // vertical exaggeration
  for (let i = 0; i < N; i++) {
    if (!isLand[i]) { hs[i] = 1; continue; }
    let gx = 0, gy = 0, w = 0;
    for (const nb of neighbors[i]) {
      const dx = cx[nb] - cx[i], dy = cy[nb] - cy[i];
      const d2 = dx * dx + dy * dy;
      if (d2 < 1e-3) continue;
      const dz = elevation[nb] - elevation[i];
      gx += (dz * dx) / d2; gy += (dz * dy) / d2; w++;
    }
    if (w) { gx /= w; gy /= w; }
    let nx = -gx * EXAG, ny = -gy * EXAG, nz = 1;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const light = nx * lx + ny * ly + nz * lz;
    hs[i] = 0.78 + 0.5 * Math.max(0, light); // ~0.78 (shadow) .. ~1.28 (lit)
  }
  return hs;
}

// Elevation contour ("iso") lines via marching triangles over the Delaunay mesh.
// For each land triangle and each level, find where the level crosses the
// triangle's edges (linear interp between cell centres) and emit a segment.
function computeContours(map) {
  const { delaunay, cx, cy, elevation, isLand } = map;
  const tris = delaunay.triangles;
  const levels = [];
  for (let L = 0.12; L < 0.96; L += 0.12) levels.push(L);
  const segs = []; // flat [ax,ay,bx,by, ...]
  const E = [[0, 1], [1, 2], [2, 0]];
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    if (!isLand[a] || !isLand[b] || !isLand[c]) continue;
    const vi = [a, b, c];
    const ev = [elevation[a], elevation[b], elevation[c]];
    const vx = [cx[a], cx[b], cx[c]], vy = [cy[a], cy[b], cy[c]];
    for (const L of levels) {
      const pts = [];
      for (const [p, q] of E) {
        const ea = ev[p] - L, eb = ev[q] - L;
        if ((ea < 0) !== (eb < 0)) {
          const f = ea / (ea - eb);
          pts.push(vx[p] + (vx[q] - vx[p]) * f, vy[p] + (vy[q] - vy[p]) * f);
        }
      }
      if (pts.length === 4) segs.push(pts[0], pts[1], pts[2], pts[3]);
    }
  }
  return new Float32Array(segs);
}

function ensureCache(map, style, revision, styleRev) {
  let c = cache.get(map);
  if (!c) { c = {}; cache.set(map, c); }
  if (c.rev !== revision) {
    c.hs = computeHillshade(map);
    c.contours = computeContours(map);
    c.rev = revision;
    c.styleKey = null; // terrain changed -> recolour
  }
  // recolour when style id, custom-theme edits (styleRev), or terrain change
  const styleKey = `${style.id}:${revision}:${styleRev || 0}`;
  if (c.styleKey !== styleKey) {
    c.styleKey = styleKey;
    const { N } = map;
    const base = new Array(N);
    for (let i = 0; i < N; i++) base[i] = parseColor(styleColor(style, map, i));
    // one neighbour-blend pass for the "gradient" (blended) shading mode
    const blend = new Array(N);
    for (let i = 0; i < N; i++) {
      let r = base[i][0] * 2, g = base[i][1] * 2, b = base[i][2] * 2, w = 2;
      for (const nb of map.neighbors[i]) { r += base[nb][0]; g += base[nb][1]; b += base[nb][2]; w++; }
      blend[i] = [r / w, g / w, b / w];
    }
    c.base = base; c.blend = blend;
  }
  return c;
}

export function draw(ctx, map, view, options = {}) {
  const { canvas } = ctx;
  const dpr = options.dpr || 1;
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;
  const style = getStyle(options.styleId);
  const cc = ensureCache(map, style, options.revision || 0, options.styleRev || 0);
  const cols = options.shading === 'gradient' ? cc.blend : cc.base;
  const hs = cc.hs;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, W, H);

  ctx.translate(view.x, view.y);
  ctx.scale(view.scale, view.scale);

  const { polygons, N, biome } = map;

  // resolve tile-texture patterns: per-biome (theme) overrides a global one
  const themeTex = style.textures || {};
  const globalTex = options.texture && options.texture !== 'none' ? options.texture : null;
  const pats = {};
  const patFor = (type) => {
    if (!type || type === 'none') return null;
    if (!(type in pats)) pats[type] = makePattern(ctx, type);
    return pats[type];
  };

  for (let i = 0; i < N; i++) {
    const poly = polygons[i];
    if (!poly) continue;
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k][0], poly[k][1]);
    ctx.closePath();
    const c = cols[i], s = hs[i];
    const r = c[0] * s, g = c[1] * s, b = c[2] * s;
    ctx.fillStyle = `rgb(${r < 255 ? r | 0 : 255},${g < 255 ? g | 0 : 255},${b < 255 ? b | 0 : 255})`;
    ctx.fill();
    const pat = patFor(themeTex[biome[i]] || globalTex);
    if (pat) { ctx.fillStyle = pat; ctx.fill(); }
    if (options.showCells) {
      ctx.lineWidth = 0.4 / view.scale;
      ctx.strokeStyle = 'rgba(0,0,0,0.14)';
      ctx.stroke();
    }
  }

  // coastline: soft foam halo under a crisp shore line
  if (options.showCoast !== false && map.coastSegments.length) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const sg of map.coastSegments) { ctx.moveTo(sg.ax, sg.ay); ctx.lineTo(sg.bx, sg.by); }
    ctx.strokeStyle = style.foam || 'rgba(255,255,255,0.35)';
    ctx.lineWidth = (style.coastWidth || 1.5) * 3.2 / view.scale;
    ctx.stroke();
    ctx.strokeStyle = style.coast;
    ctx.lineWidth = (style.coastWidth || 1.5) / view.scale;
    ctx.stroke();
  }

  // rivers
  if (options.showRivers !== false) {
    ctx.strokeStyle = style.river;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const rv of map.riverEdges) {
      ctx.beginPath();
      ctx.lineWidth = rv.w;
      ctx.moveTo(rv.ax, rv.ay);
      ctx.lineTo(rv.bx, rv.by);
      ctx.stroke();
    }
  }

  // Inkarnate-style stamped terrain symbols (forests / grass)
  if ((options.forests || options.grass) && !style.noSymbols) {
    drawDecorations(ctx, map, view, style, W, H, { forests: options.forests, grass: options.grass });
  }

  // elevation contour / iso lines (topography) — drawn on top so they read clearly
  if (options.contours && cc.contours.length) {
    const seg = cc.contours;
    ctx.strokeStyle = style.contour || 'rgba(40,30,15,0.45)';
    ctx.lineWidth = Math.max(0.5, 0.9 / view.scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < seg.length; k += 4) {
      ctx.moveTo(seg[k], seg[k + 1]);
      ctx.lineTo(seg[k + 2], seg[k + 3]);
    }
    ctx.stroke();
  }

  ctx.restore();

  if (style.paper) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#3a2912';
    for (let gy = 0; gy < H; gy += 3) if (((gy / 3) | 0) % 2 === 0) ctx.fillRect(0, gy, W, 1);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

const FOREST = new Set([
  'TEMPERATE_DECIDUOUS_FOREST', 'TEMPERATE_RAIN_FOREST',
  'TROPICAL_RAIN_FOREST', 'TROPICAL_SEASONAL_FOREST', 'TAIGA',
]);
const GRASS = new Set(['GRASSLAND', 'SHRUBLAND']);
const hash = (i) => { const x = Math.sin(i * 127.1 + 0.5) * 43758.5453; return x - Math.floor(x); };
const hash2 = (i) => { const x = Math.sin(i * 269.5 + 1.3) * 19349.135; return x - Math.floor(x); };

function drawTree(ctx, x, y, size, style, lw) {
  const g1 = style.paper ? '#5f6e3c' : '#356b35';
  const g2 = style.paper ? '#728044' : '#458545';
  ctx.fillStyle = style.paper ? '#5a4326' : '#4a3a28';
  ctx.fillRect(x - size * 0.07, y - size * 0.2, size * 0.14, size * 0.35);
  for (let t = 0; t < 2; t++) {
    const yo = y - size * (0.15 + t * 0.32);
    const w = size * (0.5 - t * 0.12);
    ctx.beginPath(); ctx.moveTo(x, yo - size * 0.55); ctx.lineTo(x + w, yo); ctx.lineTo(x - w, yo); ctx.closePath();
    ctx.fillStyle = t === 0 ? g1 : g2; ctx.fill();
  }
  ctx.lineWidth = lw; ctx.strokeStyle = style.paper ? '#3a4a22' : 'rgba(20,40,20,0.4)';
  ctx.stroke();
}

function drawGrass(ctx, x, y, s, style) {
  ctx.strokeStyle = style.paper ? 'rgba(122,126,68,0.85)' : 'rgba(60,100,45,0.75)';
  ctx.lineWidth = Math.max(0.4, s * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x - s * 0.35, y - s);
  ctx.moveTo(x, y); ctx.lineTo(x, y - s * 1.15);
  ctx.moveTo(x, y); ctx.lineTo(x + s * 0.35, y - s);
  ctx.stroke();
}

function drawDecorations(ctx, map, view, style, W, H, opts) {
  const { N, cx, cy, isLand, biome } = map;
  // visible world rect (+margin) so off-screen symbols are skipped
  const m = 40;
  const x0 = -view.x / view.scale - m, y0 = -view.y / view.scale - m;
  const x1 = (W - view.x) / view.scale + m, y1 = (H - view.y) / view.scale + m;
  const lw = Math.min(1.2, 0.8 / view.scale);

  for (let i = 0; i < N; i++) {
    if (!isLand[i]) continue;
    const x = cx[i], y = cy[i];
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const b = biome[i];
    // Trees on forested biomes (mountains are conveyed by relief hillshading).
    if (opts.forests && FOREST.has(b) && hash(i) < 0.6) {
      const n = 1 + (hash2(i) * 3 | 0);
      for (let k = 0; k < n; k++) {
        const ox = (hash(i * 7 + k) - 0.5) * 14;
        const oy = (hash2(i * 11 + k) - 0.5) * 10;
        drawTree(ctx, x + ox, y + oy, 7 + hash(i + k) * 4, style, lw);
      }
    } else if (opts.grass && GRASS.has(b) && hash2(i) < 0.45) {
      const n = 1 + (hash(i) * 2 | 0);
      for (let k = 0; k < n; k++) {
        const ox = (hash(i * 5 + k) - 0.5) * 13;
        const oy = (hash2(i * 9 + k) - 0.5) * 9;
        drawGrass(ctx, x + ox, y + oy, 5 + hash(i + k) * 3, style);
      }
    }
  }
}

export function screenToWorld(px, py, view) {
  return [(px - view.x) / view.scale, (py - view.y) / view.scale];
}
export function worldToScreen(wx, wy, view) {
  return [wx * view.scale + view.x, wy * view.scale + view.y];
}
