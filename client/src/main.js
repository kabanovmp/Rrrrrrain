import * as THREE from "three";
import { Client } from "colyseus.js";
import { NET, WORLD, HAND_TYPES, SPELLS, ENEMY_TYPES, ITEMS, COMBAT } from "@mhfps/shared";
import { setupHub, setupArena, disposeGroup, animateTorches, updateArenaPortal, getArenaPortalPos, setArenaPortalPosition, updateHubPortal, getHubPortalPos, animateDangerZones, createHubSlotMesh, makeSlotContent, createHubChestMesh, updateChestCount, updateHubAltar, setChestOpen } from "./world.js";
import { createEnemy3D, animateEnemy } from "./enemies3d.js";
import { createHandsGroup, animateHands, setSpellInHand, showHandDamage, fadeHandCracks } from "./hands3d.js";
import { createOtherPlayer, animateOtherPlayer } from "./otherplayer.js";
import { createPedestalMesh, animatePedestal } from "./pedestal.js";
import { FpsController } from "./controller.js";
import { initAudio, playSound, playSoundLoop, stopSoundLoop, setMasterVolume, getMasterVolume } from "./assets.js";

// ═══════════════════════════════════════════════════════════════════
// DOM
// ═══════════════════════════════════════════════════════════════════
const canvas = document.getElementById("canvas");
const menu = document.getElementById("menu");
const status = document.getElementById("status");
const crackHud = document.getElementById("hud-crack");
const deadHud = document.getElementById("dead");
const crosshair = document.getElementById("crosshair");

const radar = document.createElement("canvas");
radar.width = 400; radar.height = 60;
radar.style.cssText = "position:fixed;top:8px;left:50%;transform:translateX(-50%);pointer-events:none;z-index:15;";
document.body.appendChild(radar);
const rctx = radar.getContext("2d");

const dmgOverlay = document.createElement("div");
dmgOverlay.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:14;opacity:0;transition:opacity .3s;";
document.body.appendChild(dmgOverlay);
let dmgAngle = 0, dmgTimer = 0;

// HUD-подсказка (центр экрана)
const hintText = document.createElement("div");
hintText.style.cssText = "position:fixed;top:35%;left:50%;transform:translateX(-50%);color:#fff;text-shadow:0 0 8px #000;font-family:sans-serif;font-size:20px;padding:12px 18px;background:rgba(0,0,0,0.6);border-radius:8px;pointer-events:none;z-index:16;opacity:0;transition:opacity .3s;";
document.body.appendChild(hintText);
let hintTimer = 0;

// ── UI-панель инвентаря СУНДУКА ────────────────────────
const chestPanel = document.createElement("div");
chestPanel.id = "chestPanel";
chestPanel.style.cssText = [
  "position:fixed",
  "left:50%",
  "top:50%",
  "transform:translate(-50%,-50%)",
  "z-index:30",
  "display:none",
  "font-family:'Trebuchet MS',sans-serif",
  "background:linear-gradient(180deg,#2a1a10 0%,#1a0f08 100%)",
  "border:3px solid #6a4a28",
  "border-radius:10px",
  "box-shadow:0 0 40px rgba(255,170,50,0.5),inset 0 0 20px rgba(0,0,0,0.6)",
  "padding:18px 22px",
  "min-width:420px",
  "max-width:640px",
  "color:#f0d090",
].join(";");
chestPanel.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #6a4a28;">
    <div style="font-size:22px;font-weight:bold;letter-spacing:2px;text-shadow:0 0 8px rgba(255,170,50,0.6);">СУНДУК</div>
    <div id="chestCounter" style="font-size:14px;color:#d0b070;">0 / 12</div>
    <div id="chestClose" style="cursor:pointer;font-size:20px;color:#d0b070;padding:2px 10px;border:1px solid #6a4a28;border-radius:4px;">✕ ESC</div>
  </div>
  <div id="chestGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;"></div>
  <div style="margin-top:12px;font-size:12px;color:#8a7050;text-align:center;">Клик по ячейке — забрать. ESC или отойди — закрыть.</div>
`;
document.body.appendChild(chestPanel);
let openChestIndex = -1; // -1 = закрыт

// FIRE/ICE/BONE → визуальный ключ магии в ладони
function handTypeToVisual(ht) {
  return ({ FIRE: "fireball", ICE: "ice", BONE: "bone", CHAIN: "chain" })[ht] || "fireball";
}

// ── Панель снаряжения (TAB, hold) ────────────────────
const loadoutPanel = document.createElement("div");
loadoutPanel.id = "loadoutPanel";
loadoutPanel.style.cssText = [
  "position:fixed", "left:50%", "top:50%", "transform:translate(-50%,-50%)",
  "z-index:29", "display:none", "font-family:'Trebuchet MS',sans-serif",
  "background:linear-gradient(180deg,#1a1210 0%,#0b0806 100%)",
  "border:3px solid #6a4a28", "border-radius:10px",
  "box-shadow:0 0 40px rgba(255,170,50,0.4),inset 0 0 20px rgba(0,0,0,0.6)",
  "padding:18px 24px", "min-width:560px", "color:#f0d090",
].join(";");
loadoutPanel.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #6a4a28;">
    <div style="font-size:22px;font-weight:bold;letter-spacing:2px;text-shadow:0 0 8px rgba(255,170,50,0.6);">СНАРЯЖЕНИЕ</div>
    <div id="loadoutHp" style="font-size:16px;color:#e0c090;">HP: –</div>
    <div style="font-size:12px;color:#8a7050;">держи TAB</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div id="lpHands"></div>
    <div id="lpPassives"></div>
  </div>
`;
document.body.appendChild(loadoutPanel);
let loadoutOpen = false;
function showLoadoutPanel() {
  if (loadoutOpen) return;
  loadoutOpen = true;
  loadoutPanel.style.display = "block";
  renderLoadoutPanel();
}
function hideLoadoutPanel() {
  loadoutOpen = false;
  loadoutPanel.style.display = "none";
}
function handTypeName(ht) {
  return ({ FIRE: "Огненная", ICE: "Ледяная", BONE: "Костяная", CHAIN: "Грозовая" })[ht] || "—";
}
function handTypeColorHex(ht) {
  return ({ FIRE: "#ff5522", ICE: "#66ccff", BONE: "#d0c0a0", CHAIN: "#9be7ff" })[ht] || "#8a7050";
}
function spellName(ht) {
  return ({ FIRE: "Fireball", ICE: "Icebolt", BONE: "Bone Shard", CHAIN: "Chain Lightning" })[ht] || "—";
}
function itemInfo(id) {
  const it = ITEMS.find(x => x.id === id);
  if (!it) return { name: id || "—", effect: "—", color: "#8a7050", glyph: "?" };
  return { name: it.name || it.id, effect: it.effect || "—",
           color: "#" + (it.color || 0x8a7050).toString(16).padStart(6, "0"),
           glyph: it.glyph || "?" };
}
function handSlotHtml(label, ht) {
  const empty = !ht;
  const color = handTypeColorHex(ht);
  return `<div style="background:linear-gradient(180deg,#1a0f08,#0a0503);border:2px solid #3a2818;border-radius:8px;padding:10px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:center;${empty?"opacity:0.55;":"box-shadow:inset 0 0 10px " + color + "33;"}">
    <div style="width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 40% 40%, ${color}, #000);box-shadow:0 0 12px ${color}80;"></div>
    <div style="flex:1;">
      <div style="font-size:11px;color:#8a7050;letter-spacing:1px;">${label}</div>
      <div style="font-size:16px;color:${empty?"#666":color};font-weight:bold;">${empty?"Пусто":handTypeName(ht)}</div>
      <div style="font-size:12px;color:#c0a070;">${empty?"":spellName(ht)}</div>
    </div>
  </div>`;
}
function passiveSlotHtml(id, isSpare = false) {
  const empty = !id;
  const info = itemInfo(id);
  return `<div style="background:linear-gradient(180deg,#1a0f08,#0a0503);border:2px solid ${empty?"#3a2818":info.color};border-radius:8px;padding:10px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:center;${empty?"opacity:0.55;":""}">
    <div style="width:44px;height:44px;border-radius:8px;background:${empty?"#1a0f08":info.color+"33"};border:1px solid ${info.color};display:flex;align-items:center;justify-content:center;color:${info.color};font-size:24px;">${empty?"":info.glyph}</div>
    <div style="flex:1;">
      <div style="font-size:11px;color:#8a7050;letter-spacing:1px;">${isSpare?"ЗАПАС":"ПАССИВ (надето)"}</div>
      <div style="font-size:16px;color:${empty?"#666":info.color};font-weight:bold;">${empty?"Пусто":info.name}</div>
      <div style="font-size:12px;color:#c0a070;">${empty?"":info.effect}</div>
    </div>
  </div>`;
}
function renderLoadoutPanel() {
  if (!myPlayer) return;
  const hpEl = document.getElementById("loadoutHp");
  hpEl.textContent = `HP: ${myPlayer.hp}/${myPlayer.maxHp || 3}` + (myPlayer.isGhost ? "  • ПРИЗРАК" : "");
  const hands = document.getElementById("lpHands");
  const legHtml = `<div style="background:linear-gradient(180deg,#1a0f08,#0a0503);border:2px solid #3a2818;border-radius:8px;padding:10px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:center;${myPlayer.hasLegs>0?"box-shadow:inset 0 0 10px #66ff9933;":"opacity:0.55;"}">
    <div style="width:44px;height:44px;border-radius:6px;background:#0a1a10;border:1px solid #66ff99;color:#66ff99;display:flex;align-items:center;justify-content:center;font-size:22px;">⚚</div>
    <div style="flex:1;"><div style="font-size:11px;color:#8a7050;letter-spacing:1px;">НОГИ</div>
      <div style="font-size:16px;color:${myPlayer.hasLegs>0?"#66ff99":"#666"};font-weight:bold;">${myPlayer.hasLegs}/2</div>
      <div style="font-size:12px;color:#c0a070;">Скорость бега</div></div>
  </div>`;
  hands.innerHTML =
    handSlotHtml("ЛЕВАЯ РУКА", myPlayer.hasLeftHand ? myPlayer.leftHandType : "") +
    handSlotHtml("ПРАВАЯ РУКА", myPlayer.hasRightHand ? myPlayer.rightHandType : "") +
    legHtml;
  const passives = document.getElementById("lpPassives");
  let html = passiveSlotHtml(myPlayer.passiveItemId || "");
  const spares = [...(myPlayer.itemsInBody || [])];
  if (spares.length === 0) {
    html += passiveSlotHtml("", true);
  } else {
    spares.forEach(id => { html += passiveSlotHtml(id, true); });
  }
  passives.innerHTML = html;
}

