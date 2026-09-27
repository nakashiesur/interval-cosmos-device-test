const APP_VERSION = `ver.${window.IntervalCosmosVersion || '2.0.4'}`;
const CLOUD_CONFIG = window.INTERVAL_COSMOS_CLOUD || {};
const cloud = window.IntervalCosmosCloud || null;

const INTERVALS = Object.freeze([
  { key: 'P1', n: 1, semitones: 0, jp: '完全1度', compact: '同音', formula: '0半音' },
  { key: 'm2', n: 2, semitones: 1, jp: '短2度', compact: '短2', formula: '1半音' },
  { key: 'M2', n: 2, semitones: 2, jp: '長2度', compact: '長2', formula: '2半音' },
  { key: 'm3', n: 3, semitones: 3, jp: '短3度', compact: '短3', formula: '3半音' },
  { key: 'M3', n: 3, semitones: 4, jp: '長3度', compact: '長3', formula: '4半音' },
  { key: 'P4', n: 4, semitones: 5, jp: '完全4度', compact: '完4', formula: '5半音' },
  { key: 'TT', n: 4, semitones: 6, jp: '三全音', compact: 'TT', formula: '6半音' },
  { key: 'P5', n: 5, semitones: 7, jp: '完全5度', compact: '完5', formula: '7半音' },
  { key: 'm6', n: 6, semitones: 8, jp: '短6度', compact: '短6', formula: '8半音' },
  { key: 'M6', n: 6, semitones: 9, jp: '長6度', compact: '長6', formula: '9半音' },
  { key: 'm7', n: 7, semitones: 10, jp: '短7度', compact: '短7', formula: '10半音' },
  { key: 'M7', n: 7, semitones: 11, jp: '長7度', compact: '長7', formula: '11半音' },
  { key: 'P8', n: 8, semitones: 12, jp: '完全8度', compact: '完8', formula: '12半音' },
]);

const INTERVAL_MAP = Object.fromEntries(INTERVALS.map(i => [i.key, i]));
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NAT_PCS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'q', 'w', 'e'];
const STORAGE = {
  settings: 'intervalCosmos.settings.v2',
  mastery: 'intervalCosmos.mastery.v2',
  guideSeen: 'intervalCosmos.guideSeen.v1',
};

const MODE_DEFS = {
  orbitText: { title: 'STANDARD / TEXT', view: 'text', duration: 60, scored: true, ranked: true },
  orbitKeys: { title: 'STANDARD / KEYS', view: 'keys', duration: 60, scored: true, ranked: true },
  hyperText: { title: 'HYPER DRIVE / TEXT', view: 'text', duration: 75, scored: true, ranked: true, hyper: true },
  hyperKeys: { title: 'HYPER DRIVE / KEYS', view: 'keys', duration: 75, scored: true, ranked: true, hyper: true },
  earLink: { title: 'EAR LINK', view: 'ear', duration: 60, scored: true, ranked: true, ear: true },
  unlimitedText: { title: 'UNLIMITED / TEXT', view: 'text', unlimited: true, scored: false, practice: true },
  unlimitedKeys: { title: 'UNLIMITED / KEYS', view: 'keys', unlimited: true, scored: false, practice: true },
  unlimitedEar: { title: 'UNLIMITED / EAR', view: 'ear', unlimited: true, scored: false, practice: true, ear: true },
  manualText: { title: 'FOCUS / TEXT', view: 'text', unlimited: true, scored: false, practice: true, manual: true },
  manualKeys: { title: 'FOCUS / KEYS', view: 'keys', unlimited: true, scored: false, practice: true, manual: true },
  manualEar: { title: 'FOCUS / EAR', view: 'ear', unlimited: true, scored: false, practice: true, manual: true, ear: true },
  autoText: { title: 'ADAPTIVE / TEXT', view: 'text', unlimited: true, scored: false, practice: true, adaptive: true },
  autoKeys: { title: 'ADAPTIVE / KEYS', view: 'keys', unlimited: true, scored: false, practice: true, adaptive: true },
  autoEar: { title: 'ADAPTIVE / EAR', view: 'ear', unlimited: true, scored: false, practice: true, adaptive: true, ear: true },
};

const RANKING_MODES = Object.freeze([
  { id: 'orbitText', key: 'TEXT', label: 'TEXT' },
  { id: 'orbitKeys', key: 'KEYS', label: 'KEYS' },
  { id: 'hyperText', key: 'HD_TEXT', label: 'HD TEXT' },
  { id: 'hyperKeys', key: 'HD_KEYS', label: 'HD KEYS' },
  { id: 'earLink', key: 'EAR_LINK', label: 'EAR' },
]);
const AVATARS = ['🚀','⭐','🌟','💫','⚡','🔥','🌙','🌌','💎','🎵','🎸','🎹','🎺','🥁','🎻'];

const defaultSettings = {
  sound: true,
  volume: 0.72,
  audioStyle: 'melodic', // melodic | harmonic | both
  bothOrder: 'harmonicFirst', // harmonicFirst | melodicFirst
  autoPlay: true,
};

function safeParse(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function loadSettings() {
  const stored = safeParse(localStorage.getItem(STORAGE.settings), {});
  return {
    sound: typeof stored.sound === 'boolean' ? stored.sound : defaultSettings.sound,
    volume: Number.isFinite(Number(stored.volume)) ? clamp(Number(stored.volume), 0, 1) : defaultSettings.volume,
    audioStyle: ['melodic', 'harmonic', 'both'].includes(stored.audioStyle) ? stored.audioStyle : defaultSettings.audioStyle,
    bothOrder: ['harmonicFirst', 'melodicFirst'].includes(stored.bothOrder) ? stored.bothOrder : defaultSettings.bothOrder,
    autoPlay: typeof stored.autoPlay === 'boolean' ? stored.autoPlay : defaultSettings.autoPlay,
  };
}

function freshMastery() {
  return Object.fromEntries(INTERVALS.map(iv => [iv.key, {
    seen: 0,
    correct: 0,
    wrong: 0,
    emaMs: 0,
    streak: 0,
    lastSeen: 0,
    confusions: {},
  }]));
}

function loadMastery() {
  const stored = safeParse(localStorage.getItem(STORAGE.mastery), {});
  const base = freshMastery();
  for (const iv of INTERVALS) base[iv.key] = { ...base[iv.key], ...(stored[iv.key] || {}) };
  return base;
}

const state = {
  screen: 'splash',
  phase: 'idle',
  modeId: null,
  question: null,
  previousKey: null,
  selectedIntervals: new Set(INTERVALS.map(i => i.key)),
  practiceView: 'text',
  answerLabelLang: Math.random() < 0.5 ? 'jp' : 'symbol',
  guideSeen: localStorage.getItem(STORAGE.guideSeen) === '1',
  countdownValue: '',
  settings: loadSettings(),
  mastery: loadMastery(),
  showSettings: false,
  showRecords: false,
  showPlayerSetup: false,
  locked: false,
  revealAnswer: false,
  flash: null,
  feedback: '',
  sessionId: 0,
  game: null,
  cloudStatus: cloud?.configured?.() ? 'connecting' : 'unconfigured',
  cloudError: '',
  cloudUserId: null,
  profile: null,
  playerDraft: '',
  studentNumberDraft: '',
  playerAvatar: '🌟',
  rankingScope: 'monthly',
  rankingMode: 'TEXT',
  rankingRows: [],
  rankingPeriod: '',
  rankingLoading: false,
  rankingError: '',
  rankingSubmit: null,
  pendingScore: null,
};

const app = document.querySelector('#app');
const overlayRoot = document.querySelector('#overlay-root');

function saveSettings() {
  localStorage.setItem(STORAGE.settings, JSON.stringify(state.settings));
}
function saveMastery() { localStorage.setItem(STORAGE.mastery, JSON.stringify(state.mastery)); }

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function mod(n, m) { return ((n % m) + m) % m; }
function accidentalString(acc) { return acc === 2 ? '𝄪' : acc === 1 ? '♯' : acc === -1 ? '♭' : acc === -2 ? '𝄫' : ''; }
function noteString(letter, acc, octaveMark = '') { return `${letter}${accidentalString(acc)}${octaveMark}`; }
function formatNumber(n) { return Math.round(n).toLocaleString('ja-JP'); }
function mode() { return MODE_DEFS[state.modeId] || null; }
function rankingKeyForMode(modeId = state.modeId) {
  return RANKING_MODES.find(item => item.id === modeId)?.key || null;
}
function subscriptNumber(value) {
  const map = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','-':'₋' };
  return String(value).split('').map(char => map[char] || char).join('');
}
function displayNote(note, midi, intervalKey) {
  return intervalKey === 'P8' ? `${note}${subscriptNumber(Math.floor(midi / 12) - 1)}` : note;
}
function cloudStatusLabel() {
  if (state.cloudStatus === 'offline') return 'OFFLINE · 端末に保存';
  if (state.cloudStatus === 'ready') return 'ONLINE';
  if (state.cloudStatus === 'connecting') return 'CONNECTING';
  if (state.cloudStatus === 'error') return 'CONNECTION ERROR';
  return 'SETUP REQUIRED';
}

function realizeInterval(baseLetter, baseAcc, interval, direction) {
  const baseIndex = LETTERS.indexOf(baseLetter);
  const steps = interval.n - 1;
  const targetIndex = mod(baseIndex + (direction === 'up' ? steps : -steps), LETTERS.length);
  const targetLetter = LETTERS[targetIndex];
  const basePc = mod(NAT_PCS[baseLetter] + baseAcc, 12);
  const wanted = mod(basePc + (direction === 'up' ? interval.semitones : -interval.semitones), 12);
  let acc = wanted - NAT_PCS[targetLetter];
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  if (Math.abs(acc) > 1) return null; // 読みやすさ優先。理論上正しい単一変化記号の問題のみ採用。
  return { targetLetter, targetAcc: acc };
}

function chooseDirection() {
  return 'up';
}

function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items.at(-1);
}

