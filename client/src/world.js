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

  // АЛТАРЬ-ПЕРЕРАБОТЧИК в центре
  const altar = createHubAltarMesh();
  altar.position.set(0, 0, 0);
  altar.userData.isHubAltar = true;
  group.add(altar);
  group.userData.hubAltar = altar;

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
  for (let i = 0; i < 30; i++) {
    const sz = 0.8 + Math.random() * 2;
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(sz, 12),
      new THREE.MeshBasicMaterial({
        color: 0x220505, transparent: true, opacity: 0.55,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.9;
    pool.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r);
    group.add(pool);
  }

  // Опасные зоны: красные круги с кольями (декор, безопасно наступать, но выглядит как капкан)
  const dangerZones = [];
  const zoneCount = 4;
  for (let i = 0; i < zoneCount; i++) {
    const a = (i / zoneCount) * Math.PI * 2 + Math.random() * 0.4;
    const dr = R * (0.35 + Math.random() * 0.25);
    const dx = Math.cos(a) * dr, dz = Math.sin(a) * dr;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.2, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff2222, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(dx, 0.05, dz);
    group.add(ring);
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 20),
      new THREE.MeshBasicMaterial({
        color: 0xaa0000, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(dx, 0.04, dz);
    group.add(fill);
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.6, 4),
        new THREE.MeshStandardMaterial({ color: 0x552211, roughness: 0.7, emissive: 0x330000, emissiveIntensity: 0.5, flatShading: true })
      );
      spike.position.set(dx + Math.cos(ang) * 1.55, 0.3, dz + Math.sin(ang) * 1.55);
      spike.rotation.z = (Math.random() - 0.5) * 0.3;
      group.add(spike);
    }
    dangerZones.push({ x: dx, z: dz, ring, fill, radius: 2.0 });
  }
  group.userData.dangerZones = dangerZones;

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
  // Портал — у края арены, не в центре (чтобы не был среди врагов)
  portal.position.set(0, 0, R * 0.75);
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

// Пульсация опасных зон
export function animateDangerZones(arenaGroup, tSec) {
  const zones = arenaGroup.userData.dangerZones;
  if (!zones) return;
  const p = 0.5 + Math.sin(tSec * 3) * 0.4;
  for (const z of zones) {
    if (z.ring) z.ring.material.opacity = 0.4 + p * 0.5;
    if (z.fill) z.fill.material.opacity = 0.2 + p * 0.3;
  }
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
// ═══════════════════════════════════════════════════════════════════
// ХАБОВОЕ ХРАНИЛИЩЕ: слоты, сундуки, алтарь-переработчик
// ═══════════════════════════════════════════════════════════════════

// Постамент-слот (пустой vs с содержимым)
export function createHubSlotMesh() {
  const g = new THREE.Group();
  // База (тёмный камень)
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.65, 0.9, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.85, flatShading: true })
  );
  base.position.y = 0.45;
  g.add(base);
  // Верхняя плита
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.55, 0.12, 12),
    new THREE.MeshStandardMaterial({ color: 0x3a3540, roughness: 0.7, flatShading: true })
  );
  top.position.y = 0.96;
  g.add(top);
  // Подсветка "пусто" — тусклое кольцо снизу
  const emptyRing = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 0.85, 16),
    new THREE.MeshBasicMaterial({ color: 0x3355aa, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  emptyRing.rotation.x = -Math.PI / 2;
  emptyRing.position.y = 0.02;
  g.add(emptyRing);
  // Слот для контента (создаётся/удаляется по мере надобности)
  g.userData.contentMount = new THREE.Group();
  g.userData.contentMount.position.y = 1.15;
  g.add(g.userData.contentMount);
  g.userData.emptyRing = emptyRing;
  return g;
}

// Создать 3D-визуал контента слота
export function makeSlotContent(kind, handType) {
  const g = new THREE.Group();
  if (kind === "HAND") {
    const color = handType === "FIRE" ? 0xff4400
                : handType === "ICE" ? 0x66ccff
                : handType === "BONE" ? 0xddccaa
                : 0xaaaaaa;
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, flatShading: true })
    );
    orb.position.y = 0.3;
    g.add(orb);
    // Ореол
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 10, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false })
    );
    halo.position.y = 0.3;
    g.add(halo);
    g.userData.rotate = orb;
  } else if (kind === "LEG") {
    // Сапог: параллелепипед
    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.3, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.7, flatShading: true })
    );
    boot.position.y = 0.2;
    g.add(boot);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.15, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x554422, roughness: 0.7, flatShading: true })
    );
    shaft.position.set(0, 0.5, -0.15);
    g.add(shaft);
    g.userData.rotate = g;
  } else if (kind === "ITEM") {
    // Кольцо/талисман
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.06, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xffcc44, emissive: 0x774400, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.7 })
    );
    ring.position.y = 0.28;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    g.userData.rotate = ring;
  }
  return g;
}

