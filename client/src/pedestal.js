// Каменный пьедестал в античном стиле (по рефам image-2/image-3):
// ступенчатое основание → колонна с резными панелями → капитель → кристалл.
// Всё процедурное, без внешних мешей. Меняется в assets.js (текстуры).

import * as THREE from "three";
import { getTexture } from "./assets.js";

const SPELL_COLORS = {
  fireball: 0xff4400,
  ice:      0x66ccff,
  chain:    0xffdd44,
};

export function createPedestalMesh(spellType = "fireball") {
  const group = new THREE.Group();
  const tex = getTexture("hub_pillar");
  const stoneMat = new THREE.MeshStandardMaterial({
    map: tex, color: 0xd0c8b8, roughness: 0.85, metalness: 0.05,
  });

  // ── Основание: широкая ступень + узкая ступень ─────────────
  const base1 = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.15, 1.0),
    stoneMat
  );
  base1.position.y = 0.075;
  group.add(base1);

  const base2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.10, 0.85),
    stoneMat
  );
  base2.position.y = 0.20;
  group.add(base2);

  // ── Колонна: высокая, с резными панелями (плоские вставки) ──
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 1.4, 0.65),
    stoneMat
  );
  shaft.position.y = 0.95;
  group.add(shaft);

  // Декоративные вертикальные вставки (резьба) — с 4 сторон
  const carvingTex = makeCarvingTexture();
  const carvingMat = new THREE.MeshStandardMaterial({
    map: carvingTex, color: 0xe0d8c8, roughness: 0.7, transparent: true,
  });
  for (let i = 0; i < 4; i++) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 1.2),
      carvingMat
    );
    const a = i * Math.PI / 2;
    panel.position.set(Math.sin(a) * 0.331, 0.95, Math.cos(a) * 0.331);
    panel.rotation.y = a;
    group.add(panel);
  }

  // ── Капитель (ступенчатый верх) ────────────────────────────
  const cap1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.80, 0.10, 0.80),
    stoneMat
  );
  cap1.position.y = 1.70;
  group.add(cap1);

  const cap2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.12, 0.95),
    stoneMat
  );
  cap2.position.y = 1.81;
  group.add(cap2);

  // ── Кристалл на вершине ────────────────────────────────────
  const crystalColor = SPELL_COLORS[spellType] || 0xff4400;
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    new THREE.MeshStandardMaterial({
      color: crystalColor,
      emissive: crystalColor,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.5,
    })
  );
  crystal.position.y = 2.10;
  crystal.userData.isCrystal = true;
  group.add(crystal);

  // ── Точечный свет от кристалла ────────────────────────────
  const light = new THREE.PointLight(crystalColor, 1.2, 4.0, 2);
  light.position.y = 2.10;
  group.add(light);

  // Сохраним ссылки для анимации
  group.userData.crystal = crystal;
  group.userData.light = light;
  group.userData.spellType = spellType;

  return group;
}

// Анимация — вращение кристалла + пульсация света
export function animatePedestal(mesh, dt) {
  const c = mesh.userData.crystal;
  const l = mesh.userData.light;
  if (c) {
    c.rotation.y += dt * 1.5;
    c.rotation.x += dt * 0.7;
    c.position.y = 2.10 + Math.sin(performance.now() * 0.002) * 0.05;
  }
  if (l) {
    l.intensity = 1.0 + Math.sin(performance.now() * 0.003) * 0.3;
  }
}

// Процедурная текстура резьбы (растительный орнамент как на рефе)
function makeCarvingTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size; c.height = size * 2;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size * 2);

  // Прозрачный фон, только тёмные "выгравированные" линии
  ctx.strokeStyle = "rgba(40, 30, 20, 0.8)";
  ctx.fillStyle = "rgba(40, 30, 20, 0.5)";
  ctx.lineWidth = 2;

  const cx = size / 2, cy = size;

  // Центральная вертикальная линия
  ctx.beginPath();
  ctx.moveTo(cx, cy - 100);
  ctx.lineTo(cx, cy + 100);
  ctx.stroke();

  // Растительные завитки
  for (let side of [-1, 1]) {
    for (let y = -80; y <= 80; y += 40) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + y);
      ctx.quadraticCurveTo(cx + side * 30, cy + y - 10, cx + side * 25, cy + y - 25);
      ctx.quadraticCurveTo(cx + side * 15, cy + y - 30, cx + side * 20, cy + y - 15);
      ctx.stroke();
      // Листок
      ctx.beginPath();
      ctx.ellipse(cx + side * 22, cy + y - 22, 6, 3, side > 0 ? 0.5 : -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Розетки
  for (let y = -60; y <= 60; y += 60) {
    ctx.beginPath();
    ctx.arc(cx, cy + y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
