import * as THREE from 'three';
import {
  clamp,
  makePart,
  mergeParts,
  mulberry32,
  portalTexture,
  range,
  TAU,
  gateSignTexture,
  squadSignTexture,
} from './utils.js';

const LANES = [-2.35, 0, 2.35];

const GATE_ROWS = [
  {
    z: -32,
    options: [
      { op: 'add', value: 7 },
      { op: 'mul', value: 2 },
      { op: 'add', value: 10 },
    ],
  },
  {
    z: -102,
    options: [
      { op: 'add', value: 12 },
      { op: 'mul', value: 2 },
      { op: 'add', value: 18 },
    ],
  },
  {
    z: -172,
    options: [
      { op: 'mul', value: 3 },
      { op: 'add', value: 22 },
      { op: 'mul', value: 2 },
    ],
  },
  {
    z: -242,
    options: [
      { op: 'add', value: 24 },
      { op: 'mul', value: 2 },
      { op: 'add', value: 34 },
    ],
  },
  {
    z: -312,
    options: [
      { op: 'mul', value: 2 },
      { op: 'add', value: 38 },
      { op: 'mul', value: 3 },
    ],
  },
  {
    z: -382,
    options: [
      { op: 'add', value: 40 },
      { op: 'mul', value: 2 },
      { op: 'add', value: 55 },
    ],
  },
];

const SQUADS = [
  { z: -67, power: 10 },
  { z: -137, power: 18 },
  { z: -207, power: 28 },
  { z: -277, power: 40 },
  { z: -347, power: 54 },
];

const ORBS = [
  { z: -50, x: 2.3 },
  { z: -118, x: -2.3 },
  { z: -188, x: 0 },
  { z: -258, x: 2.3 },
  { z: -328, x: -2.3 },
  { z: -402, x: 0 },
];

function buildGateFrame(accent) {
  const parts = [];
  for (const side of [-1, 1]) {
    parts.push(makePart(new THREE.BoxGeometry(0.18, 3.7, 0.28), 0x0c161b, [side * 1.05, 1.85, 0]));
    parts.push(makePart(new THREE.BoxGeometry(0.28, 0.28, 0.42), accent, [side * 1.05, 0.16, 0]));
    parts.push(makePart(new THREE.BoxGeometry(0.3, 0.18, 0.38), accent, [side * 1.05, 3.62, 0]));
    parts.push(makePart(new THREE.BoxGeometry(0.1, 1.1, 0.1), 0x24353c, [side * 0.72, 2.65, 0], [0, 0, side * 0.45]));
  }
  parts.push(makePart(new THREE.BoxGeometry(2.55, 0.28, 0.36), 0x0b1418, [0, 3.77, 0]));
  parts.push(makePart(new THREE.BoxGeometry(2.2, 0.1, 0.3), accent, [0, 3.6, 0]));
  for (const side of [-1, 1]) {
    parts.push(makePart(new THREE.BoxGeometry(0.07, 2.75, 0.1), accent, [side * 0.94, 1.55, 0.02]));
  }
  return mergeParts(parts);
}

