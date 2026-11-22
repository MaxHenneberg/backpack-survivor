export const RARITIES = {
  common: { label: 'Common', color: '#b5c3d4', weight: 55, sellValue: 5 },
  rare: { label: 'Rare', color: '#59aaff', weight: 26, sellValue: 12 },
  epic: { label: 'Epic', color: '#c486ff', weight: 14, sellValue: 25 },
  legendary: { label: 'Legendary', color: '#ffbf58', weight: 5, sellValue: 50 },
};
export const ITEM_LEVEL_CAP = 10;

export const ITEMS = {
  arcPistol: { id: 'arcPistol', name: 'Arc Pistol', kind: 'active', shape: 'sidearm', rarity: 'common', color: '#b5c3d4', icon: '⌁', description: 'Fires a fast, accurate needle round at the nearest enemy.', cooldown: 700, shot: { style: 'needle', speed: 720, trail: 12, width: 2 }, base: { damage: 14, cooldown: 700, range: 300 }, footprint: [[0, 0]] },
  pulseCarbine: { id: 'pulseCarbine', name: 'Pulse Carbine', kind: 'active', shape: 'carbine', rarity: 'rare', color: '#59aaff', icon: '⌖', description: 'Fires a heavy pulse slug that hits harder at medium range.', cooldown: 1100, shot: { style: 'pulse', speed: 450, trail: 22, width: 4 }, base: { damage: 24, cooldown: 1100, range: 360 }, footprint: [[0, 0], [1, 0]] },
  heliosRay: { id: 'heliosRay', name: 'Helios Ray', kind: 'active', weaponType: 'beam', shape: 'beam', rarity: 'rare', color: '#5ef3e9', icon: '╱', description: 'Ticks a focused beam into the nearest target. Faster cooldown means faster damage ticks.', cooldown: 550, shot: { style: 'beam', width: 3 }, base: { damage: 10, cooldown: 550, range: 440 }, footprint: [[0, 0], [1, 0]] },
  overdrive: { id: 'overdrive', name: 'Overdrive SMG', kind: 'active', shape: 'smg', rarity: 'epic', color: '#c486ff', icon: 'ϟ', description: 'Sprays a tight three-round burst of quick bullets.', cooldown: 520, shot: { style: 'burst', speed: 600, trail: 9, width: 2, burstCount: 3, spread: .12 }, base: { damage: 8, cooldown: 520, range: 380 }, footprint: [[0, 0], [1, 0], [0, 1]] },
  railDriver: { id: 'railDriver', name: 'Rail Driver', kind: 'active', shape: 'railgun', rarity: 'legendary', color: '#ffbf58', icon: '╋', description: 'Sends a charged rail slug through up to three enemies.', cooldown: 1800, shot: { style: 'rail', speed: 880, trail: 34, width: 5, pierce: 2 }, base: { damage: 34, cooldown: 1800, range: 520 }, footprint: [[0, 0], [0, 1], [0, 2]] },
  novaLattice: { id: 'novaLattice', name: 'Nova Lattice', kind: 'active', weaponType: 'beam', shape: 'beam-array', rarity: 'legendary', color: '#ffbf58', icon: '✳', description: 'Splits into multiple damage-ticking beams. Extra projectiles add beams; cooldown speeds up their ticks.', cooldown: 820, shot: { style: 'beam', width: 4 }, base: { damage: 8, cooldown: 820, range: 560, projectiles: 2 }, footprint: [[0, 0], [0, 1], [0, 2]] },
  gridfireLauncher: { id: 'gridfireLauncher', name: 'Gridfire Launcher', kind: 'active', weaponType: 'projectile', shape: 'missile-pod', rarity: 'legendary', color: '#ffbf58', icon: '➤', description: 'Launches a homing missile that leaves a bright red trail along its flight path.', cooldown: 1650, shot: { style: 'homing', projectileColor: '#ff174f', speed: 360, trail: 110, width: 4, turnRate: 3.2 }, base: { damage: 38, cooldown: 1650, range: 620 }, footprint: [[0, 0], [0, 1], [1, 1]] },
  hotCell: { id: 'hotCell', name: 'Hot Cell', kind: 'passive', rarity: 'common', color: '#b5c3d4', icon: '▥', description: 'Next to a weapon: increases its damage.', adjacency: { stat: 'damage', multiplier: 1.28 }, footprint: [[0, 0]] },
  scope: { id: 'scope', name: 'Ghost Scope', kind: 'passive', rarity: 'rare', color: '#59aaff', icon: '◎', description: 'Next to a weapon: reduces its cooldown.', adjacency: { stat: 'cooldown', multiplier: 0.75 }, footprint: [[0, 0]] },
  prism: { id: 'prism', name: 'Split Prism', kind: 'passive', rarity: 'epic', color: '#c486ff', icon: '◇', description: 'Next to a weapon: adds projectiles or beams.', adjacency: { stat: 'projectiles', add: 1 }, footprint: [[0, 0]] },
  flux: { id: 'flux', name: 'Flux Capacitor', kind: 'passive', rarity: 'legendary', color: '#ffbf58', icon: '◈', description: 'Next to a weapon: increases its damage.', adjacency: { stat: 'damage', multiplier: 1.3 }, footprint: [[0, 0]] },
  repairKit: { id: 'repairKit', name: 'Repair Kit', kind: 'consumable', rarity: 'common', color: '#54d650', icon: '✚', description: 'Restores up to 30 health when used.' },
  shieldKit: { id: 'shieldKit', name: 'Shield Kit', kind: 'consumable', rarity: 'common', color: '#63dfff', icon: '⬡', description: 'Restores up to 50 shield when used.' },
};

