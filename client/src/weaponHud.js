// Плоский FPS-HUD: рука отдельно, оружие — отдельный спрайт справа снизу.
// Оружие рисуется на канвасе как реалистичные силуэты (меч, посох, кинжалы, сигарета).

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
  ctx.fillStyle = "#c45a48";
  ctx.beginPath();
  ctx.moveTo(-28, 70); ctx.lineTo(36, 70); ctx.lineTo(22, 8); ctx.lineTo(-18, 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e07862";
  roundRect(ctx, -34, -38, 68, 52, 18); ctx.fill();
  ctx.fillStyle = "#f09078";
  const fingers = palmUp
    ? [[-28, -70, 14, 42], [-10, -78, 14, 48], [8, -76, 14, 46], [26, -64, 12, 38]]
    : [[-30, -72, 14, 44], [-12, -82, 15, 52], [8, -80, 14, 50], [26, -68, 13, 40]];
  for (const [x, y, fw, fh] of fingers) {
    roundRect(ctx, x, y, fw, fh, 7); ctx.fill();
  }
  ctx.fillStyle = "#d06855";
  roundRect(ctx, 22, -28, 22, 28, 10); ctx.fill();
  ctx.restore();
}

function paintSword(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w * 0.58, h * 0.62);
  ctx.rotate(-0.72);
  ctx.scale(w / 420, w / 420);

  // тень
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(8, 78, 42, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // клинок
  const blade = ctx.createLinearGradient(-22, -160, 28, 40);
  blade.addColorStop(0, "#f4f7fb");
  blade.addColorStop(0.18, "#d8e4f0");
  blade.addColorStop(0.45, "#9eb4c8");
  blade.addColorStop(0.72, "#6a7e92");
  blade.addColorStop(1, "#3a4450");
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(0, -168);
  ctx.quadraticCurveTo(14, -150, 16, -40);
  ctx.lineTo(14, 36);
  ctx.lineTo(-14, 36);
  ctx.lineTo(-15, -40);
  ctx.quadraticCurveTo(-10, -150, 0, -168);
  ctx.closePath();
  ctx.fill();

  // дол
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.moveTo(0, -150);
  ctx.lineTo(3.5, 28);
  ctx.lineTo(-3.5, 28);
  ctx.closePath();
  ctx.fill();

  // розовая звёздная грань
  const star = ctx.createLinearGradient(-8, -160, 10, 20);
  star.addColorStop(0, "rgba(255,255,255,0.0)");
  star.addColorStop(0.25, "rgba(255,120,190,0.35)");
  star.addColorStop(1, "rgba(180,20,80,0.15)");
  ctx.fillStyle = star;
  ctx.beginPath();
  ctx.moveTo(2, -160);
  ctx.lineTo(12, 30);
  ctx.lineTo(4, 30);
  ctx.closePath();
  ctx.fill();

  // гарда
  const guard = ctx.createLinearGradient(-40, 32, 40, 52);
  guard.addColorStop(0, "#6a4a18");
  guard.addColorStop(0.45, "#f0d060");
  guard.addColorStop(1, "#8a6018");
  ctx.fillStyle = guard;
  ctx.beginPath();
  ctx.moveTo(-38, 34);
  ctx.quadraticCurveTo(0, 22, 38, 34);
  ctx.lineTo(36, 48);
  ctx.quadraticCurveTo(0, 58, -36, 48);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff3c0";
  ctx.beginPath();
  ctx.arc(0, 40, 6, 0, Math.PI * 2);
  ctx.fill();

  // рукоять
  const grip = ctx.createLinearGradient(-12, 48, 12, 108);
  grip.addColorStop(0, "#3a1810");
  grip.addColorStop(0.4, "#8a3a28");
  grip.addColorStop(1, "#2a100c");
  ctx.fillStyle = grip;
  roundRect(ctx, -9, 46, 18, 58, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,200,160,0.25)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-8, 54 + i * 10);
    ctx.lineTo(8, 58 + i * 10);
    ctx.stroke();
  }

  // навершие
  ctx.fillStyle = "#d4a84a";
  ctx.beginPath();
  ctx.ellipse(0, 112, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff6ab8";
  ctx.beginPath();
  ctx.arc(0, 112, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintStaff(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w * 0.56, h * 0.58);
  ctx.rotate(-0.48);
  ctx.scale(w / 400, w / 400);

  const wood = ctx.createLinearGradient(-8, 130, 8, -90);
  wood.addColorStop(0, "#2a160c");
  wood.addColorStop(0.4, "#6a3a18");
  wood.addColorStop(0.7, "#a06830");
  wood.addColorStop(1, "#4a2810");
  ctx.strokeStyle = wood;
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(4, 128);
  ctx.quadraticCurveTo(-10, 40, 0, -70);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,210,150,0.25)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-2, 110);
  ctx.quadraticCurveTo(-8, 30, -3, -60);
  ctx.stroke();

  // обмотка
  ctx.strokeStyle = "#c8a050";
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-8, 18 + i * 14);
    ctx.lineTo(8, 24 + i * 14);
    ctx.stroke();
  }

  // кристалл
  ctx.save();
  ctx.translate(0, -92);
  ctx.shadowColor = "#44eeff";
  ctx.shadowBlur = 28;
  const gem = ctx.createLinearGradient(-20, -40, 20, 30);
  gem.addColorStop(0, "#ffffff");
  gem.addColorStop(0.25, "#b8ffff");
  gem.addColorStop(0.65, "#33ccee");
  gem.addColorStop(1, "#0a5a88");
  ctx.fillStyle = gem;
  ctx.beginPath();
  ctx.moveTo(0, -48);
  ctx.lineTo(18, -8);
  ctx.lineTo(10, 22);
  ctx.lineTo(-10, 22);
  ctx.lineTo(-18, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.moveTo(-6, -30);
  ctx.lineTo(-2, -8);
  ctx.lineTo(-10, -4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // металлическое гнездо
  ctx.fillStyle = "#c9a24a";
  ctx.beginPath();
  ctx.moveTo(-16, -74);
  ctx.lineTo(16, -74);
  ctx.lineTo(10, -58);
  ctx.lineTo(-10, -58);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintDaggers(ctx, w, h, n) {
  ctx.clearRect(0, 0, w, h);
  const count = Math.max(1, Math.min(10, n | 0));
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    ctx.save();
    ctx.translate(w * (0.30 + t * 0.40), h * (0.46 - Math.abs(t - 0.5) * 0.12));
    ctx.rotate(-0.95 + t * 0.55);
    ctx.scale(w / 480, w / 480);
    const blade = ctx.createLinearGradient(0, -70, 0, 10);
    blade.addColorStop(0, "#f2f6fa");
    blade.addColorStop(0.4, "#b8c4d0");
    blade.addColorStop(1, "#5a6874");
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(0, -72);
    ctx.lineTo(8, 6);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(-1.6, -64, 3.2, 62);
    ctx.fillStyle = "#d4b060";
    ctx.fillRect(-12, 4, 24, 7);
    const grip = ctx.createLinearGradient(-6, 10, 6, 42);
    grip.addColorStop(0, "#2a1410");
    grip.addColorStop(0.5, "#6a3020");
    grip.addColorStop(1, "#1a0c08");
    ctx.fillStyle = grip;
    roundRect(ctx, -5, 10, 10, 28, 3);
    ctx.fill();
    ctx.fillStyle = "#c89848";
    ctx.beginPath();
    ctx.arc(0, 42, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintCig(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w * 0.55, h * 0.58);
  ctx.rotate(-0.95);
  ctx.scale(w / 380, w / 380);
  const paper = ctx.createLinearGradient(-8, -50, 8, 40);
  paper.addColorStop(0, "#fff6e8");
  paper.addColorStop(1, "#d8c8a8");
  ctx.fillStyle = paper;
  roundRect(ctx, -7, -46, 14, 86, 3);
  ctx.fill();
  ctx.fillStyle = "#a05038";
  roundRect(ctx, -7, 24, 14, 16, 2);
  ctx.fill();
  ctx.fillStyle = "#cc3a2a";
  ctx.fillRect(-7, -46, 14, 9);
  ctx.fillStyle = "#ffaa44";
  ctx.shadowColor = "#ff6622";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, -48, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(190,190,190,0.4)";
  ctx.beginPath();
  ctx.ellipse(-2, -72, 9, 20, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(220,220,220,0.25)";
  ctx.beginPath();
  ctx.ellipse(6, -92, 12, 16, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const HAND_SPRITE = "/assets/hand-dd.png";

const CACHE = {};
export function hudSprite(kind, extra = 1) {
  if (kind === "hand" || kind === "handUp") return HAND_SPRITE;
  const key = kind + ":" + extra;
  if (CACHE[key]) return CACHE[key];
  let url;
  if (kind === "sword") url = canvasUrl(512, 640, paintSword);
  else if (kind === "staff") url = canvasUrl(512, 640, paintStaff);
  else if (kind === "daggers") url = canvasUrl(512, 640, (c, w, h) => paintDaggers(c, w, h, extra));
  else if (kind === "cig") url = canvasUrl(512, 640, paintCig);
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
