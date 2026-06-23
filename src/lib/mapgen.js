// Island map generator inspired by redblobgames mapgen2.
// generate() builds geometry + initial terrain, then classify() derives every
// downstream layer (ocean/lake/coast/elevation/rivers/moisture/biome). classify()
// is reusable so the editor can re-derive after manual height/water edits.

import { Delaunay } from 'd3-delaunay';
import { createNoise2D } from 'simplex-noise';
import { makeRng } from './rng.js';
import { poissonDiskSampling } from './poisson.js';
import { biomeFor } from './biomes.js';

export const WORLD = 1000; // logical world is WORLD x WORLD units

export const DEFAULTS = {
  seed: 'aurelia',
  detail: 3,
  // topology / shoreline
  seaLevel: 0.2,
  islandSize: 0.55,
  roundness: 0.45,
  noiseFreq: 2.4,
  octaves: 5,
  lakes: 0.35, // inland lake coverage
  // climate
  temperature: 0.58,
  latitudeRange: 0.5,
  moisture: 1.0,
  rivers: 18,
};

// Lower detail = bigger, fewer cells (read as districts / blocks).
const DETAIL_RADIUS = { 1: 38, 2: 26, 3: 16, 4: 11, 5: 7 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function polygonCentroid(poly) {
  let x = 0, y = 0, a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    x += (x0 + x1) * cross;
    y += (y0 + y1) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    let sx = 0, sy = 0;
    for (const p of poly) { sx += p[0]; sy += p[1]; }
    return [sx / poly.length, sy / poly.length];
  }
  a *= 0.5;
  return [x / (6 * a), y / (6 * a)];
}

// Build Voronoi geometry for a set of site points. Reused by generate() and
// by the editor when sites are moved/added (which reshapes the cell edges).
export function buildGeometry(points, size) {
  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([0, 0, size, size]);
  const N = points.length;
  const cx = new Float64Array(N);
  const cy = new Float64Array(N);
  for (let i = 0; i < N; i++) { cx[i] = points[i][0]; cy[i] = points[i][1]; }
  const neighbors = new Array(N);
  for (let i = 0; i < N; i++) neighbors[i] = [...delaunay.neighbors(i)];
  const onBorder = new Uint8Array(N);
  const polygons = new Array(N);
  for (let i = 0; i < N; i++) {
    const poly = voronoi.cellPolygon(i);
    polygons[i] = poly;
    if (!poly) { onBorder[i] = 1; continue; }
    for (const [px, py] of poly) {
      if (px <= 0.5 || py <= 0.5 || px >= size - 0.5 || py >= size - 0.5) { onBorder[i] = 1; break; }
    }
  }
  return { delaunay, voronoi, N, cx, cy, neighbors, onBorder, polygons, points };
}

function emptyLayers(N) {
  return {
    elevation: new Float64Array(N),
    oceanDepth: new Float64Array(N),
    moisture: new Float64Array(N),
    temperature: new Float64Array(N),
    isWater: new Uint8Array(N),
    isOcean: new Uint8Array(N),
    isLake: new Uint8Array(N),
    isLand: new Uint8Array(N),
    isCoast: new Uint8Array(N),
    isRiver: new Uint8Array(N),
    downslope: new Int32Array(N).fill(-1),
    biome: new Array(N).fill('OCEAN'),
    paint: new Array(N).fill(null),
    riverEdges: [],
    coastSegments: [],
  };
}

