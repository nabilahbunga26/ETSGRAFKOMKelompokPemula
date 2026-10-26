import * as THREE from 'three';
import { clamp, damp, screenPosition } from './utils.js';

const START_CLONES = 6;
const MAX_CLONES = 99;
const FOCUS_MAX = 100;
const KUNAI_COST = 25;
const KUNAI_DAMAGE = 8;
const STORM_COST = 100;
const RUN_SPEED = 11.4;
const LANE_LIMIT = 4.05;
const COURSE_LENGTH = 440;
const BOSS_TRIGGER_Z = -411;
const HERO_STOP_Z = -450.5;
const BEST_KEY = 'ncr_best_v2';
const ACTIVE_STATES = new Set(['running', 'clash', 'bossIntro', 'boss']);
const RANK_VALUE = { S: 3, A: 2, B: 1, C: 0 };

const ZONES = [
  { at: 0, name: 'BAMBOO PASS' },
  { at: 150, name: 'LANTERN HOLLOW' },
  { at: 270, name: 'WEEPING GROVE' },
  { at: 380, name: 'MOONLIT STEPS' },
  { at: 432, name: 'SHRINE OF THE ONI' },
];

export class Game {
  constructor({ world, hero, army, stage, boss, vfx, audio, ui }) {
    this.world = world;
    this.scene = world.scene;
    this.camera = world.camera;
    this.hero = hero;
    this.army = army;
    this.stage = stage;
    this.boss = boss;
    this.vfx = vfx;
    this.audio = audio;
    this.ui = ui;

    this.scene.add(this.hero.root);
    this.hero.root.position.set(0, 0, -4);
    this.hero.setFacing(0, true);

    this.state = 'boot';
    this.previousState = 'running';
    this.elapsed = 0;
    this.runTime = 0;
    this.menuTime = 0;
    this.cinematicTime = 0;
    this.timeScale = 1;
    this.slowmo = 0;
    this.slowmoScale = 0.35;
    this.fovPulse = 0;
    this.shake = 0;
    this.speed = 0;
    this.heroX = 0;
    this.targetHeroX = 0;
    this.heroZ = -4;
    this.focus = 45;
    this.squadsCut = 0;
    this.cores = 0;
    this.warningText = '';
    this.objectiveText = 'Reach the Oni Shogun at the shrine';
    this.zoneName = 'BAMBOO PASS';
    this.tempWarning = '';
    this.tempWarningT = 0;
    this.hudTimer = 0;
    this.hoverTimer = 0;
    this.streakTimer = 0;
    this.bossVfxTimer = 0;
    this.clashTimer = 0;
    this.clashResolved = false;
    this.clashSquad = null;
    this.bossIntroTimer = 0;
    this.tutorialFlags = {};
    this.keys = { left: false, right: false };
    this.touchAxis = 0;
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerScreen = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.pointerActive = false;
    this.raycaster = new THREE.Raycaster();
    this.hovered = null;
    this.hoverKind = '';
    this.tmp = new THREE.Vector3();
    this.tmpBoss = new THREE.Vector3();
    this.tmpCore = new THREE.Vector3();
    this.tmpScreen = { x: 0, y: 0, visible: false };
    this.worldFocus = new THREE.Vector3(0, 1.4, -4);
    this.smoothedCam = new THREE.Vector3(3.2, 2.4, 2.4);
    this.smoothedLook = new THREE.Vector3(0, 1.2, -4);
    this.defeatReason = '';
    this.defeatTip = '';
    this.best = this.loadBest();

    this.camera.position.copy(this.smoothedCam);
    this.camera.lookAt(this.smoothedLook);
    this.camera.updateMatrixWorld();

    this.ui.bind({
      start: () => this.startRun(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      restart: () => this.startRun(),
      retry: () => this.startRun(),
      menu: () => this.toMenu(),
      sound: () => this.toggleSound(),
      storm: () => this.triggerStorm(),
      steer: (axis, active) => this.steerTouch(axis, active),
    });
    this.bindInput();
    this.prepareMenuScene();

    this.tick = this.tick.bind(this);
    this.clock = new THREE.Clock();
    this.raf = 0;
  }

  start() {
    this.clock.start();
    this.tick();
  }

  tick() {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.world.render();
  }

  prepareMenuScene() {
    this.hero.root.position.set(0, 0, -4);
    this.hero.setFacing(0, true);
    this.hero.returnClip = 'Idle';
    this.hero.play('Idle', 0.05, { force: true });
    this.army.reset(0, this.hero.root.position);
    this.army.count = 0;
    this.army.visible = 0;
    this.stage.reset();
    this.stage.setHover(null);
    this.boss.reset();
    this.world.setBossMode(false);
    this.vfx.reset(this.hero.root.position);
    this.smoothedCam.set(3.2, 2.35, 2.35);
    this.smoothedLook.set(0, 1.15, -4.35);
    this.camera.position.copy(this.smoothedCam);
    this.camera.lookAt(this.smoothedLook);
    this.camera.fov = 54;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  toMenu() {
    this.state = 'menu';
    this.menuTime = 0;
    this.slowmo = 0;
    this.timeScale = 1;
    this.tempWarning = '';
    this.tempWarningT = 0;
    this.ui.hideTutorial();
    this.prepareMenuScene();
    this.ui.showMenu(this.best);
    this.ui.setWarning(null);
    this.audio.setMood('menu');
    this.bossIntroTimer = 0;
    this.clashSquad = null;
  }

  startRun() {
    this.audio.init();
    this.audio.startAmbient();
    this.audio.start();
    this.audio.setMood('run');

    this.scene.add(this.hero.root);
    this.hero.root.position.set(0, 0, 0);
    this.hero.setFacing(Math.PI, true);
    this.hero.returnClip = 'Run';
    this.hero.play('Run', 0.08, { force: true });
    this.heroX = 0;
    this.targetHeroX = 0;
    this.heroZ = 0;
    this.speed = RUN_SPEED * 0.45;
    this.focus = 45;
    this.runTime = 0;
    this.squadsCut = 0;
    this.cores = 0;
    this.clashTimer = 0;
    this.clashResolved = false;
    this.clashSquad = null;
    this.bossIntroTimer = 0;
    this.tutorialFlags = {};
    this.tempWarning = '';
    this.tempWarningT = 0;
    this.slowmo = 0;
    this.timeScale = 1;
    this.shake = 0;
    this.fovPulse = 0;
    this.streakTimer = 0;

    this.stage.reset();
    this.boss.reset();
    this.world.setBossMode(false);
    this.army.reset(START_CLONES, this.hero.root.position);
    this.vfx.reset(this.hero.root.position);
    this.worldFocus.set(0, 1.4, -2);

    this.ui.showRun();
    this.ui.setClones(START_CLONES, { silent: true });
    this.ui.setFocus(this.focus);
    this.ui.setRoute(0, COURSE_LENGTH);
    this.ui.setZone('BAMBOO PASS');
    this.ui.setObjective('Choose a spirit gate to grow your shadow army');
    this.ui.setWarning(null);
    this.ui.hideBoss();
    this.ui.announce('THE RUSH BEGINS', 'BAMBOO PASS', 'REACH THE ONI SHOGUN AT THE SHRINE', '', 2400);
    this.ui.showTutorial('01', 'Choose your gate', 'Press A / D or click a spirit gate to steer your run.', 7200);
    this.ui.flash('charged');

    this.smoothedCam.set(0.4, 2.9, 5.8);
    this.smoothedLook.set(0, 1.25, -7);
    this.camera.position.copy(this.smoothedCam);
    this.camera.lookAt(this.smoothedLook);
    this.camera.fov = 58;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    this.state = 'running';
  }

  toggleSound() {
    this.audio.init();
    this.audio.startAmbient();
    const muted = this.audio.toggleMute();
    this.ui.setSoundMuted(muted);
    if (!muted) this.audio.ui();
  }

  pause() {
    if (!ACTIVE_STATES.has(this.state)) return;
    this.previousState = this.state;
    this.state = 'paused';
    this.keys.left = false;
    this.keys.right = false;
    this.touchAxis = 0;
    this.ui.showPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.previousState;
    this.ui.hidePause();
    if (this.state === 'boss' || this.state === 'bossIntro') this.audio.setMood('boss');
    else this.audio.setMood('run');
  }

  bindInput() {
    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.onKeyUp(event));
    window.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.world.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    this.world.canvas.addEventListener('pointerleave', () => {
      this.pointerActive = false;
      this.ui.hideCursor();
      this.stage.setHover(null);
      this.hovered = null;
      this.hoverKind = '';
    });
    window.addEventListener('pointerdown', this.armAudio, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
  }

  armAudio = () => {
    this.audio.init();
    this.audio.startAmbient();
    this.audio.setMood(this.state === 'menu' ? 'menu' : 'run');
  };

  onKeyDown(event) {
    const code = event.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(code)) event.preventDefault();
    if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = true;
    if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = true;
    if (code === 'KeyE') this.triggerStorm();
    if (code === 'KeyP' || code === 'Escape') {
      if (this.state === 'paused') this.resume();
      else this.pause();
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      if (this.state === 'menu' || this.state === 'boot') this.startRun();
      else if (this.state === 'result') this.startRun();
      else if (this.state === 'paused') this.resume();
    }
  }

  onKeyUp(event) {
    const code = event.code;
    if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = false;
    if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = false;
  }

  steerTouch(axis, active) {
    if (active) this.touchAxis = axis;
    else if (this.touchAxis === axis) this.touchAxis = 0;
  }

  onPointerMove(event) {
    if (!this.ui.pointerFine) return;
    this.pointerScreen.x = event.clientX;
    this.pointerScreen.y = event.clientY;
    this.pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    this.pointerActive = true;
    this.hoverTimer = 0;
  }

  onPointerDown(event) {
    if (!this.ui.pointerFine && event.pointerType === 'mouse') return;
    if (!ACTIVE_STATES.has(this.state) && this.state !== 'paused') return;
    if (this.state === 'paused') return;
    this.pointerScreen.x = event.clientX;
    this.pointerScreen.y = event.clientY;
    this.pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    this.pointerActive = true;
    this.refreshHover(true);
    const target = this.hovered;
    if (!target) return;
    if (target.kind === 'gate' && this.state === 'running') {
      this.targetHeroX = clamp(target.gate.lane, -LANE_LIMIT, LANE_LIMIT);
      this.audio.ui();
      this.ui.floatText('LANE SET', this.pointerScreen.x, this.pointerScreen.y - 34, 'gold');
      this.hoverTimer = 0;
    } else if (target.kind === 'squad' && (this.state === 'running' || this.state === 'clash')) {
      this.throwKunaiAtSquad(target.squad);
    } else if (target.kind === 'core' && this.state === 'boss') {
      this.strikeCore();
    }
  }

  update(dt) {
    this.elapsed += dt;
    this.audio.update(dt);
    if (this.state === 'paused') {
      this.updateWorldAmbient(dt);
      this.updateHUD(dt);
      return;
    }
    if (this.state === 'boot' || this.state === 'menu') {
      this.updateMenu(dt);
      return;
    }
    if (this.state === 'result') {
      this.updateWorldAmbient(dt);
      return;
    }

    if (this.slowmo > 0) {
      this.slowmo = Math.max(0, this.slowmo - dt);
      this.timeScale = this.slowmo > 0 ? this.slowmoScale : 1;
    } else {
      this.timeScale = 1;
    }
    const gameDt = dt * this.timeScale;
    if (ACTIVE_STATES.has(this.state)) this.runTime += dt;

    if (this.tempWarningT > 0) this.tempWarningT = Math.max(0, this.tempWarningT - dt);

    switch (this.state) {
      case 'running':
        this.updateRun(gameDt, dt);
        break;
      case 'clash':
        this.updateClash(gameDt, dt);
        break;
      case 'bossIntro':
        this.updateBossIntro(gameDt, dt);
        break;
      case 'boss':
        this.updateBossFight(gameDt, dt);
        break;
      case 'victory':
      case 'defeat':
        this.updateCinematic(dt);
        break;
      default:
        break;
    }

    if (this.state !== 'victory' && this.state !== 'defeat' && this.state !== 'result') {
      this.stage.update(dt, this.elapsed, this.hero.root.position);
    }
    this.hero.update(gameDt, this.elapsed);
    this.vfx.update(gameDt, {
      heroPosition: this.hero.root.position,
      running: this.state === 'running' || this.state === 'bossIntro',
    });
    this.updateCamera(dt);
    this.worldFocus.set(this.heroX, 1.4, this.heroZ);
    if (this.state === 'boss' || this.state === 'bossIntro' || this.state === 'victory') {
      this.worldFocus.set(0, 2.2, -455);
    }
    this.world.update(dt, this.elapsed, this.worldFocus);
    this.updateHUD(dt);
    this.updateHover(dt);
  }

  updateMenu(dt) {
    this.menuTime += dt;
    this.hero.root.position.set(0, 0, -4);
    this.hero.setFacing(0);
    this.hero.update(dt, this.elapsed);
    this.hero.play('Idle');
    this.stage.update(dt, this.elapsed, this.hero.root.position);
    this.worldFocus.set(0, 1.4, -6);
    this.world.update(dt, this.elapsed, this.worldFocus);
    this.updateCamera(dt);
    this.ui.hideCursor();
  }

  updateRun(dt, realDt) {
    let axis = 0;
    if (this.keys.left) axis -= 1;
    if (this.keys.right) axis += 1;
    axis += this.touchAxis;
    if (axis !== 0) {
      this.targetHeroX = clamp(this.targetHeroX + axis * 8.2 * dt, -LANE_LIMIT, LANE_LIMIT);
    }

    this.heroX = damp(this.heroX, this.targetHeroX, 7.5, dt);
    this.speed = damp(this.speed, RUN_SPEED, 1.7, dt);
    this.heroZ -= this.speed * dt;
    this.hero.root.position.set(this.heroX, 0, this.heroZ);
    this.hero.setFacing(Math.PI + (this.targetHeroX - this.heroX) * 0.04);
    this.hero.play('Run');
    this.hero.returnClip = 'Run';

    this.focus = Math.min(FOCUS_MAX, this.focus + 6.5 * dt);

    const heroPos = this.hero.root.position;
    const gateResult = this.stage.resolveGate(this.heroZ);
    if (gateResult) this.applyGate(gateResult.gate);

    for (const orb of this.stage.orbs) {
      if (orb.collected) continue;
      if (Math.abs(orb.def.z - this.heroZ) < 2.3 && Math.abs(orb.def.x - this.heroX) < 2.5) {
        if (this.stage.collectOrb(orb)) {
          this.focus = Math.min(FOCUS_MAX, this.focus + 26);
          this.audio.gate(2);
          this.ui.flash('charged');
          const screen = screenPosition(orb.group.position, this.camera, this.tmpScreen);
          this.ui.floatText('+26 FOCUS', screen.x, screen.y - 38, 'gold');
          if (!this.tutorialFlags.orb) {
            this.tutorialFlags.orb = true;
            this.ui.showTutorial('02', 'Spirit focus', 'Focus fuels kunai and the Shadow Storm. Orbs refill it.', 5200);
          }
        }
      }
    }

    const squad = this.stage.getTriggeredSquad(this.heroZ);
    if (squad) {
      this.beginClash(squad);
      return;
    }

    if (this.heroZ <= BOSS_TRIGGER_Z) {
      this.beginBossApproach();
      return;
    }

    this.army.update(dt, this.elapsed, heroPos, 'run', null);

    this.streakTimer -= dt;
    if (this.streakTimer <= 0) {
      this.vfx.speedStreak(heroPos);
      this.streakTimer = 0.09 + Math.random() * 0.11;
    }

    const upcoming = this.stage.getUpcomingSquad(this.heroZ);
    if (upcoming) {
      const distance = this.heroZ - upcoming.z;
      if (distance < 48) {
        this.warningText = `RONIN AHEAD — POWER ${upcoming.power} · CLICK TO HURL KUNAI`;
        this.objectiveText = 'Break the ronin line — or weaken it with kunai';
      } else {
        this.warningText = '';
        this.objectiveText = 'Choose a spirit gate to grow your shadow army';
      }
    } else {
      this.warningText = '';
      this.objectiveText = 'Reach the Oni Shogun at the shrine';
    }

    if (this.focus >= FOCUS_MAX && !this.tutorialFlags.storm) {
      this.tutorialFlags.storm = true;
      this.ui.showTutorial('03', 'Shadow Storm ready', 'Press E to unleash the storm on the ronin ahead.', 6500);
    }

    this.zoneName = zoneForDistance(Math.max(0, -this.heroZ));
    this.ui.setClones(this.army.count);
    this.ui.setFocus(this.focus);
    this.ui.setObjective(this.objectiveText);
    this.ui.setZone(this.zoneName);
    this.ui.setWarning(this.currentWarning());
    this.updateRouteHud();
    this.updateDialogueHints(realDt);
  }

  applyGate(gate) {
    const before = this.army.count;
    let next = gate.isMul ? before * gate.option.value : before + gate.option.value;
    next = clamp(Math.round(next), 1, MAX_CLONES);
    this.army.setCount(next, this.hero.root.position);
    this.army.cheer();
    this.focus = Math.min(FOCUS_MAX, this.focus + 8);
    this.audio.gate(gate.option.value);
    this.ui.setClones(this.army.count);
    this.ui.setFocus(this.focus);
    this.ui.flash(gate.isMul ? 'gold' : 'charged');
    this.ui.dash();
    this.ui.announce(
      gate.isMul ? 'SPIRIT GATE · MULTIPLY' : 'SPIRIT GATE · REINFORCE',
      gate.isMul ? `×${gate.option.value} SHADOWS` : `+${gate.option.value} SHADOWS`,
      `${this.army.count} IN THE SHADOW ARMY`,
      gate.isMul ? 'gold' : '',
      1900
    );
    this.hero.play('Slash', 0.08, { force: true });
    this.shake = Math.max(this.shake, 0.32);
    this.fovPulse = Math.max(this.fovPulse, 0.25);
    const screen = screenPosition(this.hero.getChestPosition(this.tmp), this.camera, this.tmpScreen);
    this.ui.floatText(gate.isMul ? `×${gate.option.value}` : `+${gate.option.value}`, screen.x, screen.y - 70, gate.isMul ? 'gold' : '');
    if (!this.tutorialFlags.kunai) {
      this.tutorialFlags.kunai = true;
      this.ui.showTutorial('02', 'Hurl kunai', 'Click a ronin squad to throw — 25 focus weakens their power.', 7000);
    }
    if (next >= MAX_CLONES) this.tempWarning = 'THE SHADOW ARMY IS AT FULL STRENGTH';
  }

  beginClash(squad) {
    this.state = 'clash';
    this.clashTimer = 0;
    this.clashResolved = false;
    this.clashSquad = squad;
    this.heroZ = squad.z + 2.5;
    this.hero.root.position.z = this.heroZ;
    this.speed = 0;
    this.targetHeroX = this.heroX;
    this.hero.returnClip = 'Run';
    this.hero.play('Slash', 0.08, { force: true });
    this.audio.clash();
    this.shake = Math.max(this.shake, 0.65);
    this.ui.setWarning(null);
    this.ui.flash('hit');
    const point = squad.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.vfx.slash(point, (Math.random() - 0.5) * 1.2, 0xffd3b8, 1.5);
    this.vfx.ring(this.hero.root.position.clone().setY(0.06), { color: 0xff4458, from: 0.5, to: 4.5, life: 0.6 });
  }

  updateClash(dt) {
    this.clashTimer += dt;
    const squad = this.clashSquad;
    if (!squad) {
      this.state = 'running';
      return;
    }
    this.hero.play('Slash');
    this.army.update(dt, this.elapsed, this.hero.root.position, 'run', null);
    if (!this.clashResolved && this.clashTimer >= 0.36) {
      this.clashResolved = true;
      const power = squad.power;
      const count = this.army.count;
      const point = squad.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      if (count > power) {
        const loss = Math.max(2, Math.ceil(power * 0.5));
        this.army.setCount(Math.max(0, count - loss), this.hero.root.position);
        this.stage.clearSquad(squad);
        this.squadsCut += 1;
        this.focus = Math.min(FOCUS_MAX, this.focus + 28);
        this.audio.impact();
        this.shake = Math.max(this.shake, 1.0);
        this.fovPulse = Math.max(this.fovPulse, 0.5);
        this.ui.flash('gold');
        this.vfx.squadBreak(point);
        this.ui.announce(
          'LINE BROKEN',
          `${loss} SHADOWS LOST`,
          `+28 FOCUS · POWER ${power} ERASED`,
          'gold',
          2100
        );
        const screen = screenPosition(point, this.camera, this.tmpScreen);
        this.ui.floatText(`-${loss}`, screen.x, screen.y - 20, 'bad');
        this.ui.setClones(this.army.count);
        this.ui.setFocus(this.focus);
        if (!this.tutorialFlags.stormAfter) {
          this.tutorialFlags.stormAfter = true;
          this.ui.showTutorial('03', 'Shadow Storm', 'At 100 focus press E to erase the next squad.', 6200);
        }
      } else {
        this.army.setCount(0, this.hero.root.position);
        this.ui.setClones(0);
        this.beginDefeat(
          `Your ${count} shadows could not break a power-${power} ronin squad.`,
          'Throw kunai to weaken a squad before you collide — focus orbs are placed along the pass.'
        );
        return;
      }
    }
    if (this.clashTimer >= 1.02 && this.state === 'clash') {
      this.state = 'running';
      this.speed = RUN_SPEED * 0.4;
      this.clashSquad = null;
    }
  }

  beginBossApproach() {
    this.state = 'bossIntro';
    this.bossIntroTimer = 0;
    this.speed = Math.max(RUN_SPEED * 0.8, this.speed);
    this.targetHeroX = 0;
    this.focus = Math.max(this.focus, 45);
    this.hero.returnClip = 'Idle';
    this.boss.startBattle();
    this.world.setBossMode(true);
    this.ui.showBoss(this.boss.maxHp);
    this.ui.setWarning(null);
    this.ui.setObjective('Defeat the Oni Shogun and break the seal');
    this.ui.setZone('SHRINE OF THE ONI');
    this.ui.announce(
      'FINAL DUEL',
      'ONI SHOGUN KUROGANE',
      'STRIKE THE EXPOSED CORE TO BREAK HIS ROAR',
      'danger',
      3400
    );
    this.ui.showTutorial('04', 'Read the roar', 'When the Oni roars his chest opens — click the core to stagger him.', 8500);
    this.audio.setMood('boss');
    this.audio.roar();
    this.audio.thunder();
    this.shake = Math.max(this.shake, 0.9);
    this.ui.flash('hit');
    this.army.cheer();
    this.warningText = '';
    this.objectiveText = 'Strike the exposed core and break the Oni Shogun';
    this.playBossEvents(this.boss.update(0.016, this.elapsed, this.hero.root.position));
  }

  updateBossIntro(dt) {
    this.bossIntroTimer += dt;
    this.heroZ = damp(this.heroZ, HERO_STOP_Z, 2.2, dt);
    this.heroX = damp(this.heroX, 0, 4, dt);
    this.hero.root.position.set(this.heroX, 0, this.heroZ);
    this.hero.setFacing(Math.PI);
    this.hero.play('Run');
    this.army.update(dt, this.elapsed, this.hero.root.position, 'run', null);
    this.focus = Math.min(FOCUS_MAX, this.focus + 4 * dt);
    const events = this.boss.update(dt, this.elapsed, this.hero.root.position);
    this.playBossEvents(events);
    if (this.bossIntroTimer > 6 && this.state === 'bossIntro') this.enterBossFight();
    this.ui.setClones(this.army.count);
    this.ui.setFocus(this.focus);
    this.ui.setBossHp(this.boss.hp, this.boss.maxHp, this.boss.phase);
    this.updateRouteHud();
    this.ui.setWarning(this.currentWarning());
  }

  enterBossFight() {
    if (this.state === 'boss') return;
    this.state = 'boss';
    this.hero.returnClip = 'Idle';
    this.hero.play('Idle', 0.2, { force: true });
    this.ui.showBoss(this.boss.maxHp);
    this.ui.setWarning('THE CORE IS SEALED — READ THE SHOGUN');
    this.audio.setMood('boss');
    this.warningText = 'THE CORE IS SEALED — READ THE SHOGUN';
  }

  updateBossFight(dt) {
    this.heroZ = damp(this.heroZ, HERO_STOP_Z, 5, dt);
    this.heroX = damp(this.heroX, 0, 5, dt);
    this.hero.root.position.set(this.heroX, 0, this.heroZ);
    this.hero.setFacing(Math.PI);
    this.hero.play('Idle');
    this.focus = Math.min(FOCUS_MAX, this.focus + 8 * dt);

    const bossPos = this.boss.getPosition(this.tmpBoss);
    this.army.update(dt, this.elapsed, this.hero.root.position, 'boss', bossPos);

    if (this.boss.isAlive() && this.boss.state !== 'intro') {
      const dps = Math.min(this.army.count, 84) * 0.45 * (this.boss.state === 'stunned' ? 1.7 : 1);
      this.boss.damage(dps * dt);
    }

    const events = this.boss.update(dt, this.elapsed, this.hero.root.position);
    this.playBossEvents(events);
    if (this.state !== 'boss') return;

    this.bossVfxTimer -= dt;
    if (this.bossVfxTimer <= 0 && this.boss.isAlive()) {
      this.bossVfxTimer = 0.72 + Math.random() * 0.25;
      this.tmp.copy(bossPos).add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 1.8 + Math.random() * 2, 1.3));
      this.vfx.slash(this.tmp, (Math.random() - 0.5) * 2, 0xbdf9ff, 0.95);
    }

