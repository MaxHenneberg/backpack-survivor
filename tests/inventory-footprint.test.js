import test from 'node:test';
import assert from 'node:assert/strict';
import { billboardBasis, lootSignGlyph, lootSignWorldCenter } from '../src/city3d.js';
import { ITEMS, advanceFootprintRotation, canPlace, cellsFor, footprintClipPath, footprintFor, footprintIconAnchor, footprintRenderAnchor, formatStatWithDelta, getWeaponStats, itemStateForFloorDrop, overlappingSameItems, placementOrigin, projectileFanAngles, restoreItemFromFloorDrop, rotateFootprint } from '../src/items.js';

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
  }
});

test('rotating the carried L through two and three turns keeps a render anchor in an occupied cell', () => {
  const orientations=[[[0,0],[1,0],[0,1]],[[1,0],[1,1],[0,0]],[[1,1],[0,1],[1,0]],[[0,1],[0,0],[1,1]]];
  let item={uid:'rotating-smg',itemId:'overdrive',x:-1,y:-1,rotation:0};
  for(let turns=1;turns<=3;turns++) {
    item=advanceFootprintRotation(item,1);
    const origin=placementOrigin(item,3,3),footprint=footprintFor(item);
    assert.equal(item.rotation,turns,`turn ${turns} advances by exactly 90 degrees`);
    assert.deepEqual(footprint,orientations[turns],`turn ${turns} keeps the expected L orientation`);
    assert.deepEqual(origin,{x:1,y:1},`turn ${turns} clamps the 2x2 bounding box to the grid edge`);
    const anchor=footprintRenderAnchor(footprint,origin.x,origin.y);
    assert.ok(cellsFor(item,origin.x,origin.y).some((cell)=>cell.x===anchor.x&&cell.y===anchor.y),`turn ${turns} render anchor must be occupied`);
    assert.ok(canPlace([item],item.uid,origin.x,origin.y),`turn ${turns} placement remains valid at the boundary`);
    const missing=[0,1].flatMap((y)=>[0,1].map((x)=>[x,y])).find(([x,y])=>!footprint.some(([fx,fy])=>fx===x&&fy===y));
    if(missing) {
      const notch={uid:'notch-passive',itemId:'hotCell',x:origin.x+missing[0],y:origin.y+missing[1]};
      assert.ok(canPlace([item,notch],item.uid,origin.x,origin.y),`turn ${turns} keeps the vacant notch independently placeable`);
    }
  }
  item=advanceFootprintRotation(item,1);
  assert.deepEqual(footprintFor(item),footprintFor({itemId:'overdrive',rotation:0}),'four turns return to the initial orientation');
});

test('item icons center on rectangular footprints and anchor to the top-left L cell', () => {
  const expectedLAnchors=[[.5,.5],[.5,.5],[1.5,.5],[.5,.5]];
  for(let rotation=0;rotation<4;rotation++) {
    const footprint=footprintFor({itemId:'overdrive',rotation});
    const anchor=footprintIconAnchor(footprint);
    assert.equal(anchor.shape,'irregular');
    assert.deepEqual([anchor.x,anchor.y],expectedLAnchors[rotation]);
  }
  assert.deepEqual(footprintIconAnchor(footprintFor({itemId:'pulseCarbine',rotation:0})),{x:1,y:.5,shape:'rectangle'});
  assert.deepEqual(footprintIconAnchor(footprintFor({itemId:'pulseCarbine',rotation:1})),{x:.5,y:1,shape:'rectangle'});
});

test('same-item upgrades detect any occupied-cell overlap across different rotations', () => {
  const existing={uid:'old',itemId:'overdrive',x:0,y:0,rotation:0,level:2};
  const incoming={uid:'new',itemId:'overdrive',x:-1,y:-1,rotation:1};
  const other={uid:'other',itemId:'hotCell',x:2,y:1};
  assert.deepEqual(overlappingSameItems([existing,other,incoming],incoming,1,0),[existing]);
  const different={uid:'different',itemId:'pulseCarbine',x:-1,y:-1,rotation:1};
  assert.deepEqual(overlappingSameItems([existing,different],different,1,0),[]);
});

