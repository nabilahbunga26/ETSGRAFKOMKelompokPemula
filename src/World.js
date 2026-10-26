import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  canvasTexture,
  glowTexture,
  groundTexture,
  makeGlowSprite,
  makePart,
  mergeParts,
  mulberry32,
  petalTexture,
  range,
  stoneTexture,
  TAU,
  woodTexture,
} from './utils.js';

const MOON_DIR = new THREE.Vector3(0.24, 0.46, -0.855).normalize();

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uMoonColor;
  uniform vec3 uMoonDir;
  uniform float uTime;
  varying vec3 vDir;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, -0.5, 1.0);
    vec3 col = mix(uHorizon, uZenith, smoothstep(-0.08, 0.7, h));
    col += vec3(0.012, 0.03, 0.04) * (1.0 - smoothstep(0.0, 0.26, abs(dir.y)));
    float band = sin(dir.x * 7.0 + dir.z * 4.0 + uTime * 0.018) * 0.5 + 0.5;
    col += vec3(0.01, 0.024, 0.03) * band * (1.0 - smoothstep(0.0, 0.4, abs(dir.y)));

    vec2 sph = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0)));
    vec2 uv = sph * vec2(75.0, 140.0);
    vec2 cell = floor(uv);
    vec2 f = fract(uv) - 0.5;
    float starHash = hash21(cell);
    float star = smoothstep(0.075, 0.0, length(f)) * step(0.982, starHash);
    star *= smoothstep(-0.02, 0.22, dir.y);
    star *= 0.6 + 0.4 * sin(uTime * 2.2 + starHash * 40.0);
    col += vec3(0.6, 0.82, 1.0) * star * 1.4;

    float m = clamp(dot(dir, normalize(uMoonDir)), 0.0, 1.0);
    float disc = smoothstep(0.9984, 0.99925, m);
    float glow = pow(m, 260.0) * 0.7 + pow(m, 22.0) * 0.12 + pow(m, 7.0) * 0.025;
    col += uMoonColor * (disc * 1.75 + glow);
    col += vec3(0.03, 0.07, 0.09) * pow(m, 3.0) * 0.5;

    float horizonGlow = exp(-abs(dir.y + 0.03) * 16.0);
    col += vec3(0.025, 0.07, 0.08) * horizonGlow * 0.55;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const BAMBOO_SWAY = /* glsl */ `
  float swayH = pow(max(position.y, 0.0), 1.55);
  vec3 swayBase = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  transformed.x += sin(uTime * 0.7 + swayBase.x * 0.33 + swayBase.z * 0.17) * swayH * 0.085;
  transformed.z += cos(uTime * 0.53 + swayBase.z * 0.24 + swayBase.x * 0.1) * swayH * 0.055;
`;

