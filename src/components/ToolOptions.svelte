<script>
  import { PAINT_BIOMES } from '../lib/biomes.js';
  import { store, isEditTool } from '../lib/store.svelte.js';

  const LABELS = {
    raise: 'Raise land', lower: 'Lower land', water: 'Paint water',
    land: 'Fill land', paint: 'Paint biome',
  };
</script>

{#if isEditTool(store.tool)}
  <div class="options">
    <span class="tool">{LABELS[store.tool]}</span>
    <span class="sep"></span>

    <label class="opt">
      Size
      <input type="range" min="15" max="200" step="1" bind:value={store.brush.size} />
      <b>{store.brush.size}</b>
    </label>

    <label class="opt">
      Strength
      <input type="range" min="0.02" max="0.4" step="0.01" bind:value={store.brush.strength} />
      <b>{store.brush.strength.toFixed(2)}</b>
    </label>

    {#if store.tool === 'paint'}
      <span class="sep"></span>
      <label class="opt">
        Biome
        <select bind:value={store.brush.biome}>
          {#each PAINT_BIOMES as [id, label]}<option value={id}>{label}</option>{/each}
        </select>
      </label>
    {/if}
  </div>
{/if}

<style>
  .options {
    position: absolute; top: 56px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 12px; z-index: 9;
    background: rgba(28,33,40,0.92); border: 1px solid var(--line);
    border-radius: 9px; padding: 6px 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    font-size: 12px; color: var(--muted); white-space: nowrap;
  }
  .tool { color: var(--accent); font-weight: 700; }
  .sep { width: 1px; height: 20px; background: var(--line); }
  .opt { display: flex; align-items: center; gap: 7px; margin: 0; color: var(--muted); }
  .opt input[type='range'] { width: 110px; }
  .opt b { color: var(--ink); min-width: 30px; text-align: right; }
  .opt select {
    background: var(--bg); border: 1px solid var(--line); border-radius: 5px;
    color: var(--ink); padding: 3px 6px; font-size: 12px;
  }
</style>
