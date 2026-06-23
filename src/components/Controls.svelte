<script>
  import { PIN_TYPES } from '../lib/icons.js';
  import { STYLES, isCustom } from '../lib/styles.js';
  import { TEXTURES } from '../lib/texture.js';
  import ThemeBuilder from './ThemeBuilder.svelte';
  import {
    store, regenerate, randomizeSeed, autoSettlements, clearPins, removePin,
    saveLocal, exportJson, importJson, createTheme, importTheme,
  } from '../lib/store.svelte.js';

  let auto = $state(true);
  let regenTimer;

  function scheduleRegen() {
    if (!auto) return;
    clearTimeout(regenTimer);
    regenTimer = setTimeout(() => regenerate(), 120);
  }
  function genNow() { regenerate(); }
  function rollSeed() { randomizeSeed(); regenerate(); }

  const selected = $derived(store.pins.find((p) => p.id === store.selectedPin) || null);

  async function onImport(e) {
    const f = e.target.files?.[0];
    if (f) { await importJson(f); regenerate(); }
    e.target.value = '';
  }
  async function onImportTheme(e) {
    const f = e.target.files?.[0];
    if (f) { try { await importTheme(f); } catch { alert('Not a valid theme file.'); } }
    e.target.value = '';
  }

  // decorations dropdown
  const DECOS = [
    { key: 'forests', label: 'Forest icons' },
    { key: 'grass', label: 'Grass icons' },
    { key: 'contours', label: 'Contour / iso lines' },
  ];
  const decoOn = $derived(DECOS.filter((d) => store.options[d.key]));
  const allOn = $derived(decoOn.length === DECOS.length);
  const decoSummary = $derived(
    decoOn.length === 0 ? 'None'
    : allOn ? 'All'
    : decoOn.map((d) => d.label.replace(/ icons| \/ iso lines/, '')).join(', ')
  );
  function toggleAllDeco(e) {
    const v = e.currentTarget.checked;
    for (const d of DECOS) store.options[d.key] = v;
  }
  function pngExport() { store.api?.exportPng?.(); }
</script>

