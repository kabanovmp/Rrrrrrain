// Портал в стиле Minecraft Nether: обсидиановая рамка 4×5 и фиолетовая «вода».
import * as THREE from "three";

function makePortalSwirlTex() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 96;
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas: c, tex };
}

function paintPortal(canvas, t) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = Math.sin(x * 0.35 + t * 2.1) + Math.sin(y * 0.22 - t * 1.6)
        + Math.sin((x + y) * 0.18 + t * 3.0);
      const v = (n + 3) / 6;
      const i = (y * w + x) * 4;
      d[i] = 80 + v * 140;
      d[i + 1] = 20 + v * 40;
      d[i + 2] = 140 + v * 115;
      d[i + 3] = 200 + v * 55;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function createNetherPortal({ scale = 1, idle = false } = {}) {
  const group = new THREE.Group();
  const BS = 1.2 * scale;
  const obs = new THREE.MeshStandardMaterial({
    color: 0x0b0b12, roughness: 0.92, metalness: 0.08,
    emissive: 0x1a0820, emissiveIntensity: idle ? 0.08 : 0.18,
  });
  const W = 4, H = 5;
  let first = null;
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const inner = x > 0 && x < W - 1 && y > 0 && y < H - 1;
      if (inner) continue;
      const b = new THREE.Mesh(new THREE.BoxGeometry(BS * 1.02, BS * 1.02, BS * 0.72), obs);
      b.position.set((x - (W - 1) / 2) * BS, y * BS + BS * 0.5, 0);
      if (!first) first = b;
      group.add(b);
    }
  }
  const { canvas, tex } = makePortalSwirlTex();
  paintPortal(canvas, 0);
  tex.needsUpdate = true;
  const pw = 2 * BS * 0.96, ph = 3 * BS * 0.96;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(pw, ph),
    new THREE.MeshBasicMaterial({
      map: tex, color: 0xffffff, transparent: true, opacity: idle ? 0.55 : 0.85,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  water.position.y = 2.5 * BS;
  group.add(water);

  const base = new THREE.Mesh(
    new THREE.CircleGeometry(2.4 * scale, 24),
    new THREE.MeshBasicMaterial({
      color: 0x4a1a6a, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.03;
  group.add(base);

  group.userData.isPortal = true;
  group.userData.arch = first;
  group.userData.water = water;
  group.userData.base = base;
  group.userData.portalCanvas = canvas;
  group.userData.portalTex = tex;
  group.userData.obsMat = obs;
  return group;
}

export function tickNetherPortal(group, tSec) {
  if (!group?.userData?.portalCanvas) return;
  if (!group.userData._pt || tSec - group.userData._pt > 0.05) {
    group.userData._pt = tSec;
    paintPortal(group.userData.portalCanvas, tSec);
    group.userData.portalTex.needsUpdate = true;
  }
}
