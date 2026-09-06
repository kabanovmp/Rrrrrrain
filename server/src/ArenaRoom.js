import colyseus from "colyseus";
import { GameState, Player, Enemy, Pickup, Vec3, HubSlot, HubChest } from "./schema.js";
const { Room } = colyseus.default || colyseus;
import { NET, WORLD, COMBAT, ENEMY_TYPES, ITEMS, HAND_TYPES, SPELLS, pickRandom, AI_DIRECTOR, GROUND_CRAWLER_VARIANTS, WEAPONS, CARDS, LEVELS } from "../../shared/index.js";

const TICK_MS = 1000 / NET.TICK_RATE;
const ENEMY_GRACE_SEC = 2.0;   // 2 сек нельзя атаковать после спавна
const FLY_MIN_Y = 4.0;         // летающие не опускаются ниже 4м
const MELEE_RANGE = 2.0;       // ближе только по горизонтали
const ATTACK_COOLDOWN = 2.0;   // 1 удар в 2 сек

// СПАВНЕР ВОЛН: свежие враги каждые SPAWN_INTERVAL_SEC всегда, даже при активном портале
const SPAWN_INTERVAL_SEC = 8;
const MAX_ALIVE_ENEMIES = 25;   // потолок — чтобы не затопить арену
// ПОРТАЛ: как в RoR2 — спрятан на арене, активация по F, потом таймер зарядки
const PORTAL_INTERACT_RANGE = 3.5;

