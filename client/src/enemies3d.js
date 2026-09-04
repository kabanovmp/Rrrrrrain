// Объёмные 3D-модели врагов в стиле DOOM/Diablo.
// Каждый враг — процедурный меш из примитивов с "мясной" текстурой,
// парой ног, головой, глазами, повадками (анимация ног/головы/тела).
//
// НЕ спрайты. Стоят на земле (Y=0). Пешеходные — качают ногами при ходьбе.
// Летающие (CACO) — плавают с покачиванием.
//
// Замена текстур: assets.js → enemy_* keys.

import * as THREE from "three";
import { getTexture } from "./assets.js";

// ── Параметры по типам ─────────────────────────────────────────────
// Яркие контрастные цвета, чтобы враг был виден даже при слабом свете.
// emissive — самосвечение, не требует света вообще.
const ENEMY_SPECS = {
  IMP: {
    height: 1.6, bodyColor: 0xff5522, emissive: 0x552200, tex: "enemy_imp",
    hasWings: false, isFlying: false,
    hornStyle: "small", eyeColor: 0xffee00,
  },
  PINKY: {
    height: 1.8, bodyColor: 0xff4488, emissive: 0x551122, tex: "enemy_pinky",
    hasWings: false, isFlying: false,
    hornStyle: "bull", eyeColor: 0xffff00,
  },
  CACO: {
    height: 1.5, bodyColor: 0xdd3333, emissive: 0x661111, tex: "enemy_caco",
    hasWings: false, isFlying: true,
    hornStyle: "none", eyeColor: 0x00ffaa,
  },
  BARON: {
    height: 2.4, bodyColor: 0xffcc22, emissive: 0x442200, tex: "enemy_baron",
    hasWings: false, isFlying: false,
    hornStyle: "goat", eyeColor: 0xff0000,
  },
  COLOSSUS: {
    height: 3.2, bodyColor: 0xcc4400, emissive: 0x331100, tex: "enemy_colossus",
    hasWings: false, isFlying: false,
    hornStyle: "spikes", eyeColor: 0xff4400,
  },
};

export function createEnemy3D(typeId) {
  const spec = ENEMY_SPECS[typeId] || ENEMY_SPECS.IMP;
  const group = new THREE.Group();
  group.userData.spec = spec;
  group.userData.typeId = typeId;
  group.userData.flying = (typeId === "CACO");
  group.userData.walkPhase = Math.random() * Math.PI * 2;
  group.userData.headPhase = Math.random() * Math.PI * 2;

  const tex = getTexture(spec.tex);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: tex, color: spec.bodyColor,
    emissive: spec.emissive || 0x000000, emissiveIntensity: 0.6,
    roughness: 0.7, metalness: 0.0,
    flatShading: false,
  });

  if (typeId === "CACO") {
    return buildCaco(group, spec, bodyMat);
  } else if (typeId === "COLOSSUS") {
    return buildColossus(group, spec, bodyMat);
  } else {
    return buildBiped(group, spec, bodyMat, typeId);
  }
}

