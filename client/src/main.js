import * as THREE from "three";
import { Client } from "colyseus.js";
import { NET, WORLD, HAND_TYPES, SPELLS, ENEMY_TYPES, ITEMS, COMBAT } from "@mhfps/shared";
import { setupHub, setupArena, disposeGroup, animateTorches, updateArenaPortal, getArenaPortalPos, updateHubPortal, getHubPortalPos, animateDangerZones, createHubSlotMesh, makeSlotContent, createHubChestMesh, updateChestCount, updateHubAltar, setChestOpen } from "./world.js";
import { createEnemy3D, animateEnemy } from "./enemies3d.js";
import { createHandsGroup, animateHands, setSpellInHand, showHandDamage, fadeHandCracks } from "./hands3d.js";
import { createOtherPlayer, animateOtherPlayer } from "./otherplayer.js";
import { createPedestalMesh, animatePedestal } from "./pedestal.js";
import { FpsController } from "./controller.js";
import { initAudio, playSound, playSoundLoop, stopSoundLoop } from "./assets.js";

// ═══════════════════════════════════════════════════════════════════
// DOM
// ═══════════════════════════════════════════════════════════════════
const canvas = document.getElementById("canvas");
const menu = document.getElementById("menu");
const status = document.getElementById("status");
const crackHud = document.getElementById("hud-crack");
const deadHud = document.getElementById("dead");
const crosshair = document.getElementById("crosshair");

const radar = document.createElement("canvas");
radar.width = 400; radar.height = 60;
radar.style.cssText = "position:fixed;top:8px;left:50%;transform:translateX(-50%);pointer-events:none;z-index:15;";
document.body.appendChild(radar);
const rctx = radar.getContext("2d");

const dmgOverlay = document.createElement("div");
dmgOverlay.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:14;opacity:0;transition:opacity .3s;";
document.body.appendChild(dmgOverlay);
let dmgAngle = 0, dmgTimer = 0;

// HUD-подсказка (центр экрана)
const hintText = document.createElement("div");
hintText.style.cssText = "position:fixed;top:35%;left:50%;transform:translateX(-50%);color:#fff;text-shadow:0 0 8px #000;font-family:sans-serif;font-size:20px;padding:12px 18px;background:rgba(0,0,0,0.6);border-radius:8px;pointer-events:none;z-index:16;opacity:0;transition:opacity .3s;";
document.body.appendChild(hintText);
let hintTimer = 0;

// Чат (внизу слева)
const chatBox = document.createElement("div");
chatBox.style.cssText = "position:fixed;left:12px;bottom:60px;width:420px;max-height:200px;overflow:hidden;pointer-events:none;z-index:15;display:flex;flex-direction:column;justify-content:flex-end;font-family:sans-serif;font-size:14px;";
document.body.appendChild(chatBox);

const chatInput = document.createElement("input");
chatInput.type = "text";
chatInput.maxLength = 200;
chatInput.placeholder = "сообщение...";
chatInput.style.cssText = "position:fixed;left:12px;bottom:20px;width:420px;padding:8px 10px;background:rgba(0,0,0,0.75);border:1px solid #555;color:#fff;font-family:sans-serif;font-size:14px;outline:none;z-index:20;display:none;";
document.body.appendChild(chatInput);
chatInput.addEventListener("keydown", (ev) => {
  ev.stopPropagation(); // чтобы канвас-листенер не ловил W/A/S/D
  if (ev.code === "Enter") {
    const text = chatInput.value.trim();
    if (text && room) room.send("chat", { text });
    chatInput.value = "";
    chatInput.style.display = "none";
    chatInput.blur();
    chatOpen = false;
    ev.preventDefault();
    return;
  }
  if (ev.code === "Escape") {
    chatInput.value = "";
    chatInput.style.display = "none";
    chatInput.blur();
    chatOpen = false;
    ev.preventDefault();
  }
});

