import colyseus from "colyseus";
import { GameState, Player, Enemy, Pickup, Vec3, HubSlot, HubChest } from "./schema.js";
const { Room } = colyseus.default || colyseus;
import { NET, WORLD, COMBAT, ENEMY_TYPES, ITEMS, ITEMS_BY_ID, SPELLS, pickRandom, AI_DIRECTOR, GROUND_CRAWLER_VARIANTS, WEAPONS, CARDS, LEVELS, lobbyDisplayPositions, lobbyChestPositions, RUN, difficultyMul, chestGoldCost, xpToNextLevel, sumItemStat } from "../../shared/index.js";

const TICK_MS = 1000 / NET.TICK_RATE;
const ENEMY_GRACE_SEC = 2.0;   // 2 сек нельзя атаковать после спавна
const FLY_MIN_Y = 4.0;         // летающие не опускаются ниже 4м
const MELEE_RANGE = 2.0;       // ближе только по горизонтали
const ATTACK_COOLDOWN = 2.0;   // 1 удар в 2 сек

// СПАВНЕР ВОЛН: свежие враги каждые SPAWN_INTERVAL_SEC всегда, даже при активном портале
const SPAWN_INTERVAL_SEC = 8;
const MAX_ALIVE_ENEMIES = 48;   // потолок — FRENZY ×3 не должен сразу упираться в лимит
// ПОРТАЛ: как в RoR2 — спрятан на арене, активация по F, потом таймер зарядки
const PORTAL_INTERACT_RANGE = 5.5;

export class ArenaRoom extends Room {
  onCreate(opts) {
    // v0.0.3.4: lobbyId — чтобы filterBy группировал совместные комнаты
    this.setMetadata({ lobbyId: (opts && opts.lobbyId) ? String(opts.lobbyId) : "public" });
    this.maxClients = NET.MAX_PLAYERS;
    this.setState(new GameState());
    this.projectiles = [];
    this.enemySeq = 0;
    this.pickupSeq = 0;
    this.waveTimer = 0;              // таймер между волнами (волны всегда)
    this.spawnInitialPickups();
    this.setupHubStorage();
    this.state.phase = "hub";
    // Арену и врагов поднимаем только когда игроки выходят из хаба
    this.setSimulationInterval(dt => this.tick(dt / 1000), TICK_MS);

    this.onMessage("input", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const locked = p._posLockUntil && Date.now() < p._posLockUntil;
      if (!locked) {
        if (typeof msg.x === "number") p.pos.x = msg.x;
        if (typeof msg.y === "number") p.pos.y = msg.y;
        if (typeof msg.z === "number") p.pos.z = msg.z;
      }
      if (typeof msg.yaw === "number") p.yaw = msg.yaw;
      if (typeof msg.pitch === "number") p.pitch = msg.pitch;
      p._lmbHeld = !!msg.lmbHeld;
    });

    this.onMessage("cast", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0 || p.isGhost) return;
      const spellId = msg.spell;
      const spell = SPELLS[spellId];
      if (!spell) return;
      const combatPhase = this.state.phase === "arena" || this.state.phase === "portal_ready";
      if (!spell.isCosmetic && !combatPhase) return;
      const wid = p.weaponSlot;
      const wdef = WEAPONS[wid];
      if (!wdef || (wdef.lmb !== spellId && wdef.rmb !== spellId)) return;
      const isRmb = wdef.rmb === spellId;
      const now = Date.now() / 1000;
      const cdField = isRmb ? "rmbCdUntil" : "lmbCdUntil";
      if (now < (p[cdField] || 0) && !spell.isDaggerCharge) return;

      const dmgMult = (p.isGhost ? COMBAT.GHOST_STAT_MULT : 1) * this.playerDamageMult(p);
      const origin = {
        x: typeof msg.ox === "number" ? msg.ox : p.pos.x,
        y: typeof msg.oy === "number" ? msg.oy : p.pos.y,
        z: typeof msg.oz === "number" ? msg.oz : p.pos.z,
      };
      const dir = { x: msg.dx || 0, y: msg.dy || 0, z: msg.dz || 0 };

