import * as THREE from 'three';
import { clamp, damp, easeOutCubic, makePart, mergeParts, TAU } from './utils.js';

const CAPACITY = 84;
const ROW_WIDTH = 7;

const COLORS = {
  cloth: 0x152435,
  clothLight: 0x20364a,
  shadow: 0x0a1119,
  steel: 0x26343d,
  belt: 0x6e1a25,
  mask: 0x9aa6a3,
  wrap: 0x5a161e,
  scarf: 0x38d7e8,
  scarfDim: 0x1b9cb0,
};

function buildCloneBody() {
  const parts = [];
  const box = (w, h, d, color, pos, rot, scale) =>
    makePart(new THREE.BoxGeometry(w, h, d), color, pos, rot, scale);

  for (const side of [-1, 1]) {
    parts.push(
      box(0.19, 0.68, 0.2, COLORS.cloth, [side * 0.16, 0.4, 0.02], [side * 0.42, 0, side * 0.04])
    );
    parts.push(
      box(0.21, 0.12, 0.36, COLORS.shadow, [side * 0.16, 0.06, side * 0.2 + 0.02], [0, side * 0.08, 0])
    );
    parts.push(
      box(0.2, 0.2, 0.24, COLORS.belt, [side * 0.16, 0.76, 0], [0, 0, 0])
    );
    parts.push(
      box(0.16, 0.5, 0.17, COLORS.cloth, [side * 0.38, 1.04, side * 0.09], [side * 0.6, 0, side * 0.14])
    );
    parts.push(
      box(0.12, 0.12, 0.16, COLORS.mask, [side * 0.4, 0.8, side * 0.26 + 0.02], [0, 0, 0])
    );
    parts.push(
      box(0.23, 0.24, 0.3, COLORS.clothLight, [side * 0.35, 1.29, 0], [0, 0, side * 0.16])
    );
  }
  parts.push(box(0.55, 0.56, 0.31, COLORS.cloth, [0, 1.04, 0], [0.03, 0, 0]));
  parts.push(box(0.48, 0.2, 0.34, COLORS.clothLight, [0, 1.2, 0.01]));
  parts.push(box(0.61, 0.11, 0.35, COLORS.belt, [0, 0.78, 0]));
  parts.push(box(0.14, 0.28, 0.08, COLORS.belt, [0.12, 0.67, -0.2], [0.2, 0.2, 0.1]));
  parts.push(box(0.15, 0.15, 0.15, COLORS.shadow, [0, 1.37, 0]));
  parts.push(makePart(new THREE.SphereGeometry(0.225, 9, 7), COLORS.cloth, [0, 1.56, 0]));
  parts.push(box(0.29, 0.16, 0.06, COLORS.mask, [0, 1.52, 0.2]));
  parts.push(box(0.26, 0.045, 0.04, COLORS.belt, [0, 1.66, 0.195]));
  parts.push(
    makePart(new THREE.ConeGeometry(0.16, 0.32, 6), COLORS.cloth, [0, 1.77, -0.08], [0.5, 0, 0])
  );
  parts.push(box(0.06, 0.9, 0.06, COLORS.steel, [0.18, 1.04, -0.23], [0.12, 0.06, 0.95]));
  parts.push(box(0.08, 0.24, 0.08, COLORS.wrap, [-0.2, 1.34, -0.23], [0.12, 0.06, 0.95]));
  return mergeParts(parts);
}

function buildCloneScarf() {
  const parts = [];
  const box = (w, h, d, color, pos, rot) => makePart(new THREE.BoxGeometry(w, h, d), color, pos, rot);
  parts.push(box(0.3, 0.07, 0.14, COLORS.scarf, [0, 1.36, -0.16]));
  parts.push(box(0.13, 0.02, 0.75, COLORS.scarf, [-0.08, 1.27, -0.56], [0.16, -0.12, 0.06]));
  parts.push(box(0.1, 0.02, 0.95, COLORS.scarfDim, [0.09, 1.17, -0.64], [0.12, 0.18, -0.1]));
  parts.push(box(0.09, 0.42, 0.02, COLORS.scarf, [0.06, 1.05, -0.19], [0.16, 0, 0.12]));
  return mergeParts(parts);
}

