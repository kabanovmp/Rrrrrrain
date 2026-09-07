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
  HUB_RADIUS: 36,                // радиус хаба (слоты, сундуки, портал, край)
  GRAVITY: 20,                   // руки-меч уже с гравитацией — не летаем
  BASE_MOVE_SPEED: 6,
  BASE_FLY_SPEED: 5,
  DASH_SPEED: 22,
  DASH_DURATION: 0.18,
  DASH_COOLDOWN: 1.1,
  RUN_MULT: 1.5,                 // Shift
  FOG_NEAR: 60,                  // начало тумана
  FOG_FAR: 100,                  // полный туман (ТЗ: обзор 100м)
  PICKUP_RING: 32,               // пикапы арены — внутри тумана, видны со спавна
  PORTAL_DIST: 34,               // арена: портал внутри тумана (~100м), не за 240м
  PORTAL_HOLD_S: 1.5,
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
  STARFALL: {
    cooldown: 0.5, isStarfall: true, damage: 30, color: 0xff40a0,
    range: 15, radius: 5, aimTube: 2.8, damageMin: 25, damageMax: 35, aimSpread: 0.4,
  },
  STAR_BOLT: {
    cooldown: 1.0, isHoming: true, damage: 34, projectileSpeed: 34,
    visRange: 100, visConeCos: 0.12, life: 4.2, radius: 0.55, color: 0xff40a0,
  },
  STAR_SHIELD: {
    cooldown: 2.0, isShield: true, absorb: 100, duration: 0, color: 0xff40a0,
  },
  STAR_BLOCK: {
    cooldown: 2.0, isShield: true, absorb: 100, duration: 0, color: 0xff40a0,
  },
  BOLT_HITSCAN: {
    cooldown: 0.45, isHitscan: true, damage: 42, range: 120, tube: 0.6, color: 0x88eeff,
  },
  CHAIN_STORM: {
    cooldown: 30, isChainStorm: true, damage: 150, damageStep: 10, maxJumps: 10,
    initialRange: 90, jumpRange: 24, initialConeCos: 0.7, color: 0xaaddff,
  },
  DAGGER_CHARGE: { cooldown: 1.0, isDaggerCharge: true },
  DAGGER_THROW: {
    cooldown: 0.7, isDaggerThrow: true, damage: 18, projectileSpeed: 38,
    visRange: 100, life: 3.6, radius: 0.38, color: 0xc8d8e8,
  },
  CIG_PUFF: { cooldown: 0.7, isCosmetic: true, fx: "cig_puff", color: 0x888888 },
  CIG_BLOW: { cooldown: 1.1, isCosmetic: true, fx: "cig_blow", color: 0xbbbbbb },
};

// v0.0.3.1: активные магические карты. Карта модифицирует поведение активного оружия.
export const CARDS = {
  ANGER: {
    id: "ANGER", name: "ANGER", subtitle: "Hit them twice",
    effect: "doubleShot", color: 0xff2020, icon: "card-anger.jpg",
  },
  FRENZY: {
    id: "FRENZY", name: "FRENZY", subtitle: "More of them / run faster",
    effect: "spawnMove", spawnMul: 3, moveMul: 2, color: 0xff6622, icon: "card-frenzy.jpg",
  },
  RAIN: {
    id: "RAIN", name: "RAIN", subtitle: "It falls on everyone",
    effect: "meteorRain", color: 0xff3311, icon: "card-rain.jpg",
    interval: 0.42, radius: 7, enemyDamage: 28, playerDamage: 10, visRange: 90,
  },
};
export const CARDS_BY_ID = CARDS;

// v0.0.3.1: каталог активного оружия (то что кладётся в руку)
export const WEAPONS = {
  STAR_SWORD: {
    id: "STAR_SWORD", name: "Звёздный Меч",
    lmb: "STAR_BOLT", rmb: "STAR_SHIELD",
    icon: "card-sword.jpg", hud: "sword",
    lmbHint: "1 звезда/с, автонаведение", rmbHint: "щит 100 HP вокруг тебя",
  },
  LIGHTNING_STAFF: {
    id: "LIGHTNING_STAFF", name: "Посох Молний",
    lmb: "BOLT_HITSCAN", rmb: "CHAIN_STORM",
    icon: "staff", hud: "staff",
    lmbHint: "молния по лучу взгляда", rmbHint: "цепь 10 целей, КД 30с",
  },
  DAGGERS: {
    id: "DAGGERS", name: "Кинжалы",
    lmb: "DAGGER_CHARGE", rmb: "DAGGER_THROW",
    icon: "daggers", hud: "daggers", palmUp: true,
    lmbHint: "держать: +1 нож/с, макс 10", rmbHint: "все ножи по целям",
  },
  CIGARETTE: {
    id: "CIGARETTE", name: "Сигарета",
    lmb: "CIG_PUFF", rmb: "CIG_BLOW",
    icon: "cig", hud: "cig", cosmetic: true,
    lmbHint: "затянуться", rmbHint: "выпустить дым",
  },
};
export const WEAPONS_BY_ID = WEAPONS;

// v0.0.3.1: AI Director — бюджет-based спавн
export const AI_DIRECTOR = {
  BUDGET_START: 10000,
  BUDGET_REGEN_PER_SEC: 8,   // приток бюджета в секунду
  WAVE_MIN_SIZE: 3,
  WAVE_MAX_SIZE: 7,
  WAVE_INTERVAL_MIN: 6,
  WAVE_INTERVAL_MAX: 12,
  AGGRO_RANGE: 92,
  VISION_RANGE: 92,
  LEASH_RANGE: 115,
  CORPSE_LINGER_S: 8.0,
  // стоимость в бюджете для каждого типа
  COSTS: {
    GROUND_CRAWLER: 25,
    FLYING_SHOOTER: 80,
    CACO: 60,
    IMP: 20,
    PINKY: 60,
    BARON: 200,
    COLOSSUS: 800,
  },
};