function buildRoninBody() {
  const parts = [];
  const box = (w, h, d, color, pos, rot) => makePart(new THREE.BoxGeometry(w, h, d), color, pos, rot);
  for (const side of [-1, 1]) {
    parts.push(box(0.21, 0.64, 0.22, 0x241318, [side * 0.17, 0.36, 0], [0, 0, side * 0.06]));
    parts.push(box(0.23, 0.12, 0.34, 0x100e10, [side * 0.17, 0.07, 0.04]));
    parts.push(box(0.25, 0.38, 0.31, 0x4b141b, [side * 0.19, 0.68, 0], [0, 0, side * 0.06]));
    parts.push(box(0.2, 0.52, 0.2, 0x2a1014, [side * 0.42, 1.04, 0.08], [side * 0.75, 0, side * 0.1]));
    parts.push(makePart(new THREE.SphereGeometry(0.11, 6, 5), 0x8f806b, [side * 0.44, 0.76, 0.26]));
    parts.push(box(0.38, 0.18, 0.46, 0x3a1117, [side * 0.39, 1.31, 0], [0, 0, side * 0.2]));
    parts.push(
      makePart(new THREE.ConeGeometry(0.12, 0.34, 5), 0x8f7b54, [side * 0.5, 1.52, 0], [0, 0, side * 0.55])
    );
  }
  parts.push(box(0.68, 0.62, 0.36, 0x361116, [0, 1.03, 0]));
  parts.push(box(0.76, 0.2, 0.43, 0x1d0b0e, [0, 0.78, 0]));
  parts.push(box(0.5, 0.22, 0.4, 0x5d1c22, [0, 1.32, 0]));
  parts.push(makePart(new THREE.SphereGeometry(0.235, 8, 6), 0x8c7f69, [0, 1.6, 0.02]));
  parts.push(box(0.34, 0.16, 0.05, 0x141013, [0, 1.55, 0.22]));
  parts.push(box(0.47, 0.12, 0.43, 0x2b0d12, [0, 1.77, 0]));
  parts.push(
    makePart(new THREE.ConeGeometry(0.09, 0.5, 5), 0x9c855d, [-0.22, 1.93, 0], [0, 0, 0.55])
  );
  parts.push(
    makePart(new THREE.ConeGeometry(0.09, 0.5, 5), 0x9c855d, [0.22, 1.93, 0], [0, 0, -0.55])
  );
  parts.push(box(0.06, 1.15, 0.06, 0x1a2226, [0.48, 1.0, 0.25], [0.2, 0, 0.55]));
  parts.push(box(0.09, 0.35, 0.09, 0x5c1b22, [0.65, 1.5, 0.26], [0.2, 0, 0.55]));
  parts.push(box(0.62, 0.1, 0.38, 0x5b5d58, [0, 1.05, 0.18]));
  return mergeParts(parts);
}

function buildRoninVisor() {
  const parts = [];
  parts.push(makePart(new THREE.BoxGeometry(0.24, 0.045, 0.024), 0xff314b, [0, 1.6, 0.235]));
  parts.push(makePart(new THREE.BoxGeometry(0.1, 0.06, 0.02), 0xff835e, [0, 1.74, 0.225]));
  return mergeParts(parts);
}

export class Stage {
  constructor(scene, vfx) {
    this.scene = scene;
    this.vfx = vfx;
    this.rng = mulberry32(9090);
    this.gateRows = [];
    this.squads = [];
    this.orbs = [];
    this.hoveredGate = null;
    this.hoveredSquad = null;
    this._heroX = 0;
    this.dummy = new THREE.Object3D();
    this.buildGates();
    this.buildSquads();
    this.buildOrbs();
  }

