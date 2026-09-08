// Портал как в Minecraft Nether: рамка 4×5 из обсидиана и вертикальная
// фиолетовая «вода» 2×3, пиксельная, с частицами.

import * as THREE from "three";

function makeObsidianTexture() {
  const s = 16;
  const c = document.createElement("canvas");
  c.width = s; c.height = s;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const n = Math.random();
    let r, g, b;
    if (n < 0.5) { r = 10 + n * 22; g = 8; b = 14; }
    else if (n < 0.78) { r = 26; g = 16; b = 36; }
    else if (n < 0.92) { r = 6; g = 6; b = 8; }
    else { r = 42; g = 28; b = 52; }
    const o = i * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makePortalCanvas() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 48;
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas: c, tex };
}

export function paintNetherWater(canvas, t) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      const swirl = Math.sin(u * Math.PI * 5.5 + Math.sin(v * 9 + t * 1.7) * 0.85);
      const flow = (v * 2.4 - t * 0.62 + Math.sin(u * 8 + t * 0.9) * 0.12 + 8) % 1;
      const n = swirl * 0.28 + flow * 0.72;
      const i = (y * w + x) * 4;
      if (n < 0.18) { d[i] = 12; d[i + 1] = 0; d[i + 2] = 22; }
      else if (n < 0.38) { d[i] = 58; d[i + 1] = 0; d[i + 2] = 98; }
      else if (n < 0.62) { d[i] = 118; d[i + 1] = 12; d[i + 2] = 188; }
      else if (n < 0.82) { d[i] = 176; d[i + 1] = 48; d[i + 2] = 235; }
      else { d[i] = 230; d[i + 1] = 140; d[i + 2] = 255; }
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function makeSparks(bs) {
  const n = 70;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * bs * 1.85;
    pos[i * 3 + 1] = bs + Math.random() * bs * 3;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.22;
    vel[i] = 0.6 + Math.random() * 1.4;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xe080ff, size: 0.11, transparent: true, opacity: 0.85,
    depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.vel = vel;
  pts.userData.bs = bs;
  return pts;
}

