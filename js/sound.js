// =============================================================
// sound.js — звуки без жодних файлів: браузер сам «синтезує» їх
// через Web Audio API (генератор тону + генератор шуму).
// Браузери дозволяють звук лише після кліку гравця, тому sfx.init()
// викликаємо, коли натиснули «Грати» чи «Демо».
// =============================================================

var sfx = {
  ctx: null,       // «аудіо-двигун» браузера
  on: true,        // звук увімкнено?
  noiseBuf: null,  // заготовка шуму (для тріску і сплесків)

  init: function () {
    if (this.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.on = false; return; }   // старий браузер — граємо без звуку
    this.ctx = new AC();
    // 1 секунда «білого шуму» — випадкові числа
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    var data = this.noiseBuf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  },

  ready: function () {
    return this.on && this.ctx;
  },

  // Простий тон: freq — висота (Гц), dur — тривалість (с), type — форма хвилі
  beep: function (freq, dur, type, vol, delay) {
    if (!this.ready()) return;
    var t = this.ctx.currentTime + (delay || 0);
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);   // плавно затихає
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  },

  // Шум через фільтр: низький filter — гул, високий — шипіння
  noise: function (dur, vol, filterFreq, filterType) {
    if (!this.ready()) return;
    var t = this.ctx.currentTime;
    var src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    var filter = this.ctx.createBiquadFilter();
    filter.type = filterType || "bandpass";
    filter.frequency.value = filterFreq;
    var gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
  },

  // ---- Звуки гри ----
  crackle: function () { this.noise(0.04 + Math.random() * 0.05, 0.12, 1500 + Math.random() * 2500); },
  spray:   function () { this.noise(0.12, 0.05, 3000, "highpass"); },
  splash:  function () { this.noise(0.6, 0.35, 800, "lowpass"); },
  rotor:   function () { this.noise(0.08, 0.06, 120, "lowpass"); },
  dig:     function () { this.noise(0.07, 0.15, 400); },
  click:   function () { this.beep(660, 0.06, "square", 0.05); },
  alert:   function () { this.beep(880, 0.12, "square", 0.06); this.beep(660, 0.15, "square", 0.06, 0.13); },
  error:   function () { this.beep(160, 0.18, "sawtooth", 0.06); },
  win: function () {
    var notes = [523, 659, 784, 1047];   // до-мі-соль-до: весела мелодія
    for (var i = 0; i < notes.length; i++) this.beep(notes[i], 0.25, "square", 0.07, i * 0.15);
  },
  lose: function () {
    var notes = [392, 330, 262, 196];    // мелодія вниз: сумна
    for (var i = 0; i < notes.length; i++) this.beep(notes[i], 0.3, "triangle", 0.09, i * 0.2);
  }
};

// Фонові звуки, які залежать від того, що відбувається (викликається кожен кадр)
var soundTimers = { crackle: 0, rotor: 0, spray: 0 };
function updateSounds(dt, burningVisible, heliFlying, spraying) {
  if (!sfx.ready()) return;
  // Тріск вогню: що більше вогню видно — то частіше тріщить (але не безкінечно)
  soundTimers.crackle -= dt;
  if (burningVisible > 0 && soundTimers.crackle <= 0) {
    sfx.crackle();
    soundTimers.crackle = 0.35 / Math.min(6, 1 + burningVisible / 15) * (0.5 + Math.random());
  }
  // Гул гвинта, поки вертоліт летить
  soundTimers.rotor -= dt;
  if (heliFlying && soundTimers.rotor <= 0) {
    sfx.rotor();
    soundTimers.rotor = 0.11;
  }
  // Шипіння струменя води
  soundTimers.spray -= dt;
  if (spraying && soundTimers.spray <= 0) {
    sfx.spray();
    soundTimers.spray = 0.1;
  }
}
