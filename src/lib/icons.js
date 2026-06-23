// Inline medieval-style marker glyphs (24x24 viewBox, use currentColor).
// Hand-built so there are no external asset fetches.

export const ICONS = {
  capital: `<path d="M3 8l3 3 3-5 3 5 3-5 3 5 3-3v9H3z" fill="currentColor"/><circle cx="12" cy="4" r="1.4" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/>`,
  city: `<rect x="3" y="9" width="4" height="11" fill="currentColor"/><rect x="9" y="5" width="5" height="15" fill="currentColor"/><rect x="16" y="11" width="4" height="9" fill="currentColor"/><rect x="10.5" y="2" width="2" height="3" fill="currentColor"/>`,
  town: `<path d="M4 11l8-6 8 6v9H4z" fill="currentColor"/><rect x="10" y="14" width="4" height="6" fill="#00000033"/>`,
  village: `<path d="M5 12l5-4 5 4v8H5z" fill="currentColor"/><rect x="14" y="13" width="5" height="7" fill="currentColor"/><rect x="8.5" y="15" width="3" height="5" fill="#00000033"/>`,
  castle: `<path d="M3 8h2V6h2v2h2V6h2v2h2V6h2v2h2V6h2v2h0v12H3z" fill="currentColor"/><rect x="10" y="13" width="4" height="7" fill="#00000033"/><rect x="5" y="11" width="2.5" height="2.5" fill="#00000033"/><rect x="16.5" y="11" width="2.5" height="2.5" fill="#00000033"/>`,
  tower: `<path d="M8 7h2V5h1v2h2V5h1v2h2v13H8z" fill="currentColor"/><rect x="10.5" y="13" width="3" height="7" fill="#00000033"/>`,
  port: `<circle cx="12" cy="4" r="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v13M6 13c0 4 3 6 6 6s6-2 6-6M8 9h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  temple: `<path d="M12 3l8 5H4z" fill="currentColor"/><rect x="5" y="8" width="2.5" height="9" fill="currentColor"/><rect x="11" y="8" width="2.5" height="9" fill="currentColor"/><rect x="17" y="8" width="2.5" height="9" fill="currentColor"/><rect x="3" y="17" width="18" height="3" fill="currentColor"/>`,
  mine: `<path d="M4 6c5 1 9 5 10 10M20 6c-5 1-9 5-10 10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="10.5" y="14" width="3" height="7" rx="1" fill="currentColor"/>`,
  ruins: `<rect x="4" y="9" width="2.5" height="11" fill="currentColor"/><rect x="10" y="6" width="2.5" height="14" fill="currentColor"/><rect x="15.5" y="11" width="2.5" height="9" fill="currentColor"/><rect x="3" y="18" width="17" height="2.5" fill="currentColor"/>`,
  forest: `<path d="M12 2l5 8h-3l3 6h-4v6h-2v-6H10l3-6H7z" fill="currentColor"/>`,
  mountain: `<path d="M2 20l6-12 4 6 3-5 7 11z" fill="currentColor"/><path d="M8 8l2.2 4-1.7 1L7 11z" fill="#ffffff66"/>`,
  camp: `<path d="M12 4l8 16H4z" fill="currentColor"/><path d="M12 4v16" stroke="#00000033" stroke-width="1.5"/><path d="M10.5 20l1.5-4 1.5 4z" fill="#00000055"/>`,
  poi: `<path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" fill="currentColor"/><circle cx="12" cy="9" r="2.6" fill="#ffffffaa"/>`,
};

// Display metadata + default colors for the toolbar.
export const PIN_TYPES = [
  { id: 'capital', label: 'Capital', color: '#d4af37' },
  { id: 'city', label: 'City', color: '#b5651d' },
  { id: 'town', label: 'Town', color: '#8a5a2b' },
  { id: 'village', label: 'Village', color: '#9c7a3c' },
  { id: 'castle', label: 'Castle', color: '#7a7a85' },
  { id: 'tower', label: 'Tower', color: '#6b6b76' },
  { id: 'port', label: 'Port', color: '#2f6f8f' },
  { id: 'temple', label: 'Temple', color: '#c9a227' },
  { id: 'mine', label: 'Mine', color: '#5a5a5a' },
  { id: 'ruins', label: 'Ruins', color: '#8a8170' },
  { id: 'forest', label: 'Forest', color: '#2f6b3a' },
  { id: 'mountain', label: 'Mountain', color: '#6e6256' },
  { id: 'camp', label: 'Camp', color: '#9b5b3b' },
  { id: 'poi', label: 'Marker', color: '#c0392b' },
];

export function iconSvg(type, size = 24) {
  const inner = ICONS[type] || ICONS.poi;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