// Чат (внизу слева)
const chatBox = document.createElement("div");
chatBox.style.cssText = "position:fixed;left:12px;bottom:60px;width:420px;max-height:200px;overflow:hidden;pointer-events:none;z-index:15;display:flex;flex-direction:column;justify-content:flex-end;font-family:sans-serif;font-size:14px;";
document.body.appendChild(chatBox);

const chatInput = document.createElement("input");
chatInput.type = "text";
chatInput.maxLength = 200;
chatInput.placeholder = "сообщение...";
chatInput.style.cssText = "position:fixed;left:12px;bottom:20px;width:420px;padding:8px 10px;background:rgba(0,0,0,0.75);border:1px solid #555;color:#fff;font-family:sans-serif;font-size:14px;outline:none;z-index:20;display:none;";
document.body.appendChild(chatInput);
chatInput.addEventListener("keydown", (ev) => {
  ev.stopPropagation(); // чтобы канвас-листенер не ловил W/A/S/D
  if (ev.code === "Enter") {
    const text = chatInput.value.trim();
    if (text && room) room.send("chat", { text });
    chatInput.value = "";
    chatInput.style.display = "none";
    chatInput.blur();
    chatOpen = false;
    ev.preventDefault();
    return;
  }
  if (ev.code === "Escape") {
    chatInput.value = "";
    chatInput.style.display = "none";
    chatInput.blur();
    chatOpen = false;
    ev.preventDefault();
  }
});

let chatOpen = false;
// Escape в чат-инпуте закрывает без отправки
// (иначе pointerlock перехватывает и мы в лимбе)
function addChatMessage(name, text, self = false) {
  const line = document.createElement("div");
  line.style.cssText = "padding:4px 8px;margin-top:2px;background:rgba(0,0,0,0.55);color:#fff;text-shadow:0 0 4px #000;border-radius:4px;word-wrap:break-word;";
  line.innerHTML = `<span style="color:${self ? '#ffaa44' : '#66ccff'};font-weight:bold">${escapeHtml(name)}:</span> ${escapeHtml(text)}`;
  chatBox.appendChild(line);
  // Авто-удаление через 10 секунд
  setTimeout(() => {
    line.style.transition = "opacity 1s";
    line.style.opacity = "0";
    setTimeout(() => line.remove(), 1000);
  }, 10000);
  // Ограничение на число видимых
  while (chatBox.children.length > 10) chatBox.children[0].remove();
}
// ── ДЕБАГ-ПАНЕЛЬ ──────────────────────────────────────
const debugPanel = document.getElementById("debug-panel");
let debugOpen = false;
function toggleDebugPanel() {
  debugOpen = !debugOpen;
  debugPanel.style.display = debugOpen ? "block" : "none";
  if (debugOpen) { if (window.controller?.releasePointer) window.controller.releasePointer(); }
  else { if (window.controller?.enable) window.controller.enable(); }
}
function sendDebug(payload) {
  if (window.room) window.room.send("debug", payload);
}
// Привязка обработчиков (после DOMContentLoaded — но HTML уже в памяти)
(function initDebugPanel() {
  const god = document.getElementById("dbg-god");
  const ammo = document.getElementById("dbg-ammo");
  const speed = document.getElementById("dbg-speed");
  const dmg = document.getElementById("dbg-dmg");
  const spawn = document.getElementById("dbg-spawn");
  if (!god) return;
  god.addEventListener("change", () => sendDebug({ god: god.checked }));
  ammo.addEventListener("change", () => sendDebug({ infAmmo: ammo.checked }));
  speed.addEventListener("input", () => {
    document.getElementById("dbg-speed-v").textContent = speed.value;
    sendDebug({ speedMul: parseFloat(speed.value) });
  });
  dmg.addEventListener("input", () => {
    document.getElementById("dbg-dmg-v").textContent = dmg.value;
    sendDebug({ damageMul: parseFloat(dmg.value) });
  });
  spawn.addEventListener("input", () => {
    document.getElementById("dbg-spawn-v").textContent = spawn.value;
    sendDebug({ spawnMul: parseFloat(spawn.value) });
  });
  // Ползунок громкости — локальный, без синхрона
  const vol = document.getElementById("dbg-vol");
  const volV = document.getElementById("dbg-vol-v");
  if (vol && volV) {
    const cur = Math.round(getMasterVolume() * 100);
    vol.value = String(cur);
    volV.textContent = String(cur);
    vol.addEventListener("input", () => {
      const v = parseInt(vol.value, 10) / 100;
      volV.textContent = String(vol.value);
      setMasterVolume(v);
    });
  }
  document.querySelectorAll(".dbg-btn").forEach(b => {
    b.addEventListener("click", () => {
      if (b.dataset.giveHand && b.dataset.giveType) {
        sendDebug({ action: "giveWeapon", hand: b.dataset.giveHand, type: b.dataset.giveType });
      } else if (b.dataset.act) {
        sendDebug({ action: b.dataset.act });
      }
    });
  });
  const fly = document.getElementById("dbg-fly");
  if (fly) fly.addEventListener("change", () => sendDebug({ fly: fly.checked }));
  // Локальные ползунки: дальность и пикселизация
  const far = document.getElementById("dbg-far");
  const farV = document.getElementById("dbg-far-v");
  if (far && farV) {
    const savedFar = parseInt(localStorage.getItem("rain_far") || "500", 10);
    far.value = String(savedFar); farV.textContent = String(savedFar);
    if (window.__setRenderFar) window.__setRenderFar(savedFar);
    far.addEventListener("input", () => {
      const v = parseInt(far.value, 10);
      farV.textContent = String(v);
      localStorage.setItem("rain_far", String(v));
      if (window.__setRenderFar) window.__setRenderFar(v);
    });
  }
  const pix = document.getElementById("dbg-pix");
  const pixV = document.getElementById("dbg-pix-v");
  if (pix && pixV) {
    const savedPix = parseInt(localStorage.getItem("rain_pix") || "1", 10);
    pix.value = String(savedPix); pixV.textContent = String(savedPix);
    if (window.__setPixelScale) window.__setPixelScale(savedPix);
    pix.addEventListener("input", () => {
      const v = parseInt(pix.value, 10);
      pixV.textContent = String(v);
      localStorage.setItem("rain_pix", String(v));
      if (window.__setPixelScale) window.__setPixelScale(v);
    });
  }
})();

// ==== HUD: HP-бар, damage numbers, cooldown-индикаторы ====
function updateHpBar(hp, maxHp) {
  const fill = document.getElementById("hp-fill");
  const text = document.getElementById("hp-text");
  if (!fill || !text) return;
  const pct = Math.max(0, Math.min(1, hp / (maxHp || 1)));
  fill.style.width = (pct * 100).toFixed(1) + "%";
  text.textContent = `${hp} / ${maxHp}`;
  // Зелёный → жёлтый → красный
  if (pct > 0.6) fill.style.background = "linear-gradient(90deg, #4bd85a, #7fd83a)";
  else if (pct > 0.3) fill.style.background = "linear-gradient(90deg, #d8b03a, #d87f3a)";
  else fill.style.background = "linear-gradient(90deg, #d83a3a, #d85a5a)";
}
function spawnScreenDmgNumber(amount, isCrit) {
  const wrap = document.getElementById("dmg-numbers");
  if (!wrap) return;
  const el = document.createElement("div");
  el.className = "dmg-num";
  el.textContent = "-" + Math.round(amount);
  el.style.color = isCrit ? "#ffaa22" : "#ff5555";
  el.style.left = (window.innerWidth / 2 + (Math.random() - 0.5) * 200) + "px";
  el.style.top = (window.innerHeight / 2 + 40) + "px";
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}
// Мировые damage numbers (над врагом) — проецируем 3D-координату на экран
function spawnWorldDmgNumber(worldPos, amount) {
  const wrap = document.getElementById("dmg-numbers");
  if (!wrap) return;
  const v = worldPos.clone().project(camera);
  if (v.z > 1) return; // за камерой
  const el = document.createElement("div");
  el.className = "dmg-num";
  el.textContent = String(Math.round(amount));
  el.style.color = "#ffee66";
  el.style.fontSize = "16px";
  el.style.left = ((v.x + 1) / 2 * window.innerWidth + (Math.random() - 0.5) * 30) + "px";
  el.style.top = ((1 - v.y) / 2 * window.innerHeight + (Math.random() - 0.5) * 20) + "px";
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}
// Кулдаун-индикаторы (вызываем в каждом кадре)
let cdLeftEndMs = 0, cdRightEndMs = 0, cdLeftDurMs = 250, cdRightDurMs = 250;
function startCooldown(hand, durMs) {
  if (hand === "left") { cdLeftEndMs = performance.now() + durMs; cdLeftDurMs = durMs; }
  else { cdRightEndMs = performance.now() + durMs; cdRightDurMs = durMs; }
}
function updateCooldownHud() {
  const now = performance.now();
  const l = document.querySelector("#cd-left .fill");
  const r = document.querySelector("#cd-right .fill");
  if (l) {
    const rem = Math.max(0, cdLeftEndMs - now);
    l.style.height = (rem / cdLeftDurMs * 100).toFixed(0) + "%";
  }
  if (r) {
    const rem = Math.max(0, cdRightEndMs - now);
    r.style.height = (rem / cdRightDurMs * 100).toFixed(0) + "%";
  }
}
// Синхронизация панели с серверным состоянием (вызвать после подключения)
function syncDebugPanelFromState(state) {
  const g = document.getElementById("dbg-god"); if (g) g.checked = !!state.dbgGodMode;
  const a = document.getElementById("dbg-ammo"); if (a) a.checked = !!state.dbgInfiniteAmmo;
  const sp = document.getElementById("dbg-speed"); if (sp && state.dbgSpeedMul) { sp.value = state.dbgSpeedMul; document.getElementById("dbg-speed-v").textContent = state.dbgSpeedMul; }
  const dm = document.getElementById("dbg-dmg"); if (dm && state.dbgDamageMul) { dm.value = state.dbgDamageMul; document.getElementById("dbg-dmg-v").textContent = state.dbgDamageMul; }
  const sw = document.getElementById("dbg-spawn"); if (sw && state.dbgSpawnMul != null) { sw.value = state.dbgSpawnMul; document.getElementById("dbg-spawn-v").textContent = state.dbgSpawnMul; }
  const fl = document.getElementById("dbg-fly"); if (fl) fl.checked = !!state.dbgFly;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ═══════════════════════════════════════════════════════════════════
// РЕНДЕР
// ═══════════════════════════════════════════════════════════════════
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setClearColor(0x1a2030);

const scene = new THREE.Scene();
// Без тумана — чтобы было видно всё.
// Общее яркое освещение в самой scene (не в группах), чтобы всё гарантированно освещалось.
scene.add(new THREE.AmbientLight(0xffffff, 1.4));
const globalHemi = new THREE.HemisphereLight(0xffffff, 0x776655, 1.2);
scene.add(globalHemi);

// FOV 70 — стандарт для FPS. 85 было слишком широко, искажало края.
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 500);