export class ArenaRoom extends Room {
  onCreate() {
    this.maxClients = NET.MAX_PLAYERS;
    this.setState(new GameState());
    this.projectiles = [];
    this.enemySeq = 0;
    this.pickupSeq = 0;
    this.waveTimer = 0;              // таймер между волнами (волны всегда)
    this.spawnInitialPickups();
    this.setupHubStorage();
    // v0.0.3.0: стартуем в арене сразу
    this.state.phase = "arena";
    this.startArena();
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
      if (spell.isChain) {
        // ЦЕПНАЯ МОЛНИЯ: мгновенный хит, прыгает от врага к врагу
        const dir = { x: msg.dx || 0, y: msg.dy || 0, z: msg.dz || 0 };
        const origin = {
          x: typeof msg.ox === "number" ? msg.ox : p.pos.x,
          y: typeof msg.oy === "number" ? msg.oy : p.pos.y,
          z: typeof msg.oz === "number" ? msg.oz : p.pos.z,
        };
        // Первая цель — ближайший враг в конусе взгляда
        let firstEnemy = null, firstDist = Infinity;
        this.state.enemies.forEach(e => {
          if (!e.alive) return;
          const dx = e.pos.x - origin.x, dy = e.pos.y - origin.y, dz = e.pos.z - origin.z;
          const dist2 = dx*dx + dy*dy + dz*dz;
          if (dist2 > spell.initialRange * spell.initialRange) return;
          const dist = Math.sqrt(dist2);
          const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / (dist || 1);
          if (dot < spell.initialConeCos) return;
          if (dist < firstDist) { firstDist = dist; firstEnemy = e; }
        });
        if (!firstEnemy) return;
        // Цепочка: прыгаем от текущей цели к ближайшему ещё не битому
        const hitIds = new Set();
        const chain = []; // для fx: координаты точек
        chain.push({ x: origin.x, y: origin.y, z: origin.z });
        let cur = firstEnemy;
        let dmg = spell.damage * dmgMult;
        for (let jump = 0; jump < spell.maxJumps; jump++) {
          this.damageEnemy(cur, dmg);
          hitIds.add(cur);
          chain.push({ x: cur.pos.x, y: cur.pos.y, z: cur.pos.z });
          // Следующая цель
          let next = null, nd = Infinity;
          this.state.enemies.forEach(e => {
            if (!e.alive || hitIds.has(e)) return;
            const dx = e.pos.x - cur.pos.x, dy = e.pos.y - cur.pos.y, dz = e.pos.z - cur.pos.z;
            const d2 = dx*dx + dy*dy + dz*dz;
            if (d2 > spell.jumpRange * spell.jumpRange) return;
            if (d2 < nd) { nd = d2; next = e; }
          });
          if (!next) break;
          cur = next;
          dmg *= spell.falloff;
        }
        this.broadcast("fx", { type: "chain", color: spell.color, points: chain });
      } else if (spell.isStarfall) {
        // v0.0.3.0: Звёздопад — AoE в точке на range по взгляду
        const dir = { x: msg.dx || 0, y: msg.dy || 0, z: msg.dz || 0 };
        const origin = {
          x: typeof msg.ox === "number" ? msg.ox : p.pos.x,
          y: typeof msg.oy === "number" ? msg.oy : p.pos.y,
          z: typeof msg.oz === "number" ? msg.oz : p.pos.z,
        };
        // v0.0.3.1: Прицельный разброс (aimSpread) — смещаем точку падения на величину в XZ.
        // Если активна карта ANGER (совместимость с doubleShot) — два удара.
        const hasAnger = this.playerHasCard(p, "ANGER");
        const shots = hasAnger ? 2 : 1;
        const dmgMulSf = dmgMult * (this.state.dbgWeaponDmgMul || 1);
        for (let sh = 0; sh < shots; sh++) {
          const spread = spell.aimSpread || 0;
          const jx = (Math.random() - 0.5) * spread * 2;
          const jz = (Math.random() - 0.5) * spread * 2;
          const tx = origin.x + dir.x * spell.range + jx;
          const ty = origin.y + dir.y * spell.range;
          const tz = origin.z + dir.z * spell.range + jz;
          const dmgVal = spell.damageMin + Math.random() * (spell.damageMax - spell.damageMin);
          let hitCount = 0;
          this.state.enemies.forEach(e => {
            if (!e.alive) return;
            const dx = e.pos.x - tx, dy = e.pos.y - ty, dz = e.pos.z - tz;
            if (dx*dx+dy*dy+dz*dz <= spell.radius*spell.radius) {
              this.damageEnemy(e, dmgVal * dmgMulSf);
              hitCount++;
            }
          });
          this.broadcast("fx", { type: "starfall", x: tx, y: ty, z: tz, r: spell.radius, color: spell.color, count: hitCount });
        }
      } else if (spell.isBlock) {
        // v0.0.3.1: Звёздный Блок мечом
        const now = Date.now() / 1000;
        if (now < (p.blockCdUntil || 0)) {
          // на кулдауне — тихо игнор
          return;
        }
        p.blockActiveUntil = now + spell.duration;
        p.blockAbsorbLeft = spell.absorb;
        p.blockCdUntil = now + spell.cooldown;
        this.broadcast("fx", { type: "star_block", target: client.sessionId, color: spell.color, dur: spell.duration });
      } else if (spell.isAoe) {
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

    // v0.0.3.1: Клиент сообщает что упал в дыру — респаун на краю с 5% HP
    this.onMessage("fall", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      // Респауним на ближайшем краю карты (WORLD.ARENA_RADIUS)
      const R = WORLD.ARENA_RADIUS * 0.9;
      const px = typeof msg?.x === "number" ? msg.x : p.pos.x;
      const pz = typeof msg?.z === "number" ? msg.z : p.pos.z;
      const ang = Math.atan2(px, pz);
      p.pos.x = Math.sin(ang) * R;
      p.pos.z = Math.cos(ang) * R;
      p.pos.y = 3;
      p.hp = Math.max(1, Math.floor(p.maxHp * COMBAT.FALL_RESPAWN_HP_PCT));
      this.broadcast("fx", { type: "fall_respawn", target: client.sessionId, x: p.pos.x, z: p.pos.z });
    });

    // v0.0.3.1: клиент шлёт изменения инвентаря (drag-and-drop)
    this.onMessage("inv", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !msg) return;
      // op: "card_set" { slot: 0..9, cardId: "ANGER"|"" }
      // op: "weapon_set" { weaponId: "STAR_SWORD"|"" }
      // op: "backpack_add" { item: "CARD:ANGER"|"WEAPON:STAR_SWORD" }
      // op: "backpack_remove" { index }
      if (msg.op === "card_set") {
        const slot = Math.max(0, Math.min(9, msg.slot | 0));
        const cardId = String(msg.cardId || "");
        if (cardId && !CARDS[cardId]) return;
        while (p.cards.length < 10) p.cards.push("");
        p.cards[slot] = cardId;
      } else if (msg.op === "weapon_set") {
        const wid = String(msg.weaponId || "");
        if (wid && !WEAPONS[wid]) return;
        p.weaponSlot = wid;
      } else if (msg.op === "backpack_add") {
        const item = String(msg.item || "");
        if (item) p.backpack.push(item);
      } else if (msg.op === "backpack_remove") {
        const idx = msg.index | 0;
        if (idx >= 0 && idx < p.backpack.length) p.backpack.splice(idx, 1);
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
      // v0.0.3.1: дизеринг + урон активного оружия
      if (typeof msg.dither === "number") s.dbgDither = Math.max(1, Math.min(10, msg.dither));
      if (typeof msg.weaponDmgMul === "number") s.dbgWeaponDmgMul = Math.max(0.1, Math.min(20, msg.weaponDmgMul));
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
      if (msg.action === "giveWeapon") {
        // msg.hand = "left"|"right", msg.type = "FIRE"|"ICE"|"BONE"
        const p = this.state.players.get(client.sessionId);
        const validTypes = ["FIRE", "ICE", "BONE", "CHAIN"];
        if (p && validTypes.includes(msg.type)) {
          if (msg.hand === "right") { p.hasRightHand = true; p.rightHandType = msg.type; }
          else { p.hasLeftHand = true; p.leftHandType = msg.type; }
          if (p.hasLegs < 2) p.hasLegs = 2;
        }
      }
      if (typeof msg.fly === "boolean") s.dbgFly = msg.fly;
      if (msg.action === "givePassive") {
        const p = this.state.players.get(client.sessionId);
        if (p) this.equipItem(p, msg.itemId || "BLOODSTONE");
      }
      if (msg.action === "resetRun") {
        this.state.phase = "hub";
        this.state.wave = 0;
        this.state.portalCharge = 0;
        this.state.portalActive = false;
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
    this.onMessage("activate_portal", (client) => {
      if (this.state.phase !== "arena") return;
      if (this.state.portalActive) return;
      const p0 = this.state.players.get(client.sessionId);
      if (!p0 || p0.isGhost || p0.hp <= 0) return;
      const dx = p0.pos.x - this.state.portalX;
      const dz = p0.pos.z - this.state.portalZ;
      if (dx * dx + dz * dz > PORTAL_INTERACT_RANGE * PORTAL_INTERACT_RANGE) return;
      this.state.portalActive = true;
      this.state.portalCharge = 0;
      // v0.0.3.1: при активации портала подливаем crawler'ов
      this.spawnWaveOfType("GROUND_CRAWLER", 4);
      this.broadcast("fx", { type: "portal_activated", x: this.state.portalX, y: 0, z: this.state.portalZ });
    });

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

    // ── HUB: положить в конкретный пустой слот (F возле пустого постамента) ─
    // msg: { index: number, what: "leftHand"|"rightHand"|"leg"|"passive"|"item"(bodyItems.top) }
    this.onMessage("hub_put", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (this.state.phase !== "hub") return;
      const slot = this.state.hubSlots[msg.index];
      if (!slot || !slot.empty) return;
      const what = String(msg.what || "");
      if (what === "leftHand" && p.hasLeftHand) {
        slot.kind = "HAND"; slot.handType = p.leftHandType; slot.itemId = ""; slot.empty = false;
        p.hasLeftHand = false; p.leftHandType = "";
      } else if (what === "rightHand" && p.hasRightHand) {
        slot.kind = "HAND"; slot.handType = p.rightHandType; slot.itemId = ""; slot.empty = false;
        p.hasRightHand = false; p.rightHandType = "";
      } else if (what === "leg" && p.hasLegs > 0) {
        slot.kind = "LEG"; slot.handType = ""; slot.itemId = ""; slot.empty = false;
        p.hasLegs--;
      } else if (what === "passive" && p.passiveItemId) {
        slot.kind = "ITEM"; slot.handType = ""; slot.itemId = p.passiveItemId; slot.empty = false;
        p.passiveItemId = "";
        p.maxHp = COMBAT.PLAYER_MAX_HP;
        if (p.hp > p.maxHp) p.hp = p.maxHp;
      } else if (what === "item" && p.itemsInBody.length > 0) {
        const it = p.itemsInBody.pop();
        slot.kind = "ITEM"; slot.handType = ""; slot.itemId = it; slot.empty = false;
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
    // v0.0.3.1: стартовый инвентарь — Звёздный Меч в руке, ANGER в первом слоте карт
    p.weaponSlot = "STAR_SWORD";
    for (let i = 0; i < 10; i++) p.cards.push(i === 0 ? "ANGER" : "");
    // Заполним рюкзак парой пустых слотов (клиент сам добавит если нужно)
    this.state.players.set(client.sessionId, p);
    console.log(`[room] join ${client.sessionId} (${p.name}). total=${this.state.players.size}`);
  }

  // v0.0.3.1: вспомогательное — есть ли у игрока активная карта в слотах
  playerHasCard(p, cardId) {
    if (!p || !p.cards) return false;
    for (let i = 0; i < p.cards.length; i++) if (p.cards[i] === cardId) return true;
    return false;
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
    this.state.portalActive = false;
    // Портал — случайная точка на арене, не в центре (надо найти)
    const R = WORLD.ARENA_RADIUS * 0.55;
    const ang = Math.random() * Math.PI * 2;
    const dist = R * (0.5 + Math.random() * 0.9);
    this.state.portalX = Math.sin(ang) * dist;
    this.state.portalZ = Math.cos(ang) * dist;
    this.waveTimer = 0;
    // Очистить старые пикапы арены
    this.state.pickups.clear();
    this.spawnArenaPickups();
    this.state.enemies.clear();
    // v0.0.3.1: AI Director бюджет сбрасывается + первая волна GROUND_CRAWLER
    this.state.aiBudget = AI_DIRECTOR.BUDGET_START;
    this.state.aiNextWaveAt = 0;
    this.spawnWaveOfType("GROUND_CRAWLER", 3);
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

  spawnWave(waveNum, aggressive = false) {
    const frontAngle = this.getPlayerFrontAngle();
    const mul = this.state.dbgSpawnMul == null ? 1 : this.state.dbgSpawnMul;
    let base = Math.min(10, 3 + Math.floor(waveNum / 2));
    if (aggressive) base = Math.ceil(base * 1.5);
    const count = Math.max(1, Math.round(base * mul));
    // v0.0.3.0: только Cacodemon (в shared он = CACO); ground vs flying организуем позже
    for (let i = 0; i < count; i++) {
      this.addEnemyAt("CACO", frontAngle + (Math.random() - 0.5) * Math.PI);
    }
    return;
    /* eslint-disable no-unreachable */
    for (let i = 0; i < count; i++) {
      let type = "IMP";
      const roll = Math.random();
      if (waveNum >= 5) {
        // Поздние волны: 25% IMP, 20% FLYER, 20% PINKY, 15% CACO, 15% BARON, 5% (второй PINKY)
        if (roll < 0.25) type = "IMP";
        else if (roll < 0.45) type = "FLYER";
        else if (roll < 0.65) type = "PINKY";
        else if (roll < 0.80) type = "CACO";
        else if (roll < 0.95) type = "BARON";
        else type = "PINKY";
      } else if (waveNum >= 3) {
        type = roll < 0.4 ? "IMP" : roll < 0.6 ? "FLYER" : roll < 0.8 ? "PINKY" : "CACO";
      } else if (waveNum === 2) {
        type = roll < 0.7 ? "IMP" : roll < 0.9 ? "FLYER" : "PINKY";
      }
      this.addEnemyAt(type, frontAngle + (Math.random() - 0.5) * Math.PI);
    }
  }

  addEnemyAt(typeId, angle) {
    const t = ENEMY_TYPES[typeId]; if (!t) return;
    const e = new Enemy();
    e.enemyType = typeId;
    // v0.0.3.1: hp по типу, а не статический ENEMY_MAX_HP
    let baseHp = t.hp;
    if (typeof baseHp !== "number" || baseHp < 5) {
      baseHp = t.armored ? COMBAT.ARMORED_ENEMY_MAX_HP : COMBAT.ENEMY_MAX_HP;
    }
    // v0.0.3.1: variant для Ground Crawler (0..4)
    if (typeId === "GROUND_CRAWLER") {
      const v = Math.floor(Math.random() * GROUND_CRAWLER_VARIANTS.length);
      const vv = GROUND_CRAWLER_VARIANTS[v];
      e.variant = v;
      baseHp = Math.round(baseHp * (vv.hpMul || 1));
    }
    e.hp = baseHp;
    e.maxHp = e.hp;
    e.spawnedAt = Date.now() / 1000;
    // v0.0.3.0: спавним врагов 40-80м от центра — в радиусе тумана, но видны
    const r = 40 + Math.random() * 40;
    e.pos.x = Math.sin(angle) * r;
    // v0.0.3.1: Ground Crawler спавнится в земле (y=-1.5) и всплывает
    if (typeId === "GROUND_CRAWLER") {
      e.pos.y = -1.5;
      e.state = "emerging";
      e.emergeUntil = Date.now() / 1000 + (t.emergeTime || 1.2);
    } else if (typeId === "FLYING_SHOOTER") {
      e.pos.y = t.hoverY || 6.5;
      e.state = "aggro";
    } else {
      e.pos.y = t.flying ? FLY_MIN_Y + Math.random() * 2 : 1;
    }
    e.pos.z = Math.cos(angle) * r;
    const id = `e${++this.enemySeq}`;
    this.state.enemies.set(id, e);
    e._grace = ENEMY_GRACE_SEC;
    this.broadcast("fx", { type: "enemy_spawn", x: e.pos.x, y: e.pos.y, z: e.pos.z, kind: typeId, variant: e.variant });
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
    const actualDmg = dmg * (this.state.dbgDamageMul || 1);
    e.hp -= actualDmg;
    // ПОРТАЛ ОТ КРОВИ: если активен — каждая 1 ед урона даёт +0.15с зарядки
    if (this.state.portalActive && this.state.portalCharge < this.state.portalTarget) {
      this.state.portalCharge = Math.min(
        this.state.portalTarget,
        this.state.portalCharge + actualDmg * 0.15
      );
      if (this.state.portalCharge >= this.state.portalTarget && this.state.phase === "arena") {
        this.state.phase = "portal_ready";
        this.broadcast("fx", { type: "portal_ready" });
      }
    }
    // Звук попадания
    this.broadcast("fx", { type: "hit_enemy", x: e.pos.x, y: e.pos.y, z: e.pos.z, dmg: actualDmg });
    if (e.hp <= 0) {
      e.alive = false;
      this.broadcast("fx", { type: "enemy_die", x: e.pos.x, y: e.pos.y, z: e.pos.z, kind: e.enemyType });
      // Бонус за убийство: +2 сек зарядки
      if (this.state.portalActive && this.state.portalCharge < this.state.portalTarget) {
        this.state.portalCharge = Math.min(this.state.portalTarget, this.state.portalCharge + 2);
        if (this.state.portalCharge >= this.state.portalTarget && this.state.phase === "arena") {
          this.state.phase = "portal_ready";
          this.broadcast("fx", { type: "portal_ready" });
        }
      }
      // v0.0.3.1: труп лежит CORPSE_LINGER_S сек (сносится в tick по corpseUntil)
      e.state = "dying";
      e.corpseUntil = Date.now() / 1000 + AI_DIRECTOR.CORPSE_LINGER_S;
    }
  }

  damagePlayer(p, dmg, sessionId, fromX = 0, fromZ = 0) {
    if (p.hp <= 0 || p.isGhost) return;
    if (this.state.dbgGodMode) return;
    // В хабе урона нет (мобы не атакуют)
    if (this.state.phase !== "arena" && this.state.phase !== "portal_ready") return;
    // v0.0.3.1: Звёздный Блок — поглощает урон пока активен
    const nowSec = Date.now() / 1000;
    if (nowSec < (p.blockActiveUntil || 0) && (p.blockAbsorbLeft || 0) > 0) {
      const absorb = Math.min(p.blockAbsorbLeft, dmg);
      p.blockAbsorbLeft -= absorb;
      dmg -= absorb;
      this.broadcast("fx", { type: "block_absorb", target: sessionId, absorb });
      if (p.blockAbsorbLeft <= 0) { p.blockActiveUntil = 0; }
      if (dmg <= 0) return;
    }
    p.hp -= dmg;
    p._lastDmgAt = Date.now(); // для HP-регенерации вне боя
    if (p.hp <= 0) {
      p.hp = 0;
      // Считаем других ЖИВЫХ игроков на арене (не призраков, с HP > 0), кроме меня
      let otherAlive = 0;
      this.state.players.forEach((pl, sid) => {
        if (sid === sessionId) return;
        if (!pl.isGhost && pl.hp > 0) otherAlive++;
      });
      if (otherAlive > 0) {
        // Есть живой союзник — становимся призраком-помощником
        p.isGhost = true;
        this.broadcast("fx", { type: "death", target: sessionId });
      } else {
        // Один или все умерли — wipe: возврат в хаб, прогресс арены обнулён
        this.broadcast("fx", { type: "death", target: sessionId });
        this.broadcast("chat", { name: "система", text: "команда пала — возврат в хаб", id: "" });
        this.wipeToHub();
      }
    } else {
      this.broadcast("fx", { type: "hurt", target: sessionId, fromX, fromZ });
    }
  }

  // ПОЛНЫЙ СБРОС АРЕНЫ в хаб: все волны, враги, снаряды, портал скидываются, игроки воскресают в центре хаба
  wipeToHub() {
    const prev = this.state.phase;
    this.state.phase = "hub";
    this.state.wave = 0;
    this.state.waveTimer = 0;
    this.state.portalActive = false;
    this.state.portalCharge = 0;
    this.state.enemies.clear();
    this.projectiles.length = 0;
    this.state.pickups.clear();
    // Снимаем всё, что подобрали на арене — в слоты/сундуки хаба
    if (prev !== "hub") this.autoDepositPlayerInventory();
    this.state.players.forEach((pl, sid) => {
      pl.isGhost = false;
      pl.maxHp = this.playerMaxHp(pl);
      pl.hp = pl.maxHp;
      pl.pos.x = 0; pl.pos.y = 1.6; pl.pos.z = 0;
      this.broadcast("fx", { type: "respawn", target: sid });
    });
  }

  tick(dt) {
    // HP-регенерация вне боя: +1 HP/с после 5с без урона
    const nowMs = Date.now();
    this.state.players.forEach(p => {
      if (p.isGhost || p.hp <= 0 || p.hp >= p.maxHp) return;
      const last = p._lastDmgAt || 0;
      if (nowMs - last < 5000) return;
      p._regenAcc = (p._regenAcc || 0) + dt;
      if (p._regenAcc >= 1.0) {
        p._regenAcc -= 1.0;
        p.hp = Math.min(p.maxHp, p.hp + 1);
      }
    });
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

    // v0.0.3.1: Фалл→респаун + 5% HP при падении в дыру (клиент шлёт fall)
    // (само событие приходит через onMessage("fall"))

    // Мобы
    this.state.enemies.forEach((e, eid) => {
      if (!e.alive) {
        // v0.0.3.1: труп лежит CORPSE_LINGER_S сек, потом удаляем
        if (e.corpseUntil && Date.now() / 1000 > e.corpseUntil) {
          this.state.enemies.delete(eid);
        }
        return;
      }
      if (e._grace > 0) e._grace -= dt;
      // v0.0.3.1: всплытие Ground Crawler'а из земли
      if (e.state === "emerging") {
        if (Date.now() / 1000 < e.emergeUntil) {
          // выдвигается вверх
          e.pos.y = Math.min(1, e.pos.y + dt * 1.5);
          return;
        } else {
          e.state = "aggro"; e.pos.y = 1;
        }
      }
      const t = ENEMY_TYPES[e.enemyType];
      let nearest = null, nd = Infinity, nid = "";
      this.state.players.forEach((p, sid) => {
        if (p.isGhost || p.hp <= 0) return;
        const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
        const d2 = dx*dx+dz*dz; // только горизонталь для выбора цели
        if (d2 < nd) { nd = d2; nearest = p; nid = sid; }
      });
      if (!nearest) return;
      // v0.0.3.1: патруль вне аггро-радиуса
      const aggro = AI_DIRECTOR.AGGRO_RANGE;
      if (Math.sqrt(nd) > aggro) {
        // Патруль: медленно блуждаем вокруг spawn-точки
        e.state = "patrol";
        if (e._patrolAng == null) e._patrolAng = Math.random() * Math.PI * 2;
        e._patrolAng += dt * 0.3;
        const speedP = (t.speed || 3) * 0.3;
        e.pos.x += Math.sin(e._patrolAng) * speedP * dt;
        e.pos.z += Math.cos(e._patrolAng) * speedP * dt;
        if (t.flying) {
          const targetY = (t.hoverY || FLY_MIN_Y) + Math.sin(Date.now() * 0.001) * 0.5;
          e.pos.y += (targetY - e.pos.y) * dt * 2;
        }
        return;
      }
      e.state = "aggro";
      e.targetId = nid;

      const dx = nearest.pos.x - e.pos.x;
      const dz = nearest.pos.z - e.pos.z;
      const horizD = Math.max(0.001, Math.sqrt(dx*dx+dz*dz));

      // Летающие держат горизонтальную дистанцию и кружат, а не садятся на голову
      const FLY_STANDOFF = 5.5; // минимальная горизонт. дистанция до цели
      let moveX = 0, moveZ = 0;
      if (t.flying) {
        if (horizD > FLY_STANDOFF + 0.5) {
          // далеко — летим к игроку
          moveX = (dx / horizD) * t.speed * dt;
          moveZ = (dz / horizD) * t.speed * dt;
        } else if (horizD < FLY_STANDOFF - 0.5) {
          // слишком близко (вкл. ровно над игроком где horizD~0) — отлетаем
          // если horizD почти 0, выбираем случайное направление
          let awayX = -dx / horizD, awayZ = -dz / horizD;
          if (horizD < 0.6) {
            if (e._escapeAng == null) e._escapeAng = Math.random() * Math.PI * 2;
            awayX = Math.sin(e._escapeAng);
            awayZ = Math.cos(e._escapeAng);
          } else {
            e._escapeAng = null;
          }
          moveX = awayX * t.speed * dt;
          moveZ = awayZ * t.speed * dt;
        } else {
          // в кольце — кружим вокруг игрока (перпендикуляр к вектору на игрока)
          if (e._orbitDir == null) e._orbitDir = Math.random() < 0.5 ? 1 : -1;
          const perpX = -dz / horizD * e._orbitDir;
          const perpZ =  dx / horizD * e._orbitDir;
          moveX = perpX * t.speed * dt;
          moveZ = perpZ * t.speed * dt;
        }
      } else {
        moveX = (dx / horizD) * t.speed * dt;
        moveZ = (dz / horizD) * t.speed * dt;
      }
      const newX = e.pos.x + moveX;
      const newZ = e.pos.z + moveZ;
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

      // v0.0.3.1: Flying Shooter — дистанционная атака огненными шарами
      if (e.enemyType === "FLYING_SHOOTER" && e._grace <= 0) {
        e._fireCd = (e._fireCd || 0) - dt;
        e._burstIdx = e._burstIdx || 0;
        e._burstCount = e._burstCount || 0;
        if (e._fireCd <= 0 && horizD < t.engageRange) {
          if (e._burstIdx >= e._burstCount) {
            // Начать новый burst 1-3 шара + кулдаун между burst'ами
            e._burstCount = 1 + Math.floor(Math.random() * t.fireCount);
            e._burstIdx = 0;
          }
          const px = nearest.pos.x, py = nearest.pos.y, pz = nearest.pos.z;
          const dxF = px - e.pos.x, dyF = py - e.pos.y, dzF = pz - e.pos.z;
          const dL = Math.max(0.001, Math.sqrt(dxF*dxF+dyF*dyF+dzF*dzF));
          this.projectiles.push({
            ownerId: null,
            enemyProjectile: true,
            x: e.pos.x, y: e.pos.y, z: e.pos.z,
            vx: (dxF / dL) * t.fireSpeed, vy: (dyF / dL) * t.fireSpeed, vz: (dzF / dL) * t.fireSpeed,
            life: 3.0, damage: t.fireDamage, radius: 0.7, color: 0xff5a1f,
          });
          this.broadcast("fx", { type: "caco_shoot", x: e.pos.x, y: e.pos.y, z: e.pos.z, tx: px, ty: py, tz: pz, color: 0xff5a1f });
          e._burstIdx++;
          e._fireCd = e._burstIdx < e._burstCount ? t.fireCooldown : (2.0 + Math.random() * 1.5);
        }
        // Не летает вплотную: останавливается когда в engageRange
        return;
      }

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

    // v0.0.3.1: вражеские снаряды бьют игроков (код выше только по врагам) — работаем в том же tick
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (!pr.enemyProjectile) continue;
      let hitAny = false;
      this.state.players.forEach((pl, sid) => {
        if (hitAny || pl.isGhost || pl.hp <= 0) return;
        const dx = pl.pos.x - pr.x, dy = pl.pos.y - pr.y, dz = pl.pos.z - pr.z;
        const r = pr.radius + 0.8;
        if (dx*dx+dy*dy+dz*dz <= r*r) {
          this.damagePlayer(pl, pr.damage, sid, pr.x, pr.z);
          hitAny = true;
        }
      });
      if (hitAny) this.projectiles.splice(i, 1);
    }

    // ── v0.0.3.1: AI Director — бюджет-based спавн волнами ───────────
    if (this.state.phase === "arena") {
      // Регенерация бюджета
      this.state.aiBudget = Math.min(AI_DIRECTOR.BUDGET_START,
        (this.state.aiBudget || 0) + AI_DIRECTOR.BUDGET_REGEN_PER_SEC * dt);
      let aliveCount = 0;
      this.state.enemies.forEach(e => { if (e.alive) aliveCount++; });
      const nowT = Date.now() / 1000;
      if (nowT >= (this.state.aiNextWaveAt || 0) && aliveCount < MAX_ALIVE_ENEMIES && this.state.aiBudget > 30) {
        this.aiDirectorSpawnWave();
        const interval = AI_DIRECTOR.WAVE_INTERVAL_MIN + Math.random() * (AI_DIRECTOR.WAVE_INTERVAL_MAX - AI_DIRECTOR.WAVE_INTERVAL_MIN);
        this.state.aiNextWaveAt = nowT + interval;
      }
    }
  }

  // v0.0.3.1: AI Director — спавн одной волны в рамках бюджета
  aiDirectorSpawnWave() {
    const size = AI_DIRECTOR.WAVE_MIN_SIZE + Math.floor(Math.random() * (AI_DIRECTOR.WAVE_MAX_SIZE - AI_DIRECTOR.WAVE_MIN_SIZE + 1));
    // Группа спавнится вокруг общего угла (как в текущем коде)
    const frontAngle = this.getPlayerFrontAngle() + (Math.random() - 0.5) * 1.2;
    // Строим список кандидатов: большая вероятность для Ground Crawler, в меньшей Cacodemon shooter
    const pool = [
      { id: "GROUND_CRAWLER", w: 0.65 },
      { id: "FLYING_SHOOTER", w: 0.25 },
      { id: "CACO", w: 0.10 },
    ];
    for (let i = 0; i < size; i++) {
      const roll = Math.random();
      let acc = 0, chosen = pool[0].id;
      for (const c of pool) { acc += c.w; if (roll < acc) { chosen = c.id; break; } }
      const cost = AI_DIRECTOR.COSTS[chosen] || 50;
      if (this.state.aiBudget < cost) break;
      this.state.aiBudget -= cost;
      const spread = (Math.random() - 0.5) * (Math.PI * 2 / 3);
      this.addEnemyAt(chosen, frontAngle + spread);
    }
  }
}
