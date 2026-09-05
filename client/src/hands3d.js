// Объёмные руки первого лица с текстурой кожи, пальцами, магией в ладонях.
// Меняются через assets.js (hand_skin, hand_armor).
//
// Каждая рука — Group с пальцами, доступна через u.leftHand/u.rightHand.
// Анимация: idle-покачивание, отдача при касте.

import * as THREE from "three";
import { getTexture } from "./assets.js";

const SPELL_COLOR = {
  fireball: 0xff4400,
  ice:      0x66ccff,
  chain:    0xffdd44,
};

export function createHandsGroup() {
  const skinTex = getTexture("hand_skin");
  const armorTex = getTexture("hand_armor");
  const skinMat = new THREE.MeshStandardMaterial({
    map: skinTex, color: 0xd0a080, roughness: 0.7, metalness: 0.0,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    map: armorTex, color: 0x4a3020, roughness: 0.5, metalness: 0.6,
  });

  const root = new THREE.Group();
  const leftHand = createOneHand(skinMat, armorMat, -1);
  const rightHand = createOneHand(skinMat, armorMat, 1);
  root.add(leftHand);
  root.add(rightHand);

  root.userData.leftHand = leftHand;
  root.userData.rightHand = rightHand;
  root.userData.spellOrbs = { left: null, right: null };

  return root;
}

function createOneHand(skinMat, armorMat, side) {
  const hand = new THREE.Group();
  const s = side; // -1 = left, +1 = right

  // Позиция кисти относительно камеры
  hand.position.set(s * 0.35, -0.35, -0.55);
  hand.rotation.x = -0.3;
  hand.rotation.z = s * -0.15;

  // ── Запястье (наруч) ────────────────────────────────────────
  const wrist = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 0.15, 10),
    armorMat
  );
  wrist.position.set(0, -0.05, 0);
  wrist.rotation.x = Math.PI / 2;
  hand.add(wrist);

  // Заклёпки на наруче
  for (let i = 0; i < 4; i++) {
    const rivet = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.3 })
    );
    const a = (i / 4) * Math.PI * 2;
    rivet.position.set(Math.cos(a) * 0.062, -0.05 - 0.03, Math.sin(a) * 0.062);
    hand.add(rivet);
  }

  // ── Ладонь ──────────────────────────────────────────────────
  const palm = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.03, 0.13),
    skinMat
  );
  palm.position.set(0, 0.02, 0.05);
  hand.add(palm);

  // ── Пальцы (4 + большой) ───────────────────────────────────
  const fingerMat = skinMat;

  // 4 основных пальца
  const fingerLen = [0.075, 0.085, 0.080, 0.065]; // указательный, средний, безымянный, мизинец
  for (let i = 0; i < 4; i++) {
    const fingerGroup = new THREE.Group();
    fingerGroup.position.set(-0.03 + i * 0.02, 0.02, 0.12);

    // Первый сустав
    const seg1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.010, 0.012, fingerLen[i]*0.5, 6),
      fingerMat
    );
    seg1.position.set(0, 0, fingerLen[i]*0.25);
    seg1.rotation.x = Math.PI / 2;
    fingerGroup.add(seg1);

    // Второй сустав + ноготь
    const seg2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.010, fingerLen[i]*0.5, 6),
      fingerMat
    );
    seg2.position.set(0, 0, fingerLen[i]*0.75);
    seg2.rotation.x = Math.PI / 2;
    fingerGroup.add(seg2);

    // Ноготь
    const nail = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.003, 0.01),
      new THREE.MeshStandardMaterial({ color: 0xe0d0b0, roughness: 0.4 })
    );
    nail.position.set(0, 0.008, fingerLen[i] - 0.005);
    fingerGroup.add(nail);

    hand.add(fingerGroup);
  }

  // Большой палец (сбоку)
  const thumbGroup = new THREE.Group();
  thumbGroup.position.set(-s * 0.045, 0.02, 0.06);
  thumbGroup.rotation.z = -s * 0.7;
  thumbGroup.rotation.y = s * 0.3;

  const thumb1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.015, 0.04, 6),
    fingerMat
  );
  thumb1.position.set(0, 0, 0.02);
  thumb1.rotation.x = Math.PI / 2;
  thumbGroup.add(thumb1);

  const thumb2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.010, 0.013, 0.035, 6),
    fingerMat
  );
  thumb2.position.set(0, 0, 0.055);
  thumb2.rotation.x = Math.PI / 2;
  thumbGroup.add(thumb2);

  hand.add(thumbGroup);

  hand.userData.side = s;
  return hand;
}

