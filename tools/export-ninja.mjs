/**
 * Builds the original low-poly "Kage" ninja and exports it as an animated GLB.
 * Run: npm run build:model
 *
 * The rig is a plain Object3D hierarchy (glTF nodes) animated with quaternion
 * keyframes, so the exported file is a fully self-contained animated GLB.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// GLTFExporter uses FileReader to assemble the GLB; provide it for Node.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      });
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/assets/models');
fs.mkdirSync(outDir, { recursive: true });

const PI = Math.PI;

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
const cloth = new THREE.MeshStandardMaterial({
  name: 'NinjaCloth',
  color: 0x161a26,
  roughness: 0.86,
  metalness: 0.12,
});
const clothSoft = new THREE.MeshStandardMaterial({
  name: 'NinjaClothSoft',
  color: 0x232a3d,
  roughness: 0.95,
  metalness: 0.02,
});
const armor = new THREE.MeshStandardMaterial({
  name: 'ShadowLacqueredSteel',
  color: 0x222a37,
  roughness: 0.36,
  metalness: 0.85,
});
const mask = new THREE.MeshStandardMaterial({
  name: 'BoneMask',
  color: 0x9ba2a0,
  roughness: 0.6,
  metalness: 0.05,
});
const silk = new THREE.MeshStandardMaterial({
  name: 'CyanSilk',
  color: 0x0e8498,
  roughness: 0.52,
  metalness: 0.08,
  emissive: 0x08687d,
  emissiveIntensity: 0.7,
  side: THREE.DoubleSide,
});
const eye = new THREE.MeshStandardMaterial({
  name: 'CyanEye',
  color: 0xccffff,
  emissive: 0x5ff5ff,
  emissiveIntensity: 5,
  roughness: 0.2,
  metalness: 0,
});
const blade = new THREE.MeshStandardMaterial({
  name: 'KatanaSteel',
  color: 0x7f97aa,
  roughness: 0.3,
  metalness: 0.9,
  flatShading: true,
});
const grip = new THREE.MeshStandardMaterial({
  name: 'KatanaWrap',
  color: 0x191216,
  roughness: 0.8,
  metalness: 0.1,
});
const crimson = new THREE.MeshStandardMaterial({
  name: 'CrimsonCord',
  color: 0x641520,
  roughness: 0.7,
  metalness: 0.1,
  emissive: 0x260408,
  emissiveIntensity: 0.55,
});

const M = { cloth, clothSoft, armor, mask, silk, eye, blade, grip, crimson };

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function group(name, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

const ninja = group('KageNinja');

// ---------------------------------------------------------------------------
// Hips / torso
// ---------------------------------------------------------------------------
const hips = group('Hips', 0, 0.94, 0);
ninja.add(hips);

const pelvis = mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.2, 8, 1), cloth, 0, 0, 0);
pelvis.scale.z = 0.78;
hips.add(pelvis);

// waist wrap
const obi = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.075, 10), crimson, 0, 0.055, 0);
obi.scale.z = 0.8;
hips.add(obi);
// knot + hanging cords
const knot = mesh(new THREE.BoxGeometry(0.085, 0.065, 0.06), crimson, 0, 0.045, -0.17);
hips.add(knot);
const cordL = mesh(new THREE.BoxGeometry(0.035, 0.36, 0.015), crimson, -0.045, -0.16, -0.175);
cordL.rotation.z = 0.16;
hips.add(cordL);
const cordR = mesh(new THREE.BoxGeometry(0.035, 0.3, 0.015), crimson, 0.05, -0.13, -0.18);
cordR.rotation.z = -0.12;
hips.add(cordR);

const torso = group('Torso', 0, 0.12, 0);
hips.add(torso);

const chest = mesh(new THREE.CylinderGeometry(0.205, 0.17, 0.44, 8, 1), cloth, 0, 0.24, 0);
chest.scale.z = 0.72;
torso.add(chest);
// faceted shoulder cloth
const mantle = mesh(new THREE.CylinderGeometry(0.275, 0.215, 0.11, 8, 1), clothSoft, 0, 0.435, 0);
mantle.scale.z = 0.72;
torso.add(mantle);
// lacquered chest plate
const plate = mesh(new THREE.BoxGeometry(0.32, 0.26, 0.1), armor, 0, 0.27, 0.115);
plate.rotation.x = -0.06;
torso.add(plate);
// glowing emblem
const emblem = mesh(new THREE.TorusGeometry(0.042, 0.009, 6, 18), silk, 0, 0.3, 0.172);
torso.add(emblem);
const emblemDot = mesh(new THREE.BoxGeometry(0.016, 0.066, 0.01), silk, 0, 0.3, 0.171);
torso.add(emblemDot);

// diagonal shadow sash
const sash = mesh(new THREE.BoxGeometry(0.07, 0.56, 0.025), crimson, 0.02, 0.24, 0.163);
sash.rotation.z = -0.62;
torso.add(sash);
const sashEdge = mesh(new THREE.BoxGeometry(0.016, 0.56, 0.008), silk, 0.055, 0.24, 0.178);
sashEdge.rotation.z = -0.62;
torso.add(sashEdge);

// ---------------------------------------------------------------------------
// Head
// ---------------------------------------------------------------------------
const neck = group('Neck', 0, 0.5, 0);
torso.add(neck);

const head = group('Head', 0, 0.1, 0);
neck.add(head);

// fitted hood (balaclava) + slightly protruding pale half-mask
const skull = mesh(new THREE.SphereGeometry(0.145, 12, 10), cloth, 0, 0.035, 0);
skull.scale.set(1, 1.02, 0.98);
head.add(skull);
const cowl = mesh(new THREE.SphereGeometry(0.176, 12, 9), clothSoft, 0, 0.045, -0.018);
cowl.scale.set(1, 0.98, 0.96);
head.add(cowl);

// lower face mask
const faceMask = mesh(new THREE.SphereGeometry(0.12, 12, 10), mask, 0, -0.022, 0.083);
faceMask.scale.set(0.95, 0.66, 0.58);
head.add(faceMask);
const maskSeam = mesh(new THREE.BoxGeometry(0.005, 0.1, 0.015), cloth, 0, -0.035, 0.163);
head.add(maskSeam);
const noseRidge = mesh(new THREE.BoxGeometry(0.03, 0.07, 0.02), mask, 0, 0.038, 0.163);
head.add(noseRidge);

// dark visor + two cyan eyes
const visor = mesh(new THREE.BoxGeometry(0.2, 0.052, 0.06), cloth, 0, 0.072, 0.12);
visor.rotation.x = -0.08;
head.add(visor);
const eyeGeo = new THREE.BoxGeometry(0.046, 0.012, 0.01);
const eyeL = new THREE.Mesh(eyeGeo, eye);
eyeL.position.set(-0.048, 0.074, 0.155);
eyeL.rotation.z = 0.13;
head.add(eyeL);
const eyeR = new THREE.Mesh(eyeGeo, eye);
eyeR.position.set(0.048, 0.074, 0.155);
eyeR.rotation.z = -0.13;
head.add(eyeR);

// lacquered brow plate
const browPlate = mesh(new THREE.BoxGeometry(0.2, 0.042, 0.026), armor, 0, 0.122, 0.121);
browPlate.rotation.x = -0.14;
head.add(browPlate);
const browMark = mesh(new THREE.BoxGeometry(0.04, 0.012, 0.01), silk, 0, 0.122, 0.139);
head.add(browMark);

// swept hood tail
const hoodTail = mesh(new THREE.ConeGeometry(0.105, 0.3, 7, 1), clothSoft, 0, 0.06, -0.21);
hoodTail.rotation.x = -2.15;
head.add(hoodTail);

// headband tails
const bandKnot = mesh(new THREE.TorusGeometry(0.035, 0.014, 5, 10), crimson, -0.16, 0.05, -0.03);
bandKnot.rotation.y = 1.1;
head.add(bandKnot);
const bandTailL = mesh(new THREE.PlaneGeometry(0.055, 0.34), crimson, -0.16, -0.1, -0.12);
bandTailL.rotation.set(0.25, 0.5, 0.35);
head.add(bandTailL);
const bandTailR = mesh(new THREE.PlaneGeometry(0.045, 0.27), crimson, -0.12, -0.08, -0.16);
bandTailR.rotation.set(0.35, 0.2, 0.12);
head.add(bandTailR);

// clan crest on the back (readable from the chase camera)
const crestRing = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.078, 6), eye);
crestRing.name = 'BackCrestRing';
crestRing.position.set(0, 0.26, -0.186);
crestRing.rotation.y = PI;
crestRing.rotation.z = PI / 6;
torso.add(crestRing);
const crestDiamond = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.055), eye);
crestDiamond.name = 'BackCrestDiamond';
crestDiamond.position.set(0, 0.26, -0.187);
crestDiamond.rotation.y = PI;
crestDiamond.rotation.z = PI / 4;
torso.add(crestDiamond);
const backStrap = mesh(new THREE.BoxGeometry(0.06, 0.4, 0.02), crimson, 0, 0.22, -0.19);
backStrap.rotation.z = 0.55;
torso.add(backStrap);

// cowl draped over the shoulders
const hoodCollar = mesh(new THREE.CylinderGeometry(0.215, 0.28, 0.17, 8, 1, true), clothSoft, 0, 0.43, -0.02);
hoodCollar.scale.z = 0.8;
torso.add(hoodCollar);

// scarf collar
const collar = mesh(new THREE.TorusGeometry(0.158, 0.05, 7, 18), silk, 0, -0.1, 0);
collar.rotation.x = PI / 2;
collar.scale.z = 0.88;
neck.add(collar);

const scarfA = group('ScarfA', 0.07, -0.11, -0.15);
neck.add(scarfA);
const scarfAMesh = mesh(new THREE.PlaneGeometry(0.115, 0.55, 1, 4), silk, 0, -0.27, 0);
scarfAMesh.rotation.x = 0.18;
scarfA.add(scarfAMesh);
const scarfAJoint = group('ScarfA2', 0, -0.53, 0);
scarfA.add(scarfAJoint);
const scarfAEnd = mesh(new THREE.PlaneGeometry(0.08, 0.45, 1, 3), silk, 0, -0.22, 0);
scarfAEnd.rotation.x = 0.14;
scarfAJoint.add(scarfAEnd);

const scarfB = group('ScarfB', -0.075, -0.1, -0.175);
neck.add(scarfB);
const scarfBMesh = mesh(new THREE.PlaneGeometry(0.082, 0.44, 1, 3), silk, 0, -0.22, 0);
scarfBMesh.rotation.x = 0.12;
scarfB.add(scarfBMesh);
const scarfBJoint = group('ScarfB2', 0, -0.43, 0);
scarfB.add(scarfBJoint);
const scarfBEnd = mesh(new THREE.PlaneGeometry(0.062, 0.36, 1, 2), silk, 0, -0.18, 0);
scarfBJoint.add(scarfBEnd);

// ---------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------
function buildArm(side) {
  // side +1 = character's right (+X when facing +Z)
  const s = side > 0 ? 'R' : 'L';
  const shoulder = group(`Shoulder${s}`, 0.24 * side, 0.4, 0);
  shoulder.rotation.z = 0.1 * side;
  torso.add(shoulder);

  const pad = mesh(new THREE.SphereGeometry(0.096, 8, 6, 0, PI * 2, 0, PI * 0.6), armor, 0.01 * side, 0.02, 0);
  pad.scale.set(1.1, 0.78, 1.0);
  shoulder.add(pad);
  const padTrim = mesh(new THREE.BoxGeometry(0.14, 0.018, 0.16), silk, 0.015 * side, -0.028, 0);
  shoulder.add(padTrim);
  const padPlate = mesh(new THREE.BoxGeometry(0.105, 0.03, 0.055), armor, 0.008 * side, 0.026, 0.066);
  padPlate.rotation.x = -0.2;
  shoulder.add(padPlate);

  const upperArm = mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.3, 7), cloth, 0, -0.16, 0);
  shoulder.add(upperArm);

  const elbow = group(`Elbow${s}`, 0, -0.32, 0);
  elbow.rotation.x = -0.16;
  shoulder.add(elbow);
  elbow.add(mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.27, 7), cloth, 0, -0.13, 0));
  // forearm wrap
  elbow.add(mesh(new THREE.CylinderGeometry(0.062, 0.056, 0.07, 7), crimson, 0, -0.2, 0));
  // glove
  const hand = group(`Hand${s}`, 0, -0.28, 0);
  elbow.add(hand);
  const fist = mesh(new THREE.SphereGeometry(0.062, 8, 6), armor, 0, 0, 0);
  fist.scale.set(0.85, 1.05, 0.9);
  hand.add(fist);

  return { shoulder, elbow, hand };
}

const armR = buildArm(1);
const armL = buildArm(-1);

// Right hand holds the katana (scene-graph depth: KageNinja > Hips > Torso > ShoulderR > ElbowR > HandR > SwordRoot > blade)
const swordRoot = group('SwordRoot', 0.015, -0.05, 0.02);
swordRoot.rotation.set(-0.25, 0.06, -0.3);
armR.hand.add(swordRoot);

const gripMesh = mesh(new THREE.BoxGeometry(0.033, 0.235, 0.033), grip, 0, -0.05, 0);
swordRoot.add(gripMesh);
for (let i = 0; i < 7; i++) {
  const wrap = mesh(new THREE.BoxGeometry(0.039, 0.014, 0.039), crimson, 0, -0.15 + i * 0.033, 0);
  wrap.rotation.y = i % 2 ? 0.45 : -0.45;
  swordRoot.add(wrap);
}
const pommel = mesh(new THREE.BoxGeometry(0.04, 0.032, 0.04), armor, 0, -0.17, 0);
swordRoot.add(pommel);
const guard = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.014, 12), armor, 0, 0.07, 0);
guard.scale.z = 0.68;
swordRoot.add(guard);
const habaki = mesh(new THREE.BoxGeometry(0.052, 0.045, 0.03), armor, 0, 0.1, 0);
swordRoot.add(habaki);

// curved tapered blade (custom geometry)
function bladeGeometry(length = 0.7, baseWidth = 0.044, curve = 0.065, thickness = 0.013, segs = 7) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = t * length;
    const w = baseWidth * (1 - t * 0.82) * (i === segs ? 0.06 : 1);
    const z = Math.pow(t, 1.7) * curve;
    const th = thickness * (1 - t * 0.65);
    positions.push(-w, y, z, w, y, z, w, y, z + th, -w, y, z + th);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    for (let j = 0; j < 4; j++) {
      const j2 = (j + 1) % 4;
      indices.push(a + j, b + j, b + j2, a + j, b + j2, a + j2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const bladeMesh = new THREE.Mesh(bladeGeometry(), blade);
bladeMesh.name = 'KatanaBlade';
bladeMesh.castShadow = true;
bladeMesh.position.y = 0.12;
swordRoot.add(bladeMesh);

// emissive hamon glow follows the blade curve
const hamonPts = [];
for (let i = 0; i <= 10; i++) {
  const t = i / 10;
  hamonPts.push(new THREE.Vector3(
    -0.044 * (1 - t * 0.82),
    0.12 + t * 0.7,
    Math.pow(t, 1.7) * 0.065 + 0.014
  ));
}
const hamonGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hamonPts), 16, 0.0035, 4, false);
const hamon = new THREE.Mesh(hamonGeo, silk);
swordRoot.add(hamon);

const sageo = mesh(new THREE.TorusGeometry(0.045, 0.01, 5, 10), crimson, 0, -0.13, 0.02);
sageo.rotation.x = PI / 2;
swordRoot.add(sageo);

// small sheathed tanto at the back of the belt
const tanto = group('Tanto', -0.14, 0.02, -0.14);
tanto.rotation.z = 0.7;
tanto.rotation.x = 0.2;
hips.add(tanto);
tanto.add(mesh(new THREE.BoxGeometry(0.04, 0.3, 0.025), grip, 0, 0, 0));
tanto.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.045, 8), crimson, 0, -0.16, 0));

// ---------------------------------------------------------------------------
// Legs
// ---------------------------------------------------------------------------
function buildLeg(side) {
  const s = side > 0 ? 'R' : 'L';
  const hip = group(`Hip${s}`, 0.115 * side, -0.04, 0);
  hip.rotation.z = 0.03 * side;
  hips.add(hip);

  const thigh = mesh(new THREE.CylinderGeometry(0.092, 0.072, 0.4, 7), clothSoft, 0, -0.2, 0);
  hip.add(thigh);
  // thigh wrap
  const wrap = mesh(new THREE.CylinderGeometry(0.095, 0.09, 0.06, 7), crimson, 0, -0.28, 0);
  hip.add(wrap);

  const knee = group(`Knee${s}`, 0, -0.42, 0);
  hip.add(knee);
  const kneePad = mesh(new THREE.SphereGeometry(0.075, 7, 5), armor, 0, 0.01, 0.055);
  kneePad.scale.set(1, 0.9, 0.7);
  knee.add(kneePad);
  knee.add(mesh(new THREE.CylinderGeometry(0.07, 0.052, 0.37, 7), cloth, 0, -0.19, 0));
  // shin guard
  const shin = mesh(new THREE.BoxGeometry(0.105, 0.26, 0.06), armor, 0, -0.21, 0.055);
  shin.rotation.x = -0.06;
  knee.add(shin);

  const foot = mesh(new THREE.BoxGeometry(0.12, 0.075, 0.26), cloth, 0, -0.395, 0.065);
  knee.add(foot);
  const toe = mesh(new THREE.BoxGeometry(0.115, 0.055, 0.11), armor, 0, -0.4, 0.2);
  knee.add(toe);

  return { hip, knee };
}

const legR = buildLeg(1);
const legL = buildLeg(-1);

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------
const euler = new THREE.Euler();
const quat = new THREE.Quaternion();

function qTrack(node, times, rotations) {
  const values = [];
  for (const [x, y, z] of rotations) {
    euler.set(x, y, z, 'XYZ');
    quat.setFromEuler(euler);
    values.push(quat.x, quat.y, quat.z, quat.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, times, values);
}

function vTrack(node, times, positions) {
  const values = [];
  for (const [x, y, z] of positions) values.push(x, y, z);
  return new THREE.VectorKeyframeTrack(`${node}.position`, times, values);
}

const rest = {
  hipR: [0, 0, 0.03],
  hipL: [0, 0, -0.03],
  kneeR: [0, 0, 0],
  kneeL: [0, 0, 0],
  shoulderR: [0, 0, 0.1],
  shoulderL: [0, 0, -0.1],
  elbowR: [-0.16, 0, 0],
  elbowL: [-0.16, 0, 0],
  torso: [-0.02, 0, 0],
  head: [0.02, 0, 0],
  scarfA: [0.15, 0, 0.12],
  scarfB: [0.12, 0, -0.08],
};

// IDLE ----------------------------------------------------------------------
const idleTimes = [0, 1.6, 3.2];
const idle = new THREE.AnimationClip('Idle', 3.2, [
  vTrack('Hips', idleTimes, [[0, 0.94, 0], [0, 0.952, 0], [0, 0.94, 0]]),
  qTrack('Torso', idleTimes, [[-0.01, 0, 0], [-0.035, 0.02, 0], [-0.01, 0, 0]]),
  qTrack('Head', idleTimes, [[0.02, 0.05, 0], [0.01, -0.08, 0.02], [0.02, 0.05, 0]]),
  qTrack('ShoulderR', idleTimes, [[0, 0, 0.1], [0.02, 0, 0.13], [0, 0, 0.1]]),
  qTrack('ShoulderL', idleTimes, [[0, 0, -0.1], [0.02, 0, -0.13], [0, 0, -0.1]]),
  qTrack('ElbowR', idleTimes, [[-0.2, 0, 0], [-0.24, 0, 0], [-0.2, 0, 0]]),
  qTrack('ElbowL', idleTimes, [[-0.16, 0, 0], [-0.2, 0, 0], [-0.16, 0, 0]]),
  qTrack('ScarfA', idleTimes, [[0.3, 0.08, 0.32], [0.46, -0.08, 0.4], [0.3, 0.08, 0.32]]),
  qTrack('ScarfB', idleTimes, [[0.26, -0.1, -0.25], [0.4, 0.12, -0.35], [0.26, -0.1, -0.25]]),
  qTrack('ScarfA2', idleTimes, [[0.1, 0.1, 0.16], [0.26, -0.12, 0.3], [0.1, 0.1, 0.16]]),
  qTrack('ScarfB2', idleTimes, [[0.08, -0.08, 0.1], [0.2, 0.1, 0.22], [0.08, -0.08, 0.1]]),
  qTrack('HipR', idleTimes, [[0, 0, 0.03], [0, 0, 0.03], [0, 0, 0.03]]),
  qTrack('HipL', idleTimes, [[0, 0, -0.03], [0, 0, -0.03], [0, 0, -0.03]]),
]);

// RUN -----------------------------------------------------------------------
const runTimes = [0, 0.13, 0.26, 0.39, 0.52];
const run = new THREE.AnimationClip('Run', 0.52, [
  vTrack('Hips', runTimes, [
    [0, 0.905, 0.035], [0, 0.955, 0.03], [0, 0.9, 0.035], [0, 0.955, 0.03], [0, 0.905, 0.035],
  ]),
  qTrack('Torso', runTimes, [
    [-0.22, 0.08, 0], [-0.24, 0, 0], [-0.22, -0.08, 0], [-0.24, 0, 0], [-0.22, 0.08, 0],
  ]),
  qTrack('Head', runTimes, [
    [0.14, -0.08, 0], [0.16, 0, 0], [0.14, 0.08, 0], [0.16, 0, 0], [0.14, -0.08, 0],
  ]),
  qTrack('HipL', runTimes, [
    [0.85, 0, -0.06], [0.15, 0, -0.03], [-0.82, 0, 0.02], [-0.15, 0, -0.02], [0.85, 0, -0.06],
  ]),
  qTrack('KneeL', runTimes, [
    [0.18, 0, 0], [1.05, 0, 0], [0.25, 0, 0], [1.25, 0, 0], [0.18, 0, 0],
  ]),
  qTrack('HipR', runTimes, [
    [-0.82, 0, 0.02], [-0.15, 0, -0.02], [0.85, 0, -0.06], [0.15, 0, -0.03], [-0.82, 0, 0.02],
  ]),
  qTrack('KneeR', runTimes, [
    [0.25, 0, 0], [1.25, 0, 0], [0.18, 0, 0], [1.05, 0, 0], [0.25, 0, 0],
  ]),
  qTrack('ShoulderL', runTimes, [
    [-0.85, 0, -0.18], [-0.15, 0, -0.12], [0.8, 0, -0.2], [0.15, 0, -0.12], [-0.85, 0, -0.18],
  ]),
  qTrack('ElbowL', runTimes, [
    [-1.0, 0, 0], [-1.35, 0, 0], [-0.7, 0, 0], [-1.2, 0, 0], [-1.0, 0, 0],
  ]),
  qTrack('ShoulderR', runTimes, [
    [0.8, 0, 0.2], [0.15, 0, 0.12], [-0.85, 0, 0.18], [-0.15, 0, 0.12], [0.8, 0, 0.2],
  ]),
  qTrack('ElbowR', runTimes, [
    [-0.7, 0, 0], [-1.2, 0, 0], [-1.0, 0, 0], [-1.35, 0, 0], [-0.7, 0, 0],
  ]),
  qTrack('ScarfA', runTimes, [
    [1.15, 0.12, 0.32], [1.34, -0.08, 0.45], [1.08, 0.16, 0.26], [1.3, -0.12, 0.4], [1.15, 0.12, 0.32],
  ]),
  qTrack('ScarfB', runTimes, [
    [1.02, -0.2, -0.28], [1.2, 0.12, -0.4], [0.96, -0.24, -0.23], [1.16, 0.16, -0.36], [1.02, -0.2, -0.28],
  ]),
  qTrack('ScarfA2', runTimes, [
    [0.5, 0.25, 0.3], [0.8, -0.2, 0.45], [0.42, 0.3, 0.22], [0.72, -0.25, 0.38], [0.5, 0.25, 0.3],
  ]),
  qTrack('ScarfB2', runTimes, [
    [0.4, -0.3, 0.2], [0.66, 0.25, 0.35], [0.32, -0.34, 0.14], [0.6, 0.3, 0.3], [0.4, -0.3, 0.2],
  ]),
]);

// SLASH ---------------------------------------------------------------------
const slashTimes = [0, 0.16, 0.3, 0.44, 0.72];
const slash = new THREE.AnimationClip('Slash', 0.72, [
  vTrack('Hips', slashTimes, [
    [0, 0.94, 0], [0, 0.9, -0.04], [0, 0.92, 0.14], [0, 0.92, 0.18], [0, 0.94, 0],
  ]),
  qTrack('Hips', slashTimes, [
    [0, 0, 0], [0, 0.65, 0], [0, -0.5, 0], [0, -0.35, 0], [0, 0, 0],
  ]),
  qTrack('Torso', slashTimes, [
    [-0.05, 0.1, 0], [-0.1, 0.75, -0.12], [-0.22, -0.8, 0.16], [-0.16, -0.45, 0.1], [-0.02, 0, 0],
  ]),
  qTrack('ShoulderR', slashTimes, [
    [0, 0, 0.1], [-0.4, -0.3, 1.9], [0.3, 0.2, -1.25], [0.9, 0.2, -0.75], [0, 0, 0.1],
  ]),
  qTrack('ElbowR', slashTimes, [
    [-0.2, 0, 0], [-1.7, 0, 0], [-0.25, 0, 0], [-0.55, 0, 0], [-0.16, 0, 0],
  ]),
  qTrack('ShoulderL', slashTimes, [
    [0, 0, -0.1], [-0.5, 0, -0.9], [0.4, 0, -0.45], [0.2, 0, -0.3], [0, 0, -0.1],
  ]),
  qTrack('Head', slashTimes, [
    [0, 0, 0], [0, 0.45, 0], [0.08, -0.55, 0], [0, -0.3, 0], [0, 0, 0],
  ]),
  qTrack('HipL', slashTimes, [
    [0, 0, -0.03], [-0.5, 0, -0.15], [0.35, 0, 0.08], [0.2, 0, 0.05], [0, 0, -0.03],
  ]),
  qTrack('KneeL', slashTimes, [[0, 0, 0], [0.7, 0, 0], [0.35, 0, 0], [0.3, 0, 0], [0, 0, 0]]),
  qTrack('HipR', slashTimes, [
    [0, 0, 0.03], [0.25, 0, 0.15], [-0.45, 0, -0.05], [-0.3, 0, 0], [0, 0, 0.03],
  ]),
  qTrack('KneeR', slashTimes, [[0, 0, 0], [0.5, 0, 0], [0.8, 0, 0], [0.6, 0, 0], [0, 0, 0]]),
  qTrack('ScarfA', slashTimes, [
    [-0.4, 0, 0.1], [0.2, 0.4, 0.6], [-1.4, -0.3, 0.2], [-1.2, 0.1, 0.1], [0.15, 0, 0.12],
  ]),
  qTrack('ScarfB', slashTimes, [
    [-0.3, 0, -0.1], [0.1, -0.3, -0.4], [-1.3, 0.25, -0.25], [-1.1, -0.1, -0.15], [0.12, 0, -0.08],
  ]),
  qTrack('ScarfA2', slashTimes, [
    [0.1, 0, 0.15], [-0.3, 0.3, -0.2], [-0.9, -0.3, 0.5], [-0.7, 0.2, 0.3], [0.1, 0.1, 0.16],
  ]),
  qTrack('ScarfB2', slashTimes, [
    [0.1, 0, 0.1], [-0.2, -0.3, -0.1], [-0.75, 0.3, 0.4], [-0.6, -0.2, 0.2], [0.08, -0.08, 0.1],
  ]),
]);

// STORM ---------------------------------------------------------------------
const stormTimes = [0, 0.16, 0.32, 0.48, 0.64, 0.82];
const stormSpin = [0, PI / 2, PI, 1.5 * PI, 2 * PI, 2 * PI];
const storm = new THREE.AnimationClip('Storm', 0.82, [
  qTrack('Hips', stormTimes, stormSpin.map((a, i) => [i === 5 ? 0 : 0.08, a, 0])),
  vTrack('Hips', stormTimes, stormTimes.map((_, i) => [0, i === 5 ? 0.94 : 1.0, 0])),
  qTrack('Torso', stormTimes, stormTimes.map(() => [-0.08, 0, 0])),
  qTrack('ShoulderR', stormTimes, stormTimes.map(() => [0.05, 0, -1.45])),
  qTrack('ShoulderL', stormTimes, stormTimes.map(() => [0.05, 0, 1.45])),
  qTrack('ElbowR', stormTimes, stormTimes.map(() => [-0.05, 0, 0])),
  qTrack('ElbowL', stormTimes, stormTimes.map(() => [-0.05, 0, 0])),
  qTrack('ScarfA', stormTimes, stormTimes.map((_, i) => [1.55, 0.5 * Math.sin(i * 2), 0.6])),
  qTrack('ScarfB', stormTimes, stormTimes.map((_, i) => [1.4, -0.5 * Math.cos(i * 2), -0.55])),
  qTrack('ScarfA2', stormTimes, stormTimes.map((_, i) => [0.6, 0.6 * Math.sin(i * 1.7), 0.4])),
  qTrack('ScarfB2', stormTimes, stormTimes.map((_, i) => [0.5, -0.6 * Math.cos(i * 1.4), -0.4])),
  qTrack('HipL', stormTimes, [[0, 0, 0], [0.3, 0, 0], [-0.2, 0, 0], [0.3, 0, 0], [-0.2, 0, 0], [0, 0, 0]]),
  qTrack('HipR', stormTimes, [[0, 0, 0], [-0.3, 0, 0], [0.2, 0, 0], [-0.3, 0, 0], [0.2, 0, 0], [0, 0, 0]]),
  qTrack('KneeL', stormTimes, stormTimes.map((_, i) => [i % 2 ? 0.7 : 0.35, 0, 0])),
  qTrack('KneeR', stormTimes, stormTimes.map((_, i) => [i % 2 ? 0.35 : 0.7, 0, 0])),
]);

// VICTORY -------------------------------------------------------------------
const victoryTimes = [0, 0.5, 1.4, 2.4];
const victory = new THREE.AnimationClip('Victory', 2.4, [
  vTrack('Hips', victoryTimes, [[0, 0.98, 0], [0, 1.0, 0], [0, 0.985, 0], [0, 1.0, 0]]),
  qTrack('Torso', victoryTimes, [
    [-0.05, 0, 0], [-0.12, 0, 0], [-0.1, 0.06, 0], [-0.12, 0, 0],
  ]),
  qTrack('Head', victoryTimes, [
    [0, 0, 0], [-0.2, 0, 0], [-0.16, 0.1, 0], [-0.2, 0, 0],
  ]),
  qTrack('ShoulderR', victoryTimes, [
    [0, 0, 0.1], [-0.2, 0, 2.5], [-0.2, 0, 2.62], [-0.2, 0, 2.5],
  ]),
  qTrack('ElbowR', victoryTimes, [[-0.16, 0, 0], [-0.3, 0, 0], [-0.25, 0, 0], [-0.3, 0, 0]]),
  qTrack('ShoulderL', victoryTimes, [
    [0, 0, -0.1], [0.1, 0, -0.3], [0.05, 0, -0.26], [0.1, 0, -0.3],
  ]),
  qTrack('HipL', victoryTimes, [[0, 0, -0.06], [0, 0, -0.08], [0, 0, -0.08], [0, 0, -0.06]]),
  qTrack('HipR', victoryTimes, [[0, 0, 0.03], [0, 0, 0.08], [0, 0, 0.08], [0, 0, 0.03]]),
  qTrack('ScarfA', victoryTimes, [
    [0.3, 0.08, 0.32], [1.0, 0.2, 0.6], [1.2, 0.45, 0.5], [1.0, 0.15, 0.65],
  ]),
  qTrack('ScarfB', victoryTimes, [
    [0.26, -0.1, -0.25], [0.9, -0.25, -0.5], [1.1, -0.5, -0.4], [0.9, -0.2, -0.55],
  ]),
  qTrack('ScarfA2', victoryTimes, [
    [0.1, 0.1, 0.16], [-0.5, 0.3, 0.5], [-0.6, 0.5, 0.4], [-0.45, 0.25, 0.55],
  ]),
  qTrack('ScarfB2', victoryTimes, [
    [0.08, -0.08, 0.1], [-0.4, -0.3, 0.35], [-0.5, -0.45, 0.25], [-0.35, -0.2, 0.4],
  ]),
]);

// DEFEAT --------------------------------------------------------------------
const defeatTimes = [0, 0.35, 0.9, 1.35];
const defeat = new THREE.AnimationClip('Defeat', 1.35, [
  vTrack('Hips', defeatTimes, [[0, 0.94, 0], [0, 0.72, -0.05], [0, 0.47, -0.08], [0, 0.42, -0.1]]),
  qTrack('Hips', defeatTimes, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]),
  qTrack('Torso', defeatTimes, [
    [-0.02, 0, 0], [-0.5, 0.2, 0.1], [-1.0, 0.2, 0.05], [-1.1, 0.3, 0.1],
  ]),
  qTrack('Head', defeatTimes, [[0, 0, 0], [0.4, 0.2, 0], [0.7, 0.1, 0], [0.8, 0.15, 0]]),
  qTrack('ShoulderR', defeatTimes, [
    [0, 0, 0.1], [0.2, 0, -0.2], [0.5, 0, -0.5], [0.7, 0, -0.6],
  ]),
  qTrack('ShoulderL', defeatTimes, [
    [0, 0, -0.1], [0.2, 0, 0.2], [0.5, 0, 0.55], [0.75, 0, 0.7],
  ]),
  qTrack('ElbowR', defeatTimes, [[-0.16, 0, 0], [-0.5, 0, 0], [-0.1, 0, 0], [-0.05, 0, 0]]),
  qTrack('ElbowL', defeatTimes, [[-0.16, 0, 0], [-0.6, 0, 0], [-0.2, 0, 0], [-0.1, 0, 0]]),
  qTrack('HipL', defeatTimes, [
    [0, 0, -0.03], [-0.8, 0, -0.25], [-1.55, 0, -0.35], [-1.7, 0, -0.4],
  ]),
  qTrack('HipR', defeatTimes, [
    [0, 0, 0.03], [-0.6, 0, 0.25], [-1.4, 0, 0.35], [-1.6, 0, 0.38],
  ]),
  qTrack('KneeL', defeatTimes, [[0, 0, 0], [1.5, 0, 0], [2.1, 0, 0], [2.2, 0, 0]]),
  qTrack('KneeR', defeatTimes, [[0, 0, 0], [1.4, 0, 0], [2.0, 0, 0], [2.1, 0, 0]]),
  qTrack('ScarfA', defeatTimes, [[0.15, 0, 0.1], [-0.1, 0, 0.2], [0.3, 0, 0.1], [0.4, 0, 0.05]]),
  qTrack('ScarfB', defeatTimes, [[0.1, 0, -0.1], [-0.2, 0, -0.3], [0.2, 0, -0.2], [0.3, 0, -0.15]]),
  qTrack('ScarfA2', defeatTimes, [[0.1, 0, 0.15], [-0.3, 0.1, 0.3], [0.4, 0, 0.2], [0.5, 0, 0.12]]),
  qTrack('ScarfB2', defeatTimes, [[0.08, 0, 0.1], [-0.3, 0, 0.25], [0.3, 0, 0.15], [0.4, 0, 0.1]]),
]);

const clips = [idle, run, slash, storm, victory, defeat];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
for (const clip of clips) clip.optimize();

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(ninja, { binary: true, animations: clips });
const outFile = path.join(outDir, 'ninja.glb');
fs.writeFileSync(outFile, Buffer.from(glb));
console.log(`Exported ${outFile} (${(glb.byteLength / 1024).toFixed(1)} KB), clips: ${clips.map((c) => c.name).join(', ')}`);