// ПИКСЕЛИЗАЦИЯ (Devil Daggers-style): рендер в low-res рендер-таргет + upscale NEAREST
let pixelScale = 1; // 1 = отключено
let rtLowRes = null;
let postScene = null, postCamera = null, postMesh = null;
function ensurePostFx() {
  if (postScene) return;
  postScene = new THREE.Scene();
  postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false });
  postMesh = new THREE.Mesh(geo, mat);
  postScene.add(postMesh);
}
function resizeLowResRT() {
  const w = Math.max(80, Math.floor(window.innerWidth / pixelScale));
  const h = Math.max(60, Math.floor(window.innerHeight / pixelScale));
  if (rtLowRes) rtLowRes.dispose();
  rtLowRes = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false,
  });
  if (postMesh) postMesh.material.map = rtLowRes.texture;
}
window.__setPixelScale = (v) => {
  pixelScale = Math.max(1, parseInt(v, 10) || 1);
  if (pixelScale > 1) { ensurePostFx(); resizeLowResRT(); }
};
window.__setRenderFar = (v) => {
  camera.far = Math.max(50, parseInt(v, 10) || 500);
  camera.updateProjectionMatrix();
};

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if (pixelScale > 1) resizeLowResRT();
});
renderer.setSize(window.innerWidth, window.innerHeight, false);

// ── Разные сцены для хаба/арены (отдельные пространства) ────────
const hubGroup = new THREE.Group();
const arenaGroup = new THREE.Group();
// Хаб парит "в космосе" — можно сместить по Y для отдельности
scene.add(hubGroup, arenaGroup);
setupHub(hubGroup);
setupArena(arenaGroup);
arenaGroup.visible = false;

// ── Руки: детальные 3D-модели ────────────────────────────────────
const handsRoot = createHandsGroup();
camera.add(handsRoot);
scene.add(camera);
// Руки видны всегда (базовые голые ладони), пикапы добавляют заклинания
handsRoot.userData.leftHand.visible = true;
handsRoot.userData.rightHand.visible = true;

// Диагностика mac Chrome: логируем ключевые параметры в консоль
console.log("[rrain diag]",
  "DPR:", window.devicePixelRatio,
  "innerSize:", window.innerWidth + "x" + window.innerHeight,
  "canvas:", canvas.width + "x" + canvas.height,
  "UA:", navigator.userAgent);
// GL renderer info — важно для Mac (SwiftShader/ANGLE bug)
try {
  const gl = renderer.getContext();
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  if (dbg) console.log("[rrain diag] GPU:", gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
} catch {}

// ═══════════════════════════════════════════════════════════════════
// ХРАНИЛИЩА МЕШЕЙ
// ═══════════════════════════════════════════════════════════════════
// Враги: {mesh, targetX, targetY, targetZ, prevX, prevZ}
const enemyMeshes = new Map();

// Другие игроки: {mesh, targetX, targetY, targetZ, targetYaw, prevX, prevZ}
const otherPlayers = new Map();
let colorIdxCounter = 0;

// Пикапы = пьедесталы
const pickupMeshes = new Map();
function makePickupMesh(pk) {
  // Определяем визуальный тип
  if (pk.kind === "HAND") {
    const spellType = ({ FIRE: "fireball", ICE: "ice", BONE: "bone", CHAIN: "chain" })[pk.handType] || "fireball";
    return createPedestalMesh("HAND", spellType);
  }
  if (pk.kind === "LEG") return createPedestalMesh("LEG", "chain");
  if (pk.kind === "ITEM") return createPedestalMesh("ACCESSORY", "bone");
  return createPedestalMesh("HAND", "fireball");
}


// ── Хабовое хранилище: 3D-меши слотов/сундуков ─────────
const hubSlotMeshes = [];   // index → group
const hubChestMeshes = [];  // index → group
let hubStorageInitDone = false;

function ensureHubStorageInit() {
  if (hubStorageInitDone || !room || !room.state) return;
  const slots = room.state.hubSlots;
  const chests = room.state.hubChests;
  if (!slots || !chests || slots.length === 0 || chests.length === 0) return;
  slots.forEach((s, i) => {
    const g = createHubSlotMesh();
    g.position.set(s.pos.x, 0, s.pos.z);
    hubGroup.add(g);
    hubSlotMeshes[i] = g;
    refreshSlotContent(i, s);
    if (typeof s.onChange === "function") s.onChange(() => refreshSlotContent(i, s));
  });
  chests.forEach((c, i) => {
    const g = createHubChestMesh();
    g.position.set(c.pos.x, 0, c.pos.z);
    hubGroup.add(g);
    hubChestMeshes[i] = g;
    updateChestCount(g, c.contents.length);
    if (c.contents && typeof c.contents.onChange === "function") {
      c.contents.onChange(() => updateChestCount(g, c.contents.length));
    }
    if (c.contents && typeof c.contents.onAdd === "function") {
      c.contents.onAdd(() => updateChestCount(g, c.contents.length));
    }
    if (c.contents && typeof c.contents.onRemove === "function") {
      c.contents.onRemove(() => updateChestCount(g, c.contents.length));
    }
  });
  hubStorageInitDone = true;
}

function refreshSlotContent(i, s) {
  const g = hubSlotMeshes[i];
  if (!g) return;
  const mount = g.userData.contentMount;
  while (mount.children.length) {
    const c = mount.children[0];
    mount.remove(c); disposeGroup(c);
  }
  if (!s.empty) {
    const content = makeSlotContent(s.kind, s.handType);
    mount.add(content);
    g.userData.emptyRing.material.opacity = 0.15;
  } else {
    g.userData.emptyRing.material.opacity = 0.35;
  }
}

// FX — все fx-меши используют общие (shared) geometry, а материалы клонируются с одного базового шаблона.
// Это убирает GC-спайки при массовых попаданиях (главная причина 0 FPS).
const shots = [];
const MAX_SHOT_FX = 120;                // жёсткий потолок; старые выбрасываются
const FX_GEOM = {
  sphereSmall: new THREE.SphereGeometry(0.35, 8, 6),
  sphereHalo:  new THREE.SphereGeometry(0.8, 8, 6),
  sphereFlash: new THREE.SphereGeometry(0.6, 10, 6),
  sphereChip:  new THREE.SphereGeometry(0.09, 5, 3),
  ringShot:    new THREE.RingGeometry(0.3, 0.8, 12),
  ringSmoke:   new THREE.RingGeometry(0.2, 1.2, 16),
  ringWave:    new THREE.RingGeometry(0.2, 1.0, 20),
  // Кристаллический ледяной шип (ICE)
  iceShard:    new THREE.OctahedronGeometry(0.45, 0),
  // Наконечник костяной молнии (BONE) — маленькая головка
  boneHead:    new THREE.ConeGeometry(0.25, 0.6, 6),
};
const FX_MAT_TPL = {
  basic:  new THREE.MeshBasicMaterial({ color: 0xffffff }),
  halo:   new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }),
  ring:   new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  chip:   new THREE.MeshBasicMaterial({ color: 0x992222 }),
  flash:  new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.9 }),
  smoke:  new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  wave:   new THREE.MeshBasicMaterial({ color: 0xa080ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
};
function pushShot(entry) {
  shots.push(entry);
  // Лимит: если переполнили — старейший убираем немедленно
  if (shots.length > MAX_SHOT_FX) {
    const old = shots.shift();
    if (old && old.mesh) {
      scene.remove(old.mesh);
      if (old.mesh.userData && old.mesh.userData.disposeExtras) old.mesh.userData.disposeExtras();
      // материал клон, geometry общая — диспозим только материал
      disposeMatOnly(old.mesh);
    }
  }
}
function disposeMatOnly(obj) {
  obj.traverse?.(o => {
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(mt => mt.dispose?.());
      else o.material.dispose?.();
    }
  });
  if (obj.material && !obj.traverse) {
    if (Array.isArray(obj.material)) obj.material.forEach(mt => mt.dispose?.());
    else obj.material.dispose?.();
  }
}
// Цвета из SPELLS: FIRE=0xff5a1f, ICE=0x66ccff, BONE=0xffe0a0.
// Разветвляем визуал по цвету, чтобы не менять протокол.
function spawnShotFx(x, y, z, color, dx = 0, dy = 0, dz = 0) {
  const speed = 40;
  const vx = dx * speed, vy = dy * speed, vz = dz * speed;
  if (color === 0x66ccff) {
    spawnIceShardFx(x, y, z, color, vx, vy, vz);
  } else if (color === 0xffe0a0) {
    spawnLightningFx(x, y, z, color, vx, vy, vz);
  } else {
    spawnFireballFx(x, y, z, color, vx, vy, vz);
  }
  // Общее кольцо вспышки в точке каста (остаётся)
  const matRing = FX_MAT_TPL.ring.clone(); matRing.color.setHex(color);
  const ring = new THREE.Mesh(FX_GEOM.ringShot, matRing);
  ring.position.set(x, y, z);
  ring.lookAt(camera.position);
  scene.add(ring);
  pushShot({ mesh: ring, ttl: 0.25, maxTtl: 0.25, vx: 0, vy: 0, vz: 0 });
}