function buildCloneEyes() {
  const parts = [];
  for (const side of [-1, 1]) {
    parts.push(makePart(new THREE.BoxGeometry(0.05, 0.035, 0.024), 0x5df4ff, [side * 0.075, 1.59, 0.215]));
  }
  return mergeParts(parts);
}

export class CloneArmy {
  constructor(scene, vfx) {
    this.vfx = vfx;
    this.scene = scene;
    this.capacity = CAPACITY;
    this.count = 0;
    this.visible = 0;
    this.mode = 'run';
    this.cheerT = 0;
    this.flashT = 0;
    this.rng = Math.random;
    this.tmpBoss = new THREE.Vector3();
    this.center = new THREE.Vector3();

    const bodyGeo = buildCloneBody();
    const scarfGeo = buildCloneScarf();
    const eyeGeo = buildCloneEyes();

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.62,
      metalness: 0.16,
      emissive: 0x03121a,
      emissiveIntensity: 1.1,
    });
    this.scarfMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x5df4ff, toneMapped: false });

    this.bodyMesh = new THREE.InstancedMesh(bodyGeo, this.bodyMaterial, CAPACITY);
    this.scarfMesh = new THREE.InstancedMesh(scarfGeo, this.scarfMaterial, CAPACITY);
    this.eyeMesh = new THREE.InstancedMesh(eyeGeo, this.eyeMaterial, CAPACITY);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.scarfMesh.castShadow = false;
    this.scarfMesh.receiveShadow = false;
    this.eyeMesh.castShadow = false;
    this.eyeMesh.receiveShadow = false;
    for (const mesh of [this.bodyMesh, this.scarfMesh, this.eyeMesh]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(mesh);
    }
    this.eyeMesh.renderOrder = 3;
    this.scarfMesh.renderOrder = 2;

    this.clones = [];
    const dummy = new THREE.Object3D();
    dummy.position.set(0, -999, 0);
    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    for (let i = 0; i < CAPACITY; i++) {
      this.clones.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        targetX: 0,
        targetZ: 0,
        yaw: Math.PI,
        targetYaw: Math.PI,
        phase: this.rng() * TAU,
        speed: 3.2 + this.rng() * 1.6,
        scale: 0.92 + this.rng() * 0.14,
        spawnT: 1,
        bobPhase: this.rng() * TAU,
        jitterX: (this.rng() - 0.5) * 0.16,
        jitterZ: (this.rng() - 0.5) * 0.18,
      });
      this.bodyMesh.setMatrixAt(i, dummy.matrix);
      this.scarfMesh.setMatrixAt(i, dummy.matrix);
      this.eyeMesh.setMatrixAt(i, dummy.matrix);
    }
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.scarfMesh.instanceMatrix.needsUpdate = true;
    this.eyeMesh.instanceMatrix.needsUpdate = true;
    this.dummy = new THREE.Object3D();
  }

  reset(count, heroPosition) {
    this.count = clamp(Math.round(count), 0, 99);
    this.visible = Math.min(this.count, this.capacity);
    this.cheerT = 0;
    this.flashT = 0;
    this.mode = 'run';
    for (let i = 0; i < this.capacity; i++) {
      const clone = this.clones[i];
      clone.active = i < this.visible;
      const target = this._formationTarget(i, this.visible, heroPosition.x, heroPosition.z);
      clone.x = target.x;
      clone.z = target.z;
      clone.y = heroPosition.y;
      clone.targetX = target.x;
      clone.targetZ = target.z;
      clone.yaw = Math.PI;
      clone.targetYaw = Math.PI;
      clone.spawnT = 1;
      clone.scale = 0.92 + this.rng() * 0.14;
      if (clone.active) this._writeMatrix(i, 0, heroPosition.y, 0);
      else this._hideInstance(i);
    }
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.scarfMesh.instanceMatrix.needsUpdate = true;
    this.eyeMesh.instanceMatrix.needsUpdate = true;
  }

  _formationTarget(i, visible, heroX, heroZ) {    const row = Math.floor(i / ROW_WIDTH);
    const rowStart = row * ROW_WIDTH;
    const rowCount = Math.min(ROW_WIDTH, visible - rowStart);
    const col = i - rowStart;
    const stagger = row % 2 === 0 ? 0 : 0.4;
    return {
      x: clamp(heroX * 0.82 + (col - (rowCount - 1) / 2) * 0.92 + stagger, -4.2, 4.2),
      z: heroZ + 1.9 + row * 0.95,
    };
  }

  setCount(next, heroPosition) {
    next = clamp(Math.round(next), 0, 99);
    const previous = this.count;
    if (next === previous) return;
    this.count = next;
    const prevVisible = Math.min(previous, this.capacity);
    const nextVisible = Math.min(next, this.capacity);
    this.visible = nextVisible;

    if (nextVisible > prevVisible) {
      for (let i = prevVisible; i < nextVisible; i++) {
        const clone = this.clones[i];
        clone.active = true;
        clone.spawnT = 0;
        clone.x = heroPosition.x + (this.rng() - 0.5) * 2.2;
        clone.z = heroPosition.z + 1.2 + this.rng() * 2.6;
        clone.y = heroPosition.y;
        clone.yaw = Math.PI;
        clone.targetYaw = Math.PI;
      }
      const added = nextVisible - prevVisible;
      if (added > 0) {
        this.vfx.burst(
          new THREE.Vector3(heroPosition.x, heroPosition.y + 0.7, heroPosition.z + 1.2),
          {
            color: 0x5df4ff,
            count: Math.min(46, 12 + added * 2),
            speed: 3 + Math.min(5, added * 0.2),
            spread: 0.8,
            up: 2.2,
            size: 0.19,
            life: 0.9,
            gravity: 1.2,
            drag: 1.2,
            light: 0.28,
          }
        );
        if (added >= 6) {
          this.vfx.ring(
            new THREE.Vector3(heroPosition.x, heroPosition.y + 0.04, heroPosition.z),
            { color: 0x5df4ff, from: 0.4, to: 3.4, life: 0.55 }
          );
        }
      }
    } else if (nextVisible < prevVisible) {
      const removed = [];
      for (let i = nextVisible; i < prevVisible; i++) {
        const clone = this.clones[i];
        removed.push({ x: clone.x, y: clone.y, z: clone.z });
        clone.active = false;
        this._hideInstance(i);
      }
      for (let i = 0; i < Math.min(removed.length, 9); i++) {
        const p = removed[i];
        this.vfx.burst(new THREE.Vector3(p.x, p.y + 0.8, p.z), {
          color: 0x74f5ff,
          count: 8,
          speed: 2.2,
          spread: 0.2,
          size: 0.12,
          life: 0.55,
          gravity: -1.5,
          light: 0.2,
        });
      }
      if (removed.length > 0) {
        const c = removed[Math.floor(removed.length / 2)];
        this.vfx.ring(new THREE.Vector3(c.x, c.y + 0.04, c.z), {
          color: 0x9ef8ff,
          from: 0.3,
          to: 2.2,
          life: 0.4,
        });
      }
    }
  }

  cheer() {
    this.cheerT = 0.9;
    const c = this.center;
    this.vfx.ring(new THREE.Vector3(c.x, c.y + 0.05, c.z), {
      color: 0x5df4ff,
      from: 0.4,
      to: 4,
      life: 0.6,
    });
  }

  stormFlash() {
    this.flashT = 1.5;
  }

  _hideInstance(index) {
    const dummy = this.dummy;
    dummy.position.set(0, -999, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    this.bodyMesh.setMatrixAt(index, dummy.matrix);
    this.scarfMesh.setMatrixAt(index, dummy.matrix);
    this.eyeMesh.setMatrixAt(index, dummy.matrix);
  }

  _writeMatrix(index, bob, groundY, elapsed) {
    const clone = this.clones[index];
    const dummy = this.dummy;
    const spawn = easeOutCubic(clamp(clone.spawnT, 0, 1));
    const scale = clone.scale * (0.001 + spawn * 0.999);
    dummy.position.set(clone.x, clone.y + bob, clone.z);
    dummy.rotation.set(0, clone.yaw, Math.sin(elapsed * 2 + clone.phase) * 0.05);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    this.bodyMesh.setMatrixAt(index, dummy.matrix);
    this.scarfMesh.setMatrixAt(index, dummy.matrix);
    this.eyeMesh.setMatrixAt(index, dummy.matrix);
  }

  update(dt, elapsed, heroPosition, mode = 'run', bossPosition = null) {
    this.mode = mode;
    if (bossPosition) this.tmpBoss.copy(bossPosition);
    this.cheerT = Math.max(0, this.cheerT - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    const cheer = this.cheerT > 0 ? Math.abs(Math.sin(this.cheerT * 12)) * 0.22 : 0;
    let sumX = 0;
    let sumZ = 0;
    const active = this.visible;

    for (let i = 0; i < active; i++) {
      const clone = this.clones[i];
      if (!clone.active) continue;
      clone.spawnT = Math.min(1, clone.spawnT + dt * 3.6);

      let targetX;
      let targetZ;
      let faceYaw;
      if (mode === 'boss' && bossPosition) {
        const row = Math.floor(i / 36);
        const slot = i % 36;
        const side = slot % 2 === 0 ? -1 : 1;
        const along = Math.floor(slot / 2) / 17;
        const ring = 6.6 + row * 1.2;
        const angle = side * (0.98 + along * 0.75);
        targetX = bossPosition.x + Math.sin(angle) * ring;
        targetZ = bossPosition.z + Math.cos(angle) * ring;
        const lunge = Math.sin(elapsed * 2.4 + clone.phase) * 0.28;
        targetX += Math.sin(angle) * lunge;
        targetZ += Math.cos(angle) * lunge;
        faceYaw = Math.atan2(bossPosition.x - clone.x, bossPosition.z - clone.z);
      } else {
        const slot = this._formationTarget(i, active, heroPosition.x, heroPosition.z);
        targetX = slot.x + clone.jitterX;
        targetZ = slot.z + clone.jitterZ;
        faceYaw = Math.PI + Math.sin(elapsed * 1.9 + clone.phase) * 0.08;
      }
      clone.targetX = targetX;
      clone.targetZ = targetZ;
      clone.targetYaw = faceYaw;

      const rate = clone.spawnT < 1 ? 6.5 : 3.1;
      clone.x = damp(clone.x, targetX, rate, dt);
      clone.z = damp(clone.z, targetZ, rate * 1.15, dt);
      clone.y = damp(clone.y, heroPosition.y, 9, dt);
      let delta = ((faceYaw - clone.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
      clone.yaw += delta * (1 - Math.exp(-6 * dt));

      const bob = Math.abs(Math.sin(elapsed * 6.4 + clone.bobPhase)) * 0.055 + cheer;
      this._writeMatrix(i, bob, heroPosition.y, elapsed);
      sumX += clone.x;
      sumZ += clone.z;
    }

    if (active > 0) {
      this.center.set(sumX / active, heroPosition.y, sumZ / active);
    } else {
      this.center.copy(heroPosition);
    }

    if (this.flashT > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(this.flashT * 30);
      this.eyeMaterial.color.setRGB(0.9, 0.82 + pulse * 0.18, 0.5 + pulse * 0.3);
      this.scarfMaterial.color.setRGB(1, 0.78 + pulse * 0.2, 0.45);
      this.scarfMaterial.opacity = 0.7;
    } else {
      this.eyeMaterial.color.setHex(0x5df4ff);
      this.scarfMaterial.color.setHex(0xffffff);
      this.scarfMaterial.opacity = 0.55;
    }

    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.scarfMesh.instanceMatrix.needsUpdate = true;
    this.eyeMesh.instanceMatrix.needsUpdate = true;
  }
}
