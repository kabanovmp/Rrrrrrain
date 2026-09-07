// Cacodemon PNG-атлас 7×6. Спрайт-билборд, кадры по углу обзора (8 направлений),
// атака / боль / смерть — все ряды атласа.

import * as THREE from "three";

let atlasTexture = null;
export function loadEnemyAtlas() {
  if (atlasTexture) return atlasTexture;
  const loader = new THREE.TextureLoader();
  atlasTexture = loader.load("/assets/enemy-sprite.png");
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  return atlasTexture;
}

const ATLAS_COLS = 7;
const ATLAS_ROWS = 6;
const BASE_SCALE = 3.45;

// Классическая раскладка Doom: 5 уникальных ракурсов + зеркало.
// ряд 0 — idle, ряд 1–2 — атака, ряд 3 — доп. idle, ряд 4 — боль, ряд 5 — смерть.
// Не используем спину (col 3–4). Только лицо и бока.
const DIR_COL = [0, 1, 2, 2, 2, 2, 2, 1];
const DIR_FLIP = [1, 1, 1, 1, 1, -1, -1, -1];

function setFrame(data, sprite, frame, flipX) {
  if (frame === data.curFrame && flipX === data.curFlip) return;
  data.curFrame = frame;
  data.curFlip = flipX;
  const col = frame % ATLAS_COLS;
  const row = Math.floor(frame / ATLAS_COLS);
  data.tex.offset.set(col * data.cw, 1 - (row + 1) * data.ch);
  const s = data.baseScale;
  sprite.scale.set(s * flipX, s, 1);
}

function viewSector(camera, sprite, enemyYaw) {
  const dx = camera.position.x - sprite.position.x;
  const dz = camera.position.z - sprite.position.z;
  const viewYaw = Math.atan2(dx, dz);
  let rel = viewYaw - (enemyYaw || 0);
  while (rel < -Math.PI) rel += Math.PI * 2;
  while (rel > Math.PI) rel -= Math.PI * 2;
  return ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
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
    alphaTest: 0.22,
    color: 0xffece4,
    depthWrite: false,
  });
  const cw = 1 / ATLAS_COLS;
  const ch = 1 / ATLAS_ROWS;
  tex.repeat.set(cw, ch);
  tex.offset.set(0, 1 - ch);
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(BASE_SCALE, BASE_SCALE, 1);
  sprite.center.set(0.5, 0.42);
  sprite.userData.cacoAtlas = { cw, ch, tex, curFrame: -1, curFlip: 1, baseScale: BASE_SCALE };
  sprite.userData.flying = true;
  return sprite;
}

export function updateCacodemonSprite(sprite, camera, enemyYaw, animPhase, alive = true, attacking = false, inPain = false) {
  const data = sprite.userData.cacoAtlas;
  if (!data) return;
  const sector = viewSector(camera, sprite, enemyYaw);
  const col = DIR_COL[sector];
  const flip = DIR_FLIP[sector];

  if (!alive) {
    const deathCols = 5; // последние две ячейки ряда пустые
    const fi = Math.min(deathCols - 1, Math.floor(Math.max(0, animPhase) * deathCols));
    const frame = 5 * ATLAS_COLS + fi;
    data.baseScale = BASE_SCALE * (fi >= 4 ? 0.72 : 1);
    setFrame(data, sprite, frame, 1);
    return;
  }
  data.baseScale = BASE_SCALE;

  if (inPain) {
    setFrame(data, sprite, 4 * ATLAS_COLS + col, flip);
    return;
  }
  if (attacking) {
    const row = (Math.floor((animPhase || 0) * 4) % 2 === 0) ? 1 : 2;
    setFrame(data, sprite, row * ATLAS_COLS + col, flip);
    return;
  }
  const bobRow = ((animPhase || 0) < 0.5) ? 0 : 3;
  setFrame(data, sprite, bobRow * ATLAS_COLS + col, flip);
}