// ── БИПЕД (IMP, PINKY, BARON) ─────────────────────────────────────
function buildBiped(group, spec, mat, typeId) {
  const h = spec.height;
  const legH = h * 0.35, torsoH = h * 0.40, headR = h * 0.13;
  const bodyW = h * 0.28;

  // Ноги
  const legGeo = new THREE.CylinderGeometry(h*0.06, h*0.08, legH, 8);
  const leftLeg = new THREE.Mesh(legGeo, mat);
  const rightLeg = new THREE.Mesh(legGeo, mat);
  leftLeg.position.set(-bodyW*0.35, legH*0.5, 0);
  rightLeg.position.set(bodyW*0.35, legH*0.5, 0);
  group.add(leftLeg); group.add(rightLeg);

  // Ступни (копыта/лапы)
  const footGeo = new THREE.BoxGeometry(h*0.16, h*0.06, h*0.22);
  const leftFoot = new THREE.Mesh(footGeo, mat);
  const rightFoot = new THREE.Mesh(footGeo, mat);
  leftFoot.position.set(-bodyW*0.35, h*0.03, h*0.05);
  rightFoot.position.set(bodyW*0.35, h*0.03, h*0.05);
  group.add(leftFoot); group.add(rightFoot);

  // Торс (грушевидный)
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyW*0.7, bodyW, torsoH, 10),
    mat
  );
  torso.position.y = legH + torsoH*0.5;
  group.add(torso);

  // Плечи (широкие для PINKY/BARON)
  const shoulderScale = typeId === "PINKY" ? 1.3 : (typeId === "BARON" ? 1.5 : 1.0);
  const shoulders = new THREE.Mesh(
    new THREE.SphereGeometry(bodyW * shoulderScale * 0.7, 10, 6),
    mat
  );
  shoulders.position.y = legH + torsoH*0.9;
  shoulders.scale.set(1, 0.6, 1);
  group.add(shoulders);

  // Руки
  const armGeo = new THREE.CylinderGeometry(h*0.05, h*0.06, torsoH*0.9, 8);
  const leftArm = new THREE.Mesh(armGeo, mat);
  const rightArm = new THREE.Mesh(armGeo, mat);
  leftArm.position.set(-bodyW*shoulderScale*0.75, legH + torsoH*0.45, 0);
  rightArm.position.set(bodyW*shoulderScale*0.75, legH + torsoH*0.45, 0);
  leftArm.rotation.z = 0.15;
  rightArm.rotation.z = -0.15;
  group.add(leftArm); group.add(rightArm);

  // Когти
  const clawGeo = new THREE.ConeGeometry(h*0.03, h*0.08, 5);
  for (let side of [-1, 1]) {
    for (let f = 0; f < 3; f++) {
      const claw = new THREE.Mesh(clawGeo, mat);
      claw.material = new THREE.MeshStandardMaterial({ color: 0xf0e0a0, roughness: 0.4 });
      claw.position.set(side*bodyW*shoulderScale*0.75 + (f-1)*h*0.02, legH + torsoH*0.02, h*0.02);
      claw.rotation.x = Math.PI;
      group.add(claw);
    }
  }

  // Голова
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(headR, 12, 10),
    mat
  );
  head.position.y = legH + torsoH + headR*0.8;
  head.scale.set(1, 1.1, 1.1);
  group.add(head);

  // Пасть
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(headR*1.2, headR*0.3, headR*0.6),
    new THREE.MeshBasicMaterial({ color: 0x100000 })
  );
  mouth.position.set(0, legH + torsoH + headR*0.55, headR*0.7);
  group.add(mouth);

  // Клыки
  for (let s of [-1, 1]) {
    for (let f = 0; f < 2; f++) {
      const fang = new THREE.Mesh(
        new THREE.ConeGeometry(headR*0.08, headR*0.25, 4),
        new THREE.MeshStandardMaterial({ color: 0xf0f0d0, roughness: 0.4 })
      );
      fang.position.set(s*headR*0.35 + f*s*headR*0.15, legH + torsoH + headR*0.42, headR*0.85);
      fang.rotation.x = Math.PI;
      group.add(fang);
    }
  }

  // Глаза (яркие светящиеся)
  const eyeGeo = new THREE.SphereGeometry(headR*0.16, 6, 6);
  const eyeMat = new THREE.MeshBasicMaterial({ color: spec.eyeColor });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-headR*0.35, legH + torsoH + headR*0.95, headR*0.85);
  rightEye.position.set(headR*0.35, legH + torsoH + headR*0.95, headR*0.85);
  group.add(leftEye); group.add(rightEye);

  // Слабый свет от глаз
  const eyeLight = new THREE.PointLight(spec.eyeColor, 0.6, 3, 2);
  eyeLight.position.set(0, legH + torsoH + headR*0.95, headR*0.85);
  group.add(eyeLight);

  // Рога
  addHorns(group, spec.hornStyle, headR, legH + torsoH + headR*0.95, mat);

  // Референсы для анимации
  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.userData.leftFoot = leftFoot;
  group.userData.rightFoot = rightFoot;
  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;
  group.userData.head = head;
  group.userData.torso = torso;
  group.userData.legH = legH;
  group.userData.torsoH = torsoH;

  return group;
}

// ── КАКОДЕМОН (летающий шар с одним глазом) ────────────────────────
function buildCaco(group, spec, mat) {
  const r = spec.height * 0.4;

  // Тело — сфера
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(r, 16, 12),
    mat
  );
  body.position.y = spec.height * 0.5;
  group.add(body);

  // Пасть (огромная)
  const mouth = new THREE.Mesh(
    new THREE.SphereGeometry(r*0.7, 12, 8, 0, Math.PI*2, Math.PI*0.6, Math.PI*0.35),
    new THREE.MeshBasicMaterial({ color: 0x100000, side: THREE.DoubleSide })
  );
  mouth.position.y = spec.height * 0.5 - r*0.05;
  mouth.position.z = r*0.35;
  group.add(mouth);

  // Клыки
  for (let i = 0; i < 6; i++) {
    const fang = new THREE.Mesh(
      new THREE.ConeGeometry(r*0.08, r*0.2, 4),
      new THREE.MeshStandardMaterial({ color: 0xf0f0d0 })
    );
    fang.position.set((i-2.5)*r*0.13, spec.height*0.5 - r*0.15, r*0.75);
    fang.rotation.x = Math.PI;
    group.add(fang);
  }

  // Огромный центральный глаз
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(r*0.28, 12, 10),
    new THREE.MeshBasicMaterial({ color: spec.eyeColor })
  );
  eye.position.set(0, spec.height*0.5 + r*0.35, r*0.75);
  group.add(eye);

  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(r*0.12, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  pupil.position.set(0, spec.height*0.5 + r*0.35, r*0.98);
  group.add(pupil);

  // Мощный свет от глаза
  const eyeLight = new THREE.PointLight(spec.eyeColor, 1.5, 5, 2);
  eyeLight.position.set(0, spec.height*0.5 + r*0.35, r*0.75);
  group.add(eyeLight);

  // Рожки на голове
  for (let s of [-1, 1]) {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(r*0.12, r*0.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x440000, roughness: 0.6 })
    );
    horn.position.set(s*r*0.5, spec.height*0.5 + r*0.75, r*0.3);
    horn.rotation.z = s * 0.3;
    horn.rotation.x = -0.2;
    group.add(horn);
  }

  group.userData.body = body;
  group.userData.eye = eye;
  group.userData.baseY = spec.height * 0.5;

  return group;
}

