# 🌧️ Rrrrrrain — MVP

Кооп-шутер от первого лица про магический сгусток дыма. Devil Daggers × RoR2 × Terraria.

## Быстрый старт

```bash
npm install
npm run dev
```

- Клиент: http://localhost:5173
- Сервер: ws://localhost:2567 (Colyseus)
- Colyseus монитор: http://localhost:2567/colyseus

**Управление:** WASD — движение · Space/Ctrl — вверх/вниз · Shift — рывок · ЛКМ/ПКМ — каст · F — подобрать · E — Хаб↔Арена · Esc — курсор

## Структура

```
magic_hands_fps/
├── shared/          # константы (NET, WORLD, COMBAT, HAND_TYPES, SPELLS, ITEMS)
├── server/          # Colyseus room, AI, damage, waves
├── client/          # Three.js рендер, FPS-контроллер, сеть
└── docs/
    ├── CONCEPT.md       (в корне проекта — v0.4)
    ├── ASSUMPTIONS.md   ← все допущения MVP
    └── DEPLOYMENT.md    ← как развернуть сервер
```

## Сборка production

```bash
npm run build:client     # → client/dist/
npm run start:server     # запускает сервер
```

Разворачивание на Railway/Fly/VPS — см. `docs/DEPLOYMENT.md`.

## Что готово в MVP

- ✅ Кооп до 8 игроков в одной комнате
- ✅ 5 типов врагов (IMP, PINKY, CACO, BARON, COLOSSUS)
- ✅ 3 заклинания (FIREBALL, BONE_SHARD, PUSH_WAVE)
- ✅ 1.5-хит система с трещинами на руках
- ✅ Хаб со стеклянными стенами в космосе + Арена
- ✅ 7 постаментов с пикапами
- ✅ 3 волны врагов с боссом
- ✅ Режим призрака после смерти

## Что дальше

См. `ASSUMPTIONS.md` секция «Что нужно от тебя перед следующей итерацией».
