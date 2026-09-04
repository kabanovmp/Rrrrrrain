import * as THREE from "three";
import { WORLD } from "@mhfps/shared";

// First-person controller with pointer-lock + WASD + dash.
// Player is a "smoke cloud" — floats, no gravity yet.

export class FpsController {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.position = new THREE.Vector3(0, 1.6, 4);
    this.yaw = 0;
    this.pitch = 0;
    this.vel = new THREE.Vector3();
    this.dashTimer = 0;
    this.dashCd = 0;

    this.keys = {};
    document.addEventListener("keydown", (e) => (this.keys[e.code] = true));
    document.addEventListener("keyup",   (e) => (this.keys[e.code] = false));

    canvas.addEventListener("click", () => canvas.requestPointerLock());
    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.yaw   -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      const lim = Math.PI / 2 - 0.05;
      if (this.pitch > lim) this.pitch = lim;
      if (this.pitch < -lim) this.pitch = -lim;
    });
  }

  enable() { this.canvas.requestPointerLock(); }
  setPosition(x, y, z) { this.position.set(x, y, z); this.vel.set(0, 0, 0); }

  update(dt, myPlayer) {
    // Movement input
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right   = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new THREE.Vector3();
    if (this.keys.KeyW) move.add(forward);
    if (this.keys.KeyS) move.sub(forward);
    if (this.keys.KeyD) move.add(right);
    if (this.keys.KeyA) move.sub(right);
    if (this.keys.Space) move.y += 1;
    if (this.keys.KeyC || this.keys.ControlLeft) move.y -= 1;
    if (move.lengthSq() > 0) move.normalize();

    // Legs affect ground speed; without legs — fly speed only
    const hasLegs = myPlayer?.hasLegs ?? 0;
    const baseSpeed = hasLegs >= 2 ? WORLD.BASE_MOVE_SPEED : WORLD.BASE_FLY_SPEED;

    // Dash
    if (this.keys.ShiftLeft && this.dashCd <= 0 && move.lengthSq() > 0) {
      this.dashTimer = WORLD.DASH_DURATION;
      this.dashCd = WORLD.DASH_COOLDOWN;
    }
    let speed = baseSpeed;
    if (this.dashTimer > 0) { speed = WORLD.DASH_SPEED; this.dashTimer -= dt; }
    this.dashCd = Math.max(0, this.dashCd - dt);

    this.vel.x = move.x * speed;
    this.vel.z = move.z * speed;
    this.vel.y = move.y * speed * 0.7;

    this.position.addScaledVector(this.vel, dt);
    // clamp inside a big soft box
    const R = 100;
    if (this.position.x > R) this.position.x = R;
    if (this.position.x < -R) this.position.x = -R;
    if (this.position.z > R) this.position.z = R;
    if (this.position.z < -R) this.position.z = -R;
    if (this.position.y < 1.0) this.position.y = 1.0;
    if (this.position.y > 30) this.position.y = 30;

    // Apply to camera
    this.camera.position.copy(this.position);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