let chatOpen = false;
// Escape в чат-инпуте закрывает без отправки
// (иначе pointerlock перехватывает и мы в лимбе)
function addChatMessage(name, text, self = false) {
  const line = document.createElement("div");
  line.style.cssText = "padding:4px 8px;margin-top:2px;background:rgba(0,0,0,0.55);color:#fff;text-shadow:0 0 4px #000;border-radius:4px;word-wrap:break-word;";
  line.innerHTML = `<span style="color:${self ? '#ffaa44' : '#66ccff'};font-weight:bold">${escapeHtml(name)}:</span> ${escapeHtml(text)}`;
  chatBox.appendChild(line);
  // Авто-удаление через 10 секунд
  setTimeout(() => {
    line.style.transition = "opacity 1s";
    line.style.opacity = "0";
    setTimeout(() => line.remove(), 1000);
  }, 10000);
  // Ограничение на число видимых
  while (chatBox.children.length > 10) chatBox.children[0].remove();
}
// ── ДЕБАГ-ПАНЕЛЬ ──────────────────────────────────────
const debugPanel = document.getElementById("debug-panel");
let debugOpen = false;
function toggleDebugPanel() {
  debugOpen = !debugOpen;
  debugPanel.style.display = debugOpen ? "block" : "none";
  if (debugOpen) { if (window.controller?.releasePointer) window.controller.releasePointer(); }
  else { if (window.controller?.enable) window.controller.enable(); }
}
function sendDebug(payload) {
  if (window.room) window.room.send("debug", payload);
}
// Привязка обработчиков (после DOMContentLoaded — но HTML уже в памяти)
(function initDebugPanel() {
  const god = document.getElementById("dbg-god");
  const ammo = document.getElementById("dbg-ammo");
  const speed = document.getElementById("dbg-speed");
  const dmg = document.getElementById("dbg-dmg");
  const spawn = document.getElementById("dbg-spawn");
  if (!god) return;
  god.addEventListener("change", () => sendDebug({ god: god.checked }));
  ammo.addEventListener("change", () => sendDebug({ infAmmo: ammo.checked }));
  speed.addEventListener("input", () => {
    document.getElementById("dbg-speed-v").textContent = speed.value;
    sendDebug({ speedMul: parseFloat(speed.value) });
  });
  dmg.addEventListener("input", () => {
    document.getElementById("dbg-dmg-v").textContent = dmg.value;
    sendDebug({ damageMul: parseFloat(dmg.value) });
  });
  spawn.addEventListener("input", () => {
    document.getElementById("dbg-spawn-v").textContent = spawn.value;
    sendDebug({ spawnMul: parseFloat(spawn.value) });
  });
  document.querySelectorAll(".dbg-btn").forEach(b => {
    b.addEventListener("click", () => sendDebug({ action: b.dataset.act }));
  });
})();
// Синхронизация панели с серверным состоянием (вызвать после подключения)
function syncDebugPanelFromState(state) {
  const g = document.getElementById("dbg-god"); if (g) g.checked = !!state.dbgGodMode;
  const a = document.getElementById("dbg-ammo"); if (a) a.checked = !!state.dbgInfiniteAmmo;
  const sp = document.getElementById("dbg-speed"); if (sp && state.dbgSpeedMul) { sp.value = state.dbgSpeedMul; document.getElementById("dbg-speed-v").textContent = state.dbgSpeedMul; }
  const dm = document.getElementById("dbg-dmg"); if (dm && state.dbgDamageMul) { dm.value = state.dbgDamageMul; document.getElementById("dbg-dmg-v").textContent = state.dbgDamageMul; }
  const sw = document.getElementById("dbg-spawn"); if (sw && state.dbgSpawnMul != null) { sw.value = state.dbgSpawnMul; document.getElementById("dbg-spawn-v").textContent = state.dbgSpawnMul; }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ═══════════════════════════════════════════════════════════════════
// РЕНДЕР
// ═══════════════════════════════════════════════════════════════════
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setClearColor(0x1a2030);

const scene = new THREE.Scene();
// Без тумана — чтобы было видно всё.
// Общее яркое освещение в самой scene (не в группах), чтобы всё гарантированно освещалось.
scene.add(new THREE.AmbientLight(0xffffff, 1.4));
const globalHemi = new THREE.HemisphereLight(0xffffff, 0x776655, 1.2);
scene.add(globalHemi);

// FOV 70 — стандарт для FPS. 85 было слишком широко, искажало края.
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 500);
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});
renderer.setSize(window.innerWidth, window.innerHeight, false);

// ── Разные сцены для хаба/арены (отдельные пространства) ────────
const hubGroup = new THREE.Group();
const arenaGroup = new THREE.Group();
// Хаб парит "в космосе" — можно сместить по Y для отдельности
scene.add(hubGroup, arenaGroup);
setupHub(hubGroup);
setupArena(arenaGroup);
arenaGroup.visible = false;

// ── Руки: детальные 3D-модели ────────────────────────────────────
const handsRoot = createHandsGroup();
camera.add(handsRoot);
scene.add(camera);
// Руки видны всегда (базовые голые ладони), пикапы добавляют заклинания
handsRoot.userData.leftHand.visible = true;
handsRoot.userData.rightHand.visible = true;

// ═══════════════════════════════════════════════════════════════════
// ХРАНИЛИЩА МЕШЕЙ
// ═══════════════════════════════════════════════════════════════════
// Враги: {mesh, targetX, targetY, targetZ, prevX, prevZ}
const enemyMeshes = new Map();

// Другие игроки: {mesh, targetX, targetY, targetZ, targetYaw, prevX, prevZ}
const otherPlayers = new Map();
let colorIdxCounter = 0;

// Пикапы = пьедесталы
const pickupMeshes = new Map();
function makePickupMesh(pk) {
  // Определяем какой тип заклинания
  let spellType = "fireball";
  if (pk.kind === "HAND") {
    const spell = HAND_TYPES[pk.handType]?.spell || "FIREBALL";
    spellType = spell === "FIREBALL" ? "fireball"
              : spell === "ICE" ? "ice"
              : spell === "CHAIN_LIGHTNING" ? "chain"
              : "fireball";
  } else if (pk.kind === "LEG") {
    spellType = "chain";
  } else {
    spellType = "ice";
  }
  return createPedestalMesh(pk.kind, spellType);
}


// ── Хабовое хранилище: 3D-меши слотов/сундуков ─────────
const hubSlotMeshes = [];   // index → group
const hubChestMeshes = [];  // index → group
let hubStorageInitDone = false;

function ensureHubStorageInit() {
  if (hubStorageInitDone || !room || !room.state) return;
  const slots = room.state.hubSlots;
  const chests = room.state.hubChests;
  if (!slots || !chests || slots.length === 0 || chests.length === 0) return;
  slots.forEach((s, i) => {
    const g = createHubSlotMesh();
    g.position.set(s.pos.x, 0, s.pos.z);
    hubGroup.add(g);
    hubSlotMeshes[i] = g;
    refreshSlotContent(i, s);
    if (typeof s.onChange === "function") s.onChange(() => refreshSlotContent(i, s));
  });
  chests.forEach((c, i) => {
    const g = createHubChestMesh();
    g.position.set(c.pos.x, 0, c.pos.z);
    hubGroup.add(g);
    hubChestMeshes[i] = g;
    updateChestCount(g, c.contents.length);
    if (c.contents && typeof c.contents.onChange === "function") {
      c.contents.onChange(() => updateChestCount(g, c.contents.length));
    }
    if (c.contents && typeof c.contents.onAdd === "function") {
      c.contents.onAdd(() => updateChestCount(g, c.contents.length));
    }
    if (c.contents && typeof c.contents.onRemove === "function") {
      c.contents.onRemove(() => updateChestCount(g, c.contents.length));
    }
  });
  hubStorageInitDone = true;
}

