// Модель другого игрока в коопе: капюшонный маг + светящийся посох + имя.
// Меняется в assets.js когда добавим кастомные модели.

import * as THREE from "three";

const PLAYER_COLORS = [
  0x4488ff, 0xff4444, 0x44ff44, 0xffaa22, 0xff44ff, 0x44ffff,
];

export function createOtherPlayer(name, colorIdx = 0) {
  const group = new THREE.Group();
  const color = PLAYER_COLORS[colorIdx % PLAYER_COLORS.length];

  // ── Ноги ──────────────────────────────────────────────────
  const legMat = new THREE.MeshStandardMaterial({ color: 0x201810, roughness: 0.8 });
  const legGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.7, 8);
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.13, 0.35, 0);
  rightLeg.position.set(0.13, 0.35, 0);
  group.add(leftLeg); group.add(rightLeg);

  // ── Мантия (широкий низ, узкий верх) ─────────────────────
  const robeMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.8, metalness: 0.0
  });
  const robe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.45, 1.0, 12),
    robeMat
  );
  robe.position.y = 1.2;
  group.add(robe);

  // Пояс
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12),
    new THREE.MeshStandardMaterial({ color: 0x442200, roughness: 0.5, metalness: 0.4 })
  );
  belt.position.y = 1.05;
  group.add(belt);

  // ── Плечи (обозначаем руки) ──────────────────────────────
  const armMat = robeMat;
  const armGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.5, 6);
  const leftArm = new THREE.Mesh(armGeo, armMat);
  const rightArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.28, 1.4, 0);
  rightArm.position.set(0.28, 1.4, 0);
  leftArm.rotation.z = 0.2;
  rightArm.rotation.z = -0.2;
  group.add(leftArm); group.add(rightArm);

  // Кисти (открытые)
  const handMat = new THREE.MeshStandardMaterial({ color: 0xc88866, roughness: 0.7 });
  const leftFist = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), handMat);
  const rightFist = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), handMat);
  leftFist.position.set(-0.35, 1.15, 0.03);
  rightFist.position.set(0.35, 1.15, 0.03);
  group.add(leftFist); group.add(rightFist);

  // ── Голова (в капюшоне) ──────────────────────────────────
  const hoodMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const hood = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.35, 10),
    hoodMat
  );
  hood.position.y = 1.85;
  group.add(hood);

  // Лицо в капюшоне — тёмное
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  face.position.set(0, 1.75, 0.08);
  group.add(face);

  // Светящиеся глаза
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 5, 4), eyeMat);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 5, 4), eyeMat);
  leftEye.position.set(-0.04, 1.78, 0.16);
  rightEye.position.set(0.04, 1.78, 0.16);
  group.add(leftEye); group.add(rightEye);

  // Слабый свет от лица
  const faceLight = new THREE.PointLight(0xffaa00, 0.3, 2, 2);
  faceLight.position.set(0, 1.78, 0.16);
  group.add(faceLight);

  // ── Табличка с именем над головой ─────────────────────────
  const nameSprite = makeNameTag(name, color);
  nameSprite.position.set(0, 2.35, 0);
  group.add(nameSprite);

  // Референсы для анимации
  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;
  group.userData.robe = robe;
  group.userData.walkPhase = 0;
  group.userData.name = name;
  group.userData.nameSprite = nameSprite;

  return group;
}

function makeNameTag(name, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d");

  // Тёмная подложка с рамкой цвета игрока
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 252, 60);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Courier New, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name.slice(0, 12), 128, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(1.0, 0.25, 1);
  return sprite;
}

// Анимация: качаем ногами/руками при движении
export function animateOtherPlayer(mesh, dt, moving = false) {
  const u = mesh.userData;
  const speed = moving ? 5 : 0;
  u.walkPhase += dt * speed;
  const swing = moving ? 0.35 : 0;

  if (u.leftLeg && u.rightLeg) {
    u.leftLeg.rotation.x = Math.sin(u.walkPhase) * swing;
    u.rightLeg.rotation.x = Math.sin(u.walkPhase + Math.PI) * swing;
    u.leftArm.rotation.x = -Math.sin(u.walkPhase) * swing * 0.5;
    u.rightArm.rotation.x = -Math.sin(u.walkPhase + Math.PI) * swing * 0.5;
  }

  // Idle-дыхание мантии
  const t = performance.now() * 0.001;
  if (u.robe) u.robe.scale.y = 1 + Math.sin(t * 1.2) * 0.01;
}
