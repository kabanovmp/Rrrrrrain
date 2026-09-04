import colyseus from "colyseus";
import { GameState, Player, Enemy, Pickup, Vec3 } from "./schema.js";
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
      const dmgMult = p.isGhost ? COMBAT.GHOST_STAT_MULT : 1;
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
        this.broadcast("fx", { type: "shot", x: p.pos.x, y: p.pos.y, z: p.pos.z, color: spell.color, dx: msg.dx || 0, dy: msg.dy || 0, dz: msg.dz || 0 });
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
      } else {
        p.itemsInBody.push(item.itemId);
      }
    });

    this.onMessage("respawn", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.hp = 3;  // v0.0.0.5: 3 HP
      p.isGhost = false;
      p.pos.x = (Math.random() - 0.5) * 4;
      p.pos.y = 1.6;
      p.pos.z = (Math.random() - 0.5) * 4;
      this.broadcast("fx", { type: "respawn", target: client.sessionId });
    });

    this.onMessage("phase", (_c, msg) => {
      if (msg.phase === "arena" || msg.phase === "hub" || msg.phase === "portal_ready") {
        this.state.phase = msg.phase;
        if (msg.phase === "arena") this.startArena();
        if (msg.phase === "hub") this.resetArena();
      }
    });
  }

  onJoin(client, opts) {
    const p = new Player();
    p.name = (opts?.name || "sgustok").slice(0, 20);
    p.hp = 3;  // v0.0.0.5: 3 HP
    p.pos.x = (Math.random() - 0.5) * 4;
    p.pos.y = 1.6;
    p.pos.z = (Math.random() - 0.5) * 4;
    this.state.players.set(client.sessionId, p);
    console.log(`[room] join ${client.sessionId} (${p.name}). total=${this.state.players.size}`);
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    console.log(`[room] leave ${client.sessionId}. total=${this.state.players.size}`);
  }

  spawnInitialPickups() {
    const hubItems = [
      { kind: "HAND", handType: "FIRE",  angle: 0.0 },
      { kind: "HAND", handType: "BONE",  angle: Math.PI * 0.5 },
      { kind: "LEG",                     angle: Math.PI },
      { kind: "LEG",                     angle: Math.PI * 1.5 },
      { kind: "ITEM", itemId: "SIGIL_DASH",  angle: Math.PI * 0.25 },
      { kind: "ITEM", itemId: "RING_QUICK",  angle: Math.PI * 0.75 },
      { kind: "ITEM", itemId: "BAND_SHIELD", angle: Math.PI * 1.25 },
    ];
    const HR = WORLD.HUB_RADIUS * 0.6;
    for (const it of hubItems) this.addPickup({
      kind: it.kind, itemId: it.itemId || "", handType: it.handType || "",
      x: Math.cos(it.angle) * HR, y: 1.2, z: Math.sin(it.angle) * HR,
    });
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
    for (let i = 0; i < count; i++) {
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
      const count = 3 + waveNum;
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
    e.hp -= dmg;
    // Звук попадания
    this.broadcast("fx", { type: "hit_enemy", x: e.pos.x, y: e.pos.y, z: e.pos.z });
    if (e.hp <= 0) {
      e.alive = false;
      this.state.portalCharge = Math.min(this.state.portalTarget, this.state.portalCharge + 1);
      if (this.state.portalCharge >= this.state.portalTarget) this.state.phase = "portal_ready";
      const idEntry = [...this.state.enemies.entries()].find(([, v]) => v === e);
      if (idEntry) setTimeout(() => this.state.enemies.delete(idEntry[0]), 400);
    }
  }

  damagePlayer(p, dmg, sessionId, fromX = 0, fromZ = 0) {
    if (p.hp <= 0 || p.isGhost) return;
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
