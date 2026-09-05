import colyseus from "colyseus";
import { GameState, Player, Enemy, Pickup, Vec3, HubSlot, HubChest } from "./schema.js";
const { Room } = colyseus.default || colyseus;
import { NET, WORLD, COMBAT, ENEMY_TYPES, ITEMS, HAND_TYPES, SPELLS, pickRandom } from "../../shared/index.js";

const TICK_MS = 1000 / NET.TICK_RATE;
const ENEMY_GRACE_SEC = 2.0;   // 2 сек нельзя атаковать после спавна
const FLY_MIN_Y = 4.0;         // летающие не опускаются ниже 4м
const MELEE_RANGE = 2.0;       // ближе только по горизонтали
const ATTACK_COOLDOWN = 2.0;   // 1 удар в 2 сек

export class ArenaRoom extends Room {
  onCreate() {
    this.maxClients = NET.MAX_PLAYERS;
    this.setState(new GameState());
    this.projectiles = [];
    this.enemySeq = 0;
    this.pickupSeq = 0;
    this.spawnInitialPickups();
    this.setupHubStorage();
    this.setSimulationInterval(dt => this.tick(dt / 1000), TICK_MS);

    this.onMessage("input", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (typeof msg.x === "number") p.pos.x = msg.x;
      if (typeof msg.y === "number") p.pos.y = msg.y;
      if (typeof msg.z === "number") p.pos.z = msg.z;
      if (typeof msg.yaw === "number") p.yaw = msg.yaw;
      if (typeof msg.pitch === "number") p.pitch = msg.pitch;
    });

