// ═════════════════════════════════════════════════════════════════════
// ЦЕНТРАЛЬНЫЙ РЕЕСТР АССЕТОВ
// ═════════════════════════════════════════════════════════════════════
// Чтобы заменить любой ассет на свой:
//   1. Положи файл в /client/public/assets/<тип>/<имя>.<ext>
//   2. В нужной секции ниже замени `procedural: fn()` на `url: "/assets/..."`
//   3. Всё. Модули читают только этот реестр.
//
// Пока все ассеты — процедурные (генерируются в коде), но структура готова
// принимать реальные PNG/OGG/GLB когда ты их добавишь.
// ═════════════════════════════════════════════════════════════════════

import * as THREE from "three";

// ─── ЗВУКИ ───────────────────────────────────────────────────────────
// Ключ → { url?: string, procedural?: (audioCtx) => AudioBuffer, volume?: number }
export const SOUNDS = {
  // магия
  fireball_cast:    { procedural: procFireballCast,   volume: 0.35 },
  ice_cast:         { procedural: procIceCast,        volume: 0.30 },
  chain_cast:       { procedural: procChainCast,      volume: 0.30 },
  fireball_impact:  { procedural: procFireballImpact, volume: 0.45 },
  // враги
  enemy_hit:        { procedural: procEnemyHit,       volume: 0.30 },
  enemy_death:      { procedural: procEnemyDeath,     volume: 0.40 },
  enemy_growl:      { procedural: procEnemyGrowl,     volume: 0.15 },
  // игрок
  player_hurt:      { procedural: procPlayerHurt,     volume: 0.35 },
  player_death:     { procedural: procPlayerDeath,    volume: 0.50 },
  footstep:         { procedural: procFootstep,       volume: 0.15 },
  jump:             { procedural: procJump,           volume: 0.20 },
  // взаимодействие
  pickup:           { procedural: procPickup,         volume: 0.40 },
  teleport:         { procedural: procTeleport,       volume: 0.45 },
  // ambience
  hub_ambient:      { procedural: procHubAmbient,     volume: 0.10, loop: true },
  arena_ambient:    { procedural: procArenaAmbient,   volume: 0.15, loop: true },
};

// ─── ТЕКСТУРЫ ────────────────────────────────────────────────────────
// Ключ → { url?: string, procedural?: () => THREE.Texture }
export const TEXTURES = {
  // хаб
  hub_floor:        { procedural: () => procStoneTexture("#3a2820", "#1a0f08", 512, 0.6) },
  hub_pillar:       { procedural: () => procStoneTexture("#4a3830", "#20140a", 256, 0.7) },
  // арена
  arena_floor:      { procedural: () => procStoneTexture("#1a1210", "#0a0505", 512, 0.4) },
  arena_wall:       { procedural: () => procStoneTexture("#2a1a12", "#100804", 256, 0.5) },
  // руки/оружие
  hand_skin:        { procedural: () => procSkinTexture("#c88866", "#a06040", 256) },
  hand_armor:       { procedural: () => procMetalTexture("#4a3020", "#2a1810", 128) },
  // враги (для будущих текстур мешей)
  enemy_imp:        { procedural: () => procFleshTexture("#a04030", "#4a1010", 128) },
  enemy_pinky:      { procedural: () => procFleshTexture("#e04040", "#601010", 128) },
  enemy_caco:       { procedural: () => procFleshTexture("#c02020", "#500808", 128) },
  enemy_baron:      { procedural: () => procFleshTexture("#c08820", "#402010", 128) },
  enemy_colossus:   { procedural: () => procFleshTexture("#603010", "#200800", 128) },
};

// ═════════════════════════════════════════════════════════════════════
// ЗАГРУЗЧИК АССЕТОВ (не менять)
// ═════════════════════════════════════════════════════════════════════

let audioCtx = null;
const soundCache = new Map();
const textureCache = new Map();

export function initAudio() {
  if (audioCtx) return audioCtx;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // Прогреваем все процедурные буферы (чтобы не было лага на первом попадании)
  try {
    Object.keys(SOUNDS).forEach(k => { getSoundBuffer(k); });
  } catch (e) {}
  return audioCtx;
}

export async function getSoundBuffer(key) {
  if (soundCache.has(key)) return soundCache.get(key);
  const def = SOUNDS[key];
  if (!def) { console.warn("no sound:", key); return null; }
  const ctx = initAudio();
  let buf = null;
  if (def.url) {
    const res = await fetch(def.url);
    const arr = await res.arrayBuffer();
    buf = await ctx.decodeAudioData(arr);
  } else if (def.procedural) {
    buf = def.procedural(ctx);
  }
  soundCache.set(key, buf);
  return buf;
}