// Pick rarity first, then an item from that rarity. Pool size never changes rarity odds.
export const RARITY_POOLS = {
  common: ['arcPistol', 'hotCell'],
  rare: ['pulseCarbine', 'heliosRay', 'scope'],
  epic: ['overdrive', 'prism'],
  legendary: ['railDriver', 'novaLattice', 'gridfireLauncher', 'flux'],
};

export const STARTING_ITEMS = [
  { uid: 'w-arc', itemId: 'arcPistol', x: 0, y: 0 },
  { uid: 'w-pulse', itemId: 'pulseCarbine', x: 1, y: 0 },
  { uid: 't-cell', itemId: 'hotCell', x: 0, y: 1 },
];

export const GRID = { width: 3, height: 3 };

export function rollLoot(random = Math.random) {
  const rarities = Object.keys(RARITIES);
  const weightTotal = rarities.reduce((total, rarity) => total + RARITIES[rarity].weight, 0);
  let ticket = random() * weightTotal;
  const rarity = rarities.find((key) => (ticket -= RARITIES[key].weight) < 0) ?? 'common';
  return rollLootFromRarity(rarity, random);
}

export function rollLootFromRarity(rarity, random = Math.random) {
  const pool = RARITY_POOLS[rarity];
  if (!pool) throw new RangeError(`Unknown loot rarity: ${rarity}`);
  return { itemId: pool[Math.floor(random() * pool.length)], rarity };
}

export function cellsFor(item, x = item.x, y = item.y) {
  return footprintFor(item).map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
}

export function footprintFor(item) {
  return rotateFootprint(ITEMS[item.itemId].footprint, item.rotation ?? 0);
}

export function normalizeFootprint(points) {
  if (!points.length) return [];
  const minX=Math.min(...points.map(([x])=>x)),minY=Math.min(...points.map(([,y])=>y));
  return points.map(([x,y])=>[x-minX,y-minY]);
}

export function rotateFootprint(footprint, rotations = 0) {
  let points=normalizeFootprint(footprint),turns=((Math.trunc(rotations)%4)+4)%4;
  for(let turn=0;turn<turns;turn++) {
    const height=Math.max(...points.map(([,y])=>y))+1;
    points=normalizeFootprint(points.map(([x,y])=>[height-1-y,x]));
  }
  return points;
}

export function footprintClipPath(footprint) {
  const occupied = new Set(footprint.map(([x, y]) => `${x},${y}`));
  const edges = [];
  const addEdge = (fromX, fromY, toX, toY) => edges.push({ from: [fromX, fromY], to: [toX, toY] });
  for (const [x, y] of footprint) {
    if (!occupied.has(`${x},${y - 1}`)) addEdge(x, y, x + 1, y);
    if (!occupied.has(`${x + 1},${y}`)) addEdge(x + 1, y, x + 1, y + 1);
    if (!occupied.has(`${x},${y + 1}`)) addEdge(x + 1, y + 1, x, y + 1);
    if (!occupied.has(`${x - 1},${y}`)) addEdge(x, y + 1, x, y);
  }
  if (!edges.length) return 'polygon(0 0)';
  const width = Math.max(...footprint.map(([x]) => x)) + 1;
  const height = Math.max(...footprint.map(([, y]) => y)) + 1;
  const pointKey = ([x, y]) => `${x},${y}`;
  const byStart = new Map(edges.map((edge) => [pointKey(edge.from), edge]));
  const first = edges.reduce((best, edge) => edge.from[1] < best.from[1] || edge.from[1] === best.from[1] && edge.from[0] < best.from[0] ? edge : best);
  const points = [first.from];
  let edge = first;
  for (let guard = 0; guard <= edges.length; guard++) {
    points.push(edge.to);
    if (pointKey(edge.to) === pointKey(first.from)) break;
    edge = byStart.get(pointKey(edge.to));
    if (!edge) break;
  }
  return `polygon(${points.slice(0, -1).map(([x, y]) => `${x / width * 100}% ${y / height * 100}%`).join(',')})`;
}

