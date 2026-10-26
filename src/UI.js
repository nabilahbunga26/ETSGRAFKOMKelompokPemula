import { clamp, formatTime } from './utils.js';

const $ = (id) => document.getElementById(id);

const BOSS_PHASES = ['ARMORED', 'ENRAGED', 'DESPERATE'];

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.pointerFine = window.matchMedia('(pointer: fine)').matches;
    this.lastClones = null;
    this.lastFocus = null;
    this.lastBossHp = null;
    this.announceTimer = 0;
    this.tutorialTimer = 0;
    this.warningTimer = 0;
    this.screen = 'loading';

    this.el = {
      body: document.body,
      hud: $('hud'),
      loading: $('loading'),
      menu: $('menu'),
      pause: $('pause'),
      result: $('result'),
      loadingFill: $('loading-fill'),
      loadingStatus: $('loading-status'),
      loadingPercent: $('loading-percent'),
      cloneCount: $('clone-count'),
      cloneBar: $('clone-bar'),
      cloneDelta: $('clone-delta'),
      focusValue: $('focus-value'),
      focusFill: $('focus-fill'),
      stormBtn: $('storm-btn'),
      stormSub: $('storm-sub'),
      distance: $('distance'),
      routeFill: $('route-fill'),
      routeMarker: $('route-marker'),
      routePercent: $('route-percent'),
      zoneName: $('zone-name'),
      objective: $('objective-text'),
      warning: $('warning'),
      warningText: $('warning-text'),
      bossHud: $('boss-hud'),
      bossFill: $('boss-fill'),
      bossPhase: $('boss-phase'),
      bossHp: $('boss-hp-label'),
      announce: $('announce'),
      announceKicker: $('announce-kicker'),
      announceTitle: $('announce-title'),
      announceSub: $('announce-sub'),
      tutorial: $('tutorial'),
      tutorialKey: $('tutorial-key'),
      tutorialTitle: $('tutorial-title'),
      tutorialText: $('tutorial-text'),
      cursor: $('cursor'),
      cursorTag: $('cursor-tag'),
      flash: $('flash'),
      dash: $('dash-fx'),
      sound: $('btn-sound'),
      menuSound: $('btn-menu-sound'),
      bestRun: $('best-run'),
      bestRank: $('best-rank'),
      bestDetail: $('best-detail'),
      resultKanji: $('result-kanji'),
      resultKicker: $('result-kicker'),
      resultTitle: $('result-title'),
      resultSub: $('result-sub'),
      statTime: $('stat-time'),
      statClones: $('stat-clones'),
      statSquads: $('stat-squads'),
      statCores: $('stat-cores'),
      rankLetter: $('rank-letter'),
      rankNote: $('rank-note'),
      defeatNote: $('defeat-note'),
      defeatReason: $('defeat-reason'),
      defeatTip: $('defeat-tip'),
      btnStart: $('btn-start'),
      btnRetry: $('btn-retry'),
      btnResume: $('btn-resume'),
      btnRestartPause: $('btn-restart-pause'),
      btnMenuPause: $('btn-menu-pause'),
      btnMenuResult: $('btn-menu-result'),
      btnPause: $('btn-pause'),
      touchLeft: $('touch-left'),
      touchRight: $('touch-right'),
    };
    this.setSoundMuted(audio.muted);
  }

  setLoading(progress, status) {
    const value = clamp(progress, 0, 100);
    if (this.el.loadingFill) this.el.loadingFill.style.width = `${value}%`;
    if (this.el.loadingPercent) this.el.loadingPercent.textContent = `${Math.round(value)}%`;
    if (status && this.el.loadingStatus) this.el.loadingStatus.textContent = status;
  }

  hideLoading() {
    this.el.loading.classList.add('is-hidden');
  }

  showMenu(best = null) {
    this.screen = 'menu';
    for (const key of ['loading', 'pause', 'result']) this.el[key].classList.add('is-hidden');
    this.el.menu.classList.remove('is-hidden');
    this.el.hud.classList.add('is-hidden');
    this.el.hud.setAttribute('aria-hidden', 'true');
    this.el.body.classList.remove('is-playing');
    this.hideCursor();
    this.setBestRun(best);
  }

  showRun() {
    this.screen = 'run';
    for (const key of ['loading', 'menu', 'pause', 'result']) this.el[key].classList.add('is-hidden');
    this.el.hud.classList.remove('is-hidden');
    this.el.hud.setAttribute('aria-hidden', 'false');
    this.el.body.classList.add('is-playing');
    this.el.bossHud.classList.add('hidden');
    this.el.warning.classList.add('hidden');
  }

  showPause() {
    this.screen = 'pause';
    this.el.pause.classList.remove('is-hidden');
    this.hideCursor();
  }

  hidePause() {
    this.screen = 'run';
    this.el.pause.classList.add('is-hidden');
    if (this.pointerFine) this.el.cursor.classList.remove('is-hidden');
  }

  showResult(data) {
    this.screen = 'result';
    this.el.result.classList.remove('is-hidden');
    this.el.result.classList.toggle('victory', data.victory);
    this.el.result.classList.toggle('defeat', !data.victory);
    this.el.hud.classList.add('is-hidden');
    this.el.hud.setAttribute('aria-hidden', 'true');
    this.el.body.classList.remove('is-playing');
    this.hideCursor();
    this.el.resultKanji.textContent = data.victory ? '勝' : '敗';
    this.el.resultKicker.textContent = data.victory ? 'THE PASS IS YOURS' : 'THE PASS CLAIMS ANOTHER';
    this.el.resultTitle.textContent = data.victory ? 'PASS SECURED' : 'SHADOW EXTINGUISHED';
    this.el.resultSub.textContent = data.subtitle;
    this.el.statTime.textContent = formatTime(data.time);
    this.el.statClones.textContent = String(data.clones);
    this.el.statSquads.textContent = String(data.squads);
    this.el.statCores.textContent = String(data.cores);
    this.el.rankLetter.textContent = data.rank;
    this.el.rankNote.textContent = data.rankNote;
    this.el.defeatNote.classList.toggle('is-hidden', data.victory);
    if (!data.victory) {
      this.el.defeatReason.textContent = data.reason;
      this.el.defeatTip.textContent = data.tip;
    }
    this.setBestRun(data.best);
    this.el.bossHud.classList.add('hidden');
    this.el.warning.classList.add('hidden');
  }

  setBestRun(best) {
    if (!best) {
      this.el.bestRun.classList.add('is-hidden');
      return;
    }
    this.el.bestRun.classList.remove('is-hidden');
    this.el.bestRank.textContent = best.rank || 'A';
    this.el.bestDetail.textContent = `${formatTime(best.time)} · ${best.clones} shadows`;
  }

  setClones(count, { silent = false, delta = null } = {}) {
    const next = clamp(Math.round(count), 0, 99);
    if (this.lastClones === next) return;
    const autoDelta = this.lastClones === null ? 0 : next - this.lastClones;
    const value = delta !== null ? delta : autoDelta;
    this.lastClones = next;
    this.el.cloneCount.textContent = String(next);
    this.el.cloneBar.style.width = `${clamp((next / 99) * 100, 0.5, 100)}%`;
    if (silent || value === 0) return;
    const sign = value > 0 ? '+' : '';
    this.el.cloneDelta.textContent = `${sign}${value}`;
    this.el.cloneDelta.classList.remove('show', 'bad');
    void this.el.cloneDelta.offsetWidth;
    this.el.cloneDelta.classList.toggle('bad', value < 0);
    this.el.cloneDelta.classList.add('show');
    this.el.cloneCount.classList.remove('bump');
    void this.el.cloneCount.offsetWidth;
    this.el.cloneCount.classList.add('bump');
  }

  setFocus(focus, max = 100) {
    const value = clamp(focus, 0, max);
    if (this.lastFocus === value) return;
    this.lastFocus = value;
    const ratio = value / max;
    this.el.focusValue.textContent = String(Math.floor(value));
    this.el.focusFill.style.width = `${Math.max(1, ratio * 100)}%`;
    this.el.focusFill.classList.toggle('high', value >= max);
    this.el.stormBtn.style.setProperty('--charge', String(Math.round(ratio * 100)));
    const ready = value >= 100;
    this.el.stormBtn.classList.toggle('is-ready', ready);
    this.el.stormSub.textContent = ready ? 'READY · E' : `${Math.floor(ratio * 100)}%`;
  }

  setRoute(progress, meters) {
    const p = clamp(progress, 0, 1);
    this.el.routeFill.style.width = `${p * 100}%`;
    this.el.routeMarker.style.left = `${p * 100}%`;
    this.el.routePercent.textContent = `${Math.round(p * 100)}%`;
    if (meters !== undefined) this.el.distance.textContent = `${Math.max(0, Math.round(meters))} m`;
  }

  setZone(name) {
    if (this.el.zoneName.textContent === name) return;
    this.el.zoneName.textContent = name;
  }

  setObjective(text) {
    this.el.objective.textContent = text;
  }

  setWarning(text) {
    if (!text) {
      this.el.warning.classList.add('hidden');
      return;
    }
    this.el.warningText.textContent = text;
    this.el.warning.classList.remove('hidden');
  }

  showBoss(maxHp) {
    this.el.bossHud.classList.remove('hidden');
    this.el.body.classList.add('boss-mode');
    this.setBossHp(maxHp, maxHp, 1);
  }

  hideBoss() {
    this.el.bossHud.classList.add('hidden');
    this.el.body.classList.remove('boss-mode');
  }

  setBossHp(hp, maxHp, phase) {
    const ratio = clamp(hp / maxHp, 0, 1);
    if (this.lastBossHp !== ratio) {
      this.lastBossHp = ratio;
      this.el.bossFill.style.width = `${ratio * 100}%`;
      this.el.bossHp.textContent = `${Math.ceil(hp)} / ${maxHp}`;
    }
    this.el.bossPhase.textContent = BOSS_PHASES[clamp(phase - 1, 0, 2)];
  }

  announce(kicker, title, sub = '', kind = '', duration = 2500) {
    this.el.announce.dataset.kind = kind;
    this.el.announceKicker.textContent = kicker;
    this.el.announceTitle.textContent = title;
    this.el.announceSub.textContent = sub;
    this.el.announce.classList.remove('show');
    void this.el.announce.offsetWidth;
    this.el.announce.classList.add('show');
    window.clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => {
      this.el.announce.classList.remove('show');
    }, duration);
  }

  showTutorial(key, title, text, timeout = 0) {
    this.el.tutorialKey.textContent = key;
    this.el.tutorialTitle.textContent = title;
    this.el.tutorialText.textContent = text;
    this.el.tutorial.classList.remove('is-hidden');
    window.clearTimeout(this.tutorialTimer);
    if (timeout > 0) {
      this.tutorialTimer = window.setTimeout(() => this.hideTutorial(), timeout);
    }
  }

  hideTutorial() {
    this.el.tutorial.classList.add('is-hidden');
  }

  flash(kind = 'white') {
    const el = this.el.flash;
    el.className = 'flash';
    void el.offsetWidth;
    el.classList.add(kind);
  }

  dash() {
    const el = this.el.dash;
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
    window.clearTimeout(this._dashTimer);
    this._dashTimer = window.setTimeout(() => el.classList.remove('active'), 320);
  }

  setCursor(x, y, kind = '', tag = '') {
    if (!this.pointerFine) return;
    const el = this.el.cursor;
    el.classList.remove('is-hidden', 'on-gate', 'on-squad', 'on-core', 'has-target');
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (kind) el.classList.add(`on-${kind}`);
    if (tag) {
      this.el.cursorTag.textContent = tag;
      el.classList.add('has-target');
    }
  }

  hideCursor() {
    this.el.cursor.classList.add('is-hidden');
  }

  floatText(text, x, y, kind = '') {
    const el = document.createElement('div');
    el.className = `float-text ${kind}`.trim();
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.getElementById('app').appendChild(el);
    window.setTimeout(() => el.remove(), 1150);
  }

  setSoundMuted(muted) {
    this.el.sound.classList.toggle('muted', muted);
    this.el.menuSound.classList.toggle('muted', muted);
    this.el.sound.setAttribute('aria-pressed', muted ? 'true' : 'false');
    this.el.menuSound.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }

  bind(actions) {
    const guard = (fn) => (event) => {
      if (event) event.preventDefault();
      fn();
    };
    this.el.btnStart.addEventListener('click', guard(actions.start));
    this.el.btnPause.addEventListener('click', guard(actions.pause));
    this.el.btnResume.addEventListener('click', guard(actions.resume));
    this.el.btnRestartPause.addEventListener('click', guard(actions.restart));
    this.el.btnMenuPause.addEventListener('click', guard(actions.menu));
    this.el.btnRetry.addEventListener('click', guard(actions.retry));
    this.el.btnMenuResult.addEventListener('click', guard(actions.menu));
    this.el.sound.addEventListener('click', guard(actions.sound));
    this.el.menuSound.addEventListener('click', guard(actions.sound));
    this.el.stormBtn.addEventListener('click', guard(actions.storm));

    const bindSteer = (el, axis) => {
      const down = (event) => {
        event.preventDefault();
        actions.steer(axis, true);
      };
      const up = () => actions.steer(axis, false);
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
    };
    bindSteer(this.el.touchLeft, -1);
    bindSteer(this.el.touchRight, 1);

    for (const id of ['btn-start', 'btn-pause', 'btn-resume', 'storm-btn', 'btn-retry', 'btn-sound', 'btn-menu-sound']) {
      const el = $(id);
      if (el) el.addEventListener('pointerdown', (event) => event.stopPropagation());
    }
  }
}