export function playSound(key, opts = {}) {
  const def = SOUNDS[key];
  if (!def) return;
  getSoundBuffer(key).then(buf => {
    if (!buf || !audioCtx) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.loop = !!(opts.loop ?? def.loop);
    const gain = audioCtx.createGain();
    gain.gain.value = (opts.volume ?? def.volume ?? 0.3);
    src.connect(gain).connect(audioCtx.destination);
    src.start();
    if (opts.loop || def.loop) return { src, gain };
    return null;
  });
}

export function playSoundLoop(key, opts = {}) {
  const def = SOUNDS[key];
  if (!def) return null;
  const ctx = initAudio();
  const handle = { src: null, gain: null, stopped: false };
  getSoundBuffer(key).then(buf => {
    if (!buf || handle.stopped) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = opts.volume ?? def.volume ?? 0.1;
    src.connect(gain).connect(ctx.destination);
    src.start();
    handle.src = src; handle.gain = gain;
  });
  return handle;
}

export function stopSoundLoop(handle) {
  if (!handle) return;
  handle.stopped = true;
  try { handle.src?.stop(); } catch(e){}
}

export function getTexture(key) {
  if (textureCache.has(key)) return textureCache.get(key);
  const def = TEXTURES[key];
  if (!def) { console.warn("no texture:", key); return null; }
  let tex = null;
  if (def.url) {
    tex = new THREE.TextureLoader().load(def.url);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  } else if (def.procedural) {
    tex = def.procedural();
  }
  textureCache.set(key, tex);
  return tex;
}

// ═════════════════════════════════════════════════════════════════════
// ПРОЦЕДУРНЫЕ ГЕНЕРАТОРЫ ЗВУКОВ (WebAudio, синтез с нуля)
// ═════════════════════════════════════════════════════════════════════

function makeBuffer(ctx, duration) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  return buf;
}

function procFireballCast(ctx) {
  const dur = 0.4, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 3);
    const sweep = 200 + t * 800;
    d[i] = env * (Math.sin(2*Math.PI*sweep*t) * 0.5 + (Math.random()-0.5) * 0.5);
  }
  return buf;
}

function procIceCast(ctx) {
  const dur = 0.35, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 4);
    const f = 800 + Math.sin(t*40) * 200;
    d[i] = env * (Math.sin(2*Math.PI*f*t) * 0.4 + (Math.random()-0.5) * 0.3);
  }
  return buf;
}

function procChainCast(ctx) {
  const dur = 0.5, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 2);
    const crackle = (Math.random()-0.5) * 2;
    const buzz = Math.sin(2*Math.PI*(150 + Math.sin(t*80)*100)*t);
    d[i] = env * (crackle * 0.6 + buzz * 0.4);
  }
  return buf;
}

function procFireballImpact(ctx) {
  const dur = 0.5, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 5);
    const boom = Math.sin(2*Math.PI*(80 - t*40)*t);
    const noise = (Math.random()-0.5) * 2;
    d[i] = env * (boom * 0.6 + noise * 0.4);
  }
  return buf;
}

function procEnemyHit(ctx) {
  const dur = 0.15, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 20);
    d[i] = env * (Math.sin(2*Math.PI*180*t) * 0.5 + (Math.random()-0.5) * 0.5);
  }
  return buf;
}

function procEnemyDeath(ctx) {
  const dur = 0.6, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 3);
    const growl = Math.sin(2*Math.PI*(120 - t*80)*t);
    const noise = (Math.random()-0.5) * (1 - t);
    d[i] = env * (growl * 0.5 + noise * 0.5);
  }
  return buf;
}

function procEnemyGrowl(ctx) {
  const dur = 0.8, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.sin(Math.PI * t / dur);
    const growl = Math.sin(2*Math.PI*(60 + Math.sin(t*8)*20)*t);
    d[i] = env * (growl * 0.5 + (Math.random()-0.5)*0.3) * 0.8;
  }
  return buf;
}

function procPlayerHurt(ctx) {
  const dur = 0.25, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 6);
    d[i] = env * Math.sin(2*Math.PI*(400 - t*300)*t);
  }
  return buf;
}

function procPlayerDeath(ctx) {
  const dur = 1.2, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 1.5);
    const groan = Math.sin(2*Math.PI*(200 - t*150)*t);
    d[i] = env * (groan * 0.6 + (Math.random()-0.5)*0.2);
  }
  return buf;
}