// ── FIRE: шар с ореолом (было раньше)
function spawnFireballFx(x, y, z, color, vx, vy, vz) {
  const matBody = FX_MAT_TPL.basic.clone(); matBody.color.setHex(color);
  const m = new THREE.Mesh(FX_GEOM.sphereSmall, matBody);
  m.position.set(x, y, z);
  const matHalo = FX_MAT_TPL.halo.clone(); matHalo.color.setHex(color);
  const halo = new THREE.Mesh(FX_GEOM.sphereHalo, matHalo);
  m.add(halo);
  scene.add(m);
  pushShot({ mesh: m, ttl: 1.2, maxTtl: 1.2, vx, vy, vz });
}

// ── ICE: вращающийся кристаллический шип с бледным свечением
function spawnIceShardFx(x, y, z, color, vx, vy, vz) {
  const mat = FX_MAT_TPL.basic.clone(); mat.color.setHex(0xffffff);
  const m = new THREE.Mesh(FX_GEOM.iceShard, mat);
  m.position.set(x, y, z);
  // цветной halo вокруг
  const haloMat = FX_MAT_TPL.halo.clone(); haloMat.color.setHex(color);
  const halo = new THREE.Mesh(FX_GEOM.sphereHalo, haloMat);
  halo.scale.setScalar(0.7);
  m.add(halo);
  scene.add(m);
  pushShot({ mesh: m, ttl: 1.2, maxTtl: 1.2, vx, vy, vz, spin: 8 });
}

// ── BONE: конус-головка + зигзаг-хвост (молния)
// Хвост — одна общая BufferGeometry на каждый выстрел (маленькая), материал общий клонируемый
function spawnLightningFx(x, y, z, color, vx, vy, vz) {
  // головка
  const headMat = FX_MAT_TPL.basic.clone(); headMat.color.setHex(color);
  const head = new THREE.Mesh(FX_GEOM.boneHead, headMat);
  head.position.set(x, y, z);
  // ориентируем конус по направлению полёта
  const dirLen = Math.hypot(vx, vy, vz) || 1;
  head.lookAt(x + vx / dirLen, y + vy / dirLen, z + vz / dirLen);
  head.rotateX(Math.PI / 2); // конус по-умолчанию вверх — повернем
  scene.add(head);
  pushShot({ mesh: head, ttl: 1.5, maxTtl: 1.5, vx, vy, vz });

  // зигзаг-луч позади головки (короткий хвост, быстро гаснет)
  const segs = 6;
  const pts = new Float32Array(segs * 3);
  const nx = -vx / dirLen, ny = -vy / dirLen, nz = -vz / dirLen;
  const perpAx = ny, perpAy = -nx, perpAz = 0; // примерный перпендикуляр
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const dist = t * 2.2; // общая длина хвоста
    const wob = i === 0 || i === segs - 1 ? 0 : (Math.random() - 0.5) * 0.55;
    pts[i * 3    ] = nx * dist + perpAx * wob;
    pts[i * 3 + 1] = ny * dist + perpAy * wob;
    pts[i * 3 + 2] = nz * dist + perpAz * wob;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, linewidth: 2 });
  const line = new THREE.Line(geo, lineMat);
  head.add(line); // зигзаг двигается вместе с головкой
  // аккуратный dispose — для line geometry уникальна, привязана к head.userData
  head.userData.disposeExtras = () => { geo.dispose(); lineMat.dispose(); };
}
// ЦЕПНАЯ МОЛНИЯ: ломаная линия через точки (от игрока через всех врагов в цепи)
function spawnChainLightningFx(points, color) {
  if (!points || points.length < 2) return;
  // Сегменты между соседними точками — каждый с лёгким зигзагом
  const allPts = [];
  const segsPerJump = 5;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y + 0.6, dz = b.z - a.z; // поднимаем к голове
    const len = Math.hypot(dx, dy, dz) || 1;
    const px = -dz / len, py = 0, pz = dx / len; // перпендикуляр
    for (let s = 0; s <= segsPerJump; s++) {
      const t = s / segsPerJump;
      const wob = (s === 0 || s === segsPerJump) ? 0 : (Math.random() - 0.5) * 0.8;
      allPts.push(
        a.x + dx * t + px * wob,
        a.y + 0.6 + (dy - 0.6) * t + py * wob,
        a.z + dz * t + pz * wob
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(allPts), 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1.0, linewidth: 3 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  pushShot({
    mesh: line, ttl: 0.35, maxTtl: 0.35, vx: 0, vy: 0, vz: 0,
    disposeExtras: () => { geo.dispose(); mat.dispose(); },
  });
  // Вспышки в каждой точке цепи (враге — где ударило)
  for (let i = 1; i < points.length; i++) {
    const matF = FX_MAT_TPL.flash.clone(); matF.color.setHex(color);
    const flash = new THREE.Mesh(FX_GEOM.sphereFlash, matF);
    flash.position.set(points[i].x, points[i].y + 0.6, points[i].z);
    flash.scale.setScalar(0.5);
    scene.add(flash);
    pushShot({ mesh: flash, ttl: 0.25, maxTtl: 0.25, vx: 0, vy: 0, vz: 0 });
  }
}

// Эффект смерти: общая geometry, меньше частиц
function spawnDeathBurst(x, y, z, kind) {
  const isColossus = kind === "COLOSSUS";
  const scale = isColossus ? 2.6 : 1;
  const flash = new THREE.Mesh(FX_GEOM.sphereFlash, FX_MAT_TPL.flash.clone());
  flash.position.set(x, y, z); flash.scale.setScalar(scale);
  scene.add(flash);
  pushShot({ mesh: flash, ttl: 0.35, maxTtl: 0.35, vx: 0, vy: 0, vz: 0 });
  const cnt = isColossus ? 8 : 4;
  for (let i = 0; i < cnt; i++) {
    const c = new THREE.Mesh(FX_GEOM.sphereChip, FX_MAT_TPL.chip.clone());
    c.position.set(x, y, z); c.scale.setScalar(scale);
    const a = Math.random() * Math.PI * 2;
    const s = 2 + Math.random() * 4;
    const vy = 1.5 + Math.random() * 3;
    scene.add(c);
    pushShot({
      mesh: c, ttl: 0.9, maxTtl: 0.9,
      vx: Math.cos(a) * s, vy, vz: Math.sin(a) * s, gravity: 6,
    });
  }
  const smoke = new THREE.Mesh(FX_GEOM.ringSmoke, FX_MAT_TPL.smoke.clone());
  smoke.position.set(x, y + 0.05, z); smoke.scale.setScalar(scale);
  smoke.rotation.x = -Math.PI / 2;
  scene.add(smoke);
  pushShot({ mesh: smoke, ttl: 1.1, maxTtl: 1.1, vx: 0, vy: 0.4, vz: 0 });
}

function spawnWaveFx(x, y, z, r) {
  const m = new THREE.Mesh(FX_GEOM.ringWave, FX_MAT_TPL.wave.clone());
  m.position.set(x, y, z); m.scale.setScalar(r / 1.0);
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  shots.push({ mesh: m, ttl: 0.8, maxTtl: 0.8, vx: 0, vy: 0, vz: 0 });
}

// ═══════════════════════════════════════════════════════════════════
// КОНТРОЛЛЕР, СЕТЬ
// ═══════════════════════════════════════════════════════════════════
const controller = new FpsController(camera, canvas);
window.controller = controller;

// Надёжный выход из Pointer Lock — чтобы курсор не пропадал во всём браузере
function safeExitPointerLock() {
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch {}
}
window.addEventListener("blur", safeExitPointerLock);
window.addEventListener("beforeunload", safeExitPointerLock);
window.addEventListener("pagehide", safeExitPointerLock);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") safeExitPointerLock();
});
// Escape всегда отпускает курсор
document.addEventListener("keydown", (e) => {
  if (e.code === "Escape") safeExitPointerLock();
}, true);
let client, room, selfId, myPlayer = null, lastHpSeen = 3;
let deathTimer = 0;
let ambientLoop = null;
let footstepTimer = 0;

// Сохранённый ник
const savedName = localStorage.getItem("rrrrrrain_name");
if (savedName) document.getElementById("name").value = savedName;

document.getElementById("play").addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim() || "sgustok";
  localStorage.setItem("rrrrrrain_name", name);
  const url  = document.getElementById("server").value.trim();
  try {
    initAudio(); // разбудить AudioContext сразу после клика
    client = new Client(url);
    room = await client.joinOrCreate(NET.ROOM_NAME, { name });
    window.room = room;
    // Панель синхронизируется при первом получении состояния
    room.onStateChange.once((state) => syncDebugPanelFromState(state));
    // Обновления тоже маппать
    room.onStateChange((state) => { if (!debugOpen) syncDebugPanelFromState(state); });
    selfId = room.sessionId;
    menu.style.display = "none";
    crosshair.style.display = "block";
    controller.enable();
    setupRoomHandlers();
    setInterval(sendInput, 1000 / NET.PLAYER_SEND_HZ);
  } catch (e) {
    console.error(e);
    status.textContent = "не удалось подключиться: " + (e?.message || e);
  }
});

