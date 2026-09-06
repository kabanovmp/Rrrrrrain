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
    damageMin: 25,   // ТЗ v0.0.3.1: 25-35 HP
    damageMax: 35,
    aimSpread: 1.2,  // небольшой разброс точки падения
  },
  // v0.0.3.1: Звёздный Блок (ПКМ мечом): барьер перед игроком поглощает урон
  STAR_BLOCK: {
    cooldown: 10.0, isBlock: true, absorb: 50, duration: 3.0, color: 0xff40a0,
  },
};

// v0.0.3.1: активные магические карты. Карта модифицирует поведение активного оружия.
export const CARDS = {
  ANGER: { id: "ANGER", name: "ANGER", subtitle: "Hit them twice", effect: "doubleShot", color: 0xff2020, icon: "card-anger.jpg" },
};
export const CARDS_BY_ID = CARDS;

// v0.0.3.1: каталог активного оружия (то что кладётся в руку)
export const WEAPONS = {
  STAR_SWORD: {
    id: "STAR_SWORD", name: "Магический Звёздный Меч",
    lmb: "STARFALL", rmb: "STAR_BLOCK",
    icon: "card-sword.jpg", handIcon: "sword-hand.jpg", baseCoef: 1.0,
  },
};
export const WEAPONS_BY_ID = WEAPONS;

// v0.0.3.1: AI Director — бюджет-based спавн
export const AI_DIRECTOR = {
  BUDGET_START: 10000,
  BUDGET_REGEN_PER_SEC: 8,   // приток бюджета в секунду
  WAVE_MIN_SIZE: 3,
  WAVE_MAX_SIZE: 7,
  WAVE_INTERVAL_MIN: 6,      // сек между волнами
  WAVE_INTERVAL_MAX: 12,
  AGGRO_RANGE: 45,           // вне этого — патруль
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
    id: "GROUND_CRAWLER", hp: 15, speed: 3.2, size: 1.1, scale: 1.8, damage: 8,
    sprite: "crawler", colorTint: 0xffffff, emergeTime: 1.2,
  },
  // v0.0.3.1: Cacodemon Flying Shooter — hover, стреляет 1-3 огненных шара
  FLYING_SHOOTER: {
    id: "FLYING_SHOOTER", hp: 25, speed: 4.5, size: 1.5, scale: 3.5, damage: 10,
    sprite: "caco", colorTint: 0xffffff, flying: true, hoverY: 6.5,
    fireCount: 3, fireDamage: 8, fireSpeed: 22, fireCooldown: 0.35, engageRange: 40, disengageRange: 55,
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
