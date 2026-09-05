// Хаб — маленькая уютная стеклянная комната, парящая в космосе, с постаментами.
// Арена — большая тёмная плита с скалами и туманом.
// Разные локации, разделены телепортом (визуально в двух разных группах).

import * as THREE from "three";
import { WORLD } from "@mhfps/shared";
import { getTexture } from "./assets.js";

// ═══════════════════════════════════════════════════════════════════
// ХАБ: комната в космосе
// ═══════════════════════════════════════════════════════════════════
export function setupHub(group) {
  const R = WORLD.HUB_RADIUS;

  // ── Небо: равномерный тёмный купол + частицы-звёзды вокруг ──────────
  // Никакого UV-шва — купол одноцветный, звёзды — точки.
  const skySphere = new THREE.Mesh(
    new THREE.SphereGeometry(200, 24, 12),
    new THREE.MeshBasicMaterial({ color: 0x0a0820, side: THREE.BackSide, depthWrite: false })
  );
  group.add(skySphere);

  // Звёзды через Points (без шва, дешёво)
  const starCount = 2000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // Равномерно на сфере R=180
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * Math.PI * 2;
    starPos[i * 3    ] = 180 * Math.sin(theta) * Math.cos(phi);
    starPos[i * 3 + 1] = 180 * Math.cos(theta);
    starPos[i * 3 + 2] = 180 * Math.sin(theta) * Math.sin(phi);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false })
  );
  group.add(stars);

  // Несколько ярких звёзд крупнее
  const bigStarGeo = new THREE.BufferGeometry();
  const bigStarPos = new Float32Array(60 * 3);
  for (let i = 0; i < 60; i++) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * Math.PI * 2;
    bigStarPos[i * 3    ] = 175 * Math.sin(theta) * Math.cos(phi);
    bigStarPos[i * 3 + 1] = 175 * Math.cos(theta);
    bigStarPos[i * 3 + 2] = 175 * Math.sin(theta) * Math.sin(phi);
  }
  bigStarGeo.setAttribute("position", new THREE.BufferAttribute(bigStarPos, 3));
  const bigStars = new THREE.Points(
    bigStarGeo,
    new THREE.PointsMaterial({ color: 0xffddaa, size: 3, sizeAttenuation: false })
  );
  group.add(bigStars);

  // ── Пол: каменная плита с текстурой ─────────────────────
  const floorTex = getTexture("hub_floor");
  floorTex.repeat.set(3, 3);
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R * 1.05, 0.3, 12),
    new THREE.MeshStandardMaterial({
      map: floorTex, color: 0x8a7a68, roughness: 0.9, metalness: 0.05,
    })
  );
  floor.position.y = -0.15;
  group.add(floor);

  // Пентаграмма убрана — пол в центре чистый

  // ── ПОРТАЛ НА АРЕНУ (край хаба) ───────────────────────────
  const hubPortal = new THREE.Group();
  hubPortal.userData.isHubPortal = true;
  // Арка
  const hpArch = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.32, 12, 24),
    new THREE.MeshStandardMaterial({
      color: 0x223344, roughness: 0.6, metalness: 0.4,
      emissive: 0x2266ff, emissiveIntensity: 0.5,
    })
  );
  hpArch.position.y = 2.5;
  hpArch.rotation.y = Math.PI / 2;
  hubPortal.add(hpArch);
  hubPortal.userData.arch = hpArch;
  // Колонны по бокам
  for (const dx of [-2.5, 2.5]) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.35, 2.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.5, metalness: 0.5 })
    );
    col.position.set(0, 1.3, dx);
    hubPortal.add(col);
  }
  // Вода в арке (голубая)
  const hpWater = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 24),
    new THREE.MeshBasicMaterial({
      color: 0x66aaff, transparent: true, opacity: 0.65, side: THREE.DoubleSide,
    })
  );
  hpWater.position.y = 2.5;
  hpWater.rotation.y = Math.PI / 2;
  hubPortal.add(hpWater);
  hubPortal.userData.water = hpWater;
  // Круг на полу (триггер-зона)
  const hpBase = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 24),
    new THREE.MeshBasicMaterial({
      color: 0x2266ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  hpBase.rotation.x = -Math.PI / 2;
  hpBase.position.y = 0.02;
  hubPortal.add(hpBase);
  hubPortal.userData.base = hpBase;
  // Позиция у стены, не в центре
  hubPortal.position.set(0, 0, -R * 0.65);
  hubPortal.rotation.y = 0;
  group.add(hubPortal);
  group.userData.hubPortal = hubPortal;

  // Светящаяся метка над порталом
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x66ccff })
  );
  marker.position.copy(hubPortal.position);
  marker.position.y = 4.2;
  marker.userData.isPortalMarker = true;
  group.add(marker);


  // ── Прозрачные стеклянные стены ─────────────────────────
  const wallHeight = 4.5;
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, wallHeight, 12, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0x88bbdd, transparent: true, opacity: 0.15,
      roughness: 0.1, transmission: 0.6, thickness: 0.3,
      side: THREE.DoubleSide,
    })
  );
  wall.position.y = wallHeight / 2;
  group.add(wall);

  // Каркас стен — тонкие металлические рёбра
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x554433, metalness: 0.7, roughness: 0.4
  });
  // Вертикальные рёбра
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rib = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, wallHeight, 6),
      frameMat
    );
    rib.position.set(Math.cos(a) * R, wallHeight / 2, Math.sin(a) * R);
    group.add(rib);
  }
  // Горизонтальные кольца сверху/снизу
  for (const y of [0.1, wallHeight - 0.1]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(R, 0.05, 6, 24),
      frameMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
  }

  // ── Купол (стеклянный потолок) ─────────────────────────
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x88bbdd, transparent: true, opacity: 0.10,
      roughness: 0.05, transmission: 0.7,
      side: THREE.DoubleSide,
    })
  );
  dome.position.y = wallHeight;
  group.add(dome);

  // ── Освещение: ярко и дёшево ────────────────────────────
  // Только Hemisphere + Ambient. Никаких PointLight/DirectionalLight!
  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  group.add(ambient);
  const hemi = new THREE.HemisphereLight(0xaaccff, 0x554433, 1.5);
  hemi.position.set(0, 20, 0);
  group.add(hemi);

  // Факелы по углам
  addTorch(group, R * 0.75, 0, R * 0.75);
  addTorch(group, -R * 0.75, 0, R * 0.75);
  addTorch(group, R * 0.75, 0, -R * 0.75);
  addTorch(group, -R * 0.75, 0, -R * 0.75);

  // ── Парящие острова снаружи для антуража ──────────────
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 30 + Math.random() * 20;
    const size = 3 + Math.random() * 5;
    const island = new THREE.Mesh(
      new THREE.DodecahedronGeometry(size, 0),
      new THREE.MeshStandardMaterial({
        color: 0x332222, roughness: 1, flatShading: true,
      })
    );
    island.position.set(
      Math.cos(a) * dist,
      -5 + Math.random() * 10,
      Math.sin(a) * dist
    );
    island.rotation.y = Math.random() * Math.PI;
    group.add(island);
  }
}

