import * as THREE from "three";
import { Client } from "colyseus.js";
import { NET, WORLD, HAND_TYPES, SPELLS, ENEMY_TYPES, ITEMS, COMBAT } from "@mhfps/shared";
import { setupHub, setupArena, disposeGroup, animateTorches, updateArenaPortal, getArenaPortalPos } from "./world.js";
import { createEnemy3D, animateEnemy } from "./enemies3d.js";
import { createHandsGroup, animateHands, setSpellInHand } from "./hands3d.js";
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
  return createPedestalMesh(spellType);
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

  // ── Пьедесталы ────────────────────────────────────────────
  room.state.pickups.onAdd((pk, id) => {
    const m = makePickupMesh(pk);
    // Сервер шлёт y=1.2 (высота вершины для подбора), а модель постамента рисуется от пола.
    // Добавляем в hubGroup — постаменты видны только в хабе, на арене прячутся.
    m.position.set(pk.pos.x, 0, pk.pos.z);
    hubGroup.add(m);
    pickupMeshes.set(id, m);
    pk.onChange(() => { if (pk.taken) { m.visible = false; } });
  });
  room.state.pickups.onRemove((_pk, id) => {
    const m = pickupMeshes.get(id); if (m) { hubGroup.remove(m); disposeGroup(m); pickupMeshes.delete(id); }
  });

  // ── Фаза (хаб/арена) ──────────────────────────────────────
  room.state.listen("phase", (v) => {
    hubGroup.visible = v === "hub";
    arenaGroup.visible = v !== "hub";
    // Разные амбиенты
    stopSoundLoop(ambientLoop);
    if (v === "hub") {
      ambientLoop = playSoundLoop("hub_ambient", { volume: 0.08 });
    } else {
      ambientLoop = playSoundLoop("arena_ambient", { volume: 0.10 });
    }
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
  // Клиентский rate-limit: 250мс
  const now = performance.now();
  if (now - lastCastMs < 250) return;
  lastCastMs = now;
  const has = hand === "left" ? myPlayer.hasLeftHand : myPlayer.hasRightHand;
  if (!has && myPlayer.itemsInBody.length === 0) return;
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
  if (ev.code === "Escape") controller.releasePointer();
  if (ev.code === "KeyR" && myPlayer?.isGhost) room.send("respawn", {});
  if (ev.code === "KeyF") {
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
    }
  }
  if (ev.code === "KeyE") {
    const cur = room.state.phase;
    if (cur === "hub") {
      // Из хаба — всегда можно на арену
      room.send("phase", { phase: "arena" });
    } else {
      // С арены — только если рядом с порталом и он готов
      const portalPos = getArenaPortalPos(arenaGroup);
      const ready = cur === "portal_ready";
      if (ready && portalPos) {
        const d = Math.hypot(controller.position.x - portalPos.x, controller.position.z - portalPos.z);
        if (d < 4) {
          room.send("phase", { phase: "hub" });
        } else {
          hintText.textContent = "подойди к порталу в центре арены";
          hintTimer = 2;
        }
      } else {
        hintText.textContent = "портал ещё не готов — бей врагов";
        hintTimer = 2;
      }
    }
  }
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

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  controller.update(dt, myPlayer);

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
    updateArenaPortal(arenaGroup, room.state.phase === "portal_ready", performance.now() * 0.001);
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
    if (s.mesh.material) {
      s.mesh.material.opacity = Math.max(0, s.ttl / s.maxTtl);
      s.mesh.material.transparent = true;
    }
    if (s.ttl <= 0) { scene.remove(s.mesh); disposeGroup(s.mesh); shots.splice(i, 1); }
  }

  if (deathTimer > 0) {
    deathTimer -= dt;
    if (deathTimer <= 0 && room && myPlayer?.isGhost) room.send("respawn", {});
  }
  if (dmgTimer > 0) {
    dmgTimer -= dt;
    dmgOverlay.style.opacity = Math.max(0, dmgTimer / 0.6);
    dmgOverlay.style.background = `radial-gradient(circle at ${50 + Math.sin(dmgAngle)*45}% ${50 - Math.cos(dmgAngle)*45}%, rgba(255,20,20,0.6) 0%, transparent 40%)`;
  } else {
    dmgOverlay.style.opacity = 0;
  }

  // ── Анимация рук ─────────────────────────────────────
  animateHands(handsRoot, dt, { moving: moved });

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