function adaptiveInterval(keys) {
  const now = Date.now();
  const items = keys.map(k => INTERVAL_MAP[k]).filter(Boolean);
  const weights = items.map(iv => {
    const m = state.mastery[iv.key];
    const errorRate = m.seen ? m.wrong / m.seen : 0.55;
    const latencyPenalty = m.emaMs ? clamp((m.emaMs - 1600) / 4200, 0, 1.6) : 0.7;
    const recencyHours = m.lastSeen ? (now - m.lastSeen) / 3_600_000 : 999;
    const due = clamp(recencyHours / 18, 0.15, 1.8);
    const streakRelief = clamp(m.streak / 6, 0, 0.65);
    const immediatePenalty = state.previousKey === iv.key && m.streak > 0 ? 0.45 : 1;
    return Math.max(0.2, (1 + errorRate * 5 + latencyPenalty * 1.8 + due - streakRelief) * immediatePenalty);
  });
  return weightedPick(items, weights);
}

function normalInterval(keys) {
  const candidates = keys.map(k => INTERVAL_MAP[k]).filter(Boolean);
  if (candidates.length > 1 && state.previousKey) {
    const filtered = candidates.filter(i => i.key !== state.previousKey);
    if (filtered.length && Math.random() < 0.72) return pick(filtered);
  }
  return pick(candidates);
}

function midiForPcInRange(pc, min = 54, max = 69) {
  const candidates = [];
  for (let midi = min; midi <= max; midi++) if (mod(midi, 12) === pc) candidates.push(midi);
  return pick(candidates.length ? candidates : [60 + pc]);
}

function buildQuestion() {
  const def = mode();
  const keys = def?.manual ? [...state.selectedIntervals] : INTERVALS.map(i => i.key);
  const chosen = def?.adaptive ? adaptiveInterval(keys) : normalInterval(keys);
  for (let attempt = 0; attempt < 240; attempt++) {
    const interval = attempt === 0 ? chosen : (def?.adaptive ? adaptiveInterval(keys) : normalInterval(keys));
    const direction = chooseDirection();
    const baseLetter = pick(LETTERS);
    const baseAcc = pick([0, 0, 0, 0, -1, 1]);
    const realized = realizeInterval(baseLetter, baseAcc, interval, direction);
    if (!realized) continue;
    const basePc = mod(NAT_PCS[baseLetter] + baseAcc, 12);
    let baseMidi = midiForPcInRange(basePc);
    let targetMidi = baseMidi + (direction === 'up' ? interval.semitones : -interval.semitones);
    if (targetMidi < 48 || targetMidi > 81) {
      baseMidi += targetMidi < 48 ? 12 : -12;
      targetMidi = baseMidi + (direction === 'up' ? interval.semitones : -interval.semitones);
    }
    const octaveMark = '';
    return {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      intervalKey: interval.key,
      direction,
      base: noteString(baseLetter, baseAcc),
      target: noteString(realized.targetLetter, realized.targetAcc, octaveMark),
      baseLetter,
      baseAcc,
      targetLetter: realized.targetLetter,
      targetAcc: realized.targetAcc,
      baseMidi,
      targetMidi,
    };
  }
  return { id: String(Date.now()), intervalKey: 'M3', direction: 'up', base: 'C', target: 'E', baseMidi: 60, targetMidi: 64 };
}

class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.generation = 0;
    const release = () => this.release();
    window.addEventListener('pagehide', release);
    document.addEventListener?.('visibilitychange', () => { if (document.hidden) release(); });
  }
  release() {
    this.stopPending();
    const old = this.ctx;
    this.ctx = null; this.master = null;
    if (old && old.state !== 'closed') old.close().catch(() => {});
  }
  async unlock() {
    if (document.hidden) return false;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = state.settings.volume;
      this.master.connect(this.ctx.destination);
    }
    // Safari uses interrupted after another app takes the audio session.
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.master.gain.setTargetAtTime(state.settings.volume, this.ctx.currentTime, 0.02);
  }
  setVolume(value) {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
  }
  stopPending() { this.generation += 1; }
  tone(midi, when, duration = 0.62, strength = 1) {
    if (!this.ctx || !this.master) return;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const partials = [
      { ratio: 1, type: 'sine', gain: 0.24 },
      { ratio: 2, type: 'sine', gain: 0.065 },
      { ratio: 3, type: 'triangle', gain: 0.025 },
    ];
    partials.forEach((p, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = p.type;
      osc.frequency.setValueAtTime(freq * p.ratio, when);
      if (index === 0) osc.detune.setValueAtTime(-1.5, when);
      const peak = p.gain * strength;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.018);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.32), when + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      osc.connect(gain).connect(this.master);
      osc.start(when);
      osc.stop(when + duration + 0.05);
    });
  }
  playMelodic(question, when) {
    this.tone(question.baseMidi, when, 0.58, 0.92);
    this.tone(question.targetMidi, when + 0.48, 0.70, 0.98);
  }
  playHarmonic(question, when) {
    this.tone(question.baseMidi, when, 0.90, 0.82);
    this.tone(question.targetMidi, when, 0.90, 0.82);
  }
  async playInterval(question, style = state.settings.audioStyle) {
    if (!state.settings.sound || !question) return;
    if (await this.unlock() === false) return;
    const token = ++this.generation;
    const now = this.ctx.currentTime + 0.035;

    if (style === 'harmonic') {
      this.playHarmonic(question, now);
      return;
    }
    if (style === 'melodic') {
      this.playMelodic(question, now);
      return;
    }

    // BOTH: 選択された順番で2種類を続けて再生。初期値は HARMONIC → MELODIC。
    if (state.settings.bothOrder === 'melodicFirst') {
      this.playMelodic(question, now);
      window.setTimeout(() => {
        if (token !== this.generation || !this.ctx) return;
        this.playHarmonic(question, this.ctx.currentTime + 0.02);
      }, 1120);
      return;
    }

    this.playHarmonic(question, now);
    window.setTimeout(() => {
      if (token !== this.generation || !this.ctx) return;
      this.playMelodic(question, this.ctx.currentTime + 0.02);
    }, 980);
  }
}
const audio = new AudioEngine();

