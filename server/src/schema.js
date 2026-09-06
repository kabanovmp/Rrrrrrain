import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class Vec3 extends Schema {}
type("number")(Vec3.prototype, "x");
type("number")(Vec3.prototype, "y");
type("number")(Vec3.prototype, "z");

export class Player extends Schema {
  constructor() {
    super();
    this.pos = new Vec3(); this.pos.x = 0; this.pos.y = 0; this.pos.z = 0;
    this.vel = new Vec3(); this.vel.x = 0; this.vel.y = 0; this.vel.z = 0;
    this.yaw = 0; this.pitch = 0;
    this.hp = 3;
    this.maxHp = 3;
    this.isGhost = false;
    this.hasLeftHand = false;
    this.hasRightHand = false;
    this.hasLegs = 0;
    this.leftHandType = "";
    this.rightHandType = "";
    this.itemsInBody = new ArraySchema();
    this.passiveItemId = "";
    this.name = "";
    // v0.0.3.1: активное оружие в руке + карты + рюкзак + Звёздный Блок
    this.weaponSlot = "STAR_SWORD"; // id активного оружия
    this.cards = new ArraySchema();      // 10 слотов, строки вида "ANGER" или ""
    this.backpack = new ArraySchema();   // бесконечный скролл, строки вида "CARD:ANGER" | "WEAPON:STAR_SWORD"
    this.blockActiveUntil = 0;   // сек-таймстамп когда блок активен (0 = не активен)
    this.blockAbsorbLeft = 0;    // сколько HP ещё может поглотить
    this.blockCdUntil = 0;       // когда Стар-блок снова готов
  }
}
type(Vec3)(Player.prototype, "pos");
type(Vec3)(Player.prototype, "vel");
type("number")(Player.prototype, "yaw");
type("number")(Player.prototype, "pitch");
type("number")(Player.prototype, "hp");
type("number")(Player.prototype, "maxHp");
type("boolean")(Player.prototype, "isGhost");
type("boolean")(Player.prototype, "hasLeftHand");
type("boolean")(Player.prototype, "hasRightHand");
type("number")(Player.prototype, "hasLegs");
type("string")(Player.prototype, "leftHandType");
type("string")(Player.prototype, "rightHandType");
type(["string"])(Player.prototype, "itemsInBody");
type("string")(Player.prototype, "passiveItemId");
type("string")(Player.prototype, "name");
type("string")(Player.prototype, "weaponSlot");
type(["string"])(Player.prototype, "cards");
type(["string"])(Player.prototype, "backpack");
type("number")(Player.prototype, "blockActiveUntil");
type("number")(Player.prototype, "blockAbsorbLeft");
type("number")(Player.prototype, "blockCdUntil");

export class Enemy extends Schema {
  constructor() {
    super();
    this.pos = new Vec3();
    this.enemyType = "IMP";
    this.hp = 2;
    this.maxHp = 2;
    this.alive = true;
    this.targetId = "";
    // v0.0.3.1
    this.variant = 0;         // вариация (для Ground Crawler 0..4)
    this.state = "patrol";    // patrol | aggro | shooting | emerging | dying
    this.corpseUntil = 0;     // секунд когда труп убрать
    this.emergeUntil = 0;     // время всплытия из земли
    this.spawnedAt = 0;
  }
}
type(Vec3)(Enemy.prototype, "pos");
type("string")(Enemy.prototype, "enemyType");
type("number")(Enemy.prototype, "hp");
type("number")(Enemy.prototype, "maxHp");
type("boolean")(Enemy.prototype, "alive");
type("string")(Enemy.prototype, "targetId");
type("number")(Enemy.prototype, "variant");
type("string")(Enemy.prototype, "state");
type("number")(Enemy.prototype, "corpseUntil");
type("number")(Enemy.prototype, "emergeUntil");
type("number")(Enemy.prototype, "spawnedAt");