export function footprintOutlinePath(footprint) {
  const polygon=footprintClipPath(footprint),points=polygon.match(/\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%/g)??[];
  return points.map((point,index)=>{
    const [x,y]=point.match(/\d+(?:\.\d+)?/g).map(Number);
    return `${index?'L':'M'} ${x} ${y}`;
  }).join(' ')+' Z';
}

export function projectileFanAngles(angle, count, spread = .18) {
  const total = Math.max(1, Math.floor(count));
  return Array.from({ length: total }, (_, index) => angle + (index - (total - 1) / 2) * spread);
}

export function canPlace(items, uid, x, y) {
  const moving = items.find((item) => item.uid === uid);
  if (!moving || x < 0 || y < 0 || !Number.isInteger(x) || !Number.isInteger(y)) return false;
  const occupied = new Set(items.filter((item) => item.uid !== uid && item.x >= 0 && item.y >= 0).flatMap((item) => cellsFor(item).map(({ x: cx, y: cy }) => `${cx},${cy}`)));
  return cellsFor(moving, x, y).every(({ x: cx, y: cy }) => cx >= 0 && cy >= 0 && cx < GRID.width && cy < GRID.height && !occupied.has(`${cx},${cy}`));
}

export function canSwap(items, first, second) {
  if (!first || !second || first.x < 0 || first.y < 0 || second.x < 0 || second.y < 0) return false;
  const firstCells = cellsFor(first, second.x, second.y);
  const secondCells = cellsFor(second, first.x, first.y);
  const others = new Set(items.filter((item) => item.uid !== first.uid && item.uid !== second.uid && item.x >= 0 && item.y >= 0).flatMap((item) => cellsFor(item).map(({ x, y }) => `${x},${y}`)));
  const valid = (cells) => cells.every(({ x, y }) => x >= 0 && y >= 0 && x < GRID.width && y < GRID.height && !others.has(`${x},${y}`));
  const firstSet = new Set(firstCells.map(({ x, y }) => `${x},${y}`));
  return valid(firstCells) && valid(secondCells) && secondCells.every(({ x, y }) => !firstSet.has(`${x},${y}`));
}

export function adjacentTo(a, b) {
  const cellsA = cellsFor(a);
  const cellsB = cellsFor(b);
  return cellsA.some((ca) => cellsB.some((cb) => Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y) === 1));
}

export function getWeaponStats(items, weapon) {
  const level = Math.max(1, Math.min(ITEM_LEVEL_CAP, weapon.level ?? 1));
  const stats = { ...ITEMS[weapon.itemId].base, projectiles: ITEMS[weapon.itemId].base.projectiles ?? 1 };
  stats.damage *= 1 + (level - 1) * .1;
  stats.cooldown *= Math.max(.4, 1 - (level - 1) * .06);
  stats.projectiles += Math.floor((level - 1) / 3);
  for (const trinket of items) {
    const definition = ITEMS[trinket.itemId];
    if (trinket.x < 0 || !definition.adjacency || !adjacentTo(weapon, trinket)) continue;
    const passiveLevel = Math.max(1, Math.min(ITEM_LEVEL_CAP, trinket.level ?? 1));
    const adjacency = definition.adjacency;
    const effects = adjacency.stats ?? { [adjacency.stat]: adjacency.stat === 'damage' && adjacency.multiplier ? 1 + (adjacency.multiplier - 1) * (1 + (passiveLevel - 1) * .06) : adjacency.stat === 'cooldown' ? Math.max(.5, adjacency.multiplier - (passiveLevel - 1) * .025) : adjacency.multiplier };
    for (const [key, value] of Object.entries(effects)) {
      if (adjacency.add !== undefined && key === adjacency.stat) stats[key] = (stats[key] ?? 0) + adjacency.add + Math.floor((passiveLevel - 1) / 3);
      else if (definition.adjacency.add === undefined) stats[key] = (stats[key] ?? 0) * value;
    }
  }
  return stats;
}

export function getSynergies(items) {
  const placed = items.filter((item) => item.x >= 0 && item.y >= 0);
  return placed.filter((item) => ITEMS[item.itemId].adjacency).flatMap((passive) =>
    placed.filter((item) => ITEMS[item.itemId].kind === 'active' && adjacentTo(item, passive)).map((active) => ({
      id: `${active.uid}-${passive.uid}`,
      weapon: ITEMS[active.itemId],
      trinket: ITEMS[passive.itemId],
      bonus: ITEMS[passive.itemId].description,
    })),
  );
}