class Starfield {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.stars = [];
    this.maxRadius = 1;
    this.intensity = 0;
    this.phase = 'idle';
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    requestAnimationFrame(() => this.frame());
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.canvas.style.width = `${innerWidth}px`;
    this.canvas.style.height = `${innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.maxRadius = Math.hypot(innerWidth / 2, innerHeight / 2);
    const count = Math.min(420, Math.max(180, Math.round(innerWidth * innerHeight / 4500)));
    this.stars = Array.from({ length: count }, () => this.makeStar(Math.random() * this.maxRadius));
    this.ctx.fillStyle = '#070914';
    this.ctx.fillRect(0, 0, innerWidth, innerHeight);
  }
  makeStar(radius = Math.random() * this.maxRadius) {
    return { angle: Math.random() * Math.PI * 2, radius, size: 0.45 + Math.random() * 1.35, hue: Math.random() };
  }
  set(score = 0, combo = 0, phase = 'idle') {
    this.intensity = clamp(score / 3500 + combo / 70, 0, 2.2);
    this.phase = phase;
  }
  color(star) {
    if (this.phase !== 'running' || this.intensity < 0.22) return 'rgba(238,246,255,.86)';
    const threshold = Math.min(.72, .14 + this.intensity * .24);
    if (star.hue > threshold) return 'rgba(238,246,255,.9)';
    if (star.hue < threshold * .34) return 'rgba(80,220,255,.95)';
    if (star.hue < threshold * .68) return 'rgba(255,93,184,.9)';
    return 'rgba(255,209,102,.92)';
  }
  frame() {
    const w = innerWidth, h = innerHeight;
    this.ctx.fillStyle = 'rgba(7,9,20,.23)';
    this.ctx.fillRect(0, 0, w, h);
    const baseSpeed = 0.06 + this.intensity * 0.52;
    for (const star of this.stars) {
      star.radius += baseSpeed * (1 + (star.radius / this.maxRadius) * 2.3);
      if (star.radius > this.maxRadius) Object.assign(star, this.makeStar(Math.random() * 10));
      const ratio = star.radius / this.maxRadius;
      const x = w / 2 + Math.cos(star.angle) * star.radius;
      const y = h / 2 + Math.sin(star.angle) * star.radius;
      const size = Math.max(.25, star.size * ratio * (1 + this.intensity * .15));
      this.ctx.fillStyle = this.color(star);
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    requestAnimationFrame(() => this.frame());
  }
}
const starfield = new Starfield(document.querySelector('#starfield'));

function gameTemplate() {
  return {
    score: 0,
    displayedFinalScore: 0,
    timeLeft: mode()?.duration ?? Infinity,
    duration: mode()?.duration ?? Infinity,
    combo: 0,
    maxCombo: 0,
    total: 0,
    correct: 0,
    responseTimes: [],
    mistakes: [],
    answers: Object.fromEntries(INTERVALS.map(i => [i.key, { seen: 0, correct: 0, ms: [] }])),
    confusions: {},
    startedAt: 0,
    lastTick: 0,
    questionStartedAt: 0,
    endedAt: 0,
    finalized: false,
    onlineSubmitted: false,
  };
}

function calcPoints(seconds, ok, combo) {
  if (!ok) return -50;
  const base = seconds <= 1 ? 150 : seconds <= 2 ? 130 : seconds <= 3 ? 120 : seconds <= 4 ? 110 : seconds <= 5 ? 100 : seconds <= 8 ? 80 : seconds <= 10 ? 60 : 50;
  return base + Math.min(combo * 5, 150);
}

function accuracyBonus(acc) {
  if (acc === 100) return 3000;
  if (acc >= 95) return 1000;
  if (acc >= 90) return 500;
  if (acc >= 85) return 300;
  if (acc >= 80) return 200;
  return 0;
}

function currentFinalScore() {
  if (!state.game) return 0;
  const def = mode();
  const acc = state.game.total ? Math.round(state.game.correct / state.game.total * 100) : 0;
  return Math.max(0, Math.round(state.game.score + (def?.hyper ? state.game.maxCombo * 50 + accuracyBonus(acc) : 0)));
}

function updateMastery(correctKey, chosenKey, ok, takenMs) {
  const m = state.mastery[correctKey];
  m.seen += 1;
  m.lastSeen = Date.now();
  m.emaMs = m.emaMs ? Math.round(m.emaMs * 0.72 + takenMs * 0.28) : Math.round(takenMs);
  if (ok) {
    m.correct += 1;
    m.streak += 1;
  } else {
    m.wrong += 1;
    m.streak = 0;
    m.confusions[chosenKey] = (m.confusions[chosenKey] || 0) + 1;
  }
  saveMastery();
  window.IntervalCosmosLearningSync?.record(correctKey, chosenKey, takenMs);
}

function masteryScore(key) {
  const m = state.mastery[key];
  if (!m.seen) return 0;
  const accuracy = m.correct / m.seen;
  const speed = m.emaMs ? clamp(1 - (m.emaMs - 1200) / 5200, 0, 1) : 0;
  const confidence = clamp(m.seen / 18, .2, 1);
  return Math.round((accuracy * .76 + speed * .24) * confidence * 100);
}


function resetTransient() {
  state.locked = false;
  state.revealAnswer = false;
  state.flash = null;
  state.feedback = '';
  state.countdownValue = '';
}

function goHome() {
  state.sessionId += 1;
  audio.stopPending();
  state.screen = 'home';
  state.phase = 'idle';
  state.modeId = null;
  state.question = null;
  state.game = null;
  resetTransient();
  starfield.set(0, 0, 'idle');
  render();
}

function openMode(modeId, immediate = false) {
  state.sessionId += 1;
  state.modeId = modeId;
  state.game = gameTemplate();
  state.question = buildQuestion();
  state.previousKey = null;
  state.answerLabelLang = Math.random() < 0.5 ? 'jp' : 'symbol';
  state.screen = 'play';
  state.phase = immediate ? 'running' : 'idle';
  resetTransient();
  render();
  if (immediate) beginRunning();
}

function startCountdown() {
  if (state.phase !== 'idle') return;
  audio.unlock().catch(() => {});
  state.phase = 'countdown';
  const session = state.sessionId;
  const sequence = ['3', '2', '1', 'START'];
  let index = 0;
  const step = () => {
    if (session !== state.sessionId || state.phase !== 'countdown') return;
    state.countdownValue = sequence[index];
    render();
    index += 1;
    if (index < sequence.length) window.setTimeout(step, 820);
    else window.setTimeout(() => {
      if (session === state.sessionId) beginRunning();
    }, 620);
  };
  step();
}

function beginRunning() {
  state.phase = 'running';
  state.countdownValue = '';
  const now = performance.now();
  state.game.startedAt ||= now;
  state.game.lastTick = now;
  state.game.questionStartedAt = now;
  render();
  scheduleQuestionAudio();
  requestAnimationFrame(gameLoop);
}

function gameLoop(now) {
  if (state.phase !== 'running' || !state.game) return;
  const def = mode();
  const dt = Math.min(.25, (now - state.game.lastTick) / 1000);
  state.game.lastTick = now;
  if (!def.unlimited) {
    state.game.timeLeft = Math.max(0, state.game.timeLeft - dt);
    updateTimerDOM();
    if (state.game.timeLeft <= 0) {
      endGame();
      return;
    }
  }
  starfield.set(state.game.score, state.game.combo, 'running');
  requestAnimationFrame(gameLoop);
}

function updateTimerDOM() {
  const text = document.querySelector('#timerText');
  const progress = document.querySelector('#timerProgress');
  if (!text || !state.game) return;
  const def = mode();
  if (def.unlimited) {
    text.textContent = '∞';
  } else {
    text.textContent = String(Math.ceil(state.game.timeLeft));
    const circumference = 2 * Math.PI * 25;
    const ratio = clamp(state.game.timeLeft / state.game.duration, 0, 1);
    progress?.setAttribute('stroke-dashoffset', String(circumference * (1 - ratio)));
    document.querySelector('.play-screen')?.classList.toggle('danger-vignette', state.game.timeLeft <= 10);
  }
}

function scheduleQuestionAudio(delay = 220) {
  if (!state.settings.autoPlay || !state.settings.sound || !state.question || state.phase !== 'running') return;
  const id = state.question.id;
  window.setTimeout(() => {
    if (state.question?.id === id && state.phase === 'running') audio.playInterval(state.question).catch(() => {});
  }, delay);
}

function answerQuestion(chosenKey) {
  if (state.phase !== 'running' || state.locked || !state.question || !state.game) return;
  const q = state.question;
  const def = mode();
  const now = performance.now();
  const takenMs = Math.max(80, now - state.game.questionStartedAt);
  const taken = takenMs / 1000;
  const ok = chosenKey === q.intervalKey;
  const delta = def.scored ? calcPoints(taken, ok, ok ? state.game.combo : 0) : 0;
  const newCombo = ok ? state.game.combo + 1 : 0;

  state.game.total += 1;
  state.game.correct += ok ? 1 : 0;
  state.game.combo = newCombo;
  state.game.maxCombo = Math.max(state.game.maxCombo, newCombo);
  state.game.responseTimes.push(taken);
  state.game.answers[q.intervalKey].seen += 1;
  state.game.answers[q.intervalKey].correct += ok ? 1 : 0;
  state.game.answers[q.intervalKey].ms.push(takenMs);
  if (!ok) {
    state.game.mistakes.push(q.intervalKey);
    const pair = `${q.intervalKey}→${chosenKey}`;
    state.game.confusions[pair] = (state.game.confusions[pair] || 0) + 1;
  }
  if (def.scored) state.game.score = Math.max(-9999, state.game.score + delta);
  updateMastery(q.intervalKey, chosenKey, ok, takenMs);

  let timeBonus = 0;
  if (def.hyper && ok && newCombo > 0 && newCombo % 10 === 0) {
    timeBonus = 3;
    state.game.timeLeft += timeBonus;
    showComboBurst(newCombo, delta, timeBonus);
  } else if (def.scored) {
    showScoreFloater(delta);
  }

  const iv = INTERVAL_MAP[q.intervalKey];
  state.flash = { key: chosenKey, status: ok ? 'correct' : 'wrong' };
  state.feedback = ok
    ? `<strong class="ok">CORRECT</strong>　${iv.jp} = ${iv.formula}　${taken.toFixed(2)}s`
    : `<strong class="ng">${INTERVAL_MAP[chosenKey].jp}</strong> ではなく <strong class="ok">${iv.jp}</strong>（${iv.formula}）`;
  state.locked = true;
  state.revealAnswer = true;
  render();

  if (!ok && state.settings.sound) {
    window.setTimeout(() => audio.playInterval(q, 'both').catch(() => {}), 100);
  }

  const session = state.sessionId;
  const delay = ok ? 360 : 780;
  window.setTimeout(() => {
    if (session !== state.sessionId || state.phase !== 'running') return;
    state.previousKey = q.intervalKey;
    state.question = buildQuestion();
    state.answerLabelLang = Math.random() < 0.5 ? 'jp' : 'symbol';
    state.game.questionStartedAt = performance.now();
    state.locked = false;
    state.revealAnswer = false;
    state.flash = null;
    render();
    scheduleQuestionAudio(150);
  }, delay);
}

function endGame() {
  if (!state.game || state.game.finalized) return;
  state.game.finalized = true;
  state.game.endedAt = performance.now();
  state.phase = 'ending';
  audio.stopPending();
  const finalScore = currentFinalScore();
  if (state.profile?.is_guest) window.IntervalCosmosGuestSessions?.save({
    mode: rankingKeyForMode() || state.modeId, score: finalScore,
    total_answers: state.game.total, correct_answers: state.game.correct,
    max_combo: state.game.maxCombo, played_at: new Date().toISOString()
  });
  state.rankingSubmit = mode()?.ranked ? { status: 'preparing' } : null;
  state.screen = 'result';
  starfield.set(finalScore, state.game.maxCombo, 'result');
  render();
  animateResultScore(finalScore);
  if (mode()?.ranked) submitOnlineScore(finalScore);
}

async function submitOnlineScore(finalScore) {
  if (!state.game || state.game.onlineSubmitted) return;
  state.game.onlineSubmitted = true;
  const knownPlayer = state.profile && !state.profile.is_guest && (state.profile.id || state.profile.player_id);
  if (!cloud || (!['ready','offline'].includes(state.cloudStatus) && !knownPlayer)) {
    state.rankingSubmit = { status: 'unavailable' };
    if (state.screen === 'result') render();
    return;
  }
  if (!state.profile) {
    state.pendingScore = finalScore;
    state.rankingSubmit = { status: 'profile_required' };
    state.showPlayerSetup = true;
    render();
    return;
  }
  const rankMode = rankingKeyForMode();
  if (!rankMode) return;
  const avg = state.game.responseTimes.length
    ? state.game.responseTimes.reduce((a, b) => a + b, 0) / state.game.responseTimes.length
    : 0;
  state.rankingSubmit = { status: 'sending' };
  if (state.screen === 'result') render();
  try {
    const result = await cloud.submitScore({
      mode: rankMode,
      score: finalScore,
      totalAnswers: state.game.total,
      correctAnswers: state.game.correct,
      maxCombo: state.game.maxCombo,
      avgResponse: avg,
    });
    state.rankingSubmit = { status: result?.queued ? 'queued' : 'done', ...(result || {}) };
    if (state.screen === 'result') {
      render();
      animateResultScore(finalScore);
      const bestRank = Math.min(Number(result?.monthly_rank || 9999), Number(result?.hall_rank || 9999));
      if (bestRank <= 50) showRankBurst(bestRank, finalScore, result);
    }
  } catch (error) {
    console.error(error);
    state.rankingSubmit = { status: 'error', message: error.message || 'ランキング送信に失敗しました。' };
    if (state.screen === 'result') render();
  }
}

function showRankBurst(rank, score, result) {
  const node = document.createElement('div');
  node.className = 'rank-burst';
  node.innerHTML = `<div class="rank-burst-rings"></div><div class="rank-burst-copy"><div class="rank-burst-kicker">RANK IN</div><div class="rank-burst-rank">${rank}<span>${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}</span></div><div class="rank-burst-score">${formatNumber(score)} pts</div></div>`;
  overlayRoot.append(node);
  const awaitingChoice = window.IntervalCosmosRankingPrivacy?.mountBurst?.(node, result);
  if (!awaitingChoice) window.setTimeout(() => node.remove(), 2300);
}

function showScoreFloater(delta) {
  const node = document.createElement('div');
  node.className = `score-floater ${delta >= 0 ? 'positive' : 'negative'}`;
  node.style.left = '50%';
  node.style.top = '42%';
  node.textContent = `${delta > 0 ? '+' : ''}${delta}`;
  overlayRoot.append(node);
  window.setTimeout(() => node.remove(), 1200);
}

function showComboBurst(combo, delta, seconds) {
  const node = document.createElement('div');
  node.className = 'combo-burst';
  node.innerHTML = `<div><div class="num">${combo}</div><div class="word">COMBO</div><div class="bonus">+${delta} SCORE　+${seconds}s</div></div>`;
  overlayRoot.append(node);
  window.setTimeout(() => node.remove(), 1600);
}

function toast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  overlayRoot.append(node);
  window.setTimeout(() => node.remove(), 2250);
}

function animateResultScore(target) {
  const el = document.querySelector('#resultScore');
  if (!el) return;
  el.textContent = '0';
  const start = performance.now();
  const duration = 1450;
  const frame = now => {
    const t = clamp((now - start) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 4);
    el.textContent = formatNumber(target * eased);
    if (t < 1 && state.screen === 'result') requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function keyboardSVG(question) {
  if (!question) return '';
  const whiteW = 44, whiteH = 120, margin = 12, blackH = 74;
  const width = margin * 2 + whiteW * 14;
  const pcWhite = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
  const blackPairs = { 1: [0, 1], 3: [1, 2], 6: [3, 4], 8: [4, 5], 10: [5, 6] };
  const whiteCenters = Array.from({ length: 14 }, (_, i) => margin + whiteW / 2 + i * whiteW);
  const lowMidi = Math.floor(Math.min(question.baseMidi, question.targetMidi) / 12) * 12;
  const xForMidi = midi => {
    const idx = midi - lowMidi;
    const oct = clamp(Math.floor(idx / 12), 0, 1);
    const pc = mod(midi, 12);
    if (pc in pcWhite) return whiteCenters[pcWhite[pc] + oct * 7];
    const [l, r] = blackPairs[pc];
    return (whiteCenters[l + oct * 7] + whiteCenters[r + oct * 7]) / 2 + 1;
  };
  const isWhite = midi => mod(midi, 12) in pcWhite;
  const markers = [];
  const same = question.baseMidi === question.targetMidi;
  const marker = (midi, color, dx = 0) => {
    const white = isWhite(midi);
    return `<circle class="key-marker" cx="${xForMidi(midi) + dx}" cy="${white ? 104 : 69}" r="10" fill="${color}" stroke="#fff" stroke-width="2" />`;
  };
  if (same) {
    markers.push(marker(question.baseMidi, '#2fc8ff', -8), marker(question.targetMidi, '#ff4fa7', 8));
  } else {
    markers.push(marker(question.baseMidi, '#2fc8ff'), marker(question.targetMidi, '#ff4fa7'));
  }
  const whiteKeys = Array.from({ length: 14 }, (_, i) => `<rect x="${margin + i * whiteW}" y="8" width="${whiteW - 2}" height="${whiteH}" rx="5" fill="url(#whiteKey)" stroke="#687084" stroke-width="1" />`).join('');
  let blackKeys = '';
  for (let oct = 0; oct < 2; oct++) {
    for (const pc of [1, 3, 6, 8, 10]) {
      const dummyMidi = lowMidi + oct * 12 + pc;
      blackKeys += `<rect x="${xForMidi(dummyMidi) - 12}" y="8" width="24" height="${blackH}" rx="4" fill="url(#blackKey)" stroke="#05060b" />`;
    }
  }
  return `<div class="keyboard-wrap"><svg class="keyboard-svg" viewBox="0 0 ${width} 136" role="img" aria-label="2オクターブ鍵盤上の2音">
    <defs>
      <linearGradient id="whiteKey" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f8fbff"/><stop offset="1" stop-color="#b8c1cf"/></linearGradient>
      <linearGradient id="blackKey" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#30384b"/><stop offset="1" stop-color="#05070d"/></linearGradient>
      <filter id="keyboardGlow"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect x="1" y="1" width="${width - 2}" height="134" rx="14" fill="rgba(8,13,31,.8)" stroke="rgba(80,220,255,.25)" />
    ${whiteKeys}${blackKeys}<g filter="url(#keyboardGlow)">${markers.join('')}</g>
  </svg></div>`;
}

function timerRingHTML() {
  const circumference = 2 * Math.PI * 25;
  const def = mode();
  const ratio = def?.unlimited ? 1 : clamp(state.game.timeLeft / state.game.duration, 0, 1);
  return `<div class="timer-ring">
    <svg viewBox="0 0 58 58" aria-hidden="true"><defs><linearGradient id="timerGradient"><stop stop-color="#ff5db8"/><stop offset="1" stop-color="#50dcff"/></linearGradient></defs>
      <circle class="track" cx="29" cy="29" r="25"></circle>
      <circle id="timerProgress" class="progress" cx="29" cy="29" r="25" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - ratio)}"></circle>
    </svg><div id="timerText" class="timer-text">${def?.unlimited ? '∞' : Math.ceil(state.game.timeLeft)}</div>
  </div>`;
}

function answerButtonsHTML() {
  const groups = [['P1'], ['m2','M2'], ['m3','M3'], ['P4','TT','P5'], ['m6','M6'], ['m7','M7'], ['P8']];
  const lang = state.answerLabelLang === 'symbol' ? 'symbol' : 'jp';
  return `<div class="answer-rows">${groups.map(group => `<div class="answer-row cols-${group.length}">${group.map(key => {
    const iv = INTERVAL_MAP[key];
    const flash = state.flash?.key === iv.key ? state.flash.status : '';
    const display = lang === 'symbol' ? iv.key : iv.jp;
    return `<button class="answer-btn answer-btn-large ${flash}" data-answer="${iv.key}" ${state.locked || state.phase !== 'running' ? 'disabled' : ''} aria-label="${iv.jp}"><span class="answer-main">${display}</span></button>`;
  }).join('')}</div>`).join('')}</div>`;
}

function questionHTML() {
  const q = state.question;
  const def = mode();
  if (state.phase === 'idle') {
    const readyMode = def.hyper ? def.title : def.ear ? 'EAR LINK' : def.practice ? def.title : def.title.replace('STANDARD /', 'STANDARD /');
    return `<div class="question-card glass ${def.hyper ? 'question-card-hyper' : ''}"><p class="question-label">READY</p><h2 class="ready-title">${readyMode}</h2><p class="ready-copy">問題を見た瞬間に、音程名と響きを結びつける。</p><button class="primary-btn ${def.hyper ? 'hyper hyper-launch' : ''}" data-action="start-countdown">GAME START</button></div>`;
  }
  if (!q) return '';
  const baseDisplay = displayNote(q.base, q.baseMidi, q.intervalKey);
  const targetDisplay = displayNote(q.target, q.targetMidi, q.intervalKey);
  let main = '';
  if (def.view === 'keys') {
    main = keyboardSVG(q);
  } else if (def.view === 'ear') {
    const hidden = !state.revealAnswer;
    main = `<div class="ear-prompt"><span class="ear-wave"><i></i><i></i><i></i><i></i><i></i></span><strong>LISTEN</strong><small>音だけで判定</small></div><div class="note-question note-pair ${hidden ? 'hidden-notes' : ''}"><span>${escapeHTML(baseDisplay)}</span><span class="note-gap"></span><span>${escapeHTML(targetDisplay)}</span></div>`;
  } else {
    main = `<div class="note-question note-pair"><span class="base-note">${escapeHTML(baseDisplay)}</span><span class="note-gap"></span><span class="target-note">${escapeHTML(targetDisplay)}</span></div>`;
  }
  return `<div class="question-card glass ${def.hyper ? 'question-card-hyper' : ''}"><p class="question-label">${def.view === 'ear' ? 'AUDIO IDENTIFICATION' : 'INTERVAL IDENTIFICATION'}</p>${main}
    <div class="question-meta">${def.adaptive ? '苦手度・反応時間・学習間隔から次問を自動選択' : (def.view === 'keys' ? '青＝基準音　ピンク＝到達音' : '左の音から右の音への音程')}</div>
    <div class="sound-controls"><button class="secondary-btn" data-action="replay">▶ REPLAY</button><button class="secondary-btn" data-action="toggle-audio-style">${state.settings.audioStyle === 'melodic' ? 'MELODIC' : state.settings.audioStyle === 'harmonic' ? 'HARMONIC' : 'BOTH'}</button></div>
  </div>`;
}

function renderSplash() {
  app.innerHTML = `<main class="screen splash"><div class="splash-logo"><img src="nakashima-logo.png" alt="中島ゼミ" class="splash-logo-image" /><div class="splash-name">NAKASHIMA SEMINAR</div></div><div class="splash-meta">Heisei College of Music</div><div class="splash-version">${APP_VERSION}</div></main>`;
}

function renderTitle() {
  app.innerHTML = `<main class="screen"><section class="shell hero-wrap"><div class="logo-mark"></div><h1 class="title-display">INTERVAL</h1><h2 class="title-display secondary">COSMOS</h2><p class="title-sub">SEE IT. HEAR IT. KNOW IT.</p><button class="primary-btn" data-action="home">START</button></section></main>`;
}

function renderHome() {
  app.innerHTML = `<main class="screen home-screen"><section class="shell narrow glass home-panel home-panel-strong">
    <div class="topbar topbar-home"><div class="topbar-title"><h1>SELECT MODE</h1><p>プレイするモードを選択。</p></div><div class="top-actions"><button class="icon-btn settings-gear-btn" data-action="settings" title="設定" aria-label="設定">⚙</button></div></div>

    <button class="mode-card practice practice-top" data-action="practice"><span class="mode-kicker">🔰 PRACTICE</span><span class="mode-title">PRACTICE MODE</span><span class="mode-desc">集中練習・無制限・適応学習。基礎から反復できます。</span><span class="mode-badge">NO LIMIT</span></button>

    <div class="home-section-label"><span>STANDARD</span><small>基本モード</small></div>
    <div class="mode-grid mode-grid-home">
      <button class="mode-card big standard-card" data-mode="orbitText"><span class="mode-kicker">TEXT</span><span class="mode-title">文字モード</span><span class="mode-desc">音名の綴りから音程を瞬時に判定。</span><span class="mode-badge">60 SEC</span></button>
      <button class="mode-card big standard-card" data-mode="orbitKeys"><span class="mode-kicker">KEYBOARD</span><span class="mode-title">鍵盤モード</span><span class="mode-desc">鍵盤上の距離から音程を直感的に判定。</span><span class="mode-badge">60 SEC</span></button>
    </div>

    <div class="mode-stack">
      <button class="mode-card hyper wide hyper-animated" data-action="hyper"><span class="hyper-flame flame-a"></span><span class="hyper-flame flame-b"></span><span class="mode-kicker">⚡ MAXIMUM REFLEX</span><span class="mode-title">HYPER DRIVE</span><span class="mode-desc">75秒。10コンボごとに+3秒。速度と集中力の限界へ。</span><span class="mode-badge">75 SEC + BONUS</span></button>
    </div>

    <div class="expert-divider"><span>EXPERT ZONE</span></div>
    <button class="mode-card earlink wide earlink-elite" data-mode="earLink"><span class="ear-danger-orbit"></span><span class="mode-kicker danger-text">ULTRA HARD / AUDIO ONLY</span><span class="mode-title">EAR LINK</span><span class="mode-desc">視覚情報を封印し、実音だけで13音程を判定する超高難度モード。</span><span class="mode-badge">EXPERT</span></button>

    <div class="home-footer home-footer-rich"><button class="secondary-btn" data-action="records">🏆 ONLINE RANKING</button><button class="secondary-btn practice-shortcut" data-action="quick-adaptive">🔰 苦手を重点練習</button></div>
    <div class="cloud-note ${state.cloudStatus}"><span class="cloud-dot"></span>${cloudStatusLabel()}${state.cloudStatus === 'error' ? `：${escapeHTML(state.cloudError)}` : ''}</div>
  </section>${modalHTML()}</main>`;
}

function renderPracticeSelect() {
  app.innerHTML = `<main class="screen"><section class="shell narrow glass select-panel">
    <div class="topbar"><button class="secondary-btn" data-action="home">← BACK</button><div class="topbar-title" style="text-align:center"><p class="eyebrow practice-eyebrow">🔰 PRACTICE MODE</p><h1>TRAINING MENU</h1><p>目的に合わせて練習方法を選択。</p></div><button class="icon-btn settings-gear-btn" data-action="settings" aria-label="設定">⚙</button></div>

    <button class="learning-guide-card" data-action="guide"><span class="guide-icon">🔰</span><span class="guide-copy"><strong>はじめての音程ガイド</strong><small>音程の数え方・長短／完全の見分け方を確認する</small></span><span class="guide-cta">まずはここから →</span></button>

    <div class="training-divider"><span>GAME TRAINING</span></div>
    <div class="segmented"><button class="tab-btn ${state.practiceView === 'text' ? 'active' : ''}" data-view="text" aria-pressed="${state.practiceView === 'text'}">文字</button><button class="tab-btn ${state.practiceView === 'keys' ? 'active' : ''}" data-view="keys" aria-pressed="${state.practiceView === 'keys'}">鍵盤</button><button class="tab-btn ${state.practiceView === 'ear' ? 'active' : ''}" data-view="ear" aria-pressed="${state.practiceView === 'ear'}">EAR</button></div>
    <div class="practice-list">
      <button class="practice-option" data-practice="manual"><span class="practice-icon">🎯</span><span class="practice-copy"><strong>FOCUS SELECT</strong><span>選んだ音程だけを反復して練習します。</span></span></button>
      <button class="practice-option" data-practice="adaptive"><span class="practice-icon">🤖</span><span class="practice-copy"><strong>ADAPTIVE TRAINING</strong><span>苦手な音程を自動判定し、重点的に反復します。</span></span></button>
      <button class="practice-option" data-practice="unlimited"><span class="practice-icon">♾️</span><span class="practice-copy"><strong>UNLIMITED RANDOM</strong><span>全13音程を時間制限なしでランダム出題します。</span></span></button>
    </div>
  </section>${modalHTML()}</main>`;
}

function renderGuide() {
  const reference = INTERVALS.map(iv => `<div class="guide-reference-cell"><strong>${iv.key}</strong><span>${iv.jp}</span><small>${iv.formula}</small></div>`).join('');
  app.innerHTML = `<main class="screen guide-screen"><section class="shell narrow glass guide-panel">
    <div class="topbar"><button class="secondary-btn" data-action="guide-back">← BACK</button><div class="topbar-title" style="text-align:center"><p class="eyebrow practice-eyebrow">🔰 BEGINNER GUIDE</p><h1>音程の導き出し方</h1><p>ゲームを始める前に、3つの手順だけ確認。</p></div><span style="width:72px"></span></div>

    <div class="guide-steps">
      <article class="guide-step"><span class="step-number">1</span><div><h2>まず「何度」かを数える</h2><p>音名の文字を、出発音と到達音を含めて数えます。たとえば C→E は C・D・E なので3度。♯や♭が付いても、度数の数字は音名の文字で決まります。</p><div class="guide-example">C → E = <b>3度</b>　／　F → B = <b>4度</b></div></div></article>
      <article class="guide-step"><span class="step-number">2</span><div><h2>次に「種類」を決める</h2><p>1・4・5・8度は「完全系」。2・3・6・7度は「長短系」です。長音程から半音1つ狭くなると短音程になります。</p><div class="guide-example">C→E = 長3度（4半音）　／　C→E♭ = 短3度（3半音）</div></div></article>
      <article class="guide-step"><span class="step-number">3</span><div><h2>最後に半音数で確認する</h2><p>鍵盤では隣り合う鍵盤が1半音。三全音は6半音です。「度数 → 種類 → 半音数」の順で確認すると、綴りと響きを結びつけやすくなります。</p><div class="guide-example">P4 = 5半音　／　TT = 6半音　／　P5 = 7半音</div></div></article>
    </div>

    <section class="guide-tip"><strong>最短ルート</strong><span>文字を数える → 完全系 / 長短系を判断 → 半音数でチェック</span></section>
    <h2 class="guide-reference-title">13音程 早見表</h2>
    <div class="guide-reference-grid">${reference}</div>
    <button class="primary-btn guide-start" data-action="guide-complete">理解した → 練習メニューへ</button>
  </section></main>`;
}

function renderIntervalSelect() {
  const selected = state.selectedIntervals;
  app.innerHTML = `<main class="screen"><section class="shell narrow glass select-panel">
    <div class="topbar"><button class="secondary-btn" data-action="practice">← BACK</button><div class="topbar-title" style="text-align:center"><p class="eyebrow">FOCUS SELECT</p><h1>SELECT INTERVALS</h1><p>1つ以上選択してください。</p></div><span style="width:72px"></span></div>
    <div class="interval-tools"><button class="secondary-btn" data-action="select-all">ALL</button><button class="secondary-btn" data-action="select-core">CORE 7</button><button class="secondary-btn danger" data-action="clear-all">RESET</button></div>
    <div class="interval-grid">${INTERVALS.map(iv => `<button class="chip ${selected.has(iv.key) ? 'selected' : ''}" data-interval="${iv.key}" aria-pressed="${selected.has(iv.key)}"><span class="iv-key">${iv.key}</span><span class="iv-name">${iv.jp}</span></button>`).join('')}</div>
    <div class="start-row"><button class="primary-btn" data-action="start-manual" ${selected.size ? '' : 'disabled'}>START FOCUS</button><span class="selected-count">${selected.size} / 13</span></div>
  </section>${modalHTML()}</main>`;
}

function renderHyperSelect() {
  app.innerHTML = `<main class="screen"><section class="shell narrow glass select-panel hyper-select-panel">
    <div class="topbar"><button class="secondary-btn" data-action="home">← BACK</button><div class="topbar-title" style="text-align:center"><p class="eyebrow" style="color:var(--amber)">HYPER DRIVE</p><h1>SELECT INTERFACE</h1><p>高演出・高得点・高集中の特別モード。</p></div><span style="width:72px"></span></div>
    <div class="mode-grid mode-grid-home"><button class="mode-card hyper big hyper-animated" style="grid-column:auto;min-height:180px" data-mode="hyperText"><span class="hyper-flame flame-a"></span><span class="mode-kicker">TEXT DRIVE</span><span class="mode-title">文字モード</span><span class="mode-desc">音名綴りを瞬時に見抜いて答える。</span></button><button class="mode-card hyper big hyper-animated" style="grid-column:auto;min-height:180px" data-mode="hyperKeys"><span class="hyper-flame flame-a"></span><span class="mode-kicker">KEY DRIVE</span><span class="mode-title">鍵盤モード</span><span class="mode-desc">鍵盤距離から直感的に答える。</span></button></div>
  </section>${modalHTML()}</main>`;
}

function renderPlay() {
  const def = mode();
  const g = state.game;
  const danger = !def.unlimited && g.timeLeft <= 10;
  const hyperFx = def.hyper ? `<div class="hyper-fx" aria-hidden="true"><span class="warp-ring r1"></span><span class="warp-ring r2"></span><span class="warp-ring r3"></span><span class="hyper-scan"></span><span class="edge-fire left"></span><span class="edge-fire right"></span></div>` : '';
  app.innerHTML = `<main class="screen play-screen ${danger ? 'danger-vignette' : ''} ${def.hyper ? 'hyper-play' : ''}">${hyperFx}<section class="play-shell">
    <header class="play-hud"><div class="hud-left"><span class="mode-mini">${def.ear ? 'ULTRA HARD' : def.hyper ? 'HYPER DRIVE' : def.practice ? 'PRACTICE' : 'STANDARD'}</span></div><div class="hud-center">${timerRingHTML()}</div><div class="hud-right">${def.hyper ? `<div class="metric combo ${g.combo >= 10 ? 'hot' : ''}"><span class="metric-label">COMBO</span><span class="metric-value">${g.combo}</span></div>` : ''}${def.scored ? `<div class="metric"><span class="metric-label">SCORE</span><span class="metric-value">${formatNumber(g.score)}</span></div>` : `<div class="metric"><span class="metric-label">ANSWERS</span><span class="metric-value">${g.total}</span></div>`}</div></header>
    <section class="question-zone">${questionHTML()}</section>
    <section class="answer-area">${state.phase === 'idle' ? '' : answerButtonsHTML()}</section>
    <footer class="play-footer play-footer-stacked"><div class="feedback-line">${state.feedback || `${def.title}　${state.settings.audioStyle.toUpperCase()}`}</div>${state.phase !== 'idle' ? `<button class="secondary-btn hold-btn hold-btn-wide" data-action="hold-end"><span class="hold-fill"></span><span class="hold-shine"></span><span class="hold-label">長押しで終了</span></button>` : '<span></span>'}</footer>
  </section>${state.phase === 'countdown' ? `<div class="countdown ${def.hyper ? 'hyper-countdown' : ''}"><div class="countdown-number" key="${state.countdownValue}">${state.countdownValue}</div></div>` : ''}${modalHTML()}</main>`;
  updateTimerDOM();
}

function runWeakest() {
  if (!state.game) return null;
  const rows = INTERVALS.map(iv => {
    const s = state.game.answers[iv.key];
    return { key: iv.key, seen: s.seen, correct: s.correct, rate: s.seen ? s.correct / s.seen : 1, avg: s.ms.length ? s.ms.reduce((a,b)=>a+b,0)/s.ms.length : 0 };
  }).filter(x => x.seen);
  return rows.sort((a,b) => a.rate - b.rate || b.avg - a.avg)[0] || null;
}

function topConfusion() {
  if (!state.game) return null;
  return Object.entries(state.game.confusions).sort((a,b) => b[1] - a[1])[0] || null;
}

function recommendationText() {
  const weak = runWeakest();
  if (!state.game.total || state.game.total < 5) return 'データが少ないため、もう1セッション行うと傾向を判定できます。';
  if (!weak || weak.rate >= .9) return '高い精度です。次はEAR LINKで視覚情報を外し、響きだけの即時判断へ進んでください。';
  const iv = INTERVAL_MAP[weak.key];
  return `${iv.jp}（${iv.formula}）を優先して復習します。音名・鍵盤・実音の3経路で同じ関係を確認してください。`;
}

function rankingSubmitHTML() {
  if (!mode()?.ranked) return '';
  const r = state.rankingSubmit;
  if (r?.status === 'queued') return `<div class="ranking-submit pending"><strong>端末に保存しました</strong><span>接続後に再送します。「保存・同期」で状況を確認できます。</span></div>`;
  if (r?.status === 'synced-later') return `<div class="ranking-submit done"><strong>送信が完了しました</strong><span>「保存・同期」で公開状況を確認できます。</span></div>`;
  if (!r || r.status === 'preparing' || r.status === 'sending') return `<div class="ranking-submit pending"><span class="spinner"></span>オンラインランキングへ送信中</div>`;
  if (r.status === 'profile_required') return `<div class="ranking-submit warning">ランキング登録にはプレイヤー名が必要です。</div>`;
  if (r.status === 'unavailable') return `<div class="ranking-submit muted">オンラインランキングは未設定です。</div>`;
  if (r.status === 'error') return `<div class="ranking-submit error">送信失敗：${escapeHTML(r.message || '')}</div>`;
  if (r.status === 'done') {
    return `<div class="ranking-submit done"><strong>ONLINE RANKING</strong><span>月間 <b>${r.monthly_rank || '-'}位</b></span><span>殿堂 <b>${r.hall_rank || '-'}位</b></span>${r.monthly_improved || r.hall_improved ? '<em>PERSONAL BEST UPDATED</em>' : '<em>登録済みベストを維持</em>'}</div>`;
  }
  return '';
}

function sessionMistakeRows() {
  if (!state.game) return [];
  return INTERVALS.map(iv => {
    const data = state.game.answers[iv.key];
    const wrong = Math.max(0, data.seen - data.correct);
    const missRate = data.seen ? wrong / data.seen : 0;
    return { iv, seen: data.seen, correct: data.correct, wrong, missRate };
  }).filter(row => row.seen > 0 && row.wrong > 0)
    .sort((a, b) => b.missRate - a.missRate || b.wrong - a.wrong || b.seen - a.seen);
}

function missHeatClass(rate) {
  if (rate >= 0.75) return 'miss-heat-4';
  if (rate >= 0.5) return 'miss-heat-3';
  if (rate >= 0.25) return 'miss-heat-2';
  return 'miss-heat-1';
}

function renderResult() {
  const g = state.game;
  const def = mode();
  const final = currentFinalScore();
  const acc = g.total ? Math.round(g.correct / g.total * 100) : 0;
  const avg = g.responseTimes.length ? g.responseTimes.reduce((a,b)=>a+b,0) / g.responseTimes.length : 0;
  const best = g.responseTimes.length ? Math.min(...g.responseTimes) : 0;
  const confusion = topConfusion();
  const misses = sessionMistakeRows();
  const missHTML = misses.length
    ? `<div class="miss-grid">${misses.map(row => `<div class="miss-card ${missHeatClass(row.missRate)}"><span class="miss-key">${row.iv.key}</span><strong>${row.iv.jp}</strong><span class="miss-rate">誤答 ${Math.round(row.missRate * 100)}%</span><small>${row.wrong} miss / ${row.seen} answers</small></div>`).join('')}</div>`
    : `<div class="miss-perfect">✨ このセッションでは誤答がありませんでした。</div>`;

  app.innerHTML = `<main class="screen result-screen"><section class="shell glass result-panel ${def.hyper ? 'result-hyper' : ''}">
    <div class="result-head"><p class="eyebrow">MISSION COMPLETE</p><h1>${def.practice ? 'PRACTICE REPORT' : 'RESULT'}</h1><div class="result-mode">${def.title}</div>${def.scored ? `<div id="resultScore" class="score-big">${formatNumber(final)}</div><div class="score-caption">TOTAL SCORE</div>` : `<div class="score-big practice-total">${g.total}</div><div class="score-caption">QUESTIONS COMPLETED</div>`}${rankingSubmitHTML()}</div>
    <div class="stat-grid"><div class="stat-card glass-soft"><span class="label">正答 / 総問</span><span class="value">${g.correct} / ${g.total}</span></div><div class="stat-card glass-soft"><span class="label">正答率</span><span class="value">${acc}%</span></div><div class="stat-card glass-soft"><span class="label">最大コンボ</span><span class="value">${g.maxCombo}</span></div><div class="stat-card glass-soft"><span class="label">平均解答</span><span class="value">${avg.toFixed(2)}s</span></div><div class="stat-card glass-soft"><span class="label">最速解答</span><span class="value">${best.toFixed(2)}s</span></div></div>

    <section class="miss-analysis"><div class="analysis-title"><h2>MISSED INTERVALS</h2><span>このセッションの誤答率</span></div>${missHTML}</section>

    <section class="analysis-section"><div class="analysis-title"><h2>INTERVAL MASTERY</h2><span>端末内の学習分析</span></div><div class="mastery-grid">${INTERVALS.map(iv => { const score = masteryScore(iv.key); const level = score >= 85 ? 4 : score >= 65 ? 3 : score >= 40 ? 2 : score > 0 ? 1 : 0; return `<div class="mastery-cell level-${level}" title="${iv.jp}"><span class="key">${iv.key}</span><span class="pct">${score}%</span></div>`; }).join('')}</div>
      <div class="insight-grid"><div class="insight-card glass-soft"><h3>NEXT MISSION</h3><p>${recommendationText()}</p></div><div class="insight-card glass-soft"><h3>CONFUSION TRACE</h3><p>${confusion ? `${confusion[0]} の混同が ${confusion[1]} 回。正解音程を再生して差を比較してください。` : '今回、明確な混同ペアは記録されませんでした。'}</p></div></div>
    </section>
    <div class="result-actions"><button class="primary-btn ${def.hyper ? 'hyper' : ''}" data-action="retry">RETRY</button><button class="secondary-btn" data-action="records">RANKING</button><button class="secondary-btn practice-result-btn" data-action="practice-weak">苦手を練習</button><button class="secondary-btn" data-action="home">HOME</button></div>
  </section>${modalHTML()}</main>`;
}

function settingsModalHTML() {
  if (!state.showSettings) return '';
  const s = state.settings;
  const profileText = state.profile ? `${state.profile.avatar} ${state.profile.player_name}` : '未設定';
  return `<div class="settings-modal" data-action="close-modal"><section class="modal-card glass" data-stop><div class="modal-head"><div><h2>AUDIO / SETTINGS</h2><p>音響とオンライン接続を調整します。</p></div><button class="icon-btn" data-action="close-settings">×</button></div>
    <div class="setting-row"><div class="setting-label"><strong>Sound</strong><button class="toggle ${s.sound ? 'on' : ''}" data-setting-toggle="sound" aria-label="サウンド切替"></button></div></div>
    <div class="setting-row"><div class="setting-label"><strong>Volume</strong><span>${Math.round(s.volume * 100)}%</span></div><input class="range" type="range" min="0" max="1" step="0.01" value="${s.volume}" data-setting-range="volume" /></div>
    <div class="setting-row playback-setting"><div class="setting-label"><strong>Playback</strong><span>音程の再生方法</span></div><div class="segmented" style="margin:0"><button class="tab-btn ${s.audioStyle === 'melodic' ? 'active' : ''}" data-setting="audioStyle" data-value="melodic">MELODIC</button><button class="tab-btn ${s.audioStyle === 'harmonic' ? 'active' : ''}" data-setting="audioStyle" data-value="harmonic">HARMONIC</button><button class="tab-btn ${s.audioStyle === 'both' ? 'active' : ''}" data-setting="audioStyle" data-value="both">BOTH</button></div>
      <div class="playback-help"><p><strong>MELODIC</strong>：基準音 → 到達音の順に、2音を続けて再生します。</p><p><strong>HARMONIC</strong>：基準音と到達音の2音を同時に鳴らします。</p><p><strong>BOTH</strong>：MELODICとHARMONICを続けて再生します。</p></div>
      ${s.audioStyle === 'both' ? `<div class="both-order"><div class="setting-label compact"><strong>BOTHの再生順</strong><span>最初に聴く形式を選択</span></div><div class="segmented both-order-tabs" style="margin:0"><button class="tab-btn ${s.bothOrder === 'harmonicFirst' ? 'active' : ''}" data-setting="bothOrder" data-value="harmonicFirst">HARMONIC → MELODIC</button><button class="tab-btn ${s.bothOrder === 'melodicFirst' ? 'active' : ''}" data-setting="bothOrder" data-value="melodicFirst">MELODIC → HARMONIC</button></div></div>` : ''}
    </div>
    <div class="setting-row"><div class="setting-label"><strong>Auto play each question</strong><button class="toggle ${s.autoPlay ? 'on' : ''}" data-setting-toggle="autoPlay"></button></div></div>
    <div class="setting-row cloud-setting"><div><strong>Online ranking</strong><span class="cloud-state ${state.cloudStatus}">${cloudStatusLabel()}</span></div><p>${state.cloudStatus === 'ready' ? `PLAYER：${escapeHTML(profileText)}` : state.cloudStatus === 'unconfigured' ? 'cloud-config.jsへSupabaseのURLとPublishable Keyを設定してください。' : escapeHTML(state.cloudError || '接続しています。')}</p><button class="secondary-btn" data-action="edit-profile" ${state.cloudStatus === 'ready' ? '' : 'disabled'}>PLAYER SETUP</button></div>
    <div class="settings-version">${APP_VERSION}</div>
  </section></div>`;
}

function recordsModalHTML() {
  if (!state.showRecords) return '';
  const modeTabs = RANKING_MODES.map(item => `<button class="rank-mode-btn ${state.rankingMode === item.key ? 'active' : ''}" data-rank-mode="${item.key}">${item.label}</button>`).join('');
  let body = '';
  if (state.cloudStatus === 'unconfigured') {
    body = `<div class="ranking-unavailable"><div class="ranking-cloud-icon">☁</div><h3>ONLINE RANKING SETUP REQUIRED</h3><p>Supabaseを設定すると、学生のユーザー情報とランキングをオンラインで一元管理できます。</p><p class="small">同梱の <code>supabase_setup.sql</code> を実行し、<code>cloud-config.js</code> に2項目を貼り付けてください。</p></div>`;
  } else if (state.cloudStatus === 'error') {
    body = `<div class="empty-state">接続エラー<br><small>${escapeHTML(state.cloudError)}</small></div>`;
  } else if (state.rankingLoading) {
    body = `<div class="ranking-loading"><span class="spinner"></span>LOADING ONLINE RANKING...</div>`;
  } else if (state.rankingError) {
    body = `<div class="empty-state">${escapeHTML(state.rankingError)}</div>`;
  } else if (!state.rankingRows.length) {
    body = `<div class="empty-state"><div class="empty-galaxy">🌌</div>まだランキングがありません。</div>`;
  } else {
    body = `<div class="ranking-list">${state.rankingRows.map((row, index) => {
      const rank = index + 1;
      const mine = row.user_id === state.cloudUserId;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);
      const acc = row.total_answers ? Math.round(row.correct_answers / row.total_answers * 100) : 0;
      return `<div class="ranking-row ${mine ? 'mine' : ''} rank-${Math.min(rank,4)}"><div class="rank-number">${medal}</div><div class="rank-avatar">${escapeHTML(row.avatar || '🌟')}</div><div class="rank-player"><strong>${escapeHTML(row.player_name || 'PLAYER')}${mine ? '<span class="you-tag">YOU</span>' : ''}</strong><span>正答率 ${acc}%　MAX ${row.max_combo || 0}</span></div><div class="rank-score">${formatNumber(row.score)}</div></div>`;
    }).join('')}</div>`;
  }
  return `<div class="records-modal" data-action="close-modal"><section class="modal-card ranking-modal glass" data-stop><div class="modal-head"><div><p class="eyebrow">LIVE DATABASE</p><h2>ONLINE RANKING</h2><p>${state.rankingScope === 'monthly' ? `${escapeHTML(state.rankingPeriod || '')} 月間TOP 50` : '歴代ベスト TOP 50'}</p></div><button class="icon-btn" data-action="close-records">×</button></div>
    <div class="ranking-scope"><button class="tab-btn ${state.rankingScope === 'monthly' ? 'active' : ''}" data-rank-scope="monthly">📅 月間</button><button class="tab-btn hall ${state.rankingScope === 'hall' ? 'active' : ''}" data-rank-scope="hall">👑 殿堂入り</button></div>
    <div class="ranking-mode-tabs">${modeTabs}</div>${body}
  </section></div>`;
}

function playerSetupModalHTML() {
  const currentName = state.playerDraft || state.profile?.player_name || '';
  const currentStudent = state.studentNumberDraft || state.profile?.student_number || '';
  return `<div class="player-modal"><section class="modal-card player-card glass" data-stop><div class="modal-head"><div><p class="eyebrow">ONLINE PROFILE</p><h2>PLAYER SETUP</h2><p>初回のみ学籍番号とランキング表示名を登録してください。</p></div>${state.profile ? '<button class="icon-btn" data-action="close-player">×</button>' : ''}</div>
    <label class="player-student-field"><span>学籍番号</span><input id="studentNumberInput" maxlength="20" value="${escapeHTML(currentStudent)}" placeholder="学籍番号を入力" autocomplete="off" ${state.profile ? 'readonly' : ''} /><small>${state.profile ? '登録済み' : '非公開'}</small></label>
    <div class="avatar-grid">${AVATARS.map(avatar => `<button class="avatar-btn ${state.playerAvatar === avatar ? 'active' : ''}" data-avatar="${avatar}">${avatar}</button>`).join('')}</div>
    <label class="player-name-field"><span>${state.playerAvatar}</span><input id="playerNameInput" maxlength="16" value="${escapeHTML(currentName)}" placeholder="名前を2〜16文字で入力" autocomplete="nickname" /><small>2〜16文字</small></label>
    <p class="player-public-note">学籍番号は管理用でランキングには表示されません。公開されるのは名前・アイコン・スコアです。</p>
    <button class="primary-btn player-save" data-action="save-profile">決定</button>
  </section></div>`;
}

function modalHTML() {
  const player = state.showPlayerSetup ? playerSetupModalHTML() : '';
  return `${settingsModalHTML()}${recordsModalHTML()}${player}`;
}

function render() {
  if (state.screen === 'splash') renderSplash();
  else if (state.screen === 'title') renderTitle();
  else if (state.screen === 'home') renderHome();
  else if (state.screen === 'practice') renderPracticeSelect();
  else if (state.screen === 'guide') renderGuide();
  else if (state.screen === 'interval-select') renderIntervalSelect();
  else if (state.screen === 'hyper-select') renderHyperSelect();
  else if (state.screen === 'play') renderPlay();
  else if (state.screen === 'result') renderResult();
}

let holdTimer = null;
let holdRAF = null;
function startHold(button) {
  if (!button || state.phase !== 'running') return;
  const fill = button.querySelector('.hold-fill');
  const start = performance.now();
  const duration = 1500;
  const frame = now => {
    const p = clamp((now - start) / duration, 0, 1);
    if (fill) fill.style.width = `${p * 100}%`;
    if (p >= 1) { cancelHold(); goHome(); return; }
    holdRAF = requestAnimationFrame(frame);
  };
  holdTimer = button;
  holdRAF = requestAnimationFrame(frame);
}
function cancelHold() {
  if (holdRAF) cancelAnimationFrame(holdRAF);
  if (holdTimer) holdTimer.querySelector('.hold-fill')?.style.setProperty('width', '0%');
  holdRAF = null; holdTimer = null;
}

async function initializeCloud() {
  if (!cloud?.configured?.()) {
    state.cloudStatus = 'unconfigured';
    return;
  }
  state.cloudStatus = 'connecting';
  try {
    const data = await cloud.init();
    state.cloudStatus = data.status === 'offline' ? 'offline' : 'ready';
    state.cloudUserId = data.user?.id || null;
    state.profile = data.profile || null;
    state.playerDraft = state.profile?.player_name || '';
    state.studentNumberDraft = state.profile?.student_number || '';
    state.playerAvatar = state.profile?.avatar || '🌟';
    state.showPlayerSetup = !state.profile;
  } catch (error) {
    console.error(error);
    state.cloudStatus = 'error';
    state.cloudError = error.message || 'オンライン接続に失敗しました。';
  }
  render();
}

async function loadRanking() {
  if (state.cloudStatus !== 'ready' || !cloud) return;
  state.rankingLoading = true;
  state.rankingError = '';
  render();
  try {
    const data = await cloud.fetchRankings({ mode: state.rankingMode, scope: state.rankingScope, limit: 50 });
    state.rankingRows = data.rows || [];
    state.rankingPeriod = data.period || '';
    state.cloudUserId = data.currentUserId || state.cloudUserId;
  } catch (error) {
    console.error(error);
    state.rankingError = error.message || 'ランキングの取得に失敗しました。';
    state.rankingRows = [];
  } finally {
    state.rankingLoading = false;
    render();
  }
}

function openRanking() {
  state.showRecords = true;
  render();
  if (state.cloudStatus === 'ready') loadRanking();
}

async function savePlayerProfile() {
  const input = document.querySelector('#playerNameInput');
  const studentInput = document.querySelector('#studentNumberInput');
  const name = String(input?.value || state.playerDraft || '').trim();
  const studentNumber = String(studentInput?.value || state.studentNumberDraft || state.profile?.student_number || '').trim();
  if (!state.profile && (studentNumber.length < 3 || studentNumber.length > 20)) {
    toast('学籍番号を正しく入力してください。');
    studentInput?.focus();
    return;
  }
  if (name.length < 2 || name.length > 16) {
    toast('名前は2〜16文字で入力してください。');
    input?.focus();
    return;
  }
  if (state.cloudStatus !== 'ready' || !cloud) {
    toast('オンライン接続が完了していません。');
    return;
  }
  const button = document.querySelector('[data-action="save-profile"]');
  if (button) { button.disabled = true; button.textContent = 'SAVING...'; }
  try {
    const profile = await cloud.saveProfile({ studentNumber, playerName: name, avatar: state.playerAvatar });
    state.profile = profile;
    state.playerDraft = profile.player_name;
    state.studentNumberDraft = profile.student_number || studentNumber;
    state.playerAvatar = profile.avatar;
    state.showPlayerSetup = false;
    toast('プレイヤー情報をオンラインに保存しました。');
    if (state.pendingScore != null && state.game) {
      const pending = state.pendingScore;
      state.pendingScore = null;
      state.game.onlineSubmitted = false;
      render();
      submitOnlineScore(pending);
    } else {
      render();
    }
  } catch (error) {
    console.error(error);
    toast(`保存できませんでした：${error.message || ''}`);
    if (button) { button.disabled = false; button.textContent = '決定'; }
  }
}

app.addEventListener('click', event => {
  const stop = event.target.closest('[data-stop]');
  if (stop && event.target === stop) return;

  const rankScope = event.target.closest('[data-rank-scope]');
  if (rankScope) { state.rankingScope = rankScope.dataset.rankScope; loadRanking(); return; }
  const rankMode = event.target.closest('[data-rank-mode]');
  if (rankMode) { state.rankingMode = rankMode.dataset.rankMode; loadRanking(); return; }
  const avatar = event.target.closest('[data-avatar]');
  if (avatar) {
    state.playerDraft = document.querySelector('#playerNameInput')?.value || state.playerDraft;
    state.studentNumberDraft = document.querySelector('#studentNumberInput')?.value || state.studentNumberDraft;
    state.playerAvatar = avatar.dataset.avatar;
    render();
    return;
  }

  const answer = event.target.closest('[data-answer]');
  if (answer) { audio.unlock().catch(()=>{}); answerQuestion(answer.dataset.answer); return; }
  const modeButton = event.target.closest('[data-mode]');
  if (modeButton) { audio.unlock().catch(()=>{}); openMode(modeButton.dataset.mode); return; }
  const interval = event.target.closest('[data-interval]');
  if (interval) {
    const key = interval.dataset.interval;
    state.selectedIntervals.has(key) ? state.selectedIntervals.delete(key) : state.selectedIntervals.add(key);
    render();
    app.querySelector(`[data-interval="${key}"]`)?.focus({ preventScroll: true });
    return;
  }
  const view = event.target.closest('[data-view]');
  if (view) {
    state.practiceView = view.dataset.view;
    render();
    app.querySelector(`[data-view="${state.practiceView}"]`)?.focus({ preventScroll: true });
    return;
  }
  const practice = event.target.closest('[data-practice]');
  if (practice) {
    const type = practice.dataset.practice;
    if (type === 'manual') { state.screen = 'interval-select'; render(); return; }
    if (type === 'adaptive') {
      const id = state.practiceView === 'ear' ? 'autoEar' : state.practiceView === 'keys' ? 'autoKeys' : 'autoText';
      openMode(id, true); return;
    }
    if (type === 'unlimited') {
      const id = state.practiceView === 'keys' ? 'unlimitedKeys' : state.practiceView === 'ear' ? 'unlimitedEar' : 'unlimitedText';
      openMode(id, true); return;
    }
  }

  const setting = event.target.closest('[data-setting]');
  if (setting) {
    state.settings[setting.dataset.setting] = setting.dataset.value;
    saveSettings(); render(); return;
  }
  const settingToggle = event.target.closest('[data-setting-toggle]');
  if (settingToggle) {
    const key = settingToggle.dataset.settingToggle;
    state.settings[key] = !state.settings[key];
    saveSettings();
    if (key === 'sound' && state.settings.sound) audio.unlock().catch(()=>{});
    render(); return;
  }

  const actionNode = event.target.closest('[data-action]');
  if (!actionNode) return;
  const action = actionNode.dataset.action;
  if (action === 'home') {
    state.showSettings = false;
    state.showRecords = false;
    if (state.screen === 'title') { state.screen = 'home'; render(); }
    else goHome();
  }
  else if (action === 'practice') { state.screen = (state.screen === 'home' && !state.guideSeen) ? 'guide' : 'practice'; render(); }
  else if (action === 'guide') { state.screen = 'guide'; render(); }
  else if (action === 'guide-back') { state.screen = 'practice'; render(); }
  else if (action === 'guide-complete') { state.guideSeen = true; localStorage.setItem(STORAGE.guideSeen, '1'); state.screen = 'practice'; render(); }
  else if (action === 'hyper') { state.screen = 'hyper-select'; render(); }
  else if (action === 'settings') { state.showSettings = true; render(); }
  else if (action === 'edit-profile') {
    if (state.cloudStatus !== 'ready') { state.showSettings = true; render(); return; }
    state.playerDraft = state.profile?.player_name || '';
    state.studentNumberDraft = state.profile?.student_number || state.studentNumberDraft || '';
    state.playerAvatar = state.profile?.avatar || state.playerAvatar || '🌟';
    state.showPlayerSetup = true;
    state.showSettings = false;
    render();
  }
  else if (action === 'close-player') { if (state.profile) state.showPlayerSetup = false; render(); }
  else if (action === 'save-profile') { savePlayerProfile(); }
  else if (action === 'records') { openRanking(); }
  else if (action === 'close-settings') { state.showSettings = false; render(); }
  else if (action === 'close-records') { state.showRecords = false; render(); }
  else if (action === 'close-modal' && event.target === actionNode) { state.showSettings = false; state.showRecords = false; render(); }
  else if (action === 'start-countdown') startCountdown();
  else if (action === 'replay') audio.playInterval(state.question).catch(()=>{});
  else if (action === 'toggle-audio-style') {
    state.settings.audioStyle = state.settings.audioStyle === 'melodic' ? 'harmonic' : state.settings.audioStyle === 'harmonic' ? 'both' : 'melodic';
    saveSettings(); render(); audio.playInterval(state.question).catch(()=>{});
  }
  else if (action === 'select-all') { state.selectedIntervals = new Set(INTERVALS.map(i=>i.key)); render(); app.querySelector('[data-action="select-all"]')?.focus({ preventScroll: true }); }
  else if (action === 'select-core') { state.selectedIntervals = new Set(['m3','M3','P4','TT','P5','m6','M6']); render(); app.querySelector('[data-action="select-core"]')?.focus({ preventScroll: true }); }
  else if (action === 'clear-all') { state.selectedIntervals.clear(); render(); app.querySelector('[data-action="clear-all"]')?.focus({ preventScroll: true }); }
  else if (action === 'start-manual') {
    if (!state.selectedIntervals.size) return;
    const id = state.practiceView === 'keys' ? 'manualKeys' : state.practiceView === 'ear' ? 'manualEar' : 'manualText';
    openMode(id, true);
  }
  else if (action === 'retry') { openMode(state.modeId, !!mode()?.practice); }
  else if (action === 'practice-weak') {
    const weak = runWeakest();
    state.selectedIntervals = new Set(weak ? [weak.key] : INTERVALS.map(i=>i.key));
    state.practiceView = mode()?.view === 'keys' ? 'keys' : mode()?.view === 'ear' ? 'ear' : 'text';
    state.screen = 'interval-select'; render();
  }
  else if (action === 'quick-adaptive') { if (!state.guideSeen) { state.screen = 'guide'; render(); } else { state.practiceView = 'text'; openMode('autoText', true); } }
});

app.addEventListener('input', event => {
  if (event.target.id === 'playerNameInput') {
    state.playerDraft = event.target.value;
    return;
  }
  const range = event.target.closest('[data-setting-range]');
  if (!range) return;
  state.settings[range.dataset.settingRange] = Number(range.value);
  saveSettings();
  audio.setVolume(state.settings.volume);
  const label = range.closest('.setting-row')?.querySelector('.setting-label span');
  if (label) label.textContent = `${Math.round(state.settings.volume * 100)}%`;
});

app.addEventListener('pointerdown', event => {
  const hold = event.target.closest('[data-action="hold-end"]');
  if (hold) startHold(hold);
});
app.addEventListener('pointerup', cancelHold);
app.addEventListener('pointerleave', cancelHold);
app.addEventListener('pointercancel', cancelHold);

window.addEventListener('keydown', event => {
  if (event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'Escape') {
    if (state.showSettings || state.showRecords || (state.showPlayerSetup && state.profile)) { state.showSettings=false; state.showRecords=false; if (state.profile) state.showPlayerSetup=false; render(); }
    return;
  }
  if (event.code === 'Space' && state.screen === 'play' && state.phase === 'running') {
    event.preventDefault(); audio.playInterval(state.question).catch(()=>{}); return;
  }
  if (state.screen !== 'play' || state.phase !== 'running' || state.locked) return;
  const key = event.key.toLowerCase();
  const index = HOTKEYS.indexOf(key);
  if (index >= 0) answerQuestion(INTERVALS[index].key);
});

window.addEventListener('beforeunload', () => { saveSettings(); saveMastery(); });
window.addEventListener('online', initializeCloud);
window.addEventListener('offline', () => {
  if (state.profile && !state.profile.is_guest) state.cloudStatus = 'offline';
  if (state.screen !== 'play') render();
});
window.addEventListener('interval-cosmos-sync', () => {
  const pending = state.rankingSubmit;
  if (pending?.status !== 'queued') return;
  const saved = cloud?.getSavedPlays?.().find(r => r.payload.clientEventId === pending.client_event_id);
  if (saved?.status === 'synced') {
    state.rankingSubmit = {...pending,status:'synced-later'};
    if (state.screen === 'result') render();
  }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const registerWorker = () => navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (document.readyState === 'complete') registerWorker();
  else window.addEventListener('load', registerWorker, {once:true});
}

saveSettings();
render();
initializeCloud();
window.setTimeout(() => {
  if (state.screen === 'splash') { state.screen = 'title'; render(); }
}, 3400);