// ── КОЛОСС (огромный кибер-демон) ──────────────────────────────────
function buildColossus(group, spec, mat) {
  // Как биппед, но массивнее + плечи-пушки
  buildBiped(group, spec, mat, "COLOSSUS");

  // Дополнительно: наплечники-пушки
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.8 });
  const h = spec.height;
  for (let s of [-1, 1]) {
    const shoulderPad = new THREE.Mesh(
      new THREE.CylinderGeometry(h*0.12, h*0.15, h*0.15, 8),
      armorMat
    );
    shoulderPad.position.set(s * h*0.35, h*0.72, 0);
    shoulderPad.rotation.z = s * Math.PI * 0.5;
    group.add(shoulderPad);

    // Труба-пушка на плече
    const cannon = new THREE.Mesh(
      new THREE.CylinderGeometry(h*0.06, h*0.06, h*0.35, 8),
      armorMat
    );
    cannon.position.set(s * h*0.42, h*0.78, h*0.08);
    cannon.rotation.x = Math.PI / 2;
    group.add(cannon);
  }
  return group;
}

// ── Рога разных стилей ─────────────────────────────────────────────
function addHorns(group, style, headR, yTop, mat) {
  const hornMat = new THREE.MeshStandardMaterial({ color: 0x221008, roughness: 0.6 });
  if (style === "none") return;

  if (style === "small") {
    for (let s of [-1, 1]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(headR*0.10, headR*0.35, 5),
        hornMat
      );
      horn.position.set(s*headR*0.55, yTop + headR*0.3, 0);
      horn.rotation.z = s * 0.4;
      group.add(horn);
    }
  } else if (style === "bull") {
    for (let s of [-1, 1]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(headR*0.13, headR*0.7, 6),
        hornMat
      );
      horn.position.set(s*headR*0.65, yTop + headR*0.15, 0);
      horn.rotation.z = s * (Math.PI/2 - 0.3);
      group.add(horn);
    }
  } else if (style === "goat") {
    for (let s of [-1, 1]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(headR*0.12, headR*0.9, 6),
        hornMat
      );
      horn.position.set(s*headR*0.5, yTop + headR*0.5, -headR*0.1);
      horn.rotation.z = s * 0.5;
      horn.rotation.x = -0.5;
      group.add(horn);
    }
  } else if (style === "spikes") {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI - Math.PI/2;
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(headR*0.08, headR*0.4, 4),
        hornMat
      );
      horn.position.set(Math.cos(angle)*headR*0.5, yTop + headR*0.4, Math.sin(angle)*headR*0.3);
      horn.rotation.z = angle;
      group.add(horn);
    }
  }
}

// ── АНИМАЦИЯ ────────────────────────────────────────────────────────
// Вызывать каждый кадр. `moving` = true если враг движется (тогда качаем ноги).
export function animateEnemy(mesh, dt, moving = true) {
  const u = mesh.userData;
  const t = performance.now() * 0.001;

  if (u.typeId === "CACO") {
    // Летающий: плавное покачивание
    if (u.body) u.body.position.y = u.baseY + Math.sin(t * 2) * 0.15;
    // Глаз следит по кругу
    if (u.eye) u.eye.rotation.y = Math.sin(t * 0.8) * 0.3;
    return;
  }

  // Пешеходный: качаем ногами при ходьбе
  const speed = moving ? 6 : 0;
  u.walkPhase += dt * speed;
  const swing = moving ? 0.4 : 0;

  if (u.leftLeg && u.rightLeg) {
    const s1 = Math.sin(u.walkPhase) * swing;
    const s2 = Math.sin(u.walkPhase + Math.PI) * swing;
    u.leftLeg.rotation.x = s1;
    u.rightLeg.rotation.x = s2;
    // Ступни двигаются с ногами
    if (u.leftFoot) u.leftFoot.position.z = 0.05 + Math.sin(u.walkPhase) * 0.15;
    if (u.rightFoot) u.rightFoot.position.z = 0.05 + Math.sin(u.walkPhase + Math.PI) * 0.15;
    // Руки в противофазе (естественная походка)
    if (u.leftArm) u.leftArm.rotation.x = -s1 * 0.7;
    if (u.rightArm) u.rightArm.rotation.x = -s2 * 0.7;
    // Торс слегка покачивается вверх-вниз
    if (u.torso) u.torso.position.y = u.legH + u.torsoH*0.5 + Math.abs(Math.sin(u.walkPhase * 2)) * 0.05;
  }

  // Голова слегка "дышит" (idle-motion даже при ходьбе)
  u.headPhase += dt * 1.2;
  if (u.head) {
    u.head.rotation.y = Math.sin(u.headPhase * 0.5) * 0.15;
    u.head.rotation.x = Math.sin(u.headPhase * 0.7) * 0.05;
  }
}
