// Пиксельный выживший: 8 направлений, билборд (concept2).
import * as THREE from "three";

const PLAYER_COLORS = [
  0x4488ff, 0xff4444, 0x44ff44, 0xffaa22, 0xff44ff, 0x44ffff,
];

function hexRgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function drawPixelSurvivor(dir, frame, colorHex, crouch) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const [r, g, b] = hexRgb(colorHex);
  const coat = `rgb(${r},${g},${b})`;
  const coatD = `rgb(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)})`;
  const skin = "#c88866";
  const boot = "#201810";
  const visor = "#ffcc44";
  const px = (x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };

  const walk = frame % 2;
  const legOff = walk ? 2 : 0;
  const y0 = crouch ? 10 : 4;

  // Тень
  px(20, 58, 24, 4, "rgba(0,0,0,0.45)");

  if (dir === 0 || dir === 4) {
    // 0 = спина к камере (уходит), 4 = лицом
    const face = dir === 4;
    px(24, y0 + 22, 16, 22, coat);
    px(22, y0 + 24, 4, 16, coatD);
    px(38, y0 + 24, 4, 16, coatD);
    px(26, y0 + 8, 12, 14, coat);
    px(28, y0 + 10, 8, 8, face ? skin : coatD);
    if (face) {
      px(30, y0 + 12, 2, 2, visor);
      px(34, y0 + 12, 2, 2, visor);
    }
    px(26, y0 + 44, 5, 10 + (walk ? 2 : 0), boot);
    px(33, y0 + 44, 5, 10 + (walk ? 0 : 2), boot);
  } else {
    const flip = dir > 4;
    const sx = flip ? 1 : -1;
    const cx = 32;
    const X = (x) => cx + (x - cx) * sx;
    const bar = (x, y, w, h, fill) => {
      const x0 = Math.min(X(x), X(x + w - 1));
      px(x0, y, w, h, fill);
    };
    bar(26, y0 + 22, 14, 22, coat);
    bar(24, y0 + 26, 6, 14, coatD);
    bar(28, y0 + 8, 12, 14, coat);
    bar(30, y0 + 11, 6, 7, skin);
    bar(32, y0 + 13, 3, 2, visor);
    bar(26 + legOff, y0 + 44, 5, 10, boot);
    bar(33 - legOff, y0 + 44, 5, 10, boot);
  }
  return canvas;
}

function makeTextures(colorHex) {
  const dirs = [];
  for (let d = 0; d < 8; d++) {
    const frames = [];
    for (let f = 0; f < 2; f++) {
      const canvas = drawPixelSurvivor(d, f, colorHex, false);
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.needsUpdate = true;
      frames.push(tex);
    }
    dirs.push(frames);
  }
  return dirs;
}

function octantFromCamera(mesh, camera) {
  if (!camera) return 4;
  const dx = camera.position.x - mesh.position.x;
  const dz = camera.position.z - mesh.position.z;
  const camYaw = Math.atan2(dx, dz);
  const facing = mesh.userData.facingYaw || 0;
  let rel = camYaw - facing;
  while (rel < -Math.PI) rel += Math.PI * 2;
  while (rel > Math.PI) rel -= Math.PI * 2;
  const oct = Math.round(((rel / Math.PI) * 4 + 8)) % 8;
  return oct;
}

export function createOtherPlayer(name, colorIdx = 0) {
  const group = new THREE.Group();
  const color = PLAYER_COLORS[colorIdx % PLAYER_COLORS.length];
  const textures = makeTextures(color);
  const mat = new THREE.SpriteMaterial({
    map: textures[4][0],
    transparent: true,
    alphaTest: 0.15,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.85, 1.85, 1);
  sprite.position.y = 0.95;
  group.add(sprite);

  const nameSprite = makeNameTag(name, color);
  nameSprite.position.set(0, 2.15, 0);
  group.add(nameSprite);

  group.userData.sprite = sprite;
  group.userData.texDirs = textures;
  group.userData.walkPhase = 0;
  group.userData.name = name;
  group.userData.nameSprite = nameSprite;
  group.userData.facingYaw = 0;
  group.userData.pixel = true;
  return group;
}

function makeNameTag(name, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d");
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

export function animateOtherPlayer(mesh, dt, moving = false, camera = null) {
  const u = mesh.userData;
  u.walkPhase += dt * (moving ? 8 : 2);
  const frame = moving ? (Math.floor(u.walkPhase) % 2) : 0;
  const dir = octantFromCamera(mesh, camera);
  if (u.sprite && u.texDirs) {
    u.sprite.material.map = u.texDirs[dir][frame];
    u.sprite.material.needsUpdate = true;
    u.sprite.scale.y = 1.85 * (mesh.scale.y || 1);
  }
}
