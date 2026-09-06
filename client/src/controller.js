import * as THREE from "three";
import { WORLD } from "@mhfps/shared";

// FPS controller: gravity + jump, no flight. Pointer-lock.
const GRAVITY = 20;
const JUMP_V = 8;

export class FpsController {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.position = new THREE.Vector3(0, 1.6, 4);
    this.yaw = 0;
    this.pitch = 0;
    this.vel = new THREE.Vector3();
    this.grounded = true;
    this.dashTimer = 0;
    this.dashCd = 0;

    this.keys = {};
    document.addEventListener("keydown", (e) => {
      // Перехват Ctrl+W — браузер обычно не даёт, но в pointer-lock шанс есть
      if (e.ctrlKey && (e.code === "KeyW" || e.code === "KeyR" || e.code === "KeyT")) {
        e.preventDefault();
        e.stopPropagation();
      }
      this.keys[e.code] = true;
    }, true);
    document.addEventListener("keyup",   (e) => (this.keys[e.code] = false));
    // Warn при попытке закрыть вкладку — если всё-таки прошло
    window.addEventListener("beforeunload", (e) => {
      if (document.pointerLockElement) {
        e.preventDefault();
        e.returnValue = "Выйти из игры?";
        return "Выйти из игры?";
      }
    });

    canvas.addEventListener("click", () => canvas.requestPointerLock());
    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== canvas) return;
      // Маска от взрывных дельт. НА MAC/RETINA movementX может быть в физических
      // пикселях (dpr=2/3), поэтому cap масштабируем от dpr.
      // Отбрасываем только те что точно глюк (>2000).
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      const dpr = window.devicePixelRatio || 1;
      const MAX = 1000 * dpr; // было 200 — отбрасывало всё движение мыши на Mac
      if (Math.abs(dx) > MAX || Math.abs(dy) > MAX) return;
      // Чувствительность нормализована от dpr, чтобы Retina не крутила в 2× быстрее
      this.yaw   -= dx * 0.0022 / dpr;
      this.pitch -= dy * 0.0022 / dpr;
      // Нормализуем yaw в [-π, π] чтобы не накапливалась ошибка точности на больших числах
      if (this.yaw > Math.PI) this.yaw -= 2 * Math.PI;
      if (this.yaw < -Math.PI) this.yaw += 2 * Math.PI;
      const lim = Math.PI / 2 - 0.05;
      if (this.pitch > lim) this.pitch = lim;
      if (this.pitch < -lim) this.pitch = -lim;
    });
  }

  enable() { this.canvas.requestPointerLock(); }
  releasePointer() { if (document.pointerLockElement === this.canvas) document.exitPointerLock(); }
  setPosition(x, y, z) { this.position.set(x, y, z); this.vel.set(0, 0, 0); this.grounded = true; }

  update(dt, myPlayer) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right   = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new THREE.Vector3();
    if (this.keys.KeyW) move.add(forward);
    if (this.keys.KeyS) move.sub(forward);
    if (this.keys.KeyD) move.add(right);
    if (this.keys.KeyA) move.sub(right);
    if (move.lengthSq() > 0) move.normalize();

    const hasLegs = myPlayer?.hasLegs ?? 0;
    const baseSpeed = hasLegs >= 2 ? WORLD.BASE_MOVE_SPEED : WORLD.BASE_FLY_SPEED;

    if (this.keys.ShiftLeft && this.dashCd <= 0 && move.lengthSq() > 0) {
      this.dashTimer = WORLD.DASH_DURATION;
      this.dashCd = WORLD.DASH_COOLDOWN;
    }
    let speed = baseSpeed;
    if (this.dashTimer > 0) { speed = WORLD.DASH_SPEED; this.dashTimer -= dt; }
    // Дебаг: множитель скорости
    const mul = window.room?.state?.dbgSpeedMul;
    if (mul && mul !== 1) speed *= mul;
    // Пассивка SWIFTBOOT — +30% скорости
    if (myPlayer?.passiveItemId === "SWIFTBOOT") speed *= 1.3;
    this.dashCd = Math.max(0, this.dashCd - dt);

    this.vel.x = move.x * speed;
    this.vel.z = move.z * speed;

    // Дебаг FLY: Space вверх, Ctrl вниз, без гравитации
    const dbgFly = !!(window.room?.state?.dbgFly);
    if (dbgFly) {
      let vy = 0;
      if (this.keys.Space) vy += speed;
      if (this.keys.KeyC || this.keys.ShiftRight) vy -= speed;
      this.vel.y = vy;
      this.grounded = false;
    } else {
      // gravity + jump
      if (this.grounded && this.keys.Space) {
        this.vel.y = JUMP_V;
        this.grounded = false;
      }
      if (!this.grounded) {
        this.vel.y -= GRAVITY * dt;
      }
    }

    this.position.addScaledVector(this.vel, dt);

    const R = 100;
    if (this.position.x > R) this.position.x = R;
    if (this.position.x < -R) this.position.x = -R;
    if (this.position.z > R) this.position.z = R;
    if (this.position.z < -R) this.position.z = -R;
    if (dbgFly) {
      // Летаем — не прилипаем к земле, но потолок есть
      if (this.position.y < 1.6) this.position.y = 1.6;
      if (this.position.y > 60) this.position.y = 60;
    } else if (this.position.y <= 1.6) {
      this.position.y = 1.6;
      this.vel.y = 0;
      this.grounded = true;
    }

    this.camera.position.copy(this.position);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