export function createNetherPortal({ scale = 1, lit = true, idle = false } = {}) {
  if (idle) lit = false;
  const group = new THREE.Group();
  const BS = 1.05 * scale;
  const obsTex = makeObsidianTexture();
  const W = 4, H = 5;
  const blocks = [];
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const inner = x > 0 && x < W - 1 && y > 0 && y < H - 1;
      if (inner) continue;
      const tint = 0.82 + Math.random() * 0.22;
      const mat = new THREE.MeshStandardMaterial({
        map: obsTex,
        color: new THREE.Color(0.22 + tint * 0.12, 0.10, 0.28 + tint * 0.1),
        roughness: 0.88,
        metalness: 0.08,
        emissive: new THREE.Color(0x3a1460),
        emissiveIntensity: lit ? 0.55 : 0.32,
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(BS, BS, BS * 0.92), mat);
      b.position.set((x - (W - 1) / 2) * BS, y * BS + BS * 0.5, 0);
      group.add(b);
      blocks.push(b);
    }
  }

  const { canvas, tex } = makePortalCanvas();
  paintNetherWater(canvas, 0);
  tex.needsUpdate = true;
  const pw = 2 * BS * 0.98, ph = 3 * BS * 0.98;
  const waterMat = new THREE.MeshBasicMaterial({
    map: tex, color: 0xffffff, transparent: true, opacity: lit ? 1 : 0.55,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), waterMat);
  water.position.y = 2.5 * BS;
  water.position.z = 0.02;
  water.visible = true;
  water.renderOrder = 2;
  group.add(water);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(pw * 1.08, ph * 1.08),
    new THREE.MeshBasicMaterial({
      color: 0xaa44ff, transparent: true, opacity: lit ? 0.22 : 0.12,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  glow.position.copy(water.position);
  glow.position.z = 0.04;
  glow.renderOrder = 1;
  group.add(glow);

  const light = new THREE.PointLight(0xb14cff, lit ? 5.5 : 2.2, 28, 1.4);
  light.position.set(0, 2.5 * BS, 0.4);
  group.add(light);

  const sparks = makeSparks(BS);
  sparks.position.y = 0;
  sparks.visible = true;
  group.add(sparks);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 1.1, 42, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xcc66ff, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  beam.position.y = 22;
  group.add(beam);

  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(2.6 * scale, 28),
    new THREE.MeshBasicMaterial({
      color: 0x9a40ff, transparent: true, opacity: 0.45,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.04;
  group.add(pad);

  group.userData.isPortal = true;
  group.userData.bs = BS;
  group.userData.blocks = blocks;
  group.userData.water = water;
  group.userData.glow = glow;
  group.userData.light = light;
  group.userData.sparks = sparks;
  group.userData.beam = beam;
  group.userData.pad = pad;
  group.userData.portalCanvas = canvas;
  group.userData.portalTex = tex;
  group.userData.obsMat = blocks[0]?.material;
  group.userData.arch = blocks[0];
  group.userData.lit = lit;
  group.userData.base = group;
  return group;
}

export function tickNetherPortal(group, tSec) {
  if (!group?.userData?.portalCanvas) return;
  if (!group.userData.water?.visible) return;
  if (!group.userData._pt || tSec - group.userData._pt > 0.045) {
    group.userData._pt = tSec;
    paintNetherWater(group.userData.portalCanvas, tSec);
    group.userData.portalTex.needsUpdate = true;
  }
  const sparks = group.userData.sparks;
  if (sparks?.visible) {
    const pos = sparks.geometry.attributes.position;
    const vel = sparks.userData.vel;
    const bs = sparks.userData.bs;
    const dt = 0.045;
    for (let i = 0; i < vel.length; i++) {
      pos.array[i * 3 + 1] += vel[i] * dt;
      if (pos.array[i * 3 + 1] > bs * 4.05) {
        pos.array[i * 3 + 1] = bs * 1.05;
        pos.array[i * 3] = (Math.random() - 0.5) * bs * 1.85;
      }
    }
    pos.needsUpdate = true;
  }
}

export function setNetherPortalState(group, state, chargeRatio = 0, tSec = 0) {
  if (!group?.userData?.water) return;
  const { water, glow, light, sparks, blocks, beam, pad } = group.userData;
  const cr = Math.max(0, Math.min(1, chargeRatio));
  const pulse = 0.85 + Math.sin(tSec * 5.2) * 0.15;
  let intensity = 4.2, glowOp = 0.2, waterOp = 1, em = 0.4, beamOp = 0.2, padOp = 0.4;
  if (state === "idle") {
    intensity = 2.4; glowOp = 0.14; waterOp = 0.62; em = 0.35; beamOp = 0.18; padOp = 0.4;
  } else if (state === "charging") {
    intensity = 2.2 + 5 * cr; glowOp = 0.12 + 0.22 * cr;
    waterOp = 0.7 + 0.3 * cr; em = 0.4 + 0.45 * cr; beamOp = 0.22 + 0.28 * cr; padOp = 0.45 + 0.3 * cr;
  } else if (state === "ready") {
    intensity = 7 * pulse; glowOp = 0.3 * pulse;
    waterOp = 1; em = 0.55 + 0.35 * pulse; beamOp = 0.42 * pulse; padOp = 0.7;
  } else if (state === "hold") {
    intensity = 9; glowOp = 0.45; waterOp = 1; em = 0.85; beamOp = 0.55; padOp = 0.85;
  }
  water.visible = true;
  sparks.visible = true;
  glow.visible = true;
  water.material.opacity = waterOp;
  glow.material.opacity = glowOp;
  light.intensity = intensity;
  if (beam?.material) beam.material.opacity = beamOp * pulse;
  if (pad?.material) pad.material.opacity = padOp;
  water.scale.set(1, 1, 1);
  water.position.y = 2.5 * group.userData.bs;
  glow.position.y = water.position.y;
  glow.scale.set(1, 1, 1);
  for (const b of blocks) {
    if (!b.material) continue;
    b.material.emissiveIntensity = em;
    b.material.emissive.setHex(state === "idle" ? 0x4a1878 : 0x7a28c8);
  }
  tickNetherPortal(group, tSec);
}

const _local = new THREE.Vector3();
export function isInsideNetherPortal(group, x, y, z) {
  if (!group) return false;
  _local.set(x, y, z);
  group.worldToLocal(_local);
  const bs = group.userData.bs || 1;
  return Math.abs(_local.x) < bs * 1.35
    && _local.y > -0.2 && _local.y < bs * 4.4
    && Math.abs(_local.z) < 2.4;
}

const _nearWorld = new THREE.Vector3();
export function nearNetherPortal(group, x, z, range = 5) {
  if (!group) return false;
  group.getWorldPosition(_nearWorld);
  const dx = x - _nearWorld.x, dz = z - _nearWorld.z;
  return dx * dx + dz * dz <= range * range;
}
