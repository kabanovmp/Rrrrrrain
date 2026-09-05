// Shared constants and item catalog for client + server.
// Keep this file plain JS so both browser and Node import cleanly.

export const NET = {
  TICK_RATE: 20,                 // server broadcast Hz
  PLAYER_SEND_HZ: 20,            // client input send rate
  ROOM_NAME: "arena",
  MAX_PLAYERS: 8,
};

export const WORLD = {
  ARENA_RADIUS: 60,
  ARENA_HEIGHT: 40,
  HUB_RADIUS: 12,
  GRAVITY: 0,                    // sgustok floats
  BASE_MOVE_SPEED: 6,
  BASE_FLY_SPEED: 5,
  DASH_SPEED: 22,
  DASH_DURATION: 0.18,
  DASH_COOLDOWN: 1.1,
};

// 1.5-hit system: 2 HP total, first hit cracks, second hit kills.
export const COMBAT = {
  PLAYER_MAX_HP: 2,
  ENEMY_MAX_HP: 2,
  ARMORED_ENEMY_MAX_HP: 4,       // 3 hits to break armor + 1 for kill
  GHOST_STAT_MULT: 0.1,          // ×10 меньше
  MELEE_RANGE: 2.2,
  RESPAWN_INVULN_S: 1.5,
};

// Cast definitions — какими бывают заклинания в руках (MVP: 3 hand types + 3 spells).
export const HAND_TYPES = {
  FIRE:   { id: "FIRE",   color: 0xff5a1f, name: "Огненная лапа",   spell: "FIREBALL"   },
  BONE:   { id: "BONE",   color: 0xe6d8b0, name: "Костяная лапа",   spell: "BONE_SHARD" },
  SMOKE:  { id: "SMOKE",  color: 0x7d5cff, name: "Дымное щупальце", spell: "PUSH_WAVE"  },
};

export const SPELLS = {
  FIREBALL:   { cooldown: 0.35, projectileSpeed: 40, damage: 1, radius: 0.6, color: 0xff6a2a, life: 2.0 },
  BONE_SHARD: { cooldown: 0.20, projectileSpeed: 55, damage: 1, radius: 0.3, color: 0xffe0a0, life: 1.5 },
  PUSH_WAVE:  { cooldown: 0.60, projectileSpeed: 0,  damage: 1, radius: 6.0, color: 0xa080ff, life: 0.35, isAoe: true },
};

// Enemies — DOOM 1 inspired
export const ENEMY_TYPES = {
  IMP:       { id: "IMP",       hp: 2, speed: 4.5, size: 1.0,  scale: 1.8,  damage: 1, sprite: "imp",       colorTint: 0xffffff },
  PINKY:     { id: "PINKY",     hp: 4, speed: 5.5, size: 1.4,  scale: 2.6,  damage: 1, sprite: "pinky",     colorTint: 0xffffff, armored: true  },
  CACO:      { id: "CACO",      hp: 2, speed: 3.5, size: 1.2,  scale: 3.0,  damage: 1, sprite: "caco",      colorTint: 0xffffff, flying: true   },
  BARON:     { id: "BARON",     hp: 4, speed: 3.0, size: 2.0,  scale: 4.5,  damage: 1, sprite: "baron",     colorTint: 0xffffff },
  COLOSSUS:  { id: "COLOSSUS",  hp: 10, speed: 1.2, size: 8.0, scale: 30.0, damage: 1, sprite: "colossus",  colorTint: 0xffffff, boss: true     },
};

// MVP items with hidden tiers. Effects are unknown to player by design.
export const ITEMS = [
  { id: "RING_QUICK",     tier: "common",   effect: "cast_cooldown_-15%",        color: 0xffdd44 },
  { id: "RING_LIFESTEAL", tier: "rare",     effect: "5%_heal_on_kill",           color: 0xff3355 },
  { id: "BAND_SHIELD",    tier: "common",   effect: "one_time_damage_absorb",    color: 0x88aaff },
  { id: "GEM_CHAIN",      tier: "rare",     effect: "spells_chain_to_2_enemies", color: 0xaa66ff },
  { id: "SIGIL_DASH",     tier: "common",   effect: "dash_cd_-40%",              color: 0x33ffcc },
  { id: "MOTE_ECHO",      tier: "rare",     effect: "every_3rd_cast_free",       color: 0xffffff },
  { id: "IDOL_CHAIR",     tier: "common",   effect: "spawn_chair_on_cast",       color: 0xaa8844 },
  { id: "IDOL_HOMING",    tier: "rare",     effect: "spawned_objects_home",      color: 0xff88ff },
  { id: "BONE_HEART",     tier: "legendary",effect: "revive_once_per_run",       color: 0xffffff },
  { id: "TALON_HOOK",     tier: "common",   effect: "grappling_hook_hand",       color: 0x66ccff },
];

// Level structure (MVP: 1 arena + hub)
export const LEVELS = [
  { id: "ARENA_1", waves: 3, colossusAt: 3, portalCharge: 20 }, // 20 blood units needed
];

export function pickRandom(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}
