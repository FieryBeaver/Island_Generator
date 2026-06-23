// Biome classification & colors, inspired by redblobgames mapgen2's Whittaker table.
// Inputs are normalized 0..1: elevation (0 coast -> 1 peak), moisture, temperature.

export const BIOME_COLORS = {
  OCEAN: '#3d6a96',
  OCEAN_DEEP: '#2f5680',
  COAST: '#4a7aa8',
  LAKE: '#4a86b8',
  RIVER: '#3f7fb5',
  BEACH: '#d8cba0',

  SCORCHED: '#555555',
  BARE: '#888888',
  TUNDRA: '#bbbcac',
  SNOW: '#f4f6f6',

  TEMPERATE_DESERT: '#d2c79a',
  SHRUBLAND: '#8aa05a',
  TAIGA: '#6f8c5a',

  GRASSLAND: '#9cb35a',
  TEMPERATE_DECIDUOUS_FOREST: '#5f9f5a',
  TEMPERATE_RAIN_FOREST: '#4a8f63',

  SUBTROPICAL_DESERT: '#e0c896',
  TROPICAL_SEASONAL_FOREST: '#56a05a',
  TROPICAL_RAIN_FOREST: '#3f8f55',
};

// Classify a land cell. elevation/moisture/temperature in 0..1.
export function biomeFor(elevation, moisture, temperature) {
  // High elevation -> alpine zone regardless of latitude (colder up high).
  const temp = temperature - elevation * 0.55; // higher = colder

  if (elevation > 0.82) {
    if (moisture < 0.2) return 'SCORCHED';
    if (moisture < 0.4) return 'BARE';
    if (temp < 0.25) return 'SNOW';
    return 'TUNDRA';
  }

  if (temp < 0.18) {
    // cold band
    if (moisture < 0.3) return 'TUNDRA';
    return 'SNOW';
  }

  if (elevation > 0.6) {
    if (moisture < 0.33) return 'TEMPERATE_DESERT';
    if (moisture < 0.66) return 'SHRUBLAND';
    return 'TAIGA';
  }

  if (elevation > 0.3) {
    if (temp > 0.66) {
      if (moisture < 0.16) return 'SUBTROPICAL_DESERT';
      if (moisture < 0.5) return 'GRASSLAND';
      if (moisture < 0.83) return 'TROPICAL_SEASONAL_FOREST';
      return 'TROPICAL_RAIN_FOREST';
    }
    if (moisture < 0.16) return 'TEMPERATE_DESERT';
    if (moisture < 0.5) return 'GRASSLAND';
    if (moisture < 0.83) return 'TEMPERATE_DECIDUOUS_FOREST';
    return 'TEMPERATE_RAIN_FOREST';
  }

  // low land, near coast
  if (temp > 0.66) {
    if (moisture < 0.16) return 'SUBTROPICAL_DESERT';
    if (moisture < 0.5) return 'GRASSLAND';
    return 'TROPICAL_SEASONAL_FOREST';
  }
  if (moisture < 0.16) return 'TEMPERATE_DESERT';
  if (moisture < 0.5) return 'GRASSLAND';
  return 'TEMPERATE_DECIDUOUS_FOREST';
}

export function colorFor(biome) {
  return BIOME_COLORS[biome] || '#888';
}

// Biomes offered in the terrain paint tool.
export const PAINT_BIOMES = [
  ['GRASSLAND', 'Grassland'],
  ['TEMPERATE_DECIDUOUS_FOREST', 'Forest'],
  ['TROPICAL_RAIN_FOREST', 'Jungle'],
  ['TAIGA', 'Taiga'],
  ['SHRUBLAND', 'Shrubland'],
  ['SUBTROPICAL_DESERT', 'Desert'],
  ['TEMPERATE_DESERT', 'Steppe'],
  ['BEACH', 'Beach'],
  ['TUNDRA', 'Tundra'],
  ['SNOW', 'Snow'],
  ['BARE', 'Rock'],
  ['SCORCHED', 'Scorched'],
];