    this.onMessage("cast", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      const spellId = msg.spell;
      const spell = SPELLS[spellId];
      if (!spell) return;
      const dmgMult = (p.isGhost ? COMBAT.GHOST_STAT_MULT : 1) * this.playerDamageMult(p);
      if (spell.isAoe) {
        this.state.enemies.forEach(e => {
          if (!e.alive) return;
          const dx = e.pos.x - p.pos.x, dy = e.pos.y - p.pos.y, dz = e.pos.z - p.pos.z;
          if (dx*dx+dy*dy+dz*dz <= spell.radius*spell.radius) {
            this.damageEnemy(e, spell.damage * dmgMult);
          }
        });
        this.broadcast("fx", { type: "wave", x: p.pos.x, y: p.pos.y, z: p.pos.z, r: spell.radius });
      } else {
        this.projectiles.push({
          ownerId: client.sessionId,
          x: msg.ox ?? p.pos.x, y: msg.oy ?? p.pos.y, z: msg.oz ?? p.pos.z,
          vx: (msg.dx || 0) * spell.projectileSpeed,
          vy: (msg.dy || 0) * spell.projectileSpeed,
          vz: (msg.dz || 0) * spell.projectileSpeed,
          life: spell.life, damage: spell.damage * dmgMult, radius: spell.radius, color: spell.color,
        });
        // Берём origin из msg (актуальная позиция игрока на его клиенте), а не p.pos (может отставать)
        const ox = typeof msg.ox === "number" ? msg.ox : p.pos.x;
        const oy = typeof msg.oy === "number" ? msg.oy - 0.6 : p.pos.y;
        const oz = typeof msg.oz === "number" ? msg.oz : p.pos.z;
        this.broadcast("fx", { type: "shot", x: ox, y: oy, z: oz, color: spell.color, dx: msg.dx || 0, dy: msg.dy || 0, dz: msg.dz || 0 });
      }
    });

    this.onMessage("pickup", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      const item = this.state.pickups.get(msg.id);
      if (!p || !item || item.taken) return;
      const dx = item.pos.x - p.pos.x, dy = item.pos.y - p.pos.y, dz = item.pos.z - p.pos.z;
      if (dx*dx+dy*dy+dz*dz > 9) return;
      item.taken = true;
      if (item.kind === "HAND") {
        if (!p.hasLeftHand)  { p.hasLeftHand = true;  p.leftHandType = item.handType; }
        else if (!p.hasRightHand) { p.hasRightHand = true; p.rightHandType = item.handType; }
      } else if (item.kind === "LEG") {
        p.hasLegs = Math.min(2, p.hasLegs + 1);
      } else if (item.kind === "ITEM") {
        this.equipItem(p, item.itemId);
      }
    });

    this.onMessage("respawn", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.maxHp = this.playerMaxHp(p);
      p.hp = p.maxHp;
      p.isGhost = false;
      p.pos.x = (Math.random() - 0.5) * 4;
      p.pos.y = 1.6;
      p.pos.z = (Math.random() - 0.5) * 4;
      this.broadcast("fx", { type: "respawn", target: client.sessionId });
    });

    this.onMessage("debug", (client, msg) => {
      if (!msg || typeof msg !== "object") return;
      const s = this.state;
      if (typeof msg.god === "boolean") s.dbgGodMode = msg.god;
      if (typeof msg.infAmmo === "boolean") s.dbgInfiniteAmmo = msg.infAmmo;
      if (typeof msg.speedMul === "number") s.dbgSpeedMul = Math.max(0.1, Math.min(10, msg.speedMul));
      if (typeof msg.damageMul === "number") s.dbgDamageMul = Math.max(0.1, Math.min(20, msg.damageMul));
      if (typeof msg.spawnMul === "number") s.dbgSpawnMul = Math.max(0, Math.min(10, msg.spawnMul));
      if (msg.action === "respawn") {
        const p = this.state.players.get(client.sessionId);
        if (p) { p.maxHp = this.playerMaxHp(p); p.hp = p.maxHp; p.isGhost = false; p.pos.x = 0; p.pos.y = 1.6; p.pos.z = 0; this.broadcast("fx", { type: "respawn", target: client.sessionId }); }
      }
      if (msg.action === "respawnAll") {
        this.state.players.forEach((p, sid) => { p.maxHp = this.playerMaxHp(p); p.hp = p.maxHp; p.isGhost = false; p.pos.x = 0; p.pos.y = 1.6; p.pos.z = 0; this.broadcast("fx", { type: "respawn", target: sid }); });
      }
      if (msg.action === "killAllEnemies") {
        this.state.enemies.forEach(e => { if (e.alive) this.damageEnemy(e, 9999); });
      }
      if (msg.action === "giveHands") {
        const p = this.state.players.get(client.sessionId);
        if (p) { p.hasLeftHand = true; p.hasRightHand = true; p.leftHandType = "FIRE"; p.rightHandType = "ICE"; p.hasLegs = 2; }
      }
      if (msg.action === "givePassive") {
        const p = this.state.players.get(client.sessionId);
        if (p) this.equipItem(p, msg.itemId || "BLOODSTONE");
      }
      if (msg.action === "resetRun") {
        this.state.phase = "hub";
        this.state.wave = 0;
        this.state.portalCharge = 0;
        this.state.enemies.clear();
        this.projectiles.length = 0;
        // Игрокам сбросить руки/ноги/предметы, но хаб (hubSlots, hubChests) не трогаем
        this.state.players.forEach(pl => {
          pl.hasLeftHand = false; pl.leftHandType = "";
          pl.hasRightHand = false; pl.rightHandType = "";
          pl.hasLegs = 0;
          pl.itemsInBody.clear();
          pl.passiveItemId = "";
          pl.maxHp = COMBAT.PLAYER_MAX_HP;
          pl.hp = pl.maxHp; pl.isGhost = false;
        });
      }
      if (msg.action === "tpHub") { this.state.phase = "hub"; }
      if (msg.action === "tpArena") { this.state.phase = "arena"; if (this.startArena) this.startArena(); }
    });

    // ── HUB: взять из слота или сундука ─────────────────────
    this.onMessage("hub_take", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (this.state.phase !== "hub") return;
      if (msg.source === "slot") {
        const slot = this.state.hubSlots[msg.index];
        if (!slot || slot.empty) return;
        this.grantToPlayer(p, slot.kind, slot.handType, slot.itemId);
        slot.kind = ""; slot.handType = ""; slot.itemId = ""; slot.empty = true;
      } else if (msg.source === "chest") {
        const chest = this.state.hubChests[msg.index];
        if (!chest || chest.contents.length === 0) return;
        const idx = Math.max(0, Math.min(chest.contents.length - 1, msg.item | 0));
        const raw = chest.contents[idx];
        const [kind, val] = String(raw).split(":");
        const handType = kind === "HAND" ? (val || "") : "";
        const itemId = kind === "ITEM" ? (val || "") : "";
        this.grantToPlayer(p, kind, handType, itemId);
        chest.contents.splice(idx, 1);
      }
    });

    // ── HUB: reforge (положить/забрать/скрафтить) ────────────
    this.onMessage("hub_reforge", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (this.state.phase !== "hub") return;
      const list = this.state.hubReforgeSlots;
      if (msg.op === "put_hand") {
        // положить руку из руки (левой если есть, иначе правой)
        if (list.length >= 3) return;
        let ht = "";
        if (p.hasLeftHand) { ht = p.leftHandType; p.hasLeftHand = false; p.leftHandType = ""; }
        else if (p.hasRightHand) { ht = p.rightHandType; p.hasRightHand = false; p.rightHandType = ""; }
        else return;
        list.push("HAND:" + ht);
      } else if (msg.op === "take") {
        if (list.length === 0) return;
        const raw = list.pop();
        const [kind, val] = String(raw).split(":");
        this.grantToPlayer(p, kind, kind === "HAND" ? val : "", kind === "ITEM" ? val : "");
      } else if (msg.op === "craft") {
        // 3 одинаковые руки → редкая (по правилу: FIRE+FIRE+FIRE → ICE, ICE×3 → BONE, BONE×3 → FIRE)
        if (list.length < 3) return;
        const parts = list.map(x => String(x).split(":"));
        if (!parts.every(([k]) => k === "HAND")) return;
        const type = parts[0][1];
        if (!parts.every(([, t]) => t === type)) return;
        const rotate = { "FIRE": "ICE", "ICE": "BONE", "BONE": "FIRE" };
        const upgraded = rotate[type] || "FIRE";
        list.clear();
        // Кладём результат в первый свободный слот хаба или в сундук 0
        this.depositToHub("HAND", upgraded, "");
      }
    });

    // ── DEBUG: сброс забегов (не трогает хаб) ────────────────
    this.onMessage("chat", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const text = String(msg?.text || "").slice(0, 200);
      if (!text.trim()) return;
      this.broadcast("chat", { name: p.name || "?", text, id: client.sessionId });
    });

    this.onMessage("phase", (_c, msg) => {
      if (msg.phase === "arena" || msg.phase === "hub" || msg.phase === "portal_ready") {
        const prev = this.state.phase;
        this.state.phase = msg.phase;
        if (msg.phase === "arena") this.startArena();
        if (msg.phase === "hub") {
          this.resetArena();
          // При возврате в хаб — авто-депозит всего, что игроки держат в руках (кроме первой пары)
          if (prev !== "hub") this.autoDepositPlayerInventory();
        }
      }
    });
  }

  onJoin(client, opts) {
    const p = new Player();
    p.name = (opts?.name || "sgustok").slice(0, 20);
    p.maxHp = COMBAT.PLAYER_MAX_HP;
    p.hp = p.maxHp;
    p.pos.x = (Math.random() - 0.5) * 4;
    p.pos.y = 1.6;
    p.pos.z = (Math.random() - 0.5) * 4;
    this.state.players.set(client.sessionId, p);
    console.log(`[room] join ${client.sessionId} (${p.name}). total=${this.state.players.size}`);
  }

  // Расчёт maxHp с учётом надетой пассивки
  playerMaxHp(p) {
    let hp = COMBAT.PLAYER_MAX_HP;
    if (p.passiveItemId === "BLOODSTONE") hp += 2;
    return hp;
  }
  // Множитель урона (заклинаний) с учётом пассивки
  playerDamageMult(p) {
    if (p.passiveItemId === "EMBER_SIGIL") return 1.5;
    return 1;
  }
  // Надеть пассивку: первый надевается, последующие идут в itemsInBody (запас)
  equipItem(p, itemId) {
    if (!itemId) return;
    if (!p.passiveItemId) {
      p.passiveItemId = itemId;
      p.maxHp = this.playerMaxHp(p);
      p.hp = Math.min(p.maxHp, p.hp + (itemId === "BLOODSTONE" ? 2 : 0));
    } else {
      p.itemsInBody.push(itemId);
    }
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    console.log(`[room] leave ${client.sessionId}. total=${this.state.players.size}`);
  }

  setupHubStorage() {
    // 20 постаментов на среднем радиусе
    const R = WORLD.HUB_RADIUS * 0.5;
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const s = new HubSlot();
      s.pos.x = Math.cos(a) * R;
      s.pos.y = 1.0;
      s.pos.z = Math.sin(a) * R;
      s.empty = true;
      this.state.hubSlots.push(s);
    }
    // 4 сундука ближе к стенам, но НЕ на портале
    const CR = WORLD.HUB_RADIUS * 0.75;
    const chestAngles = [Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4];
    for (const a of chestAngles) {
      const c = new HubChest();
      c.pos.x = Math.cos(a) * CR;
      c.pos.y = 0.6;
      c.pos.z = Math.sin(a) * CR;
      this.state.hubChests.push(c);
    }
  }

  // Положить пикап в первый свободный слот, иначе в первый непустой сундук
  depositToHub(kind, handType, itemId) {
    for (const s of this.state.hubSlots) {
      if (s.empty) {
        s.kind = kind || "";
        s.handType = handType || "";
        s.itemId = itemId || "";
        s.empty = false;
        return true;
      }
    }
    // Все слоты заняты — в сундук с минимальным содержимым
    let best = null, bestLen = Infinity;
    for (const c of this.state.hubChests) {
      if (c.contents.length < bestLen) { bestLen = c.contents.length; best = c; }
    }
    if (best) {
      best.contents.push((kind || "") + ":" + (kind === "HAND" ? (handType || "") : (kind === "ITEM" ? (itemId || "") : "")));
      return true;
    }
    return false;
  }

  // При возврате в хаб — снимаем с игроков всё, что они подобрали на арене,
  // и раскладываем в слоты/сундуки. Пассивку и HP сбрасываем; в хабе игрок голый и живой.
  autoDepositPlayerInventory() {
    this.state.players.forEach(p => {
      if (p.hasLeftHand) {
        this.depositToHub("HAND", p.leftHandType, "");
        p.hasLeftHand = false; p.leftHandType = "";
      }
      if (p.hasRightHand) {
        this.depositToHub("HAND", p.rightHandType, "");
        p.hasRightHand = false; p.rightHandType = "";
      }
      while (p.hasLegs > 0) {
        this.depositToHub("LEG", "", "");
        p.hasLegs--;
      }
      while (p.itemsInBody.length > 0) {
        const it = p.itemsInBody.pop();
        this.depositToHub("ITEM", "", it);
      }
      if (p.passiveItemId) {
        this.depositToHub("ITEM", "", p.passiveItemId);
        p.passiveItemId = "";
      }
      p.maxHp = COMBAT.PLAYER_MAX_HP;
      p.hp = p.maxHp;
      p.isGhost = false;
    });
  }

  grantToPlayer(p, kind, handType, itemId) {
    if (kind === "HAND") {
      if (!p.hasLeftHand) { p.hasLeftHand = true; p.leftHandType = handType || "FIRE"; }
      else if (!p.hasRightHand) { p.hasRightHand = true; p.rightHandType = handType || "FIRE"; }
      // если обе руки заняты — тихо игнорим (в реализации UI можно показать подсказку)
    } else if (kind === "LEG") {
      p.hasLegs = Math.min(2, (p.hasLegs || 0) + 1);
    } else if (kind === "ITEM") {
      this.equipItem(p, itemId);
    }
  }

  spawnInitialPickups() {
    // Хаб стартует пустым — постаменты слотов создаются в setupHubStorage,
    // руки/предметы попадают в них только через забеги в арене.
  }

  // Стартовые пикапы для АРЕНЫ: всегда минимум 1 HAND на команду
  spawnArenaPickups() {
    const R = WORLD.ARENA_RADIUS * 0.35;
    // Гарантированно: FIRE-HAND, ICE-HAND, BONE-HAND, 1 LEG, 1 ITEM (случайная пассивка)
    const passive = pickRandom(ITEMS);
    const kinds = [
      { kind: "HAND", handType: "FIRE" },
      { kind: "HAND", handType: "ICE" },
      { kind: "HAND", handType: "BONE" },
      { kind: "LEG" },
      { kind: "ITEM", itemId: passive.id },
    ];
    for (let i = 0; i < kinds.length; i++) {
      const a = (i / kinds.length) * Math.PI * 2;
      const k = kinds[i];
      this.addPickup({
        kind: k.kind, itemId: k.itemId || "", handType: k.handType || "",
        x: Math.cos(a) * R, y: 1.2, z: Math.sin(a) * R,
      });
    }
  }

  addPickup({ kind, itemId, handType, x, y, z }) {
    const id = `p${++this.pickupSeq}`;
    const pk = new Pickup();
    pk.kind = kind; pk.itemId = itemId; pk.handType = handType;
    pk.pos.x = x; pk.pos.y = y; pk.pos.z = z;
    this.state.pickups.set(id, pk);
    return id;
  }

  startArena() {
    this.state.wave = 1;
    this.state.portalCharge = 0;
    // Очистить старые пикапы арены
    this.state.pickups.clear();
    this.spawnArenaPickups();
    this.state.enemies.clear();
    // v0.0.0.5: первая волна — только 3 IMP, без летающих
    this.spawnWaveOfType("IMP", 3);
  }

  resetArena() {
    this.state.wave = 0;
    this.state.enemies.clear();
    this.projectiles.length = 0;
  }

  getPlayerFrontAngle() {
    let sumX = 0, sumZ = 0, n = 0;
    this.state.players.forEach(p => {
      if (p.isGhost) return;
      sumX += Math.sin(p.yaw || 0);
      sumZ += Math.cos(p.yaw || 0);
      n++;
    });
    if (n === 0) return 0;
    return Math.atan2(sumX, sumZ);
  }

  spawnWaveOfType(typeId, count) {
    const frontAngle = this.getPlayerFrontAngle();
    const mul = this.state.dbgSpawnMul == null ? 1 : this.state.dbgSpawnMul;
    const finalCount = Math.max(0, Math.round(count * mul));
    for (let i = 0; i < finalCount; i++) {
      const spread = (Math.random() - 0.5) * (Math.PI * 2 / 3);
      this.addEnemyAt(typeId, frontAngle + spread);
    }
  }

  spawnWave(waveNum) {
    // v0.0.0.5: постепенное усложнение
    const frontAngle = this.getPlayerFrontAngle();
    if (waveNum === 2) {
      // волна 2: 4 IMP + 1 PINKY
      for (let i = 0; i < 4; i++) this.addEnemyAt("IMP", frontAngle + (Math.random()-0.5) * Math.PI);
      this.addEnemyAt("PINKY", frontAngle + (Math.random()-0.5) * Math.PI);
    } else if (waveNum >= 3) {
      // волна 3+: добавляются CACO (летающие)
      const mul = this.state.dbgSpawnMul == null ? 1 : this.state.dbgSpawnMul;
      const count = Math.max(0, Math.round((3 + waveNum) * mul));
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        const type = roll < 0.5 ? "IMP" : roll < 0.8 ? "PINKY" : "CACO";
        this.addEnemyAt(type, frontAngle + (Math.random()-0.5) * Math.PI);
      }
    }
  }

  addEnemyAt(typeId, angle) {
    const t = ENEMY_TYPES[typeId]; if (!t) return;
    const e = new Enemy();
    e.enemyType = typeId;
    e.hp = t.armored ? COMBAT.ARMORED_ENEMY_MAX_HP : COMBAT.ENEMY_MAX_HP;
    e.maxHp = e.hp;
    const r = WORLD.ARENA_RADIUS * (0.7 + Math.random() * 0.25);
    e.pos.x = Math.sin(angle) * r;
    e.pos.y = t.flying ? FLY_MIN_Y + Math.random() * 2 : 1;
    e.pos.z = Math.cos(angle) * r;
    const id = `e${++this.enemySeq}`;
    this.state.enemies.set(id, e);
    e._grace = ENEMY_GRACE_SEC;
    return id;
  }

  addEnemy(typeId) {
    return this.addEnemyAt(typeId, Math.random() * Math.PI * 2);
  }

  spawnColossus() {
    const id = this.addEnemyAt("COLOSSUS", this.getPlayerFrontAngle());
    const e = this.state.enemies.get(id);
    if (e) { e.hp = ENEMY_TYPES.COLOSSUS.hp; e.maxHp = e.hp; }
  }

  damageEnemy(e, dmg) {
    if (!e.alive) return;
    e.hp -= dmg * (this.state.dbgDamageMul || 1);
    // Звук попадания
    this.broadcast("fx", { type: "hit_enemy", x: e.pos.x, y: e.pos.y, z: e.pos.z });
    if (e.hp <= 0) {
      e.alive = false;
      this.broadcast("fx", { type: "enemy_die", x: e.pos.x, y: e.pos.y, z: e.pos.z, kind: e.enemyType });
      this.state.portalCharge = Math.min(this.state.portalTarget, this.state.portalCharge + 1);
      if (this.state.portalCharge >= this.state.portalTarget) this.state.phase = "portal_ready";
      const idEntry = [...this.state.enemies.entries()].find(([, v]) => v === e);
      if (idEntry) setTimeout(() => this.state.enemies.delete(idEntry[0]), 400);
    }
  }

  damagePlayer(p, dmg, sessionId, fromX = 0, fromZ = 0) {
    if (p.hp <= 0 || p.isGhost) return;
    if (this.state.dbgGodMode) return;
    // В хабе урона нет (мобы не атакуют)
    if (this.state.phase !== "arena" && this.state.phase !== "portal_ready") return;
    p.hp -= dmg;
    if (p.hp <= 0) {
      p.isGhost = true;
      p.hp = 0;
      this.broadcast("fx", { type: "death", target: sessionId });
    } else {
      this.broadcast("fx", { type: "hurt", target: sessionId, fromX, fromZ });
    }
  }

  tick(dt) {
    // Снаряды
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
      let hit = false;
      this.state.enemies.forEach(e => {
        if (hit || !e.alive) return;
        const dx = e.pos.x - pr.x, dy = e.pos.y - pr.y, dz = e.pos.z - pr.z;
        const r = pr.radius + (ENEMY_TYPES[e.enemyType]?.size || 1);
        if (dx*dx+dy*dy+dz*dz <= r*r) { this.damageEnemy(e, pr.damage); hit = true; }
      });
      if (hit || pr.life <= 0) this.projectiles.splice(i, 1);
    }

    // Мобы
    this.state.enemies.forEach(e => {
      if (!e.alive) return;
      if (e._grace > 0) e._grace -= dt;
      const t = ENEMY_TYPES[e.enemyType];
      let nearest = null, nd = Infinity, nid = "";
      this.state.players.forEach((p, sid) => {
        if (p.isGhost || p.hp <= 0) return;
        const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
        const d2 = dx*dx+dz*dz; // только горизонталь для выбора цели
        if (d2 < nd) { nd = d2; nearest = p; nid = sid; }
      });
      if (!nearest) return;
      e.targetId = nid;

      const dx = nearest.pos.x - e.pos.x;
      const dz = nearest.pos.z - e.pos.z;
      const horizD = Math.max(0.001, Math.sqrt(dx*dx+dz*dz));

      // ВАЖНО: пересоздаём Vec3, чтобы Colyseus точно засинкал изменение
      const newX = e.pos.x + (dx / horizD) * t.speed * dt;
      const newZ = e.pos.z + (dz / horizD) * t.speed * dt;
      let newY;
      if (t.flying) {
        // Летающие держат высоту, слегка колышутся
        const targetY = FLY_MIN_Y + 1.5 + Math.sin(Date.now() * 0.001 + e._grace) * 0.5;
        newY = e.pos.y + (targetY - e.pos.y) * dt * 2;
      } else {
        newY = 1;
      }
      e.pos.x = newX;
      e.pos.y = newY;
      e.pos.z = newZ;

      // Атака: горизонтальная дистанция ближняя И (для летающих) игрок должен быть примерно на той же высоте
      const canAttack = horizD < MELEE_RANGE + t.size * 0.3
        && (!t.flying || Math.abs(nearest.pos.y - e.pos.y) < 3)
        && e._grace <= 0;
      if (canAttack) {
        e._atkCd = (e._atkCd || 0) - dt;
        if (e._atkCd <= 0) {
          e._atkCd = ATTACK_COOLDOWN;
          this.damagePlayer(nearest, t.damage, nid, e.pos.x, e.pos.z);
        }
      }
    });

    // Волны
    if (this.state.phase === "arena") {
      let aliveCount = 0;
      this.state.enemies.forEach(e => { if (e.alive) aliveCount++; });
      if (aliveCount === 0 && this.state.wave > 0) {
        this.state.wave += 1;
        if (this.state.wave === 4) this.spawnColossus();
        else this.spawnWave(this.state.wave);
      }
    }
  }
}
