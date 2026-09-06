// v0.0.3.2 — Cacodemon PNG-атлас с alpha (вырезан белый фон)
// Правило: спрайт ВСЕГДА повёрнут лицом к камере (нет direction-frames)
// Атлас 500x434, 6 рядов, 7 колонок = 42 ячейки

import * as THREE from "three";

let atlasTexture = null;
export function loadEnemyAtlas() {
  if (atlasTexture) return atlasTexture;
  const loader = new THREE.TextureLoader();
  // v0.0.3.2: PNG с прозрачностью вместо JPG с белым фоном
  atlasTexture = loader.load("/assets/enemy-sprite.png");
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  return atlasTexture;
}

// Атлас: 7 колонок x 6 рядов (~42 кадра, но реально 32-35).
// Ячейка: 500/7 ≈ 71.4 x 434/6 ≈ 72.3 пикселей.
const ATLAS_COLS = 7;
const ATLAS_ROWS = 6;

// v0.0.3.2: правило — какодемон ВСЕГДА повернут лицом к игроку-наблюдателю.
// Используем только фронтальный кадр (0) для idle и атаки — никаких боковых/задних углов.
const FRONT_IDLE_FRAME = 0;      // ряд 0, колонка 0 — фронтальный idle
const FRONT_ATTACK_FRAMES = [7, 8, 9, 10]; // ряд 1 — фронтальная атака (морда, зубы)

export function createCacodemonSprite() {
  const tex = loadEnemyAtlas().clone();
  tex.needsUpdate = true;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.1,   // v0.0.3.2: мягче для PNG с alpha-градиентом по краям
    color: 0xffffff,
    depthWrite: false,
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

// v0.0.3.2: sprite THREE.Sprite сам билбордится к камере — нам достаточно только
// выбрать кадр. Никакого direction: используем фронтальный idle или цикл фронт-атаки.
// enemyYaw больше не используется, но параметр оставлен для обратной совместимости.
export function updateCacodemonSprite(sprite, camera, enemyYaw, animPhase, alive = true, attacking = false) {
  const data = sprite.userData.cacoAtlas;
  if (!data) return;
  let frame;
  if (!alive) {
    // Смерть: последние 3 маленьких кадра (39-41)
    frame = Math.min(41, 39 + Math.floor(animPhase * 3));
  } else if (attacking) {
    // Фронтальная атака — цикл по FRONT_ATTACK_FRAMES
    frame = FRONT_ATTACK_FRAMES[Math.floor(animPhase * FRONT_ATTACK_FRAMES.length) % FRONT_ATTACK_FRAMES.length];
  } else {
    // Фронтальный idle с лёгким "дыханием": чередуем 0 и 1 колонку периодически
    frame = FRONT_IDLE_FRAME;
  }
  if (frame === data.curFrame) return;
  data.curFrame = frame;
  const col = frame % ATLAS_COLS;
  const row = Math.floor(frame / ATLAS_COLS);
  data.tex.offset.set(col * data.cw, 1 - (row + 1) * data.ch);
}