    if (this.boss.state === 'coreExposed') {
      this.warningText = 'CORE EXPOSED — CLICK THE CORE (25 FOCUS)';
    } else if (this.boss.state === 'roarWindup') {
      this.warningText = 'ONI ROAR INCOMING — THE CORE WILL OPEN';
    } else if (this.boss.state === 'slamWindup') {
      this.warningText = 'KANABO SLAM — THE SHADOW ARMY MUST HOLD';
    } else if (this.boss.state === 'stunned') {
      this.warningText = 'THE SHOGUN STAGGERS — PRESS THE ATTACK';
    } else if (this.boss.state === 'recover') {
      this.warningText = 'THE SEAL THICKENS — WATCH FOR THE ROAR';
    } else {
      this.warningText = 'CUT THROUGH THE ONI SHOGUN';
    }
    this.objectiveText = 'Strike the exposed core and break the Oni Shogun';
    this.zoneName = 'SHRINE OF THE ONI';
    this.ui.setWarning(this.currentWarning());
    this.ui.setObjective(this.objectiveText);
    this.ui.setZone(this.zoneName);
    this.ui.setClones(this.army.count);
    this.ui.setFocus(this.focus);
    this.ui.setBossHp(this.boss.hp, this.boss.maxHp, this.boss.phase);
    this.updateRouteHud();