function refreshSlotContent(i, s) {
  const g = hubSlotMeshes[i];
  if (!g) return;
  const mount = g.userData.contentMount;
  while (mount.children.length) {
    const c = mount.children[0];
    mount.remove(c); disposeGroup(c);
  }
  if (!s.empty) {
    const content = makeSlotContent(s.kind, s.handType);
    mount.add(content);
    g.userData.emptyRing.material.opacity = 0.15;
  } else {
    g.userData.emptyRing.material.opacity = 0.35;
  }
}

// FX
const shots = [];
function spawnShotFx(x, y, z, color, dx = 0, dy = 0, dz = 0) {
  const speed = 40;
  // Без PointLight! Динамические света убивают ФПС в THREE.js (рекомпиляция шейдеров).
  // Замена: светящийся MeshBasicMaterial (не нуждается в освещении) + halo-сфера.
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 10, 6),
    new THREE.MeshBasicMaterial({ color })
  );
  m.position.set(x, y, z);
  // Ореол вокруг — большая прозрачная сфера
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 8, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false })
  );
  m.add(halo);
  scene.add(m);
  shots.push({ mesh: m, ttl: 1.2, maxTtl: 1.2, vx: dx * speed, vy: dy * speed, vz: dz * speed });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.8, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.position.set(x, y, z);
  ring.lookAt(camera.position);
  scene.add(ring);
  shots.push({ mesh: ring, ttl: 0.35, maxTtl: 0.35, vx: 0, vy: 0, vz: 0 });
}
// Красивый эффект смерти врага: вспышка + частицы + восходящий дым
function spawnDeathBurst(x, y, z, kind) {
  const isColossus = kind === "COLOSSUS";
  const scale = isColossus ? 2.6 : 1;
  // Ядро — яркая вспышка
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.6 * scale, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.9 })
  );
  flash.position.set(x, y, z);
  scene.add(flash);
  shots.push({ mesh: flash, ttl: 0.35, maxTtl: 0.35, vx: 0, vy: 0, vz: 0 });
  // Частицы (кровь/искры) — уменьшено для производительности
  const cnt = isColossus ? 12 : 6;
  for (let i = 0; i < cnt; i++) {
    const c = new THREE.Mesh(
      new THREE.SphereGeometry(0.09 * scale, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0x992222 })
    );
    c.position.set(x, y, z);
    const a = Math.random() * Math.PI * 2;
    const s = 2 + Math.random() * 4;
    const vy = 1.5 + Math.random() * 3;
    scene.add(c);
    shots.push({
      mesh: c, ttl: 0.9, maxTtl: 0.9,
      vx: Math.cos(a) * s, vy, vz: Math.sin(a) * s, gravity: 6,
    });
  }
  // Дымовое кольцо
  const smoke = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 1.2 * scale, 20),
    new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  smoke.position.set(x, y + 0.05, z);
  smoke.rotation.x = -Math.PI / 2;
  scene.add(smoke);
  shots.push({ mesh: smoke, ttl: 1.1, maxTtl: 1.1, vx: 0, vy: 0.4, vz: 0 });
}

function spawnWaveFx(x, y, z, r) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.2, r, 24),
    new THREE.MeshBasicMaterial({ color: 0xa080ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  m.position.set(x, y, z);
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  shots.push({ mesh: m, ttl: 0.8, maxTtl: 0.8, vx: 0, vy: 0, vz: 0 });
}

// ═══════════════════════════════════════════════════════════════════
// КОНТРОЛЛЕР, СЕТЬ
// ═══════════════════════════════════════════════════════════════════
const controller = new FpsController(camera, canvas);
window.controller = controller;
let client, room, selfId, myPlayer = null, lastHpSeen = 3;
let deathTimer = 0;
let ambientLoop = null;
let footstepTimer = 0;

// Сохранённый ник
const savedName = localStorage.getItem("rrrrrrain_name");
if (savedName) document.getElementById("name").value = savedName;

document.getElementById("play").addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim() || "sgustok";
  localStorage.setItem("rrrrrrain_name", name);
  const url  = document.getElementById("server").value.trim();
  try {
    initAudio(); // разбудить AudioContext сразу после клика
    client = new Client(url);
    room = await client.joinOrCreate(NET.ROOM_NAME, { name });
    window.room = room;
    // Панель синхронизируется при первом получении состояния
    room.onStateChange.once((state) => syncDebugPanelFromState(state));
    // Обновления тоже маппать
    room.onStateChange((state) => { if (!debugOpen) syncDebugPanelFromState(state); });
    selfId = room.sessionId;
    menu.style.display = "none";
    crosshair.style.display = "block";
    controller.enable();
    setupRoomHandlers();
    setInterval(sendInput, 1000 / NET.PLAYER_SEND_HZ);
  } catch (e) {
    console.error(e);
    status.textContent = "не удалось подключиться: " + (e?.message || e);
  }
});

