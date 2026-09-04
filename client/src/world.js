import * as THREE from "three";
import { WORLD } from "@mhfps/shared";

// Build hub (Terraria-like glass room in space) and arena (Devil Daggers vast dark platform).
// Everything low-poly to match retro pixel-3D aesthetic.

export function setupHub(group) {
  const R = WORLD.HUB_RADIUS;
  // Hub floor — hexagonal stone platform
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x776655, roughness: 1, flatShading: true })
  );
  floor.position.y = 0;
  group.add(floor);

  // Glass wall ring — thin, translucent
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, 6, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x88aacc, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
  );
  wall.position.y = 3;
  group.add(wall);

  // Star field skybox for hub
  const stars = starPoints(500, 60);
  group.add(stars);

  // Portal pad in the center — appears usable in "portal_ready" phase (visual only for MVP)
  const portal = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.15, 8, 16),
    new THREE.MeshBasicMaterial({ color: 0xff2244 })
  );
  portal.rotation.x = Math.PI / 2;
  portal.position.set(0, 0.3, 0);
  group.add(portal);
}

export function setupArena(group) {
  // Massive dark platform
  const R = WORLD.ARENA_RADIUS;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 3, R * 3, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1, flatShading: true })
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // Blood pools scattered
  for (let i = 0; i < 30; i++) {
    const s = 1 + Math.random() * 3;
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(s, 12),
      new THREE.MeshBasicMaterial({ color: 0x4a0000, transparent: true, opacity: 0.6 })
    );
    pool.rotation.x = -Math.PI / 2;
    const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.9;
    pool.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r);
    group.add(pool);
  }

  // Sparse jagged stones as terrain hints
  for (let i = 0; i < 24; i++) {
    const s = 0.6 + Math.random() * 1.4;
    const rock = new THREE.Mesh(
      new THREE.ConeGeometry(s, s * 2.5, 5),
      new THREE.MeshStandardMaterial({ color: 0x2a1a12, flatShading: true })
    );
    const a = Math.random() * Math.PI * 2, r = R * (0.4 + Math.random() * 0.6);
    rock.position.set(Math.cos(a) * r, s * 1.2, Math.sin(a) * r);
    rock.rotation.y = Math.random() * Math.PI;
    group.add(rock);
  }

  // Dark red skybox dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R * 4, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0x1a0505, side: THREE.BackSide })
  );
  group.add(dome);
}

function starPoints(count, radius) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI;
    positions[i*3+0] = Math.cos(a) * Math.cos(b) * radius;
    positions[i*3+1] = Math.sin(b) * radius;
    positions[i*3+2] = Math.sin(a) * Math.cos(b) * radius;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xaaaaff, size: 0.4, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}

export function disposeGroup(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose?.();
    if (o.material) {
      const m = o.material;
      if (Array.isArray(m)) m.forEach(x => x.dispose?.());
      else m.dispose?.();
    }
  });
}
