import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) => THREE.MathUtils.damp(current, target, lambda, dt);
export const smoothstep = (min, max, value) => {
  const x = clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rng, min, max) => min + rng() * (max - min);
export const pick = (rng, items) => items[Math.floor(rng() * items.length) % items.length];

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function canvasTexture(width, height, draw, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = options.colorSpace ?? THREE.SRGBColorSpace;
  texture.anisotropy = options.anisotropy ?? 8;
  if (options.repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(options.repeat[0], options.repeat[1]);
  }
  texture.needsUpdate = true;
  return texture;
}

function speckle(ctx, width, height, rng, count, palette, minR = 0.5, maxR = 2.4) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
    const x = rng() * width;
    const y = rng() * height;
    const r = minR + rng() * (maxR - minR);
    ctx.globalAlpha = 0.12 + rng() * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function stoneTexture(seed = 4) {
  const rng = mulberry32(seed);
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#313c40');
      grad.addColorStop(0.45, '#242e32');
      grad.addColorStop(1, '#1c2529');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // broad damp patches
      for (let i = 0; i < 22; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const r = 30 + rng() * 120;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rng() > 0.45 ? 'rgba(61, 84, 78, 0.18)' : 'rgba(9, 17, 22, 0.32)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // hairline cracks
      ctx.strokeStyle = 'rgba(6, 12, 15, 0.45)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 10; i++) {
        let x = rng() * w;
        let y = rng() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 5; j++) {
          x += (rng() - 0.5) * 46;
          y += 16 + rng() * 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      speckle(ctx, w, h, rng, 1400, ['#4d5c5f', '#131b1f', '#657366', '#0b1215'], 0.4, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(0, 0, w, 70);
    },
    { repeat: [2, 52] }
  );
}

export function groundTexture(seed = 12) {
  const rng = mulberry32(seed);
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#0b1517';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const r = 12 + rng() * 90;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const c = rng();
        g.addColorStop(0, c > 0.55 ? 'rgba(30, 55, 48, 0.28)' : 'rgba(8, 17, 23, 0.4)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      speckle(ctx, w, h, rng, 2400, ['#162723', '#0c181c', '#294036', '#071013'], 0.5, 2.1);
    },
    { repeat: [18, 18] }
  );
}

export function woodTexture(seed = 21, base = '#1b1414') {
  const rng = mulberry32(seed);
  return canvasTexture(
    256,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        const shade = 10 + Math.floor(rng() * 16);
        ctx.fillStyle = `rgba(${shade + 18}, ${shade + 8}, ${shade + 5}, 0.5)`;
        ctx.fillRect(x + 1, 0, 30, h);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255, 196, 130, 0.06)';
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        const x = rng() * w;
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 16, h * 0.3, x - 12, h * 0.7, x + 8, h);
        ctx.stroke();
      }
      speckle(ctx, w, h, rng, 280, ['#0b0707', '#402a1c', '#2a1c13'], 0.5, 1.6);
    },
    { repeat: [1, 3] }
  );
}

export function paperTexture(seed = 33) {
  const rng = mulberry32(seed);
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#d9cbb0';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, rng, 900, ['#c2b394', '#efe4ce', '#9d8e74'], 0.3, 1.5);
      ctx.strokeStyle = 'rgba(118, 96, 66, 0.16)';
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        const x = rng() * w;
        const y = rng() * h;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 20 + rng() * 30, y + (rng() - 0.5) * 5);
        ctx.stroke();
      }
    },
    { repeat: [1, 1] }
  );
}

export function glowTexture(color = '#ffffff') {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.25, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function slashTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const radius = 86;
    const start = -0.6 * Math.PI;
    const end = 0.46 * Math.PI;
    const steps = 40;
    const passes = [
      { width: 32, alpha: 0.14, blur: 30 },
      { width: 13, alpha: 0.55, blur: 16 },
      { width: 4, alpha: 1, blur: 6 },
    ];
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(120, 232, 255, 0.9)';
    for (const pass of passes) {
      ctx.strokeStyle = `rgba(198, 250, 255, ${pass.alpha})`;
      ctx.shadowBlur = pass.blur;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        const taper = Math.sin(Math.PI * ((t0 + t1) / 2)) ** 0.55;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, start + (end - start) * t0, start + (end - start) * t1 + 0.015);
        ctx.lineWidth = Math.max(1, pass.width * taper);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(end) * radius, cy + Math.sin(end) * radius, 3.4, 0, TAU);
    ctx.fill();
  });
}

