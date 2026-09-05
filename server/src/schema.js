import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class Vec3 extends Schema {}
type("number")(Vec3.prototype, "x");
type("number")(Vec3.prototype, "y");
type("number")(Vec3.prototype, "z");

export class Player extends Schema {
  constructor() {
    super();
    this.pos = new Vec3(); this.pos.x = 0; this.pos.y = 2; this.pos.z = 0;
    this.vel = new Vec3(); this.vel.x = 0; this.vel.y = 0; this.vel.z = 0;
    this.yaw = 0; this.pitch = 0;
    this.hp = 2;
    this.maxHp = 2;
    this.isGhost = false;
    this.hasLeftHand = false;
    this.hasRightHand = false;
    this.hasLegs = 0;
    this.leftHandType = "";
    this.rightHandType = "";
    this.itemsInBody = new ArraySchema();
    this.name = "";
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
type("string")(Player.prototype, "name");

export class Enemy extends Schema {
  constructor() {
    super();
    this.pos = new Vec3();
    this.enemyType = "IMP";
    this.hp = 2;
    this.maxHp = 2;
    this.alive = true;
    this.targetId = "";
  }
}
type(Vec3)(Enemy.prototype, "pos");
type("string")(Enemy.prototype, "enemyType");
type("number")(Enemy.prototype, "hp");
type("number")(Enemy.prototype, "maxHp");
type("boolean")(Enemy.prototype, "alive");
type("string")(Enemy.prototype, "targetId");

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

export class GameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.enemies = new MapSchema();
    this.pickups = new MapSchema();
    this.wave = 0;
    this.portalCharge = 0;
    this.portalTarget = 20;
    this.phase = "hub"; // "hub" | "arena" | "portal_ready"
    // Debug (синхронно всем)
    this.dbgGodMode = false;
    this.dbgSpeedMul = 1.0;
    this.dbgDamageMul = 1.0;
    this.dbgSpawnMul = 1.0;
    this.dbgInfiniteAmmo = false;
  }
}
type({ map: Player })(GameState.prototype, "players");
type({ map: Enemy })(GameState.prototype, "enemies");
type({ map: Pickup })(GameState.prototype, "pickups");
type("number")(GameState.prototype, "wave");
type("number")(GameState.prototype, "portalCharge");
type("number")(GameState.prototype, "portalTarget");
type("string")(GameState.prototype, "phase");
type("boolean")(GameState.prototype, "dbgGodMode");
type("number")(GameState.prototype, "dbgSpeedMul");
type("number")(GameState.prototype, "dbgDamageMul");
type("number")(GameState.prototype, "dbgSpawnMul");
type("boolean")(GameState.prototype, "dbgInfiniteAmmo");