// ═══════════════════════════════════════════════════════════════════
// АРЕНА: тёмная плита с скалами, факелами, туманом
// ═══════════════════════════════════════════════════════════════════
export function setupArena(group) {
  const R = WORLD.ARENA_RADIUS;

  // Тёмный кровавый купол
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R * 4, 24, 12),
    new THREE.MeshBasicMaterial({
      color: 0x1a0505, side: THREE.BackSide,
    })
  );
  group.add(dome);

  // ── Пол — большая тёмная плита ─────────────────────────
  const floorTex = getTexture("arena_floor");
  floorTex.repeat.set(8, 8);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 3, R * 3, 4, 4),
    new THREE.MeshStandardMaterial({
      map: floorTex, color: 0x1a1210,
      roughness: 0.95, metalness: 0.0,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // Плитка (тёмные линии сетки для читаемости)
  const gridGeo = new THREE.BufferGeometry();
  const gridPos = [];
  const step = 4;
  for (let x = -R * 1.5; x <= R * 1.5; x += step) {
    gridPos.push(x, 0.02, -R * 1.5, x, 0.02, R * 1.5);
    gridPos.push(-R * 1.5, 0.02, x, R * 1.5, 0.02, x);
  }
  gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridPos, 3));
  const grid = new THREE.LineSegments(
    gridGeo,
    new THREE.LineBasicMaterial({ color: 0x2a0808, transparent: true, opacity: 0.4 })
  );
  group.add(grid);

  // ── Лужи крови ────────────────────────────────────────
  for (let i = 0; i < 40; i++) {
    const s = 1 + Math.random() * 3;
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(s, 12),
      new THREE.MeshBasicMaterial({
        color: 0x4a0000, transparent: true, opacity: 0.7,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.9;
    pool.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r);
    group.add(pool);
  }

  // ── Острые скалы (укрытия/декор) ─────────────────────
  const rockTex = getTexture("arena_wall");
  const rockMat = new THREE.MeshStandardMaterial({
    map: rockTex, color: 0x2a1a12, roughness: 1, flatShading: true,
  });
  for (let i = 0; i < 20; i++) {
    const s = 0.8 + Math.random() * 2;
    const rock = new THREE.Mesh(
      new THREE.ConeGeometry(s, s * 3, 5 + Math.floor(Math.random() * 3)),
      rockMat
    );
    const a = Math.random() * Math.PI * 2, r = R * (0.4 + Math.random() * 0.55);
    rock.position.set(Math.cos(a) * r, s * 1.3, Math.sin(a) * r);
    rock.rotation.y = Math.random() * Math.PI;
    rock.rotation.z = (Math.random() - 0.5) * 0.2;
    group.add(rock);
  }

  // ── Столбы-факелы по периметру ───────────────────────
  const torchPositions = 8;
  for (let i = 0; i < torchPositions; i++) {
    const a = (i / torchPositions) * Math.PI * 2;
    const r = R * 0.85;
    addTorch(group, Math.cos(a) * r, 0, Math.sin(a) * r, true);
  }

  // ── Освещение арены ──────────────────────────────────
  // ── ПОРТАЛ в центре арены (возврат в хаб) ──────────────
  const portal = new THREE.Group();
  portal.userData.isPortal = true;
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(2.5, 0.35, 10, 20),
    new THREE.MeshStandardMaterial({
      color: 0x666677, roughness: 0.9,
      emissive: 0x442288, emissiveIntensity: 0.2,
    })
  );
  arch.position.y = 2.8;
  portal.add(arch);
  portal.userData.arch = arch;
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 20),
    new THREE.MeshBasicMaterial({
      color: 0x220044, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
    })
  );
  water.position.y = 2.8;
  portal.add(water);
  portal.userData.water = water;
  const base = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 3.3, 20),
    new THREE.MeshBasicMaterial({
      color: 0x442266, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.05;
  portal.add(base);
  portal.userData.base = base;
  portal.position.set(0, 0, 0);
  group.add(portal);
  group.userData.portal = portal;

  // (комментарий про освещение ниже)
  const ambient = new THREE.AmbientLight(0xffffff, 1.1);
  group.add(ambient);

  // Верхний "лунный" свет (холодный, тусклый)
  const moon = new THREE.HemisphereLight(0xffddbb, 0x552222, 1.3);
  moon.position.set(20, 30, 10);
  group.add(moon);
}

// ═══════════════════════════════════════════════════════════════════
// ФАКЕЛ (столб + пламя + свет)
// ═══════════════════════════════════════════════════════════════════
function addTorch(group, x, y, z, tall = false) {
  const h = tall ? 3.0 : 1.5;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.10, h, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.9 })
  );
  pole.position.set(x, y + h / 2, z);
  group.add(pole);

  // Чаша факела
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.12, 0.15, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1008, metalness: 0.6, roughness: 0.5 })
  );
  bowl.position.set(x, y + h + 0.05, z);
  group.add(bowl);

  // Пламя (мерцает)
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.5, 6),
    new THREE.MeshBasicMaterial({ color: 0xff6622, transparent: true, opacity: 0.85 })
  );
  flame.position.set(x, y + h + 0.35, z);
  group.add(flame);

  const flameCore = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.3, 6),
    new THREE.MeshBasicMaterial({ color: 0xffdd44 })
  );
  flameCore.position.set(x, y + h + 0.3, z);
  group.add(flameCore);

  // Свет
  // Без PointLight — только визуальное пламя (бесплатно)
  const light = { position: { set: () => {} }, userData: {} };

  // Флаг для анимации
  flame.userData.isFlame = true;
  flameCore.userData.isFlameCore = true;
  light.userData.isFlameLight = true;
}