function setupRoomHandlers() {
  room.state.players.onAdd((p, id) => {
    if (id === selfId) {
      myPlayer = p;
    } else {
      // Другой игрок — создаём модель.
      // Сервер шлёт pos.y = 1.6 (центр камеры), а модель рисуется от ног (Y=0).
      // Поэтому опускаем на 1.6.
      const otherMesh = createOtherPlayer(p.name || "player", colorIdxCounter++);
      otherMesh.position.set(p.pos.x, p.pos.y - 1.6, p.pos.z);
      scene.add(otherMesh);
      const entry = {
        mesh: otherMesh, targetX: p.pos.x, targetY: p.pos.y - 1.6, targetZ: p.pos.z,
        targetYaw: p.yaw || 0, prevX: p.pos.x, prevZ: p.pos.z, moving: false,
      };
      otherPlayers.set(id, entry);
      p.onChange(() => {
        entry.targetX = p.pos.x;
        entry.targetY = p.pos.y - 1.6;
        entry.targetZ = p.pos.z;
        entry.targetYaw = p.yaw || 0;
      });
    }

    p.onChange(() => {
      if (id === selfId) {
        // Руки: обновить видимость + заклинания в ладонях
        // Руки всегда видны, меняется только заклинание в ладони
        if (p.hasLeftHand) {
          setSpellInHand(handsRoot, -1, handTypeToVisual(p.leftHandType));
        } else {
          setSpellInHand(handsRoot, -1, null);
        }
        if (p.hasRightHand) {
          setSpellInHand(handsRoot, 1, handTypeToVisual(p.rightHandType));
        } else {
          setSpellInHand(handsRoot, 1, null);
        }

        const maxHp = p.maxHp || 3;
        if (p.hp < maxHp && p.hp > 0) crackHud.classList.add("on");
        if (p.hp >= maxHp) crackHud.classList.remove("on");
        if (p.isGhost) {
          deadHud.classList.add("on");
          crackHud.classList.remove("on");
        } else {
          deadHud.classList.remove("on");
        }

        // Обновить HP-бар
        updateHpBar(p.hp, maxHp);

        // Звук урона + damage-number
        if (lastHpSeen > p.hp && p.hp > 0) {
          playSound("player_hurt");
          spawnScreenDmgNumber(lastHpSeen - p.hp, false);
        }
        if (lastHpSeen > 0 && p.hp <= 0) {
          playSound("player_death");
        }
        lastHpSeen = p.hp;
      }
    });
  });

  room.state.players.onRemove((_p, id) => {
    if (id === selfId) return;
    const entry = otherPlayers.get(id);
    if (entry) {
      scene.remove(entry.mesh);
      disposeGroup(entry.mesh);
      otherPlayers.delete(id);
    }
  });

  // ── Мобы: 3D-модели с интерполяцией ─────────────────────────
  room.state.enemies.onAdd((e, id) => {
    const m = createEnemy3D(e.enemyType);
    // Сервер шлёт y=1 для наземных (центр тела) — опускаем на 1, чтобы ноги были на полу.
    // Летающие (CACO) шлются y=6+, там офсет не нужен.
    const yOff = m.userData.flying ? 0 : 1.0;
    m.userData.yOff = yOff;
    m.position.set(e.pos.x, e.pos.y - yOff, e.pos.z);
    scene.add(m);
    const entry = {
      mesh: m, targetX: e.pos.x, targetY: e.pos.y - yOff, targetZ: e.pos.z,
      prevX: e.pos.x, prevZ: e.pos.z, moving: false,
      wasAlive: true,
    };
    enemyMeshes.set(id, entry);

    e.onChange(() => {
      entry.targetX = e.pos.x;
      entry.targetY = e.pos.y - yOff;
      entry.targetZ = e.pos.z;
      if (!e.alive && entry.wasAlive) {
        // Звук смерти шлётся через fx enemy_die — не дублируем
        m.visible = false;
        entry.wasAlive = false;
      }
    });
    if (e.pos && e.pos.onChange) {
      e.pos.onChange(() => {
        entry.targetX = e.pos.x;
        entry.targetY = e.pos.y - yOff;
        entry.targetZ = e.pos.z;
      });
    }
  });
  room.state.enemies.onRemove((_e, id) => {
    const entry = enemyMeshes.get(id);
    if (entry) {
      scene.remove(entry.mesh); disposeGroup(entry.mesh); enemyMeshes.delete(id);
    }
  });

  // ── Пьедесталы (арена И хаб) ─────────────────────────────
  // Куда добавлять — решаем по текущей фазе (на арене → arenaGroup)
  room.state.pickups.onAdd((pk, id) => {
    const m = makePickupMesh(pk);
    m.position.set(pk.pos.x, 0, pk.pos.z);
    const parent = room.state.phase === "hub" ? hubGroup : arenaGroup;
    parent.add(m);
    m.userData.parentGroup = parent;
    pickupMeshes.set(id, m);
    pk.onChange(() => { if (pk.taken) { m.visible = false; } });
  });
  room.state.pickups.onRemove((_pk, id) => {
    const m = pickupMeshes.get(id);
    if (m) {
      const parent = m.userData.parentGroup || hubGroup;
      parent.remove(m);
      disposeGroup(m);
      pickupMeshes.delete(id);
    }
  });

  // Инициализация хаб-хранилища (после того как схема пришла)
  ensureHubStorageInit();
  room.onStateChange((_state) => {
    if (!hubStorageInitDone) ensureHubStorageInit();
  });


  // ── Фаза (хаб/арена) ──────────────────────────────────────
  room.state.listen("phase", (v) => {
    hubGroup.visible = v === "hub";
    arenaGroup.visible = v !== "hub";
    // Амбиентный шум отключён (мешал, будет заменён нормальным саунд-дизайном)
    stopSoundLoop(ambientLoop);
    ambientLoop = null;
    // Звук телепорта
    playSound("teleport");
    if (v === "arena" && myPlayer) controller.setPosition(0, 2, 0);
    if (v === "hub" && myPlayer) controller.setPosition(0, 2, WORLD.HUB_RADIUS * 0.3);
  });

  // ── FX ────────────────────────────────────────────────────
  room.onMessage("chat", (msg) => {
    addChatMessage(msg.name || "?", msg.text || "", msg.id === selfId);
  });

  room.onMessage("fx", (msg) => {
    if (msg.type === "shot") {
      spawnShotFx(msg.x, msg.y + 0.6, msg.z, msg.color, msg.dx, msg.dy, msg.dz);
      // Звук каста — по цвету определяем тип (цвета из SPELLS)
      if (msg.color === 0xff5a1f || msg.color === 0xff4400) playSound("fireball_cast");
      else if (msg.color === 0x66ccff) playSound("ice_cast");
      else playSound("chain_cast");
    }
    else if (msg.type === "chain") {
      spawnChainLightningFx(msg.points, msg.color);
      playSound("chain_cast");
    }
    else if (msg.type === "wave") {
      spawnWaveFx(msg.x, msg.y, msg.z, msg.r);
      playSound("fireball_impact", { volume: 0.35 });
    }
    else if (msg.type === "hurt" && msg.target === selfId) {
      // Трещины на руках вместо красного экрана
      if (handsRoot) showHandDamage(handsRoot, 1.5);
      flashCracks();
      if (typeof msg.fromX === "number" && myPlayer) {
        const dx = msg.fromX - myPlayer.pos.x;
        const dz = msg.fromZ - myPlayer.pos.z;
        dmgAngle = Math.atan2(dx, dz) - controller.yaw;
        dmgTimer = 0.6;
      }
    }
    else if (msg.type === "hit_enemy") {
      // Сервер шлёт для звука попадания + damage number
      playSound("enemy_hit");
      if (msg.dmg) spawnWorldDmgNumber(new THREE.Vector3(msg.x, msg.y + 1.5, msg.z), msg.dmg);
    }
    else if (msg.type === "enemy_die") {
      spawnDeathBurst(msg.x, msg.y, msg.z, msg.kind);
      playSound("enemy_death");
    }
    else if (msg.type === "death" && msg.target === selfId) {
      deadHud.classList.add("on");
      deathTimer = 3.0;
    }
    else if (msg.type === "respawn" && msg.target === selfId) {
      deadHud.classList.remove("on");
      crackHud.classList.remove("on");
      deathTimer = 0;
    }
  });
}

function flashCracks() {
  crackHud.classList.add("on");
  clearTimeout(flashCracks._t);
  flashCracks._t = setTimeout(() => { if (myPlayer && myPlayer.hp >= 3) crackHud.classList.remove("on"); }, 1200);
}

