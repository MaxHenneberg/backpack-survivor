export const PROGRESSION_STORAGE_KEY = 'neon-outrun-progression-v1';

// Add new permanent perks here; effects are applied by id in main.js.
export const META_PERKS = [
  { id: 'hull', name: 'Reinforced Chassis', icon: '⬡', description: 'Reinforced plating for longer runs.', costs: [50, 100, 175] },
  { id: 'damage', name: 'Overclocked Reactor', icon: 'ϟ', description: 'Boost bullet and beam damage.', costs: [60, 125, 200] },
  { id: 'cooldown', name: 'Targeting Matrix', icon: '◎', description: 'Shorter cooldowns for all weapons.', costs: [60, 125, 200] },
  { id: 'shield', name: 'Shield Capacitor', icon: '◇', description: 'Launch with a shield buffer.', costs: [40, 90, 160] },
  { id: 'thrusters', name: 'Vector Thrusters', icon: '↗', description: 'Fly faster through the district.', costs: [50, 110, 180] },
];

export function loadProgression(storage = globalThis.localStorage) {
  const empty = { credits: 100, perks: Object.fromEntries(META_PERKS.map(({ id }) => [id, 0])) };
  try {
    const saved = JSON.parse(storage?.getItem(PROGRESSION_STORAGE_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return empty;
    return {
      credits: Number.isFinite(saved.credits) ? Math.max(0, Math.floor(saved.credits)) : 0,
      perks: Object.fromEntries(META_PERKS.map(({ id, costs }) => { const level=saved.perks?.[id]; return [id, Number.isFinite(level)?Math.max(0,Math.min(costs.length,Math.floor(level))):0]; })),
    };
  } catch {
    return empty;
  }
}

export function saveProgression(progression, storage = globalThis.localStorage) {
  try { storage?.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify({credits:progression.credits,perks:progression.perks})); } catch { /* Progression still works for this session if storage is unavailable. */ }
}
