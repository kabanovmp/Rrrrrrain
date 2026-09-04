import * as THREE from "three";

// Hands as billboarded sprites in front of the camera.
// Style matches the user's Figma sketch: flat red silhouettes, splayed fingers.
// Each hand carries userData: { setColor, kick, update } for main.js to drive.

export function createHandMesh(side) {
  const tex = createHandOpenTexture(0xff2a2a);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(1.2, 1.2, 1.2);
  spr.position.set(side === "left" ? -0.55 : 0.55, -0.55, -1.1);
  spr.renderOrder = 999;

  let kickT = 0;
  let currentColor = 0xff2a2a;

  spr.userData = {
    setColor(color) {
      if (color === currentColor) return;
      currentColor = color;
      mat.map = createHandOpenTexture(color);
      mat.needsUpdate = true;
    },
    kick() { kickT = 0.18; },
    update(dt) {
      kickT = Math.max(0, kickT - dt);
      const k = kickT / 0.18;
      spr.position.y = -0.55 + k * 0.12;
      spr.position.z = -1.1 + k * 0.15;
      spr.material.rotation = (side === "left" ? 1 : -1) * k * 0.35;
    },
  };
  return spr;
}

/**
 * Palette-driven procedural sprite: red silhouette hand, splayed fingers,
 * matches the reference. Rendered to a canvas texture once per color change.
 */
export function createHandOpenTexture(color) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  const hex = "#" + color.toString(16).padStart(6, "0");
  ctx.fillStyle = hex;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 4;

  // palm
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.68, size * 0.28, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 5 fingers spread
  const fingers = [
    { a: -Math.PI * 0.60, len: 0.32, w: 0.055 }, // thumb
    { a: -Math.PI * 0.30, len: 0.40, w: 0.05  },
    { a: -Math.PI * 0.50, len: 0.44, w: 0.05  },
    { a: -Math.PI * 0.70, len: 0.40, w: 0.05  },
    { a: -Math.PI * 0.90, len: 0.32, w: 0.045 }, // pinky
  ];
  // recompute: angles around top of palm
  const cx = size / 2, cy = size * 0.55;
  const baseAngles = [-1.0, -0.55, 0.0, 0.55, 1.0]; // radians, spread
  const lens = [0.28, 0.38, 0.44, 0.38, 0.28];
  const wid  = [0.055, 0.05, 0.05, 0.05, 0.045];
  for (let i = 0; i < 5; i++) {
    const a = baseAngles[i] - Math.PI / 2;
    const L = lens[i] * size;
    const w = wid[i] * size;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * L, cy + Math.sin(a) * L, w, L * 0.5, a + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // subtle inner shadow (adds depth without being fancy)
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(cx + 6, size * 0.7, size * 0.24, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Small fist icon for pedestal pickups
export function createHandFistTexture(color) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.beginPath();
  ctx.ellipse(size / 2, size / 2, size * 0.34, size * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.ellipse(size / 2 + 4, size / 2 + 4, size * 0.30, size * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