// ═══════════════════════════════════════════════════════════════════
// ВВОД
// ═══════════════════════════════════════════════════════════════════
let lastCastMs = 0;
canvas.addEventListener("mousedown", (ev) => {
  if (!room || !myPlayer) return;
  const hand = ev.button === 0 ? "left" : ev.button === 2 ? "right" : null;
  if (!hand) return;
  const has = hand === "left" ? myPlayer.hasLeftHand : myPlayer.hasRightHand;
  if (!has && myPlayer.itemsInBody.length === 0) return;
  const nowMs = performance.now();
  if (nowMs - lastCastMs < 250) return;
  lastCastMs = nowMs;
  const spellId = HAND_TYPES[hand === "left" ? myPlayer.leftHandType : myPlayer.rightHandType]?.spell
                || "FIREBALL";
  // НАПРАВЛЕНИЕ: СИНХРОННО ОБНОВЛЯЕМ камеру из controller.yaw/pitch, потом берём getWorldDirection.
  // Это гарантирует, что cast летит точно туда, куда будет смотреть следующий кадр.
  // Нельзя брать только controller.yaw — есть рассинхрон с рендером камеры.
  camera.rotation.order = "YXZ";
  camera.rotation.y = controller.yaw;
  camera.rotation.x = controller.pitch;
  camera.rotation.z = 0;
  camera.updateMatrixWorld(true);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = controller.position.clone().add(new THREE.Vector3(0, 0.4, 0));
  // ДИАГНОСТИКА Mac: лог каждого cast — первые 5
  if (!window._castLogCnt) window._castLogCnt = 0;
  if (window._castLogCnt < 5) {
    window._castLogCnt++;
    const pl = document.pointerLockElement === canvas ? "ON" : "OFF";
    console.log(`[CAST #${window._castLogCnt}] PL=${pl} y=${controller.yaw.toFixed(3)} p=${controller.pitch.toFixed(3)} dir=(${dir.x.toFixed(2)},${dir.y.toFixed(2)},${dir.z.toFixed(2)}) cam=(${camera.rotation.y.toFixed(3)},${camera.rotation.x.toFixed(3)})`);
  }
  // ФОРС-ОТПРАВКА input ПЕРЕД cast — чтобы другие клиенты видели модель
  // с тем же yaw/pitch, откуда летит снаряд (без этого до 50мс рассинхрона)
  sendInput();
  room.send("cast", {
    spell: spellId, dx: dir.x, dy: dir.y, dz: dir.z,
    ox: origin.x, oy: origin.y, oz: origin.z, hand
  });
  // Запустить визуальный кулдаун
  const spellDef = SPELLS[spellId];
  if (spellDef) startCooldown(hand, (spellDef.cooldown || 0.3) * 1000);
  // Анимация отдачи руки
  handsRoot.userData[hand === "left" ? "leftHand" : "rightHand"].userData.recoil = 1.0;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("keydown", (ev) => {
  if (!room) return;
  // Чат: Enter — открыть/отправить
  if (ev.code === "Enter") {
    if (chatOpen) {
      const text = chatInput.value.trim();
      if (text) room.send("chat", { text });
      chatInput.value = "";
      chatInput.style.display = "none";
      chatInput.blur();
      chatOpen = false;
      controller.enable();
    } else {
      chatOpen = true;
      chatInput.style.display = "block";
      chatInput.focus();
      controller.releasePointer();
    }
    ev.preventDefault();
    return;
  }
  if (chatOpen) return; // пока открыт чат — остальные вводы игнорируем
  // Тильда — дебаг-панель
  if (ev.code === "Backquote") {
    toggleDebugPanel();
    ev.preventDefault();
    return;
  }
  if (ev.code === "Escape") controller.releasePointer();
  // R — респавн, если вы призрак
  if (ev.code === "KeyR") {
    if (myPlayer && myPlayer.isGhost) room.send("respawn");
    return;
  }
  // Tab — панель снаряжения (hold to show)
  if (ev.code === "Tab") {
    ev.preventDefault();
    showLoadoutPanel();
    return;
  }
  // R-респ убран — теперь в дебаг-панели
  if (ev.code === "KeyF") {
    // 1) На арене или в хабе — пикапы приоритетнее
    let bestId = null, bestD = Infinity;
    pickupMeshes.forEach((m, id) => {
      const pk = room.state.pickups.get(id);
      if (!pk || pk.taken) return;
      const d = m.position.distanceTo(controller.position);
      if (d < 3 && d < bestD) { bestD = d; bestId = id; }
    });
    if (bestId) {
      room.send("pickup", { id: bestId });
      playSound("pickup");
      return;
    }
    // 2) На арене: активация портала если рядом и ещё не активен
    if (room.state.phase === "arena" && !room.state.portalActive) {
      const pos = getArenaPortalPos(arenaGroup);
      if (pos) {
        const d = Math.hypot(controller.position.x - pos.x, controller.position.z - pos.z);
        if (d < 3.5) {
          room.send("activate_portal");
          playSound("pickup");
          return;
        }
      }
    }
    // 3) В хабе — слоты, сундуки, алтарь
    if (room.state.phase === "hub") {
      // Ближайший слот
      let bestSlot = -1, bsD = 3;
      hubSlotMeshes.forEach((g, i) => {
        const d = g.position.distanceTo(controller.position);
        if (d < bsD) { bsD = d; bestSlot = i; }
      });
      // Ближайший сундук
      let bestChest = -1, bcD = 3;
      hubChestMeshes.forEach((g, i) => {
        const d = g.position.distanceTo(controller.position);
        if (d < bcD) { bcD = d; bestChest = i; }
      });
      // Алтарь (центр)
      const altarD = Math.hypot(controller.position.x, controller.position.z);
      const nearAltar = altarD < 3;
      // Приоритет: ближайшее из трёх
      const cands = [];
      if (bestSlot >= 0) cands.push({ kind: "slot", i: bestSlot, d: bsD });
      if (bestChest >= 0) cands.push({ kind: "chest", i: bestChest, d: bcD });
      if (nearAltar) cands.push({ kind: "altar", d: altarD });
      cands.sort((a, b) => a.d - b.d);
      const c = cands[0];
      if (!c) return;
      if (c.kind === "slot") {
        const slot = room.state.hubSlots[c.i];
        if (slot && !slot.empty) {
          room.send("hub_take", { source: "slot", index: c.i });
          playSound("pickup");
        } else if (slot && slot.empty && myPlayer) {
          // ПОЛОЖИТЬ: приоритет — левая, правая, лишний item, passive, нога
          let what = null;
          if (myPlayer.hasLeftHand) what = "leftHand";
          else if (myPlayer.hasRightHand) what = "rightHand";
          else if (myPlayer.itemsInBody.length > 0) what = "item";
          else if (myPlayer.passiveItemId) what = "passive";
          else if (myPlayer.hasLegs > 0) what = "leg";
          if (what) {
            room.send("hub_put", { index: c.i, what });
            playSound("pickup");
          }
        }
      } else if (c.kind === "chest") {
        // По F возле сундука — открываем UI-панель с набором предметов
        openChestPanel(c.i);
      } else if (c.kind === "altar") {
        // По F возле алтаря: если у меня есть рука — положить, иначе забрать (если что-то есть)
        const list = room.state.hubReforgeSlots;
        if (myPlayer && (myPlayer.hasLeftHand || myPlayer.hasRightHand) && list.length < 3) {
          room.send("hub_reforge", { op: "put_hand" });
          playSound("pickup");
        } else if (list.length > 0) {
          room.send("hub_reforge", { op: "take" });
          playSound("pickup");
        }
      }
    }
  }
  // G — скрафтить в алтаре (если стоишь рядом и 3 руки одного типа)
  if (ev.code === "KeyG" && room.state.phase === "hub") {
    const altarD = Math.hypot(controller.position.x, controller.position.z);
    if (altarD < 3 && room.state.hubReforgeSlots.length === 3) {
      room.send("hub_reforge", { op: "craft" });
      playSound("teleport");
    }
  }
  // E-телепорт убран — телепортация только через порталы или дебаг-панель
  if (ev.code === "Space") {
    playSound("jump");
  }
});

document.addEventListener("keyup", (ev) => {
  if (ev.code === "Tab") { ev.preventDefault(); hideLoadoutPanel(); }
});

function sendInput() {
  if (!room) return;
  const p = controller.position;
  room.send("input", { x: p.x, y: p.y, z: p.z, yaw: controller.yaw, pitch: controller.pitch });
}

// ═══════════════════════════════════════════════════════════════════
// РАДАР
// ═══════════════════════════════════════════════════════════════════
function drawRadar() {
  rctx.clearRect(0, 0, radar.width, radar.height);
  if (!myPlayer || !room) return;
  let nearest = null, nd = Infinity;
  room.state.enemies.forEach(e => {
    if (!e.alive) return;
    const dx = e.pos.x - myPlayer.pos.x;
    const dz = e.pos.z - myPlayer.pos.z;
    const d = dx*dx + dz*dz;
    if (d < nd) { nd = d; nearest = e; }
  });
  if (!nearest) return;
  const dx = nearest.pos.x - myPlayer.pos.x;
  const dz = nearest.pos.z - myPlayer.pos.z;
  const enemyAngle = Math.atan2(dx, dz);
  let rel = enemyAngle - controller.yaw;
  while (rel > Math.PI) rel -= 2*Math.PI;
  while (rel < -Math.PI) rel += 2*Math.PI;
  const clamped = Math.max(-Math.PI/2, Math.min(Math.PI/2, rel));
  const x = (clamped / (Math.PI/2)) * (radar.width/2 - 20) + radar.width/2;
  const behind = Math.abs(rel) > Math.PI/2;
  rctx.fillStyle = behind ? "#ff2222" : "#ffcc22";
  rctx.beginPath();
  rctx.moveTo(x, 10);
  rctx.lineTo(x - 8, 30);
  rctx.lineTo(x + 8, 30);
  rctx.closePath();
  rctx.fill();
  rctx.fillStyle = "#fff";
  rctx.font = "12px monospace";
  rctx.textAlign = "center";
  rctx.fillText(behind ? "СЗАДИ" : Math.round(Math.sqrt(nd)) + "м", x, 50);
}

// ═══════════════════════════════════════════════════════════════════
// АНИМАЦИОННЫЙ ЦИКЛ
// ═══════════════════════════════════════════════════════════════════
const clock = new THREE.Clock();
let prevControllerPos = new THREE.Vector3();

// ── ПОРТАЛЫ: автотриггер ────────────────────────────────
let portalHoldTime = 0;
let lastPortalKind = null;
let portalPendingPhase = null; // какую phase ждём от сервера после телепорта
function handlePortalTriggers(dt) {
  if (!room || !myPlayer) return;
  const cur = room.state.phase;
  // Если мы в ожидании смены phase (кликнули на 100%) — молчим
  if (portalPendingPhase) {
    if (cur === portalPendingPhase) { portalPendingPhase = null; portalHoldTime = 0; }
    hintText.style.opacity = 0;
    return;
  }
  let inZone = false;
  let ready = false;
  let msg = null;
  let target = null;
  if (cur === "hub") {
    const pos = getHubPortalPos(hubGroup);
    if (pos) {
      const d = Math.hypot(controller.position.x - pos.x, controller.position.z - pos.z);
      if (d < 2.5) { inZone = true; ready = true; msg = { phase: "arena" }; target = "hub"; }
    }
  } else {
    const pos = getArenaPortalPos(arenaGroup);
    if (pos) {
      const d = Math.hypot(controller.position.x - pos.x, controller.position.z - pos.z);
      if (d < 3.5) {
        inZone = true;
        target = "arena";
        if (cur === "portal_ready") { ready = true; msg = { phase: "hub" }; }
      }
    }
  }
  if (inZone && ready) {
    if (lastPortalKind !== target) { portalHoldTime = 0; lastPortalKind = target; }
    portalHoldTime += dt;
    // Показ прогресса
    const pct = Math.min(100, Math.round(portalHoldTime / 1.5 * 100));
    hintText.textContent = `телепорт... ${pct}%`;
    hintText.style.opacity = 1;
    hintTimer = 0.3;
    if (portalHoldTime >= 1.5) {
      room.send("phase", msg);
      portalPendingPhase = msg.phase;
      portalHoldTime = 0;
      lastPortalKind = null;
      // Показываем "перенос..."
      hintText.textContent = "перенос...";
      hintText.style.opacity = 1;
      hintTimer = 2.0;
    }
  } else if (inZone && !ready) {
    portalHoldTime = 0;
    // Арена: портал ещё не активирован — подсказка на F
    if (cur === "arena" && !room.state.portalActive) {
      hintText.textContent = "[F] активировать телепортер";
    } else if (cur === "arena" && room.state.portalActive) {
      const cur2 = Math.floor(room.state.portalCharge);
      const tot = Math.floor(room.state.portalTarget);
      hintText.textContent = `портал пьёт кровь: ${cur2}/${tot}`;
    } else {
      hintText.textContent = "портал ещё не заряжен";
    }
    hintText.style.opacity = 1;
    hintTimer = 0.3;
  } else {
    portalHoldTime = 0;
    lastPortalKind = null;
  }
}


// Подсказка о взаимодействии с хаб-объектами
function updateHubInteractionHint() {
  if (!room || !myPlayer || room.state.phase !== "hub") return;
  // Показываем ТОЛЬКО когда действительно можно нажать F/G рядом с объектом (< 2м)
  let action = null;
  hubSlotMeshes.forEach((g, i) => {
    const d = g.position.distanceTo(controller.position);
    if (d < 2 && !action) {
      const slot = room.state.hubSlots[i];
      if (slot && !slot.empty) action = `[F] взять ${slotLabel(slot.kind, slot.handType, slot.itemId)}`;
      else if (slot && slot.empty && myPlayer) {
        // что можно положить — приоритет тот же
        let lbl = null;
        if (myPlayer.hasLeftHand) lbl = `левую руку (${myPlayer.leftHandType || "?"})`;
        else if (myPlayer.hasRightHand) lbl = `правую руку (${myPlayer.rightHandType || "?"})`;
        else if (myPlayer.itemsInBody.length > 0) lbl = `лишний предмет`;
        else if (myPlayer.passiveItemId) lbl = `надетый предмет`;
        else if (myPlayer.hasLegs > 0) lbl = `ногу`;
        if (lbl) action = `[F] положить ${lbl}`;
      }
    }
  });
  hubChestMeshes.forEach((g, i) => {
    const d = g.position.distanceTo(controller.position);
    if (d < 2.5 && !action) {
      const chest = room.state.hubChests[i];
      const n = chest ? chest.contents.length : 0;
      if (n > 0) action = `[F] открыть сундук (${n})`;
      else action = "сундук пуст";
    }
  });
  const altarD = Math.hypot(controller.position.x, controller.position.z);
  if (altarD < 2.5 && !action) {
    const list = room.state.hubReforgeSlots;
    if (list.length === 3) {
      const parts = [...list].map(x => String(x).split(":"));
      const same = parts.every(([k]) => k === "HAND") && parts.every(([, t]) => t === parts[0][1]);
      if (same) action = `[G] сплавить 3×${parts[0][1]}`;
      else action = "[F] забрать (нужны 3 одинаковых)";
    } else if (list.length > 0) {
      action = `[F] положить/забрать (${list.length}/3)`;
    } else if (myPlayer.hasLeftHand || myPlayer.hasRightHand) {
      action = "[F] положить руку в алтарь";
    }
  }
  if (action) {
    hintText.textContent = action;
    hintText.style.opacity = 1.0;
    hintTimer = 0.2;
  }
}

function slotLabel(kind, handType, itemId) {
  if (kind === "HAND") return `руку (${handType || "?"})`;
  if (kind === "LEG") return "ногу";
  if (kind === "ITEM") return `предмет (${itemId || "?"})`;
  return "предмет";
}

// ── ИНВЕНТАРЬ СУНДУКА ────────────────────────────────
function parseChestItem(raw) {
  // Формат "KIND:SUB" (HAND:FIRE, LEG:, ITEM:SIGIL_DASH)
  const [kind, sub] = String(raw).split(":");
  return { kind, sub: sub || "" };
}
function chestItemLabel(raw) {
  const { kind, sub } = parseChestItem(raw);
  if (kind === "HAND") {
    const t = ({ FIRE: "ОГНЕННАЯ", ICE: "ЛЕДЯНАЯ", BONE: "КОСТЯНАЯ" })[sub] || sub;
    return `Рука: ${t}`;
  }
  if (kind === "LEG") return "Нога";
  if (kind === "ITEM") return sub === "SIGIL_DASH" ? "Сигил: Рывок" : sub || "Предмет";
  return "Предмет";
}
function chestItemColor(raw) {
  const { kind, sub } = parseChestItem(raw);
  if (kind === "HAND") {
    return { FIRE: "#ff5522", ICE: "#66ccff", BONE: "#d0c0a0" }[sub] || "#c0a070";
  }
  if (kind === "LEG") return "#a0c060";
  if (kind === "ITEM") return "#c080ff";
  return "#c0a070";
}
function drawChestIcon(ctx, raw, size) {
  const { kind, sub } = parseChestItem(raw);
  const cx = size / 2, cy = size / 2;
  const col = chestItemColor(raw);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  if (kind === "HAND") {
    // Ладонь: круг + 4 пальца + бase
    ctx.fillStyle = col;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    // Ладонь
    ctx.beginPath();
    ctx.roundRect(cx - 16, cy - 8, 32, 26, 6);
    ctx.fill(); ctx.stroke();
    // 4 пальца
    for (let i = -1.5; i <= 1.5; i++) {
      ctx.beginPath();
      ctx.roundRect(cx + i * 8 - 3, cy - 22, 6, 18, 3);
      ctx.fill(); ctx.stroke();
    }
    // Б. палец
    ctx.beginPath();
    ctx.roundRect(cx + 14, cy - 4, 8, 16, 3);
    ctx.fill(); ctx.stroke();
    // Свечение в ладони
    const g = ctx.createRadialGradient(cx, cy + 4, 2, cx, cy + 4, 14);
    g.addColorStop(0, col);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy + 4, 14, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "LEG") {
    // Стилизованный сапог
    ctx.fillStyle = col;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 22);
    ctx.lineTo(cx + 6, cy - 22);
    ctx.lineTo(cx + 6, cy + 12);
    ctx.lineTo(cx + 20, cy + 12);
    ctx.lineTo(cx + 20, cy + 22);
    ctx.lineTo(cx - 8, cy + 22);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (kind === "ITEM") {
    // Кристалл/сигил: ромб с внутренним свечением
    ctx.fillStyle = col;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 22);
    ctx.lineTo(cx + 16, cy);
    ctx.lineTo(cx, cy + 22);
    ctx.lineTo(cx - 16, cy);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Грани света
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 22); ctx.lineTo(cx, cy + 22);
    ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#666";
    ctx.fillRect(cx - 12, cy - 12, 24, 24);
  }
  ctx.restore();
}
function renderChestPanel() {
  if (openChestIndex < 0 || !room) return;
  const chest = room.state.hubChests[openChestIndex];
  if (!chest) return closeChestPanel();
  const grid = document.getElementById("chestGrid");
  const counter = document.getElementById("chestCounter");
  const n = chest.contents.length;
  const CAP = 12; // логический лимит ячеек для сетки 4х3
  counter.textContent = `${n} / ${CAP}`;
  grid.innerHTML = "";
  const total = Math.max(CAP, Math.ceil(n / 4) * 4);
  for (let i = 0; i < total; i++) {
    const cell = document.createElement("div");
    cell.style.cssText = [
      "aspect-ratio:1",
      "background:linear-gradient(180deg,#1a0f08 0%,#0a0503 100%)",
      "border:2px solid #3a2818",
      "border-radius:6px",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "position:relative",
      i < n ? "cursor:pointer" : "opacity:0.4",
      i < n ? "box-shadow:inset 0 0 8px rgba(255,170,50,0.3)" : "",
    ].join(";");
    if (i < n) {
      const raw = chest.contents[i];
      // Канвас-иконка
      const cnv = document.createElement("canvas");
      cnv.width = 64; cnv.height = 64;
      cnv.style.cssText = "width:56px;height:56px;image-rendering:crisp-edges;";
      drawChestIcon(cnv.getContext("2d"), raw, 64);
      cell.appendChild(cnv);
      // Подпись
      const label = document.createElement("div");
      label.style.cssText = "font-size:11px;color:#e0c090;margin-top:2px;text-align:center;line-height:1.1;padding:0 2px;";
      label.textContent = chestItemLabel(raw);
      cell.appendChild(label);
      // Клик — забрать
      cell.addEventListener("click", () => {
        room.send("hub_take", { source: "chest", index: openChestIndex, item: i });
        playSound("pickup");
        // Перерендер по onChange придёт автоматом через ~100мс; оптимистично:
        setTimeout(renderChestPanel, 120);
      });
      cell.addEventListener("mouseenter", () => { cell.style.borderColor = "#d4a020"; });
      cell.addEventListener("mouseleave", () => { cell.style.borderColor = "#3a2818"; });
    }
    grid.appendChild(cell);
  }
}
function openChestPanel(i) {
  if (openChestIndex === i) return;
  openChestIndex = i;
  chestPanel.style.display = "block";
  // Освободить курсор мыши
  if (document.pointerLockElement) document.exitPointerLock();
  renderChestPanel();
}
function closeChestPanel() {
  if (openChestIndex < 0) return;
  openChestIndex = -1;
  chestPanel.style.display = "none";
}
document.getElementById("chestClose").addEventListener("click", closeChestPanel);
// ESC — закрыть панель если открыта (также освобождает pointer lock по-браузерному)
document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && openChestIndex >= 0) {
    closeChestPanel();
    e.stopPropagation();
  }
});