export function generate(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const rng = makeRng(cfg.seed);
  const noise2D = createNoise2D(rng);
  const size = WORLD;

  // --- geometry: sites + Lloyd relaxation ---
  const radius = DETAIL_RADIUS[cfg.detail] || 12;
  let points = poissonDiskSampling(size, size, radius, rng);
  let geo = buildGeometry(points, size);
  for (let iter = 0; iter < 2; iter++) {
    const relaxed = [];
    for (let i = 0; i < geo.N; i++) {
      const cell = geo.polygons[i];
      relaxed.push(cell && cell.length > 2 ? polygonCentroid(cell) : points[i]);
    }
    points = relaxed;
    geo = buildGeometry(points, size);
  }

  const { N, cx, cy, neighbors, onBorder, polygons, delaunay, voronoi } = geo;
  const layers = emptyLayers(N);
  const isWater = layers.isWater;

  // --- island shape -> initial water/land ---
  const fbm = (x, y) => {
    let amp = 1, freq = cfg.noiseFreq, sum = 0, norm = 0;
    for (let o = 0; o < cfg.octaves; o++) {
      sum += amp * noise2D(x * freq + 11.3, y * freq + 7.7);
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return (sum / norm + 1) / 2;
  };
  const R = 0.5 + cfg.islandSize * 0.78;
  const P = 1 + cfg.roundness * 3.5;
  for (let i = 0; i < N; i++) {
    const nx = (cx[i] / size) * 2 - 1;
    const ny = (cy[i] / size) * 2 - 1;
    const d = Math.hypot(nx, ny);
    const n = fbm(cx[i] / size, cy[i] / size);
    const mask = clamp01(1 - Math.pow(Math.min(1, d / R), P));
    const e = mask * (cfg.roundness + (1 - cfg.roundness) * n);
    isWater[i] = e <= cfg.seaLevel || onBorder[i] ? 1 : 0;
  }

  const map = {
    cfg, size, N, cx, cy, polygons, neighbors, onBorder, noise2D,
    points, voronoi, delaunay,
    ...layers,
  };

  classify(map, { computeElevation: true, addLakes: true });
  return map;
}

// Rebuild geometry from edited site points, transferring terrain (water/height/
// paint) from the old map by nearest old cell, then re-deriving everything.
export function rebuildGeometry(oldMap, points) {
  const size = oldMap.size;
  const geo = buildGeometry(points, size);
  const { N, cx, cy } = geo;
  const layers = emptyLayers(N);
  for (let i = 0; i < N; i++) {
    const old = oldMap.delaunay.find(cx[i], cy[i]);
    if (old != null && old >= 0) {
      layers.isWater[i] = oldMap.isWater[old];
      layers.elevation[i] = oldMap.elevation[old];
      layers.paint[i] = oldMap.paint[old];
    }
    if (geo.onBorder[i]) { layers.isWater[i] = 1; layers.elevation[i] = -0.3; }
  }
  const map = {
    cfg: oldMap.cfg, size, N, cx, cy,
    polygons: geo.polygons, neighbors: geo.neighbors, onBorder: geo.onBorder,
    noise2D: oldMap.noise2D, points, voronoi: geo.voronoi, delaunay: geo.delaunay,
    ...layers,
  };
  classify(map, { computeElevation: false, addLakes: false });
  return map;
}

// Re-derive all downstream layers from map.isWater (+ map.elevation when editing).
export function classify(map, { computeElevation = false, addLakes = false } = {}) {
  const { N, neighbors, onBorder, cfg, cx, cy, size, noise2D } = map;
  const { isWater, isOcean, isLake, isLand, isCoast, elevation, oceanDepth } = map;

  // 1. ocean (water reachable from border) vs lake
  isOcean.fill(0); isLake.fill(0); isLand.fill(0); isCoast.fill(0);
  const q = [];
  for (let i = 0; i < N; i++) if (isWater[i] && onBorder[i]) { isOcean[i] = 1; q.push(i); }
  while (q.length) {
    const c = q.pop();
    for (const nb of neighbors[c]) if (isWater[nb] && !isOcean[nb]) { isOcean[nb] = 1; q.push(nb); }
  }
  for (let i = 0; i < N; i++) {
    isLand[i] = isWater[i] ? 0 : 1;
    if (isWater[i] && !isOcean[i]) isLake[i] = 1;
  }
  for (let i = 0; i < N; i++) {
    if (!isLand[i]) continue;
    for (const nb of neighbors[i]) if (isOcean[nb]) { isCoast[i] = 1; break; }
  }

  // 2. elevation
  if (computeElevation) {
    const dist = new Int32Array(N).fill(-1);
    const bq = [];
    for (let i = 0; i < N; i++) if (isCoast[i]) { dist[i] = 0; bq.push(i); }
    let head = 0, maxD = 1;
    while (head < bq.length) {
      const c = bq[head++];
      for (const nb of neighbors[c]) {
        if (isLand[nb] && dist[nb] === -1) { dist[nb] = dist[c] + 1; if (dist[nb] > maxD) maxD = dist[nb]; bq.push(nb); }
      }
    }
    for (let i = 0; i < N; i++) {
      if (isLand[i]) elevation[i] = Math.pow(clamp01(dist[i] < 0 ? 0 : dist[i] / maxD), 0.92);
    }
  }

  // 3. inland lakes from a dedicated noise (only on fresh generation)
  if (addLakes && cfg.lakes > 0) {
    const thr = cfg.lakes * 0.16;
    for (let i = 0; i < N; i++) {
      if (!isLand[i] || isCoast[i]) continue;
      if (elevation[i] < 0.1 || elevation[i] > 0.72) continue;
      const lv = (noise2D(cx[i] / size * 5 + 311, cy[i] / size * 5 - 127) + 1) / 2;
      // keep the cell's land height; the water surface is levelled below.
      if (lv < thr) { isWater[i] = 1; isLake[i] = 1; isLand[i] = 0; }
    }
  }

  // 4. ocean depth (for shading) + water elevations
  const od = new Int32Array(N).fill(-1);
  const oq = [];
  for (let i = 0; i < N; i++) {
    if (isOcean[i]) for (const nb of neighbors[i]) if (isLand[nb]) { od[i] = 0; oq.push(i); break; }
  }
  let h2 = 0, maxOD = 1;
  while (h2 < oq.length) {
    const c = oq[h2++];
    for (const nb of neighbors[c]) if (isOcean[nb] && od[nb] === -1) { od[nb] = od[c] + 1; if (od[nb] > maxOD) maxOD = od[nb]; oq.push(nb); }
  }
  for (let i = 0; i < N; i++) {
    if (isOcean[i]) { oceanDepth[i] = od[i] < 0 ? 1 : clamp01(od[i] / maxOD); elevation[i] = -oceanDepth[i]; continue; }
    if (!isLake[i]) continue;
    // A lake (any non-ocean water) sits at roughly its surrounding terrain
    // height, just a little lower — so mountain lakes stay up in the mountains
    // instead of snapping to sea level.
    let minE = Infinity;
    for (const nb of neighbors[i]) if (isLand[nb] && elevation[nb] < minE) minE = elevation[nb];
    const base = minE !== Infinity ? minE : (elevation[i] > 0 ? elevation[i] : 0.06);
    elevation[i] = Math.max(0.02, base - 0.03);
    oceanDepth[i] = 0.3;
  }

  // 5. rivers (steepest descent + flow accumulation)
  computeRivers(map);

  // 6. moisture
  computeMoisture(map);

  // 7. temperature + biome (respecting manual paint)
  const { temperature, biome, moisture, paint } = map;
  for (let i = 0; i < N; i++) {
    if (isOcean[i]) { biome[i] = oceanDepth[i] > 0.5 ? 'OCEAN_DEEP' : 'OCEAN'; continue; }
    if (isLake[i]) { biome[i] = 'LAKE'; continue; }
    const lat = cy[i] / size;
    const t = clamp01(cfg.temperature + (lat - 0.5) * cfg.latitudeRange);
    temperature[i] = t;
    biome[i] = paint[i] || biomeFor(elevation[i], moisture[i], t);
  }

  // 8. coastline segments
  map.coastSegments = buildBoundary(map.delaunay, map.voronoi, isOcean, isLand);
}

function computeRivers(map) {
  const { N, neighbors, elevation, isLand, isCoast, cfg, cx, cy } = map;
  const downslope = map.downslope; downslope.fill(-1);
  for (let i = 0; i < N; i++) {
    if (!isLand[i]) continue;
    let best = -1, bestE = elevation[i];
    for (const nb of neighbors[i]) if (elevation[nb] < bestE) { bestE = elevation[nb]; best = nb; }
    downslope[i] = best;
  }
  const flow = new Float64Array(N);
  const isRiver = map.isRiver; isRiver.fill(0);
  const edges = [];
  const landIdx = [];
  for (let i = 0; i < N; i++) if (isLand[i] && !isCoast[i]) landIdx.push(i);
  landIdx.sort((a, b) => elevation[b] - elevation[a]);
  const springCount = Math.min(cfg.rivers, landIdx.length);
  const band = Math.max(springCount, Math.floor(landIdx.length * 0.4));
  for (let s = 0; s < springCount; s++) flow[landIdx[Math.floor((s / springCount) * band)]] += 1;
  for (const c of landIdx) {
    const d = downslope[c];
    if (d !== -1 && flow[c] > 0 && isLand[c] && isLand[d]) flow[d] += flow[c];
  }
  for (const c of landIdx) {
    const d = downslope[c];
    if (d === -1) continue;
    if (flow[c] >= 1 && isLand[c]) {
      isRiver[c] = 1;
      // If the river runs into water (a lake or the sea), stop it at the
      // shoreline (midpoint) instead of drawing across the water body.
      let bx = cx[d], by = cy[d];
      if (!isLand[d]) { bx = (cx[c] + cx[d]) / 2; by = (cy[c] + cy[d]) / 2; }
      else isRiver[d] = 1;
      edges.push({ ax: cx[c], ay: cy[c], bx, by, w: 0.6 + Math.sqrt(flow[c]) * 0.7 });
    }
  }
  map.riverEdges = edges;
}

function computeMoisture(map) {
  const { N, neighbors, isLand, isRiver, isLake, isCoast, moisture, cfg, cx, cy, size, noise2D } = map;
  const dist = new Int32Array(N).fill(-1);
  const q = [];
  for (let i = 0; i < N; i++) if (isLand[i] && (isRiver[i] || isLake[i] || isCoast[i])) { dist[i] = 0; q.push(i); }
  let head = 0, maxD = 1;
  while (head < q.length) {
    const c = q[head++];
    for (const nb of neighbors[c]) if (isLand[nb] && dist[nb] === -1) { dist[nb] = dist[c] + 1; if (dist[nb] > maxD) maxD = dist[nb]; q.push(nb); }
  }
  for (let i = 0; i < N; i++) {
    if (!isLand[i]) continue;
    const fresh = dist[i] < 0 ? 0 : 1 - dist[i] / maxD;
    const mn = (noise2D(cx[i] / size * 3 + 99, cy[i] / size * 3 - 42) + 1) / 2;
    moisture[i] = clamp01((fresh * 0.65 + mn * 0.35) * cfg.moisture);
  }
}

function buildBoundary(delaunay, voronoi, isOcean, isLand) {
  const { halfedges, triangles } = delaunay;
  const cc = voronoi.circumcenters;
  const segs = [];
  for (let e = 0; e < halfedges.length; e++) {
    const opp = halfedges[e];
    if (opp < e && opp !== -1) continue;
    if (opp === -1) continue;
    const a = triangles[e];
    const b = triangles[e % 3 === 2 ? e - 2 : e + 1];
    const transition = (isLand[a] && isOcean[b]) || (isOcean[a] && isLand[b]);
    if (!transition) continue;
    const t1 = Math.floor(e / 3);
    const t2 = Math.floor(opp / 3);
    segs.push({ ax: cc[t1 * 2], ay: cc[t1 * 2 + 1], bx: cc[t2 * 2], by: cc[t2 * 2 + 1] });
  }
  return segs;
}

// Cells within `radius` world units of (x,y), via nearest-cell BFS.
export function cellsInRadius(map, x, y, radius) {
  const start = map.delaunay.find(x, y);
  if (start == null || start < 0) return [];
  const r2 = radius * radius;
  const seen = new Set([start]);
  const out = [];
  const stack = [start];
  while (stack.length) {
    const c = stack.pop();
    const dx = map.cx[c] - x, dy = map.cy[c] - y;
    if (dx * dx + dy * dy <= r2) {
      out.push(c);
      for (const nb of map.neighbors[c]) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
    }
  }
  if (out.length === 0) out.push(start);
  return out;
}

export function suggestSites(map, count = 6) {
  const { N, isLand, isCoast, isRiver, isLake, elevation, neighbors, cx, cy, moisture } = map;
  const scored = [];
  for (let i = 0; i < N; i++) {
    if (!isLand[i] || elevation[i] > 0.6) continue;
    let s = 0;
    if (isCoast[i]) s += 3;
    if (isRiver[i]) s += 2.5;
    for (const nb of neighbors[i]) {
      if (isRiver[nb] || isLake[nb]) s += 0.8;
      if (isCoast[nb]) s += 0.4;
    }
    s += (1 - Math.abs(elevation[i] - 0.18)) * 1.5;
    s += (1 - Math.abs(moisture[i] - 0.55)) * 0.8;
    scored.push([i, s]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const chosen = [];
  const minDist = map.size / (count + 1);
  for (const [i] of scored) {
    if (chosen.length >= count) break;
    let ok = true;
    for (const j of chosen) if (Math.hypot(cx[i] - cx[j], cy[i] - cy[j]) < minDist) { ok = false; break; }
    if (ok) chosen.push(i);
  }
  return chosen.map((i) => ({ x: cx[i], y: cy[i] }));
}
