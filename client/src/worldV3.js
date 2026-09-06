// v0.0.3.0 — новая арена по ТЗ:
// - Terrain 1200м с холмами/дюнами/скалами
// - Чёрный скайбокс (уровень 1)
// - Туман 100м с дизерингом (front-fog)
// - Прозрачный пол хаба (legacy) — не используется
// - Спрайты-Cacodemon fake-3D

import * as THREE from "three";
import { WORLD } from "@mhfps/shared";

// Простая процедурная heightmap: несколько наложенных синусов.
// x,z в мировых координатах, возвращаем высоту y.
export function terrainHeight(x, z) {
  const s1 = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 4;
  const s2 = Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.04 + 0.7) * 2;
  const s3 = Math.sin(x * 0.008) * Math.cos(z * 0.011) * 8; // крупные дюны
  const s4 = Math.sin(x * 0.15 + z * 0.13) * 0.3; // мелкий шум
  return s1 + s2 + s3 + s4;
}

export function setupTerrainV3(group, levelIndex = 1) {
  const R = WORLD.ARENA_RADIUS;

  // ── Скайбокс: уровень 1 — чёрный, 2-5 планетарные темы ─────────────
  const skyColor = levelIndex === 1 ? 0x2a1a28 : // v0.0.3.10: багровый сумрак вместо чёрного
                   levelIndex === 2 ? 0x2a0a1a : // марс
                   levelIndex === 3 ? 0x0a1a2a : // ледяная
                   levelIndex === 4 ? 0x2a2a0a : // пустыня
                                       0x1a002a;  // финал
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R * 3, 24, 12),
    new THREE.MeshBasicMaterial({ color: skyColor, side: THREE.BackSide })
  );
  group.add(dome);

  // ── Освещение: слабое, темно-магическое ─────────────────────────────
  const ambient = new THREE.AmbientLight(0xffdcc0, 1.1); // v0.0.3.10: ярче
  group.add(ambient);
  const hemi = new THREE.HemisphereLight(0xffddbb, 0x402020, 1.4); // v0.0.3.10: ярче
  hemi.position.set(0, 50, 0);
  group.add(hemi);
  // Направленный "лунный" свет с красным оттенком
  const moon = new THREE.DirectionalLight(0xffccaa, 1.0); // v0.0.3.10: ярче
  moon.position.set(50, 80, 30);
  group.add(moon);

  // ── Terrain: PlaneGeometry с деформацией высот ─────────────────────
  // v0.0.3.10: ПЛОСКИЙ пол (была синусоида ±14м, но физика на y=1.6 не совпадала — игроки/враги под полом)
  const geo = new THREE.PlaneGeometry(R * 2, R * 2, 8, 8);
  geo.rotateX(-Math.PI / 2);

  // Уровень 1 — чёрный пол. Дальше можно менять цвет по levelIndex.
  const floorColor = levelIndex === 1 ? 0x4a3a30 : // v0.0.3.10: пепел вместо чёрного (сливался с куполом)
                     levelIndex === 2 ? 0x3a1a10 :
                     levelIndex === 3 ? 0x2a4050 :
                     levelIndex === 4 ? 0x4a3a1a :
                                         0x2a1a3a;
  const terrainMat = new THREE.MeshStandardMaterial({
    color: floorColor,
    roughness: 1.0,
    metalness: 0.0,
    flatShading: true,
  });
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.name = "terrain";
  group.add(terrain);
  group.userData.terrain = terrain;

  // ── Скалы (декор + укрытия) ────────────────────────────────────────
  const rockMat = new THREE.MeshStandardMaterial({
    color: levelIndex === 1 ? 0x1a0a0a : 0x2a1a10,
    roughness: 1.0, flatShading: true,
  });
  for (let i = 0; i < 60; i++) {
    const s = 2 + Math.random() * 6;
    const rock = new THREE.Mesh(
      new THREE.ConeGeometry(s, s * (1.5 + Math.random()), 5 + Math.floor(Math.random() * 3)),
      rockMat
    );
    const a = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * (R * 0.9);
    const rx = Math.cos(a) * r, rz = Math.sin(a) * r;
    rock.position.set(rx, s * 0.6, rz);
    rock.rotation.y = Math.random() * Math.PI;
    rock.rotation.z = (Math.random() - 0.5) * 0.2;
    group.add(rock);
  }

  // ── Дыры в террейне (падаешь → -95% HP) ───────────────────────────
  const holes = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * (R * 0.7);
    const hx = Math.cos(a) * r, hz = Math.sin(a) * r;
    const hr = 3 + Math.random() * 4;
    // Визуал: чёрный круг + красноватая обводка
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(hr, hr + 0.4, 24),
      new THREE.MeshBasicMaterial({ color: 0x330000, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(hx, 0.05, hz);
    group.add(ring);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(hr, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(hx, 0.02, hz);
    group.add(disc);
    holes.push({ x: hx, z: hz, r: hr });
  }
  group.userData.holes = holes;
  // v0.0.3.4: экспортируем в window — controller читает для проверки падения
  if (typeof window !== "undefined") window._arenaHoles = holes;

  // ── Nether-portal (декор — telegraph выхода) ──────────────────────
  const portalGeo = new THREE.PlaneGeometry(6, 10);
  const portalMat = new THREE.MeshBasicMaterial({
    color: 0x8020a0, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
  });
  const portalX = R * 0.4, portalZ = R * 0.3;
  const portal = new THREE.Mesh(portalGeo, portalMat);
  portal.position.set(portalX, 5.5, portalZ);
  group.add(portal);
  group.userData.portalMesh = portal;
  group.userData.portalPos = { x: portalX, z: portalZ };
  // Каменная рамка портала
  for (let side = 0; side < 4; side++) {
    const w = side < 2 ? 6.4 : 0.4;
    const h = side < 2 ? 0.4 : 10;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x1a0510, roughness: 0.9 })
    );
    const ox = side < 2 ? 0 : (side === 2 ? -3.2 : 3.2);
    const oy = side < 2 ? (side === 0 ? -5.2 : 5.2) : 0;
    frame.position.set(portalX + ox, 5.5 + oy, portalZ);
    group.add(frame);
  }

  return group;
}
