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
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x0a0820, side: THREE.BackSide, fog: false })
  );
  skySphere.renderOrder = -100;
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

  // ── Пол: НЕВИДИМЫЙ (мы в космосе) ──────────────────
  // Физика остаётся — игрок не провалится (гравитация останавливается в контроллере на y=1.6).
  // Визуально пола нет — под ногами видны звёзды.
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R * 1.05, 0.3, 48),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  floor.position.y = -0.15;
  floor.userData.isFloor = true; // оставляем для raycast/физики если понадобится
  group.add(floor);

  // АЛТАРЬ-ПЕРЕРАБОТЧИК в центре
  const altar = createHubAltarMesh();
  altar.position.set(0, 0, 0);
  altar.userData.isHubAltar = true;
  group.add(altar);
  group.userData.hubAltar = altar;

  // ── ХАБ — КОСМИЧЕСКАЯ ПЛОЩАДКА (без пола, без стен) ───────
  // (rim/skyDome убраны — мы в космосе, края нет, только звёзды вокруг)


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
  hubPortal.position.set(0, 0, -R * 0.9);
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


  // (стены/купол/освещение перенесены в новый блок с каменными стенами выше)
  // Хабовое освещение
  const hubAmbient = new THREE.AmbientLight(0xffe8c0, 1.0);
  group.add(hubAmbient);
  const hubHemi = new THREE.HemisphereLight(0xffddaa, 0x332222, 1.2);
  hubHemi.position.set(0, 20, 0);
  group.add(hubHemi);

  // v0.0.3.4: КРОВАТЬ СНА — точка перехода на арену (E)
  const bed = new THREE.Group();
  const bedBase = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.4, 1),
    new THREE.MeshStandardMaterial({ color: 0x5a3520, roughness: 0.7 })
  );
  bedBase.position.y = 0.2;
  bed.add(bedBase);
  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.2, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x8a2530, emissive: 0x3a0a10, emissiveIntensity: 0.35 })
  );
  mattress.position.y = 0.5;
  bed.add(mattress);
  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.15, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xe8e0d0 })
  );
  pillow.position.set(-0.55, 0.68, 0);
  bed.add(pillow);
  bed.position.set(0, 0, 8); // в 8м от центра хаба
  bed.userData.isBed = true;
  bed.name = "bed_of_dreams";
  group.add(bed);
  group.userData.bedPos = { x: 0, y: 0, z: 8 };
}

// v0.0.3.4: позиция кровати в хабе
export function getHubBedPos(group) {
  return group.userData.bedPos || { x: 0, y: 0, z: 8 };
}

