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

scene.add(new THREE.AmbientLight(0x554433, 0.7));
const keyLight = new THREE.DirectionalLight(0xffb080, 0.5);
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
  s.scale.set(t.scale, t.scale, t.scale);
  s.position.y = t.scale * 0.5;
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

// Brighter, longer-lived shot fx
const shots = [];
function spawnShotFx(x, y, z, color) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0 })
  );
  m.position.set(x, y, z);
  scene.add(m);
  shots.push({ mesh: m, ttl: 1.2, maxTtl: 1.2 });

  // extra glow ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 1.2, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
  );
  ring.position.set(x, y, z);
  ring.lookAt(camera.position);
  scene.add(ring);
  shots.push({ mesh: ring, ttl: 0.5, maxTtl: 0.5 });
}
function spawnWaveFx(x, y, z, r) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.2, r, 24),
    new THREE.MeshBasicMaterial({ color: 0xa080ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  m.position.set(x, y, z);
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  shots.push({ mesh: m, ttl: 0.8, maxTtl: 0.8 });
}

const controller = new FpsController(camera, canvas);

let client, room, selfId, myPlayer = null, lastHpSeen = 2;
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
  } catch (e) {
    console.error(e);
    status.textContent = "не удалось подключиться: " + (e?.message || e);
  }
});

function setupRoomHandlers() {
  room.state.players.onAdd((p, id) => {
    if (id === selfId) myPlayer = p;
    p.onChange(() => {
      if (id === selfId) {
        leftHandMesh.visible  = p.hasLeftHand;
        rightHandMesh.visible = p.hasRightHand;
        if (p.hasLeftHand)  leftHandMesh.userData.setColor(HAND_TYPES[p.leftHandType]?.color  || 0xff5a1f);
        if (p.hasRightHand) rightHandMesh.userData.setColor(HAND_TYPES[p.rightHandType]?.color || 0xff5a1f);

        if (p.hp === 1 && lastHpSeen === 2) crackHud.classList.add("on");
        if (p.hp >= 2) crackHud.classList.remove("on");
        if (p.isGhost) { deadHud.classList.add("on"); crackHud.classList.remove("on"); }
        else deadHud.classList.remove("on");
        lastHpSeen = p.hp;
      }
    });
  });
  room.state.players.onRemove((_p, _id) => {});

  room.state.enemies.onAdd((e, id) => {
    const m = makeEnemyMesh(e.enemyType);
    m.position.set(e.pos.x, e.pos.y, e.pos.z);
    scene.add(m);
    enemyMeshes.set(id, m);
    e.onChange(() => {
      m.position.set(e.pos.x, e.pos.y, e.pos.z);
      if (!e.alive) { m.visible = false; }
      if (e.hp === 1 && e.maxHp === 2) m.userData.sprite.material.color.setHex(0xff8080);
    });
  });
  room.state.enemies.onRemove((_e, id) => {
    const m = enemyMeshes.get(id); if (m) { scene.remove(m); disposeGroup(m); enemyMeshes.delete(id); }
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
    hubGroup.visible = v === "hub";
    arenaGroup.visible = v !== "hub";
    if (v === "arena" && myPlayer) controller.setPosition(0, 2, 0);
    if (v === "hub" && myPlayer) controller.setPosition(0, 2, WORLD.HUB_RADIUS * 0.3);
  });

  room.onMessage("fx", (msg) => {
    if (msg.type === "shot") spawnShotFx(msg.x, msg.y + 0.6, msg.z, msg.color);
    else if (msg.type === "wave") spawnWaveFx(msg.x, msg.y, msg.z, msg.r);
    else if (msg.type === "hurt" && msg.target === selfId) flashCracks();
    else if (msg.type === "death" && msg.target === selfId) {
      deadHud.classList.add("on");
      deathTimer = 3.0; // auto-respawn timer for singleplayer
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
  flashCracks._t = setTimeout(() => { if (myPlayer && myPlayer.hp >= 2) crackHud.classList.remove("on"); }, 1200);
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
  if (ev.code === "Escape") {
    controller.releasePointer();
  }
  if (ev.code === "KeyR" && myPlayer?.isGhost) {
    // manual respawn
    room.send("respawn", {});
  }
  if (ev.code === "KeyF") {
    let bestId = null, bestD = Infinity;
    pickupMeshes.forEach((m, id) => {
      const pk = room.state.pickups.get(id);
      if (!pk || pk.taken) return;
      const d = m.position.distanceTo(controller.position);
      if (d < 3 && d < bestD) { bestD = d; bestId = id; }
    });
    if (bestId) room.send("pickup", { id: bestId });
  }
  if (ev.code === "KeyE") {
    const cur = room.state.phase;
    room.send("phase", { phase: cur === "hub" ? "arena" : "hub" });
  }
});

function sendInput() {
  if (!room) return;
  const p = controller.position;
  room.send("input", { x: p.x, y: p.y, z: p.z, yaw: controller.yaw, pitch: controller.pitch });
}

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  controller.update(dt, myPlayer);
  pickupMeshes.forEach(m => { if (m.userData.spinner?.userData?.spin) m.userData.spinner.rotation.y += dt * 1.2; });
  for (let i = shots.length - 1; i >= 0; i--) {
    shots[i].ttl -= dt;
    // fade
    if (shots[i].mesh.material) {
      shots[i].mesh.material.opacity = Math.max(0, shots[i].ttl / shots[i].maxTtl);
      shots[i].mesh.material.transparent = true;
    }
    if (shots[i].ttl <= 0) { scene.remove(shots[i].mesh); disposeGroup(shots[i].mesh); shots.splice(i, 1); }
  }
  // auto respawn countdown for solo
  if (deathTimer > 0) {
    deathTimer -= dt;
    if (deathTimer <= 0 && room && myPlayer?.isGhost) {
      room.send("respawn", {});
    }
  }
  leftHandMesh.userData.update?.(dt);
  rightHandMesh.userData.update?.(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

setInterval(() => {
  if (!room) return;
  const ph = room.state.phase;
  const wv = room.state.wave;
  const chg = `${room.state.portalCharge}/${room.state.portalTarget}`;
  const pl = room.state.players.size;
  const dt = deathTimer > 0 ? `  RESPAWN in ${deathTimer.toFixed(1)}s (или R)` : "";
  status.textContent = `фаза:${ph}  волна:${wv}  портал:${chg}  игроки:${pl}${dt}`;
}, 250);
