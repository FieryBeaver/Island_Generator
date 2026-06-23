// Bridson's Poisson-disk sampling in a rectangle [0,width] x [0,height].
// Produces evenly-spaced points -> well-shaped Voronoi cells.
// `rng` is a () => [0,1) function so sampling is deterministic per seed.

export function poissonDiskSampling(width, height, radius, rng, k = 30) {
  const cellSize = radius / Math.SQRT2;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);
  const grid = new Array(gridW * gridH).fill(-1);
  const points = [];
  const active = [];

  const gridIndex = (x, y) =>
    Math.floor(y / cellSize) * gridW + Math.floor(x / cellSize);

  const addPoint = (p) => {
    const idx = points.length;
    points.push(p);
    active.push(idx);
    grid[gridIndex(p[0], p[1])] = idx;
  };

  addPoint([rng() * width, rng() * height]);

  while (active.length > 0) {
    const i = (rng() * active.length) | 0;
    const sourceIdx = active[i];
    const source = points[sourceIdx];
    let found = false;

    for (let n = 0; n < k; n++) {
      const ang = rng() * Math.PI * 2;
      const r = radius * (1 + rng()); // [radius, 2*radius)
      const px = source[0] + Math.cos(ang) * r;
      const py = source[1] + Math.sin(ang) * r;

      if (px < 0 || px >= width || py < 0 || py >= height) continue;

      const gx = Math.floor(px / cellSize);
      const gy = Math.floor(py / cellSize);
      let ok = true;

      for (let yy = Math.max(0, gy - 2); yy <= Math.min(gridH - 1, gy + 2) && ok; yy++) {
        for (let xx = Math.max(0, gx - 2); xx <= Math.min(gridW - 1, gx + 2); xx++) {
          const idx = grid[yy * gridW + xx];
          if (idx === -1) continue;
          const q = points[idx];
          const dx = q[0] - px;
          const dy = q[1] - py;
          if (dx * dx + dy * dy < radius * radius) {
            ok = false;
            break;
          }
        }
      }

      if (ok) {
        addPoint([px, py]);
        found = true;
        break;
      }
    }

    if (!found) {
      active[i] = active[active.length - 1];
      active.pop();
    }
  }

  return points;
}
