// Shared constants and item catalog for client + server.
// Keep this file plain JS so both browser and Node import cleanly.

export const NET = {
  TICK_RATE: 20,                 // server broadcast Hz
  PLAYER_SEND_HZ: 30,            // client input send rate (повышено для меньшего рассинхрона yaw)
  ROOM_NAME: "arena",
  MAX_PLAYERS: 8,
};

export const WORLD = {
  ARENA_RADIUS: 600,             // 1200м диаметр по ТЗ v0.0.3.0
  ARENA_HEIGHT: 100,
  HUB_RADIUS: 36,                // legacy, не используется
  GRAVITY: 20,                   // руки-меч уже с гравитацией — не летаем
  BASE_MOVE_SPEED: 6,
  BASE_FLY_SPEED: 5,
  DASH_SPEED: 22,
  DASH_DURATION: 0.18,
  DASH_COOLDOWN: 1.1,
  RUN_MULT: 1.5,                 // Shift
  FOG_NEAR: 60,                  // начало тумана
  FOG_FAR: 100,                  // полный туман (ТЗ: обзор 100м)
};

// v0.0.3.0: HP=100 по ТЗ
export const COMBAT = {
  PLAYER_MAX_HP: 100,
  ENEMY_MAX_HP: 40,              // Cacodemon-крохи, чтобы меч ощущался
  ARMORED_ENEMY_MAX_HP: 80,
  GHOST_STAT_MULT: 0.1,
  MELEE_RANGE: 2.2,
  RESPAWN_INVULN_S: 1.5,
  FALL_RESPAWN_HP_PCT: 0.05,     // ТЗ: падение в дыру → 5% HP на краю
  REGEN_DELAY_S: 3.0,            // регенерация вне боя
  REGEN_PER_S: 5,
};

// Cast definitions — 3 hand types (FIRE / ICE / BONE), каждый со своим спеллом.
export const HAND_TYPES = {
  FIRE: { id: "FIRE", color: 0xff5a1f, name: "Огненная",  spell: "FIREBALL" },
  ICE:  { id: "ICE",  color: 0x66ccff, name: "Ледяная",   spell: "ICEBOLT" },
  BONE: { id: "BONE", color: 0xe6d8b0, name: "Костяная",  spell: "BONE_SHARD" },
  CHAIN:{ id: "CHAIN",color: 0x9be7ff, name: "Грозовая", spell: "CHAIN_LIGHTNING" },
};

export const SPELLS = {
  FIREBALL:   { cooldown: 0.35, projectileSpeed: 40, damage: 1, radius: 0.6, color: 0xff5a1f, life: 2.0 },
  ICEBOLT:    { cooldown: 0.30, projectileSpeed: 48, damage: 1, radius: 0.4, color: 0x66ccff, life: 1.8 },
  BONE_SHARD: { cooldown: 0.20, projectileSpeed: 55, damage: 1, radius: 0.3, color: 0xffe0a0, life: 1.5 },
  // Цепная молния: мгновенный хит, не снаряд, прыгает по цепи
  CHAIN_LIGHTNING: {
    cooldown: 0.60, isChain: true, damage: 2, color: 0x9be7ff,
    initialRange: 30,   // дальность первого захвата (конус)
    initialConeCos: 0.85, // ~±32° от взгляда
    jumpRange: 10,      // дальность прыжка между врагами
    maxJumps: 10,       // макс целей в цепи
    falloff: 0.85,      // урон каждого следующего = 85% от предыдущего
  },
  // v0.0.3.0: Звёздопад — AoE удар мечом по точке взгляда
  STARFALL: {
    cooldown: 0.5, isStarfall: true, damage: 30, color: 0xff40a0,
    range: 15,       // дальность от игрока к точке AoE
    radius: 5,       // радиус AoE
  },
};

// Enemies — DOOM 1 inspired
export const ENEMY_TYPES = {
  IMP:       { id: "IMP",       hp: 2, speed: 4.5, size: 1.0,  scale: 1.8,  damage: 1, sprite: "imp",       colorTint: 0xffffff },
  PINKY:     { id: "PINKY",     hp: 4, speed: 5.5, size: 1.4,  scale: 2.6,  damage: 1, sprite: "pinky",     colorTint: 0xffffff, armored: true  },
  CACO:      { id: "CACO",      hp: 2, speed: 3.5, size: 1.2,  scale: 3.0,  damage: 1, sprite: "caco",      colorTint: 0xffffff, flying: true   },
  BARON:     { id: "BARON",     hp: 4, speed: 3.0, size: 2.0,  scale: 4.5,  damage: 1, sprite: "baron",     colorTint: 0xffffff },
  FLYER:     { id: "FLYER",     hp: 1, speed: 4.5, size: 0.9,  scale: 2.4,  damage: 1, sprite: "caco",      colorTint: 0xffee88, flying: true   },
  COLOSSUS:  { id: "COLOSSUS",  hp: 10, speed: 1.2, size: 8.0, scale: 30.0, damage: 1, sprite: "colossus",  colorTint: 0xffffff, boss: true     },
};

// Пассивные предметы (надето — постоянный бафф). На MVP: 3 штуки.
// Первый найденный = надетый (по текущей реализации). Надетый пассив — items[0].
export const ITEMS = [
  { id: "BLOODSTONE",  tier: "common", name: "Кровавый камень", effect: "+2 макс. HP",      color: 0xdd2244, glyph: "◇" },
  { id: "SWIFTBOOT",   tier: "common", name: "Скороход",         effect: "+30% скорость",   color: 0x66ff99, glyph: "△" },
  { id: "EMBER_SIGIL", tier: "common", name: "Сигил Углей",     effect: "+50% урон",         color: 0xff9922, glyph: "✦" },
];
// Мап для быстрого поиска по id
export const ITEMS_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// Level structure (MVP: 1 arena + hub)
export const LEVELS = [
  { id: "ARENA_1", waves: 3, colossusAt: 3, portalCharge: 12 }, // 12 blood units needed
];

export function pickRandom(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}