// ═══════════════════════════════════════════════════════════════════
// АРЕНА: тёмная плита с скалами, факелами, туманом
// ═══════════════════════════════════════════════════════════════════
export function setupArena(group) {
  const R = WORLD.ARENA_RADIUS;

  // Купол-небо: закатное багровое, но не чёрное (арена светлая, зловещая)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R * 4, 24, 12),
    new THREE.MeshBasicMaterial({
      color: 0x3a2028, side: THREE.BackSide,
    })
  );
  group.add(dome);

  // Освещение арены — заметно ярче (было темно)
  const arenaAmbient = new THREE.AmbientLight(0xffe0c0, 1.1);
  group.add(arenaAmbient);
  const arenaHemi = new THREE.HemisphereLight(0xffb080, 0x402020, 1.4);
  arenaHemi.position.set(0, 30, 0);
  group.add(arenaHemi);

  // ── Пол — большая пепельная плита с новой качественной текстурой ─────
  const floorTex = generateArenaGroundTexture();
  floorTex.repeat.set(12, 12);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 3, R * 3, 4, 4),
    new THREE.MeshStandardMaterial({
      map: floorTex, color: 0x6a5040,
      roughness: 0.9, metalness: 0.0,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

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

  // ── КОЛЬЦО КАМЕННЫХ КОЛОНН ─────────────────────────────
  const ringR = R * 0.85;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    // Основание
    const pedBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.5, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.9, flatShading: true })
    );
    pedBase.position.set(Math.cos(a) * ringR, 0.25, Math.sin(a) * ringR);
    group.add(pedBase);
    // Колонна
    const colH = 4 + Math.random() * 2;
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.85, colH, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.85, flatShading: true })
    );
    col.position.set(Math.cos(a) * ringR, 0.5 + colH / 2, Math.sin(a) * ringR);
    col.rotation.y = Math.random() * 0.3;
    group.add(col);
    // Капитель
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.4, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x9a8a78, roughness: 0.8, flatShading: true })
    );
    cap.position.set(Math.cos(a) * ringR, 0.5 + colH + 0.2, Math.sin(a) * ringR);
    group.add(cap);
    // Разрушенная колонна каждая третья — обломок сверху
    if (i % 3 === 0) {
      const rubble = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.2, 0),
        new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.9, flatShading: true })
      );
      rubble.position.set(
        Math.cos(a) * (ringR + 2 + Math.random()),
        0.6,
        Math.sin(a) * (ringR + 2 + Math.random())
      );
      rubble.rotation.set(Math.random(), Math.random(), Math.random());
      group.add(rubble);
    }
  }

  // ── СТАТУИ ПО КРАЯМ (4 демонические фигуры) ─────────────
  const statueR = R * 0.55;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const sg = new THREE.Group();
    // Постамент
    const spd = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.0, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9, flatShading: true })
    );
    spd.position.y = 0.5;
    sg.add(spd);
    // Тело (стилизованная демоническая фигура из блоков)
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 2.2, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.85, flatShading: true })
    );
    torso.position.y = 2.1;
    sg.add(torso);
    // Голова с рогами
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.85, flatShading: true })
    );
    head.position.y = 3.6;
    sg.add(head);
    // Рога
    for (const rx of [-0.35, 0.35]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.8, 6),
        new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.85, flatShading: true })
      );
      horn.position.set(rx, 4.3, 0);
      horn.rotation.z = rx > 0 ? -0.4 : 0.4;
      sg.add(horn);
    }
    // Глаза светятся
    for (const ex of [-0.2, 0.2]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2222 })
      );
      eye.position.set(ex, 3.65, 0.42);
      sg.add(eye);
    }
    // Крылья (плоские)
    for (const wx of [-0.85, 0.85]) {
      const wing = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9, side: THREE.DoubleSide, flatShading: true })
      );
      wing.position.set(wx, 2.4, -0.2);
      wing.rotation.y = wx > 0 ? -0.5 : 0.5;
      sg.add(wing);
    }
    sg.position.set(Math.cos(a) * statueR, 0, Math.sin(a) * statueR);
    sg.rotation.y = a + Math.PI; // лицом к центру
    group.add(sg);
  }

  // ── НАДГРОБИЯ (разбросаны по арене) ─────────────────────
  for (let i = 0; i < 15; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = R * (0.15 + Math.random() * 0.7);
    const grave = new THREE.Group();
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(0.7 + Math.random() * 0.3, 1.2 + Math.random() * 0.5, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x6a6058, roughness: 0.9, flatShading: true })
    );
    stone.position.y = 0.6;
    grave.add(stone);
    // Земляной холмик
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 1, flatShading: true })
    );
    mound.scale.set(1, 0.3, 1.2);
    mound.position.z = 0.4;
    grave.add(mound);
    grave.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    grave.rotation.y = Math.random() * Math.PI * 2;
    group.add(grave);
  }

  // ── КОСТРЫ (3 большие с сильным свечением) ────────────
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const dist = R * 0.6;
    const cx = Math.cos(a) * dist;
    const cz = Math.sin(a) * dist;
    // Круг из камней
    for (let k = 0; k < 8; k++) {
      const ka = (k / 8) * Math.PI * 2;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.35, 0),
        new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.95, flatShading: true })
      );
      rock.position.set(cx + Math.cos(ka) * 0.9, 0.2, cz + Math.sin(ka) * 0.9);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      group.add(rock);
    }
    // Дрова
    for (let k = 0; k < 4; k++) {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.9 })
      );
      log.position.set(cx, 0.35, cz);
      log.rotation.set(Math.PI / 2, (k / 4) * Math.PI, 0);
      group.add(log);
    }
    // Пламя большое
    const bigFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 1.8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6622, transparent: true, opacity: 0.9 })
    );
    bigFlame.position.set(cx, 1.2, cz);
    bigFlame.userData.isFlame = true;
    group.add(bigFlame);
    const bigCore = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 1.2, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdd44 })
    );
    bigCore.position.set(cx, 1.0, cz);
    bigCore.userData.isFlameCore = true;
    group.add(bigCore);
    // Ореол на земле
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(cx, 0.04, cz);
    group.add(glow);
  }

  // ── АЛТАРНЫЕ КАМНИ (у центра) ──────────────────────────
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const r = R * 0.12;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.3, 0),
      new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.95, flatShading: true })
    );
    rock.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(rock);
  }

  // ── СУХИЕ ДЕРЕВЬЯ (силуэты у краёв) ────────────────────
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = R * (0.75 + Math.random() * 0.15);
    const tree = new THREE.Group();
    // Ствол
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, 3 + Math.random(), 6),
      new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 1, flatShading: true })
    );
    trunk.position.y = 1.7;
    tree.add(trunk);
    // 3-4 ветки
    for (let k = 0; k < 4; k++) {
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.15, 1.5 + Math.random(), 5),
        new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 1, flatShading: true })
      );
      branch.position.y = 2.5 + k * 0.3;
      branch.rotation.z = ((k % 2) ? 1 : -1) * (0.6 + Math.random() * 0.4);
      branch.position.x = ((k % 2) ? 0.5 : -0.5);
      tree.add(branch);
    }
    tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    tree.rotation.y = Math.random() * Math.PI * 2;
    group.add(tree);
  }
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
// state: "idle" (спит, матовый камень) | "charging" (активирован, заряжается, луч вверх) | "ready" (готов)
export function updateArenaPortal(arenaGroup, state, tSec, chargeRatio = 0) {
  const p = arenaGroup.userData.portal;
  if (!p) return;
  const water = p.userData.water;
  const arch = p.userData.arch;
  const base = p.userData.base;
  // Лениво создаём луч вверх (RoR2 beam) при первом вызове
  if (!p.userData.beam) {
    const beamGeo = new THREE.CylinderGeometry(0.9, 1.4, 60, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 30;
    p.add(beam);
    p.userData.beam = beam;
  }
  const beam = p.userData.beam;
  if (state === "idle") {
    // Спящий: тёмный камень, ведва заметный, надо найти
    water.material.color.setHex(0x1a1420);
    water.material.opacity = 0.35;
    arch.material.emissive.setHex(0x221122);
    arch.material.emissiveIntensity = 0.05;
    base.material.color.setHex(0x201820);
    base.material.opacity = 0.55;
    beam.material.opacity = 0;
  } else if (state === "charging") {
    // Копит энергию: цвет грется, луч растёт от chargeRatio
    const pulse = 0.7 + Math.sin(tSec * 6) * 0.3;
    const cr = Math.max(0, Math.min(1, chargeRatio));
    water.material.color.setHex(0x664488);
    water.material.opacity = 0.7 * pulse;
    arch.material.emissive.setHex(0x8844ff);
    arch.material.emissiveIntensity = 0.5 + 0.8 * cr;
    base.material.color.setHex(0x8844ff);
    base.material.opacity = 0.5 + 0.4 * cr;
    beam.material.opacity = 0.15 + 0.35 * cr * pulse;
  } else if (state === "ready") {
    // Полный яркий пульс + столб света
    const pulse = 0.85 + Math.sin(tSec * 5) * 0.15;
    water.material.color.setHex(0xaa66ff);
    water.material.opacity = 0.95 * pulse;
    arch.material.emissive.setHex(0xcc88ff);
    arch.material.emissiveIntensity = 1.4 * pulse;
    base.material.color.setHex(0xcc88ff);
    base.material.opacity = 0.85 * pulse;
    beam.material.opacity = 0.55 * pulse;
  }
  water.rotation.z = tSec * 0.5;
  beam.rotation.y = tSec * 0.3;
}

// Переместить меш портала в заданную точку на арене
export function setArenaPortalPosition(arenaGroup, x, z) {
  const p = arenaGroup.userData.portal;
  if (!p) return;
  p.position.x = x;
  p.position.z = z;
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
  const woodTex = generateWoodTexture();
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex, color: 0x6a4a28, roughness: 0.85, metalness: 0.05,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x1e1a16, metalness: 0.85, roughness: 0.35,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4a020, emissive: 0x442200, emissiveIntensity: 0.5,
    metalness: 0.8, roughness: 0.35,
  });

  // ── ТЕЛО (нижний прямоугольный ящик) ─────────────────────
  const W = 1.7, H = 0.8, D = 1.15;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), woodMat);
  body.position.y = H / 2 + 0.08;
  g.add(body);

  // ── ВНУТРЕННОСТЬ (деревянная коробка чуть меньше, текстура видна изнутри) ────
  const insideTex = woodTex.clone();
  insideTex.needsUpdate = true;
  insideTex.wrapS = THREE.RepeatWrapping;
  insideTex.wrapT = THREE.RepeatWrapping;
  insideTex.repeat.set(1.5, 1.5);
  const inside = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.2, H - 0.05, D - 0.15),
    new THREE.MeshStandardMaterial({
      map: insideTex, color: 0x3a2814, roughness: 0.95, metalness: 0.02,
      side: THREE.BackSide,
    })
  );
  inside.position.y = H / 2 + 0.13;
  g.add(inside);

  // Мягкий внутренний свет, чтобы текстура читалась даже когда крышка едва открыта
  const insideLight = new THREE.PointLight(0xffcc88, 0.35, 1.4, 2);
  insideLight.position.set(0, H + 0.05, 0);
  g.add(insideLight);

  // ── КРЫШКА (полуцилиндр — изогнутая) ─────────────────────
  // Pivot на задней грани, чтобы откидывалась
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, H + 0.08, -D / 2);
  // Полуцилиндр: CylinderGeometry с thetaLength=PI, радиус = D/2, высота = W
  const lidGeom = new THREE.CylinderGeometry(D / 2, D / 2, W, 20, 1, false, 0, Math.PI);
  lidGeom.rotateZ(Math.PI / 2); // ось вдоль X
  const lidTop = new THREE.Mesh(lidGeom, woodMat.clone());
  lidTop.material.color = new THREE.Color(0x7a5a35);
  lidTop.position.set(0, 0, D / 2); // сдвиг вперёд от pivot
  lidPivot.add(lidTop);
  // Торцы крышки (полукруги)
  const capGeom = new THREE.CircleGeometry(D / 2, 20, 0, Math.PI);
  capGeom.rotateX(-Math.PI / 2); capGeom.rotateY(Math.PI / 2);
  for (const [xPos, rotY] of [[-W / 2, Math.PI], [W / 2, 0]]) {
    const cap = new THREE.Mesh(capGeom.clone(), woodMat.clone());
    cap.material.color = new THREE.Color(0x7a5a35);
    cap.position.set(xPos, 0, D / 2);
    cap.rotation.y = rotY;
    lidPivot.add(cap);
  }
  // Металлические обвязки-полосы на крышке (3 штуки)
  for (const xPos of [-0.55, 0, 0.55]) {
    const strapGeom = new THREE.TorusGeometry(D / 2 + 0.01, 0.03, 6, 16, Math.PI);
    const strap = new THREE.Mesh(strapGeom, ironMat);
    strap.rotation.y = Math.PI / 2;
    strap.position.set(xPos, 0, D / 2);
    lidPivot.add(strap);
  }
  // Замок с ушком по центру крышки
  const lockPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.12, 0.32),
    ironMat
  );
  lockPlate.position.set(0, D / 2 - 0.06, D - 0.15);
  lidPivot.add(lockPlate);
  const lockGold = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12),
    goldMat
  );
  lockGold.rotation.x = Math.PI / 2;
  lockGold.position.set(0, D / 2 - 0.06, D - 0.02);
  lidPivot.add(lockGold);
  g.add(lidPivot);
  g.userData.lid = lidPivot;
  g.userData.lidOpen = 0;

  // Свечение изнутри при открытии
  const innerGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.25, D - 0.2),
    new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  innerGlow.position.set(0, H + 0.09, 0);
  innerGlow.rotation.x = -Math.PI / 2;
  g.add(innerGlow);
  g.userData.innerGlow = innerGlow;

  // ── ПЕТЛИ (2 штуки — цилиндрики по задней стороне) ───────
  for (const xPos of [-0.55, 0.55]) {
    const hinge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8),
      ironMat
    );
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(xPos, H + 0.08, -D / 2 + 0.02);
    g.add(hinge);
  }

  // ── ОБВЯЗКИ НА ТЕЛЕ (кольцевые полосы) ───────────────────
  for (const xPos of [-0.55, 0.55]) {
    // Горизонтальные полосы по фронту и сторонам
    const wrap = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, H + 0.05, D + 0.02),
      ironMat
    );
    wrap.position.set(xPos, H / 2 + 0.08, 0);
    g.add(wrap);
  }

  // ── УГЛОВЫЕ НАКЛАДКИ ─────────────────────────────────────
  for (const [xs, zs] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const corner = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, H + 0.02, 0.14),
      ironMat
    );
    corner.position.set(xs * (W / 2 - 0.07), H / 2 + 0.08, zs * (D / 2 - 0.07));
    g.add(corner);
  }

  // ── НОЖКИ-КОГТИ (4 штуки) ────────────────────────────────
  for (const [xs, zs] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    // Основание
    const paw = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      ironMat
    );
    paw.position.set(xs * (W / 2 - 0.15), 0.08, zs * (D / 2 - 0.15));
    paw.scale.y = 0.6;
    g.add(paw);
    // 3 когтя
    for (let k = -1; k <= 1; k++) {
      const claw = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.14, 6),
        ironMat
      );
      claw.position.set(xs * (W / 2 - 0.15) + k * 0.06, 0.02, zs * (D / 2 - 0.15) + 0.08 * zs);
      claw.rotation.x = zs > 0 ? -0.4 : 0.4;
      g.add(claw);
    }
  }

  // ── ПОДСВЕТКА НА ПОЛУ ────────────────────────────────────
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.03;
  g.add(glow);
  g.userData.glow = glow;

  // ── СЧЁТЧИК СОДЕРЖИМОГО (спрайт над сундуком) ────────────
  const cvs = document.createElement("canvas");
  cvs.width = 128; cvs.height = 128;
  const ctx = cvs.getContext("2d");
  const tex = new THREE.CanvasTexture(cvs);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(0.8, 0.8, 1);
  spr.position.y = 2.1;
  g.add(spr);
  g.userData.countSprite = spr;
  g.userData.countCtx = ctx;
  g.userData.countTex = tex;
  return g;
}

