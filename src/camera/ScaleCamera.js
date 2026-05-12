import * as THREE from 'three';

export class ScaleCamera {
  constructor(camera) {
    this.camera = camera;
    this.zoom = 0.18;
    this.targetZoom = 0.18;
    this.yaw = 0.35;
    this.pitch = 0.18;
    this.targetYaw = 0.35;
    this.targetPitch = 0.18;
    this.focus = new THREE.Vector3();
    this.smoothedFocus = new THREE.Vector3();
    this.scaleLabel = 'outside observer';
    this.focusProvider = null;
    this.lastUserInteraction = 0;
    this.autoOrbit = true;
  }

  setFocusProvider(fn) {
    this.focusProvider = fn;
  }

  markInteraction(time) {
    this.lastUserInteraction = time;
  }

  recenter() {
    this.targetYaw = 0.35;
    this.targetPitch = 0.18;
    this.targetZoom = 0.42;
  }

  setTargetZoom(z) {
    this.targetZoom = Math.max(0, Math.min(1, z));
  }

  nudgeZoom(delta) {
    this.setTargetZoom(this.targetZoom + delta);
  }

  setRotation(yaw, pitch) {
    this.targetYaw = yaw;
    this.targetPitch = Math.max(-1.3, Math.min(1.3, pitch));
  }

  nudgeRotation(dyaw, dpitch) {
    this.setRotation(this.targetYaw + dyaw, this.targetPitch + dpitch);
  }

  update(dt, particles, now = performance.now() / 1000) {
    const focus = this._estimateFocus(particles);
    this.smoothedFocus.lerp(focus, 1 - Math.pow(0.18, Math.max(0.001, dt)));

    const k = 1 - Math.pow(0.012, Math.max(0.001, dt));
    this.zoom += (this.targetZoom - this.zoom) * k;
    this.yaw += (this.targetYaw - this.yaw) * k;
    this.pitch += (this.targetPitch - this.pitch) * k;

    // Cinematic drift when idle: slowly orbit so the universe feels alive.
    if (this.autoOrbit && now - this.lastUserInteraction > 4) {
      this.targetYaw += dt * 0.04;
      this.targetPitch = 0.18 + Math.sin(now * 0.05) * 0.12;
    }

    const radius = THREE.MathUtils.lerp(420, 26, smoothstep(0.0, 0.78, this.zoom));
    const insideMix = smoothstep(0.78, 1.0, this.zoom);
    const fov = THREE.MathUtils.lerp(58, 95, insideMix);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    const cp = Math.cos(this.pitch);
    const eyeOffset = new THREE.Vector3(
      Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cp
    ).multiplyScalar(radius * (1 - insideMix * 0.92));

    const eye = this.smoothedFocus.clone().add(eyeOffset);
    if (insideMix > 0.001) {
      const inside = this.smoothedFocus.clone().add(eyeOffset.clone().multiplyScalar(0.05));
      eye.lerp(inside, insideMix);
    }
    this.camera.position.copy(eye);
    this.camera.lookAt(this.smoothedFocus);

    if (this.zoom < 0.25) this.scaleLabel = 'outside observer';
    else if (this.zoom < 0.78) this.scaleLabel = 'free exploration';
    else this.scaleLabel = 'first person';
  }

  _estimateFocus() {
    if (this.focusProvider) {
      const f = this.focusProvider();
      if (f) return f;
    }
    return this.focus.set(0, 0, 0);
  }
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