      if (spell.isCosmetic) {
        p[cdField] = now + (spell.cooldown || 0.8);
        this.broadcast("fx", { type: spell.fx || "cig_puff", target: client.sessionId, x: origin.x, y: origin.y, z: origin.z, color: spell.color });
        return;
      }
      if (spell.isDaggerCharge) {
        return; // зарядка идёт в tick по lmbHeld
      }
      if (spell.isShield) {
        p.blockAbsorbLeft = spell.absorb;
        // 0 duration = бессрочно, пока не снимут HP. Legacy-клиенты смотрят blockActiveUntil —
        // ставим далеко в будущее, чтобы бар не гас через 3с.
        p.blockActiveUntil = 1e15;
        p[cdField] = now + (spell.cooldown || 2);
        this.broadcast("fx", {
          type: "star_shield", target: client.sessionId, absorb: spell.absorb,
          x: origin.x, y: origin.y, z: origin.z, color: spell.color,
        });
        return;
      }
      if (spell.isHitscan) {
        p[cdField] = now + (spell.cooldown || 0.45);
        const hit = this.hitscanEnemy(origin, dir, spell.range || 100, spell.tube || 0.55);
        if (hit) this.damageEnemy(hit, spell.damage * dmgMult);
        const len = spell.range || 80;
        this.broadcast("fx", {
          type: "hitscan", color: spell.color,
          x: origin.x, y: origin.y, z: origin.z,
          tx: origin.x + dir.x * len, ty: origin.y + dir.y * len, tz: origin.z + dir.z * len,
          hx: hit ? hit.pos.x : null, hy: hit ? hit.pos.y : null, hz: hit ? hit.pos.z : null,
        });
        return;
      }
      if (spell.isChainStorm || spell.isChain) {
        p[cdField] = now + (spell.cooldown || 30);
        this.castChainStorm(p, origin, dir, spell, dmgMult);
        return;
      }
      if (spell.isHoming) {
        p[cdField] = now + (spell.cooldown || 1);
        const shots = this.playerHasCard(p, "ANGER") ? 2 : 1;
        const vis = spell.visRange || WORLD.FOG_FAR;
        for (let s = 0; s < shots; s++) {
          const tgt = this.nearestEnemy(origin, vis, dir, spell.visConeCos ?? 0.12);
          this.spawnHoming(client.sessionId, origin, dir, spell, spell.damage * dmgMult, tgt);
        }
        return;
      }
      if (spell.isDaggerThrow) {
        p[cdField] = now + (spell.cooldown || 0.7);
        this.throwDaggers(p, client.sessionId, origin, dir, spell, dmgMult);
        return;
      }
      if (spell.isStarfall) {
        p[cdField] = now + (spell.cooldown || 0.5);
        const hasAnger = this.playerHasCard(p, "ANGER");
        const shots = hasAnger ? 2 : 1;
        const dmgMulSf = dmgMult * (this.state.dbgWeaponDmgMul || 1);
        const aimed = this.pickStarfallImpact(origin, dir, spell);
        for (let sh = 0; sh < shots; sh++) {
          const dmgVal = spell.damageMin + Math.random() * (spell.damageMax - spell.damageMin);
          this.state.enemies.forEach(e => {
            if (!e.alive) return;
            const dx = e.pos.x - aimed.x, dy = e.pos.y - aimed.y, dz = e.pos.z - aimed.z;
            if (dx*dx+dy*dy+dz*dz <= spell.radius*spell.radius) this.damageEnemy(e, dmgVal * dmgMulSf);
          });
          this.broadcast("fx", { type: "starfall", x: aimed.x, y: aimed.y, z: aimed.z, r: spell.radius, color: spell.color });
        }
        return;
      }
      p[cdField] = now + (spell.cooldown || 0.35);
      this.projectiles.push({
        ownerId: client.sessionId,
        x: origin.x, y: origin.y, z: origin.z,
        vx: dir.x * spell.projectileSpeed, vy: dir.y * spell.projectileSpeed, vz: dir.z * spell.projectileSpeed,
        life: spell.life, damage: spell.damage * dmgMult, radius: spell.radius, color: spell.color,
      });
      this.broadcast("fx", { type: "shot", x: origin.x, y: origin.y, z: origin.z, color: spell.color, dx: dir.x, dy: dir.y, dz: dir.z });
    });

    this.onMessage("pickup", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      const item = this.state.pickups.get(msg.id);
      if (!p || !item || item.taken) return;
      const dx = item.pos.x - p.pos.x, dy = item.pos.y - p.pos.y, dz = item.pos.z - p.pos.z;
      if (dx*dx+dy*dy+dz*dz > 9) return;
      const cost = item.goldCost || 0;
      if (cost > 0 && (p.gold || 0) < cost) {
        this.broadcast("chat", { name: "система", text: `${p.name || "игрок"}: не хватает золота (${cost})`, id: "" });
        return;
      }
      if (cost > 0) p.gold -= cost;
      item.taken = true;
      if (item.kind === "CARD") {
        this.grantToPlayer(p, "CARD", item.handType || item.itemId, "");
      } else if (item.kind === "WEAPON") {
        this.grantToPlayer(p, "WEAPON", item.handType || item.itemId, "");
      } else if (item.kind === "ITEM" || item.kind === "CHEST") {
        this.grantToPlayer(p, "ITEM", "", item.itemId || item.handType);
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

    // v0.0.3.3: атомарный обработчик инвентаря — одно сообщение = одно действие,
    // но главное — новый op:"swap" делает перемещение между любыми слотами атомарно
    // (без race-condition через несколько сообщений). Поддерживается также legacy raw/item.
    this.onMessage("inv", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !msg) return;
      const _ensureCards = () => { while (p.cards.length < 10) p.cards.push(""); };
      const _validCardRaw = (raw) => {
        if (!raw) return false;
        const [k, id] = String(raw).split(":");
        return k === "CARD" && !!CARDS[id];
      };
      const _validWeaponRaw = (raw) => {
        if (!raw) return false;
        const [k, id] = String(raw).split(":");
        return k === "WEAPON" && !!WEAPONS[id];
      };
      // ── НОВЫЙ АТОМАРНЫЙ SWAP ──
      // msg: { op:"swap", from:{type:"card"|"weapon"|"backpack", index:number}, to:{type:..., index:number} }
      // Любая комбинация. Правила:
      //   • в slot type="card" можно только карту (или пусто)
      //   • в slot type="weapon" можно только оружие (или пусто)
      //   • в backpack можно всё
      if (msg.op === "swap" && msg.from && msg.to) {
        _ensureCards();
        const readSlot = (loc) => {
          if (loc.type === "card") return p.cards[loc.index] ? ("CARD:" + p.cards[loc.index]) : "";
          if (loc.type === "weapon") return p.weaponSlot ? ("WEAPON:" + p.weaponSlot) : "";
          if (loc.type === "backpack") return p.backpack[loc.index] || "";
          return "";
        };
        const writeSlot = (loc, raw) => {
          if (loc.type === "card") {
            if (raw && !_validCardRaw(raw)) return false;
            p.cards[loc.index] = raw ? String(raw).split(":")[1] : "";
            return true;
          }
          if (loc.type === "weapon") {
            if (raw && !_validWeaponRaw(raw)) return false;
            p.weaponSlot = raw ? String(raw).split(":")[1] : "";
            return true;
          }
          if (loc.type === "backpack") {
            // в рюкзак кладём только непустое; иначе — удалить слот (компактация)
            if (raw) {
              if (loc.index >= p.backpack.length) p.backpack.push(raw);
              else p.backpack[loc.index] = raw;
            } else {
              if (loc.index < p.backpack.length) p.backpack.splice(loc.index, 1);
            }
            return true;
          }
          return false;
        };
        const from = msg.from, to = msg.to;
        const rawFrom = readSlot(from);
        const rawTo   = readSlot(to);
        // Проверка совместимости: в card-слот нельзя оружие и наоборот
        const targetsAllow = (loc, raw) => {
          if (!raw) return true;
          if (loc.type === "backpack") return true;
          if (loc.type === "card") return _validCardRaw(raw);
          if (loc.type === "weapon") return _validWeaponRaw(raw);
          return false;
        };
        if (!targetsAllow(to, rawFrom)) return;
        if (!targetsAllow(from, rawTo)) return;
        // Атомарный swap: сначала чистим в верхнем бакпаке по индексу (от большего к меньшему)
        // но в нашем случае достаточно поменять значения (если оба слота — не backpack) или тщательно работать с backpack.splice
        if (from.type === "backpack" && to.type === "backpack") {
          // оба — backpack: простой swap по индексам
          if (from.index < p.backpack.length && to.index < p.backpack.length) {
            const tmp = p.backpack[from.index];
            p.backpack[from.index] = p.backpack[to.index];
            p.backpack[to.index] = tmp;
          }
          return;
        }
        if (from.type === "backpack") {
          // вынимаем из backpack, возвращаем rawTo (если есть)
          if (from.index >= p.backpack.length) return;
          p.backpack.splice(from.index, 1);
          writeSlot(to, rawFrom);
          if (rawTo) p.backpack.push(rawTo);
          return;
        }
        if (to.type === "backpack") {
          // кладём в backpack всегда push (индекс = конец)
          if (rawFrom) p.backpack.push(rawFrom);
          writeSlot(from, rawTo); // rawTo чаще пустой — очистит слот
          return;
        }
        // оба — слоты (card/weapon): простой swap
        writeSlot(from, rawTo);
        writeSlot(to, rawFrom);
        return;
      }
      // ── LEGACY OPS (для совместимости) ──
      if (msg.op === "card_set") {
        // клиент в v0.0.3.1 шлёт index, в v0.0.3.3 — slot; поддерживаем оба
        const slot = Math.max(0, Math.min(9, (msg.slot != null ? msg.slot : msg.index) | 0));
        const cardId = String(msg.cardId || "");
        if (cardId && !CARDS[cardId]) return;
        _ensureCards();
        p.cards[slot] = cardId;
      } else if (msg.op === "weapon_set") {
        const wid = String(msg.weaponId || "");
        if (wid && !WEAPONS[wid]) return;
        p.weaponSlot = wid;
      } else if (msg.op === "backpack_add") {
        // клиент в v0.0.3.1 шлёт raw, старый сервер ждал item — теперь принимаем оба
        const item = String(msg.raw || msg.item || "");
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
      if (msg.action === "fillPortal") {
        if (this.state.phase === "arena" || this.state.phase === "portal_ready") {
          this.state.portalActive = true;
          this.state.portalCharge = this.state.portalTarget;
          this.state.phase = "portal_ready";
          this.broadcast("fx", { type: "portal_ready" });
        }
      }
      if (msg.action === "giveHands") {
        const p = this.state.players.get(client.sessionId);
        if (p) { p.hasLeftHand = true; p.hasRightHand = true; p.leftHandType = "FIRE"; p.rightHandType = "ICE"; p.hasLegs = 2; }
      }
      // v0.0.3.4: выдать оружие в слот (меч)
      if (msg.action === "giveWeaponSlot") {
        const p = this.state.players.get(client.sessionId);
        if (p && msg.type) p.weaponSlot = String(msg.type);
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
        this.state.levelIndex = 0;
        this.state.portalCharge = 0;
        this.state.portalActive = false;
        this.state.enemies.clear();
        this.projectiles.length = 0;
        this.state.players.forEach(pl => {
          pl.hasLeftHand = false; pl.leftHandType = "";
          pl.hasRightHand = false; pl.rightHandType = "";
          pl.hasLegs = 0;
          pl.itemsInBody.clear();
          pl.passiveItemId = "";
          pl.xp = 0;
          pl.survivorLevel = 1;
          pl.gold = 0;
          pl.maxHp = this.playerMaxHp(pl);
          pl.hp = pl.maxHp; pl.isGhost = false;
        });
        this.clearRunEconomy();
      }
      if (msg.action === "tpHub") this.returnToHub();
      if (msg.action === "tpArena") this.enterArena();
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
        if (slot.kind !== "WEAPON" && slot.kind !== "CARD" && slot.kind !== "ITEM") {
          slot.kind = ""; slot.handType = ""; slot.itemId = ""; slot.empty = true;
          return;
        }
        this.grantToPlayer(p, slot.kind, slot.handType, slot.itemId);
        slot.kind = ""; slot.handType = ""; slot.itemId = ""; slot.empty = true;
      } else if (msg.source === "chest") {
        const chest = this.state.hubChests[msg.index];
        if (!chest || chest.contents.length === 0) return;
        const idx = Math.max(0, Math.min(chest.contents.length - 1, msg.item | 0));
        const raw = chest.contents[idx];
        const [kind, val] = String(raw).split(":");
        // v0.0.3.8: проверяем что grantToPlayer поддерживает kind — иначе не сплайсим (предмет не исчезнет).
        const supported = kind === "WEAPON" || kind === "CARD" || kind === "ITEM";
        if (!supported) return;
        this.grantToPlayer(p, kind, kind === "ITEM" ? "" : (val || ""), kind === "ITEM" ? (val || "") : "");
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
      if (what === "backpack" && p.backpack.length > 0) {
        const raw = p.backpack[0];
        const [kind, val] = String(raw).split(":");
        if (kind !== "WEAPON" && kind !== "CARD") return;
        p.backpack.splice(0, 1);
        slot.kind = kind; slot.handType = val || ""; slot.itemId = ""; slot.empty = false;
      } else if (what === "weapon" && p.weaponSlot) {
        slot.kind = "WEAPON"; slot.handType = p.weaponSlot; slot.itemId = ""; slot.empty = false;
        p.weaponSlot = "";
      } else if (what.startsWith("card:")) {
        const idx = parseInt(what.slice(5), 10);
        if (idx >= 0 && idx < 10 && p.cards[idx]) {
          slot.kind = "CARD"; slot.handType = p.cards[idx]; slot.itemId = ""; slot.empty = false;
          p.cards[idx] = "";
        }
      }
    });

    // v0.0.3.4: HUB — уйти на арену через кровать сна
    this.onMessage("hub_go_arena", (client) => {
      if (this.state.phase !== "hub") return;
      this.enterArena();
    });

    // v0.0.3.4: HUB — положить в СУНДУК (общий для лобби) ─────────────────
    // msg: { index:number, what:"leftHand"|"rightHand"|"leg"|"passive"|"item"|"weapon"|"card:N" }
    this.onMessage("hub_put_chest", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (this.state.phase !== "hub") return;
      const chest = this.state.hubChests[msg.index | 0];
      if (!chest) return;
      if (chest.contents.length >= 24) return; // лимит сундука
      const what = String(msg.what || "");
      if (what === "weapon" && p.weaponSlot) {
        chest.contents.push("WEAPON:" + p.weaponSlot);
        p.weaponSlot = "";
      } else if (what.startsWith("card:")) {
        const idx = parseInt(what.slice(5), 10);
        if (idx >= 0 && idx < 10 && p.cards[idx]) {
          chest.contents.push("CARD:" + p.cards[idx]);
          p.cards[idx] = "";
        }
      } else if (what.startsWith("backpack:")) {
        const idx = parseInt(what.slice(9), 10);
        if (idx >= 0 && idx < p.backpack.length) {
          const raw = p.backpack[idx];
          if (String(raw).startsWith("WEAPON:") || String(raw).startsWith("CARD:")) {
            chest.contents.push(raw);
            p.backpack.splice(idx, 1);
          }
        }
      }
    });

    this.onMessage("hub_reforge", () => {});

    // ── DEBUG: сброс забегов (не трогает хаб) ────────────────
    this.onMessage("chat", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const text = String(msg?.text || "").slice(0, 200);
      if (!text.trim()) return;
      this.broadcast("chat", { name: p.name || "?", text, id: client.sessionId });
    });

    this.onMessage("phase", (_c, msg) => {
      if (msg?.phase === "hub") this.returnToHub();
      else if (msg?.phase === "arena") this.enterArena();
    });
    this.onMessage("return_hub", () => this.returnToHub());
    this.onMessage("enter_arena", () => this.enterArena());
    this.onMessage("next_stage", () => this.nextStage());
  }

  onJoin(client, opts) {
    const p = new Player();
    p.name = (opts?.name || "sgustok").slice(0, 20);
    p.maxHp = COMBAT.PLAYER_MAX_HP;
    p.hp = p.maxHp;
    const spawn = this.hubSpawn();
    p.pos.x = spawn.x;
    p.pos.y = spawn.y;
    p.pos.z = spawn.z;
    // v0.0.3.1: стартовый инвентарь — Звёздный Меч в руке, ANGER в первом слоте карт
    p.weaponSlot = "STAR_SWORD";
    p.daggerCount = 1;
    for (let i = 0; i < 10; i++) p.cards.push(i === 0 ? "ANGER" : "");
    p.backpack.push("CARD:FRENZY");
    p.backpack.push("CARD:RAIN");
    p.backpack.push("WEAPON:LIGHTNING_STAFF");
    p.backpack.push("WEAPON:DAGGERS");
    p.gold = 0;
    p.xp = 0;
    p.survivorLevel = 1;
    p.lunarShards = 0;
    this.state.players.set(client.sessionId, p);
    console.log(`[room] join ${client.sessionId} (${p.name}). total=${this.state.players.size}`);
  }

  // v0.0.3.1: вспомогательное — есть ли у игрока активная карта в слотах
  playerHasCard(p, cardId) {
    if (!p || !p.cards) return false;
    for (let i = 0; i < p.cards.length; i++) if (p.cards[i] === cardId) return true;
    return false;
  }

  anyPlayerHasCard(cardId) {
    let hit = false;
    this.state.players.forEach(p => { if (!hit && this.playerHasCard(p, cardId)) hit = true; });
    return hit;
  }

  cardSpawnMul() {
    return this.anyPlayerHasCard("FRENZY") ? (CARDS.FRENZY.spawnMul || 3) : 1;
  }

  combatPlayerCount() {
    let n = 0;
    this.state.players.forEach((p) => { if (!p.isGhost && p.hp > 0) n++; });
    return Math.max(1, n);
  }

  dmul() {
    return difficultyMul(this.state.runTimeSec, this.combatPlayerCount());
  }

  playerMaxHp(p) {
    const lv = Math.max(1, p.survivorLevel || 1);
    return Math.max(1, Math.round(
      COMBAT.PLAYER_MAX_HP
      + (lv - 1) * (RUN.HP_PER_LEVEL || 5)
      + sumItemStat(p, "hp")
    ));
  }

  playerDamageMult(p) {
    const lv = Math.max(1, p.survivorLevel || 1);
    return 1 + (lv - 1) * (RUN.DMG_PER_LEVEL || 0.02) + sumItemStat(p, "dmg");
  }

  nearestEnemy(origin, maxR, dir = null, minDot = null) {
    let best = null, bd = maxR * maxR, bid = "";
    const dl = dir ? (Math.hypot(dir.x, dir.y, dir.z) || 1) : 1;
    this.state.enemies.forEach((e, id) => {
      if (!e.alive) return;
      const dx = e.pos.x - origin.x, dy = e.pos.y - origin.y, dz = e.pos.z - origin.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= bd || d2 < 0.04) return;
      if (dir && minDot != null) {
        const dist = Math.sqrt(d2) || 1;
        const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / (dist * dl);
        if (dot < minDot) return;
      }
      bd = d2; best = e; bid = id;
    });
    return best ? { e: best, id: bid } : null;
  }

  hitscanEnemy(origin, dir, range, tube) {
    let best = null, bestT = range;
    const dl = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const ux = dir.x / dl, uy = dir.y / dl, uz = dir.z / dl;
    this.state.enemies.forEach(e => {
      if (!e.alive) return;
      const vx = e.pos.x - origin.x, vy = e.pos.y - origin.y, vz = e.pos.z - origin.z;
      const t = vx * ux + vy * uy + vz * uz;
      if (t < 0.2 || t > range) return;
      const px = origin.x + ux * t, py = origin.y + uy * t, pz = origin.z + uz * t;
      const rad = tube + (ENEMY_TYPES[e.enemyType]?.size || 1);
      const dx = e.pos.x - px, dy = e.pos.y - py, dz = e.pos.z - pz;
      if (dx * dx + dy * dy + dz * dz <= rad * rad && t < bestT) { bestT = t; best = e; }
    });
    return best;
  }

  spawnHoming(ownerId, origin, dir, spell, damage, tgt) {
    let vx = dir.x, vy = dir.y, vz = dir.z;
    const sp = spell.projectileSpeed || 32;
    if (tgt && tgt.e) {
      const dx = tgt.e.pos.x - origin.x, dy = tgt.e.pos.y - origin.y, dz = tgt.e.pos.z - origin.z;
      const L = Math.max(0.001, Math.hypot(dx, dy, dz));
      vx = dx / L; vy = dy / L; vz = dz / L;
    }
    this.projectiles.push({
      ownerId, homing: true, targetId: tgt ? tgt.id : "",
      visRange: spell.visRange || 100,
      x: origin.x, y: origin.y, z: origin.z,
      vx: vx * sp, vy: vy * sp, vz: vz * sp,
      life: spell.life || 4, damage, radius: spell.radius || 0.5, color: spell.color,
    });
    const kind = spell.isDaggerThrow ? "dagger" : "star";
    this.broadcast("fx", {
      type: "homing", x: origin.x, y: origin.y, z: origin.z,
      color: spell.color, dx: vx, dy: vy, dz: vz,
      kind, star: kind === "star",
      targetId: tgt ? tgt.id : "",
    });
  }

  throwDaggers(p, sid, origin, dir, spell, dmgMult) {
    const n = Math.max(1, p.daggerCount | 0);
    const vis = spell.visRange || 100;
    const vis2 = vis * vis;
    const dmg = spell.damage * dmgMult;
    const list = [];
    this.state.enemies.forEach((e, id) => {
      if (!e.alive) return;
      const dx = e.pos.x - origin.x, dz = e.pos.z - origin.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > vis2) return;
      list.push({ e, id, d2, hp: e.hp });
    });
    list.sort((a, b) => a.d2 - b.d2);
    let left = n;
    const assign = [];
    for (const t of list) {
      if (left <= 0) break;
      const need = Math.max(1, Math.ceil(t.hp / Math.max(1, dmg)));
      const take = Math.min(need, left);
      assign.push({ t, take });
      left -= take;
    }
    while (left > 0 && assign.length > 1) {
      for (let i = 1; i < assign.length && left > 0; i++) {
        assign[i].take++;
        left--;
      }
      if (assign.length <= 1) break;
    }
    for (const a of assign) {
      for (let i = 0; i < a.take; i++) {
        this.spawnHoming(sid, origin, dir || { x: 0, y: 0, z: 1 }, spell, dmg, { e: a.t.e, id: a.t.id });
      }
    }
    while (left > 0) {
      this.spawnHoming(sid, origin, dir || { x: 0, y: 0, z: 1 }, spell, dmg, null);
      left--;
    }
    p.daggerCount = 1;
  }

  castChainStorm(p, origin, dir, spell, dmgMult) {
    let firstEnemy = null, firstDist = Infinity;
    const dl = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const ux = dir.x / dl, uy = dir.y / dl, uz = dir.z / dl;
    this.state.enemies.forEach(e => {
      if (!e.alive) return;
      const dx = e.pos.x - origin.x, dy = e.pos.y - origin.y, dz = e.pos.z - origin.z;
      const dist2 = dx * dx + dy * dy + dz * dz;
      if (dist2 > spell.initialRange * spell.initialRange) return;
      const dist = Math.sqrt(dist2);
      const dot = (dx * ux + dy * uy + dz * uz) / (dist || 1);
      if (dot < (spell.initialConeCos || 0.7)) return;
      if (dist < firstDist) { firstDist = dist; firstEnemy = e; }
    });
    if (!firstEnemy) return;
    const hitIds = new Set();
    const chain = [{ x: origin.x, y: origin.y, z: origin.z }];
    let cur = firstEnemy;
    let dmg = spell.damage * dmgMult;
    const step = spell.damageStep || 10;
    for (let jump = 0; jump < (spell.maxJumps || 10); jump++) {
      this.damageEnemy(cur, dmg);
      hitIds.add(cur);
      chain.push({ x: cur.pos.x, y: cur.pos.y, z: cur.pos.z });
      let next = null, nd = Infinity;
      this.state.enemies.forEach(e => {
        if (!e.alive || hitIds.has(e)) return;
        const dx = e.pos.x - cur.pos.x, dy = e.pos.y - cur.pos.y, dz = e.pos.z - cur.pos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > spell.jumpRange * spell.jumpRange) return;
        if (d2 < nd) { nd = d2; next = e; }
      });
      if (!next) break;
      cur = next;
      dmg = Math.max(10, dmg - step * dmgMult);
    }
    this.broadcast("fx", { type: "chain", color: spell.color, points: chain });
  }
  equipItem(p, itemId) {
    if (!itemId || !ITEMS_BY_ID[itemId]) return;
    p.itemsInBody.push(itemId);
    p.passiveItemId = p.itemsInBody[0] || itemId;
    const prevMax = p.maxHp || COMBAT.PLAYER_MAX_HP;
    p.maxHp = this.playerMaxHp(p);
    p.hp = Math.min(p.maxHp, p.hp + Math.max(0, p.maxHp - prevMax));
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    console.log(`[room] leave ${client.sessionId}. total=${this.state.players.size}`);
  }

  setupHubStorage() {
    for (const p of lobbyDisplayPositions()) {
      const s = new HubSlot();
      s.pos.x = p.x;
      s.pos.y = 0.7;
      s.pos.z = p.z;
      s.empty = true;
      this.state.hubSlots.push(s);
    }
    for (const p of lobbyChestPositions()) {
      const c = new HubChest();
      c.pos.x = p.x;
      c.pos.y = 0.6;
      c.pos.z = p.z;
      this.state.hubChests.push(c);
    }
  }

  // Положить пикап в первый свободный слот, иначе в первый непустой сундук
  depositToHub(kind, handType, itemId) {
    const val = (kind === "HAND" || kind === "WEAPON" || kind === "CARD")
      ? (handType || "")
      : (itemId || "");
    for (const s of this.state.hubSlots) {
      if (s.empty) {
        s.kind = kind || "";
        s.handType = (kind === "HAND" || kind === "WEAPON" || kind === "CARD") ? val : "";
        s.itemId = kind === "ITEM" ? val : "";
        s.empty = false;
        return true;
      }
    }
    let best = null, bestLen = Infinity;
    for (const c of this.state.hubChests) {
      if (c.contents.length < bestLen) { bestLen = c.contents.length; best = c; }
    }
    if (best) {
      best.contents.push((kind || "") + ":" + val);
      return true;
    }
    return false;
  }

  // При возврате в хаб — снимаем с игроков всё, что они подобрали на арене,
  // и раскладываем в слоты/сундуки. Пассивку и HP сбрасываем; в хабе игрок голый и живой.
  autoDepositPlayerInventory() {
    this.state.players.forEach(p => {
      while (p.itemsInBody.length > 0) {
        const it = p.itemsInBody.pop();
        this.depositToHub("ITEM", "", it);
      }
      p.passiveItemId = "";
      p.xp = 0;
      p.survivorLevel = 1;
      p.maxHp = this.playerMaxHp(p);
      p.hp = p.maxHp;
      p.isGhost = false;
    });
  }

  grantToPlayer(p, kind, handType, itemId) {
    if (kind === "WEAPON") {
      p.daggerCount = String(handType || itemId || "") === "DAGGERS" ? 1 : (p.daggerCount || 1);
      // v0.0.3.8: оружие из сундука. Если слот занят — старое в рюкзак.
      const wid = String(handType || itemId || "").trim();
      if (!wid) return;
      if (p.weaponSlot) p.backpack.push("WEAPON:" + p.weaponSlot);
      p.weaponSlot = wid;
    } else if (kind === "CARD") {
      // v0.0.3.8: карта из сундука. В первый свободный слот, иначе в рюкзак.
      const cid = String(handType || itemId || "").trim();
      if (!cid) return;
      while (p.cards.length < 10) p.cards.push("");
      let placed = false;
      for (let i = 0; i < 10; i++) { if (!p.cards[i]) { p.cards[i] = cid; placed = true; break; } }
      if (!placed) p.backpack.push("CARD:" + cid);
    } else if (kind === "ITEM") {
      this.equipItem(p, itemId || handType);
    }
  }

  spawnInitialPickups() {
    // Хаб стартует пустым — постаменты слотов создаются в setupHubStorage,
    // руки/предметы попадают в них только через забеги в арене.
  }

  spawnArenaPickups() {
    const R = WORLD.PICKUP_RING || 32;
    const cost = chestGoldCost(this.state.runTimeSec);
    const chests = 5;
    for (let i = 0; i < chests; i++) {
      const a = (i / chests) * Math.PI * 2;
      const item = pickRandom(ITEMS);
      this.addPickup({
        kind: "CHEST", itemId: item.id, handType: "",
        goldCost: cost,
        x: Math.cos(a) * R, y: 1.2, z: Math.sin(a) * R,
      });
    }
    const cards = ["ANGER", "FRENZY", "RAIN"];
    for (let i = 0; i < cards.length; i++) {
      const a = ((i + 0.5) / cards.length) * Math.PI * 2;
      this.addPickup({
        kind: "CARD", itemId: "", handType: cards[i], goldCost: 0,
        x: Math.cos(a) * (R * 0.55), y: 1.2, z: Math.sin(a) * (R * 0.55),
      });
    }
  }

  addPickup({ kind, itemId, handType, x, y, z, goldCost = 0 }) {
    const id = `p${++this.pickupSeq}`;
    const pk = new Pickup();
    pk.kind = kind; pk.itemId = itemId || ""; pk.handType = handType || "";
    pk.goldCost = goldCost || 0;
    pk.pos.x = x; pk.pos.y = y; pk.pos.z = z;
    this.state.pickups.set(id, pk);
    return id;
  }

  hubSpawn() {
    return { x: 0, y: 1.6, z: WORLD.LOBBY_SPAWN_Z || 14 };
  }

  arenaSpawn() {
    return { x: 0, y: 1.6, z: 0 };
  }

  teleportAllPlayers(x, y, z) {
    const until = Date.now() + 2200;
    this.state.players.forEach((p) => {
      p.pos.x = x;
      p.pos.y = y;
      p.pos.z = z;
      p._posLockUntil = until;
    });
    this.broadcast("fx", { type: "phase_teleport", phase: this.state.phase, x, y, z });
  }

  returnToHub() {
    const prev = this.state.phase;
    this.state.phase = "hub";
    this.state.levelIndex = 0;
    this.resetArena();
    if (prev !== "hub") this.autoDepositPlayerInventory();
    this.clearRunEconomy();
    const s = this.hubSpawn();
    this.teleportAllPlayers(s.x, s.y, s.z);
  }

  clearRunEconomy() {
    this.state.runTimeSec = 0;
    this.state.players.forEach((p) => { p.gold = 0; });
  }

  grantKillRewards() {
    const gold = RUN.GOLD_PER_KILL || 8;
    const xpGain = RUN.XP_PER_KILL || 12;
    this.state.players.forEach((p) => {
      if (p.isGhost || p.hp <= 0) return;
      p.gold = (p.gold || 0) + gold;
      this.grantXp(p, xpGain);
    });
  }

  grantXp(p, amount) {
    if (!p || p.isGhost) return;
    p.xp = (p.xp || 0) + amount;
    const cap = RUN.LEVEL_CAP || 94;
    while ((p.survivorLevel || 1) < cap) {
      const need = xpToNextLevel(p.survivorLevel || 1);
      if ((p.xp || 0) < need) break;
      p.xp -= need;
      p.survivorLevel = (p.survivorLevel || 1) + 1;
      const prevMax = p.maxHp;
      p.maxHp = this.playerMaxHp(p);
      p.hp = Math.min(p.maxHp, (p.hp || 0) + Math.max(0, p.maxHp - prevMax));
    }
  }

  enterArena() {
    if (this.state.phase === "arena" || this.state.phase === "portal_ready") return;
    this.state.phase = "arena";
    this.state.levelIndex = 0;
    this.clearRunEconomy();
    this.startArena();
    const s = this.arenaSpawn();
    this.teleportAllPlayers(s.x, s.y, s.z);
  }

  nextStage() {
    if (this.state.phase !== "portal_ready") return;
    const idx = this.state.levelIndex || 0;
    const cur = LEVELS[idx] || LEVELS[0];
    if (cur && cur.boss) {
      const shards = RUN.LUNAR_SHARDS_BOSS || 1;
      this.state.players.forEach((p) => { p.lunarShards = (p.lunarShards || 0) + shards; });
      this.broadcast("chat", { name: "система", text: "финальный босс пал — лунные монеты в карман, возврат в лобби", id: "" });
      this.returnToHub();
      return;
    }
    this.state.levelIndex = Math.min(LEVELS.length - 1, idx + 1);
    this.state.players.forEach((p) => {
      p.gold = 0;
      if (p.isGhost || p.hp <= 0) {
        p.isGhost = false;
        p.maxHp = this.playerMaxHp(p);
        p.hp = p.maxHp;
      }
    });
    this.state.phase = "arena";
    this.startArena();
    const s = this.arenaSpawn();
    this.teleportAllPlayers(s.x, s.y, s.z);
    const L = LEVELS[this.state.levelIndex] || LEVELS[0];
    this.broadcast("chat", { name: "система", text: `следующий этап: ${L.label}`, id: "" });
    this.broadcast("fx", { type: "next_stage", levelIndex: this.state.levelIndex });
  }

  startArena() {
    this.state.wave = 1;
    this.state.portalCharge = 0;
    this.state.portalActive = false;
    const L = LEVELS[this.state.levelIndex || 0];
    this.state.portalTarget = (L && L.portalCharge) || RUN.PORTAL_DEFEND_S || 90;
    const minD = WORLD.PORTAL_DIST_MIN || 74;
    const maxD = WORLD.PORTAL_DIST_MAX || 90;
    const dist = minD + Math.random() * (maxD - minD);
    const ang = Math.random() * Math.PI * 2;
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
    this.spawnWaveOfType("CACO", 2);
    if (L && L.boss) this.spawnColossus();
  }

  resetArena() {
    this.state.wave = 0;
    this.state.portalActive = false;
    this.state.portalCharge = 0;
    this.state.enemies.clear();
    this.projectiles.length = 0;
    this.state.pickups.clear();
  }

  // Точка Звёздопада: ближайший враг на луче взгляда, иначе пол по прицелу.
  pickStarfallImpact(origin, dir, spell) {
    const range = spell.range || 15;
    const tube = spell.aimTube || 2.8;
    const len = Math.hypot(dir.x || 0, dir.y || 0, dir.z || 0) || 1;
    const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len;
    let bestT = Infinity;
    let best = null;
    this.state.enemies.forEach(e => {
      if (!e.alive) return;
      const vx = e.pos.x - origin.x, vy = e.pos.y - origin.y, vz = e.pos.z - origin.z;
      const t = vx * dx + vy * dy + vz * dz;
      if (t < 0.2 || t > range) return;
      const px = origin.x + dx * t, py = origin.y + dy * t, pz = origin.z + dz * t;
      const dist = Math.hypot(e.pos.x - px, e.pos.y - py, e.pos.z - pz);
      const hitR = tube + (ENEMY_TYPES[e.enemyType]?.size || 1) * 0.5;
      if (dist <= hitR && t < bestT) {
        bestT = t;
        best = { x: e.pos.x, y: e.pos.y, z: e.pos.z, lock: true };
      }
    });
    if (best) return best;
    const groundY = 1.0;
    if (dy < -0.02) {
      const tG = (groundY - origin.y) / dy;
      if (tG > 0.15 && tG <= range) {
        return { x: origin.x + dx * tG, y: groundY, z: origin.z + dz * tG, lock: false };
      }
    }
    const tFar = Math.min(range, 8);
    return { x: origin.x + dx * tFar, y: groundY, z: origin.z + dz * tFar, lock: false };
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
    const mul = (this.state.dbgSpawnMul == null ? 1 : this.state.dbgSpawnMul) * this.cardSpawnMul();
    const finalCount = Math.max(0, Math.round(count * mul));
    for (let i = 0; i < finalCount; i++) {
      const spread = (Math.random() - 0.5) * (Math.PI * 2 / 3);
      this.addEnemyAt(typeId, frontAngle + spread);
    }
  }

  spawnWave(waveNum, aggressive = false) {
    const frontAngle = this.getPlayerFrontAngle();
    const mul = (this.state.dbgSpawnMul == null ? 1 : this.state.dbgSpawnMul) * this.cardSpawnMul();
    let base = Math.min(10, 3 + Math.floor(waveNum / 2));
    if (aggressive) base = Math.ceil(base * 1.5);
    const count = Math.max(1, Math.round(base * mul * Math.min(2, this.dmul())));
    for (let i = 0; i < count; i++) {
      this.addEnemyAt("CACO", frontAngle + (Math.random() - 0.5) * Math.PI);
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
    e.hp = Math.max(1, Math.round(baseHp * this.dmul()));
    e.maxHp = e.hp;
    e.spawnedAt = Date.now() / 1000;
    // v0.0.3.0: спавним врагов 40-80м от центра — в радиусе тумана, но видны
    const r = 62 + Math.random() * 32;
    e.pos.x = Math.sin(angle) * r;
    e.pos.z = Math.cos(angle) * r;
    e._homeX = e.pos.x;
    e._homeZ = e.pos.z;
    if (t.flying) {
      e._hoverY = 10 + Math.random() * 16;
      e.pos.y = e._hoverY;
      e.state = "patrol";
    } else {
      e.pos.y = 1;
      e.state = "patrol";
    }
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
      this.grantKillRewards();
    }
  }

  damagePlayer(p, dmg, sessionId, fromX = 0, fromZ = 0) {
    if (p.hp <= 0 || p.isGhost) return;
    if (this.state.dbgGodMode) return;
    // В хабе урона нет (мобы не атакуют)
    if (this.state.phase !== "arena" && this.state.phase !== "portal_ready") return;
    // v0.0.3.1: Звёздный Блок — поглощает урон пока активен
    const nowSec = Date.now() / 1000;
    if ((p.blockAbsorbLeft || 0) > 0) {
      const absorb = Math.min(p.blockAbsorbLeft, dmg);
      p.blockAbsorbLeft -= absorb;
      dmg -= absorb;
      this.broadcast("fx", { type: "block_absorb", target: sessionId, absorb, left: p.blockAbsorbLeft });
      if (p.blockAbsorbLeft <= 0) { p.blockActiveUntil = 0; p.blockAbsorbLeft = 0; }
      if (dmg <= 0) return;
    }
    p.hp -= dmg;
    p._lastDmgAt = Date.now(); // для HP-регенерации вне боя
    if (p.hp < 1) {
      p.hp = 0;
      let alive = 0;
      this.state.players.forEach((pl) => {
        if (!pl.isGhost && pl.hp >= 1) alive++;
      });
      if (alive > 0) {
        p.isGhost = true;
        this.broadcast("fx", { type: "death", target: sessionId });
      } else {
        this.broadcast("fx", { type: "death", target: sessionId });
        this.wipeToHub();
      }
    } else {
      this.broadcast("fx", { type: "hurt", target: sessionId, fromX, fromZ });
    }
  }

  // ПОЛНЫЙ СБРОС АРЕНЫ в хаб: все волны, враги, снаряды, портал скидываются, игроки воскресают в центре хаба
  wipeToHub() {
    const prev = this.state.phase;
    if (prev === "hub") return;
    this.broadcast("chat", { name: "система", text: "команда пала — возврат в лобби", id: "" });
    this.broadcast("fx", { type: "wipe_hub" });
    this.state.phase = "hub";
    this.state.levelIndex = 0;
    this.state.wave = 0;
    this.state.waveTimer = 0;
    this.state.portalActive = false;
    this.state.portalCharge = 0;
    this.state.enemies.clear();
    this.projectiles.length = 0;
    this.state.pickups.clear();
    if (prev !== "hub") this.autoDepositPlayerInventory();
    this.clearRunEconomy();
    const s = this.hubSpawn();
    this.state.players.forEach((pl, sid) => {
      pl.isGhost = false;
      pl.maxHp = this.playerMaxHp(pl);
      pl.hp = pl.maxHp;
      pl.pos.x = s.x; pl.pos.y = s.y; pl.pos.z = s.z;
      pl._posLockUntil = Date.now() + 2200;
      this.broadcast("fx", { type: "respawn", target: sid, x: s.x, y: s.y, z: s.z });
    });
    this.broadcast("fx", { type: "phase_teleport", phase: "hub", x: s.x, y: s.y, z: s.z });
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
    // Снаряды игрока бьют врагов. Огненные шары мобов — только игроков (иначе стрелок убивает себя в момент выстрела).
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (pr.homing && !pr.enemyProjectile) {
        let te = pr.targetId ? this.state.enemies.get(pr.targetId) : null;
        if (!te || !te.alive) {
          const n = this.nearestEnemy(pr, pr.visRange || 100);
          te = n ? n.e : null;
          pr.targetId = n ? n.id : "";
        }
        if (te) {
          const dx = te.pos.x - pr.x, dy = te.pos.y - pr.y, dz = te.pos.z - pr.z;
          const L = Math.max(0.001, Math.hypot(dx, dy, dz));
          const sp = Math.hypot(pr.vx, pr.vy, pr.vz) || 32;
          const ux = dx / L, uy = dy / L, uz = dz / L;
          pr.vx = pr.vx * 0.72 + ux * sp * 0.28;
          pr.vy = pr.vy * 0.72 + uy * sp * 0.28;
          pr.vz = pr.vz * 0.72 + uz * sp * 0.28;
          const ns = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
          pr.vx = pr.vx / ns * sp; pr.vy = pr.vy / ns * sp; pr.vz = pr.vz / ns * sp;
        }
      }
      pr.life -= dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
      if (pr.enemyProjectile) {
        if (pr.life <= 0) this.projectiles.splice(i, 1);
        continue;
      }
      let hit = false;
      this.state.enemies.forEach(e => {
        if (hit || !e.alive) return;
        const dx = e.pos.x - pr.x, dy = e.pos.y - pr.y, dz = e.pos.z - pr.z;
        const r = pr.radius + (ENEMY_TYPES[e.enemyType]?.size || 1);
        if (dx*dx+dy*dy+dz*dz <= r*r) { this.damageEnemy(e, pr.damage); hit = true; }
      });
      if (hit || pr.life <= 0) this.projectiles.splice(i, 1);
    }

    const combatPhase = this.state.phase === "arena" || this.state.phase === "portal_ready";
    if (!combatPhase) return;

    const nowSec = Date.now() / 1000;
    this.state.players.forEach(p => {
      if (p.weaponSlot !== "DAGGERS" || p.isGhost || p.hp <= 0) return;
      if (!p._lmbHeld) { p._daggerNext = 0; return; }
      if ((p.daggerCount || 1) >= 10) return;
      if (!p._daggerNext) p._daggerNext = nowSec + 1;
      if (nowSec >= p._daggerNext) {
        p.daggerCount = Math.min(10, (p.daggerCount || 1) + 1);
        p._daggerNext = nowSec + 1;
        p.lmbCdUntil = p._daggerNext;
      }
    });

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
      const vis = AI_DIRECTOR.VISION_RANGE || 34;
      const leash = AI_DIRECTOR.LEASH_RANGE || 48;
      const dist = Math.sqrt(nd);
      const inVision = dist <= vis;
      if (!inVision) {
        e.state = "patrol";
        e.targetId = "";
        if (e._patrolAng == null) e._patrolAng = Math.random() * Math.PI * 2;
        e._patrolAng += dt * 0.45;
        const hx = e._homeX ?? e.pos.x, hz = e._homeZ ?? e.pos.z;
        const homePull = dist > leash ? 0.7 : 0.35;
        const prx = hx + Math.sin(e._patrolAng) * 8;
        const prz = hz + Math.cos(e._patrolAng) * 8;
        const pdx = prx - e.pos.x, pdz = prz - e.pos.z;
        const pd = Math.max(0.001, Math.hypot(pdx, pdz));
        const speedP = (t.speed || 3) * homePull;
        e.pos.x += (pdx / pd) * speedP * dt;
        e.pos.z += (pdz / pd) * speedP * dt;
        if (t.flying) {
          const targetY = (e._hoverY || t.hoverY || 10) + Math.sin(Date.now() * 0.001 + e._patrolAng) * 0.8;
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
        const targetY = (e._hoverY || t.hoverY || 10) + Math.sin(Date.now() * 0.001 + e._grace) * 0.7;
        newY = e.pos.y + (targetY - e.pos.y) * dt * 2;
      } else {
        newY = 1;
      }
      e.pos.x = newX;
      e.pos.y = newY;
      e.pos.z = newZ;

      // Дистанционная атака огненными шарами (летающий какодемон)
      if (t.fireCount && e._grace <= 0) {
        e._fireCd = (e._fireCd || 0) - dt;
        e._burstIdx = e._burstIdx || 0;
        e._burstCount = e._burstCount || 0;
        if (e._fireCd <= 0 && horizD < t.engageRange) {
          if (e._burstIdx >= e._burstCount) {
            // Начать новый burst 1-3 шара + кулдаун между burst'ами
            e._burstCount = 1 + Math.floor(Math.random() * t.fireCount);
            e._burstIdx = 0;
          }
          const px = nearest.pos.x, py = nearest.pos.y + 1.15, pz = nearest.pos.z;
          const dxF = px - e.pos.x, dyF = py - e.pos.y, dzF = pz - e.pos.z;
          const dL = Math.max(0.001, Math.sqrt(dxF*dxF+dyF*dyF+dzF*dzF));
          const ux = dxF / dL, uy = dyF / dL, uz = dzF / dL;
          const spread = t.fireSpread || 0.14;
          const rx = (Math.random() - 0.5) * spread;
          const ry = (Math.random() - 0.5) * spread * 0.6;
          const rz = (Math.random() - 0.5) * spread;
          let sx = ux + rx, sy = uy + ry, sz = uz + rz;
          const sL = Math.max(0.001, Math.hypot(sx, sy, sz));
          sx /= sL; sy /= sL; sz /= sL;
          const spawnOff = (t.size || 1.5) + 1.1;
          this.projectiles.push({
            ownerId: eid,
            enemyProjectile: true,
            x: e.pos.x + sx * spawnOff, y: e.pos.y + sy * spawnOff, z: e.pos.z + sz * spawnOff,
            vx: sx * t.fireSpeed, vy: sy * t.fireSpeed, vz: sz * t.fireSpeed,
            life: t.fireLife || 11.4, damage: t.fireDamage, radius: 0.75, color: 0xff2a12,
          });
          this.broadcast("fx", {
            type: "caco_shoot",
            x: e.pos.x + sx * spawnOff, y: e.pos.y + sy * spawnOff, z: e.pos.z + sz * spawnOff,
            tx: e.pos.x + sx * 80, ty: e.pos.y + sy * 80, tz: e.pos.z + sz * 80,
            color: 0xff5a1f,
          });
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

    // Карта RAIN — метеоритный дождь в радиусе видимости носителя
    this.tickMeteorRain(dt);

    // ── v0.0.3.1: AI Director — бюджет-based спавн волнами ───────────
    if (this.state.phase === "arena" || this.state.phase === "portal_ready") {
      this.state.runTimeSec = (this.state.runTimeSec || 0) + dt;
      if (this.state.portalActive && this.state.portalCharge < this.state.portalTarget) {
        this.state.portalCharge = Math.min(this.state.portalTarget, this.state.portalCharge + dt);
        if (this.state.portalCharge >= this.state.portalTarget && this.state.phase === "arena") {
          this.state.phase = "portal_ready";
          this.broadcast("fx", { type: "portal_ready" });
        }
      }
      // Регенерация бюджета — волны и атаки не останавливаются, пока портал заряжен
      this.state.aiBudget = Math.min(AI_DIRECTOR.BUDGET_START,
        (this.state.aiBudget || 0) + AI_DIRECTOR.BUDGET_REGEN_PER_SEC * dt);
      let aliveCount = 0;
      this.state.enemies.forEach(e => { if (e.alive) aliveCount++; });
      const nowT = Date.now() / 1000;
      // v0.0.3.4: если мало врагов — внеочередная досылка (чтобы не было пустой арены когда от всех убежал)
      const MIN_ALIVE = 6;
      const forceWave = aliveCount < MIN_ALIVE && this.state.aiBudget > 30;
      if ((forceWave || nowT >= (this.state.aiNextWaveAt || 0)) && aliveCount < MAX_ALIVE_ENEMIES && this.state.aiBudget > 30) {
        this.aiDirectorSpawnWave();
        const interval = AI_DIRECTOR.WAVE_INTERVAL_MIN + Math.random() * (AI_DIRECTOR.WAVE_INTERVAL_MAX - AI_DIRECTOR.WAVE_INTERVAL_MIN);
        this.state.aiNextWaveAt = nowT + interval;
      }
    }
  }

  // v0.0.3.1: AI Director — спавн одной волны в рамках бюджета
  aiDirectorSpawnWave() {
    const size = Math.round(
      (AI_DIRECTOR.WAVE_MIN_SIZE + Math.floor(Math.random() * (AI_DIRECTOR.WAVE_MAX_SIZE - AI_DIRECTOR.WAVE_MIN_SIZE + 1)))
      * this.cardSpawnMul()
      * Math.min(2.4, this.dmul())
    );
    // Группа спавнится вокруг общего угла (как в текущем коде)
    const frontAngle = this.getPlayerFrontAngle() + (Math.random() - 0.5) * 1.2;
    // Земля + летающие стрелки (CACO / FLYING_SHOOTER) — и в arena, и в portal_ready
    const pool = [
      { id: "GROUND_CRAWLER", w: 0.42 },
      { id: "CACO", w: 0.33 },
      { id: "FLYING_SHOOTER", w: 0.25 },
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

  tickMeteorRain(dt) {
    const def = CARDS.RAIN;
    if (!def) return;
    const casters = [];
    this.state.players.forEach((p, sid) => {
      if (p.isGhost || p.hp <= 0) return;
      if (this.playerHasCard(p, "RAIN")) casters.push({ p, sid });
    });
    if (!casters.length) { this._meteorAcc = 0; return; }
    this._meteorAcc = (this._meteorAcc || 0) + dt;
    const interval = def.interval || 0.42;
    const vis = def.visRange || 90;
    const r = def.radius || 7;
    while (this._meteorAcc >= interval) {
      this._meteorAcc -= interval;
      const { p, sid } = casters[Math.floor(Math.random() * casters.length)];
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * vis;
      const x = p.pos.x + Math.sin(ang) * dist;
      const z = p.pos.z + Math.cos(ang) * dist;
      const r2 = r * r;
      this.state.enemies.forEach(e => {
        if (!e.alive) return;
        const dx = e.pos.x - x, dz = e.pos.z - z;
        if (dx * dx + dz * dz <= r2) this.damageEnemy(e, def.enemyDamage || 28);
      });
      this.state.players.forEach((pl, psid) => {
        if (pl.isGhost || pl.hp <= 0) return;
        const dx = pl.pos.x - x, dz = pl.pos.z - z;
        if (dx * dx + dz * dz <= r2) this.damagePlayer(pl, def.playerDamage || 10, psid, x, z);
      });
      this.broadcast("fx", { type: "meteor", x, y: 22, z, tx: x, ty: 1, tz: z, r, color: 0xff3311 });
    }
  }
}
