import * as THREE from "three";
import { WORLD } from "@mhfps/shared";
import { terrainHeight } from "./worldV3.js";

// FPS controller: gravity + jump, no flight. Pointer-lock.
const GRAVITY = 20;
const JUMP_V = 8;
const RUN_MULT = 2.25;   // v0.0.3.4: +50% к предыдущим 1.5× → 2.25×
const DASH_IMPULSE = 18; // м/с мгновенная вспышка
const DASH_CD = 1.2;

export class FpsController {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    // ФИКС: YXZ order выставляем единожды, чтобы camera.rotation.y = yaw
    // везде давал одинаковую матрицу (без этого Mac мог получать XYZ).
    camera.rotation.order = "YXZ";
    this.position = new THREE.Vector3(0, 0, 4);
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
      const MAX = 2000; // абсолютный кап
      if (Math.abs(dx) > MAX || Math.abs(dy) > MAX) return;
      // НЕ делим на dpr — pointer-lock movementX уже в логических пикселях на всех платформах
      this.yaw   -= dx * 0.0022;
      this.pitch -= dy * 0.0022;
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

    // v0.0.3.0: Q/E — дэш влево/вправо. Shift — бег x1.5 без стамины.
    if (this.dashCd <= 0) {
      if (this.keys.KeyQ) {
        this.vel.add(right.clone().multiplyScalar(-DASH_IMPULSE));
        this.dashCd = DASH_CD;
      } else if (this.keys.KeyE) {
        this.vel.add(right.clone().multiplyScalar(DASH_IMPULSE));
        this.dashCd = DASH_CD;
      }
    }
    let speed = baseSpeed;
    if (this.keys.ShiftLeft || this.keys.ShiftRight) speed *= RUN_MULT;
    // Дебаг: множитель скорости
    const mul = window.room?.state?.dbgSpeedMul;
    if (mul && mul !== 1) speed *= mul;
    // Пассивка SWIFTBOOT — +30% скорости
    if (myPlayer?.passiveItemId === "SWIFTBOOT") speed *= 1.3;
    this.dashCd = Math.max(0, this.dashCd - dt);

    this.vel.x = move.x * speed;
    this.vel.z = move.z * speed;

    // Дебаг FLY: Space вверх, Ctrl/C вниз, без гравитации. v0.0.3.4: скорость ✕ 6 от baseline — админ-режим
    const dbgFly = !!(window.room?.state?.dbgFly);
    if (dbgFly) {
      const flySpeed = speed * 6; // в режиме полёта все оси в 6× быстрее (примерно +500%)
      this.vel.x = move.x * flySpeed;
      this.vel.z = move.z * flySpeed;
      let vy = 0;
      if (this.keys.Space) vy += flySpeed;
      if (this.keys.KeyC || this.keys.ControlLeft || this.keys.ControlRight) vy -= flySpeed;
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

    // v0.0.3.0: карта 1200м (radius 600), терраин height
    const R = WORLD.ARENA_RADIUS || 100;
    if (this.position.x > R) this.position.x = R;
    if (this.position.x < -R) this.position.x = -R;
    if (this.position.z > R) this.position.z = R;
    if (this.position.z < -R) this.position.z = -R;
    // v0.0.3.7: в хабе пол всегда y=1.6 (плоский). Только на арене используем terrainHeight.
    const inHub = window.room?.state?.phase === "hub";
    const groundY = inHub
  ? 0
  : terrainHeight(
      this.position.x,
      this.position.z,
      arenaGroup.userData.holes,
    );
    // Проверка попадания в дыру на арене (arenaGroup.userData.holes) — если в радиусе, не ставим ground
    let inHole = false;
    try {
      const holes = window._arenaHoles;
      if (holes && holes.length && !dbgFly && !inHub) {
        for (const h of holes) {
          const dx = this.position.x - h.x, dz = this.position.z - h.z;
          if (dx*dx + dz*dz < h.r * h.r) { inHole = true; break; }
        }
      }
    } catch {}
    if (dbgFly) {
      if (this.position.y < groundY) this.position.y = groundY;
      if (this.position.y > 60) this.position.y = 60;
    } else if (inHole) {
      // в дыре — свободное падение до y=-10 (fall→respawn)
      // гравитация уже действует, не трогаем ground
      this.grounded = false;
    } else if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.vel.y = 0;
      this.grounded = true;
    }

    this.camera.position.copy(this.position);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0; // важно: если z случайно получит не-ноль, экран наклонится и прицел уедет
  }
}
