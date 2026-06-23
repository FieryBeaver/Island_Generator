<script>
  import { iconSvg, PIN_TYPES } from '../lib/icons.js';
  import { store, relaxCells } from '../lib/store.svelte.js';

  let pinsOpen = $state(false);

  const TERRAIN = [
    { id: 'raise', label: 'Raise land', icon: '⛰' },
    { id: 'lower', label: 'Lower land', icon: '🕳' },
    { id: 'water', label: 'Paint water', icon: '💧' },
    { id: 'land', label: 'Fill land', icon: '🟩' },
    { id: 'paint', label: 'Paint biome', icon: '🎨' },
  ];

  function pick(tool) { store.tool = tool; pinsOpen = false; }
  function pickCell(tool) { store.tool = tool; store.options.showCells = true; pinsOpen = false; }

  const selectedPinType = $derived(PIN_TYPES.find((t) => t.id === store.tool));
</script>

<div class="toolbar">
  <button class:active={store.tool === 'pan'} onclick={() => pick('pan')} title="Pan / select">✋</button>

  <span class="sep"></span>

  <!-- Pins flyout -->
  <div class="group">
    <button class:active={!!selectedPinType} onclick={() => (pinsOpen = !pinsOpen)} title="Map markers">
      {#if selectedPinType}
        <span class="ic" style="color:{selectedPinType.color}">{@html iconSvg(selectedPinType.id, 18)}</span>
      {:else}📍{/if}
      <span class="caret">▾</span>
    </button>
    {#if pinsOpen}
      <div class="flyout">
        {#each PIN_TYPES as t}
          <button class:active={store.tool === t.id} onclick={() => pick(t.id)} title={t.label} style="color:{t.color}">
            {@html iconSvg(t.id, 20)}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <span class="sep"></span>

  <!-- Terrain brush -->
  {#each TERRAIN as t}
    <button class:active={store.tool === t.id} onclick={() => pick(t.id)} title={t.label}>{t.icon}</button>
  {/each}

  <span class="sep"></span>

  <!-- Voronoi grid editing -->
  <button class:active={store.tool === 'move-site'} onclick={() => pickCell('move-site')} title="Move cell site (reshape edges)">✥</button>
  <button class:active={store.tool === 'add-site'} onclick={() => pickCell('add-site')} title="Add cell site">＋</button>
  <button onclick={relaxCells} title="Relax / even out cells">↻</button>
  <button class:active={store.options.showCells} onclick={() => (store.options.showCells = !store.options.showCells)} title="Toggle cell grid">▦</button>
</div>

<style>
  .toolbar {
    position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 4px; z-index: 10;
    background: rgba(28,33,40,0.92); border: 1px solid var(--line);
    border-radius: 10px; padding: 5px 7px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }
  .toolbar button {
    width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center;
    font-size: 15px; background: transparent; border: 1px solid transparent;
  }
  .toolbar button:hover { background: #34404f; }
  .toolbar button.active { border-color: var(--accent); background: #34404f; }
  .sep { width: 1px; height: 24px; background: var(--line); margin: 0 3px; }
  .group { position: relative; }
  .group > button { width: auto; padding: 0 6px; gap: 2px; }
  .ic { line-height: 0; display: inline-flex; }
  .caret { font-size: 9px; color: var(--muted); }
  .flyout {
    position: absolute; top: 40px; left: 0;
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px;
    background: rgba(28,33,40,0.98); border: 1px solid var(--line);
    border-radius: 8px; padding: 6px; box-shadow: 0 6px 18px rgba(0,0,0,0.5);
  }
</style>