// Анимация открытия/закрытия сундука
export function setChestOpen(mesh, open, dt) {
  if (!mesh || !mesh.userData.lid) return;
  const target = open ? 1 : 0;
  const cur = mesh.userData.lidOpen;
  const speed = 4;
  const next = cur + (target - cur) * Math.min(1, dt * speed);
  mesh.userData.lidOpen = next;
  // Крышка откидывается назад — угол до -110°
  mesh.userData.lid.rotation.x = -next * (Math.PI * 0.6);
  // Внутреннее свечение
  if (mesh.userData.innerGlow) mesh.userData.innerGlow.material.opacity = next * 0.75;
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


// ═══════════════════════════════════════════════════════════════════
// ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (canvas → THREE.Texture)
// ═══════════════════════════════════════════════════════════════════

let _cachedStoneWall = null;
export function generateStoneWallTexture() {
  if (_cachedStoneWall) return _cachedStoneWall;
  const cvs = document.createElement("canvas");
  cvs.width = 512; cvs.height = 512;
  const c = cvs.getContext("2d");
  // Базовый камень
  c.fillStyle = "#4a3f35";
  c.fillRect(0, 0, 512, 512);
  // Кладка — прямоугольные блоки со смещением по рядам
  const rows = 8, cols = 6;
  const rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (512 / cols / 2);
    const cw = 512 / cols;
    for (let cc = -1; cc <= cols; cc++) {
      const x = cc * cw + off;
      const y = r * rh;
      const shade = 60 + Math.floor(Math.random() * 40);
      c.fillStyle = `rgb(${shade + 30},${shade + 20},${shade + 10})`;
      c.fillRect(x + 2, y + 2, cw - 4, rh - 4);
      // Шум
      for (let k = 0; k < 30; k++) {
        const px = x + 2 + Math.random() * (cw - 4);
        const py = y + 2 + Math.random() * (rh - 4);
        const s2 = 40 + Math.floor(Math.random() * 60);
        c.fillStyle = `rgba(${s2},${s2 * 0.85},${s2 * 0.7},0.4)`;
        c.fillRect(px, py, 2, 2);
      }
      // Трещины
      if (Math.random() < 0.3) {
        c.strokeStyle = "rgba(20,15,10,0.7)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + Math.random() * cw, y + Math.random() * rh);
        c.lineTo(x + Math.random() * cw, y + Math.random() * rh);
        c.stroke();
      }
    }
    // Затирка между рядами
    c.fillStyle = "#20180f";
    c.fillRect(0, r * rh, 512, 2);
  }
  // Мох сверху
  c.fillStyle = "rgba(60,80,40,0.35)";
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 200;
    c.fillRect(x, y, Math.random() * 4, Math.random() * 4);
  }
  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 4;
  _cachedStoneWall = tex;
  return tex;
}