// ═══════════════════════════════════════════════════════════════════
// АНИМАЦИЯ ФАКЕЛОВ (мерцание)
// ═══════════════════════════════════════════════════════════════════
// Обновление состояния портала на арене.
// ready=true — ярко светится, можно входить. ready=false — тусклый.
export function updateArenaPortal(arenaGroup, ready, tSec) {
  const p = arenaGroup.userData.portal;
  if (!p) return;
  const water = p.userData.water;
  const arch = p.userData.arch;
  const base = p.userData.base;
  if (ready) {
    // Ярко-фиолетовый пульс
    const pulse = 0.8 + Math.sin(tSec * 4) * 0.2;
    water.material.color.setHex(0x8844ff);
    water.material.opacity = 0.85 * pulse;
    arch.material.emissive.setHex(0xaa66ff);
    arch.material.emissiveIntensity = 1.2 * pulse;
    base.material.color.setHex(0xaa66ff);
    base.material.opacity = 0.7 * pulse;
  } else {
    water.material.color.setHex(0x220044);
    water.material.opacity = 0.5;
    arch.material.emissive.setHex(0x442288);
    arch.material.emissiveIntensity = 0.15;
    base.material.color.setHex(0x442266);
    base.material.opacity = 0.3;
  }
  // Медленно вращается вода
  water.rotation.z = tSec * 0.5;
}

