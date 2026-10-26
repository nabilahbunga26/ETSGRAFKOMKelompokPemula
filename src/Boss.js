import * as THREE from 'three';
import {
  clamp,
  damp,
  glowTexture,
  makeGlowSprite,
  makePart,
  mergeParts,
  mulberry32,
  TAU,
} from './utils.js';

const COLORS = {
  lacquer: 0x232b32,
  lacquerLight: 0x333f48,
  steel: 0x59656e,
  crimson: 0x741120,
  crimsonDark: 0x400a13,
  gold: 0xbd8d47,
  goldBright: 0xdcb46c,
  bone: 0xbfb29a,
  boneDark: 0x8b7e68,
  hair: 0x1a141b,
  ember: 0xff8a3c,
};

const CORE_WINDOW = [3.7, 3.35, 3.0];
const ROAR_LOSS = [0.22, 0.28, 0.34];
const SLAM_LOSS = [0.1, 0.14, 0.18];
const RECOVER_TIME = [2.0, 1.7, 1.4];

function partMesh(parts, material, cast = true, receive = true) {
  if (!parts.length) return null;
  const mesh = new THREE.Mesh(mergeParts(parts), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function box(w, h, d, color, pos, rot) {
  return makePart(new THREE.BoxGeometry(w, h, d), color, pos, rot);
}

function cone(r, h, seg, color, pos, rot) {
  return makePart(new THREE.ConeGeometry(r, h, seg), color, pos, rot);
}

function sphere(r, color, pos, rot, seg = 10) {
  return makePart(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), color, pos, rot);
}

export class Boss {
  constructor(scene, vfx) {
    this.scene = scene;
    this.vfx = vfx;
    this.rng = mulberry32(66613);
    this.maxHp = 1500;
    this.hp = this.maxHp;
    this.phase = 1;
    this.state = 'dormant';
    this.timer = 0;
    this.elapsed = 0;
    this.coreOpen = 0;
    this.coreTarget = 0;
    this.flashT = 0;
    this.deathEmit = false;
    this.explodeTimer = 0;
    this.lastAction = 'roar';
    this.events = [];
    this.coreHitbox = null;
    this.basePosition = new THREE.Vector3(0, 0.24, -461.5);
    this.tmp = new THREE.Vector3();

    this.buildMaterials();
    this.buildRig();
    this.root.position.copy(this.basePosition);
    this.root.scale.setScalar(1.24);
    this.scene.add(this.root);
    this.reset();
  }

  buildMaterials() {
    this.armorMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.45,
      emissive: 0x000000,
      emissiveIntensity: 0,
      envMapIntensity: 1.15,
    });
    this.clothMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.04,
      emissive: 0x170307,
      emissiveIntensity: 0.55,
      side: THREE.DoubleSide,
    });
    this.goldMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.72,
      emissive: 0x1f1203,
      emissiveIntensity: 0.12,
      envMapIntensity: 1.1,
    });
    this.boneMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.62,
      metalness: 0.06,
      emissive: 0x120c06,
      emissiveIntensity: 0.12,
    });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2418, toneMapped: false });
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xffc776, toneMapped: false });
    this.rimMat = new THREE.MeshStandardMaterial({
      color: 0xb98a4a,
      roughness: 0.44,
      metalness: 0.65,
      emissive: 0x221403,
      emissiveIntensity: 0.18,
    });
    this.capeMat = new THREE.MeshStandardMaterial({
      color: 0x360912,
      roughness: 0.96,
      metalness: 0.02,
      emissive: 0x0e0205,
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
    });
    this.hairMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.02,
      emissive: 0x000000,
    });
    this.woodMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.08,
      emissive: 0x0a0503,
      emissiveIntensity: 0.3,
    });
    this.darkSteelMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.4,
      metalness: 0.72,
      envMapIntensity: 1.05,
    });
  }

  buildRig() {
    this.root = new THREE.Group();
    this.root.name = 'oni-shogun';
    this.rig = new THREE.Group();
    this.root.add(this.rig);

    this.hips = new THREE.Group();
    this.hips.position.y = 2.3;
    this.rig.add(this.hips);

    this.buildLegs();
    this.buildSkirt();

    this.torso = new THREE.Group();
    this.torso.position.y = 0.5;
    this.hips.add(this.torso);
    this.buildTorso();
    this.buildHead();
    this.buildArms();
    this.buildCore();
    this.buildCape();
    this.buildTelegraph();

    this.pose = {
      armRX: 0.16,
      armRZ: -0.36,
      armLX: 0.12,
      armLZ: 0.22,
      clubX: -0.2,
      torsoX: 0,
      torsoY: 0,
      headX: 0.05,
      headY: 0,
      torsoDrop: 0,
    };
  }

  buildLegs() {
    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.78, 0, 0);
      const armor = [];
      const cloth = [];
      const gold = [];
      const bone = [];
      // thigh + hip guard
      armor.push(box(0.72, 1.05, 0.78, COLORS.lacquer, [0, -0.6, 0], [0, 0, side * 0.03]));
      armor.push(box(0.84, 0.3, 0.88, COLORS.lacquerLight, [0, -0.08, 0.02]));
      armor.push(box(0.6, 0.36, 0.1, COLORS.steel, [0, -0.5, 0.42]));
      gold.push(box(0.52, 0.06, 0.66, COLORS.gold, [0, -0.2, 0.02]));
      // knee
      armor.push(box(0.68, 0.38, 0.82, COLORS.steel, [0, -1.16, 0.04]));
      gold.push(box(0.56, 0.08, 0.7, COLORS.gold, [0, -0.98, 0.06]));
      bone.push(cone(0.13, 0.52, 5, COLORS.goldBright, [0, -1.34, 0.46], [Math.PI * 0.5, 0, 0]));
      // shin + greave
      armor.push(box(0.58, 1.02, 0.64, COLORS.lacquer, [0, -1.72, 0.02], [0.03, 0, 0]));
      armor.push(box(0.5, 0.8, 0.1, COLORS.lacquerLight, [0, -1.66, 0.35], [0.02, 0, 0]));
      armor.push(box(0.64, 0.16, 0.72, COLORS.steel, [0, -2.16, 0.03]));
      gold.push(box(0.52, 0.06, 0.64, COLORS.gold, [0, -1.3, 0.04]));
      // foot with clawed toes
      armor.push(box(0.92, 0.34, 1.34, COLORS.lacquerLight, [0, -2.3, 0.24], [0.03, 0, 0]));
      gold.push(box(0.7, 0.16, 0.22, COLORS.gold, [0, -2.18, 0.88]));
      for (const tx of [-0.26, 0, 0.26]) {
        bone.push(cone(0.075, 0.3, 5, COLORS.bone, [tx, -2.3, 0.97], [Math.PI * 0.55, 0, 0]));
      }
      spawnLegSpikes(armor, side);
      cloth.push(box(0.56, 0.5, 0.09, COLORS.crimsonDark, [0, -0.34, -0.38], [0.1, 0, side * 0.12]));
      this.addMeshes(leg, { armor, cloth, gold, bone });
      this.hips.add(leg);
      leg.userData.side = side;
      this.legs.push(leg);
    }
    const armor = [];
    const gold = [];
    armor.push(box(1.58, 0.7, 1.05, COLORS.lacquer, [0, -0.02, 0]));
    armor.push(box(1.2, 0.2, 1.18, COLORS.gold, [0, 0.33, 0]));
    gold.push(box(0.32, 0.24, 0.12, COLORS.goldBright, [0, -0.02, 0.56]));
    const pelvis = partMesh(armor, this.armorMat);
    const belt = partMesh(gold, this.goldMat);
    this.hips.add(pelvis, belt);
  }

  buildSkirt() {
    const cloth = [];
    const armor = [];
    const gold = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU - Math.PI / 2;
      const x = Math.cos(a) * 0.92;
      const z = Math.sin(a) * 0.58;
      cloth.push(
        box(0.62, 1.3, 0.18, i % 2 ? COLORS.crimson : COLORS.crimsonDark, [x, -0.66, z], [0, -a, Math.cos(a) * 0.1])
      );
      gold.push(box(0.6, 0.06, 0.2, COLORS.gold, [x, -0.1, z], [0, -a, 0]));
      gold.push(box(0.6, 0.04, 0.19, COLORS.gold, [x, -1.26, z], [0, -a, 0]));
    }
    armor.push(box(0.68, 0.62, 0.2, COLORS.lacquer, [0, -0.34, 0.62], [0.12, 0, 0]));
    gold.push(box(0.5, 0.08, 0.22, COLORS.gold, [0, -0.1, 0.64], [0.12, 0, 0]));
    this.addMeshes(this.hips, { cloth, armor, gold });
  }

  buildTorso() {
    const armor = [];
    const cloth = [];
    const gold = [];
    const bone = [];

    // under-layer and main cuirass
    armor.push(box(1.5, 1.05, 0.92, COLORS.lacquer, [0, 0.62, 0]));
    armor.push(box(1.96, 1.24, 1.02, COLORS.lacquer, [0, 1.62, 0]));
    armor.push(box(2.12, 0.32, 1.08, COLORS.lacquerLight, [0, 2.26, 0]));
    armor.push(box(2.08, 0.3, 1.1, COLORS.steel, [0, 1.1, 0]));

    // abdomen lamellar rows
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const x = (c - 2) * 0.32;
        armor.push(
          box(0.3, 0.2, 0.1, r % 2 ? COLORS.lacquerLight : COLORS.lacquer, [
            x,
            0.34 + r * 0.24,
            0.49 - Math.abs(x) * 0.035,
          ])
        );
      }
      cloth.push(box(1.5, 0.05, 0.09, COLORS.crimson, [0, 0.4 + r * 0.24, 0.55]));
    }

    // obi sash and buckle
    cloth.push(box(1.78, 0.28, 1.06, COLORS.crimson, [0, 0.06, 0]));
    gold.push(box(0.36, 0.22, 0.12, COLORS.goldBright, [0, 0.06, 0.57]));
    armor.push(box(0.22, 0.14, 0.14, COLORS.crimsonDark, [0, 0.06, 0.64]));

    // chest trim and vertical straps
    gold.push(box(1.98, 0.06, 1.05, COLORS.gold, [0, 2.12, 0]));
    for (const side of [-1, 1]) {
      gold.push(box(0.13, 1.16, 0.1, COLORS.gold, [side * 0.84, 1.64, 0.53], [0, 0, side * 0.05]));
      armor.push(box(0.64, 0.34, 0.14, COLORS.steel, [side * 0.84, 2.04, 0.5], [0, 0, side * 0.34]));
    }
    // beveled plates framing the core socket
    for (const side of [-1, 1]) {
      armor.push(box(0.42, 0.5, 0.14, COLORS.lacquerLight, [side * 1.02, 1.9, 0.5], [0, side * 0.22, 0]));
      armor.push(box(0.42, 0.44, 0.14, COLORS.lacquerLight, [side * 1.02, 1.2, 0.5], [0, side * 0.22, 0]));
    }

    // crimson under-sash over the shoulders and laced chest cords
    cloth.push(box(1.86, 0.44, 0.94, COLORS.crimsonDark, [0, 2.02, -0.02]));
    for (let i = 0; i < 4; i++) {
      cloth.push(box(1.38 - i * 0.05, 0.06, 0.1, COLORS.crimson, [0, 1.34 - i * 0.15, 0.55]));
    }

    // collar / neck guard
    armor.push(box(1.3, 0.34, 0.96, COLORS.lacquerLight, [0, 2.34, 0]));
    cloth.push(box(1.4, 0.28, 1.0, COLORS.crimson, [0, 2.42, -0.02]));
    gold.push(box(1.36, 0.05, 0.98, COLORS.gold, [0, 2.4, 0]));
    // neck column so the kabuto sits above the shoulders instead of merging into them
    armor.push(makePart(new THREE.CylinderGeometry(0.3, 0.37, 0.62, 10), COLORS.lacquer, [0, 2.66, -0.02]));
    cloth.push(makePart(new THREE.TorusGeometry(0.32, 0.06, 6, 16), COLORS.crimsonDark, [0, 2.62, -0.02], [Math.PI / 2, 0, 0]));
    gold.push(makePart(new THREE.TorusGeometry(0.35, 0.035, 5, 18), COLORS.gold, [0, 2.5, -0.02], [Math.PI / 2, 0, 0]));

    // shoulder armor: layered sode framing the arms
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        armor.push(
          box(1.14 - i * 0.08, 0.24, 1.26 - i * 0.1, i % 2 ? COLORS.lacquer : COLORS.lacquerLight, [
            side * (1.23 + i * 0.1),
            2.06 - i * 0.25,
            0,
          ], [0, 0, side * (0.2 + i * 0.08)])
        );
        gold.push(
          box(1.06 - i * 0.08, 0.045, 1.12 - i * 0.1, COLORS.gold, [
            side * (1.23 + i * 0.1),
            2.17 - i * 0.25,
            0,
          ], [0, 0, side * (0.2 + i * 0.08)])
        );
      }
      armor.push(box(0.98, 0.3, 1.12, COLORS.lacquer, [side * 1.36, 2.34, 0], [0, 0, side * 0.3]));
      armor.push(cone(0.15, 0.52, 5, COLORS.steel, [side * 1.7, 2.44, -0.02], [0.04, 0, side * -0.98]));
      gold.push(cone(0.19, 0.13, 6, COLORS.goldBright, [side * 1.62, 2.31, -0.02], [0.04, 0, side * -0.98]));
      gold.push(box(0.86, 0.04, 0.98, COLORS.gold, [side * 1.36, 2.49, 0], [0, 0, side * 0.3]));
    }

    this.addMeshes(this.torso, { armor, cloth, gold, bone });
  }

  buildHead() {
    this.head = new THREE.Group();
    this.head.position.set(0, 2.82, 0.06);
    this.head.scale.setScalar(1.08);
    this.torso.add(this.head);
    const bone = [];
    const armor = [];
    const gold = [];
    const hair = [];
    const cloth = [];

    // kabuto dome and brim
    armor.push(sphere(0.54, COLORS.lacquer, [0, 0.28, -0.05], null, 12));
    armor.push(box(0.94, 0.16, 0.88, COLORS.lacquerLight, [0, 0.1, 0.02]));
    gold.push(box(0.96, 0.05, 0.9, COLORS.gold, [0, 0.02, 0.02]));
    gold.push(box(1.0, 0.06, 0.94, COLORS.gold, [0, 0.19, -0.03]));
    gold.push(makePart(new THREE.TorusGeometry(0.15, 0.028, 5, 14, Math.PI), COLORS.goldBright, [0, 0.48, 0.39], [0.12, 0, 0]));
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        armor.push(box(0.46, 0.2, 0.5, COLORS.lacquer, [side * (0.42 + i * 0.04), -0.1 - i * 0.17, -0.16], [0.24, 0, side * 0.18]));
      }
    }

    // steel menpo with an articulated jaw
    armor.push(box(0.68, 0.16, 0.2, COLORS.lacquer, [0, 0.14, 0.42], [0.08, 0, 0]));
    armor.push(box(0.56, 0.4, 0.2, COLORS.steel, [0, -0.14, 0.42], [0.08, 0, 0]));
    armor.push(box(0.2, 0.42, 0.26, COLORS.lacquerLight, [-0.36, -0.12, 0.34], [0, 0.16, -0.06]));
    armor.push(box(0.2, 0.42, 0.26, COLORS.lacquerLight, [0.36, -0.12, 0.34], [0, -0.16, 0.06]));
    gold.push(box(0.66, 0.045, 0.22, COLORS.gold, [0, 0.16, 0.47], [0.08, 0, 0]));
    armor.push(box(0.13, 0.22, 0.16, COLORS.lacquerLight, [0, -0.08, 0.52], [0.2, 0, 0]));
    gold.push(makePart(new THREE.TorusGeometry(0.055, 0.014, 5, 12), COLORS.gold, [0, -0.2, 0.57], [0.1, 0, 0]));

    // deep sockets for the glowing eyes
    armor.push(box(0.3, 0.15, 0.09, 0x040506, [-0.18, 0.02, 0.5], [0, 0, 0.12]));
    armor.push(box(0.3, 0.15, 0.09, 0x040506, [0.18, 0.02, 0.5], [0, 0, -0.12]));
    armor.push(box(0.44, 0.13, 0.1, 0x050607, [0, -0.3, 0.49]));
    for (const x of [-0.17, -0.057, 0.057, 0.17]) {
      bone.push(cone(0.032, 0.12, 4, COLORS.bone, [x, -0.25, 0.53], [Math.PI, 0, 0]));
    }
    for (const side of [-1, 1]) {
      // upward oni tusks rising from the lower jaw
      bone.push(cone(0.055, 0.3, 5, COLORS.bone, [side * 0.24, -0.32, 0.52], [0.22, 0, side * -0.16]));
      bone.push(box(0.22, 0.18, 0.18, COLORS.boneDark, [side * 0.3, -0.4, 0.4], [0.12, 0, side * 0.12]));
    }
    bone.push(box(0.3, 0.15, 0.2, COLORS.boneDark, [0, -0.43, 0.4], [0.12, 0, 0]));

    // smooth curved horns
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.32, 0.42, -0.02),
        new THREE.Vector3(side * 0.52, 0.66, -0.06),
        new THREE.Vector3(side * 0.72, 0.94, -0.12),
        new THREE.Vector3(side * 0.87, 1.22, -0.22),
        new THREE.Vector3(side * 0.94, 1.5, -0.36),
      ]);
      gold.push(makePart(new THREE.TubeGeometry(curve, 16, 0.085, 7, false), COLORS.gold, [0, 0, 0]));
      gold.push(makePart(new THREE.SphereGeometry(0.09, 8, 6), COLORS.goldBright, [side * 0.94, 1.5, -0.36]));
      gold.push(makePart(new THREE.CylinderGeometry(0.13, 0.15, 0.16, 8), COLORS.goldBright, [side * 0.34, 0.45, -0.03], [0.4, 0, side * 0.5]));
    }

    // mane and crimson cords behind the helmet
    hair.push(sphere(0.62, COLORS.hair, [0, 0.14, -0.3], null, 9));
    for (let i = 0; i < 10; i++) {
      const a = (i / 9) * Math.PI - Math.PI / 2;
      hair.push(
        cone(0.13 + this.rng() * 0.05, 0.8 + this.rng() * 0.35, 5, COLORS.hair, [
          Math.sin(a) * 0.58,
          0.06 + Math.cos(a) * 0.46,
          -0.38 - Math.cos(a) * 0.08,
        ], [Math.cos(a) * 0.42, 0, Math.sin(a) * -0.5 - a * 0.1])
      );
    }
    cloth.push(box(0.96, 0.24, 0.72, COLORS.crimson, [0, -0.34, -0.04]));
    gold.push(box(1.0, 0.04, 0.74, COLORS.gold, [0, -0.24, -0.04]));

    this.addMeshes(this.head, { bone, armor, gold, hair, cloth });

    this.eyes = new THREE.Group();
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.04), this.eyeMat);
      eye.position.set(side * 0.185, 0.02, 0.545);
      eye.rotation.z = side * 0.26;
      this.eyes.add(eye);
      const halo = makeGlowSprite(glowTexture('rgba(255,50,36,0.85)'), 0xff2f24, 0.46, 0.26);
      halo.position.set(side * 0.185, 0.02, 0.58);
      halo.material.opacity = 0.55;
      this.eyes.add(halo);
    }
    this.head.add(this.eyes);
  }

  buildArms() {
    this.arms = {};
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 1.4, 1.9, 0.04);
      const armor = [];
      const cloth = [];
      const gold = [];
      const bone = [];
      armor.push(box(0.56, 1.16, 0.64, COLORS.lacquer, [0, -0.56, 0], [0, 0, side * 0.06]));
      armor.push(box(0.62, 0.24, 0.7, COLORS.steel, [0, -1.12, 0.01]));
      armor.push(box(0.52, 0.98, 0.58, COLORS.lacquerLight, [0, -1.68, 0.02], [0.05, 0, side * 0.03]));
      armor.push(box(0.56, 0.18, 0.6, COLORS.steel, [0, -2.16, 0.03]));
      gold.push(box(0.55, 0.06, 0.62, COLORS.gold, [0, -1.15, 0]));
      gold.push(box(0.48, 0.05, 0.53, COLORS.gold, [0, -1.98, 0.03]));
      gold.push(box(0.12, 0.8, 0.1, COLORS.gold, [0, -1.66, 0.33]));
      cloth.push(box(0.46, 0.38, 0.09, COLORS.crimson, [0, -0.44, -0.3]));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.26, 9, 7), this.armorMat);
      hand.position.set(0, -2.34, 0.06);
      hand.castShadow = true;
      arm.add(hand);
      for (let f = -1; f <= 1; f++) {
        bone.push(cone(0.045, 0.22, 4, COLORS.boneDark, [f * 0.1, -2.5, 0.16], [0.35, 0, f * 0.16]));
      }
      this.addMeshes(arm, { armor, cloth, gold, bone });
      arm.userData.side = side;
      this.torso.add(arm);
      this.arms[side < 0 ? 'left' : 'right'] = arm;
      if (side > 0) this.buildClub(arm);
    }
    this.armL = this.arms.left;
    this.armR = this.arms.right;
  }

  buildClub(arm) {
    this.club = new THREE.Group();
    this.club.position.set(0.04, -2.34, 0.16);
    const wood = [];
    const gold = [];
    const steel = [];
    wood.push(
      makePart(new THREE.CylinderGeometry(0.12, 0.16, 2.5, 7), 0x4a3428, [0, 1.25, 0])
    );
    wood.push(
      makePart(new THREE.CylinderGeometry(0.4, 0.27, 1.5, 9), 0x412b22, [0, 2.76, 0])
    );
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      for (let row = 0; row < 2; row++) {
        steel.push(
          cone(0.06, 0.2, 4, 0x3b444c, [Math.cos(a) * 0.37, 2.5 + row * 0.45, Math.sin(a) * 0.37], [
            Math.PI / 2,
            0,
            -a + Math.PI / 2,
          ])
        );
      }
    }
    gold.push(
      makePart(new THREE.TorusGeometry(0.38, 0.04, 5, 16), COLORS.gold, [0, 2.05, 0], [Math.PI / 2, 0, 0])
    );
    gold.push(
      makePart(new THREE.TorusGeometry(0.3, 0.035, 5, 14), COLORS.gold, [0, 3.46, 0], [Math.PI / 2, 0, 0])
    );
    for (let i = 0; i < 4; i++) {
      gold.push(
        makePart(new THREE.TorusGeometry(0.145, 0.025, 4, 12), COLORS.goldBright, [0, 0.5 + i * 0.28, 0], [Math.PI / 2, 0, 0])
      );
    }
    wood.push(makePart(new THREE.ConeGeometry(0.26, 0.46, 8), 0x241715, [0, 3.68, 0]));
    this.addMeshes(this.club, { wood, gold, steel });
    this.club.rotation.x = 0.1;
    arm.add(this.club);
  }

  buildCore() {
    this.chestCore = new THREE.Group();
    this.chestCore.position.set(0, 1.56, 0.52);
    this.torso.add(this.chestCore);

    // dark recess, gold socket rim and beveled housing
    const recess = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 0.34, 28, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x06080a, roughness: 0.9, metalness: 0.2, side: THREE.DoubleSide })
    );
    recess.rotation.x = Math.PI / 2;
    recess.position.z = 0.0;
    this.chestCore.add(recess);
    const back = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 28),
      new THREE.MeshStandardMaterial({ color: 0x0a0c0e, roughness: 0.95, metalness: 0.1 })
    );
    back.position.z = -0.15;
    this.chestCore.add(back);
    // squared gold frame around the sealed core, instead of a round porthole
    const frame = new THREE.Group();
    const vBar = new THREE.BoxGeometry(0.1, 1.3, 0.18);
    const hBar = new THREE.BoxGeometry(1.34, 0.1, 0.18);
    for (const side of [-1, 1]) {
      const v = new THREE.Mesh(vBar, this.rimMat);
      v.position.set(side * 0.63, 0, 0.14);
      frame.add(v);
      const h = new THREE.Mesh(hBar, this.rimMat);
      h.position.set(0, side * 0.6, 0.14);
      frame.add(h);
      for (const sy of [-1, 1]) {
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), this.rimMat);
        stud.position.set(side * 0.63, sy * 0.6, 0.23);
        frame.add(stud);
      }
    }
    this.chestCore.add(frame);

    this.plateL = new THREE.Group();
    this.plateR = new THREE.Group();
    this.plateL.position.set(-0.6, 0, 0.14);
    this.plateR.position.set(0.6, 0, 0.14);

    const armorL = [];
    const goldL = [];
    const clothL = [];
    clothL.push(box(0.62, 0.98, 0.16, COLORS.crimsonDark, [0.31, 0, 0.04]));
    armorL.push(box(0.62, 0.98, 0.14, COLORS.lacquer, [0.31, 0, -0.04]));
    armorL.push(box(0.12, 1.0, 0.18, COLORS.steel, [0.04, 0, 0.05]));
    goldL.push(box(0.56, 0.05, 0.2, COLORS.gold, [0.31, 0.42, 0.08]));
    goldL.push(box(0.56, 0.05, 0.2, COLORS.gold, [0.31, -0.42, 0.08]));
    goldL.push(box(0.05, 0.86, 0.2, COLORS.gold, [0.57, 0, 0.08]));
    for (let i = 0; i < 4; i++) {
      clothL.push(box(0.5, 0.035, 0.03, COLORS.crimson, [0.3, -0.29 + i * 0.19, 0.13]));
    }
    this.addMeshes(this.plateL, { armor: armorL, gold: goldL, cloth: clothL });
    // latch on the centre seam, so the sealed core reads as a single emblem
    const crest = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.024, 6, 16), this.rimMat);
    crest.position.set(0.6, 0, 0.16);
    this.plateL.add(crest);
    const gem = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 12),
      new THREE.MeshBasicMaterial({ color: 0xff8a5a, toneMapped: false })
    );
    gem.position.set(0.6, 0, 0.17);
    this.plateL.add(gem);

    const armorR = [];
    const goldR = [];
    const clothR = [];
    clothR.push(box(0.62, 0.98, 0.16, COLORS.crimsonDark, [-0.31, 0, 0.04]));
    armorR.push(box(0.62, 0.98, 0.14, COLORS.lacquer, [-0.31, 0, -0.04]));
    armorR.push(box(0.12, 1.0, 0.18, COLORS.steel, [-0.04, 0, 0.05]));
    goldR.push(box(0.56, 0.05, 0.2, COLORS.gold, [-0.31, 0.42, 0.08]));
    goldR.push(box(0.56, 0.05, 0.2, COLORS.gold, [-0.31, -0.42, 0.08]));
    goldR.push(box(0.05, 0.86, 0.2, COLORS.gold, [-0.57, 0, 0.08]));
    for (let i = 0; i < 4; i++) {
      clothR.push(box(0.5, 0.035, 0.03, COLORS.crimson, [-0.3, -0.29 + i * 0.19, 0.13]));
    }
    this.addMeshes(this.plateR, { armor: armorR, gold: goldR, cloth: clothR });
    this.chestCore.add(this.plateL, this.plateR);

    this.core = new THREE.Group();
    this.core.position.z = 0.02;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12), this.coreMat);
    const rings = new THREE.Group();
    for (const rot of [
      [0, 0, 0],
      [Math.PI / 2, 0, 0.4],
      [0.4, Math.PI / 2, 0],
    ]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.018, 6, 28),
        new THREE.MeshBasicMaterial({ color: 0xffca7c, transparent: true, opacity: 0.8, toneMapped: false })
      );
      ring.rotation.set(...rot);
      rings.add(ring);
    }
    this.coreRings = rings;
    this.coreHalo = makeGlowSprite(glowTexture('rgba(255,185,95,0.95)'), 0xffbf72, 1.35, 1.35);
    this.coreHalo.material.opacity = 0;
    this.coreLight = new THREE.PointLight(0xffa14a, 0, 7, 2);
    this.core.add(orb, rings, this.coreHalo, this.coreLight);
    this.chestCore.add(this.core);

    this.coreHitbox = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.coreHitbox.position.set(0, 0, 0.35);
    this.coreHitbox.userData = { kind: 'core', boss: this };
    this.chestCore.add(this.coreHitbox);
    this.setCoreVisual(0);
  }

  buildCape() {
    const cols = 10;
    const rows = 12;
    const width = 4.2;
    const length = 4.6;
    const positions = [];
    const uvs = [];
    const indices = [];
    this.capeBase = [];
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const x = (c / cols - 0.5) * width;
        const y = -(r / rows) * length;
        const tatter = r === rows ? (c % 3) * -0.16 : 0;
        positions.push(x * (1 - r * 0.012), y + tatter, 0);
        uvs.push(c / cols, r / rows);
        this.capeBase.push({ x: x * (1 - r * 0.012), y: y + tatter, row: r / rows, col: c / cols });
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = a + 1;
        const d = a + cols + 1;
        const e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    this.cape = new THREE.Mesh(geo, this.capeMat);
    this.cape.castShadow = true;
    this.cape.position.set(0, 2.08, -0.62);
    this.torso.add(this.cape);
    this.capePositions = geo.attributes.position;
  }

  buildTelegraph() {
    this.telegraph = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.05, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff3c50,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    this.telegraph.rotation.x = -Math.PI / 2;
    this.telegraph.position.set(0, 0.035, 4.2);
    this.telegraph.visible = false;
    this.root.add(this.telegraph);
  }

  addMeshes(group, sets) {
    for (const [key, parts] of Object.entries(sets)) {
      if (!parts.length) continue;
      const material =
        key === 'armor'
          ? this.armorMat
          : key === 'cloth'
            ? this.clothMat
            : key === 'gold'
              ? this.goldMat
              : key === 'bone'
                ? this.boneMat
                : key === 'hair'
                  ? this.hairMat
                  : key === 'wood'
                    ? this.woodMat
                    : key === 'steel'
                      ? this.darkSteelMat
                      : this.armorMat;
      const mesh = partMesh(parts, material);
      if (mesh) group.add(mesh);
    }
  }

  reset() {
    this.hp = this.maxHp;
    this.phase = 1;
    this.state = 'dormant';
    this.timer = 0;
    this.coreOpen = 0;
    this.coreTarget = 0;
    this.flashT = 0;
    this.deathEmit = false;
    this.explodeTimer = 0;
    this.lastAction = 'roar';
    this._lastOnce = null;
    this.events.length = 0;
    this.root.visible = true;
    this.root.position.copy(this.basePosition);
    this.root.rotation.set(0, 0, 0);
    this.rig.rotation.set(0, 0, 0);
    this.rig.scale.setScalar(1);
    this.torso.position.y = 0.5;
    this.torso.rotation.set(0, 0, 0);
    this.head.rotation.set(0.05, 0, 0);
    this.armL.rotation.set(0.12, 0, 0.22);
    this.armR.rotation.set(0.16, 0, -0.36);
    this.club.rotation.x = -0.2;
    this.cape.visible = true;
    this.telegraph.visible = false;
    this.telegraph.material.opacity = 0;
    this.setCoreVisual(0);
    this.coreLight.intensity = 0;
    this.eyeMat.color.setHex(0xff2a36);
  }

  startBattle() {
    if (this.state !== 'dormant') return;
    this.state = 'intro';
    this.timer = 0;
    this.hp = this.maxHp;
    this.phase = 1;
    this.pushEvent({ type: 'introStart' });
  }

  stopBattle() {
    this.reset();
  }

  pushEvent(event) {
    this.events.push(event);
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  get phaseIndex() {
    return clamp(this.phase - 1, 0, 2);
  }

  isCoreTargetable() {
    return this.state === 'coreExposed' && this.hp > 0 && this.coreOpen > 0.35;
  }

  isAlive() {
    return this.state !== 'dead' && this.state !== 'dormant' && this.hp > 0;
  }

  getCorePosition(target = new THREE.Vector3()) {
    this.core.getWorldPosition(target);
    return target;
  }

  getPosition(target = new THREE.Vector3()) {
    return target.copy(this.root.position);
  }

  damage(amount) {
    if (!this.isAlive() || this.state === 'intro' || amount <= 0) return;
    const before = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    if (amount >= 3) {
      this.flashT = Math.min(0.24, 0.08 + amount * 0.0012);
      this.eyeMat.color.setHex(0xffd0a0);
    }
    const ratio = this.hp / this.maxHp;
    const nextPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      this.emit('phase', { phase: this.phase });
    }
    if (this.hp <= 0 && before > 0) {
      this.state = 'dying';
      this.timer = 0;
      this.deathEmit = false;
      this.explodeTimer = 0;
      this.telegraph.visible = false;
      this.emit('dying');
    }
  }

  interruptCore() {
    if (this.state !== 'coreExposed' || this.hp <= 0) return false;
    this.state = 'stunned';
    this.timer = 2.7;
    this.coreTarget = 1;
    this.setCoreVisual(1);
    this.emit('interrupted');
    return true;
  }

  setCoreVisual(open) {
    const amount = clamp(open, 0, 1);
    this.plateL.rotation.y = -amount * 1.42;
    this.plateR.rotation.y = amount * 1.42;
    this.plateL.rotation.z = -amount * 0.12;
    this.plateR.rotation.z = amount * 0.12;
    this.core.visible = amount > 0.04;
    this.coreHalo.material.opacity = amount * 0.7;
    this.coreLight.intensity = amount * 4.2;
    this.core.scale.setScalar(0.7 + amount * 0.3);
  }

  update(dt, elapsed, heroPos) {
    this.elapsed = elapsed;
    this.updatePose(dt, elapsed, heroPos);
    this.updateCape(elapsed);
    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt);
      const f = this.flashT / 0.24;
      this.armorMat.emissive.setRGB(0.1 + f * 0.55, 0.02 + f * 0.12, 0.03 + f * 0.04);
    } else {
      this.armorMat.emissive.setRGB(0.1, 0.02, 0.03);
      this.eyeMat.color.setHex(this.state === 'coreExposed' || this.state === 'stunned' ? 0xffd08a : 0xff2a36);
    }

    if (this.state === 'dormant') {
      this.coreOpen = damp(this.coreOpen, 0, 4, dt);
      this.setCoreVisual(this.coreOpen);
      this.telegraph.visible = false;
      this.emitFromQueue();
      return this.events.splice(0);
    }
    if (this.state === 'dead') {
      this.coreOpen = damp(this.coreOpen, 0, 4, dt);
      this.setCoreVisual(this.coreOpen);
      this.emitFromQueue();
      return this.events.splice(0);
    }

    const targetCore =
      this.state === 'coreExposed' || this.state === 'stunned' || this.state === 'dying' ? 1 : 0;
    this.coreTarget = targetCore;
    this.coreOpen = damp(this.coreOpen, targetCore, this.state === 'intro' ? 3 : 7, dt);
    this.setCoreVisual(this.coreOpen);
    if (this.core.visible) {
      this.coreRings.rotation.y = elapsed * 1.3;
      this.coreRings.rotation.z = elapsed * 0.8;
      this.coreRings.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.08);
    }
    this.coreLight.intensity = this.coreOpen * (4.2 + Math.sin(elapsed * 8) * 1.1);

    this.telegraph.visible = this.state === 'slamWindup' || this.state === 'slam';
    if (this.telegraph.visible) {
      const pulse = 0.55 + Math.sin(elapsed * 16) * 0.35;
      this.telegraph.material.opacity = (this.state === 'slam' ? 0.85 : 0.35) * pulse;
      this.telegraph.scale.setScalar(this.state === 'slam' ? 1.3 : 0.9 + pulse * 0.15);
    }

    switch (this.state) {
      case 'intro':
        this.timer += dt;
        if (this.timer > 1.15 && this.timer < 1.3) this.emitOnce('introRoar', {});
        if (this.timer >= 3.15) {
          this.state = 'idle';
          this.timer = 0.9;
          this.emit('introEnd');
        }
        break;
      case 'idle':
        this.timer -= dt;
        if (this.timer <= 0) this.beginAction();
        break;
      case 'roarWindup':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'coreExposed';
          this.timer = CORE_WINDOW[this.phaseIndex];
          this.lastAction = 'roar';
          this.emit('coreExposed', { duration: this.timer });
        }
        break;
      case 'coreExposed':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.coreTarget = 0;
          this.state = 'recover';
          this.timer = RECOVER_TIME[this.phaseIndex];
          this.emit('roarEnd', { lossFraction: ROAR_LOSS[this.phaseIndex] });
        }
        break;
      case 'slamWindup':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'slam';
          this.timer = 0.62;
          this.emit('slam', { lossFraction: SLAM_LOSS[this.phaseIndex] });
        }
        break;
      case 'slam':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'recover';
          this.timer = RECOVER_TIME[this.phaseIndex] * 0.8;
        }
        break;
      case 'stunned':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.coreTarget = 0;
          this.state = 'recover';
          this.timer = RECOVER_TIME[this.phaseIndex] * 0.7;
        }
        break;
      case 'recover':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'idle';
          this.timer = this.phase === 3 ? 0.55 : 0.9;
        }
        break;
      case 'dying':
        this.timer += dt;
        this.explodeTimer -= dt;
        if (this.explodeTimer <= 0 && this.timer < 2.9) {
          this.explodeTimer = 0.32 + this.rng() * 0.25;
          this.tmp.set(
            (this.rng() - 0.5) * 2.6,
            0.6 + this.rng() * 4.6,
            (this.rng() - 0.5) * 1.6
          );
          this.root.localToWorld(this.tmp);
          this.vfx.explode(this.tmp.clone());
        }
        this.rig.rotation.z = Math.sin(this.timer * 14) * 0.04 * Math.max(0, 1 - this.timer / 3);
        this.torso.position.y = 0.5 - Math.min(1, this.timer / 3) * 0.55;
        if (this.timer > 3.25 && !this.deathEmit) {
          this.deathEmit = true;
          this.state = 'dead';
          this.emit('death');
          this.telegraph.visible = false;
        }
        break;
      default:
        break;
    }

    this.emitFromQueue();
    return this.events.splice(0);
  }

  emitOnce(type, data) {
    if (this._lastOnce === type) return;
    this._lastOnce = type;
    this.emit(type, data);
  }

  emitFromQueue() {
    // events queued from outside update() (damage/interrupt) are kept until the next frame
  }

  beginAction() {
    if (this.lastAction === 'slam') {
      this.state = 'roarWindup';
      this.timer = this.phase === 3 ? 1.05 : 1.35;
      this.lastAction = 'roar';
      this.emit('roarWindup', { duration: this.timer });
    } else {
      this.state = 'slamWindup';
      this.timer = this.phase === 3 ? 1.25 : 1.65;
      this.lastAction = 'slam';
      this.emit('slamWindup', { duration: this.timer });
    }
  }

  updatePose(dt, elapsed, heroPos) {
    const target = this.pose;
    const neutral = {
      armRX: 0.16,
      armRZ: -0.36,
      armLX: 0.12,
      armLZ: 0.22,
      clubX: -0.2,
      torsoX: 0,
      torsoY: 0,
      headX: 0.05,
      headY: 0,
      torsoDrop: 0,
    };
    Object.assign(target, neutral);

    if (heroPos) {
      const dz = heroPos.z - this.root.position.z;
      const dx = heroPos.x - this.root.position.x;
      if (dz < 4) target.torsoY = clamp(Math.atan2(dx, Math.max(1, dz)) * 0.7, -0.45, 0.45);
    }

    const breathe = Math.sin(elapsed * 1.15) * 0.018;
    const shiver = this.state === 'stunned' ? Math.sin(elapsed * 26) * 0.035 : 0;
    target.torsoX += breathe + shiver;
    target.headX += Math.sin(elapsed * 0.8) * 0.015;

    switch (this.state) {
      case 'intro': {
        const p = clamp(this.timer / 3.15, 0, 1);
        if (p > 0.34) {
          target.armRX = -0.55;
          target.armRZ = -0.42;
          target.armLX = -0.55;
          target.armLZ = 0.42;
          target.clubX = -0.25;
          target.headX = -0.35;
          target.torsoX = -0.06;
        }
        break;
      }
      case 'roarWindup':
        target.armRX = -0.8;
        target.armRZ = -0.75;
        target.armLX = -0.8;
        target.armLZ = 0.75;
        target.clubX = -0.25;
        target.headX = -0.42;
        target.torsoX = -0.14;
        break;
      case 'coreExposed':
        target.armRX = -0.55;
        target.armRZ = -0.55;
        target.armLX = -0.55;
        target.armLZ = 0.55;
        target.clubX = -0.15;
        target.headX = -0.3;
        target.torsoX = 0.08;
        break;
      case 'slamWindup':
        target.armRX = -2.25;
        target.armRZ = -0.3;
        target.clubX = -0.55;
        target.armLX = -0.8;
        target.armLZ = 0.6;
        target.torsoX = -0.12;
        target.torsoY += 0.2;
        target.headX = -0.12;
        break;
      case 'slam':
        target.armRX = 1.35;
        target.armRZ = -0.1;
        target.clubX = 1.72;
        target.armLX = 0.2;
        target.armLZ = 0.3;
        target.torsoX = 0.34;
        target.headX = 0.28;
        target.torsoDrop = -0.16;
        break;
      case 'stunned':
        target.armRX = 0.5;
        target.armRZ = -0.35;
        target.armLX = 0.5;
        target.armLZ = 0.35;
        target.clubX = 0.7;
        target.torsoX = 0.34;
        target.torsoDrop = -0.22;
        target.headX = 0.42;
        break;
      case 'recover':
        target.armRX = 0.28;
        target.armRZ = -0.2;
        target.armLX = 0.25;
        target.armLZ = 0.2;
        target.clubX = 0.25;
        target.torsoX = 0.06;
        break;
      case 'dying':
        target.armRX = 0.9;
        target.armRZ = -0.2;
        target.armLX = 0.9;
        target.armLZ = 0.2;
        target.clubX = 1.2;
        target.torsoX = 0.45;
        target.headX = 0.5;
        target.torsoDrop = -0.3;
        break;
      default:
        break;
    }

    const rate = this.state === 'slam' ? 18 : this.state === 'stunned' ? 7 : 6;
    this.pose.armRX = damp(this.pose.armRX, target.armRX, rate, dt);
    this.pose.armRZ = damp(this.pose.armRZ, target.armRZ, rate, dt);
    this.pose.armLX = damp(this.pose.armLX, target.armLX, rate, dt);
    this.pose.armLZ = damp(this.pose.armLZ, target.armLZ, rate, dt);
    this.pose.clubX = damp(this.pose.clubX, target.clubX, rate, dt);
    this.pose.torsoX = damp(this.pose.torsoX, target.torsoX, 3.4, dt);
    this.pose.torsoY = damp(this.pose.torsoY, target.torsoY, 2.6, dt);
    this.pose.headX = damp(this.pose.headX, target.headX, 4, dt);
    this.pose.headY = damp(this.pose.headY, target.headY, 2, dt);
    this.pose.torsoDrop = damp(this.pose.torsoDrop, target.torsoDrop, 5, dt);

    this.armR.rotation.x = this.pose.armRX;
    this.armR.rotation.z = this.pose.armRZ;
    this.armL.rotation.x = this.pose.armLX;
    this.armL.rotation.z = this.pose.armLZ;
    this.club.rotation.x = this.pose.clubX;
    this.torso.rotation.x = this.pose.torsoX;
    this.torso.rotation.y = this.pose.torsoY;
    this.head.rotation.x = this.pose.headX;
    this.head.rotation.y = this.pose.headY;
    this.torso.position.y = 0.5 + this.pose.torsoDrop;
    this.hips.position.y = 2.3 + Math.sin(elapsed * 1.15) * 0.012;
    this.legs[0].rotation.x = Math.sin(elapsed * 1.1) * 0.02;
    this.legs[1].rotation.x = Math.sin(elapsed * 1.1 + Math.PI) * 0.02;
  }

  updateCape(elapsed) {
    if (!this.capePositions) return;
    const attr = this.capePositions;
    const arr = attr.array;
    const base = this.capeBase;
    for (let i = 0; i < base.length; i++) {
      const p = base[i];
      const wave = Math.sin(elapsed * 1.6 + p.row * 4.2 + p.col * 2.2) * 0.12 * p.row;
      const side = Math.sin(elapsed * 1.1 + p.row * 2.1) * 0.06 * p.row;
      arr[i * 3] = p.x + side;
      arr[i * 3 + 1] = p.y + Math.sin(elapsed * 2 + p.col) * 0.035 * p.row;
      arr[i * 3 + 2] = -0.12 - p.row * (0.32 + Math.sin(elapsed * 1.4 + p.row * 2.4) * 0.1) + wave;
    }
    attr.needsUpdate = true;
    this.cape.geometry.computeVertexNormals();
  }
}

function spawnLegSpikes(parts, side) {
  for (let i = 0; i < 3; i++) {
    const y = -0.32 - i * 0.34;
    parts.push(
      cone(0.08, 0.34, 4, COLORS.bone, [side * 0.39, y, 0.08], [0, 0, side * -1.15])
    );
  }
}