let fellFlashUntil = 0;
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  controller.update(dt, myPlayer);

  // ── ПАДЕНИЕ С КРАЯ: смерть + респаун в центре хаба ────────
  if (room && myPlayer && room.state.phase === "hub") {
    const p = controller.position;
    // Падаем с края если: вне радиуса хаба ИЗ высота < -5
    const distXZ = Math.hypot(p.x, p.z);
    const outside = distXZ > WORLD.HUB_RADIUS * 1.05;
    const belowDeath = p.y < -5;
    if (belowDeath || (outside && p.y < 0)) {
      controller.setPosition(0, 2, WORLD.HUB_RADIUS * 0.3);
      // Обнулить вертикальную скорость внутри контроллера
      if (controller.velocity) { controller.velocity.x = 0; controller.velocity.y = 0; controller.velocity.z = 0; }
      playSound("teleport");
      fellFlashUntil = performance.now() + 350;
      // Кратко мигнуть подсказкой
      hintText.textContent = "Не падай с края";
      hintText.style.opacity = 1;
      setTimeout(() => { hintText.style.opacity = 0; }, 1500);
    }
  }

  // Определяем движется ли игрок (для звука шагов)
  const nowP = controller.position;
  const moved = nowP.distanceTo(prevControllerPos) > 0.01;
  if (moved && myPlayer && !myPlayer.isGhost) {
    footstepTimer -= dt;
    if (footstepTimer <= 0) {
      playSound("footstep");
      footstepTimer = 0.4;
    }
  }
  prevControllerPos.copy(nowP);

  // ── Враги: интерполяция + анимация ──────────────────────
  const lerpSpeed = 12;
  enemyMeshes.forEach(entry => {
    const m = entry.mesh;
    const a = Math.min(1, dt * lerpSpeed);
    m.position.x += (entry.targetX - m.position.x) * a;
    m.position.y += (entry.targetY - m.position.y) * a;
    m.position.z += (entry.targetZ - m.position.z) * a;

    // Определяем движение
    const moved = Math.hypot(m.position.x - entry.prevX, m.position.z - entry.prevZ) > 0.005;
    entry.moving = moved;
    entry.prevX = m.position.x;
    entry.prevZ = m.position.z;

    // Поворот в сторону движения
    if (moved) {
      const dx = entry.targetX - m.position.x;
      const dz = entry.targetZ - m.position.z;
      if (dx * dx + dz * dz > 0.001) {
        const targetYaw = Math.atan2(dx, dz);
        // Плавный поворот
        let diff = targetYaw - m.rotation.y;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        m.rotation.y += diff * Math.min(1, dt * 6);
      }
    }
    animateEnemy(m, dt, moved);
  });

  // ── Другие игроки ─────────────────────────────────────
  otherPlayers.forEach(entry => {
    const m = entry.mesh;
    const a = Math.min(1, dt * 12);
    m.position.x += (entry.targetX - m.position.x) * a;
    m.position.y += (entry.targetY - m.position.y) * a;
    m.position.z += (entry.targetZ - m.position.z) * a;
    // Поворот на yaw (лицом куда смотрит).
    // Модель otherplayer.js: лицо/глаза смотрят в +Z, а игровой forward — в −Z.
    // Смещаем поворот на π.
    const target = entry.targetYaw + Math.PI;
    let diff = target - m.rotation.y;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    m.rotation.y += diff * Math.min(1, dt * 20); // быстрая коррекция yaw — модель всегда смотрит куда стреляет

    const moved = Math.hypot(m.position.x - entry.prevX, m.position.z - entry.prevZ) > 0.005;
    entry.prevX = m.position.x; entry.prevZ = m.position.z;
    animateOtherPlayer(m, dt, moved);

    // Табличка с именем всегда смотрит на камеру (билборд)
    if (m.userData.nameSprite) {
      // Sprite автоматически смотрит на камеру
    }
  });

  // ── Пьедесталы (кристаллы вращаются) ─────────────────
  pickupMeshes.forEach(m => {
    if (m.userData.crystal) animatePedestal(m, dt);
  });

  // ── Факелы (пламя мерцает) ──────────────────────────
  const activeGroup = hubGroup.visible ? hubGroup : arenaGroup;
  animateTorches(activeGroup, dt);
  if (room) {
    const tSec = performance.now() * 0.001;
    // Перемещаем портал в точку от сервера (случайная каждый забег)
    setArenaPortalPosition(arenaGroup, room.state.portalX || 0, room.state.portalZ || 0);
    let pstate = "idle";
    if (room.state.phase === "portal_ready") pstate = "ready";
    else if (room.state.portalActive) pstate = "charging";
    const ratio = room.state.portalTarget > 0 ? (room.state.portalCharge / room.state.portalTarget) : 0;
    updateArenaPortal(arenaGroup, pstate, tSec, ratio);
    updateHubPortal(hubGroup, tSec);
    animateDangerZones(arenaGroup, tSec);
  // Открытие ближайшего сундука в хабе + автозакрытие UI если отошли
  if (room && room.state.phase === "hub") {
    hubChestMeshes.forEach((g, i) => {
      const d = g.position.distanceTo(controller.position);
      const open = d < 3;
      setChestOpen(g, open, dt);
    });
    if (openChestIndex >= 0) {
      const g = hubChestMeshes[openChestIndex];
      if (!g || g.position.distanceTo(controller.position) > 4) closeChestPanel();
    }
    // Лайв-рендер открытой панели (по onChange всегда ненадёжно)
    if (openChestIndex >= 0 && (performance.now() & 15) === 0) renderChestPanel();
  } else {
    hubChestMeshes.forEach(g => setChestOpen(g, false, dt));
    if (openChestIndex >= 0) closeChestPanel();
  }
  // TAB — живой рендер панели снаряжения
  if (loadoutOpen) renderLoadoutPanel();
    // Алтарь-переработчик
    if (hubGroup.userData.hubAltar && room.state.hubReforgeSlots) {
      updateHubAltar(hubGroup.userData.hubAltar, [...room.state.hubReforgeSlots], tSec);
    }
    updateHubInteractionHint();
    handlePortalTriggers(dt);
  }

  // HUD-подсказка
  if (hintTimer > 0) {
    hintTimer -= dt;
    hintText.style.opacity = hintTimer > 0 ? 1 : 0;
  }

  // ── Снаряды ─────────────────────────────────────────
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.ttl -= dt;
    if (s.vx || s.vy || s.vz) {
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
    }
    if (s.gravity) { s.vy -= s.gravity * dt; }
    if (s.spin) { s.mesh.rotation.x += s.spin * dt; s.mesh.rotation.y += s.spin * 0.7 * dt; }
    if (s.mesh.material) {
      s.mesh.material.opacity = Math.max(0, s.ttl / s.maxTtl);
      s.mesh.material.transparent = true;
    }
    if (s.ttl <= 0) {
      scene.remove(s.mesh);
      if (s.mesh.userData && s.mesh.userData.disposeExtras) s.mesh.userData.disposeExtras();
      disposeMatOnly(s.mesh);
      shots.splice(i, 1);
    }
  }

  if (deathTimer > 0) {
    deathTimer -= dt;
    // Авто-респ убран — через дебаг-панель
    void deathTimer;
  }
  if (dmgTimer > 0) {
    dmgTimer -= dt;
    // Красный экранный overlay убран — трещины на руках вместо этого (в hands3d)
    dmgOverlay.style.opacity = 0;
  } else {
    dmgOverlay.style.opacity = 0;
  }

  // ── Анимация рук ─────────────────────────────────────
  animateHands(handsRoot, dt, { moving: moved });
  fadeHandCracks(handsRoot, dt);

  drawRadar();
  updateCooldownHud();
  if (pixelScale > 1 && rtLowRes && postScene) {
    renderer.setRenderTarget(rtLowRes);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  } else {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}
