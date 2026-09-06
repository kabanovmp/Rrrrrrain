// v0.0.3.0 — 1 враг Cacodemon из атласа enemy-sprite.jpg
// Атлас 500x434, 6 рядов, 7 колонок = 42 ячейки (последний ряд неполный)
// Используем как fake-3D: выбираем кадр по углу камеры относительно врага.

import * as THREE from "three";

let atlasTexture = null;
export function loadEnemyAtlas() {
  if (atlasTexture) return atlasTexture;
  const loader = new THREE.TextureLoader();
  atlasTexture = loader.load("/assets/enemy-sprite.jpg");
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  return atlasTexture;
}

// Атлас: 7 колонок x 6 рядов (~42 кадра, но реально 32-35).
// Ячейка: 500/7 ≈ 71.4 x 434/6 ≈ 72.3 пикселей.
const ATLAS_COLS = 7;
const ATLAS_ROWS = 6;

// Выбираем "лучший" кадр из атласа. Мы просто разворачиваем в 8 направлений
// (0..7) по углу между камерой и передом врага. Первые 8 кадров = 8 направлений
// idle. Остальные — атака, полёт и т.д.
function directionFrame(camPos, enemyPos, enemyYaw) {
  const dx = camPos.x - enemyPos.x;
  const dz = camPos.z - enemyPos.z;
  const angleToCam = Math.atan2(dx, dz);
  let rel = angleToCam - enemyYaw;
  while (rel > Math.PI) rel -= 2 * Math.PI;
  while (rel < -Math.PI) rel += 2 * Math.PI;
  // rel в [-PI, PI]. 8 направлений.
  const dir = Math.round(((rel + Math.PI) / (2 * Math.PI)) * 8) % 8;
  return dir; // 0..7
}

export function createCacodemonSprite() {
  const tex = loadEnemyAtlas().clone();
  tex.needsUpdate = true;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.5,
    color: 0xffffff,
  });
  // UV в атласе для первого кадра (0,0 — верхний-левый; но в THREE UV снизу-слева)
  const cw = 1 / ATLAS_COLS;
  const ch = 1 / ATLAS_ROWS;
  tex.repeat.set(cw, ch);
  tex.offset.set(0, 1 - ch); // верхний-левый кадр
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.5, 3.5, 1); // ~3.5м размер
  sprite.userData.cacoAtlas = { cw, ch, tex, curFrame: -1 };
  return sprite;
}

export function updateCacodemonSprite(sprite, camera, enemyYaw, animPhase, alive = true) {
  const data = sprite.userData.cacoAtlas;
  if (!data) return;
  const dir = directionFrame(camera.position, sprite.position, enemyYaw || 0);
  // Первые 8 кадров — direction idle (row 0-1, cols 0-6 + row 1 col 0)
  // Атака: кадры 8-15 (row 1 col 1..7 + row 2)
  // Смерть: последние 3 (маленькие)
  const attackFrame = Math.floor(animPhase * 8) % 8 + 8;
  const frame = alive ? dir : Math.min(41, 32 + Math.floor(animPhase * 3));
  if (frame === data.curFrame) return;
  data.curFrame = frame;
  const col = frame % ATLAS_COLS;
  const row = Math.floor(frame / ATLAS_COLS);
  data.tex.offset.set(col * data.cw, 1 - (row + 1) * data.ch);
}