// Позиция портала на арене (для проверки дистанции)
export function getArenaPortalPos(arenaGroup) {
  const p = arenaGroup.userData.portal;
  return p ? p.position : null;
}

// Позиция портала в хабе
export function getHubPortalPos(hubGroup) {
  const p = hubGroup.userData.hubPortal;
  return p ? p.position : null;
}

// Анимация портала в хабе (всегда активен)
export function updateHubPortal(hubGroup, tSec) {
  const p = hubGroup.userData.hubPortal;
  if (!p) return;
  const water = p.userData.water;
  const arch = p.userData.arch;
  const base = p.userData.base;
  const pulse = 0.75 + Math.sin(tSec * 2.2) * 0.15;
  if (water) { water.material.opacity = 0.7 * pulse; water.rotation.z = tSec * 0.4; }
  if (arch) { arch.material.emissiveIntensity = 0.6 * pulse; }
  if (base) { base.material.opacity = 0.4 * pulse; }
}

export function animateTorches(group, dt) {
  const t = performance.now() * 0.005;
  group.traverse(o => {
    if (o.userData?.isFlame || o.userData?.isFlameCore) {
      o.scale.y = 1 + Math.sin(t + o.position.x * 3) * 0.15;
      o.scale.x = 1 + Math.cos(t * 1.3 + o.position.z * 2) * 0.1;
    }
    if (o.userData?.isFlameLight) {
      o.intensity = 1.3 + Math.sin(t + o.position.x) * 0.3;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// ТЕКСТУРЫ (космос, руны)
// ═══════════════════════════════════════════════════════════════════
function makeSpaceTexture() {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = size; c.height = size / 2;
  const ctx = c.getContext("2d");

  // Чёрный фон
  ctx.fillStyle = "#000010";
  ctx.fillRect(0, 0, size, size / 2);

  // Туманности (мягкие цветные пятна)
  const nebulas = [
    { c: "rgba(80,40,120,0.5)", r: 200 },
    { c: "rgba(120,40,80,0.4)", r: 150 },
    { c: "rgba(40,60,120,0.5)", r: 180 },
  ];
  for (const n of nebulas) {
    for (let k = 0; k < 3; k++) {
      const x = Math.random() * size, y = Math.random() * size / 2;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, n.r);
      grd.addColorStop(0, n.c);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(x - n.r, y - n.r, n.r * 2, n.r * 2);
    }
  }

  // Звёзды
  for (let i = 0; i < 2000; i++) {
    const brightness = Math.random();
    ctx.fillStyle = brightness > 0.9
      ? "#ffffff"
      : brightness > 0.7
        ? "rgba(220,220,255," + brightness + ")"
        : "rgba(180,180,220," + brightness + ")";
    const s = brightness > 0.95 ? 2 : 1;
    ctx.fillRect(Math.random() * size, Math.random() * size / 2, s, s);
  }

  // Крупные звёзды с halo
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size, y = Math.random() * size / 2;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, 10);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.3, "rgba(200,220,255,0.6)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(x - 10, y - 10, 20, 20);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function makeRuneTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;

  // Пентаграмма
  ctx.strokeStyle = "#8844ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI * 2) / 5;
    const x = cx + Math.cos(a) * size * 0.4;
    const y = cy + Math.sin(a) * size * 0.4;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Круг
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
  ctx.stroke();

  // Внешний круг
  ctx.strokeStyle = "#5522aa";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.49, 0, Math.PI * 2);
  ctx.stroke();

  // Символы по кругу
  ctx.fillStyle = "#aa66ff";
  ctx.font = "bold 32px serif";
  ctx.textAlign = "center";
  const runes = ["†", "☾", "✦", "⚝", "☥", "✵", "❋", "⚜"];
  for (let i = 0; i < runes.length; i++) {
    const a = -Math.PI / 2 + (i / runes.length) * Math.PI * 2;
    const x = cx + Math.cos(a) * size * 0.47;
    const y = cy + Math.sin(a) * size * 0.47 + 10;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(runes[i], 0, 0);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// ═══════════════════════════════════════════════════════════════════
// УТИЛИТА: очистка группы
// ═══════════════════════════════════════════════════════════════════
export function disposeGroup(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose?.();
    if (o.material) {
      const m = o.material;
      if (Array.isArray(m)) m.forEach(x => x.dispose?.());
      else m.dispose?.();
    }
  });
}