function setupRoomHandlers() {
  room.state.players.onAdd((p, id) => {
    if (id === selfId) {
      myPlayer = p;
    } else {
      // Другой игрок — создаём модель.
      // Сервер шлёт pos.y = 1.6 (центр камеры), а модель рисуется от ног (Y=0).
      // Поэтому опускаем на 1.6.
      const otherMesh = createOtherPlayer(p.name || "player", colorIdxCounter++);
      otherMesh.position.set(p.pos.x, p.pos.y - 1.6, p.pos.z);
      scene.add(otherMesh);
      const entry = {
        mesh: otherMesh, targetX: p.pos.x, targetY: p.pos.y - 1.6, targetZ: p.pos.z,
        targetYaw: p.yaw || 0, prevX: p.pos.x, prevZ: p.pos.z, moving: false,
      };
      otherPlayers.set(id, entry);
      p.onChange(() => {
        entry.targetX = p.pos.x;
        entry.targetY = p.pos.y - 1.6;
        entry.targetZ = p.pos.z;
        entry.targetYaw = p.yaw || 0;
      });
    }

    p.onChange(() => {
      if (id === selfId) {
        // Руки: обновить видимость + заклинания в ладонях
        // Руки всегда видны, меняется только заклинание в ладони
        if (p.hasLeftHand) {
          const spell = HAND_TYPES[p.leftHandType]?.spell;
          const st = spell === "FIREBALL" ? "fireball"
                   : spell === "ICE" ? "ice"
                   : spell === "CHAIN_LIGHTNING" ? "chain" : "fireball";
          setSpellInHand(handsRoot, -1, st);
        } else {
          setSpellInHand(handsRoot, -1, null);
        }
        if (p.hasRightHand) {
          const spell = HAND_TYPES[p.rightHandType]?.spell;
          const st = spell === "FIREBALL" ? "fireball"
                   : spell === "ICE" ? "ice"
                   : spell === "CHAIN_LIGHTNING" ? "chain" : "fireball";
          setSpellInHand(handsRoot, 1, st);
        } else {
          setSpellInHand(handsRoot, 1, null);
        }

        if (p.hp < 3 && p.hp > 0) crackHud.classList.add("on");
        if (p.hp >= 3) crackHud.classList.remove("on");
        if (p.isGhost) {
          deadHud.classList.add("on");
          crackHud.classList.remove("on");
        } else {
          deadHud.classList.remove("on");
        }

        // Звук получения урона
        if (lastHpSeen > p.hp && p.hp > 0) {
          playSound("player_hurt");
        }
        if (lastHpSeen > 0 && p.hp <= 0) {
          playSound("player_death");
        }
        lastHpSeen = p.hp;
      }
    });
  });

  room.state.players.onRemove((_p, id) => {
    if (id === selfId) return;
    const entry = otherPlayers.get(id);
    if (entry) {
      scene.remove(entry.mesh);
      disposeGroup(entry.mesh);
      otherPlayers.delete(id);
    }
  });

  // ── Мобы: 3D-модели с интерполяцией ─────────────────────────
  room.state.enemies.onAdd((e, id) => {
    const m = createEnemy3D(e.enemyType);
    // Сервер шлёт y=1 для наземных (центр тела) — опускаем на 1, чтобы ноги были на полу.
    // Летающие (CACO) шлются y=6+, там офсет не нужен.
    const yOff = m.userData.flying ? 0 : 1.0;
    m.userData.yOff = yOff;
    m.position.set(e.pos.x, e.pos.y - yOff, e.pos.z);
    scene.add(m);
    const entry = {
      mesh: m, targetX: e.pos.x, targetY: e.pos.y - yOff, targetZ: e.pos.z,
      prevX: e.pos.x, prevZ: e.pos.z, moving: false,
      wasAlive: true,
    };
    enemyMeshes.set(id, entry);

    e.onChange(() => {
      entry.targetX = e.pos.x;
      entry.targetY = e.pos.y - yOff;
      entry.targetZ = e.pos.z;
      if (!e.alive && entry.wasAlive) {
        // Звук смерти
        playSound("enemy_death");
        m.visible = false;
        entry.wasAlive = false;
      }
    });
    if (e.pos && e.pos.onChange) {
      e.pos.onChange(() => {
        entry.targetX = e.pos.x;
        entry.targetY = e.pos.y - yOff;
        entry.targetZ = e.pos.z;
      });
    }
  });
  room.state.enemies.onRemove((_e, id) => {
    const entry = enemyMeshes.get(id);
    if (entry) {
      scene.remove(entry.mesh); disposeGroup(entry.mesh); enemyMeshes.delete(id);
    }
  });

  // ── Пьедесталы (арена И хаб) ─────────────────────────────
  // Куда добавлять — решаем по текущей фазе (на арене → arenaGroup)
  room.state.pickups.onAdd((pk, id) => {
    const m = makePickupMesh(pk);
    m.position.set(pk.pos.x, 0, pk.pos.z);
    const parent = room.state.phase === "hub" ? hubGroup : arenaGroup;
    parent.add(m);
    m.userData.parentGroup = parent;
    pickupMeshes.set(id, m);
    pk.onChange(() => { if (pk.taken) { m.visible = false; } });
  });
  room.state.pickups.onRemove((_pk, id) => {
    const m = pickupMeshes.get(id);
    if (m) {
      const parent = m.userData.parentGroup || hubGroup;
      parent.remove(m);
      disposeGroup(m);
      pickupMeshes.delete(id);
    }
  });

  // Инициализация хаб-хранилища (после того как схема пришла)
  ensureHubStorageInit();
  room.onStateChange((_state) => {
    if (!hubStorageInitDone) ensureHubStorageInit();
  });


  // ── Фаза (хаб/арена) ──────────────────────────────────────
  room.state.listen("phase", (v) => {
    hubGroup.visible = v === "hub";
    arenaGroup.visible = v !== "hub";
    // Амбиентный шум отключён (мешал, будет заменён нормальным саунд-дизайном)
    stopSoundLoop(ambientLoop);
    ambientLoop = null;
    // Звук телепорта
    playSound("teleport");
    if (v === "arena" && myPlayer) controller.setPosition(0, 2, 0);
    if (v === "hub" && myPlayer) controller.setPosition(0, 2, WORLD.HUB_RADIUS * 0.3);
  });

  // ── FX ────────────────────────────────────────────────────
  room.onMessage("chat", (msg) => {
    addChatMessage(msg.name || "?", msg.text || "", msg.id === selfId);
  });

  room.onMessage("fx", (msg) => {
    if (msg.type === "shot") {
      spawnShotFx(msg.x, msg.y + 0.6, msg.z, msg.color, msg.dx, msg.dy, msg.dz);
      // Звук каста — по цвету угадываем тип
      if (msg.color === 0xff4400 || msg.color === 0xff5a1f) playSound("fireball_cast");
      else if (msg.color === 0x66ccff) playSound("ice_cast");
      else playSound("chain_cast");
    }
    else if (msg.type === "wave") {
      spawnWaveFx(msg.x, msg.y, msg.z, msg.r);
      playSound("fireball_impact", { volume: 0.35 });
    }
    else if (msg.type === "hurt" && msg.target === selfId) {
      // Трещины на руках вместо красного экрана
      if (handsRoot) showHandDamage(handsRoot, 1.5);
      flashCracks();
      if (typeof msg.fromX === "number" && myPlayer) {
        const dx = msg.fromX - myPlayer.pos.x;
        const dz = msg.fromZ - myPlayer.pos.z;
        dmgAngle = Math.atan2(dx, dz) - controller.yaw;
        dmgTimer = 0.6;
      }
    }
    else if (msg.type === "hit_enemy") {
      // Сервер шлёт для звука попадания
      playSound("enemy_hit");
    }
    else if (msg.type === "enemy_die") {
      spawnDeathBurst(msg.x, msg.y, msg.z, msg.kind);
      playSound("enemy_death");
    }
    else if (msg.type === "death" && msg.target === selfId) {
      deadHud.classList.add("on");
      deathTimer = 3.0;
    }
    else if (msg.type === "respawn" && msg.target === selfId) {
      deadHud.classList.remove("on");
      crackHud.classList.remove("on");
      deathTimer = 0;
    }
  });
}