function procFootstep(ctx) {
  const dur = 0.08, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 40);
    d[i] = env * ((Math.random()-0.5) * 0.8 + Math.sin(2*Math.PI*90*t)*0.3);
  }
  return buf;
}

function procJump(ctx) {
  const dur = 0.2, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 8);
    d[i] = env * Math.sin(2*Math.PI*(200 + t*400)*t);
  }
  return buf;
}

function procPickup(ctx) {
  const dur = 0.3, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 5);
    const sweep = 400 + t * 800;
    d[i] = env * (Math.sin(2*Math.PI*sweep*t) * 0.4 + Math.sin(2*Math.PI*sweep*2*t) * 0.2);
  }
  return buf;
}

function procTeleport(ctx) {
  const dur = 0.6, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.sin(Math.PI * t / dur);
    const shimmer = Math.sin(2*Math.PI*(600 + Math.sin(t*30)*300)*t);
    d[i] = env * (shimmer * 0.4 + (Math.random()-0.5) * 0.3);
  }
  return buf;
}

function procHubAmbient(ctx) {
  const dur = 4.0, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const drone = Math.sin(2*Math.PI*55*t) * 0.3 + Math.sin(2*Math.PI*82.5*t) * 0.2;
    d[i] = drone + (Math.random()-0.5) * 0.05;
  }
  return buf;
}

function procArenaAmbient(ctx) {
  const dur = 4.0, buf = makeBuffer(ctx, dur), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    const drone = Math.sin(2*Math.PI*45*t) * 0.4;
    const wind = (Math.random()-0.5) * 0.15;
    d[i] = drone + wind;
  }
  return buf;
}

// ═════════════════════════════════════════════════════════════════════
// ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (canvas → THREE.CanvasTexture)
// ═════════════════════════════════════════════════════════════════════

function procStoneTexture(base, dark, size, roughness) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // трещины и вкрапления
  for (let i = 0; i < size * roughness; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const sz = 1 + Math.random() * 4;
    ctx.fillStyle = Math.random() > 0.5 ? dark : mix(base, dark, 0.5);
    ctx.fillRect(x, y, sz, sz);
  }
  // редкие большие камни
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = mix(base, dark, 0.3 + Math.random() * 0.4);
    ctx.beginPath();
    ctx.arc(Math.random()*size, Math.random()*size, 4 + Math.random()*12, 0, Math.PI*2);
    ctx.fill();
  }
  // тонкие царапины
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    const x1 = Math.random()*size, y1 = Math.random()*size;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + (Math.random()-0.5)*40, y1 + (Math.random()-0.5)*40);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function procSkinTexture(base, dark, size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // поры кожи
  for (let i = 0; i < size * 2; i++) {
    ctx.fillStyle = dark;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(Math.random()*size, Math.random()*size, 0.5 + Math.random()*1.5, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // жилки
  ctx.strokeStyle = mix(base, "#602020", 0.4);
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const x = Math.random() * size, y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      ctx.lineTo(x + (Math.random()-0.5)*30, y + (Math.random()-0.5)*30);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function procMetalTexture(base, dark, size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // царапины
  ctx.strokeStyle = mix(base, "#ffffff", 0.2);
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (Math.random()-0.5)*10);
    ctx.stroke();
  }
  // ржавые пятна
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = "#5a2010";
    ctx.beginPath();
    ctx.arc(Math.random()*size, Math.random()*size, 2 + Math.random()*8, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function procFleshTexture(base, dark, size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // мясные разводы
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = mix(base, dark, 0.3 + Math.random()*0.4);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(Math.random()*size, Math.random()*size, 3 + Math.random()*10, 0, Math.PI*2);
    ctx.fill();
  }
  // яркие пятна крови
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 15; i++) {
    ctx.fillStyle = "#600000";
    ctx.beginPath();
    ctx.arc(Math.random()*size, Math.random()*size, 1 + Math.random()*4, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function mix(a, b, t) {
  const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
  const ar = (ah>>16)&255, ag = (ah>>8)&255, ab = ah&255;
  const br = (bh>>16)&255, bg = (bh>>8)&255, bb = bh&255;
  const r = Math.round(ar + (br-ar)*t), g = Math.round(ag + (bg-ag)*t), b2 = Math.round(ab + (bb-ab)*t);
  return "#" + ((r<<16) | (g<<8) | b2).toString(16).padStart(6,"0");
}
