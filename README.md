# Neon Outrun

A neon cyberpunk roguelite prototype that mixes automatic-survivor combat with a grid-based gear backpack. Built with Phaser 3, the same game engine used by Venice.

## Play

```sh
npm install
npm run dev
```

## Controls

- Fly: WASD, arrow keys, or controller left stick. The drone accelerates and coasts; the camera follows over a scrolling neon rooftop city.
- Arrange equipped gear in the shared 3×3 grid: drag and drop, or select an item and then a cell. Active weapons occupy different footprints; adjacent passive gear buffs active weapons. Drop onto one item to swap; dropping across multiple items sends all overlapped gear to the floor.
- Sell equipped gear for credits: pick it up in the inventory, then use the SELL button or press X/controller X.
- Hover or focus an item for its tooltip. Active items show the interval between shots and a live clock countdown over the item icon.
- Pick up glowing floor loot with E or controller A. Combat pauses until it is placed; Escape or controller B drops it back on the floor. Press Q or controller X to sell nearby floor loot for rarity-based credits.
- While carrying an item, move the live footprint preview with WASD, arrows, or the controller D-pad. Rotate with Q/E or controller LB/RB, then press Space or A to place. Q/E rotate only while carrying; near floor loot they sell/pick up as shown by the prompt.
- Backpack controller: D-pad focuses and moves the grid; A picks up or places; B cancels; Y or Tab switches back to character movement. The left stick moves your character until the backpack is focused.
- Weapons fire automatically while the run is active.

## Item model

Item definitions live in `src/items.js`. Every rarity pool has one active and one passive item. Loot first rolls a rarity using explicit weights, then chooses uniformly from that rarity's pool, so adding items to a pool does not alter rarity odds. Item stats, cooldowns, passive adjacency effects, rarity, rotatable footprint, and credit sale value are data-driven.