animate();

// ═══════════════════════════════════════════════════════════════════
// СТАТУС-ЛЕНТА
// ═══════════════════════════════════════════════════════════════════
setInterval(() => {
  if (!room) return;
  const ph = room.state.phase;
  const wv = room.state.wave;
  let portalStr;
  if (ph === "arena" && !room.state.portalActive) {
    portalStr = "найди и [F]";
  } else if (ph === "arena" && room.state.portalActive) {
    portalStr = `${Math.floor(room.state.portalCharge)}/${Math.floor(room.state.portalTarget)} (бей врагов)`;
  } else if (ph === "portal_ready") {
    portalStr = "ГОТОВ";
  } else {
    portalStr = "—";
  }
  const pl = room.state.players.size;
  const hp = myPlayer ? `HP:${myPlayer.hp}/${myPlayer.maxHp || 3}` : "";
  const dt = deathTimer > 0 ? `  RESPAWN in ${deathTimer.toFixed(1)}s (или R)` : "";
  // Диагностика Mac: PL/yaw/pitch
  const pls = document.pointerLockElement === canvas ? "ON" : "OFF";
  const yaw = (controller.yaw || 0).toFixed(2);
  const pit = (controller.pitch || 0).toFixed(2);
  status.textContent = `${hp}  фаза:${ph}  волна:${wv}  портал:${portalStr}  игроки:${pl}  PL:${pls} y:${yaw} p:${pit}${dt}`;
}, 250);
