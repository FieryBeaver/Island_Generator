<script>
  import { onMount } from 'svelte';
  import { draw, screenToWorld, worldToScreen } from '../lib/render.js';
  import { iconSvg, PIN_TYPES } from '../lib/icons.js';
  import { getStyle } from '../lib/styles.js';
  import {
    store, addPin, paintAt, finalizeEdit, moveSite, addSite,
    isEditTool, isCellTool, WORLD,
  } from '../lib/store.svelte.js';

  let container;
  let canvas;
  let ctx;
  let dpr = 1;
  let cw = $state(800);
  let ch = $state(600);

  const colorOf = (type) => PIN_TYPES.find((t) => t.id === type)?.color || '#c0392b';
  const pinStyle = $derived(getStyle(store.style).pin);

  function resize() {
    if (!container || !canvas) return;
    const r = container.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = r.width; ch = r.height;
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    render();
  }

  export function fitView() {
    const pad = 24;
    const s = Math.min((cw - pad * 2) / WORLD, (ch - pad * 2) / WORLD);
    store.view.scale = s;
    store.view.x = (cw - WORLD * s) / 2;
    store.view.y = (ch - WORLD * s) / 2;
  }

  function render() {
    if (ctx && store.map) draw(ctx, store.map, store.view, { ...store.options, styleId: store.style, revision: store.revision, styleRev: store.themeRev || 0, dpr });
  }

  // Export a clean PNG: render the whole island fitted into the frame on an
  // offscreen high-res canvas (independent of the current on-screen pan/zoom).
  // Export a crisp PNG: render the whole world fitted into a high-resolution
  // square frame on an offscreen canvas (independent of on-screen pan/zoom).
  async function exportPng() {
    if (!store.map) return;
    const PX_PER_UNIT = 3.5;            // high render density -> sharp output
    const margin = Math.round(WORLD * PX_PER_UNIT * 0.03);
    const E = Math.round(WORLD * PX_PER_UNIT + margin * 2); // square frame
    const out = document.createElement('canvas');
    out.width = E; out.height = E;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';

    const view = { scale: PX_PER_UNIT, x: margin, y: margin };
    draw(octx, store.map, view, { ...store.options, styleId: store.style, revision: store.revision, styleRev: store.themeRev || 0, dpr: 1 });

    const loadImg = (svg) => new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
    const px = (p) => p.x * view.scale + view.x;
    const py = (p) => p.y * view.scale + view.y;
    const SZ = Math.round(PX_PER_UNIT * 9);
    const fontPx = Math.round(PX_PER_UNIT * 4.5);
    const fontFam = pinStyle.font.split(',')[0].split(' ').slice(-1)[0] || 'sans-serif';
    const mono = pinStyle.monochrome;
    for (const pin of store.pins) {
      const col = mono || colorOf(pin.type);
      // request the SVG at the target raster size so it isn't upscaled/blurry
      const svg = iconSvg(pin.type, SZ).replace(/currentColor/g, col);
      const img = await loadImg(svg);
      const x = px(pin), y = py(pin);
      if (img) octx.drawImage(img, x - SZ / 2, y - SZ, SZ, SZ);
      if (pin.label) {
        octx.font = `${fontPx}px ${fontFam}`;
        octx.textAlign = 'center';
        octx.lineWidth = Math.max(2, fontPx * 0.25);
        octx.strokeStyle = pinStyle.shadow ? '#000' : 'rgba(255,255,255,0.6)';
        octx.fillStyle = pinStyle.labelColor;
        octx.strokeText(pin.label, x, y + fontPx);
        octx.fillText(pin.label, x, y + fontPx);
      }
    }

    out.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `island-${store.params.seed}.png`; a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    store.api = { fitView, exportPng };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    return () => ro.disconnect();
  });

  // redraw on any visual change
  $effect(() => {
    store.map; store.revision;
    store.view.scale; store.view.x; store.view.y; store.style;
    store.options.showRivers; store.options.showCoast; store.options.showCells; store.options.shading;
    store.options.forests; store.options.grass; store.options.contours; store.themeRev;
    render();
  });

  let fitted = false;
  $effect(() => { if (store.map && !fitted) { fitted = true; fitView(); } });

  // ---- interaction ----
  let dragging = false; // panning
  let painting = false; // terrain brush
  let siteDrag = $state(null); // { index, x, y }
  let pendingAdd = null; // { x, y, moved }
  let hover = $state(null); // screen-space cursor pos for brush preview
  let movedDist = 0;
  let last = { x: 0, y: 0 };
  let down = { x: 0, y: 0 };

  const evWorld = (e) => {
    const rect = canvas.getBoundingClientRect();
    return screenToWorld(e.clientX - rect.left, e.clientY - rect.top, store.view);
  };

  function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const [wx, wy] = screenToWorld(px, py, store.view);
    const ns = Math.max(0.1, Math.min(20, store.view.scale * factor));
    store.view.scale = ns;
    store.view.x = px - wx * ns;
    store.view.y = py - wy * ns;
  }

  function onPointerDown(e) {
    if (e.button !== 0 || !store.map) return;
    canvas.setPointerCapture(e.pointerId);
    const tool = store.tool;
    const [wx, wy] = evWorld(e);
    if (isEditTool(tool)) { painting = true; paintAt(wx, wy); return; }
    if (tool === 'move-site') { siteDrag = { index: store.map.delaunay.find(wx, wy), x: wx, y: wy }; return; }
    if (tool === 'add-site') { pendingAdd = { x: wx, y: wy, moved: 0 }; return; }
    // pan / pin
    dragging = true; movedDist = 0;
    last = { x: e.clientX, y: e.clientY };
    const rect = canvas.getBoundingClientRect();
    down = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    hover = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (painting) { const [wx, wy] = evWorld(e); paintAt(wx, wy); return; }
    if (siteDrag) { const [wx, wy] = evWorld(e); siteDrag = { ...siteDrag, x: wx, y: wy }; return; }
    if (pendingAdd) { pendingAdd.moved += Math.abs(e.movementX) + Math.abs(e.movementY); return; }
    if (!dragging) return;
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    movedDist += Math.abs(dx) + Math.abs(dy);
    store.view.x += dx; store.view.y += dy;
    last = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e) {
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    if (painting) { painting = false; finalizeEdit(); return; }
    if (siteDrag) { moveSite(siteDrag.index, siteDrag.x, siteDrag.y); siteDrag = null; return; }
    if (pendingAdd) { if (pendingAdd.moved < 5) { const [wx, wy] = evWorld(e); addSite(wx, wy); } pendingAdd = null; return; }
    if (!dragging) return;
    dragging = false;
    if (movedDist < 5) {
      if (store.tool !== 'pan' && !isCellTool(store.tool) && !isEditTool(store.tool)) {
        const [wx, wy] = screenToWorld(down.x, down.y, store.view);
        addPin(store.tool, wx, wy);
      } else store.selectedPin = null;
    }
  }

  // pin dragging
  let pinDrag = null;
  function pinPointerDown(e, pin) {
    e.stopPropagation();
    store.selectedPin = pin.id;
    e.currentTarget.setPointerCapture(e.pointerId);
    pinDrag = { id: pin.id, lx: e.clientX, ly: e.clientY };
  }
  function pinPointerMove(e, pin) {
    if (!pinDrag || pinDrag.id !== pin.id) return;
    e.stopPropagation();
    const [wx, wy] = evWorld(e);
    pin.x = wx; pin.y = wy;
  }
  function pinPointerUp(e) {
    if (!pinDrag) return;
    e.stopPropagation();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    pinDrag = null;
  }

  const sx = (p) => p.x * store.view.scale + store.view.x;
  const sy = (p) => p.y * store.view.scale + store.view.y;
  const cursorClass = $derived(
    isEditTool(store.tool) || store.tool === 'add-site' ? 'crosshair'
    : store.tool === 'move-site' ? 'move'
    : store.tool !== 'pan' ? 'place' : 'grab'
  );
  // brush preview only for terrain tools (raise/lower/water/land/paint)
  const showBrush = $derived(isEditTool(store.tool) && !!hover);
  const brushPx = $derived(store.brush.size * store.view.scale * 2);
  const brushColor = $derived(
    store.tool === 'water' ? 'rgba(80,160,230,0.9)'
    : store.tool === 'paint' ? 'rgba(255,210,90,0.9)'
    : store.tool === 'lower' ? 'rgba(230,120,80,0.9)'
    : 'rgba(255,255,255,0.9)'
  );
