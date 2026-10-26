import * as THREE from 'three';
import { glowTexture, slashTexture } from './utils.js';

const PARTICLE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (260.0 / max(1.0, -mv.z));
    vAlpha = aAlpha;
    vColor = aColor;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float a = smoothstep(0.5, 0.02, d);
    a *= a;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

const TRAIL_VERT = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TRAIL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha * 0.85);
  }
`;

class ParticlePool {
  constructor(scene, capacity = 900) {
    this.capacity = capacity;
    this.cursor = 0;
    this.positions = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.colors = new Float32Array(capacity * 3);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.positions.fill(-9999);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < capacity; i++) this.alphas[i] = 0;
  }

  spawn(position, options, rng) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const i3 = i * 3;
    const spread = options.spread ?? 0.25;
    this.positions[i3] = position.x + (rng() - 0.5) * spread * 2;
    this.positions[i3 + 1] = position.y + (rng() - 0.5) * spread * 2;
    this.positions[i3 + 2] = position.z + (rng() - 0.5) * spread * 2;

    const dir = options.direction;
    const speed = options.speed ?? 2;
    let vx;
    let vy;
    let vz;
    if (dir) {
      vx = dir.x * speed + (rng() - 0.5) * (options.wander ?? 2);
      vy = dir.y * speed + (rng() - 0.5) * (options.wander ?? 2);
      vz = dir.z * speed + (rng() - 0.5) * (options.wander ?? 2);
    } else {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 2 - 1);
      const s = speed * (0.35 + rng() * 0.85);
      vx = Math.sin(phi) * Math.cos(theta) * s;
      vy = Math.cos(phi) * s + (options.up ?? 0.8);
      vz = Math.sin(phi) * Math.sin(theta) * s;
    }
    this.velocities[i3] = vx;
    this.velocities[i3 + 1] = vy;
    this.velocities[i3 + 2] = vz;

    const life = (options.life ?? 1) * (0.55 + rng() * 0.8);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.baseSize[i] = (options.size ?? 0.1) * (0.7 + rng() * 0.7);
    this.sizes[i] = this.baseSize[i];
    this.alphas[i] = 1;
    this.gravity[i] = options.gravity ?? -3;
    this.drag[i] = options.drag ?? 0.6;

    const color = new THREE.Color(options.color ?? 0x5df4ff);
    color.offsetHSL((rng() - 0.5) * (options.hue ?? 0.03), 0, (rng() - 0.5) * (options.light ?? 0.15));
    this.colors[i3] = color.r;
    this.colors[i3 + 1] = color.g;
    this.colors[i3 + 2] = color.b;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alphas[i] = 0;
        continue;
      }
      const i3 = i * 3;
      const drag = Math.max(0, 1 - this.drag[i] * dt);
      this.velocities[i3] *= drag;
      this.velocities[i3 + 1] = this.velocities[i3 + 1] * drag + this.gravity[i] * dt;
      this.velocities[i3 + 2] *= drag;
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alphas[i] = t * t * (3 - 2 * t);
      this.sizes[i] = this.baseSize[i] * (0.4 + t * 0.6);
    }
    if (any) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.aAlpha.needsUpdate = true;
      this.geometry.attributes.aSize.needsUpdate = true;
    }
  }

  clear() {
    this.life.fill(0);
    this.alphas.fill(0);
    this.positions.fill(-9999);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

class RibbonTrail {
  constructor(scene, color = 0x5df4ff, maxSamples = 30) {
    this.maxSamples = maxSamples;
    this.samples = [];
    this.spawnTimer = 0;
    this.rng = Math.random;
    const verts = maxSamples * 2;
    this.positions = new Float32Array(verts * 3);
    this.alphas = new Float32Array(verts);
    const indices = [];
    for (let i = 0; i < maxSamples - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setIndex(indices);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      uniforms: { uColor: { value: new THREE.Color(color) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  reset() {
    this.samples.length = 0;
    this.geometry.setDrawRange(0, 0);
  }

  update(dt, position, active) {
    this.spawnTimer -= dt;
    if (active && this.spawnTimer <= 0) {
      this.spawnTimer = 0.022;
      this.samples.unshift({ x: position.x, z: position.z, age: 0 });
      if (this.samples.length > this.maxSamples) this.samples.pop();
    }
    for (const sample of this.samples) sample.age += dt;
    while (this.samples.length && this.samples[this.samples.length - 1].age > 0.42) this.samples.pop();
    const count = this.samples.length;
    if (count < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }
    for (let i = 0; i < count; i++) {
      const s = this.samples[i];
      const t = i / (count - 1);
      const width = 0.05 + t * 0.5;
      const fade = Math.pow(1 - s.age / 0.42, 1.4);
      const a = t * 2;
      const y = 0.42 + t * 0.16;
      this.positions[a * 3] = s.x - width;
      this.positions[a * 3 + 1] = y;
      this.positions[a * 3 + 2] = s.z;
      this.positions[(a + 1) * 3] = s.x + width;
      this.positions[(a + 1) * 3 + 1] = y;
      this.positions[(a + 1) * 3 + 2] = s.z;
      this.alphas[a] = fade * 0.28;
      this.alphas[a + 1] = fade * 0.28;
    }
    this.geometry.setDrawRange(0, (count - 1) * 6);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

export class VFX {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.rng = Math.random;
    this.root = new THREE.Group();
    this.root.name = 'vfx';
    scene.add(this.root);
    this.particles = new ParticlePool(scene, 1100);
    this.glow = glowTexture();
    this.slashTex = slashTexture();

    this.slashes = [];
    this.rings = [];
    this.kunai = [];
    this.speedLines = [];
    this.timer = 0;
    this.speedTimer = 0;
    this.trail = null;

    this._makeSlashPool(9);
    this._makeRingPool(10);
    this._makeKunaiPool(6);
    this._makeSpeedLines(16);
  }

  reset(heroPosition) {
    this.particles.clear();
    for (const s of this.slashes) {
      s.life = 0;
      s.mesh.visible = false;
    }
    for (const r of this.rings) {
      r.life = 0;
      r.mesh.visible = false;
    }
    for (const k of this.kunai) {
      k.active = false;
      k.group.visible = false;
    }
    for (const l of this.speedLines) {
      l.life = 0;
      l.mesh.visible = false;
    }
    if (this.trail) this.trail.reset();
    else if (heroPosition) {
      this.trail = new RibbonTrail(this.scene, 0x5df4ff);
    }
  }

  _makeSlashPool(count) {
    const geo = new THREE.PlaneGeometry(4.4, 4.4);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.slashTex,
        color: 0xd9fdff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 5;
      this.root.add(mesh);
      this.slashes.push({ mesh, mat, life: 0, maxLife: 0.28, spin: 0, scale: 1 });
    }
  }

  _makeRingPool(count) {
    const geo = new THREE.RingGeometry(0.78, 1, 64, 1);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x7af7ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.root.add(mesh);
      this.rings.push({ mesh, mat, life: 0, maxLife: 0.7, from: 0.5, to: 5, vertical: false });
    }
  }

  _makeKunaiPool(count) {
    const blade = new THREE.ConeGeometry(0.055, 0.42, 4);
    blade.rotateX(Math.PI / 2);
    const ring = new THREE.TorusGeometry(0.058, 0.012, 5, 10);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, 0, -0.26);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1b3138,
      emissive: 0x2fd8ea,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.7,
    });
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(blade, mat), new THREE.Mesh(ring, mat));
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glow,
          color: 0x6df7ff,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.7,
          toneMapped: false,
        })
      );
      halo.scale.set(0.7, 0.7, 1);
      group.add(halo);
      group.visible = false;
      this.root.add(group);
      this.kunai.push({
        group,
        active: false,
        t: 0,
        duration: 0.4,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        mid: new THREE.Vector3(),
        onHit: null,
        emit: 0,
      });
    }
  }

  _makeSpeedLines(count) {
    const geo = new THREE.PlaneGeometry(0.045, 2.2);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9ef8ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.root.add(mesh);
      this.speedLines.push({ mesh, mat, life: 0, maxLife: 0.45, speed: 0 });
    }
  }

  burst(position, options = {}) {
    const count = options.count ?? 18;
    for (let i = 0; i < count; i++) this.particles.spawn(position, options, this.rng);
  }

  spark(position, direction, color = 0x9ff8ff, count = 5, speed = 5) {
    this.burst(position, { count, color, direction, speed, spread: 0.12, size: 0.06, life: 0.45, wander: 2.6, gravity: -5 });
  }

  gateBurst(position, color = 0x5df4ff) {
    this.ring(position.clone().setY(0.12), { color, from: 0.4, to: 4.5, life: 0.8 });
    this.burst(position.clone().add(new THREE.Vector3(0, 0.8, 0)), {
      color,
      count: 42,
      speed: 3.5,
      up: 2.6,
      spread: 0.7,
      size: 0.16,
      life: 1.1,
      gravity: 1.2,
      drag: 1.3,
      light: 0.3,
    });
    this.burst(position.clone().add(new THREE.Vector3(0, 0.15, 0)), {
      color: 0xffffff,
      count: 16,
      speed: 7,
      up: 0.4,
      spread: 0.2,
      size: 0.1,
      life: 0.5,
      gravity: -2,
    });
  }

  slash(position, angle = 0, color = 0xd8fdff, scale = 1) {
    let slot = this.slashes.find((s) => s.life <= 0);
    if (!slot) slot = this.slashes.reduce((a, b) => (a.life < b.life ? a : b));
    slot.mesh.visible = true;
    slot.mesh.position.copy(position);
    slot.mesh.quaternion.copy(this.camera.quaternion);
    slot.mesh.rotateZ(angle);
    slot.mesh.scale.setScalar(0.6 * scale);
    slot.mat.color.setHex(color === 0xd8fdff ? 0xd8fdff : color);
    slot.mat.opacity = 0.95;
    slot.life = 0.28;
    slot.maxLife = 0.28;
    slot.spin = (this.rng() - 0.5) * 2.4;
    slot.scale = scale;
    this.spark(position, null, color, 9, 6);
  }

  ring(position, { color = 0x5df4ff, from = 0.5, to = 5, life = 0.7, vertical = false } = {}) {
    let slot = this.rings.find((r) => r.life <= 0);
    if (!slot) slot = this.rings.reduce((a, b) => (a.life < b.life ? a : b));
    slot.mesh.visible = true;
    slot.mesh.position.copy(position);
    slot.mesh.rotation.set(vertical ? 0 : -Math.PI / 2, 0, 0);
    if (vertical) slot.mesh.quaternion.copy(this.camera.quaternion);
    slot.mat.color.setHex(color);
    slot.mat.opacity = 0.85;
    slot.mesh.scale.setScalar(from);
    slot.from = from;
    slot.to = to;
    slot.life = life;
    slot.maxLife = life;
    slot.vertical = vertical;
  }

  throwKunai(from, to, { color = 0x5df4ff, duration = 0.38, onHit = null } = {}) {
    let slot = this.kunai.find((k) => !k.active);
    if (!slot) slot = this.kunai[0];
    slot.active = true;
    slot.t = 0;
    slot.duration = duration;
    slot.from.copy(from);
    slot.to.copy(to);
    slot.mid.copy(from).lerp(to, 0.5).add(new THREE.Vector3(0, Math.min(3.2, from.distanceTo(to) * 0.12), 0));
    slot.onHit = onHit;
    slot.emit = 0;
    slot.color = color;
    slot.group.visible = true;
    slot.group.position.copy(from);
    slot.group.children[2].material.color.setHex(color);
    slot.group.lookAt(to);
    return slot;
  }

  speedStreak(heroPosition) {
    let slot = this.speedLines.find((s) => s.life <= 0);
    if (!slot) return;
    const side = this.rng() > 0.5 ? 1 : -1;
    slot.mesh.visible = true;
    slot.mesh.position.set(
      heroPosition.x + side * (1.8 + this.rng() * 5.5),
      0.4 + this.rng() * 3.8,
      heroPosition.z + (this.rng() - 0.35) * 18 - 6
    );
    slot.mesh.quaternion.copy(this.camera.quaternion);
    slot.mesh.scale.set(1, 0.6 + this.rng() * 1.2, 1);
    slot.mat.opacity = 0.22 + this.rng() * 0.24;
    slot.life = 0.32 + this.rng() * 0.2;
    slot.maxLife = slot.life;
    slot.speed = 21 + this.rng() * 16;
  }

  bossSlam(position) {
    this.ring(position.clone().setY(0.15), { color: 0xff5b54, from: 0.8, to: 9, life: 0.85 });
    this.ring(position.clone().setY(0.16), { color: 0xffd9a6, from: 0.3, to: 5, life: 0.55 });
    this.burst(position.clone().setY(0.4), {
      color: 0xff7c54,
      count: 46,
      speed: 7,
      up: 4,
      spread: 0.8,
      size: 0.22,
      life: 1.2,
      gravity: -5,
      light: 0.3,
    });
    this.burst(position.clone().setY(0.2), {
      color: 0x3a3d39,
      count: 26,
      speed: 4,
      up: 1.2,
      spread: 1.4,
      size: 0.5,
      life: 1.4,
      gravity: -1,
      drag: 1.6,
    });
  }

  coreStrike(position) {
    this.burst(position, {
      color: 0xffe0a0,
      count: 60,
      speed: 9,
      spread: 0.4,
      size: 0.2,
      life: 1.1,
      gravity: -1.5,
      light: 0.35,
    });
    this.burst(position, {
      color: 0x5df4ff,
      count: 30,
      speed: 4,
      spread: 0.8,
      size: 0.3,
      life: 1.4,
      gravity: 1.5,
      drag: 1.4,
    });
    this.ring(position, { color: 0xffdf9c, from: 0.4, to: 7, life: 0.6, vertical: true });
  }

  squadBreak(position) {
    this.ring(position.clone().setY(0.12), { color: 0xff5c5c, from: 0.5, to: 6, life: 0.6 });
    this.burst(position.clone().setY(1), {
      color: 0xff596d,
      count: 34,
      speed: 5,
      up: 2.5,
      spread: 1.2,
      size: 0.22,
      life: 1.2,
      gravity: -3.5,
      light: 0.25,
    });
    this.burst(position.clone().setY(0.4), {
      color: 0x181d22,
      count: 20,
      speed: 3,
      up: 1,
      spread: 1.5,
      size: 0.5,
      life: 1.1,
      gravity: 0.4,
      drag: 1.5,
    });
  }

  explode(position) {
    this.burst(position, {
      color: 0xffc46e,
      count: 70,
      speed: 12,
      spread: 0.5,
      size: 0.3,
      life: 1.3,
      gravity: -2,
      light: 0.35,
    });
    this.burst(position, {
      color: 0x5df4ff,
      count: 40,
      speed: 6,
      spread: 0.8,
      size: 0.4,
      life: 1.6,
      gravity: 2,
      drag: 1.5,
    });
    this.ring(position.clone().setY(0.12), { color: 0xf4c47c, from: 0.5, to: 10, life: 1 });
  }

  update(dt, options = {}) {
    this.particles.update(dt);
    for (const s of this.slashes) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        continue;
      }
      const t = 1 - s.life / s.maxLife;
      const ease = 1 - Math.pow(1 - t, 3);
      s.mesh.quaternion.copy(this.camera.quaternion);
      s.mesh.rotateZ(s.spin * ease);
      s.mesh.scale.setScalar((0.62 + ease * 0.9) * s.scale);
      s.mat.opacity = (1 - t) * 0.95;
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.mesh.visible = false;
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      const scale = r.from + (r.to - r.from) * (1 - Math.pow(1 - t, 2.5));
      r.mesh.scale.setScalar(scale);
      r.mat.opacity = (1 - t) * 0.8;
      if (r.vertical) r.mesh.quaternion.copy(this.camera.quaternion);
    }
    for (const k of this.kunai) {
      if (!k.active) continue;
      k.t += dt;
      const t = Math.min(1, k.t / k.duration);
      const p = (1 - t) * (1 - t);
      const q = 2 * (1 - t) * t;
      const w = t * t;
      k.group.position.set(
        p * k.from.x + q * k.mid.x + w * k.to.x,
        p * k.from.y + q * k.mid.y + w * k.to.y,
        p * k.from.z + q * k.mid.z + w * k.to.z
      );
      k.group.lookAt(k.to);
      k.emit -= dt;
      if (k.emit <= 0) {
        k.emit = 0.025;
        this.particles.spawn(k.group.position, {
          color: k.color,
          count: 1,
          speed: 0.5,
          spread: 0.05,
          size: 0.16,
          life: 0.32,
          gravity: 0,
          drag: 2,
        }, this.rng);
      }
      if (t >= 1) {
        k.active = false;
        k.group.visible = false;
        this.burst(k.to, {
          color: k.color,
          count: 22,
          speed: 4,
          spread: 0.25,
          size: 0.14,
          life: 0.7,
          gravity: -2,
          light: 0.3,
        });
        if (k.onHit) k.onHit(k.to);
      }
    }
    for (const l of this.speedLines) {
      if (l.life <= 0) continue;
      l.life -= dt;
      if (l.life <= 0) {
        l.mesh.visible = false;
        continue;
      }
      const t = 1 - l.life / l.maxLife;
      l.mesh.position.z += l.speed * dt;
      l.mat.opacity = Math.sin(t * Math.PI) * 0.32;
      l.mesh.quaternion.copy(this.camera.quaternion);
    }

    if (options.heroPosition) {
      if (!this.trail) this.trail = new RibbonTrail(this.scene, 0x5df4ff);
      this.trail.update(dt, options.heroPosition, !!options.running);
      this.speedTimer -= dt;
      if (options.running && this.speedTimer <= 0) {
        this.speedTimer = 0.045;
        this.speedStreak(options.heroPosition);
      }
    }
  }
}
