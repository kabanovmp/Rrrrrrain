import * as THREE from "three";
import { WORLD, sumItemStat } from "@mhfps/shared";

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
      const MAX = 2000; // абсолютный кап
      if (Math.abs(dx) > MAX || Math.abs(dy) > MAX) return;
      // НЕ делим на dpr — pointer-lock movementX уже в логических пикселях на всех платформах
      this.yaw   -= dx * 0.0022;
      this.pitch -= dy * 0.0022;
      // Нормализуем yaw в [-π, π] чтобы не накапливалась ошибка точности на больших числах
      if (this.yaw > Math.PI) this.yaw -= 2 * Math.PI;
      if (this.yaw < -Math.PI) this.yaw += 2 * Math.PI;
      const lim = 1.15;
      if (this.pitch > lim) this.pitch = lim;
      if (this.pitch < -0.85) this.pitch = -0.85;
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

    const baseSpeed = WORLD.BASE_MOVE_SPEED;

    // Utility (R): рывок вперёд. Q — снаряжение, E — взаимодействие (не дэш).
    if (this.dashCd <= 0 && this.keys.KeyR) {
      this.vel.add(forward.clone().multiplyScalar(DASH_IMPULSE));
      this.dashCd = DASH_CD;
    }
    const dbgFly = !!(window.room?.state?.dbgFly);
    let speed = baseSpeed;
    const crouch = !dbgFly && (this.keys.ControlLeft || this.keys.ControlRight);
    this.crouching = crouch;
    if (this.keys.ShiftLeft || this.keys.ShiftRight) speed *= RUN_MULT;
    if (crouch) speed *= 0.55;
    const mul = window.room?.state?.dbgSpeedMul;
    if (mul && mul !== 1) speed *= mul;
    const mp = (typeof window !== "undefined") ? window.myPlayer : null;
    const moveBonus = sumItemStat(mp, "move");
    if (moveBonus) speed *= 1 + moveBonus;
    this.dashCd = Math.max(0, this.dashCd - dt);

    this.vel.x = move.x * speed;
    this.vel.z = move.z * speed;

    // Дебаг FLY: Space вверх, Ctrl/C вниз, без гравитации. v0.0.3.4: скорость ✕ 6 от baseline — админ-режим
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

    const phase = window.room?.state?.phase;
    const inHub = phase === "hub" || phase === undefined || phase == null;
    const hubR = WORLD.HUB_RADIUS || 36;
    const distXZ = Math.hypot(this.position.x, this.position.z);

    if (!inHub) {
      const R = WORLD.ARENA_RADIUS || 100;
      if (this.position.x > R) this.position.x = R;
      if (this.position.x < -R) this.position.x = -R;
      if (this.position.z > R) this.position.z = R;
      if (this.position.z < -R) this.position.z = -R;
    }

    const groundY = 1.6;
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
    } else if (inHub && distXZ > hubR * 1.02) {
      this.grounded = false;
    } else if (inHole) {
      this.grounded = false;
    } else if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.vel.y = 0;
      this.grounded = true;
    }

    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
    this._camDist = this._camDist ?? (WORLD.CAM_DIST || 6.6);
    const wantDist = (this.grounded ? (WORLD.CAM_DIST || 6.6) : (WORLD.CAM_DIST || 6.6) + 2.4);
    this._camDist += (wantDist - this._camDist) * Math.min(1, dt * 5);
    const dist = this._camDist;
    const shoulder = WORLD.CAM_SHOULDER || 1.05;
    const lift = (WORLD.CAM_LIFT || 0.55) + (this.crouching ? -0.72 : 0);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    this.camera.position.set(
      this.position.x + Math.sin(this.yaw) * cp * dist + Math.cos(this.yaw) * shoulder,
      this.position.y + lift - sp * dist,
      this.position.z + Math.cos(this.yaw) * cp * dist - Math.sin(this.yaw) * shoulder
    );
  }
}
