import test from 'node:test';
import assert from 'node:assert/strict';
import { cellsFor, footprintClipPath, footprintFor, footprintOutlinePath, getWeaponStats, projectileFanAngles, rotateFootprint } from '../src/items.js';

test('Epic Overdrive keeps its three-cell L footprint through every rotation', () => {
  const expected = [
    [[0, 0], [1, 0], [0, 1]],
    [[1, 0], [1, 1], [0, 0]],
    [[1, 1], [0, 1], [1, 0]],
    [[0, 1], [0, 0], [1, 1]],
  ];

  for (let rotation = 0; rotation < 4; rotation++) {
    const item = { itemId: 'overdrive', x: 0, y: 0, rotation };
    assert.deepEqual(footprintFor(item), expected[rotation]);
    assert.equal(cellsFor(item).length, 3);
    const outline = footprintClipPath(footprintFor(item));
    assert.match(outline, /^polygon\(/);
    assert.equal((outline.match(/%/g) ?? []).length, 16, `rotation ${rotation} should trace all eight boundary segments`);
    const perimeter=footprintOutlinePath(footprintFor(item));
    const lineSegments=(perimeter.match(/\bL\b/g)??[]).length+(perimeter.endsWith(' Z')?1:0);
    assert.equal(lineSegments,8,`rotation ${rotation} should draw all eight exposed L-outline segments`);
  }
});

test('rotated item cards keep all occupied cells visible at backpack boundaries', () => {
  for (let rotation = 0; rotation < 4; rotation++) {
    const footprint = footprintFor({ itemId: 'overdrive', x: 0, y: 0, rotation });
    const width = Math.max(...footprint.map(([x]) => x)) + 1;
    const height = Math.max(...footprint.map(([, y]) => y)) + 1;
    const points = footprintClipPath(footprint).match(/\d+(?:\.\d+)?%/g).map((value) => Number.parseFloat(value));
    for (let index = 0; index < points.length; index += 2) {
      assert.ok(points[index] >= 0 && points[index] <= 100, `rotation ${rotation} x edge stays inside the card`);
      assert.ok(points[index + 1] >= 0 && points[index + 1] <= 100, `rotation ${rotation} y edge stays inside the card`);
    }
    assert.ok(width <= 2 && height <= 2);
  }
});

test('future footprint shapes normalize nonzero source offsets before every rotation', () => {
  const raw = [[3, 4], [4, 4], [3, 5]];
  const expected = [
    [[0, 0], [1, 0], [0, 1]],
    [[1, 0], [1, 1], [0, 0]],
    [[1, 1], [0, 1], [1, 0]],
    [[0, 1], [0, 0], [1, 1]],
  ];
  for (let rotation = 0; rotation < 4; rotation++) assert.deepEqual(rotateFootprint(raw, rotation), expected[rotation]);
});

test('Gridfire projectile fans remain distinct and passive projectile bonuses scale shots', () => {
  const angles = projectileFanAngles(1, 3, .3);
  assert.equal(angles.length, 3);
  assert.ok(angles[0] < angles[1] && angles[1] < angles[2]);
  assert.equal(angles[1], 1);

  const weapon = { uid: 'gridfire', itemId: 'gridfireLauncher', x: 0, y: 0, level: 1 };
  const prism = { uid: 'prism', itemId: 'prism', x: 1, y: 0, level: 1 };
  const stats = getWeaponStats([weapon, prism], weapon);
  assert.equal(stats.projectiles, 2);
});
