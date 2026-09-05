// Каменный пьедестал — 3 разительно разных варианта:
// - HAND: высокая античная колонна с кристаллом (заклинание для руки)
// - LEG: низкая округлая тумба с зелёным сиянием (нога / скорость)
// - ACCESSORY: тёмный треугольный обелиск с золотыми рунами (пассивный аксессуар)

import * as THREE from "three";
import { getTexture } from "./assets.js";

const SPELL_COLORS = {
  fireball: 0xff4400,
  ice:      0x66ccff,
  chain:    0xffdd44,
  bone:     0xffe0a0,
  push:     0xa080ff,
};

// Универсальная точка входа: kind = "HAND" | "LEG" | "ACCESSORY"
export function createPedestalMesh(kindOrSpell = "HAND", spellType = "fireball") {
  const kind = kindOrSpell === "HAND" || kindOrSpell === "LEG" || kindOrSpell === "ACCESSORY"
    ? kindOrSpell : "HAND";
  // Обратная совместимость: если пришло старое spellType — считаем HAND
  const spell = kind === "HAND" ? (kindOrSpell !== kind ? kindOrSpell : spellType) : spellType;
  if (kind === "LEG") return createLegPedestal();
  if (kind === "ACCESSORY") return createAccessoryPedestal();
  return createHandPedestal(spell);
}

// ── HAND: античная высокая колонна с кристаллом ───────────────────────
function createHandPedestal(spellType) {
  const group = new THREE.Group();
  const tex = getTexture("hub_pillar");
  const stoneMat = new THREE.MeshStandardMaterial({
    map: tex, color: 0xd0c8b8, roughness: 0.85, metalness: 0.05,
  });

  // Ступенчатое основание
  const base1 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 1.0), stoneMat);
  base1.position.y = 0.075; group.add(base1);
  const base2 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.10, 0.85), stoneMat);
  base2.position.y = 0.20; group.add(base2);

  // Колонна
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.4, 0.65), stoneMat);
  shaft.position.y = 0.95; group.add(shaft);

  // Резные вставки
  const carvingTex = makeCarvingTexture();
  const carvingMat = new THREE.MeshStandardMaterial({
    map: carvingTex, color: 0xe0d8c8, roughness: 0.7, transparent: true,
  });
  for (let i = 0; i < 4; i++) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.2), carvingMat);
    const a = i * Math.PI / 2;
    panel.position.set(Math.sin(a) * 0.331, 0.95, Math.cos(a) * 0.331);
    panel.rotation.y = a;
    group.add(panel);
  }

  // Капитель
  const cap1 = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.10, 0.80), stoneMat);
  cap1.position.y = 1.70; group.add(cap1);
  const cap2 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.95), stoneMat);
  cap2.position.y = 1.81; group.add(cap2);

  // Кристалл
  const crystalColor = SPELL_COLORS[spellType] || 0xff4400;
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    new THREE.MeshStandardMaterial({
      color: crystalColor, emissive: crystalColor,
      emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.5,
    })
  );
  crystal.position.y = 2.10;
  crystal.userData.isCrystal = true;
  group.add(crystal);

  group.userData.crystal = crystal;
  group.userData.spellType = spellType;
  group.userData.kind = "HAND";
  return group;
}

// ── LEG: низкая округлая тумба с зелёным сиянием ──────────────────────
function createLegPedestal() {
  const group = new THREE.Group();
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x3a5c2a, roughness: 0.95, metalness: 0.0,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x555555, roughness: 0.9, metalness: 0.1,
  });

  // Широкое каменное основание
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.0, 0.25, 16),
    stoneMat
  );
  base.position.y = 0.125; group.add(base);

  // Плоская тумба (низкая)
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 0.15, 16),
    stoneMat
  );
  top.position.y = 0.325; group.add(top);

  // Мох по краям
  const moss = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.08, 6, 16),
    mossMat
  );
  moss.rotation.x = Math.PI / 2;
  moss.position.y = 0.40; group.add(moss);

  // Зелёный светящийся диск сверху
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshBasicMaterial({
      color: 0x44ff66, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.405; group.add(glow);
  group.userData.glow = glow;

  // Символ ступни-круг сверху
  const foot = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 20),
    new THREE.MeshBasicMaterial({
      color: 0x88ffaa, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    })
  );
  foot.rotation.x = -Math.PI / 2;
  foot.position.y = 0.41; group.add(foot);

  group.userData.kind = "LEG";
  return group;
}

// ── ACCESSORY: тёмный треугольный обелиск ─────────────────────────────
function createAccessoryPedestal() {
  const group = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a22, roughness: 0.4, metalness: 0.6,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffcc44, roughness: 0.3, metalness: 0.9,
    emissive: 0xaa7722, emissiveIntensity: 0.3,
  });

  // Треугольное основание (3-угольная призма)
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.85, 0.3, 3),
    darkMat
  );
  base.position.y = 0.15;
  base.rotation.y = Math.PI / 6;
  group.add(base);

  // Обелиск: заужающаяся 3-гранная призма высотой 2м
  const obelisk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.55, 2.0, 3),
    darkMat
  );
  obelisk.position.y = 1.3;
  obelisk.rotation.y = Math.PI / 6;
  group.add(obelisk);

  // Золотые кольца на разной высоте
  for (const y of [0.7, 1.3, 1.9]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.35 - (y - 0.7) * 0.1, 0.025, 6, 12),
      goldMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
  }

  // Золотой шар на вершине
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 8),
    goldMat
  );
  orb.position.y = 2.45;
  orb.userData.isCrystal = true;
  group.add(orb);
  group.userData.crystal = orb;

  group.userData.kind = "ACCESSORY";
  return group;
}

// Анимация — работает для всех типов
export function animatePedestal(mesh, dt) {
  const c = mesh.userData.crystal;
  if (c) {
    c.rotation.y += dt * 1.5;
    c.rotation.x += dt * 0.7;
    const baseY = mesh.userData.kind === "ACCESSORY" ? 2.45 : 2.10;
    c.position.y = baseY + Math.sin(performance.now() * 0.002) * 0.05;
  }
  const glow = mesh.userData.glow;
  if (glow) {
    glow.material.opacity = 0.55 + Math.sin(performance.now() * 0.003) * 0.2;
  }
}

// Процедурная резьба (та же что была)
function makeCarvingTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size; c.height = size * 2;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size * 2);
  ctx.strokeStyle = "rgba(40, 30, 20, 0.8)";
  ctx.fillStyle = "rgba(40, 30, 20, 0.5)";
  ctx.lineWidth = 2;
  const cx = size / 2, cy = size;
  ctx.beginPath(); ctx.moveTo(cx, cy - 100); ctx.lineTo(cx, cy + 100); ctx.stroke();
  for (let side of [-1, 1]) {
    for (let y = -80; y <= 80; y += 40) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + y);
      ctx.quadraticCurveTo(cx + side * 30, cy + y - 10, cx + side * 25, cy + y - 25);
      ctx.quadraticCurveTo(cx + side * 15, cy + y - 30, cx + side * 20, cy + y - 15);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx + side * 22, cy + y - 22, 6, 3, side > 0 ? 0.5 : -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let y = -60; y <= 60; y += 60) {
    ctx.beginPath(); ctx.arc(cx, cy + y, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + y, 3, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
