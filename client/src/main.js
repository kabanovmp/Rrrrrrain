import * as THREE from "three";
import { Client } from "colyseus.js";
import { NET, WORLD, HAND_TYPES, SPELLS, ENEMY_TYPES, ITEMS, COMBAT } from "@mhfps/shared";
import { createSpriteTexture } from "./sprites.js";
import { setupHub, setupArena, disposeGroup } from "./world.js";
import { createHandMesh, createHandFistTexture } from "./hands.js";
import { FpsController } from "./controller.js";

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

// Debug панель — показывает ошибки в браузере
const debugPanel = document.createElement("div");
debugPanel.style.cssText = "position:fixed;right:8px;bottom:8px;max-width:400px;max-height:200px;overflow:auto;background:rgba(0,0,0,0.8);color:#0f0;font:11px monospace;padding:6px;z-index:99;border:1px solid #333;";
debugPanel.textContent = "debug ready";
document.body.appendChild(debugPanel);
function dbg(msg) {
  const line = document.createElement("div");
  line.textContent = new Date().toISOString().slice(11,19) + " " + msg;
  debugPanel.appendChild(line);
  while (debugPanel.childNodes.length > 20) debugPanel.removeChild(debugPanel.firstChild);
}
window.addEventListener("error", e => dbg("ERR: " + (e.message || e.error)));
window.addEventListener("unhandledrejection", e => dbg("REJECT: " + (e.reason?.message || e.reason)));

const dmgOverlay = document.createElement("div");
dmgOverlay.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:14;opacity:0;transition:opacity .3s;";
document.body.appendChild(dmgOverlay);
let dmgAngle = 0, dmgTimer = 0;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setClearColor(0x0a0505);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0505, 25, 80);

const camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.05, 500);
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});
renderer.setSize(window.innerWidth, window.innerHeight, false);

scene.add(new THREE.AmbientLight(0x554433, 0.9));
const keyLight = new THREE.DirectionalLight(0xffb080, 0.6);
keyLight.position.set(20, 30, 10);
scene.add(keyLight);

const hubGroup = new THREE.Group();
const arenaGroup = new THREE.Group();
scene.add(hubGroup, arenaGroup);
setupHub(hubGroup);
setupArena(arenaGroup);
arenaGroup.visible = false;

const handRig = new THREE.Group();
camera.add(handRig);
scene.add(camera);

const leftHandMesh  = createHandMesh("left");
const rightHandMesh = createHandMesh("right");
handRig.add(leftHandMesh, rightHandMesh);
leftHandMesh.visible = false;
rightHandMesh.visible = false;

// enemyMeshes: {mesh, targetX, targetY, targetZ} для интерполяции
const enemyMeshes = new Map();
const enemyTextures = {};
for (const key of Object.keys(ENEMY_TYPES)) {
  enemyTextures[key] = createSpriteTexture(key);
}

function makeEnemyMesh(typeId) {
  const t = ENEMY_TYPES[typeId];
  const g = new THREE.Group();
  const mat = new THREE.SpriteMaterial({ map: enemyTextures[typeId], depthWrite: false });
  const s = new THREE.Sprite(mat);
  const scaleUp = t.scale * 1.5;
  s.scale.set(scaleUp, scaleUp, scaleUp);
  s.position.y = scaleUp * 0.5;
  g.add(s);
  g.userData = { sprite: s, type: typeId };
  return g;
}

const pickupMeshes = new Map();
function makePickupMesh(pk) {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.75, 1.0, 6),
    new THREE.MeshStandardMaterial({ color: 0xa0958a, roughness: 1.0, metalness: 0.0, flatShading: true })
  );
  ped.position.y = 0.5;
  g.add(ped);

  let item;
  if (pk.kind === "HAND") {
    const col = HAND_TYPES[pk.handType]?.color || 0xff5a1f;
    item = new THREE.Sprite(new THREE.SpriteMaterial({ map: createHandFistTexture(col), depthWrite: false }));
    item.scale.set(1.1, 1.1, 1.1);
    item.position.y = 1.5;
  } else if (pk.kind === "LEG") {
    item = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.7, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0x442200 })
    );
    item.position.y = 1.6;
  } else {
    const cfg = ITEMS.find(i => i.id === pk.itemId);
    const c = cfg?.color || 0xffffff;
    item = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4 })
    );
    item.position.y = 1.5;
    item.userData.spin = true;
  }
  g.add(item);
  g.userData = { spinner: item };
  return g;
}