function patchSway(material, registry) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${BAMBOO_SWAY}`
    );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => 'bamboo-sway-v1';
  registry.push(material);
}

function makeLeafCluster(rng) {
  const parts = [];
  const leafShape = new THREE.PlaneGeometry(0.24, 1.15, 1, 3);
  leafShape.translate(0, 0.55, 0);
  const greens = [0x315e42, 0x3e7048, 0x274f3a, 0x4c7b4e, 0x365d3c];
  for (let i = 0; i < 9; i++) {
    const geo = leafShape.clone();
    const angle = (i / 9) * TAU + rng() * 0.4;
    const droop = -0.5 - rng() * 0.75;
    parts.push(
      makePart(
        geo,
        greens[Math.floor(rng() * greens.length)],
        [Math.cos(angle) * 0.18, 0.05 + rng() * 0.24, Math.sin(angle) * 0.18],
        [droop, angle, (rng() - 0.5) * 0.4],
        [0.8 + rng() * 0.5, 0.8 + rng() * 0.55, 1]
      )
    );
  }
  return mergeParts(parts);
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
    this.rng = mulberry32(20261026);
    this.focus = new THREE.Vector3(0, 0, -6);
    this.time = 0;
    this.swayMaterials = [];
    this.flames = [];
    this.flameLights = [];
    this.banners = [];
    this.petals = [];
    this.arenaZ = -470;
    this.bossTriggerZ = -422;
    this.runEndZ = -445;
    this.courseLength = 440;
    this.isBossMode = false;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06131b, 0.0092);

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1500);
    this.camera.position.set(5.6, 2.4, 9.5);
    this.camera.lookAt(0, 1.3, -8);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.35 : 1.7);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.isMobile ? 0.42 : 0.52,
      0.5,
      0.8
    );
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.createEnvironmentMap();
    this.createSky();
    this.createLights();
    this.createGround();
    this.createPath();
    this.createBamboo();
    this.createMountains();
    this.createTorii();
    this.createLanterns();
    this.createArena();
    this.createShrineBackdrop();
    this.createPetals();
    this.createFireflies();
    this.createMist();
    this.createPuddles();

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
  }

  createEnvironmentMap() {
    const tex = canvasTexture(1024, 512, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#050b14');
      grad.addColorStop(0.42, '#0e2732');
      grad.addColorStop(0.52, '#143c46');
      grad.addColorStop(0.7, '#071115');
      grad.addColorStop(1, '#030608');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      const moon = ctx.createRadialGradient(w * 0.66, h * 0.24, 0, w * 0.66, h * 0.24, w * 0.17);
      moon.addColorStop(0, 'rgba(225, 245, 255, 0.95)');
      moon.addColorStop(0.12, 'rgba(165, 220, 240, 0.55)');
      moon.addColorStop(0.42, 'rgba(48, 118, 140, 0.16)');
      moon.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = moon;
      ctx.fillRect(0, 0, w, h);
      const rng = mulberry32(7);
      for (let i = 0; i < 240; i++) {
        ctx.globalAlpha = 0.12 + rng() * 0.45;
        ctx.fillStyle = '#a6d6e8';
        ctx.fillRect(rng() * w, rng() * h * 0.5, 1, 1);
      }
      ctx.globalAlpha = 1;
    });
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromEquirectangular(tex);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.52;
    pmrem.dispose();
    tex.dispose();
  }

  createSky() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color(0x02060c) },
        uHorizon: { value: new THREE.Color(0x0d2e3a) },
        uMoonColor: { value: new THREE.Color(0xdcecff) },
        uMoonDir: { value: MOON_DIR.clone() },
        uTime: { value: 0 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(720, 48, 24), material);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -100;
    this.scene.add(this.sky);
    this.skyMaterial = material;
  }

  createLights() {
    this.hemi = new THREE.HemisphereLight(0x8cc3dd, 0x0c181c, 0.58);
    this.scene.add(this.hemi);

    // moon-silver fill from the camera side so the run reads instead of falling into silhouette
    this.fillLight = new THREE.DirectionalLight(0x9cc8e4, 0.85);
    this.fillLight.position.set(14, 11, 20);
    this.scene.add(this.fillLight, this.fillLight.target);

    this.moonLight = new THREE.DirectionalLight(0xc3dcf1, 2.15);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(this.isMobile ? 1024 : 2048, this.isMobile ? 1024 : 2048);
    this.moonLight.shadow.camera.left = -20;
    this.moonLight.shadow.camera.right = 20;
    this.moonLight.shadow.camera.top = 28;
    this.moonLight.shadow.camera.bottom = -22;
    this.moonLight.shadow.camera.near = 1;
    this.moonLight.shadow.camera.far = 130;
    this.moonLight.shadow.bias = -0.0004;
    this.moonLight.shadow.normalBias = 0.035;
    this.scene.add(this.moonLight, this.moonLight.target);

    this.rimLight = new THREE.DirectionalLight(0x46c7d9, 0.55);
    this.rimLight.position.set(9, 7, 24);
    this.scene.add(this.rimLight, this.rimLight.target);

    this.arenaLightA = new THREE.PointLight(0xff8a43, 0, 26, 2);
    this.arenaLightA.position.set(-7.2, 2.3, -455);
    this.arenaLightB = new THREE.PointLight(0xff7a3e, 0, 26, 2);
    this.arenaLightB.position.set(7.2, 2.3, -455);
    this.arenaKey = new THREE.PointLight(0xffc08a, 0, 30, 2);
    this.arenaKey.position.set(0, 7.4, -452);
    this.bossRim = new THREE.PointLight(0xff2d3f, 0, 30, 2);
    this.bossRim.position.set(0, 6.4, -474);
    this.arenaCool = new THREE.PointLight(0x5fe8ff, 0, 26, 2);
    this.arenaCool.position.set(-6.4, 4.4, -458);
    this.gateLight = new THREE.PointLight(0xffa065, 230, 36, 2);
    this.gateLight.position.set(0, 3.4, -478);
    // moonlit sculpture light for the duel; only switched on once the gate seals
    this.bossKey = new THREE.DirectionalLight(0xd9e9ff, 0);
    this.bossKey.position.set(9, 14, -446);
    this.bossKey.target.position.set(0, 3.8, -461.5);
    this.bossWarm = new THREE.DirectionalLight(0xffb27a, 0);
    this.bossWarm.position.set(-11, 7, -447);
    this.bossWarm.target.position.set(0, 3.2, -461.5);
    this.scene.add(
      this.arenaLightA,
      this.arenaLightB,
      this.arenaKey,
      this.bossRim,
      this.arenaCool,
      this.gateLight,
      this.bossKey,
      this.bossKey.target,
      this.bossWarm,
      this.bossWarm.target
    );
    this.flameLights.push(this.arenaLightA, this.arenaLightB);
  }

  createGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900, 1, 1),
      new THREE.MeshStandardMaterial({
        map: groundTexture(),
        color: 0x9aaf9f,
        roughness: 0.96,
        metalness: 0.04,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // scatter rocks and mossy mounds along the pass
    const rng = this.rng;
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x28342f,
      roughness: 0.92,
      metalness: 0.04,
      flatShading: true,
    });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 90);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 90; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      dummy.position.set(side * range(rng, 5.5, 24), range(rng, -0.1, 0.25), 18 - rng() * 570);
      dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      dummy.scale.set(range(rng, 0.35, 1.4), range(rng, 0.22, 0.8), range(rng, 0.35, 1.4));
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    rocks.frustumCulled = false;
    this.scene.add(rocks);
  }

  createPath() {
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(10.4, 560),
      new THREE.MeshStandardMaterial({
        map: stoneTexture(),
        color: 0xb8c2bb,
        roughness: 0.82,
        metalness: 0.08,
      })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.012, -232);
    path.receiveShadow = true;
    this.scene.add(path);

    const curbMat = new THREE.MeshStandardMaterial({ color: 0x1a2324, roughness: 0.72, metalness: 0.12 });
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 552), curbMat);
      curb.position.set(side * 5.25, 0.07, -230);
      curb.castShadow = true;
      curb.receiveShadow = true;
      this.scene.add(curb);
    }

    const rng = mulberry32(88);
    const slabGeo = new THREE.BoxGeometry(2.25, 0.09, 1.3);
    const slabMat = new THREE.MeshStandardMaterial({
      map: stoneTexture(11),
      color: 0x9aa8a2,
      roughness: 0.78,
      metalness: 0.08,
    });
    const slabCount = 300;
    const slabs = new THREE.InstancedMesh(slabGeo, slabMat, slabCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < slabCount; i++) {
      const row = Math.floor(rng() * 340);
      const col = Math.floor(rng() * 4);
      dummy.position.set((col - 1.5) * 2.35 + range(rng, -0.1, 0.1), 0.05, 10 - row * 1.58 + range(rng, -0.25, 0.25));
      dummy.rotation.set(0, range(rng, -0.05, 0.05), 0);
      dummy.scale.set(range(rng, 0.82, 1.04), 1, range(rng, 0.82, 1.06));
      dummy.updateMatrix();
      slabs.setMatrixAt(i, dummy.matrix);
      const shade = 0.6 + rng() * 0.22;
      slabs.setColorAt(i, new THREE.Color(shade, shade * 1.02, shade * 0.97));
    }
    slabs.receiveShadow = true;
    slabs.castShadow = false;
    slabs.frustumCulled = false;
    slabs.instanceColor.needsUpdate = true;
    this.scene.add(slabs);
  }

  createBamboo() {
    const rng = mulberry32(3301);
    const caneGeo = new THREE.CylinderGeometry(0.08, 0.13, 1, 6, 1);
    caneGeo.translate(0, 0.5, 0);
    const caneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.58,
      metalness: 0.06,
      emissive: 0x071b16,
      emissiveIntensity: 0.45,
    });
    patchSway(caneMat, this.swayMaterials);

    const leafGeo = makeLeafCluster(rng);
    const leafMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.02,
      side: THREE.DoubleSide,
      emissive: 0x04110c,
      emissiveIntensity: 0.5,
    });
    patchSway(leafMat, this.swayMaterials);

    const count = this.isMobile ? 210 : 330;
    const canes = new THREE.InstancedMesh(caneGeo, caneMat, count);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      let x = side * range(rng, 6.7, 27);
      let z = 26 - rng() * 590;
      if (z < -410) x = side * range(rng, 16, 40);
      const height = range(rng, 7, 13.5);
      const tiltX = (rng() - 0.5) * 0.09;
      const tiltZ = (rng() - 0.5) * 0.09;
      const width = range(rng, 0.8, 1.5);
      dummy.position.set(x, 0, z);
      dummy.rotation.set(tiltX, rng() * TAU, tiltZ);
      dummy.scale.set(width, height, width);
      dummy.updateMatrix();
      canes.setMatrixAt(i, dummy.matrix);
      const green = rng();
      color.setRGB(0.24 + green * 0.1, 0.38 + green * 0.13, 0.26 + green * 0.09);
      canes.setColorAt(i, color);

      dummy.position.set(
        x + Math.sin(tiltZ) * height * 0.5,
        height - 0.4,
        z - Math.sin(tiltX) * height * 0.5
      );
      dummy.rotation.set(0, rng() * TAU, 0);
      dummy.scale.set(range(rng, 1.1, 1.8), range(rng, 1.2, 2), range(rng, 1.1, 1.8));
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
      color.setRGB(0.65 + rng() * 0.3, 0.8 + rng() * 0.2, 0.7 + rng() * 0.2);
      leaves.setColorAt(i, color);
    }
    canes.instanceColor.needsUpdate = true;
    leaves.instanceColor.needsUpdate = true;
    canes.castShadow = false;
    canes.receiveShadow = true;
    leaves.castShadow = false;
    leaves.receiveShadow = true;
    canes.frustumCulled = false;
    leaves.frustumCulled = false;
    this.scene.add(canes, leaves);
  }

  createMountains() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0b1820,
      roughness: 1,
      metalness: 0,
      flatShading: true,
      fog: true,
    });
    const group = new THREE.Group();
    const rng = mulberry32(555);
    const positions = [
      [-260, -540, 150, 180],
      [-120, -610, 190, 145],
      [30, -680, 230, 170],
      [210, -600, 160, 205],
      [360, -500, 220, 160],
      [-380, -390, 180, 140],
      [330, -250, 200, 155],
      [-310, -160, 160, 130],
      [280, -80, 150, 115],
    ];
    for (const [x, z, radius, height] of positions) {
      const geo = new THREE.ConeGeometry(radius, height, 6, 1);
      const mountain = new THREE.Mesh(geo, mat);
      mountain.position.set(x, height * 0.34, z);
      mountain.rotation.y = rng() * TAU;
      mountain.scale.z = 0.7 + rng() * 0.4;
      group.add(mountain);
      const shoulder = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.7, height * 0.7, 5, 1), mat);
      shoulder.position.set(x + radius * 0.6, height * 0.2, z + 30);
      shoulder.rotation.y = rng() * TAU;
      group.add(shoulder);
    }
    group.traverse((o) => {
      if (o.isMesh) {
        o.receiveShadow = false;
        o.castShadow = false;
      }
    });
    this.scene.add(group);
  }

  createTorii() {
    const toriiMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.48,
      metalness: 0.2,
      envMapIntensity: 0.7,
    });
    const plaqueMat = new THREE.MeshBasicMaterial({
      map: canvasTexture(256, 320, (ctx, w, h) => {
        ctx.fillStyle = '#0a1214';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(244, 196, 124, 0.8)';
        ctx.lineWidth = 4;
        ctx.strokeRect(14, 14, w - 28, h - 28);
        ctx.fillStyle = '#f4c47c';
        ctx.font = '800 120px "Shippori Mincho", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('月', w / 2, h * 0.36);
        ctx.fillText('鬼', w / 2, h * 0.66);
        ctx.strokeStyle = 'rgba(255, 60, 87, 0.55)';
        ctx.strokeRect(w / 2 - 9, h - 32, 18, 10);
      }),
      transparent: true,
      toneMapped: false,
    });

    const buildTorii = (width, height, scale = 1, plaque = true) => {
      const parts = [];
      const postH = height;
      for (const side of [-1, 1]) {
        parts.push(makePart(new THREE.BoxGeometry(0.84, 0.42, 1.15), 0x080c0e, [side * width * 0.47, 0.18, 0]));
        parts.push(
          makePart(
            new THREE.CylinderGeometry(0.24 * scale, 0.34 * scale, postH, 9),
            0x4d1519,
            [side * width * 0.46, postH / 2, 0],
            [0, 0, side * -0.015]
          )
        );
        parts.push(makePart(new THREE.CylinderGeometry(0.32, 0.36, 0.36, 9), 0x0b0f11, [side * width * 0.46, 0.42, 0]));
      }
      parts.push(makePart(new THREE.BoxGeometry(width + 2.2, 0.34, 0.72), 0x090c0e, [0, height - 0.16, 0]));
      parts.push(makePart(new THREE.BoxGeometry(width + 1.4, 0.26, 0.54), 0x57171c, [0, height - 0.7, 0]));
      for (const side of [-1, 1]) {
        parts.push(
          makePart(
            new THREE.BoxGeometry(1.5 * scale, 0.34, 0.72),
            0x090c0e,
            [side * (width / 2 + 0.85), height + 0.1, 0],
            [0, 0, side * 0.13]
          )
        );
        parts.push(
          makePart(
            new THREE.BoxGeometry(0.42 * scale, 0.4, 0.64),
            0xa77c45,
            [side * (width / 2 + 1.58), height + 0.27, 0],
            [0, 0, side * 0.13]
          )
        );
      }
      parts.push(makePart(new THREE.BoxGeometry(width * 0.36, 0.22, 0.4), 0x57171c, [0, height - 1.22, 0]));
      const mesh = new THREE.Mesh(mergeParts(parts), toriiMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const group = new THREE.Group();
      group.add(mesh);
      if (plaque) {
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.35), plaqueMat);
        plate.position.set(0, height - 2.15, 0.37);
        group.add(plate);
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(1.08, 1.48, 0.12),
          new THREE.MeshStandardMaterial({ color: 0x15100b, metalness: 0.6, roughness: 0.35, emissive: 0x37240c, emissiveIntensity: 0.5 })
        );
        frame.position.set(0, height - 2.15, 0.26);
        frame.castShadow = true;
        group.add(frame);
        plate.position.z = 0.34;
      }
      // paper streamers
      const paperMat = new THREE.MeshStandardMaterial({ color: 0xc8c3b1, roughness: 0.9, side: THREE.DoubleSide });
      for (const side of [-1, 1]) {
        const shide = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.9, 1, 3), paperMat);
        shide.position.set(side * 0.9, height - 1.82, 0.05);
        shide.rotation.y = side * 0.2;
        group.add(shide);
      }
      return group;
    };

    this.toriiMaterial = toriiMaterial;
    this.torii = new THREE.Group();
    const defs = [
      { z: 24, width: 8.4, height: 5.5, scale: 0.8, plaque: false },
      { z: -14, width: 9.1, height: 6.2, scale: 0.9 },
      { z: -88, width: 9.1, height: 6.2, scale: 0.9 },
      { z: -158, width: 9.1, height: 6.2, scale: 0.9 },
      { z: -228, width: 9.1, height: 6.2, scale: 0.9 },
      { z: -298, width: 9.1, height: 6.2, scale: 0.9 },
      { z: -368, width: 9.1, height: 6.2, scale: 0.9 },
      { z: -412, width: 10.5, height: 7, scale: 1 },
    ];
    for (const def of defs) {
      const torii = buildTorii(def.width, def.height, def.scale, def.plaque ?? true);
      torii.position.z = def.z;
      this.torii.add(torii);
    }
    this.scene.add(this.torii);

    // The final sealed torii before the shrine arena
    this.greatTorii = buildTorii(18, 11.5, 1.5, true);
    this.greatTorii.position.set(0, 0.35, -482);
    const runeMat = new THREE.MeshBasicMaterial({
      color: 0xff5964,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const runeBar = new THREE.Mesh(new THREE.BoxGeometry(17, 0.07, 0.07), runeMat);
    runeBar.position.set(0, 10.2, 0.5);
    this.greatTorii.add(runeBar);
    // hanging shrine lanterns on the gate posts
    const gateLanternMat = new THREE.MeshStandardMaterial({
      color: 0xd8b382,
      emissive: 0xffa45c,
      emissiveIntensity: 1.2,
      roughness: 0.7,
    });
    for (const side of [-1, 1]) {
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.85, 8), gateLanternMat);
      lantern.position.set(side * 7.3, 5.4, 0.7);
      this.greatTorii.add(lantern);
      const halo = makeGlowSprite(glowTexture('rgba(255,180,105,0.75)'), 0xffb56e, 2.6, 2.6);
      halo.position.copy(lantern.position);
      this.greatTorii.add(halo);
    }
    this.scene.add(this.greatTorii);
  }

  createLanterns() {
    const rng = mulberry32(991);
    const positions = [];
    for (let z = 8; z > -430; z -= 25) {
      const side = positions.length % 2 === 0 ? 1 : -1;
      positions.push({ x: side * 6.1, z: z + range(rng, -3, 3), rot: side });
    }
    for (const side of [-1, 1]) {
      positions.push({ x: side * 8.8, z: -440, rot: side });
      positions.push({ x: side * 10.8, z: -458, rot: side });
    }
    const count = positions.length;
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x4e5a55,
      roughness: 0.86,
      metalness: 0.08,
      flatShading: true,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2628, roughness: 0.7, metalness: 0.15 });
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xcaa77a,
      emissive: 0xffa45c,
      emissiveIntensity: 1.25,
      roughness: 0.6,
      metalness: 0,
    });
    const bases = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.56, 0.32, 6), stoneMat, count);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.19, 1.4, 6), stoneMat, count);
    const houses = new THREE.InstancedMesh(new THREE.BoxGeometry(0.72, 0.66, 0.72), paperMat, count);
    const roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.74, 0.46, 6), darkMat, count);
    const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 5), stoneMat, count);
    const dummy = new THREE.Object3D();
    const glowPositions = new Float32Array(count * 3);
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 0.16, p.z);
      dummy.rotation.y = rng() * TAU;
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bases.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 0.98, p.z);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 1.95, p.z);
      dummy.updateMatrix();
      houses.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 2.4, p.z);
      dummy.updateMatrix();
      roofs.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 2.7, p.z);
      dummy.updateMatrix();
      caps.setMatrixAt(i, dummy.matrix);
      glowPositions[i * 3] = p.x;
      glowPositions[i * 3 + 1] = 2.0;
      glowPositions[i * 3 + 2] = p.z;
    });
    for (const mesh of [bases, posts, houses, roofs, caps]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    }
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
    this.lanternPoints = new THREE.Points(
      glowGeo,
      new THREE.PointsMaterial({
        map: glowTexture('rgba(255,190,120,0.85)'),
        color: 0xffa55e,
        size: 2.2,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    this.lanternPoints.frustumCulled = false;
    this.scene.add(this.lanternPoints);
  }

  createArena() {
    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneTexture(31),
      color: 0x809087,
      roughness: 0.8,
      metalness: 0.08,
    });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(30, 0.7, 92), stoneMat);
    platform.position.set(0, -0.32, -472);
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.scene.add(platform);

    const stepMat = new THREE.MeshStandardMaterial({ color: 0x2b3532, roughness: 0.78, metalness: 0.1 });
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(22 - i * 1.6, 0.32, 1.1), stepMat);
      step.position.set(0, -0.02 + i * 0.015, -424 - i * 1.0);
      step.castShadow = true;
      step.receiveShadow = true;
      this.scene.add(step);
    }

    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(5.6, 6.2, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x1d2728, roughness: 0.55, metalness: 0.25 })
    );
    dais.position.set(0, 0.3, -470);
    dais.rotation.y = Math.PI / 8;
    dais.castShadow = true;
    dais.receiveShadow = true;
    this.scene.add(dais);

    const ringTexture = canvasTexture(1024, 1024, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w / 2, h / 2);
      ctx.strokeStyle = 'rgba(255, 78, 92, 0.65)';
      ctx.lineWidth = 2;
      for (const r of [180, 250, 320, 395, 470]) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(244, 196, 124, 0.55)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 410, Math.sin(a) * 410);
        ctx.lineTo(Math.cos(a) * 470, Math.sin(a) * 470);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255, 77, 90, 0.6)';
      ctx.font = '800 130px "Shippori Mincho", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i / 4) * TAU);
        ctx.fillText(i % 2 === 0 ? '鬼' : '封', 0, -300);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255, 190, 120, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 150, 0, TAU);
      ctx.fill();
    });
    this.arenaRune = new THREE.Mesh(
      new THREE.CircleGeometry(9, 64),
      new THREE.MeshBasicMaterial({
        map: ringTexture,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    this.arenaRune.rotation.x = -Math.PI / 2;
    this.arenaRune.position.set(0, 0.06, -468);
    this.scene.add(this.arenaRune);

    // braziers
    const brazierMat = new THREE.MeshStandardMaterial({ color: 0x181c1c, roughness: 0.5, metalness: 0.55 });
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff8a3a, toneMapped: false });
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff7a24,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    for (const side of [-1, 1]) {
      const group = new THREE.Group();
      group.position.set(side * 7.4, 0.02, -453);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.8, 6), brazierMat);
      stem.position.y = 0.9;
      stem.castShadow = true;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.46, 0.55, 8), brazierMat);
      bowl.position.y = 1.95;
      bowl.castShadow = true;
      const embers = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), emberMat);
      embers.rotation.x = -Math.PI / 2;
      embers.position.y = 2.2;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.15, 7), flameMat);
      flame.position.y = 2.8;
      const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.8, 6), flameMat.clone());
      flame2.material.color.setHex(0xffb35c);
      flame2.material.opacity = 0.32;
      flame2.position.y = 3.05;
      group.add(stem, bowl, embers, flame, flame2);
      group.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = false;
        }
      });
      this.scene.add(group);
      this.flames.push({ group: flame, inner: flame2, phase: side * 1.7 });
    }

    // barrier posts and rope silhouette framing the arena mouth
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2d1b15, roughness: 0.7, metalness: 0.2 });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.6, 6), postMat);
        post.position.set(side * (11 + i * 2.7), 1.3, -430 - i * 2.2);        post.castShadow = true;
        this.scene.add(post);
      }
    }
  }

  createShrineBackdrop() {
    const wood = new THREE.MeshStandardMaterial({
      map: woodTexture(44, '#221413'),
      color: 0x8b7c6a,
      roughness: 0.72,
      metalness: 0.1,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0e1213, roughness: 0.4, metalness: 0.45 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x0b1418, roughness: 0.36, metalness: 0.55, flatShading: true });
    const gold = new THREE.MeshStandardMaterial({
      color: 0x9d763f,
      roughness: 0.3,
      metalness: 0.9,
      emissive: 0x241705,
      emissiveIntensity: 0.6,
    });
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xd6b98d,
      emissive: 0xffb26b,
      emissiveIntensity: 0.95,
      roughness: 0.7,
    });

    const shrine = new THREE.Group();
    shrine.position.set(0, 0.02, -513);
    const base = new THREE.Mesh(new THREE.BoxGeometry(27, 1.3, 17), new THREE.MeshStandardMaterial({ color: 0x242c2a, roughness: 0.8 }));
    base.position.y = 0.65;
    base.castShadow = true;
    base.receiveShadow = true;
    shrine.add(base);

    const body = new THREE.Mesh(new THREE.BoxGeometry(18, 5.2, 9.5), wood);
    body.position.set(0, 3.8, -2.4);
    body.castShadow = true;
    body.receiveShadow = true;
    shrine.add(body);

    for (let i = 0; i < 6; i++) {
      const x = -8.3 + i * 3.32;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, 5.8, 8), wood);
      column.position.set(x, 3.9, 2.8);
      column.castShadow = true;
      shrine.add(column);
    }
    const veranda = new THREE.Mesh(new THREE.BoxGeometry(21, 0.35, 4.4), wood);
    veranda.position.set(0, 1.5, 3.2);
    veranda.receiveShadow = true;
    veranda.castShadow = true;
    shrine.add(veranda);

    for (let i = 0; i < 3; i++) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.3), paperMat);
      panel.position.set((i - 1) * 3.1, 3.55, 2.41);
      shrine.add(panel);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.1), dark);
      bar.position.set((i - 1) * 3.1, 3.55, 2.45);
      shrine.add(bar);
      const barH = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.11, 0.1), dark);
      barH.position.set((i - 1) * 3.1, 3.0, 2.45);
      shrine.add(barH);
    }

    // curved shrine roof
    const roofGeo = new THREE.BufferGeometry();
    const roofPositions = [];
    const roofIndices = [];
    const width = 24;
    const depth = 7.2;
    const segmentsX = 12;
    const segmentsZ = 8;
    for (let iz = 0; iz <= segmentsZ; iz++) {
      const tz = iz / segmentsZ;
      const z = (tz * 2 - 1) * depth;
      for (let ix = 0; ix <= segmentsX; ix++) {
        const tx = ix / segmentsX;
        const x = (tx * 2 - 1) * width;
        const y = 7.8 + 2.4 * Math.pow(1 - Math.abs(tz), 1.6) - 0.45 * Math.pow(Math.abs(tx), 3);
        roofPositions.push(x, y, z);
      }
    }
    for (let iz = 0; iz < segmentsZ; iz++) {
      for (let ix = 0; ix < segmentsX; ix++) {
        const a = iz * (segmentsX + 1) + ix;
        const b = a + 1;
        const c = a + segmentsX + 1;
        const d = c + 1;
        roofIndices.push(a, c, b, b, c, d);
      }
    }
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPositions, 3));
    roofGeo.setIndex(roofIndices);
    roofGeo.computeVertexNormals();
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 0, -2.4);
    roof.castShadow = true;
    roof.receiveShadow = true;
    shrine.add(roof);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.45, 0.7), gold);
    ridge.position.set(0, 10.35, -2.4);
    ridge.castShadow = true;
    shrine.add(ridge);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.5), gold);
      horn.position.set(side * 12.3, 8.4, 4.3);
      horn.rotation.z = side * 0.42;
      shrine.add(horn);
    }

    // hanging shrine lanterns
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.9, 8), paperMat);
        lantern.position.set(side * (4 + i * 4.2), 4.7 - i * 0.3, 4.3);
        shrine.add(lantern);
        const halo = makeGlowSprite(glowTexture('rgba(255,180,105,0.7)'), 0xffb56e, 2.2, 2.2);
        halo.position.copy(lantern.position);
        shrine.add(halo);
      }
    }

    // large banners on poles
    const bannerTextureCrimson = canvasTexture(512, 1024, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#5e0d1c');
      grad.addColorStop(1, '#2a0710');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(244, 196, 124, 0.4)';
      ctx.lineWidth = 5;
      ctx.strokeRect(22, 22, w - 44, h - 44);
      ctx.fillStyle = 'rgba(255, 225, 190, 0.85)';
      ctx.font = '800 260px "Shippori Mincho", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('鬼', w / 2, h * 0.36);
      ctx.font = '800 150px "Shippori Mincho", serif';
      ctx.fillText('斬', w / 2, h * 0.64);
      ctx.fillStyle = 'rgba(244, 196, 124, 0.6)';
      ctx.fillRect(w / 2 - 80, h * 0.78, 160, 4);
    });
    const bannerTexturePale = canvasTexture(512, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#c8bfa9';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(35, 20, 15, 0.82)';
      ctx.font = '800 240px "Shippori Mincho", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('月', w / 2, h * 0.35);
      ctx.fillText('下', w / 2, h * 0.6);
      ctx.strokeStyle = 'rgba(95, 20, 25, 0.5)';
      ctx.lineWidth = 8;
      ctx.strokeRect(20, 20, w - 40, h - 40);
    });
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 9, 6), dark);
      pole.position.set(side * 11.8, 4.5, 9);
      pole.castShadow = true;
      shrine.add(pole);
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 6.2, 4, 8),
        new THREE.MeshStandardMaterial({
          map: side < 0 ? bannerTextureCrimson : bannerTexturePale,
          side: THREE.DoubleSide,
          roughness: 0.85,
          metalness: 0,
          emissive: 0x1a0808,
          emissiveIntensity: 0.35,
        })
      );
      banner.position.set(side * 11.8, 5.7, 9.2);
      banner.castShadow = true;
      shrine.add(banner);
      this.banners.push({ mesh: banner, phase: side + 2 });
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.16, 0.16), dark);
      topBar.position.set(side * 11.8, 8.9, 9);
      shrine.add(topBar);
    }

    // shimenawa rope across the shrine front
    const ropeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-8.8, 7.2, 2.9),
      new THREE.Vector3(0, 6.6, 3.15),
      new THREE.Vector3(8.8, 7.2, 2.9),
    ]);
    const rope = new THREE.Mesh(
      new THREE.TubeGeometry(ropeCurve, 24, 0.12, 6, false),
      new THREE.MeshStandardMaterial({ color: 0x8a7450, roughness: 0.9 })
    );
    shrine.add(rope);
    for (let i = 0; i < 4; i++) {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.32, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xe4ddca, roughness: 0.9, side: THREE.DoubleSide })
      );
      strip.position.set(-4.8 + i * 3.2, 6.2, 3.02);
      shrine.add(strip);
    }

    shrine.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true;
    });
    this.scene.add(shrine);
    this.shrine = shrine;
    this.shrineLight = new THREE.PointLight(0xffb066, 620, 58, 2);
    this.shrineLight.position.set(0, 4.5, -505);
    this.scene.add(this.shrineLight);
  }

  createPetals() {
    const texture = petalTexture();
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0,
      color: 0xffffff,
      emissive: 0x1b0910,
      emissiveIntensity: 0.3,
    });
    const geometry = new THREE.PlaneGeometry(0.18, 0.3);
    const count = this.isMobile ? 100 : 190;
    this.petalMesh = new THREE.InstancedMesh(geometry, material, count);
    this.petalMesh.frustumCulled = false;
    const rng = mulberry32(6512);
    const cols = [0xffc6d4, 0xffb3c8, 0xf2e0dd, 0xffd9dd];
    for (let i = 0; i < count; i++) {
      const petal = {
        x: this.focus.x + range(rng, -24, 24),
        y: range(rng, 0.3, 13),
        z: this.focus.z + range(rng, -38, 20),
        rotX: rng() * TAU,
        rotY: rng() * TAU,
        rotZ: rng() * TAU,
        spinX: range(rng, -2.5, 2.5),
        spinY: range(rng, -1.8, 1.8),
        phase: rng() * TAU,
        speed: range(rng, 0.35, 1.1),
        scale: range(rng, 0.7, 1.4),
      };
      this.petals.push(petal);
      this.petalMesh.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    }
    this.petalMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.petalMesh);
    this.petalDummy = new THREE.Object3D();
  }

  createFireflies() {
    const count = this.isMobile ? 50 : 100;
    const rng = mulberry32(450);
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const side = rng() > 0.5 ? 1 : -1;
      positions[i * 3] = side * range(rng, 5.2, 20);
      positions[i * 3 + 1] = range(rng, 0.4, 4.4);
      positions[i * 3 + 2] = 16 - rng() * 545;
      phases[i] = rng() * TAU;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    this.fireflyMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: this.pixelRatio } },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.26 + aPhase * 5.3) * 0.9;
          p.y += sin(uTime * 0.41 + aPhase * 8.1) * 0.35;
          p.z += cos(uTime * 0.19 + aPhase * 3.7) * 0.9;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (2.0 + sin(uTime * 1.3 + aPhase * 4.0) * 0.9) * uPixelRatio * (90.0 / max(1.0, -mv.z));
          vAlpha = 0.3 + 0.5 * (0.5 + 0.5 * sin(uTime * 1.1 + aPhase * 3.0));
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vec3(0.65, 1.0, 0.72), a * a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.fireflies = new THREE.Points(geo, this.fireflyMaterial);
    this.fireflies.frustumCulled = false;
    this.scene.add(this.fireflies);
  }

  createMist() {
    const texture = glowTexture('rgba(196, 228, 236, 0.9)');
    const rng = mulberry32(881);
    this.mistSprites = [];
    const count = this.isMobile ? 14 : 24;
    for (let i = 0; i < count; i++) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: 0x9fc4cd,
        transparent: true,
        opacity: 0.05 + rng() * 0.05,
        depthWrite: false,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(material);
      const z = 12 - (i / count) * 545 + range(rng, -8, 8);
      const x = range(rng, -14, 14);
      sprite.position.set(x, range(rng, 0.25, 1.3), z);
      sprite.scale.set(range(rng, 10, 22), range(rng, 2.2, 4.6), 1);
      sprite.renderOrder = 1;
      this.scene.add(sprite);
      this.mistSprites.push({
        sprite,
        baseX: x,
        baseOpacity: material.opacity,
        phase: rng() * TAU,
        drift: range(rng, 0.05, 0.16),
        bob: range(rng, 0.15, 0.35),
      });
    }
  }

  createPuddles() {
    const rng = mulberry32(3131);
    const material = new THREE.MeshStandardMaterial({
      color: 0x0a161c,
      roughness: 0.09,
      metalness: 0.86,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const geometry = new THREE.CircleGeometry(1, 18);
    const group = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const puddle = new THREE.Mesh(geometry, material);
      puddle.rotation.x = -Math.PI / 2;
      puddle.rotation.z = rng() * TAU;
      puddle.position.set(
        range(rng, -4.4, 4.4),
        0.022,
        4 - rng() * 424
      );
      puddle.scale.set(range(rng, 0.7, 1.9), range(rng, 0.5, 1.4), 1);
      group.add(puddle);
    }
    for (let i = 0; i < 6; i++) {
      const puddle = new THREE.Mesh(geometry, material);
      puddle.rotation.x = -Math.PI / 2;
      puddle.rotation.z = rng() * TAU;
      puddle.position.set(range(rng, -9, 9), 0.034, -432 - rng() * 44);
      puddle.scale.set(range(rng, 1.1, 2.6), range(rng, 0.8, 1.7), 1);
      group.add(puddle);
    }
    group.renderOrder = 1;
    this.scene.add(group);
    this.puddles = group;
  }

  setBossMode(enabled) {
    this.isBossMode = enabled;
    this.arenaLightA.intensity = enabled ? 55 : 0;
    this.arenaLightB.intensity = enabled ? 55 : 0;
    this.arenaKey.intensity = enabled ? 45 : 0;
    this.bossRim.intensity = enabled ? 115 : 0;
    this.arenaCool.intensity = enabled ? 45 : 0;
    this.bossKey.intensity = enabled ? 3.0 : 0;
    this.bossWarm.intensity = enabled ? 1.0 : 0;
    const shadowCam = this.moonLight.shadow.camera;
    if (enabled) {
      shadowCam.left = -34;
      shadowCam.right = 34;
      shadowCam.top = 40;
      shadowCam.bottom = -30;
      shadowCam.far = 170;
    } else {
      shadowCam.left = -20;
      shadowCam.right = 20;
      shadowCam.top = 28;
      shadowCam.bottom = -22;
      shadowCam.far = 130;
    }
    shadowCam.updateProjectionMatrix();
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(width, height);
    if (this.fireflyMaterial) this.fireflyMaterial.uniforms.uPixelRatio.value = this.pixelRatio;
  }

  update(dt, elapsed, focus) {
    this.time = elapsed;
    if (focus) this.focus.copy(focus);
    this.sky.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.skyMaterial.uniforms.uTime.value = elapsed;

    const moonOffset = MOON_DIR.clone().multiplyScalar(62);
    this.moonLight.position.copy(this.focus).add(moonOffset);
    this.moonLight.target.position.set(this.focus.x, 0, this.focus.z - 6);
    this.rimLight.position.set(this.focus.x + 8, 8, this.focus.z + 26);
    this.rimLight.target.position.set(this.focus.x, 1, this.focus.z);
    this.rimLight.target.updateMatrixWorld();

    for (const material of this.swayMaterials) {
      if (material.userData.shader) material.userData.shader.uniforms.uTime.value = elapsed;
    }
    if (this.fireflyMaterial) this.fireflyMaterial.uniforms.uTime.value = elapsed;
    if (this.lanternPoints) this.lanternPoints.material.opacity = 0.5 + Math.sin(elapsed * 1.68) * 0.07;

    if (this.arenaRune) {
      this.arenaRune.rotation.z = elapsed * 0.035;
      this.arenaRune.material.opacity = (this.isBossMode ? 0.58 : 0.32) + Math.sin(elapsed * 0.8) * 0.05;
    }
    for (const flame of this.flames) {
      const flicker = 0.82 + Math.sin(elapsed * 13 + flame.phase) * 0.1 + Math.sin(elapsed * 23 + flame.phase * 2) * 0.06;
      flame.group.scale.set(flicker, 0.9 + flicker * 0.25, flicker);
      flame.inner.scale.set(0.8 + flicker * 0.2, 1.05 - flicker * 0.1, 0.8 + flicker * 0.2);
      flame.group.material.opacity = 0.42 + flicker * 0.12;
    }
    this.flameLights.forEach((light, i) => {
      if (light.intensity > 0) light.intensity = (48 + Math.sin(elapsed * 12 + i * 2.4) * 10) * (this.isBossMode ? 1 : 0);
    });
    this.arenaKey.intensity = this.isBossMode
      ? 44 + Math.sin(elapsed * 2.1) * 5
      : 0;
    this.bossRim.intensity = this.isBossMode
      ? 100 + Math.sin(elapsed * 1.4 + 1.7) * 16
      : 0;
    this.arenaCool.intensity = this.isBossMode
      ? 42 + Math.sin(elapsed * 1.9 + 0.6) * 8
      : 0;
    this.shrineLight.intensity = 600 + Math.sin(elapsed * 1.4) * 70;
    this.gateLight.intensity = 218 + Math.sin(elapsed * 3.1) * 26 + Math.sin(elapsed * 7.7) * 12;
    for (const banner of this.banners) {
      banner.mesh.rotation.y = Math.sin(elapsed * 0.7 + banner.phase) * 0.055;
      banner.mesh.rotation.z = Math.sin(elapsed * 0.53 + banner.phase) * 0.02;
    }
    if (this.mistSprites) {
      for (const mist of this.mistSprites) {
        mist.sprite.position.x =
          mist.baseX + Math.sin(elapsed * mist.drift + mist.phase) * 2.8;
        mist.sprite.material.opacity =
          mist.baseOpacity * (0.66 + 0.34 * Math.sin(elapsed * 0.24 + mist.phase));
      }
    }

    if (this.petalMesh) {
      const dummy = this.petalDummy;
      for (let i = 0; i < this.petals.length; i++) {
        const p = this.petals[i];
        p.y -= p.speed * dt;
        p.x += Math.sin(elapsed * 0.6 + p.phase) * 0.32 * dt;
        p.z += Math.cos(elapsed * 0.45 + p.phase) * 0.22 * dt;
        p.rotX += p.spinX * dt;
        p.rotY += p.spinY * dt;
        if (
          p.y < 0.08 ||
          Math.abs(p.x - this.focus.x) > 34 ||
          p.z > this.focus.z + 26 ||
          p.z < this.focus.z - 48
        ) {
          const wrapX = this.focus.x + range(this.rng, -24, 24);
          p.x = wrapX;
          p.y = range(this.rng, 6, 14);
          p.z = this.focus.z + range(this.rng, -42, 18);
          p.phase = this.rng() * TAU;
        }
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        this.petalMesh.setMatrixAt(i, dummy.matrix);
      }
      this.petalMesh.instanceMatrix.needsUpdate = true;
    }

    if (this.greatTorii) {
      const pulse = 0.55 + Math.sin(elapsed * 1.7) * 0.12;
      this.greatTorii.traverse((o) => {
        if (o.material && o.material.color && o.material.color.getHex() === 0xff5964) o.material.opacity = pulse;
      });
    }
  }

  render() {
    this.composer.render();
  }
}
