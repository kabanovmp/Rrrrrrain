# Monster models

All files below are **CC0 / Public Domain** (Creative Commons Zero v1.0). Free to use, modify, and redistribute for any purpose (including commercial). No attribution required.

Author for every monster in this folder: **Quaternius** — <https://quaternius.com/>.
Pack: **Ultimate Monsters** (50 fully-animated CC0 monsters).
License: CC0 1.0 — <https://creativecommons.org/publicdomain/zero/1.0/>.

All files are self-contained single-file `.glb` (geometry + PNG atlas + skeletal animations embedded), safe to drop into a three.js `GLTFLoader.load()` call.
All files are < 1 MB (well under the 2 MB per-file budget).

---

## v1 models (already used in the game)

Sourced from the CC0 companion repo [`511action/descent-3d-assets`](https://github.com/511action/descent-3d-assets)
(README: "CC0 monster models (Quaternius Ultimate Monsters pack, public domain)"). Converted from `.gltf` (base64-embedded buffers) to single-file `.glb` with `@gltf-transform/cli`.

Each of these three files ships with the same 14-clip animation set:
`Idle`, `Walk`, `Run`, `Punch`, `Weapon`, `HitReact`, `Death`, `Duck`, `Jump`, `Jump_Idle`, `Jump_Land`, `No`, `Yes`, `Wave`.

| In-game type | File | Source model (in Ultimate Monsters pack) | Size | Silhouette |
|---|---|---|---|---|
| IMP | `imp.glb` | `Big/glTF/Demon.gltf` → glb | 621 KB | Small red horned demon with wings + pitchfork |
| PINKY | `pinky.glb` | `Big/glTF/Orc.gltf` → glb | 632 KB | Chunky green orc/goblin (fat-pig-demon stand-in) |
| CACO | `caco.glb` | `Big/glTF/BlueDemon.gltf` → glb | 566 KB | Blue puffy demon (classic Cacodemon blue) |

Raw sources:
- `https://raw.githubusercontent.com/511action/descent-3d-assets/main/models/Demon.gltf`
- `https://raw.githubusercontent.com/511action/descent-3d-assets/main/models/Orc.gltf`
- `https://raw.githubusercontent.com/511action/descent-3d-assets/main/models/BlueDemon.gltf`

---

## v2 models (new variety pass — different silhouettes)

Sourced from the full **Ultimate Monsters** pack (archived on Internet Archive at
[`archive.org/details/ultimate-monsters`](https://archive.org/details/ultimate-monsters), file `Ultimate_Monsters-20240909T030740Z-001.zip`, 46 MB). Original download page: <https://quaternius.com/packs/ultimatemonsters.html>. Bundle listing on poly.pizza: <https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6> (CC0). Each `.gltf` (with embedded base64 buffers) was converted to single-file `.glb` with `npx @gltf-transform/cli copy input.gltf output.glb` (~50% size reduction).

The five v2 files split into two rig families:

**Ground rig (13-clip set):** `Death`, `Duck`, `HitReact`, `Idle`, `Jump`, `Jump_Idle`, `Jump_Land`, `No`, `Punch`, `Run`, `Walk`, `Wave`, `Weapon` — applies to `imp2`, `pinky2`, `baron2`.

**Flying rig (8-clip set):** `Death`, `Fast_Flying`, `Flying_Idle`, `Headbutt`, `HitReact`, `No`, `Punch`, `Yes` — applies to `caco2`, `flyer2`.

| In-game type | File | Source model (in Ultimate Monsters pack) | Size | Silhouette / role |
|---|---|---|---|---|
| IMP (v2) | `imp2.glb` | `Big/glTF/Ninja.gltf` → glb | 579 KB | Small ninja-humanoid with sword, distinct fast-runner shape (~1.5 m in-engine after rescale). Rig height ≈ 3.0 m before rescale. |
| PINKY (v2) | `pinky2.glb` | `Big/glTF/Frog.gltf` → glb | 529 KB | Squat, low-slung, wide-mouthed frog — stocky tank silhouette (rig height ≈ 2.68 m, shortest of the Big set — hugs the ground). |
| BARON (v2) | `baron2.glb` | `Big/glTF/MushroomKing.gltf` → glb | 568 KB | Big-headed mushroom king boss with tall crown/cap on top — dominating boss silhouette (rig height ≈ 3.6 m). |
| CACO (v2) | `caco2.glb` | `Flying/glTF/Ghost.gltf` → glb | 299 KB | Hovering spectral ghost (uses `Flying_Idle` / `Fast_Flying` — no ground contact). |
| FLYER (v2) | `flyer2.glb` | `Flying/glTF/Armabee.gltf` → glb | 160 KB | Armored bee — winged flyer, small buzzing silhouette, completely different from the ghost. |

Raw sources (archive.org mirror of the CC0 pack):
- `https://archive.org/download/ultimate-monsters/Ultimate_Monsters-20240909T030740Z-001.zip` (46 MB, 258 files, MD5 `7a46f95130828b7497a4e65a178cee89`)
  - inside: `Ultimate Monsters/Big/glTF/Ninja.gltf`
  - inside: `Ultimate Monsters/Big/glTF/Frog.gltf`
  - inside: `Ultimate Monsters/Big/glTF/MushroomKing.gltf`
  - inside: `Ultimate Monsters/Flying/glTF/Ghost.gltf`
  - inside: `Ultimate Monsters/Flying/glTF/Armabee.gltf`

Author, license, download landing: same as v1 (Quaternius, CC0 1.0, <https://quaternius.com/packs/ultimatemonsters.html>).

---

## Notes

- All eight monster `.glb` files are self-contained (single-file, no sidecar `.bin` / textures). Drop straight into `GLTFLoader.load(url, ...)`.
- All eight files are under 1 MB — well below the per-file 2 MB budget.
- Bounding boxes are roughly `~4.6 m wide × ~2.7–4 m tall` (Quaternius character rig scale); rescale on load in-engine as needed. The v2 file table above lists per-model rig heights so you can pick per-monster scale factors.
- v1 monsters use the 14-clip ground rig; v2 splits into a 13-clip ground rig (`imp2` / `pinky2` / `baron2`) and an 8-clip flying rig (`caco2` / `flyer2`). Update the animation-clip mixer in-engine accordingly.
- Validation: `file monsters/*.glb` reports `glTF binary model, version 2` for every file; `gltf-transform validate` reports no errors or warnings.