  buildGates() {
    this.gateMaterials = {
      add: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        emissive: 0x1fa8bb,
        emissiveIntensity: 1.2,
        roughness: 0.32,
        metalness: 0.72,
      }),
      mul: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        emissive: 0xc28a3f,
        emissiveIntensity: 1.1,
        roughness: 0.32,
        metalness: 0.72,
      }),
      dark: new THREE.MeshStandardMaterial({
        color: 0x0b1418,
        roughness: 0.5,
        metalness: 0.55,
      }),
    };
    const portalTex = portalTexture('#5df4ff');
    const portalTexGold = portalTexture('#f4c47c');
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });

    for (let r = 0; r < GATE_ROWS.length; r++) {
      const def = GATE_ROWS[r];
      const row = { z: def.z, resolved: false, gates: [] };
      for (let i = 0; i < 3; i++) {
        const option = def.options[i];
        const isMul = option.op === 'mul';
        const accent = isMul ? '#f4c47c' : '#5df4ff';
        const group = new THREE.Group();
        group.position.set(LANES[i], 0.05, def.z);

        const frameMat = this.gateMaterials[isMul ? 'mul' : 'add'].clone();
        frameMat.emissiveIntensity = 1;
        const frame = new THREE.Mesh(buildGateFrame(isMul ? 0xb08a4c : 0x2f95a4), frameMat);
        frame.castShadow = true;
        frame.receiveShadow = true;
        group.add(frame);

        const portalMat = new THREE.MeshBasicMaterial({
          map: isMul ? portalTexGold : portalTex,
          color: isMul ? 0xffd18a : 0x9af8ff,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        const portal = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.1), portalMat);
        portal.position.set(0, 1.85, 0);
        group.add(portal);

        const portalBack = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.1), portalMat.clone());
        portalBack.material.opacity = 0.17;
        portalBack.position.set(0, 1.85, -0.06);
        portalBack.rotation.z = Math.PI;
        group.add(portalBack);

        const ringMat = new THREE.MeshBasicMaterial({
          color: isMul ? 0xf4c47c : 0x5df4ff,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.76, 32), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        group.add(ring);

        const labelInfo = gateSignTexture({
          top: '影分身',
          main: isMul ? `×${option.value}` : `+${option.value}`,
          sub: isMul ? (option.value >= 3 ? 'TRIPLE SHADOWS' : 'DOUBLE SHADOWS') : 'REINFORCE',
          accent,
          accent2: isMul ? '#f4c47c' : '#9cf7ff',
        });
        const signMat = new THREE.SpriteMaterial({
          map: labelInfo.texture,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        });
        const sign = new THREE.Sprite(signMat);
        sign.scale.set(3.1, 3.1 / labelInfo.aspect, 1);
        sign.position.set(0, 4.55, 0.1);
        group.add(sign);

        const hitbox = new THREE.Mesh(new THREE.BoxGeometry(2.35, 3.9, 1.3), hitboxMat);
        hitbox.position.set(0, 1.95, 0);
        hitbox.visible = false;
        group.add(hitbox);

        const gate = {
          group,
          frame,
          frameMat,
          portal,
          portalBack,
          portalMat,
          portalBackMat: portalBack.material,
          ring,
          ringMat,
          sign,
          signMat,
          hitbox,
          row: r,
          lane: LANES[i],
          option,
          isMul,
          accent: isMul ? 0xf4c47c : 0x5df4ff,
          resolved: false,
          chosen: false,
          fadeT: 0,
          emitT: this.rng() * 0.6,
          baseY: 4.55,
        };
        hitbox.userData = { kind: 'gate', gate };
        row.gates.push(gate);
        this.scene.add(group);
      }
      this.gateRows.push(row);
    }
  }

  buildSquads() {
    const bodyGeo = buildRoninBody();
    const visorGeo = buildRoninVisor();
    this.squadBodyMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.66,
      metalness: 0.2,
      emissive: 0x1c0408,
      emissiveIntensity: 0.6,
    });
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xff3b4f, toneMapped: false });
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const markerTex = portalTexture('#ff3c57');

    for (let s = 0; s < SQUADS.length; s++) {
      const definition = SQUADS[s];
      const group = new THREE.Group();
      group.position.set(0, 0.05, definition.z);
      const cap = 45;
      const bodies = new THREE.InstancedMesh(bodyGeo, this.squadBodyMaterial, cap);
      const visors = new THREE.InstancedMesh(visorGeo, visorMat, cap);
      bodies.castShadow = true;
      bodies.receiveShadow = true;
      bodies.frustumCulled = false;
      visors.frustumCulled = false;
      bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      visors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(bodies, visors);

      const markerMat = new THREE.MeshBasicMaterial({
        map: markerTex,
        color: 0xff4a5a,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const marker = new THREE.Mesh(new THREE.CircleGeometry(4.4, 32), markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.03;
      group.add(marker);

      const labelInfo = squadSignTexture(definition.power, { maxPower: definition.power });
      const labelMat = new THREE.SpriteMaterial({
        map: labelInfo.texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      const label = new THREE.Sprite(labelMat);
      label.scale.set(4.6, 4.6 / labelInfo.aspect, 1);
      label.position.set(0, 4.7, 0);
      group.add(label);

      const hitbox = new THREE.Mesh(new THREE.BoxGeometry(9.8, 4.4, 6.6), hitboxMat);
      hitbox.position.set(0, 2.1, 0);
      hitbox.visible = false;
      group.add(hitbox);

      const squad = {
        group,
        bodies,
        visors,
        bodiesCap: cap,
        definition,
        z: definition.z,
        maxPower: definition.power,
        power: definition.power,
        label,
        labelMat,
        labelInfo,
        marker,
        markerMat,
        hitbox,
        engaged: false,
        defeated: false,
        fadeT: 1,
        baseY: 4.7,
        visible: Math.min(definition.power, cap),
        seed: 45 + s * 13,
      };
      hitbox.userData = { kind: 'squad', squad };
      this.scene.add(group);
      this.squads.push(squad);
      this._updateSquadInstances(squad, 0);
      this._hideUnusedSquadInstances(squad);
    }
  }

  _squadSlot(index, seed) {
    const rng = mulberry32(seed + index * 17);
    const row = Math.floor(index / 9);
    const col = index % 9;
    const jitterX = (rng() - 0.5) * 0.24;
    const jitterZ = (rng() - 0.5) * 0.5;
    return {
      x: (col - 4) * 0.95 + jitterX,
      z: -row * 1.25 + 0.4 + jitterZ,
      rot: (rng() - 0.5) * 0.3,
      phase: rng() * TAU,
    };
  }

  _updateSquadInstances(squad, elapsed, heroZ = 0) {
    if (squad.defeated) return;
    const count = Math.min(squad.power, squad.bodiesCap);
    const near = Math.abs(heroZ - squad.z) < 45;
    const dummy = this.dummy;
    for (let i = 0; i < count; i++) {
      const slot = this._squadSlot(i, squad.seed);
      const stomp = near ? Math.abs(Math.sin(elapsed * 3.2 + slot.phase)) * 0.06 : 0;
      dummy.position.set(slot.x, stomp, slot.z);
      dummy.rotation.set(0, slot.rot + Math.sin(elapsed * 1.1 + slot.phase) * 0.05, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      squad.bodies.setMatrixAt(i, dummy.matrix);
      squad.visors.setMatrixAt(i, dummy.matrix);
    }
    squad.bodies.instanceMatrix.needsUpdate = true;
    squad.visors.instanceMatrix.needsUpdate = true;
  }

  _hideUnusedSquadInstances(squad) {
    const count = Math.min(squad.power, squad.bodiesCap);
    const dummy = this.dummy;
    dummy.position.set(0, -999, 0);
    dummy.scale.setScalar(0.001);
    dummy.updateMatrix();
    for (let i = count; i < squad.bodiesCap; i++) {
      squad.bodies.setMatrixAt(i, dummy.matrix);
      squad.visors.setMatrixAt(i, dummy.matrix);
    }
    squad.bodies.instanceMatrix.needsUpdate = true;
    squad.visors.instanceMatrix.needsUpdate = true;
    squad.visible = count;
  }

  buildOrbs() {
    this.orbTemplate = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xd7feff, toneMapped: false })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.018, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0x5df4ff, transparent: true, opacity: 0.8, toneMapped: false })
    );
    const ring2 = ring.clone();
    ring2.rotation.x = Math.PI / 2;
    ring.rotation.y = Math.PI / 2.6;
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: portalTexture('#5df4ff'),
        color: 0x74f6ff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
    );
    halo.scale.set(2.2, 2.2, 1);
    this.orbTemplate.add(core, ring, ring2, halo);

    for (let i = 0; i < ORBS.length; i++) {
      const def = ORBS[i];
      const group = this.orbTemplate.clone(true);
      group.position.set(def.x, 1.35, def.z);
      this.scene.add(group);
      this.orbs.push({ group, def, collected: false, phase: i * 1.7, halo });
    }
  }

  reset() {
    for (const row of this.gateRows) {
      row.resolved = false;
      for (const gate of row.gates) {
        gate.resolved = false;
        gate.chosen = false;
        gate.fadeT = 0;
        gate.group.visible = true;
        gate.group.scale.setScalar(1);
        gate.portalMat.opacity = 0.34;
        gate.portalBackMat.opacity = 0.17;
        gate.signMat.opacity = 1;
        gate.ringMat.opacity = 0.7;
        gate.frameMat.emissiveIntensity = 1;
      }
    }
    for (const squad of this.squads) {
      squad.group.visible = true;
      squad.power = squad.maxPower;
      squad.engaged = false;
      squad.defeated = false;
      squad.fadeT = 1;
      squad.labelMat.opacity = 1;
      squad.markerMat.opacity = 0.34;
      squad.group.scale.setScalar(1);
      this._refreshSquadLabel(squad);
      this._hideUnusedSquadInstances(squad);
      this._updateSquadInstances(squad, 0);
    }
    for (const orb of this.orbs) {
      orb.group.visible = true;
      orb.collected = false;
    }
    this.hoveredGate = null;
    this.hoveredSquad = null;
  }

  _refreshSquadLabel(squad) {
    const info = squadSignTexture(squad.power, { maxPower: squad.maxPower });
    if (squad.labelMat.map) squad.labelMat.map.dispose();
    squad.labelMat.map = info.texture;
    squad.labelInfo = info;
    squad.labelMat.needsUpdate = true;
  }

  getInteractiveTargets() {
    const targets = [];
    for (const row of this.gateRows) {
      if (row.resolved) continue;
      for (const gate of row.gates) targets.push(gate.hitbox);
    }
    for (const squad of this.squads) {
      if (!squad.defeated && !squad.engaged) targets.push(squad.hitbox);
    }
    return targets;
  }

  setHover(gateOrSquad) {
    this.hoveredGate = gateOrSquad && gateOrSquad.option ? gateOrSquad : null;
    this.hoveredSquad = gateOrSquad && gateOrSquad.power !== undefined ? gateOrSquad : null;
  }

  resolveGate(heroZ) {
    for (const row of this.gateRows) {
      if (row.resolved) continue;
      if (heroZ <= row.z + 0.35 && heroZ > row.z - 3) {
        row.resolved = true;
        let chosen = row.gates[0];
        let best = Infinity;
        for (const gate of row.gates) {
          gate.resolved = true;
          gate.fadeT = 0;
          const dist = Math.abs(gate.lane - this._heroX);
          if (dist < best) {
            best = dist;
            chosen = gate;
          }
        }
        chosen.chosen = true;
        this.vfx.gateBurst(new THREE.Vector3(chosen.group.position.x, 0.1, row.z), chosen.accent);
        this.vfx.slash(
          new THREE.Vector3(chosen.group.position.x, 2.2, row.z + 1.2),
          0.2,
          chosen.isMul ? 0xffe0a0 : 0xc8fbff,
          1.4
        );
        return { row, gate: chosen };
      }
    }
    return null;
  }

  setHeroLane(x) {
    this._heroX = x;
  }

  getTriggeredSquad(heroZ) {
    let best = null;
    for (const squad of this.squads) {
      if (squad.engaged || squad.defeated) continue;
      if (heroZ <= squad.z + 2.6 && heroZ > squad.z - 6) {
        if (!best || squad.z > best.z) best = squad;
      }
    }
    if (best) best.engaged = true;
    return best;
  }

  getUpcomingSquad(heroZ) {
    let best = null;
    let bestDistance = Infinity;
    for (const squad of this.squads) {
      if (squad.defeated) continue;
      const distance = heroZ - squad.z;
      if (distance > 0 && distance < 50 && distance < bestDistance) {
        best = squad;
        bestDistance = distance;
      }
    }
    return best;
  }

  getStormSquad(heroZ) {
    let best = null;
    for (const squad of this.squads) {
      if (squad.defeated || squad.engaged) continue;
      const distance = heroZ - squad.z;
      if (distance > 0 && distance < 110) {
        if (!best || squad.z > best.z) best = squad;
      }
    }
    return best;
  }

  hitSquad(squad, amount) {
    if (squad.defeated) return squad.power;
    squad.power = Math.max(0, squad.power - amount);
    this._refreshSquadLabel(squad);
    this._hideUnusedSquadInstances(squad);
    this._updateSquadInstances(squad, 0);
    if (squad.power <= 0) {
      this.clearSquad(squad);
    }
    return squad.power;
  }

  clearSquad(squad) {
    if (squad.defeated) return;
    squad.defeated = true;
    squad.power = 0;
    squad.labelMat.opacity = 0;
    squad.markerMat.opacity = 0;
    this.vfx.squadBreak(squad.group.position.clone().add(new THREE.Vector3(0, 1, 0)));
    squad.group.visible = false;
  }

  collectOrb(orb) {
    if (orb.collected) return false;
    orb.collected = true;
    orb.group.visible = false;
    this.vfx.gateBurst(orb.group.position.clone(), 0x5df4ff);
    return true;
  }

  update(dt, elapsed, heroPos) {
    this.setHeroLane(heroPos.x);
    const dummy = this.dummy;

    const upcomingRow = this.gateRows.find((row) => !row.resolved);
    if (upcomingRow) {
      let nearest = null;
      let best = Infinity;
      for (const gate of upcomingRow.gates) {
        const dist = Math.abs(gate.lane - heroPos.x);
        if (dist < best) {
          best = dist;
          nearest = gate;
        }
      }
      for (const gate of upcomingRow.gates) {
        const pick = gate === nearest;
        gate.frameMat.emissiveIntensity = pick ? 1.5 + Math.sin(elapsed * 4.2) * 0.35 : 0.8;
        gate.signMat.color.setHex(pick ? 0xffffff : 0xb9c8cc);
        if (gate === this.hoveredGate) {
          gate.frameMat.emissiveIntensity = 2.3 + Math.sin(elapsed * 7) * 0.45;
          gate.portalMat.opacity = 0.58;
          gate.signMat.color.setHex(0xffffff);
        }
      }
    }

    for (const row of this.gateRows) {
      for (const gate of row.gates) {
        if (!gate.group.visible) continue;
        gate.portal.rotation.z = elapsed * (gate.isMul ? -0.22 : 0.18) + gate.row * 0.7;
        gate.portalBack.rotation.z = -elapsed * 0.13 + gate.row;
        gate.portal.scale.set(
          1 + Math.sin(elapsed * 1.8 + gate.row) * 0.03,
          1 + Math.cos(elapsed * 1.5 + gate.row) * 0.02,
          1
        );
        gate.ring.rotation.z = elapsed * 0.6;
        gate.ring.scale.setScalar(1 + Math.sin(elapsed * 2.2 + gate.row) * 0.06);
        gate.sign.position.y = gate.baseY + Math.sin(elapsed * 1.6 + gate.row * 1.3) * 0.08;
        if (!gate.resolved) {
          if (!row.resolved) {
            const dist = Math.abs(gate.group.position.z - heroPos.z);
            if (dist < 62) {
              gate.emitT -= dt;
              if (gate.emitT <= 0) {
                gate.emitT = 0.22 + this.rng() * 0.5;
                this.vfx.burst(
                  new THREE.Vector3(
                    gate.group.position.x + (this.rng() - 0.5) * 1.5,
                    0.5 + this.rng() * 2.8,
                    row.z + (this.rng() - 0.3) * 0.4
                  ),
                  {
                    color: gate.accent,
                    count: 1,
                    speed: 0.3,
                    up: 0.55,
                    spread: 0.18,
                    size: 0.1,
                    life: 1.1,
                    gravity: 0.15,
                    drag: 1.2,
                    light: 0.1,
                  }
                );
              }
            }
          }
        } else {
          gate.fadeT += dt;
          const fade = clamp(1 - gate.fadeT / 1.1, 0, 1);
          gate.portalMat.opacity = (gate.chosen ? 0.7 : 0.3) * fade;
          gate.portalBackMat.opacity = 0.17 * fade;
          gate.signMat.opacity = fade;
          gate.ringMat.opacity = 0.7 * fade;
          gate.frameMat.emissiveIntensity = (gate.chosen ? 2.8 : 0.5) * fade;
          if (gate.fadeT > 1.25) gate.group.visible = false;
        }
      }
    }

    for (const squad of this.squads) {
      if (squad.defeated) continue;
      this._updateSquadInstances(squad, elapsed, heroPos.z);
      squad.label.position.y = squad.baseY + Math.sin(elapsed * 1.7 + squad.z * 0.1) * 0.12;
      squad.marker.rotation.z = elapsed * 0.08;
      const near = Math.abs(heroPos.z - squad.z) < 60;
      squad.markerMat.opacity = near ? 0.3 + Math.sin(elapsed * 3) * 0.12 : 0.2;
      if (squad === this.hoveredSquad) {
        squad.labelMat.color.setHex(0xffd7d7);
        squad.markerMat.opacity = 0.55;
      } else {
        squad.labelMat.color.setHex(0xffffff);
      }
      squad.bodies.castShadow = Math.abs(heroPos.z - squad.z) < 70;
    }

    for (const orb of this.orbs) {
      if (orb.collected) continue;
      orb.group.position.y = 1.35 + Math.sin(elapsed * 2.1 + orb.phase) * 0.18;
      orb.group.rotation.y = elapsed * 1.2 + orb.phase;
      orb.group.rotation.z = Math.sin(elapsed * 1.4 + orb.phase) * 0.2;
      const pulse = 0.8 + Math.sin(elapsed * 3 + orb.phase) * 0.2;
      orb.group.scale.setScalar(pulse);
    }
  }
}