export class Pickup extends Schema {
  constructor() {
    super();
    this.pos = new Vec3();
    this.kind = "ITEM";        // "ITEM" | "HAND" | "LEG"
    this.itemId = "";
    this.handType = "";
    this.taken = false;
  }
}
type(Vec3)(Pickup.prototype, "pos");
type("string")(Pickup.prototype, "kind");
type("string")(Pickup.prototype, "itemId");
type("string")(Pickup.prototype, "handType");
type("boolean")(Pickup.prototype, "taken");

export class HubSlot extends Schema {
  constructor() {
    super();
    this.pos = new Vec3();
    this.kind = "";       // "" | "HAND" | "LEG" | "ITEM"
    this.handType = "";   // FIREBALL_HAND / ICE_HAND / CHAIN_LIGHTNING_HAND
    this.itemId = "";
    this.empty = true;
  }
}
type(Vec3)(HubSlot.prototype, "pos");
type("string")(HubSlot.prototype, "kind");
type("string")(HubSlot.prototype, "handType");
type("string")(HubSlot.prototype, "itemId");
type("boolean")(HubSlot.prototype, "empty");

export class HubChest extends Schema {
  constructor() {
    super();
    this.pos = new Vec3();
    this.contents = new ArraySchema(); // строки "HAND:FIREBALL_HAND", "LEG:", "ITEM:xxx"
  }
}
type(Vec3)(HubChest.prototype, "pos");
type(["string"])(HubChest.prototype, "contents");

export class GameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.enemies = new MapSchema();
    this.pickups = new MapSchema();
    this.wave = 0;
    this.portalCharge = 0;      // текущая зарядка в секундах (растёт только когда portalActive=true)
    this.portalTarget = 40;     // очков крови (1 урон → 0.15, 1 килл → +2)
    this.portalActive = false;  // активировало ли кто-то портал (клавиша F)
    this.portalX = 0;           // координаты портала на арене (случайные каждый забег)
    this.portalZ = 0;
    this.phase = "arena"; // v0.0.3.0: старт сразу в terrain (без хаба)
    // Debug (синхронно всем)
    this.dbgGodMode = false;
    this.dbgSpeedMul = 1.0;
    this.dbgDamageMul = 1.0;
    this.dbgSpawnMul = 1.0;
    this.dbgInfiniteAmmo = false;
    this.dbgFly = false;
    this.hubSlots = new ArraySchema();
    this.hubChests = new ArraySchema();
    this.hubReforgeSlots = new ArraySchema(); // до 3 строк типа "HAND:FIREBALL_HAND"
    // v0.0.3.1
    this.aiBudget = 10000;         // текущий бюджет AI Director
    this.aiNextWaveAt = 0;         // когда следующая волна может спавниться
    this.levelIndex = 0;           // 0..5 (5 = boss)
    this.dbgDither = 3;            // агрессивность дизеринга 1..10
    this.dbgWeaponDmgMul = 1.0;    // множитель урона активного оружия
  }
}
type({ map: Player })(GameState.prototype, "players");
type({ map: Enemy })(GameState.prototype, "enemies");
type({ map: Pickup })(GameState.prototype, "pickups");
type("number")(GameState.prototype, "wave");
type("number")(GameState.prototype, "portalCharge");
type("number")(GameState.prototype, "portalTarget");
type("boolean")(GameState.prototype, "portalActive");
type("number")(GameState.prototype, "portalX");
type("number")(GameState.prototype, "portalZ");
type("string")(GameState.prototype, "phase");
type("boolean")(GameState.prototype, "dbgGodMode");
type("number")(GameState.prototype, "dbgSpeedMul");
type("number")(GameState.prototype, "dbgDamageMul");
type("number")(GameState.prototype, "dbgSpawnMul");
type("boolean")(GameState.prototype, "dbgInfiniteAmmo");
type("boolean")(GameState.prototype, "dbgFly");
type([HubSlot])(GameState.prototype, "hubSlots");
type([HubChest])(GameState.prototype, "hubChests");
type(["string"])(GameState.prototype, "hubReforgeSlots");
type("number")(GameState.prototype, "aiBudget");
type("number")(GameState.prototype, "aiNextWaveAt");
type("number")(GameState.prototype, "levelIndex");
type("number")(GameState.prototype, "dbgDither");
type("number")(GameState.prototype, "dbgWeaponDmgMul");