export function portalTexture(accent = '#5df4ff') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 128);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.32, 'rgba(175,250,255,0.35)');
    g.addColorStop(0.7, 'rgba(30,160,180,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.translate(cx, cy);
    for (let i = 0; i < 5; i++) {
      ctx.rotate(Math.PI / 5);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2 + i * 0.6;
      ctx.beginPath();
      for (let a = 0; a < TAU * 1.5; a += 0.16) {
        const r = 22 + a * 8 + Math.sin(a * 3 + i) * 6;
        const x = Math.cos(a + i) * r;
        const y = Math.sin(a + i) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

export function petalTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffd7e0';
    ctx.beginPath();
    ctx.moveTo(32, 6);
    ctx.bezierCurveTo(56, 14, 58, 42, 32, 59);
    ctx.bezierCurveTo(6, 42, 8, 14, 32, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(28, 26, 7, 14, -0.25, 0, TAU);
    ctx.fill();
  });
}

export function gateSignTexture({ top, main, sub, accent = '#5df4ff', accent2 = '#f4c47c' }) {
  const width = 512;
  const height = 384;
  const texture = canvasTexture(width, height, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const pad = 14;
    ctx.beginPath();
    ctx.moveTo(pad + 22, pad);
    ctx.lineTo(w - pad, pad);
    ctx.lineTo(w - pad, h - pad - 22);
    ctx.lineTo(w - pad - 22, h - pad);
    ctx.lineTo(pad, h - pad);
    ctx.closePath();
    ctx.fillStyle = 'rgba(3, 12, 17, 0.82)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad + 10, pad + 10, w - pad * 2 - 20, h - pad * 2 - 20);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent2;
    ctx.font = '600 32px "Shippori Mincho", serif';
    ctx.letterSpacing = '10px';
    ctx.fillText(top, w / 2, 72);

    ctx.fillStyle = '#f4fbfa';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 32;
    ctx.font = '700 128px Rajdhani, sans-serif';
    ctx.fillText(main, w / 2, 196);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(210, 240, 242, 0.7)';
    ctx.font = '600 24px Rajdhani, sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText(sub, w / 2, 304);

    ctx.fillStyle = accent;
    ctx.fillRect(w / 2 - 38, 338, 76, 2);
  });
  return { texture, aspect: width / height };
}

export function squadSignTexture(power, { maxPower = power, boss = false } = {}) {
  const width = 512;
  const height = 256;
  const ratio = clamp(power / Math.max(1, maxPower), 0, 1);
  const texture = canvasTexture(width, height, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(26, 20);
    ctx.lineTo(w - 20, 20);
    ctx.lineTo(w - 46, h - 20);
    ctx.lineTo(46, h - 20);
    ctx.closePath();
    ctx.fillStyle = 'rgba(32, 4, 10, 0.8)';
    ctx.fill();
    ctx.strokeStyle = boss ? 'rgba(255, 92, 92, 0.8)' : 'rgba(255, 60, 87, 0.66)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff8f9c';
    ctx.font = '600 28px "Shippori Mincho", serif';
    ctx.letterSpacing = '8px';
    ctx.fillText(boss ? '鬼将軍' : '紅鬼衆', w / 2, 64);

    ctx.fillStyle = '#ffe9e8';
    ctx.font = '700 68px Rajdhani, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText(boss ? 'KUROGANE' : `POWER ${power}`, w / 2, 128);

    ctx.font = '600 20px Rajdhani, sans-serif';
    ctx.letterSpacing = '7px';
    ctx.fillStyle = ratio < 0.35 ? '#ff6f7c' : 'rgba(255, 193, 190, 0.72)';
    ctx.fillText(boss ? 'ONI SHOGUN' : ratio < 0.35 ? 'BROKEN' : 'RONIN LINE', w / 2, 182);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 208, w - 120, 4);
    ctx.fillStyle = boss ? '#ff4c56' : ratio < 0.35 ? '#ff5563' : '#ff8b7e';
    ctx.fillRect(60, 208, (w - 120) * ratio, 4);
  });
  return { texture, aspect: width / height };
}

export function colorGeometry(geometry, color) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (!geo.attributes.uv) {
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return geo;
}

export function mergeParts(parts) {
  const geometries = [];
  for (const part of parts) {
    let geo = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    if (part.matrix) geo.applyMatrix4(part.matrix);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) {
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    }
    geo.deleteAttribute('tangent');
    colorGeometry(geo, part.color ?? 0xffffff);
    geometries.push(geo);
  }
  return mergeGeometries(geometries, false);
}

export function makePart(geo, color, position, rotation, scale) {
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(rotation?.[0] ?? 0, rotation?.[1] ?? 0, rotation?.[2] ?? 0);
  q.setFromEuler(e);
  matrix.compose(
    new THREE.Vector3(position?.[0] ?? 0, position?.[1] ?? 0, position?.[2] ?? 0),
    q,
    new THREE.Vector3(scale?.[0] ?? 1, scale?.[1] ?? 1, scale?.[2] ?? 1)
  );
  return { geo, color, matrix };
}

export function setShadows(object, cast = true, receive = true) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

export function makeGlowSprite(texture, color = 0xffffff, scaleX = 2, scaleY = 2) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    opacity: 0.8,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scaleX, scaleY, 1);
  return sprite;
}

export function screenPosition(position, camera, target = { x: 0, y: 0, visible: false }) {
  const v = position.clone().project(camera);
  target.x = (v.x * 0.5 + 0.5) * window.innerWidth;
  target.y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  target.visible = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.4 && Math.abs(v.y) < 1.4;
  return target;
}

export function disposeTexture(texture) {
  if (texture) texture.dispose();
}
