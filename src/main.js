import Phaser from 'phaser';
import './style.css';
import { CityBackdrop } from './city3d.js';
import { ITEMS, GRID, ITEM_LEVEL_CAP, RARITIES, STARTING_ITEMS, adjacentTo, advanceFootprintRotation, canPlace, canSwap, cellsFor, footprintClipPath, footprintFor, footprintIconAnchor, footprintRenderAnchor, formatStatWithDelta, getWeaponStats, itemStateForFloorDrop, overlappingSameItems, placementOrigin, projectileFanAngles, restoreItemFromFloorDrop, rollLoot, rollLootFromRarity } from './items.js';
import { META_PERKS, loadProgression, saveProgression } from './progression.js';

const PLAYER_SHIELD_CAP=150;
const progression=loadProgression();
const state = { items: structuredClone(STARTING_ITEMS), health: 100, shield: 0, kills: 0, elapsed: 0, credits: progression.credits, perks: progression.perks, running: false, paused: false, inventoryPausedRun: false, selected: { x: 0, y: 0 }, carried: null, heldLoot: null, lootIndex: 0, backpackFocus: false, pointerDragging: false, pointerDragOffset: null, pointerId: null };
const gridNode = document.querySelector('#backpack-grid');
const tooltipNode = document.querySelector('#item-tooltip');
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const DRONE_FLIGHT_HEIGHT = 760;
const PASSIVE_ITEM_ICON = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 35 11.5v17L20 37 5 28.5v-17L20 3Z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="m20 11 8 4.5v9L20 29l-8-4.5v-9L20 11Z" fill="currentColor" opacity=".72"/><circle cx="20" cy="20" r="3" fill="#f4ffff"/></svg>';
const ACTIVE_ITEM_SVG = {
  sidearm: '<svg viewBox="0 0 48 36" aria-hidden="true"><path d="M4 10h23l5 4-3 8H17l-2 10H8l2-10H4z"/><path d="M27 11l4-5h10v4H32l-1 5z"/><path d="M7 8h15v2H7z" opacity=".55"/></svg>',
  carbine: '<svg viewBox="0 0 56 36" aria-hidden="true"><path d="M3 13h9l4-4h18l5 4h13v5H38l-3 5H18l-3-4H3z"/><path d="M38 12h15v2H38z"/><path d="M22 23h7l-2 9h-6z"/><path d="M7 11V7h6v6z" opacity=".7"/></svg>',
  smg: '<svg viewBox="0 0 48 36" aria-hidden="true"><path d="M5 12h12l4-4h12l4 5h7v8h-8l-4 4H18l-3-4H5z"/><path d="M30 10h12v2H30zM33 7h9v2h-9z"/><path d="M18 24h8l-2 9h-7z"/><path d="M6 10V6h7v6z" opacity=".7"/></svg>',
  railgun: '<svg viewBox="0 0 36 60" aria-hidden="true"><path d="M13 3h10v8h5v22h-4v12h-4v11h-4V45h-4V33h-4V11h5z"/><path d="M13 15h10v2H13zM13 22h10v2H13zM13 29h10v2H13z" opacity=".7"/><path d="M8 12h4v20H8zM24 12h4v20h-4z"/><path d="M15 4h6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  beam: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M21 4h6v24l-3 8-3-8z"/><path d="M12 12h5v18l-2.5 5-2.5-5zM31 12h5v18l-2.5 5-2.5-5z" opacity=".55"/><path d="M16 38h16l-3 5H19z"/></svg>',
  'beam-array': '<svg viewBox="0 0 44 56" aria-hidden="true"><path d="M20 3h4v48h-4z"/><path d="M8 13h4v31H8zM32 13h4v31h-4z" opacity=".65"/><path d="M4 10h12v3H4zM28 10h12v3H28zM16 3h12v3H16z"/><path d="M14 47h16l-3 6h-10z"/></svg>',
  'missile-pod': '<svg viewBox="0 0 48 56" aria-hidden="true"><path d="M15 4h18l5 7v24l-6 7H16l-6-7V11z"/><path d="M18 8h12v27H18z" opacity=".75"/><path d="M13 15H5v18l8 4M35 15h8v18l-8 4"/><path d="M16 42h16l-4 9H20z"/><path d="M21 13h6v15h-6z" fill="#f2ffff" opacity=".65"/><path d="M10 18h4v12h-4zM34 18h4v12h-4z" opacity=".8"/></svg>',
};