let _cachedWood = null;
export function generateWoodTexture() {
  if (_cachedWood) return _cachedWood;
  const cvs = document.createElement("canvas");
  cvs.width = 256; cvs.height = 256;
  const c = cvs.getContext("2d");
  // Дерево — вертикальные полосы разного оттенка
  for (let x = 0; x < 256; x += 4 + Math.random() * 8) {
    const w = 4 + Math.random() * 12;
    const shade = 50 + Math.floor(Math.random() * 40);
    c.fillStyle = `rgb(${shade + 40},${shade + 20},${shade + 5})`;
    c.fillRect(x, 0, w, 256);
  }
  // Прожилки
  c.strokeStyle = "rgba(30,15,5,0.5)";
  c.lineWidth = 1;
  for (let i = 0; i < 15; i++) {
    c.beginPath();
    let y = Math.random() * 256;
    c.moveTo(0, y);
    for (let x = 0; x < 256; x += 20) {
      y += (Math.random() - 0.5) * 8;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  // Сучки
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    c.fillStyle = "rgba(30,15,5,0.7)";
    c.beginPath();
    c.ellipse(x, y, 6 + Math.random() * 8, 3 + Math.random() * 4, 0, 0, Math.PI * 2);
    c.fill();
  }
  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 4;
  _cachedWood = tex;
  return tex;
}

let _cachedArenaGround = null;
export function generateArenaGroundTexture() {
  if (_cachedArenaGround) return _cachedArenaGround;
  const cvs = document.createElement("canvas");
  cvs.width = 512; cvs.height = 512;
  const c = cvs.getContext("2d");
  // Тёмная земля/пепел с оттенками красного (арена демоническая, но не адски тёмная)
  c.fillStyle = "#3a3028";
  c.fillRect(0, 0, 512, 512);
  // Разноцветный шум земли
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random();
    if (r < 0.5) c.fillStyle = "rgba(70,55,40,0.5)";
    else if (r < 0.8) c.fillStyle = "rgba(100,80,60,0.4)";
    else c.fillStyle = "rgba(120,60,40,0.35)";  // рыжие вкрапления
    c.fillRect(x, y, 2, 2);
  }
  // Трещины земли
  c.strokeStyle = "rgba(20,10,5,0.7)";
  for (let i = 0; i < 40; i++) {
    c.lineWidth = 0.5 + Math.random() * 1.5;
    c.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    c.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  // Камешки
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 4;
    c.fillStyle = `rgba(${140 + Math.random() * 40},${120 + Math.random() * 30},${90 + Math.random() * 20},0.9)`;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    c.fill();
  }
  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  _cachedArenaGround = tex;
  return tex;
}

