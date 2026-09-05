# Rrrrrrain — быстрый DIY (без ИИ)

Как поменять модели, звуки и карту руками, без запроса к ИИ.
Все правки требуют: сохранить файл → билд клиента → пуш в git → Railway задеплоит сам.

Билд клиента (обязательно перед пушем):
```bash
cd client
sed -i 's|/app/shared/index.js|../shared/index.js|' vite.config.js
npm run build
sed -i 's|../shared/index.js|/app/shared/index.js|' vite.config.js
```
На Windows/Mac без sed — просто поменяй строчку `input:` в `client/vite.config.js` вручную, запусти `npm run build`, верни строчку обратно.

Пуш:
```bash
git add -A && git commit -m "..." && git push
```

---

## 1. Модели врагов (GLB)

Файлы моделей: `client/public/models/monsters/*.glb`

Реестр — какой файл на какого врага:
Файл: **`client/src/enemies3d.js`**, строки 17–23:
```js
const GLB_URLS = {
  IMP:   "/models/monsters/imp2.glb",   // мелкий бегун
  PINKY: "/models/monsters/pinky2.glb", // средний танк
  CACO:  "/models/monsters/caco2.glb",  // призрак (летает)
  BARON: "/models/monsters/baron2.glb", // большой босс
  FLYER: "/models/monsters/flyer2.glb", // второй летающий
};
```

### Как поменять модель на свою
1. Скачай CC0 GLB (например с [poly.pizza](https://poly.pizza) или [quaternius.com](https://quaternius.com)).
2. Скинь в `client/public/models/monsters/newmodel.glb`.
3. В `enemies3d.js` замени путь: `IMP: "/models/monsters/newmodel.glb"`.
4. Билд + пуш.

Требования к модели:
- Формат **.glb** (один файл, а не .gltf + текстуры).
- Размер < 2 МБ (чтобы страница не тормозила при загрузке).
- Скелетная анимация с клипами `Run` / `Walk` / `Idle` (для наземных) или `Fast_Flying` / `Flying_Idle` (для летающих). Код сам подберёт по имени.
- Модель должна смотреть в **−Z** (это forward у three.js — стандарт Quaternius/Kenney/Kay).

### Размер врага
Файл: **`client/src/enemies3d.js`**, `ENEMY_SPECS`, поле `height` (в метрах):
```js
IMP:   { height: 1.3, ... }
PINKY: { height: 1.9, ... }
BARON: { height: 2.6, ... }
```
Код автоматически подгоняет модель под эту высоту.

---

## 2. Звуки

Файл: **`client/src/assets.js`**, объект `SOUNDS` (строки ~17–37).

Сейчас все звуки процедурные (генерятся кодом). Чтобы поставить свой mp3/ogg:

1. Скачай CC0 звук (например с [freesound.org](https://freesound.org) — фильтр "CC0").
2. Скинь в `client/public/audio/myshot.mp3`.
3. В `assets.js` замени:
   ```js
   fireball_cast: { procedural: procFireballCast, volume: 0.35 },
   ```
   на
   ```js
   fireball_cast: { url: "/audio/myshot.mp3", volume: 0.35 },
   ```
4. Билд + пуш.

Ключи, которые можно менять (полный список в `SOUNDS`):
- **Магия:** `fireball_cast`, `ice_cast`, `chain_cast`, `fireball_impact`
- **Враги:** `enemy_hit`, `enemy_death`, `enemy_growl`
- **Игрок:** `player_hurt`, `player_death`, `footstep`, `jump`
- **Мир:** `pickup`, `teleport`, `hub_ambient`, `arena_ambient`

Громкость каждого — поле `volume` (0.0–1.0).

---

## 3. Карта / окружение

### Размеры арены и хаба
Файл: **`shared/index.js`**, строки 11–14:
```js
export const WORLD = {
  ARENA_RADIUS: 90,   // радиус арены (в метрах)
  HUB_RADIUS: 36,     // радиус хаба
};
```
Больше — просторнее и труднее найти врагов; меньше — теснее и хардкор.

### Визуал арены и хаба
Файл: **`client/src/world.js`** — вся геометрия сцен.
- `setupHub(group)` — строит хаб (пол, колонны, алтарь, факелы).
- `setupArena(group)` — строит арену (пол, стены, портал, зоны опасности).

Если хочешь поменять цвет пола хаба — ищи в `setupHub` строчку с `MeshStandardMaterial({ color: ...` для `floor`.

### Текстуры (пол/стены)
Файл: **`client/src/assets.js`**, объект `TEXTURES` (строки ~40–56).

Заменить процедурную текстуру на PNG:
```js
hub_floor: { url: "/textures/my-stone.png" },
```
Файл клади в `client/public/textures/my-stone.png`. PNG должен быть **квадратным** и **степенью двойки** (256, 512, 1024) — иначе тайлинг сломается.

Ключи:
- Хаб: `hub_floor`, `hub_pillar`
- Арена: `arena_floor`, `arena_wall`
- Руки: `hand_skin`, `hand_armor`
- Враги (для fallback без GLB): `enemy_imp`, `enemy_pinky`, `enemy_caco`, `enemy_baron`, `enemy_colossus`

---

## 4. Волны и типы врагов в спавне

Файл: **`server/src/ArenaRoom.js`**, функция `spawnWave`, строки ~496–521.

Пример — добавить BARON с 1-й волны:
```js
if (waveNum === 1) {
  type = roll < 0.5 ? "IMP" : "BARON";
}
```

Параметры врагов (HP, скорость, урон):
Файл: **`shared/index.js`**, `ENEMY_TYPES` (строки 57–63).
```js
IMP: { hp: 2, speed: 4.5, damage: 1, ... }
```

Если менял серверные файлы (`server/*` или `shared/*`) — надо **и билд, и пуш**: Railway задеплоит и клиент, и сервер.

---

## 5. Полезные ссылки для CC0 ассетов

Модели:
- [poly.pizza](https://poly.pizza) — CC0 low-poly, есть удобные bundle-ссылки
- [quaternius.com](https://quaternius.com) — вся коллекция CC0, наши текущие монстры отсюда
- [kenney.nl/assets](https://kenney.nl/assets) — CC0 low-poly ассеты

Звуки:
- [freesound.org](https://freesound.org) — фильтр "Creative Commons 0"
- [kenney.nl/assets/category:Audio](https://kenney.nl/assets/category:Audio) — CC0 sfx-паки
- [sonniss.com/gameaudiogdc](https://sonniss.com/gameaudiogdc) — большие CC0 паки от GDC

Текстуры:
- [ambientcg.com](https://ambientcg.com) — CC0 seamless PBR
- [polyhaven.com/textures](https://polyhaven.com/textures) — CC0 hi-res

---

## 6. Что делать если сломалось

- Смотри логи в консоли браузера (F12 → Console). Ошибки типа `[GLB] fallback to procedural` = модель не загрузилась (проверь путь и имя файла).
- Если после пуша Railway показывает старую версию — открой сайт с `?v=999` в конце URL (сбрасывает кэш).
- Если поломал что-то и не понимаешь как откатить: `git log --oneline -5` покажет последние коммиты, `git revert <hash>` откатит указанный.
