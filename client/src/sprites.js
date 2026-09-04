import * as THREE from "three";

// Procedural DOOM-style enemy sprites drawn to canvas.
// Deliberately blocky/pixelated to match retro pixel-3D aesthetic.

const PALETTE = {
  IMP:      { skin: "#6a3520", eye: "#ffaa22", horn: "#221008", claw: "#f0e0a0" },
  PINKY:    { skin: "#a93030", eye: "#ffff00", horn: "#440000", claw: "#ffffff" },
  CACO:     { skin: "#b32020", eye: "#00ffaa", horn: "#440000", claw: "#ffaa22" },
  BARON:    { skin: "#8f5a20", eye: "#ff0000", horn: "#442200", claw: "#ffffff" },
  COLOSSUS: { skin: "#552211", eye: "#ff2200", horn: "#221008", claw: "#ffbb00" },
};

export function createSpriteTexture(typeId) {
  const p = PALETTE[typeId] || PALETTE.IMP;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // Body silhouette
  ctx.fillStyle = p.skin;
  if (typeId === "CACO") {
    ctx.beginPath(); ctx.arc(size/2, size/2, size*0.42, 0, Math.PI*2); ctx.fill();
    // mouth
    ctx.fillStyle = "#000";
    ctx.fillRect(size*0.30, size*0.55, size*0.40, size*0.14);
    // teeth
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 5; i++) ctx.fillRect(size*0.32 + i*size*0.08, size*0.55, size*0.05, size*0.08);
    // single big eye
    ctx.fillStyle = p.eye;
    ctx.beginPath(); ctx.arc(size/2, size*0.38, size*0.09, 0, Math.PI*2); ctx.fill();
  } else if (typeId === "COLOSSUS") {
    // torso
    ctx.fillRect(size*0.30, size*0.30, size*0.40, size*0.55);
    // head
    ctx.fillRect(size*0.36, size*0.12, size*0.28, size*0.20);
    // horns
    ctx.fillStyle = p.horn;
    ctx.beginPath(); ctx.moveTo(size*0.36, size*0.14); ctx.lineTo(size*0.28, size*0.02); ctx.lineTo(size*0.42, size*0.16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(size*0.64, size*0.14); ctx.lineTo(size*0.72, size*0.02); ctx.lineTo(size*0.58, size*0.16); ctx.fill();
    // eyes
    ctx.fillStyle = p.eye;
    ctx.fillRect(size*0.40, size*0.20, size*0.06, size*0.05);
    ctx.fillRect(size*0.54, size*0.20, size*0.06, size*0.05);
    // legs
    ctx.fillStyle = p.skin;
    ctx.fillRect(size*0.32, size*0.85, size*0.14, size*0.15);
    ctx.fillRect(size*0.54, size*0.85, size*0.14, size*0.15);
  } else {
    // Generic biped (IMP / PINKY / BARON)
    // torso
    ctx.fillRect(size*0.35, size*0.35, size*0.30, size*0.35);
    // head
    ctx.beginPath(); ctx.arc(size/2, size*0.28, size*0.13, 0, Math.PI*2); ctx.fill();
    // arms
    ctx.fillRect(size*0.20, size*0.38, size*0.13, size*0.30);
    ctx.fillRect(size*0.67, size*0.38, size*0.13, size*0.30);
    // legs
    ctx.fillRect(size*0.37, size*0.70, size*0.10, size*0.22);
    ctx.fillRect(size*0.53, size*0.70, size*0.10, size*0.22);
    // horns
    ctx.fillStyle = p.horn;
    ctx.beginPath(); ctx.moveTo(size*0.40, size*0.20); ctx.lineTo(size*0.34, size*0.08); ctx.lineTo(size*0.46, size*0.22); ctx.fill();
    ctx.beginPath(); ctx.moveTo(size*0.60, size*0.20); ctx.lineTo(size*0.66, size*0.08); ctx.lineTo(size*0.54, size*0.22); ctx.fill();
    // eyes
    ctx.fillStyle = p.eye;
    ctx.fillRect(size*0.44, size*0.26, size*0.04, size*0.03);
    ctx.fillRect(size*0.52, size*0.26, size*0.04, size*0.03);
    // claws
    ctx.fillStyle = p.claw;
    ctx.fillRect(size*0.20, size*0.65, size*0.05, size*0.05);
    ctx.fillRect(size*0.75, size*0.65, size*0.05, size*0.05);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