<aside class="panel scroll">
  <h1>⚓ Island Forge</h1>

  <section>
    <div class="row">
      <div style="flex:1">
        <label for="seed">Seed</label>
        <input id="seed" type="text" bind:value={store.params.seed} onchange={genNow} />
      </div>
      <button onclick={rollSeed} title="Random seed" style="align-self:flex-end">🎲</button>
    </div>
    <label for="detail">Detail (cell density): {store.params.detail}</label>
    <input id="detail" type="range" min="1" max="5" step="1" bind:value={store.params.detail} onchange={scheduleRegen} />
    <div class="row">
      <button class="primary" style="flex:1" onclick={genNow}>Generate</button>
      <label class="chk"><input type="checkbox" bind:checked={auto} /> auto</label>
    </div>
  </section>

  <section>
    <h2>Map style</h2>
    <div class="styles">
      {#each STYLES as s}
        <button class:active={store.style === s.id} onclick={() => (store.style = s.id)}>{s.label}</button>
      {/each}
      {#each store.themes as t}
        <button class:active={store.style === t.id} onclick={() => (store.style = t.id)}>🎨 {t.label}</button>
      {/each}
    </div>
    <div class="grid2" style="margin-top:8px">
      <button onclick={() => createTheme()}>＋ New theme</button>
      <label class="filebtn">📂 Import theme<input type="file" accept="application/json" onchange={onImportTheme} hidden /></label>
    </div>
    {#if isCustom(store.style)}
      <ThemeBuilder />
    {/if}
  </section>

  <section>
    <h2>Topology & Shoreline</h2>
    {@render slider('Island size', 'islandSize', 0.1, 1, 0.01)}
    {@render slider('Roundness (archipelago → round)', 'roundness', 0, 1, 0.01)}
    {@render slider('Sea level (shoreline)', 'seaLevel', 0, 0.6, 0.01)}
    {@render slider('Coastline roughness', 'noiseFreq', 0.8, 6, 0.1)}
    {@render slider('Lakes', 'lakes', 0, 1, 0.01)}
  </section>

  <section>
    <h2>Climate</h2>
    {@render slider('Temperature (frozen → tropical)', 'temperature', 0, 1, 0.01)}
    {@render slider('Latitude gradient', 'latitudeRange', 0, 1, 0.01)}
    {@render slider('Moisture (arid → lush)', 'moisture', 0.3, 1.6, 0.01)}
    {@render slider('Rivers', 'rivers', 0, 40, 1)}
  </section>

  <section>
    <h2>Display</h2>
    <label for="shading">Cell shading</label>
    <select id="shading" bind:value={store.options.shading}>
      <option value="flat">Flat (solid biome)</option>
      <option value="gradient">Gradient (blended)</option>
    </select>
    <label for="texture">Tile texture</label>
    <select id="texture" bind:value={store.options.texture}>
      {#each TEXTURES as t}<option value={t.id}>{t.label}</option>{/each}
    </select>
    <details class="deco">
      <summary>Decorations: <b>{decoSummary}</b></summary>
      <div class="deco-menu">
        <label class="chk"><input type="checkbox" checked={allOn} onchange={toggleAllDeco} /> Select all</label>
        <hr />
        {#each DECOS as d}
          <label class="chk"><input type="checkbox" bind:checked={store.options[d.key]} /> {d.label}</label>
        {/each}
      </div>
    </details>
    <label class="chk"><input type="checkbox" bind:checked={store.options.showCoast} /> Coastline</label>
    <label class="chk"><input type="checkbox" bind:checked={store.options.showRivers} /> Rivers</label>
    <label class="chk"><input type="checkbox" bind:checked={store.options.showCells} /> Cell grid (blocks)</label>
    <p class="hint">Tip: lower <b>Detail</b> for big district-style cells — combine with the cell grid or gradient shading.</p>
  </section>

  <section>
    <h2>Pins</h2>
    <div class="row">
      <button style="flex:1" onclick={autoSettlements}>✨ Auto-place settlements</button>
      <button onclick={clearPins} title="Remove all pins">🗑</button>
    </div>
    {#if selected}
      <div class="selected">
        <label for="plabel">Label</label>
        <input id="plabel" type="text" bind:value={selected.label} placeholder="Name…" />
        <label for="ptype">Type</label>
        <select id="ptype" bind:value={selected.type}>
          {#each PIN_TYPES as t}<option value={t.id}>{t.label}</option>{/each}
        </select>
        <button onclick={() => removePin(selected.id)} style="margin-top:8px">Delete pin</button>
      </div>
    {/if}
  </section>

  <section>
    <h2>Save & export</h2>
    <div class="grid2">
      <button onclick={saveLocal}>💾 Save</button>
      <button onclick={exportJson}>⬇ JSON</button>
      <button onclick={pngExport}>🖼 PNG</button>
      <label class="filebtn">📂 Import<input type="file" accept="application/json" onchange={onImport} hidden /></label>
    </div>
  </section>

  <footer>Inspired by watabou's city generator & redblobgames mapgen2.</footer>
</aside>

{#snippet slider(labelText, key, min, max, step)}
  <label for={key}>{labelText}: <b>{store.params[key]}</b></label>
  <input id={key} type="range" {min} {max} {step} bind:value={store.params[key]} onchange={scheduleRegen} />
{/snippet}

<style>
  .panel {
    width: 320px; min-width: 320px; height: 100%; overflow-y: auto;
    background: var(--panel); border-right: 1px solid var(--line); padding: 14px 16px 40px;
  }
  h1 { font-size: 18px; margin: 0 0 14px; letter-spacing: 0.5px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--accent); margin: 0 0 8px; font-weight: 700; }
  section { border-top: 1px solid var(--line); padding: 14px 0; }
  section:first-of-type { border-top: none; padding-top: 0; }
  label { display: block; margin: 10px 0 4px; }
  label b { color: var(--ink); font-weight: 600; }
  .row { display: flex; gap: 8px; align-items: center; }
  .chk { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; color: var(--ink); cursor: pointer; }
  .chk input { accent-color: var(--accent); }
  .hint { font-size: 11px; color: var(--muted); margin: 0 0 8px; line-height: 1.4; }
  .styles { display: flex; flex-direction: column; gap: 5px; }
  .styles button { text-align: left; }
  .styles button.active { border-color: var(--accent); background: #34404f; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .filebtn {
    display: flex; align-items: center; justify-content: center; background: var(--panel-2);
    border: 1px solid var(--line); border-radius: 6px; padding: 7px 10px; font-size: 13px;
    cursor: pointer; color: var(--ink); margin: 0;
  }
  .filebtn:hover { background: #34404f; }
  select { width: 100%; background: var(--bg); border: 1px solid var(--line); border-radius: 6px; color: var(--ink); padding: 6px 8px; font-size: 13px; }
  .deco { margin: 4px 0 8px; }
  .deco summary {
    cursor: pointer; list-style: none; user-select: none;
    background: var(--bg); border: 1px solid var(--line); border-radius: 6px;
    padding: 7px 10px; font-size: 13px; color: var(--muted);
  }
  .deco summary::-webkit-details-marker { display: none; }
  .deco summary::after { content: '▾'; float: right; color: var(--muted); }
  .deco[open] summary::after { content: '▴'; }
  .deco summary b { color: var(--ink); font-weight: 600; }
  .deco-menu {
    background: var(--bg); border: 1px solid var(--line); border-top: none;
    border-radius: 0 0 6px 6px; padding: 8px 10px;
  }
  .deco-menu hr { border: none; border-top: 1px solid var(--line); margin: 6px 0; }
  .deco-menu .chk { margin-top: 4px; }
  .selected { background: var(--panel-2); border-radius: 8px; padding: 12px; margin-top: 10px; }
  footer { font-size: 10px; color: var(--muted); padding-top: 16px; line-height: 1.5; }
</style>