const shots = [];
function spawnShotFx(x, y, z, color, dx = 0, dy = 0, dz = 0) {
  const speed = 40;
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0 })
  );
  m.position.set(x, y, z);
  scene.add(m);
  shots.push({ mesh: m, ttl: 1.2, maxTtl: 1.2, vx: dx * speed, vy: dy * speed, vz: dz * speed });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.8, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
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

const controller = new FpsController(camera, canvas);

let client, room, selfId, myPlayer = null, lastHpSeen = 3;
let deathTimer = 0;

document.getElementById("play").addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim() || "sgustok";
  const url  = document.getElementById("server").value.trim();
  try {
    client = new Client(url);
    room = await client.joinOrCreate(NET.ROOM_NAME, { name });
    selfId = room.sessionId;
    menu.style.display = "none";
    crosshair.style.display = "block";
    controller.enable();
    setupRoomHandlers();
    setInterval(sendInput, 1000 / NET.PLAYER_SEND_HZ);
    dbg("joined room, selfId=" + selfId);
  } catch (e) {
    console.error(e);
    dbg("JOIN FAIL: " + (e?.message || e));
    status.textContent = "не удалось подключиться: " + (e?.message || e);
  }
});

function setupRoomHandlers() {
  room.state.players.onAdd((p, id) => {
    if (id === selfId) { myPlayer = p; dbg("myPlayer set, hp=" + p.hp); }
    p.onChange(() => {
      if (id === selfId) {
        leftHandMesh.visible  = p.hasLeftHand;
        rightHandMesh.visible = p.hasRightHand;
        if (p.hasLeftHand)  leftHandMesh.userData.setColor(HAND_TYPES[p.leftHandType]?.color  || 0xff5a1f);
        if (p.hasRightHand) rightHandMesh.userData.setColor(HAND_TYPES[p.rightHandType]?.color || 0xff5a1f);

        // Трещины только если реально ранен: hp === 1 (полное = 3, одно попадание = 2, критично = 1)
        if (p.hp === 1) crackHud.classList.add("on");
        else crackHud.classList.remove("on");
        if (p.isGhost) { deadHud.classList.add("on"); crackHud.classList.remove("on"); }
        else deadHud.classList.remove("on");
        lastHpSeen = p.hp;
      }
    });
  });
  room.state.players.onRemove((_p, _id) => {});

  // Мобы: интерполяция позиций
  room.state.enemies.onAdd((e, id) => {
    const m = makeEnemyMesh(e.enemyType);
    m.position.set(e.pos.x, e.pos.y, e.pos.z);
    scene.add(m);
    const entry = { mesh: m, targetX: e.pos.x, targetY: e.pos.y, targetZ: e.pos.z };
    enemyMeshes.set(id, entry);
    // Подписка через try/catch, чтобы падение не убило весь handler
    try {
      e.onChange(() => {
        entry.targetX = e.pos.x;
        entry.targetY = e.pos.y;
        entry.targetZ = e.pos.z;
        if (!e.alive) { m.visible = false; }
        if (e.hp === 1 && e.maxHp === 2) m.userData.sprite.material.color.setHex(0xff8080);
      });
    } catch (err) { console.warn("enemy onChange fail", err); }
  });
  room.state.enemies.onRemove((_e, id) => {
    const entry = enemyMeshes.get(id);
    if (entry) { scene.remove(entry.mesh); disposeGroup(entry.mesh); enemyMeshes.delete(id); }
  });

  room.state.pickups.onAdd((pk, id) => {
    const m = makePickupMesh(pk);
    m.position.set(pk.pos.x, pk.pos.y, pk.pos.z);
    scene.add(m);
    pickupMeshes.set(id, m);
    pk.onChange(() => { if (pk.taken) { m.visible = false; } });
  });
  room.state.pickups.onRemove((_pk, id) => {
    const m = pickupMeshes.get(id); if (m) { scene.remove(m); disposeGroup(m); pickupMeshes.delete(id); }
  });

  room.state.listen("phase", (v) => {
    dbg("phase changed to " + v);
    hubGroup.visible = v === "hub";
    arenaGroup.visible = v !== "hub";
    if (v === "arena" && myPlayer) controller.setPosition(0, 2, 0);
    if (v === "hub" && myPlayer) controller.setPosition(0, 2, WORLD.HUB_RADIUS * 0.3);
  });

  room.onMessage("fx", (msg) => {
    if (msg.type === "shot") spawnShotFx(msg.x, msg.y + 0.6, msg.z, msg.color, msg.dx, msg.dy, msg.dz);
    else if (msg.type === "wave") spawnWaveFx(msg.x, msg.y, msg.z, msg.r);
    else if (msg.type === "hurt" && msg.target === selfId) {
      flashCracks();
      if (typeof msg.fromX === "number" && myPlayer) {
        const dx = msg.fromX - myPlayer.pos.x;
        const dz = msg.fromZ - myPlayer.pos.z;
        dmgAngle = Math.atan2(dx, dz) - controller.yaw;
        dmgTimer = 0.6;
      }
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
  flashCracks._t = setTimeout(() => { if (myPlayer && myPlayer.hp > 1) crackHud.classList.remove("on"); }, 1200);
}

canvas.addEventListener("mousedown", (ev) => {
  if (!room || !myPlayer) return;
  const hand = ev.button === 0 ? "left" : ev.button === 2 ? "right" : null;
  if (!hand) return;
  const has = hand === "left" ? myPlayer.hasLeftHand : myPlayer.hasRightHand;
  if (!has && myPlayer.itemsInBody.length === 0) return;
  const spellId = HAND_TYPES[hand === "left" ? myPlayer.leftHandType : myPlayer.rightHandType]?.spell
                || "FIREBALL";
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = controller.position.clone().add(new THREE.Vector3(0, 0.4, 0));
  room.send("cast", {
    spell: spellId, dx: dir.x, dy: dir.y, dz: dir.z,
    ox: origin.x, oy: origin.y, oz: origin.z, hand
  });
  const meshRef = hand === "left" ? leftHandMesh : rightHandMesh;
  meshRef.userData.kick();
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("keydown", (ev) => {
  if (!room) return;
  if (ev.code === "Escape") controller.releasePointer();
  if (ev.code === "KeyR" && myPlayer?.isGhost) room.send("respawn", {});
  if (ev.code === "KeyF") {
    let bestId = null, bestD = Infinity, closestD = Infinity;
    pickupMeshes.forEach((m, id) => {
      const pk = room.state.pickups.get(id);
      if (!pk || pk.taken) return;
      const d = m.position.distanceTo(controller.position);
      if (d < closestD) closestD = d;
      if (d < 5 && d < bestD) { bestD = d; bestId = id; }
    });
    dbg("F: closest=" + closestD.toFixed(1) + "m, sending=" + (bestId || "NONE (need <5m)"));
    if (bestId) room.send("pickup", { id: bestId });
  }
  if (ev.code === "KeyE") {
    const cur = room.state.phase;
    const next = cur === "hub" ? "arena" : "hub";
    dbg("E: send phase " + cur + "->" + next);
    room.send("phase", { phase: next });
  }
});

function sendInput() {
  if (!room) return;
  const p = controller.position;
  room.send("input", { x: p.x, y: p.y, z: p.z, yaw: controller.yaw, pitch: controller.pitch });
}

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

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  controller.update(dt, myPlayer);

  // Интерполируем позиции мобов к целевым (плавно при пинге)
  const lerpSpeed = 12; // выше = резче реакция
  enemyMeshes.forEach(entry => {
    const m = entry.mesh;
    const a = Math.min(1, dt * lerpSpeed);
    m.position.x += (entry.targetX - m.position.x) * a;
    m.position.y += (entry.targetY - m.position.y) * a;
    m.position.z += (entry.targetZ - m.position.z) * a;
  });

  pickupMeshes.forEach(m => { if (m.userData.spinner?.userData?.spin) m.userData.spinner.rotation.y += dt * 1.2; });
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
  leftHandMesh.userData.update?.(dt);
  rightHandMesh.userData.update?.(dt);

  drawRadar();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// Пинг измеряем через ping-pong
let pingMs = 0;
setInterval(() => {
  if (!room?.connection?.transport?.ws) return;
  const t0 = performance.now();
  try {
    room.send("__ping", t0);
    // ответа нет — считаем по round-trip последнего state, но покажем «~200мс» приблизительно
  } catch {}
}, 2000);

setInterval(() => {
  if (!room) return;
  const ph = room.state.phase;
  const wv = room.state.wave;
  const chg = `${room.state.portalCharge}/${room.state.portalTarget}`;
  const pl = room.state.players.size;
  const hp = myPlayer ? `HP:${myPlayer.hp}` : "";
  const dt = deathTimer > 0 ? `  RESPAWN in ${deathTimer.toFixed(1)}s (или R)` : "";
  status.textContent = `${hp}  фаза:${ph}  волна:${wv}  портал:${chg}  игроки:${pl}${dt}`;
}, 250);