test('loot holo sign basis faces the camera from each pickup position', () => {
  for(const center of [[0,320,0],[480,320,-240],[-350,320,610]]) {
    const camera=[120,1600,620],{right,up,normal}=billboardBasis(camera,center);
    const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
    const length=(v)=>Math.hypot(...v);
    const towardCamera=camera.map((value,index)=>value-center[index]);
    const normalized=towardCamera.map((value)=>value/length(towardCamera));
    assert.ok(Math.abs(length(right)-1)<1e-9);
    assert.ok(Math.abs(length(up)-1)<1e-9);
    assert.ok(Math.abs(dot(right,up))<1e-9);
    assert.ok(Math.abs(dot(normal,normalized)-1)<1e-9);
  }
});

test('holo sign uses distinct weapon, passive, repair, and shield symbols', () => {
  const weapon=lootSignGlyph({itemKind:'active',kind:'item'});
  const passive=lootSignGlyph({itemKind:'passive',kind:'item'});
  const repair=lootSignGlyph({itemKind:'consumable',kind:'kit',itemId:'repairKit'});
  const shield=lootSignGlyph({itemKind:'consumable',kind:'kit',itemId:'shieldKit'});
  assert.equal(new Set([weapon,passive,repair,shield].map((shape)=>JSON.stringify(shape))).size,4);
});

test('loot sign sits above the pickup beam target with a camera-facing offset', () => {
  const center=lootSignWorldCenter([0,1600,620],{x:0,y:0,pickupHeight:760,signHeight:1020});
  assert.equal(center[1],1020);
  assert.ok(Math.hypot(center[0],center[2])>50,'sign offset moves the plate clear of the beam column');
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
  const angles = projectileFanAngles(1, 3, .48);
  assert.equal(angles.length, 3);
  assert.ok(angles[0] < angles[1] && angles[1] < angles[2]);
  assert.equal(angles[1], 1);
  assert.ok(angles[2]-angles[0]>=.95,'additional missiles leave on a clearly separated fan');

  const weapon = { uid: 'gridfire', itemId: 'gridfireLauncher', x: 0, y: 0, level: 1 };
  const prism = { uid: 'prism', itemId: 'prism', x: 1, y: 0, level: 1 };
  const stats = getWeaponStats([weapon, prism], weapon);
  assert.equal(stats.projectiles, 2);
  assert.equal(ITEMS.gridfireLauncher.shot.turnDelay,.32,'missiles hold their launch angle briefly before homing');
});

test('displaced upgrades preserve level, rotation, and custom stats through floor pickup', () => {
  const original={uid:'leveled-gridfire',itemId:'gridfireLauncher',rarity:'legendary',level:7,rotation:3,stats:{damage:61,cooldown:920,projectiles:3},x:1,y:1};
  const drop={itemState:itemStateForFloorDrop(original),uid:'floor-upgrade',itemId:original.itemId,rarity:original.rarity};
  const restored=restoreItemFromFloorDrop(drop);
  assert.deepEqual({level:restored.level,rotation:restored.rotation,stats:restored.stats},{level:7,rotation:3,stats:{damage:61,cooldown:920,projectiles:3}});
  assert.deepEqual({uid:restored.uid,itemId:restored.itemId,rarity:restored.rarity,x:restored.x,y:restored.y},{uid:'floor-upgrade',itemId:'gridfireLauncher',rarity:'legendary',x:-1,y:-1});
});

test('weapon tooltip formats absolute passive stat deltas', () => {
  assert.equal(formatStatWithDelta(15,10,String),'15 (+5)');
  assert.equal(formatStatWithDelta(2,1,String),'2 (+1)');
  assert.equal(formatStatWithDelta(550,700,value=>(value/1000).toFixed(2)+'s'),'0.55s (−0.15s)');
  assert.equal(formatStatWithDelta(10,10,String),'10');
});