function flashCracks() {
  crackHud.classList.add("on");
  clearTimeout(flashCracks._t);
  flashCracks._t = setTimeout(() => { if (myPlayer && myPlayer.hp >= 3) crackHud.classList.remove("on"); }, 1200);
}

// ═══════════════════════════════════════════════════════════════════
// ВВОД
// ═══════════════════════════════════════════════════════════════════
let lastCastMs = 0;
canvas.addEventListener("mousedown", (ev) => {
  if (!room || !myPlayer) return;
  const hand = ev.button === 0 ? "left" : ev.button === 2 ? "right" : null;
  if (!hand) return;
  const has = hand === "left" ? myPlayer.hasLeftHand : myPlayer.hasRightHand;
  if (!has && myPlayer.itemsInBody.length === 0) return;
  const nowMs = performance.now();
  if (nowMs - lastCastMs < 250) return;
  lastCastMs = nowMs;
  const spellId = HAND_TYPES[hand === "left" ? myPlayer.leftHandType : myPlayer.rightHandType]?.spell
                || "FIREBALL";
  // НАПРАВЛЕНИЕ — напрямую из yaw/pitch контроллера, не через матрицу камеры.
  // Матрица камеры обновляется в update() и может быть устаревшей на mousedown —
  // особенно на macOS/трекпаде, где события могут приходить между кадрами.
  // Кроме того, handsRoot — child камеры, это может влиять на getWorldDirection.
  const yaw = controller.yaw;
  const pitch = controller.pitch;
  const cosPitch = Math.cos(pitch);
  const dir = new THREE.Vector3(
    -Math.sin(yaw) * cosPitch,
     Math.sin(pitch),
    -Math.cos(yaw) * cosPitch
  );
  const origin = controller.position.clone().add(new THREE.Vector3(0, 0.4, 0));
  room.send("cast", {
    spell: spellId, dx: dir.x, dy: dir.y, dz: dir.z,
    ox: origin.x, oy: origin.y, oz: origin.z, hand
  });
  // Анимация отдачи руки
  handsRoot.userData[hand === "left" ? "leftHand" : "rightHand"].userData.recoil = 1.0;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("keydown", (ev) => {
  if (!room) return;
  // Чат: Enter — открыть/отправить
  if (ev.code === "Enter") {
    if (chatOpen) {
      const text = chatInput.value.trim();
      if (text) room.send("chat", { text });
      chatInput.value = "";
      chatInput.style.display = "none";
      chatInput.blur();
      chatOpen = false;
      controller.enable();
    } else {
      chatOpen = true;
      chatInput.style.display = "block";
      chatInput.focus();
      controller.releasePointer();
    }
    ev.preventDefault();
    return;
  }
  if (chatOpen) return; // пока открыт чат — остальные вводы игнорируем
  // Тильда — дебаг-панель
  if (ev.code === "Backquote") {
    toggleDebugPanel();
    ev.preventDefault();
    return;
  }
  if (ev.code === "Escape") controller.releasePointer();
  // R-респ убран — теперь в дебаг-панели
  if (ev.code === "KeyF") {
    // 1) На арене или в хабе — пикапы приоритетнее
    let bestId = null, bestD = Infinity;
    pickupMeshes.forEach((m, id) => {
      const pk = room.state.pickups.get(id);
      if (!pk || pk.taken) return;
      const d = m.position.distanceTo(controller.position);
      if (d < 3 && d < bestD) { bestD = d; bestId = id; }
    });
    if (bestId) {
      room.send("pickup", { id: bestId });
      playSound("pickup");
      return;
    }
    // 2) В хабе — слоты, сундуки, алтарь
    if (room.state.phase === "hub") {
      // Ближайший слот
      let bestSlot = -1, bsD = 3;
      hubSlotMeshes.forEach((g, i) => {
        const d = g.position.distanceTo(controller.position);
        if (d < bsD) { bsD = d; bestSlot = i; }
      });
      // Ближайший сундук
      let bestChest = -1, bcD = 3;
      hubChestMeshes.forEach((g, i) => {
        const d = g.position.distanceTo(controller.position);
        if (d < bcD) { bcD = d; bestChest = i; }
      });
      // Алтарь (центр)
      const altarD = Math.hypot(controller.position.x, controller.position.z);
      const nearAltar = altarD < 3;
      // Приоритет: ближайшее из трёх
      const cands = [];
      if (bestSlot >= 0) cands.push({ kind: "slot", i: bestSlot, d: bsD });
      if (bestChest >= 0) cands.push({ kind: "chest", i: bestChest, d: bcD });
      if (nearAltar) cands.push({ kind: "altar", d: altarD });
      cands.sort((a, b) => a.d - b.d);
      const c = cands[0];
      if (!c) return;
      if (c.kind === "slot") {
        const slot = room.state.hubSlots[c.i];
        if (slot && !slot.empty) {
          room.send("hub_take", { source: "slot", index: c.i });
          playSound("pickup");
        }
      } else if (c.kind === "chest") {
        const chest = room.state.hubChests[c.i];
        if (chest && chest.contents.length > 0) {
          room.send("hub_take", { source: "chest", index: c.i, item: chest.contents.length - 1 });
          playSound("pickup");
        }
      } else if (c.kind === "altar") {
        // По F возле алтаря: если у меня есть рука — положить, иначе забрать (если что-то есть)
        const list = room.state.hubReforgeSlots;
        if (myPlayer && (myPlayer.hasLeftHand || myPlayer.hasRightHand) && list.length < 3) {
          room.send("hub_reforge", { op: "put_hand" });
          playSound("pickup");
        } else if (list.length > 0) {
          room.send("hub_reforge", { op: "take" });
          playSound("pickup");
        }
      }
    }
  }
  // G — скрафтить в алтаре (если стоишь рядом и 3 руки одного типа)
  if (ev.code === "KeyG" && room.state.phase === "hub") {
    const altarD = Math.hypot(controller.position.x, controller.position.z);
    if (altarD < 3 && room.state.hubReforgeSlots.length === 3) {
      room.send("hub_reforge", { op: "craft" });
      playSound("teleport");
    }
  }
  // E-телепорт убран — телепортация только через порталы или дебаг-панель
  if (ev.code === "Space") {
    playSound("jump");
  }
});

function sendInput() {
  if (!room) return;
  const p = controller.position;
  room.send("input", { x: p.x, y: p.y, z: p.z, yaw: controller.yaw, pitch: controller.pitch });
}

// ═══════════════════════════════════════════════════════════════════
// РАДАР
// ═══════════════════════════════════════════════════════════════════
function drawRadar() {
  rctx.clearRect(0, 0, radar.width, radar.height);
  if (!myPlayer || !room) return;
  let nearest = null, nd = Infinity;
  room.state.enemies.forEach(e => {
    if (!e.alive) return;
    const dx = e.pos.x - myPlayer.pos.x;
    const dz = e.pos.z - myPlayer.pos.z;
    const d = dx*dx + dz*dz;
    if (d < nd) { nd = d; nearest = e; }
  });
  if (!nearest) return;
  const dx = nearest.pos.x - myPlayer.pos.x;
  const dz = nearest.pos.z - myPlayer.pos.z;
  const enemyAngle = Math.atan2(dx, dz);
  let rel = enemyAngle - controller.yaw;
  while (rel > Math.PI) rel -= 2*Math.PI;
  while (rel < -Math.PI) rel += 2*Math.PI;
  const clamped = Math.max(-Math.PI/2, Math.min(Math.PI/2, rel));
  const x = (clamped / (Math.PI/2)) * (radar.width/2 - 20) + radar.width/2;
  const behind = Math.abs(rel) > Math.PI/2;
  rctx.fillStyle = behind ? "#ff2222" : "#ffcc22";
  rctx.beginPath();
  rctx.moveTo(x, 10);
  rctx.lineTo(x - 8, 30);
  rctx.lineTo(x + 8, 30);
  rctx.closePath();
  rctx.fill();
  rctx.fillStyle = "#fff";
  rctx.font = "12px monospace";
  rctx.textAlign = "center";
  rctx.fillText(behind ? "СЗАДИ" : Math.round(Math.sqrt(nd)) + "м", x, 50);
}

// ═══════════════════════════════════════════════════════════════════
// АНИМАЦИОННЫЙ ЦИКЛ
// ═══════════════════════════════════════════════════════════════════
const clock = new THREE.Clock();
let prevControllerPos = new THREE.Vector3();

// ── ПОРТАЛЫ: автотриггер ────────────────────────────────
let portalHoldTime = 0;
let lastPortalKind = null;
let portalPendingPhase = null; // какую phase ждём от сервера после телепорта
function handlePortalTriggers(dt) {
  if (!room || !myPlayer) return;
  const cur = room.state.phase;
  // Если мы в ожидании смены phase (кликнули на 100%) — молчим
  if (portalPendingPhase) {
    if (cur === portalPendingPhase) { portalPendingPhase = null; portalHoldTime = 0; }
    hintText.style.opacity = 0;
    return;
  }
  let inZone = false;
  let ready = false;
  let msg = null;
  let target = null;
  if (cur === "hub") {
    const pos = getHubPortalPos(hubGroup);
    if (pos) {
      const d = Math.hypot(controller.position.x - pos.x, controller.position.z - pos.z);
      if (d < 2.5) { inZone = true; ready = true; msg = { phase: "arena" }; target = "hub"; }
    }
  } else {
    const pos = getArenaPortalPos(arenaGroup);
    if (pos) {
      const d = Math.hypot(controller.position.x - pos.x, controller.position.z - pos.z);
      if (d < 2.5) {
        inZone = true;
        target = "arena";
        if (cur === "portal_ready") { ready = true; msg = { phase: "hub" }; }
      }
    }
  }
  if (inZone && ready) {
    if (lastPortalKind !== target) { portalHoldTime = 0; lastPortalKind = target; }
    portalHoldTime += dt;
    // Показ прогресса
    const pct = Math.min(100, Math.round(portalHoldTime / 1.5 * 100));
    hintText.textContent = `телепорт... ${pct}%`;
    hintText.style.opacity = 1;
    hintTimer = 0.3;
    if (portalHoldTime >= 1.5) {
      room.send("phase", msg);
      portalPendingPhase = msg.phase;
      portalHoldTime = 0;
      lastPortalKind = null;
      // Показываем "перенос..."
      hintText.textContent = "перенос...";
      hintText.style.opacity = 1;
      hintTimer = 2.0;
    }
  } else if (inZone && !ready) {
    portalHoldTime = 0;
    hintText.textContent = "портал ещё не заряжен — бей врагов";
    hintText.style.opacity = 1;
    hintTimer = 0.3;
  } else {
    portalHoldTime = 0;
    lastPortalKind = null;
  }
}


// Подсказка о взаимодействии с хаб-объектами
function updateHubInteractionHint() {
  if (!room || !myPlayer || room.state.phase !== "hub") return;
  // Показываем ТОЛЬКО когда действительно можно нажать F/G рядом с объектом (< 2м)
  let action = null;
  hubSlotMeshes.forEach((g, i) => {
    const d = g.position.distanceTo(controller.position);
    if (d < 2 && !action) {
      const slot = room.state.hubSlots[i];
      if (slot && !slot.empty) action = `[F] взять ${slotLabel(slot.kind, slot.handType, slot.itemId)}`;
    }
  });
  hubChestMeshes.forEach((g, i) => {
    const d = g.position.distanceTo(controller.position);
    if (d < 2.5 && !action) {
      const chest = room.state.hubChests[i];
      const n = chest ? chest.contents.length : 0;
      if (n > 0) action = `[F] открыть сундук (${n})`;
      else action = "сундук пуст";
    }
  });
  const altarD = Math.hypot(controller.position.x, controller.position.z);
  if (altarD < 2.5 && !action) {
    const list = room.state.hubReforgeSlots;
    if (list.length === 3) {
      const parts = [...list].map(x => String(x).split(":"));
      const same = parts.every(([k]) => k === "HAND") && parts.every(([, t]) => t === parts[0][1]);
      if (same) action = `[G] сплавить 3×${parts[0][1]}`;
      else action = "[F] забрать (нужны 3 одинаковых)";
    } else if (list.length > 0) {
      action = `[F] положить/забрать (${list.length}/3)`;
    } else if (myPlayer.hasLeftHand || myPlayer.hasRightHand) {
      action = "[F] положить руку в алтарь";
    }
  }
  if (action) {
    hintText.textContent = action;
    hintText.style.opacity = 1.0;
    hintTimer = 0.2;
  }
}

function slotLabel(kind, handType, itemId) {
  if (kind === "HAND") return `руку (${handType || "?"})`;
  if (kind === "LEG") return "ногу";
  if (kind === "ITEM") return `предмет (${itemId || "?"})`;
  return "предмет";
}

let fellFlashUntil = 0;
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  controller.update(dt, myPlayer);

  // ── ПАДЕНИЕ С КРАЯ: смерть + респаун в центре хаба ────────
  if (room && myPlayer && room.state.phase === "hub") {
    const p = controller.position;
    // Падаем с края если: вне радиуса хаба ИЗ высота < -5
    const distXZ = Math.hypot(p.x, p.z);
    const outside = distXZ > WORLD.HUB_RADIUS * 1.05;
    const belowDeath = p.y < -5;
    if (belowDeath || (outside && p.y < 0)) {
      controller.setPosition(0, 2, WORLD.HUB_RADIUS * 0.3);
      // Обнулить вертикальную скорость внутри контроллера
      if (controller.velocity) { controller.velocity.x = 0; controller.velocity.y = 0; controller.velocity.z = 0; }
      playSound("teleport");
      fellFlashUntil = performance.now() + 350;
      // Кратко мигнуть подсказкой
      hintText.textContent = "Не падай с края";
      hintText.style.opacity = 1;
      setTimeout(() => { hintText.style.opacity = 0; }, 1500);
    }
  }

  // Определяем движется ли игрок (для звука шагов)
  const nowP = controller.position;
  const moved = nowP.distanceTo(prevControllerPos) > 0.01;
  if (moved && myPlayer && !myPlayer.isGhost) {
    footstepTimer -= dt;
    if (footstepTimer <= 0) {
      playSound("footstep");
      footstepTimer = 0.4;
    }
  }
  prevControllerPos.copy(nowP);

  // ── Враги: интерполяция + анимация ──────────────────────
  const lerpSpeed = 12;
  enemyMeshes.forEach(entry => {
    const m = entry.mesh;
    const a = Math.min(1, dt * lerpSpeed);
    m.position.x += (entry.targetX - m.position.x) * a;
    m.position.y += (entry.targetY - m.position.y) * a;
    m.position.z += (entry.targetZ - m.position.z) * a;

    // Определяем движение
    const moved = Math.hypot(m.position.x - entry.prevX, m.position.z - entry.prevZ) > 0.005;
    entry.moving = moved;
    entry.prevX = m.position.x;
    entry.prevZ = m.position.z;

    // Поворот в сторону движения
    if (moved) {
      const dx = entry.targetX - m.position.x;
      const dz = entry.targetZ - m.position.z;
      if (dx * dx + dz * dz > 0.001) {
        const targetYaw = Math.atan2(dx, dz);
        // Плавный поворот
        let diff = targetYaw - m.rotation.y;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        m.rotation.y += diff * Math.min(1, dt * 6);
      }
    }
    animateEnemy(m, dt, moved);
  });

  // ── Другие игроки ─────────────────────────────────────
  otherPlayers.forEach(entry => {
    const m = entry.mesh;
    const a = Math.min(1, dt * 12);
    m.position.x += (entry.targetX - m.position.x) * a;
    m.position.y += (entry.targetY - m.position.y) * a;
    m.position.z += (entry.targetZ - m.position.z) * a;
    // Поворот на yaw (лицом куда смотрит)
    let diff = entry.targetYaw - m.rotation.y;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    m.rotation.y += diff * Math.min(1, dt * 8);

    const moved = Math.hypot(m.position.x - entry.prevX, m.position.z - entry.prevZ) > 0.005;
    entry.prevX = m.position.x; entry.prevZ = m.position.z;
    animateOtherPlayer(m, dt, moved);

    // Табличка с именем всегда смотрит на камеру (билборд)
    if (m.userData.nameSprite) {
      // Sprite автоматически смотрит на камеру
    }
  });

  // ── Пьедесталы (кристаллы вращаются) ─────────────────
  pickupMeshes.forEach(m => {
    if (m.userData.crystal) animatePedestal(m, dt);
  });

  // ── Факелы (пламя мерцает) ──────────────────────────
  const activeGroup = hubGroup.visible ? hubGroup : arenaGroup;
  animateTorches(activeGroup, dt);
  if (room) {
    const tSec = performance.now() * 0.001;
    updateArenaPortal(arenaGroup, room.state.phase === "portal_ready", tSec);
    updateHubPortal(hubGroup, tSec);
    animateDangerZones(arenaGroup, tSec);
  // Открытие ближайшего сундука в хабе
  if (room && room.state.phase === "hub") {
    hubChestMeshes.forEach((g, i) => {
      const d = g.position.distanceTo(controller.position);
      const open = d < 3;
      setChestOpen(g, open, dt);
    });
  } else {
    hubChestMeshes.forEach(g => setChestOpen(g, false, dt));
  }
    // Алтарь-переработчик
    if (hubGroup.userData.hubAltar && room.state.hubReforgeSlots) {
      updateHubAltar(hubGroup.userData.hubAltar, [...room.state.hubReforgeSlots], tSec);
    }
    updateHubInteractionHint();
    handlePortalTriggers(dt);
  }

  // HUD-подсказка
  if (hintTimer > 0) {
    hintTimer -= dt;
    hintText.style.opacity = hintTimer > 0 ? 1 : 0;
  }

  // ── Снаряды ─────────────────────────────────────────
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.ttl -= dt;
    if (s.vx || s.vy || s.vz) {
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
    }
    if (s.gravity) { s.vy -= s.gravity * dt; }
    if (s.mesh.material) {
      s.mesh.material.opacity = Math.max(0, s.ttl / s.maxTtl);
      s.mesh.material.transparent = true;
    }
    if (s.ttl <= 0) { scene.remove(s.mesh); disposeGroup(s.mesh); shots.splice(i, 1); }
  }

  if (deathTimer > 0) {
    deathTimer -= dt;
    // Авто-респ убран — через дебаг-панель
    void deathTimer;
  }
  if (dmgTimer > 0) {
    dmgTimer -= dt;
    // Красный экранный overlay убран — трещины на руках вместо этого (в hands3d)
    dmgOverlay.style.opacity = 0;
  } else {
    dmgOverlay.style.opacity = 0;
  }

  // ── Анимация рук ─────────────────────────────────────
  animateHands(handsRoot, dt, { moving: moved });
  fadeHandCracks(handsRoot, dt);

  drawRadar();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// ═══════════════════════════════════════════════════════════════════
// СТАТУС-ЛЕНТА
// ═══════════════════════════════════════════════════════════════════
setInterval(() => {
  if (!room) return;
  const ph = room.state.phase;
  const wv = room.state.wave;
  const chg = `${room.state.portalCharge}/${room.state.portalTarget}`;
  const pl = room.state.players.size;
  const hp = myPlayer ? `HP:${myPlayer.hp}/3` : "";
  const dt = deathTimer > 0 ? `  RESPAWN in ${deathTimer.toFixed(1)}s (или R)` : "";
  status.textContent = `${hp}  фаза:${ph}  волна:${wv}  портал:${chg}  игроки:${pl}${dt}`;
}, 250);