export function createHubChestMesh() {
  const g = new THREE.Group();
  // Тело
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.9, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x4a2f18, roughness: 0.85, flatShading: true })
  );
  body.position.y = 0.45;
  g.add(body);
  // Крышка
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.25, 0.95),
    new THREE.MeshStandardMaterial({ color: 0x5a3820, roughness: 0.7, flatShading: true })
  );
  lid.position.y = 1.02;
  g.add(lid);
  // Замок
  const lock = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.25, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xd4a020, emissive: 0x442200, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 })
  );
  lock.position.set(0, 0.85, 0.5);
  g.add(lock);
  // Металлические полосы
  for (const zx of [-0.4, 0.4]) {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.0, 0.96),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.5 })
    );
    strap.position.set(zx, 0.5, 0);
    g.add(strap);
  }
  // Подсветка при непустом
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.1, 20),
    new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;
  g.add(glow);
  g.userData.glow = glow;
  // Счётчик содержимого (text-sprite)
  const cvs = document.createElement("canvas");
  cvs.width = 128; cvs.height = 128;
  const ctx = cvs.getContext("2d");
  const tex = new THREE.CanvasTexture(cvs);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(0.7, 0.7, 1);
  spr.position.y = 1.6;
  g.add(spr);
  g.userData.countSprite = spr;
  g.userData.countCtx = ctx;
  g.userData.countTex = tex;
  return g;
}

// Обновить счётчик содержимого сундука
export function updateChestCount(mesh, n) {
  const ctx = mesh.userData.countCtx;
  const tex = mesh.userData.countTex;
  if (!ctx) return;
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.beginPath(); ctx.arc(64, 64, 44, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = n > 0 ? "#ffcc44" : "#888";
  ctx.font = "bold 60px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(n), 64, 68);
  tex.needsUpdate = true;
  if (mesh.userData.glow) mesh.userData.glow.material.opacity = n > 0 ? 0.5 : 0.05;
}

// Алтарь-переработчик (в центре хаба, ярко-фиолетовый)
export function createHubAltarMesh() {
  const g = new THREE.Group();
  // Основа-платформа
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.8, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 0.8, flatShading: true })
  );
  base.position.y = 0.2;
  g.add(base);
  // Средняя часть
  const mid = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.4, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2050, roughness: 0.7, flatShading: true })
  );
  mid.position.y = 0.65;
  g.add(mid);
  // Верхняя чаша
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 0.9, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: 0x5a3080, roughness: 0.6, emissive: 0x2a0050, emissiveIntensity: 0.4, flatShading: true })
  );
  bowl.position.y = 1.05;
  g.add(bowl);
  // Три подсветки — точки, куда «кладут» руки
  const slotPositions = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * 0.55;
    const z = Math.sin(a) * 0.55;
    const slot = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 16),
      new THREE.MeshBasicMaterial({ color: 0xaa55ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    slot.rotation.x = -Math.PI / 2;
    slot.position.set(x, 1.24, z);
    g.add(slot);
    slotPositions.push({ x, z, y: 1.24, mesh: slot, content: null });
  }
  g.userData.reforgeSlots = slotPositions;
  // Луч в небо (визуально ярко)
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.35, 6, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xcc88ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 4.2;
  g.add(beam);
  g.userData.beam = beam;
  return g;
}

export function updateHubAltar(altar, slotContents, tSec) {
  if (!altar || !altar.userData.reforgeSlots) return;
  const slots = altar.userData.reforgeSlots;
  const pulse = 0.5 + Math.sin(tSec * 2) * 0.3;
  for (let i = 0; i < slots.length; i++) {
    const raw = slotContents[i];
    const desiredKind = raw ? String(raw).split(":")[0] : null;
    const desiredHt = raw ? String(raw).split(":")[1] : null;
    // Если уже есть визуал того же типа — оставить, иначе пересоздать
    const cur = slots[i].content;
    const key = desiredKind ? `${desiredKind}:${desiredHt||''}` : null;
    if (cur && cur.userData.key !== key) { altar.remove(cur); slots[i].content = null; }
    if (!cur || cur.userData.key !== key) {
      if (desiredKind) {
        const mesh = makeSlotContent(desiredKind, desiredHt);
        mesh.userData.key = key;
        mesh.position.set(slots[i].x, slots[i].y, slots[i].z);
        mesh.scale.set(0.65, 0.65, 0.65);
        altar.add(mesh);
        slots[i].content = mesh;
      }
    }
    if (slots[i].content && slots[i].content.userData.rotate) {
      slots[i].content.userData.rotate.rotation.y += 0.02;
      slots[i].content.position.y = slots[i].y + Math.sin(tSec * 3 + i) * 0.05;
    }
    slots[i].mesh.material.opacity = 0.4 + pulse * 0.35;
  }
  // Луч ярче когда все 3 слота заняты
  if (altar.userData.beam) {
    const filled = slotContents.filter(x => x).length;
    altar.userData.beam.material.opacity = 0.12 + (filled / 3) * 0.4;
  }
}

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
