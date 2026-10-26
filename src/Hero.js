import * as THREE from 'three';
import { clamp, damp, TAU } from './utils.js';

export class Hero {
  constructor(gltf, vfx) {
    this.vfx = vfx;
    this.root = new THREE.Group();
    this.root.name = 'hero';
    this.turnGroup = new THREE.Group();
    this.leanGroup = new THREE.Group();
    this.root.add(this.turnGroup);
    this.turnGroup.add(this.leanGroup);

    this.model = gltf.scene;
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of mats) {
            mat.envMapIntensity = 0.85;
            if (mat.name === 'CyanSilk') {
              mat.emissiveIntensity = 1.1;
            }
            if (mat.name === 'KatanaSteel') {
              mat.emissive = new THREE.Color(0x0a2630);
              mat.emissiveIntensity = 0.6;
            }
          }
        }
      }
      if (child.name === 'SwordRoot') this.swordNode = child;
      if (child.name === 'Blade') this.bladeNode = child;
      if (child.name === 'Head') this.headNode = child;
    });
    this.model.scale.setScalar(1.03);
    this.leanGroup.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const action = this.mixer.clipAction(clip);
      this.actions[clip.name] = action;
    }
    this.current = null;
    this.oneShot = false;
    this.returnClip = 'Run';
    this.mixer.addEventListener('finished', (event) => {
      if (event.action === this.actions.Slash) {
        this.play(this.returnClip || 'Run', 0.18);
      } else if (event.action === this.actions.Storm) {
        this.play(this.returnClip || 'Run', 0.3);
      }
    });

    this.facing = 0;
    this.targetFacing = 0;
    this.lean = 0;
    this.auraPhase = Math.random() * TAU;

    this.aura = new THREE.Group();
    this.auraRing = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.8, 40),
      new THREE.MeshBasicMaterial({
        color: 0x5df4ff,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    this.auraRing.rotation.x = -Math.PI / 2;
    this.auraRing.position.y = 0.03;
    this.aura.add(this.auraRing);
    const moteMat = new THREE.MeshBasicMaterial({ color: 0x9ff8ff, toneMapped: false });
    this.motes = [];
    for (let i = 0; i < 3; i++) {
      const mote = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), moteMat);
      this.aura.add(mote);
      this.motes.push({ mesh: mote, phase: (i / 3) * TAU, radius: 0.42 + i * 0.13, height: 0.7 + i * 0.32 });
    }
    this.root.add(this.aura);
    this.keyLight = new THREE.PointLight(0x9fe3ff, 9, 10, 2);
    this.keyLight.position.set(0.9, 2.5, 1.5);
    this.root.add(this.keyLight);
    this.play('Idle', 0.01);
  }

  play(name, fade = 0.22, options = {}) {
    const next = this.actions[name];
    if (!next) return;
    if (this.current === next && !options.force) return;
    const isOneShot = name === 'Slash' || name === 'Storm';
    next.reset();
    next.setLoop(isOneShot ? THREE.LoopOnce : THREE.LoopRepeat, isOneShot ? 1 : Infinity);
    next.clampWhenFinished = isOneShot;
    next.enabled = true;
    next.setEffectiveTimeScale(options.timeScale ?? 1);
    next.setEffectiveWeight(1);
    next.fadeIn(fade);
    next.play();
    if (this.current && this.current !== next) this.current.fadeOut(fade);
    this.current = next;
    this.currentName = name;
    this.oneShot = isOneShot;
  }

  setFacing(angle, immediate = false) {
    this.targetFacing = angle;
    if (immediate) {
      this.facing = angle;
      this.turnGroup.rotation.y = angle;
    }
  }

  getSwordPosition(target = new THREE.Vector3()) {
    if (this.bladeNode) {
      this.bladeNode.getWorldPosition(target);
      target.y += 0.35;
      return target;
    }
    return target.copy(this.root.position).add(new THREE.Vector3(0, 1.1, -0.4));
  }

  getChestPosition(target = new THREE.Vector3()) {
    return target.copy(this.root.position).add(new THREE.Vector3(0, 1.15, 0));
  }

  update(dt, elapsed) {
    this.mixer.update(dt);
    let delta = ((this.targetFacing - this.facing + Math.PI) % TAU + TAU) % TAU - Math.PI;
    this.facing += delta * (1 - Math.exp(-7 * dt));
    this.turnGroup.rotation.y = this.facing;
    this.lean = damp(this.lean, 0, 4.5, dt);
    this.leanGroup.rotation.z = this.lean;
    this.leanGroup.position.y = 0;
    const pulse = 0.5 + Math.sin(elapsed * 3.2 + this.auraPhase) * 0.5;
    this.auraRing.material.opacity = 0.16 + pulse * 0.12;
    this.auraRing.scale.setScalar(0.94 + pulse * 0.1);
    for (const mote of this.motes) {
      const angle = elapsed * 1.7 + mote.phase;
      mote.mesh.position.set(
        Math.cos(angle) * mote.radius,
        mote.height + Math.sin(elapsed * 2.1 + mote.phase) * 0.13,
        Math.sin(angle) * mote.radius
      );
      const s = 0.6 + Math.sin(elapsed * 4 + mote.phase) * 0.3;
      mote.mesh.scale.setScalar(clamp(s, 0.3, 1));
    }
  }
}
