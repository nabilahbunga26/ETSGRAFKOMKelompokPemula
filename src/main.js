import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';
import { World } from './World.js';
import { UI } from './UI.js';
import { AudioEngine } from './Audio.js';
import { VFX } from './VFX.js';
import { Hero } from './Hero.js';
import { CloneArmy } from './CloneArmy.js';
import { Stage } from './Stage.js';
import { Boss } from './Boss.js';
import { Game } from './Game.js';

const MODEL_URL = `${import.meta.env.BASE_URL}assets/models/ninja.glb`;
const FONT_FACES = [
  '500 16px Rajdhani',
  '600 16px Rajdhani',
  '700 16px Rajdhani',
  '600 16px "Shippori Mincho"',
  '800 16px "Shippori Mincho"',
];

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

function fail(message, error) {
  console.error(message, error);
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('is-hidden');
  const screen = document.getElementById('error-screen');
  if (screen) screen.classList.remove('is-hidden');
}

async function loadFonts() {
  if (!document.fonts) return;
  await Promise.all(
    FONT_FACES.map((face) => document.fonts.load(face).catch(() => null))
  );
  await document.fonts.ready;
}

function loadModel(onProgress) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => resolve(gltf),
      (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(event.loaded / event.total);
        }
      },
      (error) => reject(error)
    );
  });
}

async function boot() {
  const canvas = document.getElementById('scene');
  const audio = new AudioEngine();
  const ui = new UI(audio);
  ui.setLoading(4, 'Summoning the moonlit pass…');
  await nextFrame();

  let modelProgress = 0;
  const modelPromise = loadModel((p) => {
    modelProgress = p;
    ui.setLoading(8 + p * 34, p < 1 ? 'Binding the Kage to the night…' : 'Sharpening the katana…');
  }).catch((error) => {
    fail('The ninja model could not be loaded.', error);
    return null;
  });

  ui.setLoading(6, 'Inking the shrine banners…');
  await loadFonts();
  void modelProgress;
  await nextFrame();

  let world;
  try {
    world = new World(canvas);
  } catch (error) {
    fail('WebGL renderer failed to start.', error);
    return;
  }
  ui.setLoading(48, 'Carving the shrine arena…');
  await nextFrame();

  const vfx = new VFX(world.scene, world.camera);
  const stage = new Stage(world.scene, vfx);
  const boss = new Boss(world.scene, vfx);
  ui.setLoading(58, 'Calling the shadow army…');
  await nextFrame();

  const gltf = await modelPromise;
  if (!gltf) return;

  ui.setLoading(86, 'Raising the spirit gates…');
  await nextFrame();

  let hero;
  try {
    hero = new Hero(gltf, vfx);
    const army = new CloneArmy(world.scene, vfx);
    const game = new Game({ world, hero, army, stage, boss, vfx, audio, ui });
    ui.setLoading(100, 'The pass is ready.');
    await nextFrame();
    ui.hideLoading();
    game.toMenu();
    game.start();
    window.__ncr = { game, world, hero, army, stage, boss, vfx, audio, ui };
  } catch (error) {
    fail('The scene failed to assemble.', error);
    throw error;
  }
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection', event.reason);
});

boot().catch((error) => fail('Unexpected error while starting the game.', error));