// ── Показать/скрыть заклинание в ладони ───────────────────────────
// Трещины на руках (вместо красного экрана)
export function showHandDamage(handsGroup, ttl = 1.2) {
  for (const key of ["left", "right"]) {
    const hand = handsGroup.userData[key + "Hand"];
    if (!hand) continue;
    let crack = hand.userData.crack;
    if (!crack) {
      const cnv = document.createElement("canvas");
      cnv.width = cnv.height = 128;
      const ctx = cnv.getContext("2d");
      ctx.clearRect(0, 0, 128, 128);
      ctx.strokeStyle = "rgba(200,30,30,0.95)";
      ctx.shadowColor = "rgba(255,60,60,0.8)";
      ctx.shadowBlur = 3;
      ctx.lineWidth = 2;
      for (let n = 0; n < 5; n++) {
        let x = 40 + Math.random() * 50, y = 20 + Math.random() * 80;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 4; s++) {
          x += (Math.random() - 0.5) * 30;
          y += (Math.random() - 0.5) * 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(cnv);
      tex.needsUpdate = true;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false });
      crack = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), mat);
      crack.position.set(0, 0.045, 0.09);
      crack.rotation.x = -Math.PI / 2 + 0.3;
      hand.add(crack);
      hand.userData.crack = crack;
    }
    crack.material.opacity = 0.95;
    crack.userData.ttl = ttl;
  }
}

export function fadeHandCracks(handsGroup, dt) {
  for (const key of ["left", "right"]) {
    const hand = handsGroup.userData[key + "Hand"];
    const crack = hand?.userData?.crack;
    if (!crack) continue;
    crack.userData.ttl = (crack.userData.ttl || 0) - dt;
    if (crack.userData.ttl <= 0) crack.material.opacity = 0;
    else crack.material.opacity = Math.min(0.95, crack.userData.ttl);
  }
}

export function setSpellInHand(handsGroup, side, spellType) {
  const key = side === -1 ? "left" : "right";
  const hand = side === -1 ? handsGroup.userData.leftHand : handsGroup.userData.rightHand;

  // Убрать старый орб
  const oldOrb = handsGroup.userData.spellOrbs[key];
  if (oldOrb) {
    hand.remove(oldOrb);
    oldOrb.traverse(o => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) o.material.dispose?.();
    });
  }

  if (!spellType) {
    handsGroup.userData.spellOrbs[key] = null;
    return;
  }

  // Создать новый орб магии над ладонью
  const color = SPELL_COLOR[spellType] || 0xff4400;
  const orb = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 12, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  orb.add(core);

  // Внешнее сияние (полупрозрачная сфера)
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 12, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.BackSide })
  );
  orb.add(glow);

  // Свет от орба
  const light = new THREE.PointLight(color, 0.6, 1.5, 2);
  orb.add(light);

  orb.position.set(0, 0.06, 0.14);
  hand.add(orb);

  handsGroup.userData.spellOrbs[key] = orb;
  orb.userData.core = core;
  orb.userData.glow = glow;
  orb.userData.light = light;
}

// ── Анимация рук: idle-покачивание, "отдача" при касте ────────────
export function animateHands(handsGroup, dt, opts = {}) {
  const t = performance.now() * 0.001;
  const { moving = false, casting = null } = opts;

  const left = handsGroup.userData.leftHand;
  const right = handsGroup.userData.rightHand;

  // Idle: медленное дыхание
  const breathe = Math.sin(t * 1.5) * 0.008;
  const walkBob = moving ? Math.sin(t * 8) * 0.015 : 0;

  left.position.y = -0.35 + breathe + walkBob;
  right.position.y = -0.35 + breathe - walkBob;

  // Отдача при касте
  if (casting === "left" || casting === "both") {
    left.userData.recoil = 1.0;
  }
  if (casting === "right" || casting === "both") {
    right.userData.recoil = 1.0;
  }
  for (const h of [left, right]) {
    const r = h.userData.recoil || 0;
    if (r > 0) {
      h.position.z = -0.55 + r * 0.15;
      h.rotation.x = -0.3 - r * 0.4;
      h.userData.recoil = Math.max(0, r - dt * 5);
    } else {
      h.position.z = -0.55;
      h.rotation.x = -0.3;
    }
  }

  // Пульсация орбов
  const pulse = 1 + Math.sin(t * 6) * 0.1;
  for (const key of ["left", "right"]) {
    const orb = handsGroup.userData.spellOrbs[key];
    if (orb) {
      orb.userData.core.scale.setScalar(pulse);
      orb.userData.glow.scale.setScalar(pulse * 1.2);
      orb.rotation.y = t * 2;
    }
  }
}
