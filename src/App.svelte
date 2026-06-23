<script>
  import { onMount } from 'svelte';
  import Controls from './components/Controls.svelte';
  import MapView from './components/MapView.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import ToolOptions from './components/ToolOptions.svelte';
  import { regenerate, loadLocal } from './lib/store.svelte.js';

  onMount(() => {
    loadLocal();
    regenerate();
  });
</script>

<main>
  <Controls />
  <div class="stage">
    <Toolbar />
    <ToolOptions />
    <MapView />
  </div>
</main>

<style>
  main { display: flex; height: 100%; width: 100%; }
  .stage { position: relative; flex: 1; height: 100%; min-width: 0; }
</style>