    if (this.focus >= FOCUS_MAX && !this.tutorialFlags.stormBoss) {
      this.tutorialFlags.stormBoss = true;
      this.ui.showTutorial('E', 'Shadow Storm', 'Press E to channel 100 focus into the Shogun.', 5200);
    }
  }

  playBossEvents(events) {
    if (!events || !events.length) return;
    for (const event of events) {
      if (this.state === 'result') return;
      switch (event.type) {
        case 'introRoar':
          this.audio.roar();
          this.shake = Math.max(this.shake, 0.8);
          this.ui.flash('hit');
          this.vfx.ring(this.boss.getPosition(this.tmp).setY(0.1), { color: 0xff3a48, from: 1, to: 12, life: 0.9 });
          break;
        case 'introEnd':
          this.enterBossFight();
          break;
        case 'roarWindup':
          this.audio.roar();
          this.warningText = 'ONI ROAR INCOMING — THE CORE WILL OPEN';
          this.shake = Math.max(this.shake, 0.45);
          break;
        case 'coreExposed':
          this.ui.setWarning('CORE EXPOSED — CLICK THE CORE (25 FOCUS)');
          this.ui.announce('THE CORE OPENS', 'STRIKE NOW', '25 FOCUS · SILENCE THE ROAR', 'gold', 1900);
          this.audio.stormReady();
          this.vfx.ring(this.boss.getCorePosition(this.tmpCore), { color: 0xffd08a, from: 0.5, to: 5.5, life: 0.6, vertical: true });
          this.ui.flash('charged');
          this.fovPulse = Math.max(this.fovPulse, 0.4);
          break;
        case 'roarEnd': {
          const loss = this.applyBossLoss(event.lossFraction);
          this.audio.roar();
          this.shake = Math.max(this.shake, 1.15);
          this.ui.flash('hit');
          if (this.army.count > 0) {
            this.ui.announce('SEALING ROAR', `${loss} SHADOWS TORN AWAY`, 'STRIKE THE CORE TO SILENCE HIM', 'danger', 2100);
          }
          break;
        }
        case 'slamWindup':
          this.warningText = 'KANABO SLAM — BRACE THE LINE';
          this.audio.taikoDistant?.();
          break;
        case 'slam': {
          const point = this.boss.getPosition(this.tmp).add(new THREE.Vector3(0, 0.08, 5));
          this.vfx.bossSlam(point);
          this.audio.impact();
          this.shake = Math.max(this.shake, 1.35);
          this.ui.flash('hit');
          const loss = this.applyBossLoss(event.lossFraction);
          if (this.army.count > 0) {
            this.ui.announce('KANABO SLAM', `${loss} SHADOWS SCATTERED`, 'THE ARENA TREMBLES', 'danger', 1800);
          }
          break;
        }
        case 'interrupted': {
          const core = this.boss.getCorePosition(this.tmpCore);
          this.vfx.coreStrike(core);
          this.audio.coreHit();
          this.shake = Math.max(this.shake, 0.8);
          this.ui.flash('gold');
          this.startSlowmo(0.32, 0.3);
          this.ui.announce('CORE BROKEN', 'THE SHOGUN STAGGERS', 'CLONES PRESS THE ATTACK', 'gold', 2000);
          this.army.cheer();
          break;
        }
        case 'phase':
          this.audio.bossPhase();
          this.bossHudPhase = event.phase;
          this.ui.setBossHp(this.boss.hp, this.boss.maxHp, event.phase);
          this.ui.announce(
            `PHASE ${event.phase}`,
            event.phase === 2 ? 'THE SHOGUN IS ENRAGED' : 'DESPERATE FURY',
            'THE SHRINE TREMBLES',
            'danger',
            2300
          );
          this.shake = Math.max(this.shake, 0.6);
          break;
        case 'dying':
          this.warningText = '';
          this.ui.setWarning(null);
          this.ui.announce('THE SHOGUN FALLS', 'SILENCE THE SEAL', 'THE MOON ANSWER HIS ROAR', 'gold', 2600);
          this.startSlowmo(0.5, 0.28);
          this.shake = Math.max(this.shake, 1.3);
          break;
        case 'death':
          this.beginVictory();
          break;
        default:
          break;
      }
      if (this.state === 'victory' || this.state === 'defeat' || this.state === 'result') return;
    }
  }

  applyBossLoss(fraction) {
    const count = this.army.count;
    if (count <= 0) return 0;
    const loss = Math.min(count, Math.max(1, Math.ceil(count * fraction)));
    this.army.setCount(count - loss, this.hero.root.position);
    this.ui.setClones(this.army.count);
    const center = this.army.center;
    const screen = screenPosition(center, this.camera, this.tmpScreen);
    if (screen.visible) this.ui.floatText(`-${loss}`, screen.x, screen.y - 30, 'bad');
    if (this.army.count <= 0) {
      this.beginDefeat(
        'Kurogane scattered the last of your shadows before the seal could break.',
        'Click the exposed core to stagger the Oni, and spend focus before his roar lands.'
      );
    }
    return loss;
  }

  throwKunaiAtSquad(squad) {
    if (squad.defeated) return;
    if (this.focus < KUNAI_COST) {
      this.showTempWarning('FOCUS TOO LOW — KUNAI COSTS 25');
      this.audio.gateMissed();
      return;
    }
    this.focus -= KUNAI_COST;
    this.ui.setFocus(this.focus);
    const from = this.hero.getSwordPosition(new THREE.Vector3());
    const to = squad.group.position.clone().add(new THREE.Vector3(0, 1.35, 0));
    const distance = from.distanceTo(to);
    this.hero.play('Slash', 0.06, { force: true });
    this.audio.kunai();
    this.vfx.slash(from, -0.4, 0x9ff8ff, 0.8);
    this.vfx.throwKunai(from, to, {
      color: 0x6df7ff,
      duration: clamp(distance * 0.012, 0.24, 0.52),
      onHit: () => {
        if (this.state === 'result' || this.state === 'menu' || this.state === 'defeat') return;
        if (squad.defeated) return;
        const remaining = this.stage.hitSquad(squad, KUNAI_DAMAGE);
        const point = squad.group.position.clone().add(new THREE.Vector3(0, 1.35, 0));
        this.vfx.slash(point, (Math.random() - 0.5) * 2, 0xffdfb8, 1.1);
        this.audio.impact();
        this.shake = Math.max(this.shake, 0.22);
        const screen = screenPosition(point, this.camera, this.tmpScreen);
        if (screen.visible) this.ui.floatText(`-${KUNAI_DAMAGE} POWER`, screen.x, screen.y - 28, 'damage');
        if (remaining <= 0) {
          this.squadsCut += 1;
          this.focus = Math.min(FOCUS_MAX, this.focus + 16);
          this.ui.setFocus(this.focus);
          this.ui.announce('KUNAI BREAK', 'RONIN SQUAD SCATTERED', '+16 FOCUS', 'gold', 1600);
        }
      },
    });
  }

  strikeCore() {
    if (this.state !== 'boss' || !this.boss.isCoreTargetable()) return;
    if (this.focus < KUNAI_COST) {
      this.showTempWarning('FOCUS TOO LOW — THE CORE STRIKE COSTS 25');
      this.audio.gateMissed();
      return;
    }
    this.focus -= KUNAI_COST;
    this.ui.setFocus(this.focus);
    const from = this.hero.getSwordPosition(new THREE.Vector3());
    const to = this.boss.getCorePosition(new THREE.Vector3());
    this.hero.play('Slash', 0.06, { force: true });
    this.audio.kunai();
    this.vfx.throwKunai(from, to, {
      color: 0xffd48a,
      duration: 0.3,
      onHit: () => {
        if (!this.boss.isAlive()) return;
        const core = this.boss.getCorePosition(this.tmpCore);
        if (this.boss.isCoreTargetable()) {
          this.cores += 1;
          this.boss.interruptCore();
          this.boss.damage(200);
          this.ui.floatText('-200', this.pointerScreen.x, this.pointerScreen.y - 48, 'gold');
        } else {
          this.boss.damage(80);
          this.vfx.coreStrike(core);
          this.audio.coreHit();
          this.ui.floatText('-80', this.pointerScreen.x, this.pointerScreen.y - 48, 'damage');
        }
      },
    });
  }

  triggerStorm() {
    if (!ACTIVE_STATES.has(this.state)) return;
    if (this.state === 'clash') {
      this.showTempWarning('THE LINE IS ALREADY ENGAGED');
      return;
    }
    if (this.focus < STORM_COST) {
      this.showTempWarning(`STORM CHARGING — ${Math.floor(this.focus)} / 100 FOCUS`);
      this.audio.gateMissed();
      return;
    }
    if (this.state === 'boss' || this.state === 'bossIntro') {
      if (!this.boss.isAlive()) return;
      this.focus = 0;
      this.ui.setFocus(0);
      this.hero.play('Storm', 0.08, { force: true });
      this.audio.storm();
      this.audio.thunder();
      this.army.stormFlash();
      this.ui.flash('gold');
      this.startSlowmo(0.42, 0.32);
      this.shake = Math.max(this.shake, 1.2);
      this.boss.damage(220);
      const bossPos = this.boss.getPosition(this.tmp);
      this.vfx.explode(bossPos.clone().add(new THREE.Vector3(0, 2.4, 1.2)));
      this.vfx.burst(bossPos.clone().add(new THREE.Vector3(0, 3, 1)), {
        color: 0x9ff8ff,
        count: 60,
        speed: 8,
        spread: 0.6,
        size: 0.2,
        life: 1.3,
        gravity: 1.5,
      });
      this.ui.announce('SHADOW STORM', 'MOONLIT TORRENT', '220 DAMAGE TO THE ONI SHOGUN', 'gold', 2200);
      return;
    }
    const squad = this.stage.getStormSquad(this.heroZ);
    if (!squad) {
      this.showTempWarning('NO RONIN IN RANGE — HOLD THE STORM');
      this.audio.gateMissed();
      return;
    }
    this.focus = 0;
    this.ui.setFocus(0);
    this.hero.play('Storm', 0.08, { force: true });
    this.audio.storm();
    this.audio.thunder();
    this.army.stormFlash();
    this.ui.flash('gold');
    this.startSlowmo(0.38, 0.32);
    this.shake = Math.max(this.shake, 1.1);
    this.fovPulse = Math.max(this.fovPulse, 1);
    const point = squad.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.vfx.explode(point);
    this.vfx.burst(point, { color: 0xffe2a8, count: 50, speed: 7, spread: 1.1, size: 0.25, life: 1.2, gravity: -3 });
    this.stage.hitSquad(squad, squad.power);
    this.squadsCut += 1;
    this.ui.announce('SHADOW STORM', 'THE LINE IS ERASED', '+30 FOCUS FROM THE BREAK', 'gold', 2200);
    this.focus = 30;
    this.ui.setFocus(this.focus);
    this.ui.setClones(this.army.count);
  }

  startSlowmo(duration, scale) {
    this.slowmo = Math.max(this.slowmo, duration);
    this.slowmoScale = scale;
  }

  showTempWarning(text, time = 1.8) {
    this.tempWarning = text;
    this.tempWarningT = time;
    this.ui.setWarning(text);
  }

  currentWarning() {
    if (this.tempWarningT > 0 && this.tempWarning) return this.tempWarning;
    return this.warningText;
  }

  updateDialogueHints(dt) {
    void dt;
    if (this.tutorialFlags.gateHintShown) return;
    const upcoming = this.stage.gateRows.find((row) => !row.resolved);
    if (upcoming && this.heroZ - upcoming.z < 24) {
      this.tutorialFlags.gateHintShown = true;
      this.ui.showTutorial('01', 'Gate choice', 'A / D or click a gate — each gate changes your army.', 5000);
    }
  }

  updateRouteHud() {
    const distance = clamp(-this.heroZ, 0, COURSE_LENGTH);
    const remaining = Math.max(0, COURSE_LENGTH - distance);
    this.ui.setRoute(distance / COURSE_LENGTH, remaining);
    if (this.state === 'boss' || this.state === 'bossIntro') {
      this.ui.setZone('SHRINE OF THE ONI');
    } else {
      this.ui.setZone(zoneForDistance(distance));
    }
  }

  updateHUD(dt) {
    this.hudTimer -= dt;
    if (this.hudTimer > 0) return;
    this.hudTimer = 0.075;
    this.ui.setFocus(this.focus);
    if (this.state === 'boss' || this.state === 'bossIntro') {
      this.ui.setBossHp(this.boss.hp, this.boss.maxHp, this.boss.phase);
      this.ui.setClones(this.army.count);
    }
    this.ui.setWarning(this.currentWarning());
    this.updateRouteHud();
    this.ui.setObjective(this.objectiveText);
  }

  updateHover(dt) {
    if (!this.ui.pointerFine || !this.pointerActive) {
      this.ui.hideCursor();
      return;
    }
    if (!ACTIVE_STATES.has(this.state)) {
      this.ui.hideCursor();
      return;
    }
    this.hoverTimer -= dt;
    if (this.hoverTimer > 0) {
      this.ui.setCursor(this.pointerScreen.x, this.pointerScreen.y, this.hoverKind, this.hoverTag());
      return;
    }
    this.hoverTimer = 0.08;
    this.refreshHover(false);
  }

  refreshHover(force) {
    void force;
    const targets = this.stage.getInteractiveTargets();
    if (this.boss.isCoreTargetable()) targets.push(this.boss.coreHitbox);
    this.world.scene.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(targets, false);
    const hit = hits[0];
    if (!hit) {
      this.hovered = null;
      this.hoverKind = '';
      this.stage.setHover(null);
      this.ui.setCursor(this.pointerScreen.x, this.pointerScreen.y, '', '');
      return;
    }
    const data = hit.object.userData;
    this.hovered = data;
    this.hoverKind = data.kind || '';
    if (data.kind === 'gate') this.stage.setHover(data.gate);
    else if (data.kind === 'squad') this.stage.setHover(data.squad);
    else this.stage.setHover(null);
    this.ui.setCursor(this.pointerScreen.x, this.pointerScreen.y, this.hoverKind, this.hoverTag());
  }

  hoverTag() {
    const data = this.hovered;
    if (!data) return '';
    if (data.kind === 'gate') {
      const gate = data.gate;
      return gate.isMul ? `×${gate.option.value} MULTIPLY · STEER` : `+${gate.option.value} REINFORCE · STEER`;
    }
    if (data.kind === 'squad') {
      return `POWER ${data.squad.power} · KUNAI ${KUNAI_COST} FOCUS`;
    }
    if (data.kind === 'core') {
      return `CORE · ${KUNAI_COST} FOCUS · STRIKE`;
    }
    return '';
  }

  updateCamera(dt) {
    const cam = this.camera;
    const menu = this.state === 'boot' || this.state === 'menu';
    let desiredX;
    let desiredY;
    let desiredZ;
    let lookX;
    let lookY;
    let lookZ;
    let fov = 58;

    if (menu) {
      const a = 0.42 + Math.sin(this.menuTime * 0.12) * 0.16;
      const r = 6.5 + Math.sin(this.menuTime * 0.09) * 0.45;
      desiredX = Math.sin(a) * r;
      desiredY = 2.2 + Math.sin(this.menuTime * 0.15) * 0.12;
      desiredZ = -4 + Math.cos(a) * r;
      lookX = 0;
      lookY = 1.2;
      lookZ = -4.4;
      fov = 54;
    } else if (this.state === 'running') {
      desiredX = this.heroX * 0.54;
      desiredY = 2.85 + Math.sin(this.elapsed * 6.8) * 0.03;
      desiredZ = this.heroZ + 5.7;
      lookX = this.heroX * 0.38;
      lookY = 1.25;
      lookZ = this.heroZ - 7.5;
    } else if (this.state === 'clash') {
      desiredX = this.heroX * 0.7 + 1.2;
      desiredY = 2.4;
      desiredZ = this.heroZ + 4.6;
      lookX = this.heroX * 0.2;
      lookY = 1.3;
      lookZ = this.heroZ - 4.5;
      fov = 62;
    } else if (this.state === 'bossIntro') {
      const t = clamp(this.bossIntroTimer / 3.2, 0, 1);
      const ease = t * t * (3 - 2 * t);
      desiredX = 3.8 - ease * 2.6;
      desiredY = 2.2 + ease * 0.7;
      desiredZ = HERO_STOP_Z + 8.4 - ease * 0.9;
      lookX = 0;
      lookY = 4.4 + ease * 0.8;
      lookZ = -460.5;
      fov = 60 - ease * 2;
    } else if (this.state === 'boss') {
      const sway = Math.sin(this.elapsed * 0.42) * 0.3;
      desiredX = 1.2 + sway;
      desiredY = 2.9 + Math.sin(this.elapsed * 0.55) * 0.08;
      desiredZ = HERO_STOP_Z + 7.5;
      lookX = -0.75;
      lookY = 5.2;
      lookZ = -460.5;
      fov = 58;
    } else if (this.state === 'victory') {
      const a = 0.48 + Math.sin(this.cinematicTime * 0.25) * 0.14;
      desiredX = Math.sin(a) * 6.2;
      desiredY = 2.65;
      desiredZ = this.heroZ + Math.cos(a) * 6.2;
      lookX = 0;
      lookY = 1.25;
      lookZ = this.heroZ - 1.1;
      fov = 50;
    } else if (this.state === 'defeat') {
      const push = clamp(this.cinematicTime / 3, 0, 1);
      desiredX = 3.0 - push * 0.8;
      desiredY = 1.7 - push * 0.15;
      desiredZ = this.heroZ + 5.6 - push * 1.4;
      lookX = 0;
      lookY = 0.95;
      lookZ = this.heroZ - 2.2;
      fov = 48;
    } else if (this.state === 'paused') {
      return;
    } else {
      desiredX = this.heroX * 0.54;
      desiredY = 2.85;
      desiredZ = this.heroZ + 5.7;
      lookX = this.heroX * 0.38;
      lookY = 1.25;
      lookZ = this.heroZ - 7;
    }

    const lambda = menu ? 2.2 : this.state === 'bossIntro' || this.state === 'victory' ? 2.0 : 5.2;
    this.smoothedCam.x = damp(this.smoothedCam.x, desiredX, lambda, dt);
    this.smoothedCam.y = damp(this.smoothedCam.y, desiredY, lambda, dt);
    this.smoothedCam.z = damp(this.smoothedCam.z, desiredZ, lambda, dt);
    this.smoothedLook.x = damp(this.smoothedLook.x, lookX, lambda * 1.2, dt);
    this.smoothedLook.y = damp(this.smoothedLook.y, lookY, lambda * 1.2, dt);
    this.smoothedLook.z = damp(this.smoothedLook.z, lookZ, lambda * 1.2, dt);

    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.fovPulse = Math.max(0, this.fovPulse - dt * 1.5);
    const shakeAmount = this.shake * 0.09 + this.fovPulse * 0.015;
    const sx = shakeAmount * Math.sin(this.elapsed * 91.3);
    const sy = shakeAmount * Math.cos(this.elapsed * 73.1);
    const sz = shakeAmount * Math.sin(this.elapsed * 61.7);
    cam.position.set(this.smoothedCam.x + sx, this.smoothedCam.y + sy, this.smoothedCam.z + sz);
    cam.lookAt(this.smoothedLook.x + sy * 0.4, this.smoothedLook.y + sx * 0.3, this.smoothedLook.z);
    const targetFov = fov + this.fovPulse * 9;
    if (Math.abs(cam.fov - targetFov) > 0.01) {
      cam.fov = damp(cam.fov, targetFov, 4, dt);
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
  }

  updateWorldAmbient(dt) {
    this.worldFocus.set(this.heroX, 1.4, this.heroZ);
    this.world.update(dt, this.elapsed, this.worldFocus);
  }

  beginVictory() {
    if (this.state === 'victory' || this.state === 'result') return;
    this.state = 'victory';
    this.cinematicTime = 0;
    this.hero.returnClip = 'Idle';
    this.hero.setFacing(0, true);
    this.hero.play('Victory', 0.12, { force: true });
    this.army.cheer();
    this.ui.hideBoss();
    this.ui.setWarning(null);
    this.ui.announce('VICTORY', 'ONI SHOGUN FALLEN', 'THE MOON BURNS CLEAN AGAIN', 'gold', 3200);
    this.audio.victory();
    this.audio.setMood('victory');
    this.ui.flash('white');
    this.startSlowmo(1.6, 0.3);
    this.shake = Math.max(this.shake, 1.1);
    this.fovPulse = 0.8;
    this.vfx.explode(this.boss.getPosition(this.tmp).add(new THREE.Vector3(0, 2.5, 0)));
    this.warningText = '';
    this.objectiveText = 'The shrine is free';
  }

  beginDefeat(reason, tip) {
    if (this.state === 'defeat' || this.state === 'result') return;
    this.state = 'defeat';
    this.cinematicTime = 0;
    this.defeatReason = reason;
    this.defeatTip = tip;
    this.hero.returnClip = 'Idle';
    this.hero.setFacing(0, true);
    this.hero.play('Defeat', 0.2, { force: true });
    this.army.setCount(0, this.hero.root.position);
    this.focus = 0;
    this.ui.setClones(0);
    this.ui.setFocus(0);
    this.ui.hideBoss();
    this.ui.setWarning(null);
    this.ui.announce('RUN ENDED', 'SHADOW EXTINGUISHED', reason, 'danger', 3200);
    this.audio.defeat();
    this.audio.setMood('defeat');
    this.ui.flash('hit');
    this.startSlowmo(0.7, 0.35);
    this.shake = Math.max(this.shake, 1.2);
    this.warningText = '';
  }

  updateCinematic(dt) {
    this.cinematicTime += dt;
    this.heroZ = this.heroZ;
    this.hero.root.position.set(this.heroX, 0, this.heroZ);
    this.hero.update(dt * 0.8, this.elapsed);
    if (this.state === 'victory') {
      const bossPos = this.boss.getPosition(this.tmpBoss);
      this.army.update(dt * 0.75, this.elapsed, this.hero.root.position, 'boss', bossPos);
      this.army.cheerT = Math.max(this.army.cheerT, 0.5);
      if (this.cinematicTime > 4.4) this.finishRun(true);
    } else if (this.cinematicTime > 3.1) {
      this.finishRun(false);
    }
    this.vfx.update(dt * 0.7, { heroPosition: this.hero.root.position, running: false });
    this.updateCamera(dt);
    this.worldFocus.set(this.heroX, 1.6, this.state === 'victory' ? -452 : this.heroZ);
    this.world.update(dt, this.elapsed, this.worldFocus);
  }

  finishRun(victory) {
    if (this.state === 'result') return;
    this.state = 'result';
    this.slowmo = 0;
    this.timeScale = 1;
    const time = this.runTime;
    const clones = victory ? this.army.count : 0;
    const rank = victory ? this.computeRank(time, clones) : '—';
    const record = {
      victory,
      time,
      clones,
      squads: this.squadsCut,
      cores: this.cores,
      rank,
      rankNote: rankNote(rank, victory),
    };
    this.best = this.recordBest(record);
    record.best = this.best;
    record.subtitle = victory
      ? 'Kurogane falls. The moon burns clean again.'
      : 'The pass falls silent. The shrine remains sealed.';
    record.reason = this.defeatReason || 'Your shadow army was wiped out.';
    record.tip = this.defeatTip || 'Weaken squads with kunai and strike the exposed core.';
    this.ui.showResult(record);
    this.audio.setMood(victory ? 'victory' : 'defeat');
    this.ui.setClones(clones);
  }

  computeRank(time, clones) {
    if (time <= 52 && clones >= 55) return 'S';
    if (clones >= 28 || time <= 64) return 'A';
    return 'B';
  }

  loadBest() {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.victory) return null;
      return data;
    } catch {
      return null;
    }
  }

  recordBest(record) {
    if (!record.victory) return this.best;
    const candidate = { ...record, victory: true };
    const best = this.best;
    const better =
      !best ||
      RANK_VALUE[candidate.rank] > RANK_VALUE[best.rank] ||
      (RANK_VALUE[candidate.rank] === RANK_VALUE[best.rank] && candidate.time < best.time);
    if (!better) return best;
    this.best = {
      victory: true,
      rank: candidate.rank,
      time: candidate.time,
      clones: candidate.clones,
    };
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(this.best));
    } catch {
      /* storage can be unavailable in private mode */
    }
    return this.best;
  }
}

function zoneForDistance(distance) {
  let name = ZONES[0].name;
  for (const zone of ZONES) {
    if (distance >= zone.at) name = zone.name;
  }
  return name;
}

function rankNote(rank, victory) {
  if (!victory) return '—';
  if (rank === 'S') return 'A flawless shadow.';
  if (rank === 'A') return 'The pass remembers your name.';
  if (rank === 'B') return 'The shrine stands. You survived.';
  return 'A costly victory.';
}