</script>

<div class="map" bind:this={container}>
  <canvas
    bind:this={canvas}
    class={cursorClass}
    onwheel={onWheel}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={() => (hover = null)}
  ></canvas>

  {#if showBrush}
    <div class="brush-preview"
      style="left:{hover.x}px; top:{hover.y}px; width:{brushPx}px; height:{brushPx}px; border-color:{brushColor}"></div>
  {/if}

  {#if store.map}
    <div class="pins">
      {#each store.pins as pin (pin.id)}
        <div
          class="pin"
          class:selected={store.selectedPin === pin.id}
          class:noshadow={!pinStyle.shadow}
          style="left:{sx(pin)}px; top:{sy(pin)}px; color:{pinStyle.monochrome || colorOf(pin.type)}"
          onpointerdown={(e) => pinPointerDown(e, pin)}
          onpointermove={(e) => pinPointerMove(e, pin)}
          onpointerup={pinPointerUp}
          role="button" tabindex="0"
        >
          <span class="glyph">{@html iconSvg(pin.type, 26)}</span>
          {#if pin.label}<span class="plabel" style="color:{pinStyle.labelColor}; font:{pinStyle.font}">{pin.label}</span>{/if}
        </div>
      {/each}

      {#if siteDrag}
        <div class="sitemarker" style="left:{siteDrag.x * store.view.scale + store.view.x}px; top:{siteDrag.y * store.view.scale + store.view.y}px"></div>
      {/if}
    </div>
  {/if}

  {#if store.generating}<div class="busy">Generating…</div>{/if}

  <div class="hud">
    <button onclick={fitView} title="Fit map">⤢ Fit</button>
    <span class="zoom">{Math.round(store.view.scale * 100)}%</span>
  </div>
</div>

<style>
  .map { position: relative; width: 100%; height: 100%; overflow: hidden; background: #2f5680; }
  canvas { display: block; touch-action: none; }
  canvas.grab { cursor: grab; }
  canvas.place { cursor: copy; }
  canvas.crosshair { cursor: crosshair; }
  canvas.move { cursor: move; }
  .pins { position: absolute; inset: 0; pointer-events: none; }
  .pin {
    position: absolute; transform: translate(-50%, -100%); pointer-events: auto; cursor: grab;
    display: flex; flex-direction: column; align-items: center;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.55)); user-select: none;
  }
  .pin.noshadow { filter: none; }
  .pin .glyph { line-height: 0; }
  .pin.selected .glyph :global(svg) {
    outline: 2px solid #fff; border-radius: 4px; background: rgba(255, 255, 255, 0.15);
  }
  .plabel { margin-top: 1px; white-space: nowrap; text-shadow: 0 1px 2px #000, 0 0 3px #000; }
  .pin.noshadow .plabel { text-shadow: 0 0 2px rgba(255,255,255,0.8); }
  .brush-preview {
    position: absolute; transform: translate(-50%, -50%); pointer-events: none;
    border: 2px solid #fff; border-radius: 50%;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.3);
  }
  .sitemarker {
    position: absolute; width: 12px; height: 12px; transform: translate(-50%, -50%);
    border: 2px solid #fff; border-radius: 50%; background: rgba(212,175,55,0.6);
    box-shadow: 0 0 0 1px #000;
  }
  .busy {
    position: absolute; top: 56px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.7); padding: 6px 14px; border-radius: 20px; font-size: 13px;
  }
  .hud {
    position: absolute; bottom: 12px; left: 12px; display: flex; align-items: center; gap: 8px;
    background: rgba(28,33,40,0.8); padding: 5px 8px; border-radius: 8px; border: 1px solid var(--line);
  }
  .zoom { font-size: 12px; color: var(--muted); min-width: 38px; text-align: center; }
</style>