// Enemies — DOOM 1 inspired + v0.0.3.1 новые: GROUND_CRAWLER, FLYING_SHOOTER
export const ENEMY_TYPES = {
  IMP:       { id: "IMP",       hp: 2, speed: 4.5, size: 1.0,  scale: 1.8,  damage: 1, sprite: "imp",       colorTint: 0xffffff, hidden: true },
  PINKY:     { id: "PINKY",     hp: 4, speed: 5.5, size: 1.4,  scale: 2.6,  damage: 1, sprite: "pinky",     colorTint: 0xffffff, armored: true, hidden: true  },
  CACO:      { id: "CACO",      hp: 2, speed: 3.5, size: 1.2,  scale: 3.0,  damage: 1, sprite: "caco",      colorTint: 0xffffff, flying: true   },
  BARON:     { id: "BARON",     hp: 4, speed: 3.0, size: 2.0,  scale: 4.5,  damage: 1, sprite: "baron",     colorTint: 0xffffff, hidden: true },
  FLYER:     { id: "FLYER",     hp: 1, speed: 4.5, size: 0.9,  scale: 2.4,  damage: 1, sprite: "caco",      colorTint: 0xffee88, flying: true, hidden: true   },
  COLOSSUS:  { id: "COLOSSUS",  hp: 10, speed: 1.2, size: 8.0, scale: 30.0, damage: 1, sprite: "colossus",  colorTint: 0xffffff, boss: true     },
  // v0.0.3.1: Наземный вылазок — 5 процедурных вариаций (см. GROUND_CRAWLER_VARIANTS)
  GROUND_CRAWLER: {
    id: "GROUND_CRAWLER", hp: 22, speed: 4.2, size: 1.5, scale: 3.2, damage: 8,
    sprite: "caco", colorTint: 0xffffff, flying: true, hoverY: 10,
    fireCount: 3, fireDamage: 9, fireSpeed: 26, fireCooldown: 0.38,
    engageRange: 126, disengageRange: 140, fireLife: 11.4, fireSpread: 0.22,
  },
  FLYING_SHOOTER: {
    id: "FLYING_SHOOTER", hp: 25, speed: 4.5, size: 1.5, scale: 3.5, damage: 10,
    sprite: "caco", colorTint: 0xffffff, flying: true, hoverY: 12,
    fireCount: 3, fireDamage: 8, fireSpeed: 24, fireCooldown: 0.4, engageRange: 120, disengageRange: 140,
    fireLife: 11, fireSpread: 0.22,
  },
};

// v0.0.3.1: 5 процедурных вариаций Ground Crawler.
// Клиент/сервер каждый раз выбирает variant 0..4 при спавне.
export const GROUND_CRAWLER_VARIANTS = [
  { tint: 0xff8080, sizeMul: 1.00, speedMul: 1.00, hpMul: 1.00 },
  { tint: 0x80ff80, sizeMul: 0.85, speedMul: 1.15, hpMul: 0.85 },
  { tint: 0x8080ff, sizeMul: 1.15, speedMul: 0.85, hpMul: 1.20 },
  { tint: 0xffff80, sizeMul: 0.95, speedMul: 1.05, hpMul: 0.90 },
  { tint: 0xff80ff, sizeMul: 1.10, speedMul: 0.95, hpMul: 1.10 },
];

// Пассивные предметы (надето — постоянный бафф). На MVP: 3 штуки.
// Первый найденный = надетый (по текущей реализации). Надетый пассив — items[0].
export const ITEMS = [
  { id: "BLOODSTONE",  tier: "common", name: "Кровавый камень", effect: "+2 макс. HP",      color: 0xdd2244, glyph: "◇" },
  { id: "SWIFTBOOT",   tier: "common", name: "Скороход",         effect: "+30% скорость",   color: 0x66ff99, glyph: "△" },
  { id: "EMBER_SIGIL", tier: "common", name: "Сигил Углей",     effect: "+50% урон",         color: 0xff9922, glyph: "✦" },
];
// Мап для быстрого поиска по id
export const ITEMS_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// Level structure — v0.0.3.1: 5 уровней + 1 босс.
// skyColor / floorColor задают уникальную планетарную тему для каждого уровня.
export const LEVELS = [
  { id: "L1", label: "Пустошь Звёзд",   skyColor: 0x000000, floorColor: 0x0a0a0a, portalCharge: 10, stars: true  },
  { id: "L2", label: "Марсианские Дюны", skyColor: 0x2a0a1a, floorColor: 0x3a1a10, portalCharge: 12, planet: 0xff5522 },
  { id: "L3", label: "Ледяная Пустыня", skyColor: 0x0a1a2a, floorColor: 0x2a4050, portalCharge: 14, planet: 0x66ccff },
  { id: "L4", label: "Золотая Пустыня",  skyColor: 0x2a2a0a, floorColor: 0x4a3a1a, portalCharge: 16, planet: 0xffdd66 },
  { id: "L5", label: "Пурпурная Бездна", skyColor: 0x1a002a, floorColor: 0x2a1a3a, portalCharge: 18, planet: 0xcc44ff },
  { id: "BOSS", label: "Логово Владыки", skyColor: 0x1a0000, floorColor: 0x2a0000, portalCharge: 25, planet: 0xff2020, boss: true },
];

export function pickRandom(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}
