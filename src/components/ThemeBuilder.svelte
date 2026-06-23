<script>
  import { THEME_PALETTE_KEYS } from '../lib/styles.js';
  import { store, themeChanged, exportTheme, deleteTheme } from '../lib/store.svelte.js';

  // the active custom theme (a reactive element of store.themes)
  const theme = $derived(store.themes.find((t) => t.id === store.style) || null);

  const pretty = (k) => k.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const ch = () => themeChanged();

  let useMono = $state(false);
  $effect(() => { if (theme) useMono = !!theme.pin.monochrome; });
  function toggleMono(e) {
    useMono = e.currentTarget.checked;
    theme.pin.monochrome = useMono ? (theme.pin.monochrome || '#d4af37') : null;
    ch();
  }
</script>

{#if theme}
  <div class="builder">
    <div class="hdr">
      <input class="name" type="text" bind:value={theme.label} oninput={ch} />
      <button title="Export theme" onclick={() => exportTheme(theme.id)}>⬇</button>
      <button title="Delete theme" onclick={() => deleteTheme(theme.id)}>🗑</button>
    </div>

    <div class="grid">
      <label>Background<input type="color" bind:value={theme.background} oninput={ch} /></label>
      <label>River<input type="color" bind:value={theme.river} oninput={ch} /></label>
    </div>
    <div class="grid">
      <label class="full">Coast<input type="text" bind:value={theme.coast} oninput={ch} /></label>
    </div>
    <div class="grid">
      <label class="full">Foam<input type="text" bind:value={theme.foam} oninput={ch} /></label>
    </div>
    <div class="grid">
      <label class="full">Contour<input type="text" bind:value={theme.contour} oninput={ch} /></label>
    </div>
    <label class="rng">Coast width: <b>{theme.coastWidth}</b>
      <input type="range" min="0.5" max="4" step="0.1" bind:value={theme.coastWidth} oninput={ch} /></label>
    <label class="chk"><input type="checkbox" bind:checked={theme.paper} onchange={ch} /> Paper texture</label>

    <h3>Labels / pins</h3>
    <div class="grid">
      <label>Label color<input type="color" bind:value={theme.pin.labelColor} oninput={ch} /></label>
      <label class="chk2"><input type="checkbox" bind:checked={theme.pin.shadow} onchange={ch} /> shadow</label>
    </div>
    <label class="chk"><input type="checkbox" checked={useMono} onchange={toggleMono} /> Tint all pins one color</label>
    {#if useMono}
      <label class="full">Pin tint<input type="color" bind:value={theme.pin.monochrome} oninput={ch} /></label>
    {/if}

    <h3>Biome palette</h3>
    <div class="palette">
      {#each THEME_PALETTE_KEYS as key}
        <label class="sw">
          <input type="color" bind:value={theme.palette[key]} oninput={ch} />
          <span>{pretty(key)}</span>
        </label>
      {/each}
    </div>
  </div>
{/if}

<style>
  .builder { background: var(--panel-2); border-radius: 8px; padding: 10px; margin-top: 10px; }
  .hdr { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
  .hdr .name { flex: 1; font-weight: 600; }
  .hdr button { width: 32px; padding: 6px 0; }
  .grid { display: flex; gap: 8px; }
  .grid label { flex: 1; }
  label { display: block; font-size: 11px; color: var(--muted); margin: 6px 0 2px; }
  label.full { width: 100%; }
  input[type='color'] { width: 100%; height: 26px; padding: 0; border: 1px solid var(--line); border-radius: 5px; background: none; cursor: pointer; }
  input[type='text'] { font-size: 11px; }
  .rng { margin-top: 8px; }
  .rng b { color: var(--ink); }
  .chk, .chk2 { display: flex; align-items: center; gap: 6px; color: var(--ink); cursor: pointer; margin-top: 8px; }
  .chk2 { margin-top: 22px; }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--accent); margin: 14px 0 4px; }
  .palette { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 8px; max-height: 240px; overflow-y: auto; padding-right: 4px; }
  .sw { display: flex; align-items: center; gap: 6px; margin: 0; }
  .sw input[type='color'] { width: 30px; height: 22px; flex: 0 0 auto; }
  .sw span { font-size: 10px; color: var(--muted); line-height: 1.1; }
</style>