// Табличка на стене (canvas с текстом + рамка)
export function createWallSign(text, sub) {
  const cvs = document.createElement("canvas");
  cvs.width = 512; cvs.height = 192;
  const c = cvs.getContext("2d");
  // Фон — старая деревянная доска
  const grad = c.createLinearGradient(0, 0, 0, 192);
  grad.addColorStop(0, "#5a3820");
  grad.addColorStop(1, "#3a2010");
  c.fillStyle = grad;
  c.fillRect(0, 0, 512, 192);
  // Прожилки
  c.strokeStyle = "rgba(20,10,5,0.5)";
  c.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    c.beginPath();
    c.moveTo(0, 24 * i);
    for (let x = 0; x < 512; x += 30) c.lineTo(x, 24 * i + (Math.random() - 0.5) * 4);
    c.stroke();
  }
  // Металлические углы
  c.fillStyle = "#443322";
  for (const [x, y] of [[8, 8], [488, 8], [8, 168], [488, 168]]) c.fillRect(x, y, 16, 16);
  // Гвозди
  c.fillStyle = "#dddddd";
  for (const [x, y] of [[16, 16], [496, 16], [16, 176], [496, 176]]) {
    c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
  }
  // Рамка
  c.strokeStyle = "#221510";
  c.lineWidth = 4;
  c.strokeRect(2, 2, 508, 188);
  // Основной текст
  c.fillStyle = "#f0d090";
  c.font = "bold 56px serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.shadowColor = "rgba(0,0,0,0.8)";
  c.shadowBlur = 4;
  c.fillText(text, 256, 70);
  // Подтекст
  c.font = "italic 26px serif";
  c.fillStyle = "#d0b070";
  c.fillText(sub, 256, 130);
  c.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 4;
  const w = 5.5, h = 2.1;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0x442200, emissiveIntensity: 0.25, roughness: 0.7 })
  );
  return mesh;
}

// Настенный факел (плоский держатель + пламя)
export function createWallTorch() {
  const g = new THREE.Group();
  // Держатель
  const holder = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.8, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.8 })
  );
  holder.position.z = 0.15;
  g.add(holder);
  // Чаша
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.15, 0.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.9 })
  );
  bowl.position.set(0, 0.45, 0.3);
  g.add(bowl);
  // Пламя (2 сферы)
  const flame1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.85 })
  );
  flame1.position.set(0, 0.75, 0.3);
  flame1.userData.isFlame = true;
  g.add(flame1);
  const flame2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.95 })
  );
  flame2.position.set(0, 0.85, 0.3);
  flame2.userData.isFlameCore = true;
  g.add(flame2);
  return g;
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
