// Плоский FPS-HUD: рука всегда отдельно, оружие — оверлей. Спрайты рисуются
// на канвасе (без огромных padded PNG), размер — vmin + px-кэп, чтобы на
// маленьком ноутбуке при 100% масштаба браузера рука не уезжала за экран.

function canvasUrl(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  return c.toDataURL("image/png");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintHand(ctx, w, h, palmUp) {
  ctx.clearRect(0, 0, w, h);
  const cx = w * 0.5, cy = h * 0.70;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.55, 1.55);
  if (palmUp) ctx.scale(1, -1);
  // предплечье
  ctx.fillStyle = "#c45a48";
  ctx.beginPath();
  ctx.moveTo(-28, 70); ctx.lineTo(36, 70); ctx.lineTo(22, 8); ctx.lineTo(-18, 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e07862";
  roundRect(ctx, -34, -38, 68, 52, 18); ctx.fill();
  // пальцы
  ctx.fillStyle = "#f09078";
  const fingers = palmUp
    ? [[-28, -70, 14, 42], [-10, -78, 14, 48], [8, -76, 14, 46], [26, -64, 12, 38]]
    : [[-30, -72, 14, 44], [-12, -82, 15, 52], [8, -80, 14, 50], [26, -68, 13, 40]];
  for (const [x, y, fw, fh] of fingers) {
    roundRect(ctx, x, y, fw, fh, 7); ctx.fill();
  }
  ctx.fillStyle = "#d06855";
  roundRect(ctx, 22, -28, 22, 28, 10); ctx.fill(); // большой
  ctx.restore();
}

function paintSword(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w * 0.62, h * 0.58);
  ctx.rotate(-0.62);
  ctx.scale(1.85, 1.85);
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(-14, 48, 28, 28);
  ctx.fillStyle = "#e8c44a";
  ctx.fillRect(-32, 38, 64, 16);
  const g = ctx.createLinearGradient(0, -140, 0, 40);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.15, "#ffe0f4");
  g.addColorStop(0.45, "#ff6ab8");
  g.addColorStop(1, "#8a1048");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -148); ctx.lineTo(16, 40); ctx.lineTo(-16, 40);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff8fc";
  ctx.fillRect(-4, -130, 8, 160);
  ctx.fillStyle = "#ffd0ee";
  ctx.beginPath();
  ctx.moveTo(0, -148); ctx.lineTo(10, -118); ctx.lineTo(-10, -118);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function paintStaff(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w * 0.60, h * 0.52);
  ctx.rotate(-0.4);
  ctx.scale(1.9, 1.9);
  ctx.strokeStyle = "#6a4428";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 80); ctx.lineTo(0, -70); ctx.stroke();
  ctx.fillStyle = "#88eeff";
  ctx.shadowColor = "#44ddff";
  ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(0, -82, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(-4, -86, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function paintDaggers(ctx, w, h, n) {
  ctx.clearRect(0, 0, w, h);
  const count = Math.max(1, Math.min(10, n | 0));
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    ctx.save();
    ctx.translate(w * (0.28 + t * 0.42), h * (0.42 - Math.abs(t - 0.5) * 0.1));
    ctx.rotate(-0.9 + t * 0.5);
    ctx.scale(1.7, 1.7);
    ctx.fillStyle = "#8899aa";
    ctx.beginPath();
    ctx.moveTo(0, -42); ctx.lineTo(7, 8); ctx.lineTo(-7, 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c8d0d8";
    ctx.fillRect(-2, -38, 4, 40);
    ctx.fillStyle = "#5a3a28";
    ctx.fillRect(-5, 8, 10, 16);
    ctx.restore();
  }
}

function paintCig(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w * 0.58, h * 0.58);
  ctx.rotate(-0.9);
  ctx.scale(1.9, 1.9);
  ctx.fillStyle = "#f2e6c8";
  roundRect(ctx, -6, -40, 12, 70, 3); ctx.fill();
  ctx.fillStyle = "#cc4444";
  ctx.fillRect(-6, -40, 12, 10);
  ctx.fillStyle = "#ffaa44";
  ctx.beginPath(); ctx.arc(0, -42, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(180,180,180,0.45)";
  ctx.beginPath(); ctx.ellipse(0, -58, 10, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export const HAND_SPRITE = "/assets/hand-dd.png";

const CACHE = {};
export function hudSprite(kind, extra = 1) {
  if (kind === "hand" || kind === "handUp") return HAND_SPRITE;
  const key = kind + ":" + extra;
  if (CACHE[key]) return CACHE[key];
  let url;
  if (kind === "sword") url = canvasUrl(512, 512, paintSword);
  else if (kind === "staff") url = canvasUrl(512, 512, paintStaff);
  else if (kind === "daggers") url = canvasUrl(512, 512, (c, w, h) => paintDaggers(c, w, h, extra));
  else if (kind === "cig") url = canvasUrl(512, 512, paintCig);
  else url = canvasUrl(8, 8, () => {});
  CACHE[key] = url;
  return url;
}

export function lootIconDataUrl(weaponId) {
  if (weaponId === "LIGHTNING_STAFF") return canvasUrl(128, 176, (ctx, w, h) => {
    ctx.fillStyle = "#102028"; ctx.fillRect(0, 0, w, h);
    paintStaff(ctx, w, h);
  });
  if (weaponId === "DAGGERS") return canvasUrl(128, 176, (ctx, w, h) => {
    ctx.fillStyle = "#181410"; ctx.fillRect(0, 0, w, h);
    paintDaggers(ctx, w, h, 3);
  });
  if (weaponId === "CIGARETTE") return canvasUrl(128, 176, (ctx, w, h) => {
    ctx.fillStyle = "#201810"; ctx.fillRect(0, 0, w, h);
    paintCig(ctx, w, h);
  });
  return canvasUrl(128, 176, (ctx, w, h) => {
    ctx.fillStyle = "#201018"; ctx.fillRect(0, 0, w, h);
    paintSword(ctx, w, h);
  });
}