class Undercity extends Phaser.Scene {
  constructor() { super('undercity'); this.enemies = []; this.shots = []; this.enemyShots = []; this.floorLoot = []; this.nearbyLoot = null; this.lastShot = new Map(); this.combatNow = 0; this.gamepadDelay = 0; }
  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.paintDistrict();
    this.player = this.add.container(0, 0);
    this.game.canvas.tabIndex = 0;
    this.game.canvas.setAttribute('aria-label', 'Flying drone game. Use WASD to fly.');
    document.querySelector('#game').addEventListener('pointerdown', () => { state.backpackFocus = false; if (gridNode.contains(document.activeElement)) document.activeElement.blur(); });
    this.addPlayer();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ESC,E');
    this.physics.world.setBounds(-100000, -100000, 200000, 200000);
    this.physics.world.enable(this.player);
    this.player.body.setCircle(14, -14, -14);
    this.player.setPosition(0, 0);
    this.motion = { x: 0, y: 0 };
    this.cameras.main.setBounds(-100000, -100000, 200000, 200000).startFollow(this.player, true, .075, .075);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spawnTimer = this.time.addEvent({ delay: 1400, loop: true, callback: () => { if (state.running && !state.paused) this.spawnEnemy(); } });
    this.events.on('resume-run', () => { this.addWaveEnemies(); });
    this.addWaveEnemies();
  }
  paintDistrict() { this.cityBackdrop = new CityBackdrop(document.querySelector('#game'), this.game.canvas); }
  drawBlock(g, x, y, color) {
    g.fillStyle(0x050812, .5); g.fillRoundedRect(x - 10, y + 28, 100, 74, 12);
    g.fillStyle(color, 1); g.fillPoints([{ x, y: y + 13 }, { x: x + 31, y }, { x: x + 82, y: y + 9 }, { x: x + 82, y: y + 69 }, { x: x + 47, y: y + 82 }, { x, y: y + 70 }], true);
    g.fillStyle(0x394357, .9); g.fillPoints([{ x, y: y + 13 }, { x: x + 31, y }, { x: x + 82, y: y + 9 }, { x: x + 49, y: y + 23 }], true);
    g.lineStyle(2, 0xff4baf, .55); g.beginPath(); g.moveTo(x + 14, y + 49); g.lineTo(x + 47, y + 58); g.strokePath();
  }
  addPlayer() {
    this.droneVisual = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, 15, 52, 25, 0x14d6da, .22); this.player.add(shadow);
    const g = this.add.graphics();
    g.lineStyle(5, 0x26354c, 1); g.lineBetween(-8, -5, -22, -17); g.lineBetween(8, -5, 22, -17); g.lineBetween(-8, 5, -22, 17); g.lineBetween(8, 5, 22, 17);
    for (const [x, y, color] of [[-23, -18, 0x43f0e3], [23, -18, 0xff63c7], [-23, 18, 0xff63c7], [23, 18, 0x43f0e3]]) {
      g.fillStyle(color, .14); g.fillCircle(x, y, 11); g.lineStyle(2, color, .9); g.strokeCircle(x, y, 9); g.fillStyle(0x26344a, 1); g.fillTriangle(x - 7, y, x + 7, y - 2, x + 4, y + 2);
    }
    g.fillStyle(0x111b2b, 1); g.fillPoints([{ x: -14, y: -9 }, { x: -7, y: -17 }, { x: 8, y: -15 }, { x: 15, y: -4 }, { x: 12, y: 10 }, { x: 0, y: 16 }, { x: -13, y: 9 }], true);
    g.fillStyle(0x2fe3de, 1); g.fillPoints([{ x: -9, y: -7 }, { x: -4, y: -13 }, { x: 6, y: -11 }, { x: 10, y: -3 }, { x: 7, y: 7 }, { x: -1, y: 11 }, { x: -9, y: 5 }], true);
    g.fillStyle(0xff70c7, .95); g.fillPoints([{ x: -4, y: -12 }, { x: 6, y: -10 }, { x: 9, y: -3 }, { x: -6, y: -5 }], true);
    g.fillStyle(0xffffff, .95); g.fillCircle(1, -6, 2.3); g.fillStyle(0x36f4dc, 1); g.fillCircle(-1, 8, 2.5);
    this.droneVisual.add(g);
    this.rotors = [];
    for (const [rx, ry] of [[-23, -18], [23, -18], [-23, 18], [23, 18]]) {
      const rotor = this.add.graphics(); rotor.lineStyle(2, 0xd6ffff, .9); rotor.lineBetween(-6, 0, 6, 0); rotor.lineStyle(1, 0xffffff, .8); rotor.lineBetween(0, -2, 0, 2); rotor.setPosition(rx, ry); this.droneVisual.add(rotor); this.rotors.push(rotor);
      this.tweens.add({ targets: rotor, angle: 360, duration: 130, repeat: -1, ease: 'Linear' });
    }
    this.player.add(this.droneVisual);
    this.playerShieldVisual = this.add.graphics();
    this.droneVisual.add(this.playerShieldVisual);
    this.tweens.add({ targets: this.droneVisual, y: -3, duration: 430, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }
  updatePlayerShieldVisual() {
    const shield=this.playerShieldVisual;
    if(!shield)return;
    shield.clear();
    if(state.shield<=0)return;
    const time=this.time.now/1000,ratio=clamp(state.shield/PLAYER_SHIELD_CAP,0,1),radius=34+Math.sin(time*4)*1.5,pulse=.72+Math.sin(time*5)*.12;
    shield.fillStyle(0x36c9ff,.045+ratio*.04);shield.fillCircle(0,0,radius);
    shield.lineStyle(13,0x35bfff,.07+ratio*.08);shield.strokeCircle(0,0,radius);
    shield.lineStyle(1,0x62dfff,.24);shield.strokeCircle(0,0,radius-6);
    for(let arc=0;arc<6;arc++){
      const start=time*.82+arc*Math.PI/3+.14,end=start+.58,steps=8;
      shield.lineStyle(3,0x55d9ff,pulse);
      for(let step=0;step<steps;step++){const a=start+(end-start)*step/steps,b=start+(end-start)*(step+1)/steps;shield.lineBetween(Math.cos(a)*radius,Math.sin(a)*radius,Math.cos(b)*radius,Math.sin(b)*radius);}
      const nodeAngle=end,nodeX=Math.cos(nodeAngle)*radius,nodeY=Math.sin(nodeAngle)*radius;
      shield.fillStyle(0xc9fbff,.72);shield.fillCircle(nodeX,nodeY,1.7);
    }
  }
  animateShieldDamage() {
    const flash=this.add.circle(0,0,24,0x7beaff,.28);flash.setStrokeStyle(3,0xcdfaff,.95);this.droneVisual.add(flash);
    this.tweens.add({targets:flash,scale:1.65,alpha:0,duration:240,ease:'Cubic.Out',onComplete:()=>flash.destroy()});
    for(let index=0;index<5;index++){
      const angle=index*Math.PI*2/5+this.time.now*.01,spark=this.add.circle(Math.cos(angle)*27,Math.sin(angle)*27,2.4,0xe5fdff,.98);this.droneVisual.add(spark);
      this.tweens.add({targets:spark,x:Math.cos(angle)*46,y:Math.sin(angle)*46,scale:.2,alpha:0,duration:180+index*16,ease:'Cubic.Out',onComplete:()=>spark.destroy()});
    }
  }
  addWaveEnemies() { if (!state.running) return; for (let i = 0; i < 4 + Math.floor(state.elapsed / 45); i++) this.spawnEnemy(true); }
  spawnEnemy(initial = false) {
    if (!state.running || state.paused || this.enemies.length > 32) return;
    const angle = Math.random() * Math.PI * 2, distance = initial ? 290 + Math.random() * 260 : 500;
    const x = this.player.x + Math.cos(angle) * distance, y = this.player.y + Math.sin(angle) * distance;
    const roll=Math.random(),type=roll<.18?'rusher':roll<.3?'weaver':'gunner';
    const color = type === 'rusher' ? 0xff557d : type==='weaver'?0x8d7cff:0xffa257;
    const root = this.add.container(x, y);
    const shadow = this.add.ellipse(0, 14, 36, 16, color, .18); root.add(shadow);
    const g = this.add.graphics(); g.lineStyle(3, 0x333149, 1); g.lineBetween(-5, -3, -16, -12); g.lineBetween(5, -3, 16, -12); g.lineBetween(-5, 3, -16, 12); g.lineBetween(5, 3, 16, 12);
    for (const [rx, ry] of [[-17, -13], [17, -13], [-17, 13], [17, 13]]) { g.fillStyle(color, .15); g.fillCircle(rx, ry, 7); g.lineStyle(1.5, color, .9); g.strokeCircle(rx, ry, 6); g.fillStyle(0x30263b, 1); g.fillEllipse(rx, ry, 8, 3); }
    g.fillStyle(0x27253a, 1); g.fillPoints([{ x: -9, y: -6 }, { x: -5, y: -10 }, { x: 6, y: -9 }, { x: 10, y: -2 }, { x: 8, y: 7 }, { x: -2, y: 10 }, { x: -10, y: 4 }], true);
    g.fillStyle(color, 1); g.fillPoints([{ x: -5, y: -4 }, { x: 0, y: -7 }, { x: 6, y: -3 }, { x: 5, y: 4 }, { x: -2, y: 6 }, { x: -6, y: 2 }], true);
    if (type === 'gunner') {
      g.fillStyle(0xffd18a, .95); g.fillRoundedRect(-9, -17, 5, 10, 2); g.fillRoundedRect(4, -17, 5, 10, 2);
      g.fillStyle(0xfff2cf, .9); g.fillCircle(-6.5, -17, 2); g.fillCircle(6.5, -17, 2);
    } else if(type==='rusher') {
      g.fillStyle(0xff9cad, 1); g.fillPoints([{ x: -7, y: -5 }, { x: 0, y: -19 }, { x: 7, y: -5 }], true);
      g.lineStyle(2, 0xffd1dc, .95); g.lineBetween(-3, -6, 0, -14); g.lineBetween(3, -6, 0, -14);
    } else {
      g.lineStyle(3,0xc7b6ff,.95); g.lineBetween(-11,-5,-17,-17); g.lineBetween(0,-8,0,-24); g.lineBetween(11,-5,17,-17);
      g.fillStyle(0xe1d8ff,1); g.fillTriangle(-19,-18,-15,-25,-12,-17); g.fillTriangle(-3,-24,0,-31,3,-24); g.fillTriangle(12,-17,15,-25,19,-18);
      g.lineStyle(2,0xdccfff,.9); g.lineBetween(-8,8,0,13); g.lineBetween(0,13,8,8);
    }
    g.fillStyle(0xfff3d9, 1); g.fillCircle(1, -1, 2); root.add(g);
    for (const [rx, ry] of [[-17, -13], [17, -13], [-17, 13], [17, 13]]) {
      const blade = this.add.graphics(); blade.lineStyle(2, 0xffe5e8, .9); blade.lineBetween(-5, 0, 5, 0); blade.lineStyle(1, 0xffffff, .8); blade.lineBetween(0, -2, 0, 2); blade.setPosition(rx, ry); root.add(blade);
      this.tweens.add({ targets: blade, angle: 360, duration: 115, repeat: -1, ease: 'Linear' });
    }
    const maxHp = (type === 'rusher' ? 25 : type==='weaver'?32:34) + Math.floor(state.elapsed / 24) * 4;
    const hpBar = this.add.container(0, -34); hpBar.setVisible(false);
    const frame = this.add.graphics(); frame.fillStyle(0x06111b, .96); frame.fillRoundedRect(-24, -5, 48, 10, 2); frame.lineStyle(1, 0x60748a, .9); frame.strokeRoundedRect(-24, -5, 48, 10, 2); hpBar.add(frame);
    const hpFill = this.add.graphics(), shieldFill = this.add.graphics(); hpBar.add(shieldFill); hpBar.add(hpFill);
    const ticks = this.add.graphics(); ticks.lineStyle(1, 0x07121b, .85); for(let tick=1;tick<6;tick++) ticks.lineBetween(-19+tick*6.3,-3,-19+tick*6.3,3); hpBar.add(ticks);
    root.add(hpBar);
    const shieldChance=.12+.46*Math.min(1,state.elapsed/300),maxShield=Math.random()<shieldChance?Math.ceil(maxHp*(.35+Math.random()*.25)):0;
    const shieldVisual=this.add.graphics();
    if(maxShield>0){shieldVisual.fillStyle(0x36c9ff,.06);shieldVisual.fillCircle(0,0,27);shieldVisual.lineStyle(10,0x35bfff,.12);shieldVisual.strokeCircle(0,0,27);shieldVisual.lineStyle(1.7,0x82eaff,.84);for(let side=0;side<6;side++){const a=side*Math.PI/3,b=(side+1)*Math.PI/3;shieldVisual.lineBetween(Math.cos(a)*27,Math.sin(a)*27,Math.cos(b)*27,Math.sin(b)*27);}shieldVisual.lineStyle(1,0x82eaff,.32);shieldVisual.strokeCircle(0,0,21);}
    else shieldVisual.setVisible(false);
    root.add(shieldVisual);
    const speed=type==='rusher'?132+Math.random()*28:type==='weaver'?56+Math.random()*8:32+Math.random()*16;
    root.setData({ hp: maxHp, maxHp, hpBar, hpFill, damaged: false, shield:maxShield,maxShield,shieldFill,shieldVisual,type,speed,fireTimer:1+Math.random()*1.6,strafe:Math.random()<.5?-1:1,color,phase:Math.random()*6.28 }); this.enemies.push(root);
  }
  update(_, delta) {
    this.updateController();
    this.updateCooldownClocks();
    this.updatePlayerShieldVisual();
    const camera = this.cameras.main;
    const centerX = camera.scrollX + camera.width / 2, centerY = camera.scrollY + camera.height / 2;
    this.cityBackdrop.setLoot(this.floorLoot);
    this.cityBackdrop.update(centerX, centerY, delta);
    this.updateLootProjection();
    if (!state.running || state.paused) return;
    const dt = Math.min(delta, 40) / 1000;
    this.combatNow += dt * 1000;
    state.elapsed += dt;
    const remaining = Math.max(0, 300 - Math.floor(state.elapsed));
    document.querySelector('#objective').textContent = `EVAC IN ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    document.querySelector('#wave-count').textContent = String(1 + Math.floor(state.elapsed / 40)).padStart(2, '0');
    if (state.elapsed >= 300) { finishRun(true); return; }
    this.movePlayer(dt);
    this.updateFloorLoot();
    if (state.paused) return;
    this.updateEnemies(dt);
    this.updateEnemyShots(dt);
    this.fireWeapons();
    this.updateShots(dt);
    if (state.health <= 0) finishRun(false);
  }
  updateCooldownClocks() {
    for (const clock of gridNode.querySelectorAll('.cooldown-clock[data-uid]')) {
      const item = state.items.find((entry) => entry.uid === clock.dataset.uid);
      if (!item) continue;
      const cooldown = getEffectiveWeaponStats(state.items, item).cooldown;
      const nextShotAt = this.lastShot.get(item.uid) ?? this.combatNow;
      const remaining = Math.max(0, nextShotAt - this.combatNow);
      const fraction = cooldown > 0 ? Math.min(1, remaining / cooldown) : 0;
      clock.style.setProperty('--cooldown-left', `${fraction * 100}%`);
      clock.style.setProperty('--clock-angle', `${fraction * 360}deg`);
      clock.classList.toggle('is-cooling', remaining > 0);
    }
  }
  updateLootProjection() {
    for (const loot of this.floorLoot) {
      const point = this.cityBackdrop.projectLootSign(loot);
      loot.screenX = point.x; loot.screenY = point.y;
    }
  }
  movePlayer(dt) {
    let x = 0, y = 0;
    if (this.keys.A.isDown || this.cursors.left.isDown) x--; if (this.keys.D.isDown || this.cursors.right.isDown) x++;
    if (this.keys.W.isDown || this.cursors.up.isDown) y--; if (this.keys.S.isDown || this.cursors.down.isDown) y++;
    const pad = this.input.gamepad?.getPad(0);
    if (pad && !state.backpackFocus) {
      const px = pad.leftStick.x, py = pad.leftStick.y;
      if (Math.abs(px) > .18) x = px; if (Math.abs(py) > .18) y = py;
    }
    const length = Math.hypot(x, y) || 1, movementSpeed=260*(1+perkLevel('thrusters')*.06), desiredX = x / length * movementSpeed, desiredY = y / length * movementSpeed;
    const response = 1 - Math.exp(-(x || y ? 3.8 : 1.45) * dt);
    this.motion.x += (desiredX - this.motion.x) * response; this.motion.y += (desiredY - this.motion.y) * response;
    this.player.x += this.motion.x * dt; this.player.y += this.motion.y * dt;
    const speed = Math.hypot(this.motion.x, this.motion.y);
    if (speed > 5) this.droneVisual.rotation = Phaser.Math.Angle.RotateTo(this.droneVisual.rotation, Math.atan2(this.motion.y, this.motion.x) + Math.PI / 2, 2.7 * dt);
    this.droneVisual.x = clamp(-this.motion.x * .012, -3, 3);
  }
  updateController() {
    const pad = this.input.gamepad?.getPad(0);
    if (pad) {
      const buttonDown = (index) => Boolean(pad.buttons?.[index]?.pressed);
      if(!state.running) {
        const hangar=document.querySelector('#hangar-screen'),controls=[...hangar.querySelectorAll('button:not(:disabled)')];
        const horizontal=buttonDown(14)?-1:buttonDown(15)?1:Math.abs(pad.leftStick.x)>.55?Math.sign(pad.leftStick.x):0;
        const vertical=buttonDown(12)?-1:buttonDown(13)?1:Math.abs(pad.leftStick.y)>.55?Math.sign(pad.leftStick.y):0;
        if((horizontal||vertical)&&controls.length&&this.time.now>=this.gamepadDelay) {
          const current=controls.indexOf(document.activeElement),step=horizontal<0||vertical<0?-1:1,index=current<0?(step>0?0:controls.length-1):clamp(current+step,0,controls.length-1);
          controls[index]?.focus();this.gamepadDelay=this.time.now+175;
        }
        if(buttonDown(0)&&!this.padConfirmWasDown){this.padConfirmWasDown=true;const focused=document.activeElement;if(hangar.contains(focused)&&focused.matches('button:not(:disabled)'))focused.click();else document.querySelector('#start-button').click();}
        if(!buttonDown(0))this.padConfirmWasDown=false;
        return;
      }
      const dpadX = buttonDown(14) ? -1 : buttonDown(15) ? 1 : 0, dpadY = buttonDown(12) ? -1 : buttonDown(13) ? 1 : 0;
      const stickX = Math.abs(pad.leftStick.x) > .55 ? Math.sign(pad.leftStick.x) : 0, stickY = Math.abs(pad.leftStick.y) > .55 ? Math.sign(pad.leftStick.y) : 0;
      if (dpadX || dpadY || state.backpackFocus && (stickX || stickY)) {
        state.backpackFocus = true;
        const direction = [stickX || dpadX, stickY || dpadY];
        const pressed = direction[0] !== 0 || direction[1] !== 0;
        if (pressed && this.time.now >= this.gamepadDelay) { moveGrid(...direction); this.gamepadDelay = this.time.now + 175; }
      }
      if (buttonDown(0) && !this.padConfirmWasDown) {
        this.padConfirmWasDown = true;
        if (state.carried) handleBackpackConfirm();
        else if (this.nearbyLoot && !state.heldLoot) this.pickUpFloorLoot(this.nearbyLoot);
        else if (state.backpackFocus) handleBackpackConfirm();
      }
      if (!buttonDown(0)) this.padConfirmWasDown = false;
      if (buttonDown(2) && !this.padSellWasDown) { this.padSellWasDown = true; if (state.carried && state.heldLoot !== state.carried) sellCarriedInventoryItem(); else if (this.nearbyLoot && !state.carried) this.sellFloorLoot(this.nearbyLoot); }
      if (!buttonDown(2)) this.padSellWasDown = false;
      if (state.carried && buttonDown(4) && !this.padRotateLeftWasDown) { this.padRotateLeftWasDown = true; rotateCarried(-1); }
      if (!buttonDown(4)) this.padRotateLeftWasDown = false;
      if (state.carried && buttonDown(5) && !this.padRotateRightWasDown) { this.padRotateRightWasDown = true; rotateCarried(1); }
      if (!buttonDown(5)) this.padRotateRightWasDown = false;
      if (buttonDown(1) && !this.padCancelWasDown) { this.padCancelWasDown = true; cancelCarried(); }
      if (!buttonDown(1)) this.padCancelWasDown = false;
      if (buttonDown(3) && !this.padModeWasDown) { this.padModeWasDown = true; if (state.backpackFocus) returnFocusToGame(); else { state.backpackFocus = true; focusSelectedCell(); } showToast(state.backpackFocus ? 'BACKPACK CONTROL' : 'CHARACTER CONTROL'); }
      if (!buttonDown(3)) this.padModeWasDown = false;
    }
  }
  updateEnemies(dt) {
    for (const enemy of [...this.enemies]) {
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      const drift = enemy.getData('phase'),type=enemy.getData('type'),distanceBefore=Phaser.Math.Distance.Between(enemy.x,enemy.y,this.player.x,this.player.y);
      const speed=enemy.getData('speed');
      if(type==='rusher') {
        enemy.x+=(Math.cos(angle)*speed+Math.sin(state.elapsed*3+drift)*8)*dt;
        enemy.y+=(Math.sin(angle)*speed+Math.cos(state.elapsed*2.7+drift)*8)*dt;
      } else if(type==='weaver') {
        const radial=distanceBefore>230?1:distanceBefore<130?-.25:0;
        const orbit=speed*.38*enemy.getData('strafe');
        enemy.x+=(Math.cos(angle)*speed*radial+Math.cos(angle+Math.PI/2)*orbit)*dt;
        enemy.y+=(Math.sin(angle)*speed*radial+Math.sin(angle+Math.PI/2)*orbit)*dt;
      } else {
        const radial=distanceBefore>285?1:distanceBefore<175?-.58:.04;
        const strafe=Math.sin(state.elapsed*1.15+drift)*speed*.58*enemy.getData('strafe');
        enemy.x+=(Math.cos(angle)*speed*radial+Math.cos(angle+Math.PI/2)*strafe)*dt;
        enemy.y+=(Math.sin(angle)*speed*radial+Math.sin(angle+Math.PI/2)*strafe)*dt;
      }
      enemy.rotation = Phaser.Math.Angle.RotateTo(enemy.rotation, angle + Math.PI / 2, 2.5 * dt);
      enemy.list[1].y = Math.sin(state.elapsed * 3.3 + drift) * 3;
      enemy.list[0].y = Math.sin(state.elapsed * 3.3 + drift) * 3 + 13;
      const hpBar=enemy.getData('hpBar'), hpFill=enemy.getData('hpFill'),shieldFill=enemy.getData('shieldFill'),shieldVisual=enemy.getData('shieldVisual');
      hpBar.rotation=-enemy.rotation;
      const hp=enemy.getData('hp'),maxHp=enemy.getData('maxHp'),shield=enemy.getData('shield'),maxShield=enemy.getData('maxShield'),total=maxHp+maxShield;
      hpBar.setVisible(enemy.getData('damaged')||shield>0);
      shieldFill.clear();hpFill.clear();
      const shieldWidth=total>0?38*shield/total:0,hpWidth=total>0?38*hp/total:0,healthRatio=clamp(hp/maxHp,0,1),healthTint=healthRatio>.55?0x4be8da:healthRatio>.25?0xffc566:0xff587d;
      if(shieldWidth>0){shieldFill.fillStyle(0x36bfff,1);shieldFill.fillRoundedRect(-19,-2,shieldWidth,4,1);}
      if(hpWidth>0){hpFill.fillStyle(healthTint,1);hpFill.fillRoundedRect(-19+shieldWidth,-2,hpWidth,4,1);}
      if(maxShield>0){const shieldRatio=clamp(shield/maxShield,0,1);shieldVisual.setVisible(shield>0);shieldVisual.rotation=-enemy.rotation+state.elapsed*.65;shieldVisual.setAlpha(.58+shieldRatio*.28+Math.sin(state.elapsed*4+enemy.getData('phase'))*.1);}
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      if(type==='gunner') {
        const fireTimer=enemy.getData('fireTimer')-dt;
        if(distance<430&&fireTimer<=0) {
          this.fireEnemyShot(enemy,Phaser.Math.Angle.Between(enemy.x,enemy.y,this.player.x,this.player.y));
          enemy.setData('fireTimer',2.2+Math.random()*1.0);
        } else enemy.setData('fireTimer',fireTimer);
        if(distance<28) this.hurtPlayer(4*dt);
      } else if(type==='weaver') {
        const fireTimer=enemy.getData('fireTimer')-dt;
        if(distance<510&&fireTimer<=0) {
          const aim=Phaser.Math.Angle.Between(enemy.x,enemy.y,this.player.x,this.player.y);
          for(const offset of [-.24,0,.24]) this.fireEnemyShot(enemy,aim+offset);
          enemy.setData('fireTimer',4.2+Math.random()*.8);
        } else enemy.setData('fireTimer',fireTimer);
      } else if(distance<38) {
        this.hurtPlayer(14);
        this.destroyEnemy(enemy);
        continue;
      }
      if (enemy.getData('hp') <= 0) {
        this.destroyEnemy(enemy);
      }
    }
  }
  destroyEnemy(enemy) {
    if(!enemy.active) return;
    const deathX=enemy.x,deathY=enemy.y;
    this.explodeDrone(enemy);this.clearEnemyShotsFrom(enemy);enemy.destroy();
    const index=this.enemies.indexOf(enemy);if(index>=0)this.enemies.splice(index,1);
    state.kills++;document.querySelector('#kill-count').textContent=String(state.kills).padStart(2,'0');
    if(Math.random()<.08)this.dropKit(deathX,deathY);
    if(state.kills%5===0)this.dropLoot(deathX,deathY);
  }
  fireEnemyShot(enemy,angle) {
    const x=enemy.x+Math.cos(angle)*20,y=enemy.y+Math.sin(angle)*20;
    const tint=enemy.getData('color');
    const graphic=this.add.graphics().setDepth(14);
    this.enemyShots.push({owner:enemy,x,y,vx:Math.cos(angle),vy:Math.sin(angle),speed:215,damage:4,life:3.2,color:tint,graphic});
    const muzzle=this.add.circle(x,y,7,tint,.65).setDepth(13);
    this.tweens.add({targets:muzzle,scale:2.2,alpha:0,duration:130,ease:'Cubic.Out',onComplete:()=>muzzle.destroy()});
  }
  updateEnemyShots(dt) {
    for(const shot of [...this.enemyShots]) {
      shot.x+=shot.vx*shot.speed*dt; shot.y+=shot.vy*shot.speed*dt; shot.life-=dt;
      if(Phaser.Math.Distance.Between(shot.x,shot.y,this.player.x,this.player.y)<20) {
        this.hurtPlayer(shot.damage); shot.graphic.destroy(); this.enemyShots.splice(this.enemyShots.indexOf(shot),1); continue;
      }
      if(shot.life<=0||Phaser.Math.Distance.Between(shot.x,shot.y,this.player.x,this.player.y)>680) {
        shot.graphic.destroy(); this.enemyShots.splice(this.enemyShots.indexOf(shot),1); continue;
      }
      shot.graphic.clear();
      shot.graphic.lineStyle(7,shot.color,.16); shot.graphic.lineBetween(shot.x-shot.vx*18,shot.y-shot.vy*18,shot.x,shot.y);
      shot.graphic.lineStyle(2.5,shot.color,.82); shot.graphic.lineBetween(shot.x-shot.vx*10,shot.y-shot.vy*10,shot.x,shot.y);
      shot.graphic.fillStyle(0xfff1ce,1); shot.graphic.fillCircle(shot.x,shot.y,3.6);
    }
  }
  clearEnemyShots() { for(const shot of this.enemyShots) shot.graphic.destroy(); this.enemyShots.length=0; }
  clearEnemyShotsFrom(enemy) {
    for(const shot of this.enemyShots.filter((entry)=>entry.owner===enemy)) {
      shot.graphic.destroy();
      this.enemyShots.splice(this.enemyShots.indexOf(shot),1);
    }
  }
  explodeDrone(enemy) {
    const tint=enemy.getData('color'), flash=this.add.circle(enemy.x,enemy.y,9,0xe9ffff,.95).setDepth(80);
    const ring=this.add.circle(enemy.x,enemy.y,7,0,0).setDepth(79); ring.setStrokeStyle(2,tint,.9);
    const core=this.add.circle(enemy.x,enemy.y,11,tint,.36).setDepth(78);
    this.tweens.add({targets:flash,scale:2.2,alpha:0,duration:130,ease:'Cubic.Out',onComplete:()=>flash.destroy()});
    this.tweens.add({targets:core,scale:3.4,alpha:0,duration:210,ease:'Cubic.Out',onComplete:()=>core.destroy()});
    this.tweens.add({targets:ring,scale:4.8,alpha:0,duration:270,ease:'Cubic.Out',onComplete:()=>ring.destroy()});
    for(let i=0;i<7;i++) {
      const angle=(i/7)*Math.PI*2+(Math.random()-.5)*.35, distance=28+Math.random()*34, shard=this.add.rectangle(enemy.x,enemy.y,4+Math.random()*4,3+Math.random()*3,i%3===0?0xffd27a:i%2?tint:0x55f0e1).setDepth(81);
      this.tweens.add({targets:shard,x:enemy.x+Math.cos(angle)*distance,y:enemy.y+Math.sin(angle)*distance,angle:120+Math.random()*420,alpha:0,scale:.25,duration:230+Math.random()*150,ease:'Cubic.Out',onComplete:()=>shard.destroy()});
    }
  }
  hurtPlayer(amount) {
    const shieldLoss=Math.min(state.shield,amount),healthLoss=amount-shieldLoss;state.shield-=shieldLoss;state.health=Math.max(0,state.health-healthLoss);
    updateVitals();
    const now=this.time.now;
    if(now>=(this.nextHitAnimation||0)) {
      this.nextHitAnimation=now+180;
      if(shieldLoss>0){this.animateShieldDamage();this.cameras.main.shake(90,.0015);}
      else {this.droneVisual.setAlpha(1);this.tweens.add({targets:this.droneVisual,alpha:.18,duration:55,yoyo:true,repeat:2,ease:'Linear'});this.cameras.main.shake(110,.0025);}
    }
  }
  fireWeapons() {
    for (const weapon of state.items.filter((item) => ITEMS[item.itemId].kind === 'active' && item.x >= 0)) {
      const stats = getEffectiveWeaponStats(state.items, weapon), ready = this.combatNow >= (this.lastShot.get(weapon.uid) || 0);
      if (!ready || !this.enemies.length) continue;
      const targets=this.enemies.map((enemy)=>({enemy,distance:Phaser.Math.Distance.Between(this.player.x,this.player.y,enemy.x,enemy.y)})).filter(({distance})=>distance<stats.range).sort((a,b)=>a.distance-b.distance);
      if(!targets.length)continue;
      this.lastShot.set(weapon.uid, this.combatNow + stats.cooldown);
      const definition=ITEMS[weapon.itemId], shot=definition.shot, burstCount=shot.burstCount??1;
      if(shot.style==='beam') {
        for(let i=0;i<stats.projectiles;i++) this.fireBeam(weapon,targets[i%targets.length].enemy,stats.damage,definition,i,stats.projectiles);
        continue;
      }
      const target=targets[0].enemy,angle=Phaser.Math.Angle.Between(this.player.x,this.player.y,target.x,target.y);
      for(let burst=0;burst<burstCount;burst++) for(let i=0;i<stats.projectiles;i++) {
        const homingTarget=shot.style==='homing'?targets[(i+burst)%targets.length].enemy:target;
        const aimAngle=shot.style==='homing'?Phaser.Math.Angle.Between(this.player.x,this.player.y,homingTarget.x,homingTarget.y):angle;
        const fanSpread=shot.style==='homing'?.48:.18;
        const shotAngle=projectileFanAngles(aimAngle,stats.projectiles,fanSpread)[i]+(burstCount>1?(burst-(burstCount-1)/2)*(shot.spread??.08):0)+(Math.random()-.5)*.025;
        this.time.delayedCall(burst*62,()=>this.launchBullet(shotAngle,stats,shot,definition,homingTarget));
      }
    }
  }
  fireBeam(weapon,enemy,damage,definition,index,total) {
    const color=Number.parseInt(definition.color.slice(1),16),angle=Phaser.Math.Angle.Between(this.player.x,this.player.y,enemy.x,enemy.y)+(index-(total-1)/2)*.045;
    const length=Phaser.Math.Distance.Between(this.player.x,this.player.y,enemy.x,enemy.y),endX=this.player.x+Math.cos(angle)*length,endY=this.player.y+Math.sin(angle)*length;
    this.damageEnemy(enemy,damage,true);
    const beam=this.add.graphics().setDepth(18);beam.lineStyle(12,color,.16);beam.lineBetween(this.player.x,this.player.y,endX,endY);beam.lineStyle(3,color,.55);beam.lineBetween(this.player.x,this.player.y,endX,endY);beam.lineStyle(1,0xeaffff,.98);beam.lineBetween(this.player.x,this.player.y,endX,endY);
    this.tweens.add({targets:beam,alpha:0,duration:130,ease:'Cubic.Out',onComplete:()=>beam.destroy()});
  }
  damageEnemy(enemy,damage,isBeam=false) {
    if(!enemy?.active)return;
    let healthDamage=damage,shield=enemy.getData('shield'),shieldHit=shield>0;
    if(shieldHit) {
      const shieldDamage=damage*(isBeam?2:1),remaining=shield-shieldDamage;
      enemy.setData('shield',Math.max(0,remaining));
      enemy.getData('shieldVisual')?.setVisible(remaining>0);
      healthDamage=remaining<0?-remaining*(isBeam?.5:1):0;
    } else if(isBeam) healthDamage*=.5;
    if(healthDamage>0)enemy.setData('hp',enemy.getData('hp')-healthDamage);
    enemy.setData('damaged',true);
    if(shieldHit) {
      if(this.time.now>=(enemy.getData('shieldFxAt')??0)) {
        enemy.setData('shieldFxAt',this.time.now+180);
        const flash=this.add.circle(enemy.x,enemy.y,15,0x65dfff,.22).setDepth(23);flash.setStrokeStyle(2,0xcdfaff,.95);
        this.tweens.add({targets:flash,scale:2.1,alpha:0,duration:180,ease:'Cubic.Out',onComplete:()=>flash.destroy()});
        const shieldVisual=enemy.getData('shieldVisual');this.tweens.add({targets:shieldVisual,scale:1.2,duration:70,yoyo:true,ease:'Cubic.Out'});
      }
    } else {enemy.setAlpha(.55);this.time.delayedCall(65,()=>enemy.active&&enemy.setAlpha(1));}
  }
  launchBullet(angle,stats,shot,definition,target=null) {
    const tint=Number.parseInt((shot.projectileColor??definition.color).slice(1),16),line=this.add.graphics().setDepth(15);
    this.shots.push({x:this.player.x,y:this.player.y-7,vx:Math.cos(angle),vy:Math.sin(angle),damage:stats.damage,range:stats.range,travelled:0,graphic:line,color:tint,speed:shot.speed,trail:shot.trail,width:shot.width,style:shot.style,target,turnRate:shot.turnRate??0,turnDelay:shot.turnDelay??0,age:0,trailPoints:shot.style==='homing'?[{x:this.player.x,y:this.player.y-7}]:null,pierce:shot.pierce??0,hitEnemies:new Set()});
  }
  updateShots(dt) {
    for (const shot of [...this.shots]) {
      if(shot.style==='homing') {
        shot.age+=dt;
        if(!shot.target?.active)shot.target=this.enemies.filter((enemy)=>enemy.active).sort((a,b)=>Phaser.Math.Distance.Between(shot.x,shot.y,a.x,a.y)-Phaser.Math.Distance.Between(shot.x,shot.y,b.x,b.y))[0]??null;
        if(shot.target&&shot.age>=shot.turnDelay) {
          const heading=Phaser.Math.Angle.RotateTo(Math.atan2(shot.vy,shot.vx),Phaser.Math.Angle.Between(shot.x,shot.y,shot.target.x,shot.target.y),shot.turnRate*dt);
          shot.vx=Math.cos(heading);shot.vy=Math.sin(heading);
        }
      }
      const step=shot.speed*dt;shot.x+=shot.vx*step;shot.y+=shot.vy*step;shot.travelled+=step;
      const graphic=shot.graphic;graphic.clear();
      let tailX=shot.x-shot.vx*shot.trail,tailY=shot.y-shot.vy*shot.trail;
      if(shot.style==='homing') {
        const path=shot.trailPoints??[];path.unshift({x:shot.x,y:shot.y});
        const clipped=[path[0]];let pathLength=0;
        for(let index=1;index<path.length;index++){const newer=path[index-1],older=path[index],segment=Math.hypot(older.x-newer.x,older.y-newer.y);if(pathLength+segment>=shot.trail){const fraction=(shot.trail-pathLength)/(segment||1);clipped.push({x:newer.x+(older.x-newer.x)*fraction,y:newer.y+(older.y-newer.y)*fraction});break;}clipped.push(older);pathLength+=segment;}
        shot.trailPoints=clipped;const tail=clipped[clipped.length-1];tailX=tail.x;tailY=tail.y;
        for(let index=0;index<clipped.length-1;index++){const a=clipped[index],b=clipped[index+1],fade=1-index/Math.max(1,clipped.length-1);graphic.lineStyle(26,shot.color,.13*fade);graphic.lineBetween(a.x,a.y,b.x,b.y);graphic.lineStyle(15,shot.color,.32*fade);graphic.lineBetween(a.x,a.y,b.x,b.y);graphic.lineStyle(7,shot.color,.78*fade);graphic.lineBetween(a.x,a.y,b.x,b.y);graphic.lineStyle(2.2,0xfff1f4,.96*fade);graphic.lineBetween(a.x,a.y,b.x,b.y);}
        
        const normalX=-shot.vy,normalY=shot.vx,tipX=shot.x+shot.vx*10,tipY=shot.y+shot.vy*10,baseX=shot.x-shot.vx*7,baseY=shot.y-shot.vy*7;
        graphic.fillStyle(shot.color,.2);graphic.fillCircle(shot.x,shot.y,10);graphic.fillStyle(shot.color,1);graphic.fillPoints([{x:tipX,y:tipY},{x:baseX+normalX*6, y:baseY+normalY*6},{x:baseX-normalX*6,y:baseY-normalY*6}],true);graphic.fillStyle(0xfff1f4,1);graphic.fillPoints([{x:shot.x+shot.vx*7,y:shot.y+shot.vy*7},{x:shot.x-shot.vx*4+normalX*1.4,y:shot.y-shot.vy*4+normalY*1.4},{x:shot.x-shot.vx*4-normalX*1.4,y:shot.y-shot.vy*4-normalY*1.4}],true);
      } else {
        graphic.lineStyle(shot.width+3,shot.color,.16);graphic.lineBetween(tailX,tailY,shot.x,shot.y);graphic.lineStyle(shot.width,shot.color,.92);graphic.lineBetween(tailX,tailY,shot.x,shot.y);
        const head=shot.style==='pulse'?5:shot.style==='rail'?4:shot.style==='needle'?2.8:2.2;
        graphic.fillStyle(shot.style==='rail'?0xfff1cf:0xe6ffff,.96);graphic.fillCircle(shot.x,shot.y,head);
      }
      const hitRadius=shot.style==='homing'?24:shot.style==='pulse'?20:17;
      const enemy=this.enemies.find((entry)=>!shot.hitEnemies.has(entry)&&Phaser.Math.Distance.Between(entry.x,entry.y,shot.x,shot.y)<hitRadius);
      if(enemy) {
        this.damageEnemy(enemy,shot.damage,false);
        if(shot.style==='homing'){const impact=this.add.circle(shot.x,shot.y,5,shot.color,.8).setDepth(16);this.tweens.add({targets:impact,scale:3,alpha:0,duration:150,ease:'Cubic.Out',onComplete:()=>impact.destroy()});}
        if(shot.pierce>0){shot.pierce--;shot.hitEnemies.add(enemy);shot.x+=shot.vx*8;shot.y+=shot.vy*8;}
        else {shot.graphic.destroy();this.shots.splice(this.shots.indexOf(shot),1);}
      } else if(shot.travelled>shot.range){shot.graphic.destroy();this.shots.splice(this.shots.indexOf(shot),1);}
    }
  }
  dropLootReplacement(item) { const rarity = item.rarity ?? ITEMS[item.itemId].rarity, point = this.streetDropPoint(); this.addFloorLoot(item.itemId, rarity, point.x, point.y, 'item', itemStateForFloorDrop(item)); }
  streetDropPoint() {
    const horizontal = Math.random() < .5, sign = Math.random() < .5 ? -1 : 1;
    const along = sign * (78 + Math.random() * 92), across = (Math.random() - .5) * 24;
    if (horizontal) return { x: this.player.x + along, y: Math.round(this.player.y / 280) * 280 + across };
    return { x: Math.round(this.player.x / 280) * 280 + across, y: this.player.y + along };
  }
  addFloorLoot(itemId, rarity, x, y, kind='item', itemState={}) {
    const quality = RARITIES[rarity], tint = Number.parseInt(quality.color.slice(1), 16);
    const pickupHeight=DRONE_FLIGHT_HEIGHT;
    const drop = { uid: `floor-${++state.lootIndex}`, itemId, rarity, kind, itemKind: ITEMS[itemId].kind, x, y, pickupHeight, signHeight:pickupHeight+260, itemState, tint, phase: Math.random() * Math.PI * 2 };
    this.floorLoot.push(drop);
    playRarityDing(rarity);
    return drop;
  }
  dropLoot(x,y) {
    const { itemId, rarity } = rollLoot();
    const drop = this.addFloorLoot(itemId, rarity, x, y);
    showToast(`${RARITIES[rarity].label.toUpperCase()} LOOT DROPPED · ${ITEMS[itemId].name.toUpperCase()}`);
    return drop;
  }
  dropKit(x,y) {
    const itemId=Math.random()<.5?'repairKit':'shieldKit';
    const drop=this.addFloorLoot(itemId,'common',x,y,'kit');
    showToast(`${ITEMS[itemId].name.toUpperCase()} DROPPED`);
    return drop;
  }
  spawnDebugLoot(rarity) {
    const { itemId } = rollLootFromRarity(rarity);
    const point = this.streetDropPoint();
    const drop = this.addFloorLoot(itemId, rarity, point.x, point.y);
    showToast(`DEV DROP · ${RARITIES[rarity].label.toUpperCase()} ${ITEMS[itemId].name.toUpperCase()}`);
    return drop;
  }
  updateFloorLoot() {
    const playerX=this.player.x-this.cameras.main.scrollX+this.droneVisual.x;
    const playerY=this.player.y-this.cameras.main.scrollY+this.droneVisual.y;
    const nearbyDrops=this.floorLoot.map((loot)=>({loot,distance:Math.hypot(loot.screenX-playerX,loot.screenY-playerY)})).filter(({distance})=>distance<145).sort((a,b)=>a.distance-b.distance);
    const kitDrop=nearbyDrops.find(({loot})=>loot.kind==='kit'||ITEMS[loot.itemId]?.kind==='consumable');
    if(kitDrop){this.pickUpFloorLoot(kitDrop.loot);return;}
    const nearby=nearbyDrops[0]??null;
    this.nearbyLoot=nearby?.loot??null;
    const prompt=document.querySelector('#loot-prompt');
    prompt.hidden=!this.nearbyLoot;
    if(this.nearbyLoot){
      const quality=RARITIES[this.nearbyLoot.rarity],definition=ITEMS[this.nearbyLoot.itemId],isKit=this.nearbyLoot.kind==='kit'||definition.kind==='consumable';
      document.querySelector('#loot-nearby-name').textContent=definition.name;
      document.querySelector('#loot-nearby-quality').textContent=isKit?definition.description.toUpperCase():`${quality.label.toUpperCase()} · +${quality.sellValue} CREDITS`;
      document.querySelector('#loot-sell-value').textContent=`+${quality.sellValue}`;
      document.querySelector('#loot-pickup').firstChild.textContent=isKit?'USE KIT ':'PICK UP ';
      document.querySelector('#loot-sell').hidden=isKit;
      prompt.style.setProperty('--loot-color',isKit?definition.color:quality.color);
      document.querySelector('#loot-pickup').disabled=Boolean(state.heldLoot);
    }
  }
  sellFloorLoot(drop) {
    if (!drop) return;
    const index = this.floorLoot.indexOf(drop);
    if (index < 0) return;
    const value = RARITIES[drop.rarity].sellValue;
    this.floorLoot.splice(index, 1);
    state.credits += value;
    updateCreditDisplays();saveProgression(state);
    this.nearbyLoot = null;
    document.querySelector('#loot-prompt').hidden = true;
    const canvasRect = this.game.canvas.getBoundingClientRect(), currencyRect = document.querySelector('.arena-currency').getBoundingClientRect();
    const target = { x: (currencyRect.left + currencyRect.width / 2 - canvasRect.left) / canvasRect.width * 1200, y: (currencyRect.top + currencyRect.height / 2 - canvasRect.top) / canvasRect.height * 800 };
    const fromX = drop.screenX ?? drop.x, fromY = drop.screenY ?? drop.y;
    for (let i = 0; i < 7; i++) {
      const jitter = (i - 3) * 4, chip = this.add.rectangle(fromX + (Math.random() - .5) * 12, fromY - 5, i % 2 ? 4 : 6, i % 2 ? 4 : 6, i % 3 ? 0xf4d36f : 0x62eee0).setScrollFactor(0).setDepth(5000);
      this.tweens.add({ targets: chip, x: target.x + jitter, y: target.y + (i % 2) * 4, alpha: 0, scale: .35, duration: 440 + i % 3 * 50, ease: 'Cubic.In', onComplete: () => chip.destroy() });
    }
    const gain = this.add.text(fromX, fromY - 27, `+${value} CREDITS`, { fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#ffe69a', stroke: '#14101d', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(.5).setScrollFactor(0).setDepth(5001);
    this.tweens.add({ targets: gain, y: gain.y - 34, alpha: 0, scale: 1.12, duration: 720, ease: 'Cubic.Out', onComplete: () => gain.destroy() });
    const pulse = this.add.ellipse(fromX, fromY, 34, 16, 0x62eee0, 0).setScrollFactor(0); pulse.setStrokeStyle(2, 0x62eee0, .9).setDepth(5000);
    this.tweens.add({ targets: pulse, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 260, ease: 'Cubic.Out', onComplete: () => pulse.destroy() });
    playCreditSound();
    const currency = document.querySelector('.arena-currency'); currency.classList.remove('is-gaining'); void currency.offsetWidth; currency.classList.add('is-gaining');
    showToast(`${ITEMS[drop.itemId].name.toUpperCase()} SOLD · +${value} CREDITS`);
  }
  pickUpFloorLoot(drop) {
    if (state.heldLoot || !drop) return;
    if(drop.kind==='kit'||ITEMS[drop.itemId]?.kind==='consumable') {
      const shieldKit=drop.itemId==='shieldKit',canUse=shieldKit?state.shield<PLAYER_SHIELD_CAP:state.health<getMaxHealth();
      if(!canUse){this.sellFloorLoot(drop);return;}
      this.playLootPickupEffect(drop);this.floorLoot.splice(this.floorLoot.indexOf(drop),1);this.nearbyLoot=null;document.querySelector('#loot-prompt').hidden=true;
      if(shieldKit)state.shield=Math.min(PLAYER_SHIELD_CAP,state.shield+50);else state.health=Math.min(getMaxHealth(),state.health+30);
      updateVitals();showToast(shieldKit?'SHIELD RESTORED · +50':'REPAIRED · +30 HEALTH');return;
    }
    this.playLootPickupEffect(drop);
    this.nearbyLoot = null;
    this.floorLoot.splice(this.floorLoot.indexOf(drop), 1);
    const item = restoreItemFromFloorDrop(drop);
    state.items.push(item); state.heldLoot = item.uid; state.carried = item.uid; state.paused = true; state.backpackFocus = true;
    const open = findOpenCell(item); if (open) state.selected = open;
    document.querySelector('#loot-prompt').hidden = true;
    renderBackpack(); renderPendingItem();
    focusSelectedCell();
    document.querySelector('#pause-button').textContent = '▶';
    showToast(`ITEM SECURED · ${ITEMS[item.itemId].name.toUpperCase()}`);
  }
  playLootPickupEffect(drop) {
    const x=drop.screenX??600,y=drop.screenY??400,tint=drop.tint,quality=RARITIES[drop.rarity];
    const flash=this.add.circle(x,y,10,0xffffff,.95).setScrollFactor(0).setDepth(8000);
    this.tweens.add({targets:flash,scale:4,alpha:0,duration:210,ease:'Cubic.Out',onComplete:()=>flash.destroy()});
    for(const [scale,duration,width] of [[2.8,320,2.5],[1.8,230,1.5]]) {
      const ring=this.add.ellipse(x,y,15,10,0xffffff,0).setScrollFactor(0).setDepth(7999);
      ring.setStrokeStyle(width,tint,.95);
      this.tweens.add({targets:ring,scaleX:scale,scaleY:scale,alpha:0,duration,ease:'Cubic.Out',onComplete:()=>ring.destroy()});
    }
    for(let shard=0;shard<12;shard++) {
      const angle=shard*Math.PI/6+(Math.random()-.5)*.16,distance=26+Math.random()*22;
      const spark=this.add.rectangle(x,y,shard%3===0?5:3,shard%3===0?5:3,shard%3===0?0xffffff:tint,.96).setRotation(angle).setScrollFactor(0).setDepth(8001);
      this.tweens.add({targets:spark,x:x+Math.cos(angle)*distance,y:y+Math.sin(angle)*distance,scale:.15,alpha:0,duration:220+Math.random()*100,ease:'Cubic.Out',onComplete:()=>spark.destroy()});
    }
    const tag=this.add.text(x,y-25,`${quality.label.toUpperCase()} · SECURED`,{fontFamily:'DM Mono, monospace',fontSize:'9px',color:quality.color,stroke:'#07111a',strokeThickness:4,letterSpacing:1}).setOrigin(.5).setScrollFactor(0).setDepth(8002);
    this.tweens.add({targets:tag,y:y-45,alpha:0,duration:520,ease:'Cubic.Out',onComplete:()=>tag.destroy()});
    playLootPickupSound(drop.rarity);
  }
}

const game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: 1200, height: 800, transparent: true, backgroundColor: 'rgba(0,0,0,0)', scene: Undercity, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, physics: { default: 'arcade', arcade: { debug: false } }, input: { gamepad: true }, render: { antialias: true, pixelArt: false, transparent: true } });

function gridItemAt(x, y, excludedUid = null) { return state.items.find((entry) => entry.uid !== excludedUid && entry.x >= 0 && entry.y >= 0 && cellsFor(entry).some((cell) => cell.x === x && cell.y === y)); }
function findOpenCell(item = null) { for (let y = 0; y < GRID.height; y++) for (let x = 0; x < GRID.width; x++) { if (item ? canPlace(state.items, item.uid, x, y) : !gridItemAt(x, y)) return { x, y }; } return null; }
function gridCellFromPoint(clientX, clientY) {
  const rect = gridNode.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
  const style = getComputedStyle(gridNode), gapX = Number.parseFloat(style.columnGap) || 0, gapY = Number.parseFloat(style.rowGap) || 0;
  const cellWidth = (rect.width - gapX * (GRID.width - 1)) / GRID.width, cellHeight = (rect.height - gapY * (GRID.height - 1)) / GRID.height;
  const indexAt = (offset, size, gap, count) => {
    const stride = size + gap, index = Math.floor(offset / stride), within = offset - index * stride;
    return clamp(index + (within > size + gap / 2 ? 1 : 0), 0, count - 1);
  };
  return { x: indexAt(clientX - rect.left, cellWidth, gapX, GRID.width), y: indexAt(clientY - rect.top, cellHeight, gapY, GRID.height) };
}
function renderBackpack() {
  gridNode.replaceChildren();
  for (let i = 0; i < GRID.width * GRID.height; i++) {
    const x = i % GRID.width, y = Math.floor(i / GRID.width), carriedItem = state.items.find((entry) => entry.uid === state.carried);
    const previewCells = carriedItem ? cellsFor(carriedItem, state.selected.x, state.selected.y) : [];
    const previewRenderCell=carriedItem?footprintRenderAnchor(footprintFor(carriedItem),state.selected.x,state.selected.y):null;
    const isPreviewCell = Boolean(carriedItem && previewCells.some((slot) => slot.x === x && slot.y === y));
    const isPreview = Boolean(previewRenderCell && previewRenderCell.x===x && previewRenderCell.y===y);
    const occupiedItem = gridItemAt(x, y, carriedItem?.uid);
    const coveredByPreview = Boolean(carriedItem && occupiedItem && cellsFor(occupiedItem).some((cell) => previewCells.some((slot) => slot.x === cell.x && slot.y === cell.y)));
    const item = isPreview ? carriedItem : coveredByPreview ? null : occupiedItem;
    if (coveredByPreview && !isPreview) continue;
    if (isPreviewCell && !isPreview) continue;
    if (carriedItem && x===state.selected.x && y===state.selected.y && !isPreviewCell && !occupiedItem) continue;
    if (item && !isPreview && (item.x !== x || item.y !== y)) continue;
    const cellX=isPreview?state.selected.x:x,cellY=isPreview?state.selected.y:y;
    const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'pack-cell'; cell.setAttribute('role', 'gridcell'); cell.dataset.x = cellX; cell.dataset.y = cellY; cell.setAttribute('aria-label', item ? `${ITEMS[item.itemId].name}, column ${cellX + 1}, row ${cellY + 1}` : `Empty, column ${cellX + 1}, row ${cellY + 1}`);
    cell.style.gridColumn = `${cellX + 1} / span 1`; cell.style.gridRow = `${cellY + 1} / span 1`; cell.dataset.width = '1'; cell.dataset.height = '1';
    if (item) {
      const footprint = footprintFor(item), width = Math.max(...footprint.map(([dx]) => dx)) + 1, height = Math.max(...footprint.map(([, dy]) => dy)) + 1;
      cell.style.gridColumn = `${cellX + 1} / span ${width}`; cell.style.gridRow = `${cellY + 1} / span ${height}`; cell.dataset.width = String(width); cell.dataset.height = String(height);
      const def = ITEMS[item.itemId], rarity = RARITIES[item.rarity ?? def.rarity], effectiveCooldown = def.kind === 'active' ? getEffectiveWeaponStats(state.items, item).cooldown : 0;
      cell.style.setProperty('--footprint-width', String(width)); cell.style.setProperty('--footprint-height', String(height));
      const center=footprint.reduce((sum,[fx,fy])=>({x:sum.x+fx+.5,y:sum.y+fy+.5}),{x:0,y:0});
      const centerX=center.x/footprint.length/width*100,centerY=center.y/footprint.length/height*100;
      cell.style.setProperty('--clock-x',centerX+'%');cell.style.setProperty('--clock-y',centerY+'%');
      const clip=footprintClipPath(footprint);cell.style.setProperty('--footprint-clip',clip);
      const level=Math.max(1,Math.min(ITEM_LEVEL_CAP,item.level??1));
      const intervalLabel = def.kind === 'passive' ? 'PASSIVE' : '';
      const visual = def.shape ? ACTIVE_ITEM_SVG[def.shape] : def.kind === 'passive' ? PASSIVE_ITEM_ICON : def.icon;
      const cooldownClock = def.kind === 'active' ? `<span class="cooldown-clock" data-uid="${item.uid}" aria-hidden="true"></span>` : '';
      const upgradeTarget=isPreview?overlappingSameItems(state.items,item,state.selected.x,state.selected.y).find((entry)=>(entry.level??1)<ITEM_LEVEL_CAP)??null:null;
      cell.classList.add('has-item', def.kind, `rarity-${item.rarity ?? def.rarity}`);
      cell.style.setProperty('--item-color', rarity.color); if(upgradeTarget)cell.classList.add('upgrade-target-preview');
      if (isPreview) {
        const targetKeys = new Set(previewCells.map((slot) => `${slot.x},${slot.y}`));
        const blockers = state.items.filter((entry) => entry.uid !== item.uid && entry.x >= 0 && cellsFor(entry).some((slot) => targetKeys.has(`${slot.x},${slot.y}`)));
        cell.classList.add('is-carried', 'is-placement-preview', blockers.length ? 'placement-replacing' : canPlace(state.items, item.uid, state.selected.x, state.selected.y) ? 'placement-valid' : 'placement-invalid');
      }
      const glyphAnchor=footprintIconAnchor(footprint);
      const glyphCols=glyphAnchor.shape==='irregular'?1:width,glyphRows=glyphAnchor.shape==='irregular'?1:height;
      cell.style.setProperty('--glyph-x',(glyphAnchor.x/width*100)+'%');cell.style.setProperty('--glyph-y',(glyphAnchor.y/height*100)+'%');cell.style.setProperty('--glyph-cols',String(glyphCols));cell.style.setProperty('--glyph-rows',String(glyphRows));
      const footprintMap='<span class="item-footprint-map" aria-hidden="true">'+footprint.map(([fx,fy])=>'<i style="grid-column:'+(fx+1)+';grid-row:'+(fy+1)+'"></i>').join('')+'</span>';
      cell.innerHTML = '<span class="item-name">'+def.name+'</span><span class="item-level-badge" aria-label="Level '+level+'"><span aria-hidden="true">★</span><b>'+level+'</b></span>'+footprintMap+'<span class="item-art-region"><span class="item-glyph'+(def.shape?' active-glyph':'')+'" aria-hidden="true">'+visual+'</span></span>'+cooldownClock+'<span class="item-cooldown">'+intervalLabel+'</span>';
      cell.setAttribute('aria-label', `${def.name}, ${rarity.label}, level ${level} of ${ITEM_LEVEL_CAP}, ${effectiveCooldown ? `cooldown ${ (effectiveCooldown / 1000).toFixed(2) } seconds between shots` : 'passive item'}. ${def.description} Column ${cellX + 1}, row ${cellY + 1}. Select to move.`); cell.dataset.uid = item.uid;
      cell.addEventListener('pointerenter', () => showItemTooltip(item, cell, upgradeTarget));
      cell.addEventListener('pointerleave', hideItemTooltip);
      cell.addEventListener('focus', () => { state.backpackFocus = true; showItemTooltip(item, cell, upgradeTarget); });
      cell.addEventListener('blur', hideItemTooltip);
      if (isPreview) cell.classList.add('is-carried');
    }
    if (isPreview || (item ? cellsFor(item).some((slot) => slot.x === state.selected.x && slot.y === state.selected.y) : state.selected.x === x && state.selected.y === y)) cell.classList.add('is-cursor');
    cell.addEventListener('focus', () => { state.backpackFocus = true; });
    cell.addEventListener('blur', () => { setTimeout(() => { state.backpackFocus = gridNode.contains(document.activeElement); }, 0); });
    cell.addEventListener('click', (event) => {
      if (state.suppressClick) { state.suppressClick = false; return; }
      state.backpackFocus = true;
      const pointerCell = event.detail === 0 ? null : gridCellFromPoint(event.clientX, event.clientY), target = pointerCell ?? { x: cellX, y: cellY };
      const here = gridItemAt(target.x, target.y);
      if (here && !cellsFor(here).some((slot) => slot.x === target.x && slot.y === target.y)) return;
      if (state.carried) {
        const offset = state.pointerDragging ? state.pointerDragOffset ?? { x: 0, y: 0 } : { x: 0, y: 0 };
        const anchor = placementAnchor(state.items.find((entry) => entry.uid === state.carried), target.x - offset.x, target.y - offset.y);
        state.selected = anchor;
        if (placeCarried(anchor.x, anchor.y)) { state.pointerDragging = false; state.pointerDragOffset = null; }
      } else if (here) {
        state.selected = { x: here.x, y: here.y }; pickupItem(here.uid);
      } else { state.selected = target; renderBackpack(); }
    });
    cell.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !cell.dataset.uid) return;
      const item = state.items.find((entry) => entry.uid === cell.dataset.uid), pointerCell = gridCellFromPoint(event.clientX, event.clientY);
      if (!item || !pointerCell || !cellsFor(item).some((slot) => slot.x === pointerCell.x && slot.y === pointerCell.y)) return;
      state.pointerStart = { uid: item.uid, x: item.x, y: item.y, grabX: pointerCell.x - item.x, grabY: pointerCell.y - item.y, clientX: event.clientX, clientY: event.clientY };
      state.pointerId = event.pointerId;
      gridNode.setPointerCapture(event.pointerId);
    });
    gridNode.append(cell);
  }
  const placedCount = state.items.filter((item) => item.x >= 0).reduce((count, item) => count + cellsFor(item).length, 0);
  document.querySelector('#item-count').innerHTML = `${String(placedCount).padStart(2, '0')} <span>/ ${String(GRID.width * GRID.height).padStart(2, '0')} SLOTS</span>`;
  document.querySelector('#inventory-size-label').textContent = `${GRID.width * GRID.height} SLOT INVENTORY`;
  document.querySelector('#inventory-grid-size').textContent = `${GRID.width} × ${GRID.height}`;
  gridNode.setAttribute('aria-label', `${GRID.width} by ${GRID.height} equipped inventory`);
  renderInventorySale();
}
function focusSelectedCell() { const button = [...gridNode.querySelectorAll('.pack-cell')].find((cell) => { const x = Number(cell.dataset.x), y = Number(cell.dataset.y); return state.selected.x >= x && state.selected.x < x + Number(cell.dataset.width) && state.selected.y >= y && state.selected.y < y + Number(cell.dataset.height); }); button?.focus({ preventScroll: true }); }
function returnFocusToGame() { state.backpackFocus = false; hideItemTooltip(); if (gridNode.contains(document.activeElement)) document.activeElement.blur(); if (game.canvas) { game.canvas.tabIndex = 0; game.canvas.focus({ preventScroll: true }); } }
function renderInventorySale() { const tray = document.querySelector('#inventory-sale'), item = state.items.find((entry) => entry.uid === state.carried); if (!item || item.uid === state.heldLoot) { tray.hidden = true; return; } const def = ITEMS[item.itemId], rarity = RARITIES[item.rarity ?? def.rarity]; tray.hidden = false; document.querySelector('#inventory-sale-copy').textContent = `${def.name} · ${rarity.label}`; document.querySelector('#inventory-sale-value').textContent = `+${rarity.sellValue}`; }
function sellCarriedInventoryItem() {
  const item = state.items.find((entry) => entry.uid === state.carried); if (!item || item.uid === state.heldLoot) return false;
  const def = ITEMS[item.itemId], rarity = RARITIES[item.rarity ?? def.rarity], value = rarity.sellValue;
  const source = gridNode.querySelector(`[data-uid="${CSS.escape(item.uid)}"]`)?.getBoundingClientRect(), target = document.querySelector('.arena-currency').getBoundingClientRect();
  state.credits += value; updateCreditDisplays();saveProgression(state);
  const flight = document.createElement('span'); flight.className = 'credit-flight'; flight.textContent = `+${value}`;
  if (source) { flight.style.left = `${source.left + source.width / 2}px`; flight.style.top = `${source.top + source.height / 2}px`; flight.style.setProperty('--credit-dx', `${target.left + target.width / 2 - source.left - source.width / 2}px`); flight.style.setProperty('--credit-dy', `${target.top + target.height / 2 - source.top - source.height / 2}px`); document.body.append(flight); setTimeout(() => flight.remove(), 650); }
  state.items.splice(state.items.indexOf(item), 1); state.carried = null; resumeAfterInventoryAction(); renderBackpack(); returnFocusToGame(); playCreditSound();
  const currency = document.querySelector('.arena-currency'); currency.classList.remove('is-gaining'); void currency.offsetWidth; currency.classList.add('is-gaining');
  showToast(`${def.name.toUpperCase()} SOLD · +${value} CREDITS`); return true;
}
function pauseForInventory() { if(!state.running||state.paused)return;state.inventoryPausedRun=true;state.paused=true;document.querySelector('#pause-button').textContent='▶'; }
function resumeAfterInventoryAction() { if(!state.inventoryPausedRun)return;state.inventoryPausedRun=false;state.paused=false;document.querySelector('#pause-button').textContent='Ⅱ'; }
function pickupItem(uid) { const item=state.items.find((i)=>i.uid===uid);if(!item)return;state.pointerDragging=false;state.pointerDragOffset=null;pauseForInventory();state.carried=uid;state.selected={x:item.x,y:item.y};hideItemTooltip();renderBackpack();focusSelectedCell();showToast(ITEMS[item.itemId].name.toUpperCase()+' PICKED UP · CHOOSE A CELL · Q / E ROTATE'); }
function placeCarried(x, y) {
  const item = state.items.find((entry) => entry.uid === state.carried); if (!item) return false;
  const sameItems=overlappingSameItems(state.items,item,x,y);
  if(sameItems.length) {
    const target=sameItems.find((entry)=>(entry.level??1)<ITEM_LEVEL_CAP);
    if(!target){showToast(`${ITEMS[item.itemId].name.toUpperCase()} ALREADY MAX LEVEL`);return false;}
    target.level=Math.max(1,target.level??1)+1;
    state.items.splice(state.items.indexOf(item),1);
    const wasLoot=state.heldLoot===item.uid;
    state.carried=null;
    if(wasLoot){state.heldLoot=null;state.paused=false;document.querySelector('#pause-button').textContent='Ⅱ';document.querySelector('#pending-item').hidden=true;}
    state.selected={x:target.x,y:target.y};resumeAfterInventoryAction();renderBackpack();returnFocusToGame();
    showToast(`${ITEMS[target.itemId].name.toUpperCase()} UPGRADED · LV ${target.level}`);return true;
  }
  const targetCells = new Set(cellsFor(item,x,y).map((cell)=>`${cell.x},${cell.y}`));
  const blockers = state.items.filter((entry)=>entry.uid!==item.uid&&entry.x>=0&&cellsFor(entry).some((cell)=>targetCells.has(`${cell.x},${cell.y}`)));
  const existing = state.items.find((entry) => entry.uid !== item.uid && entry.x >= 0 && cellsFor(entry).some((cell) => cell.x === x && cell.y === y));
  if (!canPlace(state.items, item.uid, x, y)) {
    const targetKeys = new Set(cellsFor(item, x, y).map((slot) => `${slot.x},${slot.y}`));
    const blockers = state.items.filter((entry) => entry.uid !== item.uid && entry.x >= 0 && cellsFor(entry).some((slot) => targetKeys.has(`${slot.x},${slot.y}`)));
    if (blockers.length === 1 && state.heldLoot !== item.uid && item.x >= 0 && canSwap(state.items, item, blockers[0])) {
      const origin = { x: item.x, y: item.y };
      item.x = x; item.y = y; blockers[0].x = origin.x; blockers[0].y = origin.y;
      state.carried = null; state.selected = { x, y }; resumeAfterInventoryAction(); renderBackpack(); returnFocusToGame();
      showToast(`${ITEMS[item.itemId].name.toUpperCase()} ↔ ${ITEMS[blockers[0].itemId].name.toUpperCase()} SWAPPED`);
      return true;
    }
    const remaining = state.items.filter((entry) => entry.uid === item.uid || !blockers.includes(entry));
    if (blockers.length && canPlace(remaining, item.uid, x, y)) {
      for (const displaced of blockers) { state.items.splice(state.items.indexOf(displaced), 1); game.scene.getScene('undercity').dropLootReplacement(displaced); }
      item.x = x; item.y = y; const wasLoot = state.heldLoot === item.uid;
      state.heldLoot = null; state.carried = null; state.selected = { x, y };
      if (wasLoot) { state.paused = false; document.querySelector('#pause-button').textContent = 'Ⅱ'; document.querySelector('#pending-item').hidden = true; }
      resumeAfterInventoryAction(); renderBackpack(); returnFocusToGame();
      showToast(`${blockers.length} ITEM${blockers.length === 1 ? '' : 'S'} DROPPED · ${ITEMS[item.itemId].name.toUpperCase()} EQUIPPED`);
      return true;
    }
    state.selected = placementAnchor(item, x, y);
    renderBackpack(); focusSelectedCell();
    showToast(existing ? 'BLOCKED · ITEMS CANNOT OVERLAP' : 'SHAPE DOES NOT FIT · ROTATE OR CHOOSE ANOTHER SLOT'); return false;
  }
  item.x = x; item.y = y; state.carried = null; state.selected = { x, y };
  if (state.heldLoot === item.uid) { state.heldLoot = null; state.paused = false; document.querySelector('#pause-button').textContent = 'Ⅱ'; document.querySelector('#pending-item').hidden = true; }
  resumeAfterInventoryAction(); renderBackpack(); returnFocusToGame(); showToast('ITEM EQUIPPED · ADJACENCY SYNERGIES UPDATED'); return true;
}
function cancelCarried() {
  if (!state.carried) return;
  state.pointerDragging = false; state.pointerDragOffset = null;
  const item = state.items.find((entry) => entry.uid === state.carried);
    if (state.heldLoot === state.carried) {
    state.items.splice(state.items.indexOf(item), 1); const scene = game.scene.getScene('undercity'); scene.dropLootReplacement(item);
    state.heldLoot = null; state.paused = false; document.querySelector('#pause-button').textContent = 'Ⅱ'; document.querySelector('#pending-item').hidden = true;
  }
  state.carried = null; resumeAfterInventoryAction(); hideItemTooltip(); renderBackpack(); returnFocusToGame(); showToast('MOVE CANCELLED');
}
function handleBackpackConfirm() { const here = gridItemAt(state.selected.x, state.selected.y); if (state.carried) placeCarried(state.selected.x, state.selected.y); else if (here) pickupItem(here.uid); }
function placementAnchor(item, x, y) { return placementOrigin(item,x,y); }
function moveGrid(dx, dy) { const item = state.items.find((entry) => entry.uid === state.carried); if (item) state.selected = placementAnchor(item, state.selected.x + dx, state.selected.y + dy); else { state.selected.x = clamp(state.selected.x + dx, 0, GRID.width - 1); state.selected.y = clamp(state.selected.y + dy, 0, GRID.height - 1); } renderBackpack(); focusSelectedCell(); }
function rotateCarried(direction) { const item = state.items.find((entry) => entry.uid === state.carried); if (!item) return false; const footprint = footprintFor(item); if (footprint.length < 2) return false; item.rotation = advanceFootprintRotation(item,direction).rotation; state.selected=placementAnchor(item,state.selected.x,state.selected.y); renderBackpack(); focusSelectedCell(); showToast(`ROTATED ${ITEMS[item.itemId].name.toUpperCase()} · ${item.rotation * 90}°`); return true; }
function renderMetaUpgrades() {
  const list=document.querySelector('#meta-perk-list');
  list.replaceChildren();
  for(const perk of META_PERKS) {
    const level=perkLevel(perk.id),maxLevel=perk.costs.length,nextCost=perk.costs[level];
    const card=document.createElement('article');card.className='meta-perk';card.dataset.perk=perk.id;
    const tiers=Array.from({length:maxLevel},(_,index)=>`<i class="${index<level?'is-earned':''}" aria-hidden="true"></i>`).join('');
    const tier=level>=maxLevel?level:level+1;
    const effect=perk.id==='hull'?`+${tier*10} MAX HP`:perk.id==='damage'?`+${tier*8}% DAMAGE`:perk.id==='cooldown'?`${tier*5}% FASTER FIRE`:perk.id==='shield'?`+${tier*25} START SHIELD`:`+${tier*6}% SPEED`;
    card.innerHTML=`<div class="meta-perk-top"><span class="meta-perk-icon">${perk.icon}</span><div><b>${perk.name}</b><small>TIER ${level} / ${maxLevel}</small></div></div><div class="meta-tiers" aria-label="Tier ${level} of ${maxLevel}">${tiers}</div><p>${perk.description}<span>${level>=maxLevel?'MAXED':'NEXT'} · ${effect}</span></p>`;
    const actions=document.createElement('div');actions.className='meta-perk-actions';
    const button=document.createElement('button');button.type='button';button.className='meta-buy';button.disabled=state.running||level>=maxLevel||state.credits<nextCost;button.textContent=level>=maxLevel?'MAX TIER':`INVEST · ${nextCost} CR`;
    button.setAttribute('aria-label',level>=maxLevel?`${perk.name} maximum tier`:`Invest ${nextCost} credits in ${perk.name}, tier ${level+1}`);
    button.addEventListener('click',()=>buyPerk(perk.id));actions.append(button);
    if(level>0) {
      const refund=document.createElement('button');refund.type='button';refund.className='meta-refund';refund.disabled=state.running;
      refund.textContent=`REFUND TIER ${level} · +${perk.costs[level-1]} CR`;
      refund.setAttribute('aria-label',`Refund tier ${level} of ${perk.name} for ${perk.costs[level-1]} credits`);
      refund.addEventListener('click',()=>refundPerk(perk.id));actions.append(refund);
    }
    card.append(actions);list.append(card);
  }
  document.querySelector('#meta-credit-count').textContent=`${String(state.credits).padStart(3,'0')} CR`;
}
function buyPerk(id) {
  if(state.running)return;
  const perk=META_PERKS.find((entry)=>entry.id===id);if(!perk)return;
  const level=perkLevel(id),cost=perk.costs[level];
  if(cost===undefined||state.credits<cost)return;
  state.credits-=cost;state.perks[id]=level+1;saveProgression(state);updateCreditDisplays();renderMetaUpgrades();
  showToast(`${perk.name.toUpperCase()} · TIER ${level+1} INSTALLED`);
}
function refundPerk(id) {
  if(state.running)return;
  const perk=META_PERKS.find((entry)=>entry.id===id),level=perkLevel(id);
  if(!perk||level<=0)return;
  const amount=perk.costs[level-1];
  state.credits+=amount;state.perks[id]=level-1;saveProgression(state);updateCreditDisplays();renderMetaUpgrades();
  showToast(`${perk.name.toUpperCase()} · TIER ${level} REFUNDED · +${amount} CR`);
}
function showToast(message) { const node = document.querySelector('#toast'); node.textContent = message; node.classList.add('visible'); clearTimeout(showToast.timeout); showToast.timeout = setTimeout(() => node.classList.remove('visible'), 1800); }
function renderPendingItem() { const item = state.items.find((entry) => entry.uid === state.heldLoot), panel = document.querySelector('#pending-item'); if (!item) { panel.hidden = true; return; } const definition = ITEMS[item.itemId], rarity = RARITIES[item.rarity]; panel.hidden = false; panel.style.setProperty('--item-color', rarity.color); panel.innerHTML = `<span class="pending-icon">${definition.icon}</span><span><b>${definition.name}</b><small>${rarity.label} · PLACE TO DROP OVERLAPPED GEAR</small></span><kbd>ESC</kbd>`; }
function passiveBonusAtLevel(item) { const passive=ITEMS[item.itemId].adjacency,level=Math.max(1,Math.min(ITEM_LEVEL_CAP,item.level??1)); if(!passive)return 'PASSIVE EFFECT'; if(passive.stat==='damage')return `DAMAGE +${Math.round((passive.multiplier-1)*(1+(level-1)*.06)*100)}%`; if(passive.stat==='cooldown')return `COOLDOWN -${Math.round((1-Math.max(.5,passive.multiplier-(level-1)*.025))*100)}%`; if(passive.stat==='projectiles')return `+${passive.add+Math.floor((level-1)/3)} PROJECTILE${passive.add+Math.floor((level-1)/3)===1?'':'S'}`; return 'PASSIVE EFFECT'; }
function tooltipStatValues(item,items=state.items) {
  const definition=ITEMS[item.itemId];
  if(definition.kind==='active') {
    const stats=getEffectiveWeaponStats(items,item);
    const neighboringPassives=items.filter((entry)=>entry.uid!==item.uid&&entry.x>=0&&ITEMS[entry.itemId].kind==='passive'&&adjacentTo(item,entry));
    const withoutPassives=getEffectiveWeaponStats(items.filter((entry)=>!neighboringPassives.includes(entry)),item);
    return {
      damage:formatStatWithDelta(stats.damage,withoutPassives.damage,value=>String(Math.round(value*10)/10)),
      projectiles:formatStatWithDelta(stats.projectiles,withoutPassives.projectiles,String),
      cooldown:formatStatWithDelta(stats.cooldown,withoutPassives.cooldown,value=>(value/1000).toFixed(2)+'s'),
    };
  }
  const values={damage:'—',projectiles:'—',cooldown:'—'},adjacency=definition.adjacency;
  if(!adjacency)return values;
  const level=Math.max(1,Math.min(ITEM_LEVEL_CAP,item.level??1));
  if(adjacency.stat==='damage'&&adjacency.multiplier) {
    const multiplier=1+(adjacency.multiplier-1)*(1+(level-1)*.06);
    values.damage='+'+Math.round((multiplier-1)*100)+'%';
  }
  if(adjacency.stat==='projectiles')values.projectiles='+'+(adjacency.add+Math.floor((level-1)/3));
  if(adjacency.stat==='cooldown')values.cooldown='−'+Math.round((1-Math.max(.5,adjacency.multiplier-(level-1)*.025))*100)+'%';
  for(const [key,value] of Object.entries(adjacency.stats??{})) {
    if(key==='damage')values.damage=Math.round((value-1)*100)+'%';
    if(key==='projectiles')values.projectiles=String(value);
    if(key==='cooldown')values.cooldown=Math.round((1-value)*100)+'%';
  }
  return values;
}
function tooltipStatRows(values) {
  return [['Damage','damage'],['Projectiles','projectiles'],['Cooldown','cooldown']].map(([label,key])=>'<div class="tooltip-stat"><span>'+label+'</span><b>'+values[key]+'</b></div>').join('');
}
function tooltipUpgradePreview(target) {
  if(!target)return '';
  const nextLevel=Math.min(ITEM_LEVEL_CAP,(target.level??1)+1),next={...target,level:nextLevel};
  const nextItems=state.items.map((entry)=>entry.uid===target.uid?next:entry);
  const before=tooltipStatValues(target),after=tooltipStatValues(next,nextItems);
  const rows=[['Damage','damage'],['Projectiles','projectiles'],['Cooldown','cooldown']].map(([label,key])=>'<div class="tooltip-compare-row"><span>'+label+'</span><b>'+before[key]+'</b><i>→</i><strong>'+after[key]+'</strong></div>').join('');
  return '<section class="tooltip-upgrade"><small>NEXT LEVEL PREVIEW · '+nextLevel+'</small>'+rows+'</section>';
}
function showItemTooltip(item,anchor,upgradeTarget=null) {
  const definition=ITEMS[item.itemId],rarity=RARITIES[item.rarity??definition.rarity],level=Math.max(1,Math.min(ITEM_LEVEL_CAP,item.level??1));
  const neighbors=definition.kind==='active'?state.items.filter((entry)=>entry.uid!==item.uid&&entry.x>=0&&ITEMS[entry.itemId].kind==='passive'&&adjacentTo(item,entry)):[];
  const neighborList=neighbors.length?'<section class="tooltip-synergies"><small>ADJACENT BOOSTS</small>'+neighbors.map((passive)=>'<div class="tooltip-passive"><b>'+ITEMS[passive.itemId].name+' · LV '+(passive.level??1)+'</b><span>'+passiveBonusAtLevel(passive)+'</span></div>').join('')+'</section>':'<section class="tooltip-synergies"><small>ADJACENT BOOSTS</small><span class="tooltip-no-passives">No passive items adjacent</span></section>';
  tooltipNode.style.setProperty('--tooltip-quality',rarity.color);
  tooltipNode.innerHTML='<span class="tooltip-kind">'+definition.kind.toUpperCase()+'</span><div class="tooltip-title"><b>'+definition.name+'</b><span class="tooltip-level-badge"><i aria-hidden="true">★</i><b>'+level+'</b></span></div><p>'+definition.description+'</p>'+neighborList+'<div class="tooltip-stats"><small>RESULTING STATS</small>'+tooltipStatRows(tooltipStatValues(item))+'</div>'+tooltipUpgradePreview(upgradeTarget);
  tooltipNode.hidden=false;positionItemTooltip(anchor);
}
function positionItemTooltip(anchor) {
  if(!anchor?.getBoundingClientRect)return;
  const margin=10,gap=12,rect=anchor.getBoundingClientRect(),width=tooltipNode.offsetWidth,height=tooltipNode.offsetHeight;
  const candidates=[{left:rect.right+gap,top:rect.top},{left:rect.left-width-gap,top:rect.top},{left:rect.left,top:rect.bottom+gap},{left:rect.left,top:rect.top-height-gap}];
  const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));
  const placements=candidates.map((candidate)=>({left:clamp(candidate.left,margin,window.innerWidth-width-margin),top:clamp(candidate.top,margin,window.innerHeight-height-margin)}));
  const overlap=(placement)=>Math.max(0,Math.min(placement.left+width,rect.right)-Math.max(placement.left,rect.left))*Math.max(0,Math.min(placement.top+height,rect.bottom)-Math.max(placement.top,rect.top));
  const preferred=candidates.find(({left,top})=>left>=margin&&top>=margin&&left+width<=window.innerWidth-margin&&top+height<=window.innerHeight-margin);
  const placement=preferred?{left:preferred.left,top:preferred.top}:placements.sort((a,b)=>overlap(a)-overlap(b))[0];
  const left=placement.left,top=placement.top;
  tooltipNode.style.left=`${left}px`;tooltipNode.style.top=`${top}px`;
}
function hideItemTooltip() { tooltipNode.hidden = true; }
function ensureLootAudio() { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return null; try { const context = playRarityDing.context ??= new Audio(); if (context.state === 'suspended') context.resume(); return context; } catch { return null; } }
function playRarityDing(rarity) {
  const context = ensureLootAudio();
  if (!context) return;
  try {
    // A major pentatonic pickup phrase: clear, warm, and increasingly sparkly by rarity.
    const notes = {
      common: [1046.5, 1318.51],
      rare: [1046.5, 1318.51, 1567.98],
      epic: [1046.5, 1318.51, 1567.98, 2093],
      legendary: [1046.5, 1318.51, 1567.98, 2093, 2637.02]
    }[rarity] ?? [1046.5, 1318.51];
    const now = context.currentTime;
    for (const [index, frequency] of notes.entries()) {
      const start = now + index * .068;
      const fundamental = context.createOscillator();
      const overtone = context.createOscillator();
      const body = context.createGain();
      const sparkle = context.createGain();
      fundamental.type = 'sine';
      fundamental.frequency.setValueAtTime(frequency * .94, start);
      fundamental.frequency.exponentialRampToValueAtTime(frequency, start + .025);
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(frequency * 2, start);
      body.gain.setValueAtTime(.0001, start);
      body.gain.exponentialRampToValueAtTime(index === notes.length - 1 ? .12 : .082, start + .012);
      body.gain.exponentialRampToValueAtTime(.0001, start + .32);
      sparkle.gain.setValueAtTime(.0001, start);
      sparkle.gain.exponentialRampToValueAtTime(.018, start + .008);
      sparkle.gain.exponentialRampToValueAtTime(.0001, start + .14);
      fundamental.connect(body).connect(context.destination);
      overtone.connect(sparkle).connect(context.destination);
      fundamental.start(start);
      overtone.start(start);
      fundamental.stop(start + .34);
      overtone.stop(start + .16);
    }
  } catch { /* Audio is optional; loot remains fully visible. */ }
}
function playCreditSound() { const context = ensureLootAudio(); if (!context) return; try { const now = context.currentTime; for (const [index, frequency] of [880, 1174.66, 1568].entries()) { const oscillator = context.createOscillator(), gain = context.createGain(); oscillator.type = index === 0 ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(frequency * .72, now + index * .055); oscillator.frequency.exponentialRampToValueAtTime(frequency, now + index * .055 + .045); gain.gain.setValueAtTime(.0001, now + index * .055); gain.gain.exponentialRampToValueAtTime(.085, now + index * .055 + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + index * .055 + .19); oscillator.connect(gain).connect(context.destination); oscillator.start(now + index * .055); oscillator.stop(now + index * .055 + .21); } } catch { /* Credit feedback is visual when audio is unavailable. */ } }
function playLootPickupSound(rarity) { const context=ensureLootAudio(); if(!context) return; try { const now=context.currentTime,rank=['common','rare','epic','legendary'].indexOf(rarity),scale=1+Math.max(0,rank)*.08; for(const [index,frequency] of [587.33,880,1174.66,1760].entries()) { const start=now+index*.045,oscillator=context.createOscillator(),gain=context.createGain(); oscillator.type=index===3?'sine':'triangle'; oscillator.frequency.setValueAtTime(frequency*scale,start); oscillator.frequency.exponentialRampToValueAtTime(frequency*scale*1.035,start+.055); gain.gain.setValueAtTime(.0001,start); gain.gain.exponentialRampToValueAtTime(index===3?.035:.075,start+.012); gain.gain.exponentialRampToValueAtTime(.0001,start+.2); oscillator.connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start+.22); } } catch { /* Pickup feedback remains visual when audio is unavailable. */ } }
function perkLevel(id) { return state.perks[id] ?? 0; }
function getMaxHealth() { return 100 + perkLevel('hull') * 10; }
function getEffectiveWeaponStats(items, weapon) {
  const stats=getWeaponStats(items,weapon);
  stats.damage*=1+perkLevel('damage')*.08;
  stats.cooldown*=Math.max(.75,1-perkLevel('cooldown')*.05);
  return stats;
}
function updateCreditDisplays() {
  const value=String(state.credits).padStart(3,'0');
  document.querySelector('#credit-count').textContent=value;
  document.querySelector('#meta-credit-count').textContent=`${value} CR`;
}
function updateVitals() {
  const maxHealth=getMaxHealth();
  document.querySelector('#health-value').textContent=`${Math.ceil(state.health)} / ${maxHealth}`;
  document.querySelector('#health-fill').style.width=`${Math.min(100,state.health/maxHealth*100)}%`;
  document.querySelector('#health-fill').classList.toggle('critical',state.health<35);
  document.querySelector('#shield-hud').hidden=state.shield<=0;
  document.querySelector('#shield-value').textContent=`${Math.ceil(state.shield)} / ${PLAYER_SHIELD_CAP}`;
  document.querySelector('#shield-fill').style.width=`${Math.min(100,state.shield/PLAYER_SHIELD_CAP*100)}%`;
}
function setHangarMode(isHangar) {
  document.querySelector('.arena-wrap').classList.toggle('is-hangar',isHangar);
  document.querySelector('.arena-panel').classList.toggle('is-hangar',isHangar);
  document.querySelector('.arena-topline .eyebrow').textContent=isHangar?'SAFE DOCK · DISTRICT 07':'NEON DISTRICT';
  document.querySelector('.arena-topline h1').textContent=isHangar?'The hangar.':'Last train out.';
  document.querySelector('.stage-number').textContent=isHangar?'H':'01';
  document.querySelector('.stage-chip span:last-child').innerHTML=isHangar?'TRANSIT<br>HANGAR':'THE<br>UNDERCITY';
}
function startRun() { ensureLootAudio(); state.running=true;state.paused=false;state.health=getMaxHealth();state.shield=Math.min(PLAYER_SHIELD_CAP,perkLevel('shield')*25);updateVitals();state.kills=0;state.elapsed=0;setHangarMode(false);document.querySelector('#hangar-screen').hidden=true;document.querySelector('#kill-count').textContent='00';document.querySelector('#pause-button').textContent='Ⅱ';const scene=game.scene.getScene('undercity');scene.clearEnemyShots();scene.combatNow=0;scene.lastShot.clear();scene.events.emit('resume-run');game.scene.resume('undercity');returnFocusToGame(); }
function finishRun(won) {
  state.running=false;state.paused=true;game.scene.getScene('undercity')?.clearEnemyShots();
  const earned=Math.floor(state.kills/5)*10+Math.floor(state.elapsed/60)*10+(won?50:0);
  state.credits+=earned;saveProgression(state);updateCreditDisplays();
  const scene=game.scene.getScene('undercity');
  for(const shot of scene.shots){shot.graphic.destroy();}scene.shots.length=0;
  setHangarMode(true);document.querySelector('#hangar-screen').hidden=false;
  document.querySelector('#hangar-summary').textContent=`${won?'Evacuation complete':'Run ended'} · ${state.kills} drones down · ${Math.floor(state.elapsed)} seconds survived · +${earned} CR banked.`;
  renderMetaUpgrades();
}

gridNode.addEventListener('keydown', (event) => {
  const dirs = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
  if (dirs[event.key]) { event.preventDefault(); moveGrid(...dirs[event.key]); }
  if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); handleBackpackConfirm(); }
  if (event.key === 'Escape') { event.preventDefault(); cancelCarried(); }
});
window.addEventListener('pointermove', (event) => {
  const start = state.pointerStart;
  if (start && !state.carried && Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) >= 8) {
    state.backpackFocus = true; state.suppressClick = true;
    state.selected = { x: start.x, y: start.y }; pickupItem(start.uid);
    state.pointerDragOffset = { x: start.grabX, y: start.grabY }; state.pointerDragging = true;
  }
  const item = state.items.find((entry) => entry.uid === state.carried);
  if (!item || !state.pointerDragging) return;
  const pointerCell = gridCellFromPoint(event.clientX, event.clientY);
  if (!pointerCell) return;
  const offset = state.pointerDragOffset ?? { x: 0, y: 0 }, next = placementAnchor(item, pointerCell.x - offset.x, pointerCell.y - offset.y);
  if (next.x === state.selected.x && next.y === state.selected.y) return;
  state.selected = next; renderBackpack();
});
window.addEventListener('pointerup', (event) => {
  if (state.pointerId !== null && event.pointerId !== state.pointerId) return;
  const start = state.pointerStart, dragged = Boolean(start && state.carried && state.pointerDragging);
  state.pointerStart = null; state.pointerId = null;
  if (!dragged) return;
  const pointerCell = gridCellFromPoint(event.clientX, event.clientY), offset = state.pointerDragOffset ?? { x: 0, y: 0};
  state.pointerDragging = false; state.pointerDragOffset = null;
  if (pointerCell) { const item = state.items.find((entry) => entry.uid === state.carried), anchor = placementAnchor(item, pointerCell.x - offset.x, pointerCell.y - offset.y); placeCarried(anchor.x, anchor.y); }
  else cancelCarried();
  setTimeout(() => { state.suppressClick = false; }, 0);
});
window.addEventListener('keydown', (event) => { if (state.running && event.key === ' ' && document.activeElement !== gridNode) { event.preventDefault(); handleBackpackConfirm(); } if (state.running && event.key === 'Escape') cancelCarried(); if (event.key === 'Tab' && state.running) { event.preventDefault(); if (state.backpackFocus) returnFocusToGame(); else { state.backpackFocus = true; focusSelectedCell(); } showToast(state.backpackFocus ? 'BACKPACK CONTROL' : 'CHARACTER CONTROL'); } });
document.querySelector('#start-button').addEventListener('click', startRun);
renderMetaUpgrades();updateCreditDisplays();
const devOptionsToggle=document.querySelector('#dev-options-toggle'),devOptions=document.querySelector('#dev-options');
function toggleDevOptions() { const expanded=devOptionsToggle.getAttribute('aria-expanded')==='true'; devOptionsToggle.setAttribute('aria-expanded',String(!expanded)); devOptions.hidden=expanded; }
devOptionsToggle.addEventListener('dblclick',toggleDevOptions);
devOptionsToggle.addEventListener('click',(event)=>{if(event.detail===0)toggleDevOptions();});
devOptions.querySelectorAll('[data-dev-rarity]').forEach((button)=>button.addEventListener('click',()=>game.scene.getScene('undercity')?.spawnDebugLoot(button.dataset.devRarity)));
window.addEventListener('keydown', (event) => { if (event.repeat || !state.running) return; const scene = game.scene.getScene('undercity'), key = event.key.toLowerCase(); if (state.carried && key === 'x' && state.heldLoot !== state.carried) { event.preventDefault(); sellCarriedInventoryItem(); return; } if (state.carried && (key === 'q' || key === 'e')) { event.preventDefault(); rotateCarried(key === 'e' ? 1 : -1); return; } if (key === 'e' && scene?.nearbyLoot && !state.heldLoot) scene.pickUpFloorLoot(scene.nearbyLoot); if (key === 'q' && scene?.nearbyLoot && !state.carried) scene.sellFloorLoot(scene.nearbyLoot); });
document.querySelector('#sell-carried').addEventListener('click', sellCarriedInventoryItem);
document.querySelector('#loot-pickup').addEventListener('click', () => { const scene = game.scene.getScene('undercity'); if (scene?.nearbyLoot) scene.pickUpFloorLoot(scene.nearbyLoot); });
document.querySelector('#loot-sell').addEventListener('click', () => { const scene = game.scene.getScene('undercity'); if (scene?.nearbyLoot) scene.sellFloorLoot(scene.nearbyLoot); });
document.querySelector('#pause-button').addEventListener('click', () => { if (!state.running || state.heldLoot) return; state.paused = !state.paused; document.querySelector('#pause-button').textContent = state.paused ? '▶' : 'Ⅱ'; });
window.addEventListener('gamepadconnected', () => showToast('CONTROLLER CONNECTED · D-PAD / STICK TO ARRANGE'));
renderBackpack();
