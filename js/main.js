// =============================================================
// main.js — головний файл: рівні, фази гри, ігровий цикл, миша, клавіші.
//
// Фази гри:
//   "shop"  — магазин: прогноз, поради, закупівля;
//   "place" — розстановка техніки на карті (вогню ще немає, час стоїть);
//   "play"  — боротьба з вогнем у реальному часі.
// =============================================================

var canvas = document.getElementById("game");
var ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;   // вимикаємо згладжування — пікселі чіткі

// ---------- РІВНІ ----------
var LEVELS = [
  {
    name: "РІВЕНЬ 1: Калинівка",
    layout: LEVEL1_LAYOUT,
    geo: LEVEL1_GEO,     // річки, озера, пагорби, дороги цього рівня (map.js)
    seed: 12345,
    weather: LEVEL1_WEATHER,
    budget: 1400,
    duration: 210,       // скільки секунд триває рівень
    fireEvery: 16,       // як часто виникають нові осередки (секунд, у спеку частіше)
    startFires: 3,       // скільки осередків горить одразу на старті
    goal: { houses: 10, value: 0.65 },  // мета: будинків і частка цінності
    tips: [
      "Вітер західний — вогонь піде НА СХІД. Село Калинівка стоїть на шляху вогню із Сухого степу!",
      "Угору схилом вогонь біжить швидше, униз — повільніше. Соснова гора на півночі небезпечна!",
      "Вертоліт набирає воду з річки чи озера. Що ближче вода до пожежі — то частіше він скидає воду.",
      "Річка, озеро, скелі й дороги — природні перешкоди. Очерет на вологому березі й болото горять погано.",
      "Ґрунтові дороги ведуть машини в ліс, а через брід — за річку, аж до заповідника.",
      "Протипожежну смугу риють ПЕРЕД вогнем. Найкраще — від річки до дороги, щоб вогонь не обійшов.",
      "На 2-й хвилині вітер поверне на північний схід — заздалегідь подумай, що опиниться на шляху вогню."
    ]
  },
  {
    name: "РІВЕНЬ 2: Суха спека",
    layout: LEVEL2_LAYOUT,
    geo: LEVEL2_GEO,
    seed: 777,
    weather: LEVEL2_WEATHER,
    budget: 1100,
    duration: 220,
    fireEvery: 12,
    startFires: 4,
    goal: { houses: 9, value: 0.55 },
    tips: [
      "Зі сходу від села тепер суха трава, а не поле — природного захисту з того боку немає.",
      "Вітер повертатиме тричі: на південний схід, на південь, а потім різко на північ. Стеж за стрілкою!",
      "Бригада риє смугу впоперек ТЕПЕРІШНЬОГО вітру. Якщо вітер повернув — смуга може стати марною.",
      "Без вежі пожежу помітять лише через 15 секунд. За цей час вогонь у сухій траві розбіжиться далеко.",
      "Не намагайся врятувати все. Що цінніше: Сухі пагорби (5) чи Заповідник (80)?"
    ]
  },
  {
    name: "РІВЕНЬ 3: Буревій",
    layout: LEVEL3_LAYOUT,
    geo: LEVEL3_GEO,
    seed: 4242,
    weather: LEVEL3_WEATHER,
    budget: 1000,
    duration: 230,
    fireEvery: 9,
    startFires: 4,
    goal: { houses: 8, value: 0.3 },
    tips: [
      "40°C і вологість 12% — надзвичайна небезпека! Вогонь буде дуже швидким, осередків — багато.",
      "Сильний вітер несе іскри через дороги і навіть зрідка через річку.",
      "Тут ДВА заповідники за річкою. Вертоліт — єдине, що швидко туди дістанеться.",
      "Грошей мало. Краще захистити головне, ніж розпорошитися на все.",
      "Пам'ятай: перегрітий пожежник ледве ходить. Відпочивай у тіні чи біля води."
    ]
  }
];

// ДЕМО: короткий рівень на 1 хвилину з уже купленою і розставленою технікою.
// Пожежі стоять у «показових» місцях: одна йде на село (треба гасити),
// друга — у Ялиннику біля річки (можна не гасити, впреться у воду).
var DEMO_LEVEL = {
  name: "ДЕМО: Калинівка за 1 хвилину",
  layout: LEVEL1_LAYOUT,
  geo: LEVEL1_GEO,
  seed: 12345,
  weather: DEMO_WEATHER,
  budget: 1200,
  duration: 60,
  fireEvery: 1000,               // нових випадкових пожеж у демо немає
  fixedFires: [[4, 13], [5, 14], [28, 3]],
  goal: { houses: 10, value: 0.5 },
  cart: { truck: 1, heli: 1, brigade: 1, tower: 1 },
  // Де стоїть техніка на старті (клітинки)
  spots: { truck: [15, 15], brigade: [12, 15], tower: [8, 16] }
};

// Поточний рівень (звичайний або демо)
function currentLevel() {
  return game.demo ? DEMO_LEVEL : LEVELS[game.level];
}

// Стан гри
var game = {
  demo: false,        // чи це демо
  paused: false,      // пауза (клавіша P)
  seenFire: 0,        // скільки палаючих клітинок видно (для звуку)
  level: 0,           // номер рівня
  phase: "shop",      // фаза гри
  cart: {},           // покупки в магазині
  map: null,          // карта
  time: 0,            // скільки секунд минуло
  showSectors: true,  // чи показувати межі секторів
  hoverSector: null,  // сектор під мишкою
  player: null,       // пожежник (запасний, керуєш WASD)
  units: [],          // куплена техніка
  selected: null,     // вибрана одиниця техніки
  keys: {},           // які клавіші зараз натиснуті
  weather: null,      // погода (температура, вологість, вітер) — див. weather.js
  message: null,      // повідомлення вгорі екрана: { text, left — скільки ще секунд }
  panelTimer: 0       // щоб оновлювати панель не кожен кадр
};

// ---------- Запуск ----------
function start() {
  loadSprites();
  setupLegend();
  showMenu();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

// ---------- ГОЛОВНЕ МЕНЮ ----------
function showMenu() {
  game.demo = false;
  game.level = 0;
  // Карта рівня 1 на фоні меню
  var level = LEVELS[0];
  game.map = buildMap(level.layout, level.seed, level.geo);
  HELI_BASE = level.geo.heliBase;
  initFire(game.map, level.fireEvery);
  game.player = createPlayer(17, 14);
  game.weather = createWeather(level.weather);
  game.units = [];
  game.selected = null;
  game.message = null;
  messageQueue = [];
  game.phase = "menu";
  updateBottomBar();
  updateWeatherPanel();

  var box = document.getElementById("shop");
  box.style.display = "block";
  box.innerHTML =
    "<div class='menu'>" +
      "<h2 class='menu-title'>🌲 ЛІСОВИЙ ВАРТОВИЙ 🔥</h2>" +
      "<p>Ти — командир лісової служби. Спека, сухий вітер, пожежі виникають одна за одною.<br>" +
      "Грошей на все не вистачить: <b>вирішуй, що рятувати першим</b>, а де дати вогню<br>" +
      "вигоріти до річки чи дороги.</p>" +
      "<p><button id='btn-play' class='big-btn'>▶ ГРАТИ</button></p>" +
      "<p><button id='btn-demo' class='big-btn'>🎬 ДЕМО (1 хвилина)</button></p>" +
      "<p><button id='btn-sound'>" + (sfx.on ? "🔊 Звук: увімк." : "🔇 Звук: вимк.") + "</button></p>" +
      "<p class='hint'>3 рівні • купуй техніку • керуй мишкою • вчись на «Розборі рішень»<br>" +
      "Побачив справжню пожежу — телефонуй 101 або 112!</p>" +
    "</div>";
  document.getElementById("btn-play").onclick = function () {
    sfx.init(); sfx.click();
    game.level = 0;
    game.cart = {};
    newGame();
  };
  document.getElementById("btn-demo").onclick = function () {
    sfx.init(); sfx.click();
    startDemo();
  };
  document.getElementById("btn-sound").onclick = function () {
    toggleSound();
    this.textContent = sfx.on ? "🔊 Звук: увімк." : "🔇 Звук: вимк.";
  };
}

function toggleSound() {
  sfx.on = !sfx.on;
  sfx.init();
  showMessage(sfx.on ? "Звук увімкнено" : "Звук вимкнено", true);
}

// ---------- ДЕМО ----------
// Без магазину і розстановки: одразу бій з готовою технікою
function startDemo() {
  game.demo = true;
  game.cart = {};
  for (var k in DEMO_LEVEL.cart) game.cart[k] = DEMO_LEVEL.cart[k];
  newGame(true);                     // true — не показувати магазин
  game.units = createUnits(game.cart);
  game.units.forEach(function (u) {
    var spot = DEMO_LEVEL.spots[u.type];
    if (spot) placeUnit(game.map, u, spot[0], spot[1]);
  });
  document.getElementById("shop").style.display = "none";
  startPlay();
}

// Нова гра: свіжа карта, без вогню, відкриваємо магазин
function newGame(noShop) {
  var level = currentLevel();
  game.map = buildMap(level.layout, level.seed, level.geo);
  HELI_BASE = level.geo.heliBase;
  initFire(game.map, level.fireEvery);
  game.player = createPlayer(17, 14);   // пожежник біля перехрестя в селі
  game.weather = createWeather(level.weather);
  game.units = [];
  game.selected = null;
  game.message = null;
  messageQueue = [];
  game.time = 0;
  game.phase = "shop";
  game.paused = false;
  updateBottomBar();
  updateWeatherPanel();
  if (!noShop) showShop(level, game.cart, startPlacement);
}

// Після магазину: створюємо техніку і переходимо до розстановки
function startPlacement() {
  game.units = createUnits(game.cart);
  // Покупки для пожежника
  var p = game.player;
  p.maxWater = 100 + 50 * (game.cart.tank || 0);
  p.water = p.maxWater;
  if (game.cart.snacks) {
    p.speed *= 1.15;
    p.heatMult = 0.8;
  }
  game.phase = "place";
  game.selected = null;
  showMessage("Розстав техніку: вибери її і клікни на карту");
  updateBottomBar();
}

// Кнопка «Почати»: вогонь і погода оживають
function startPlay() {
  blurButtons();
  game.phase = "play";
  game.selected = null;
  var level = currentLevel();
  if (level.fixedFires) {
    // Демо: пожежі в заданих місцях, і їх одразу видно
    level.fixedFires.forEach(function (f) {
      ignite(game.map, f[0], f[1]);
      game.map.sectorOf[f[1]][f[0]].detected = true;
    });
    showMessage("ДЕМО: техніка вже куплена. Клікни на техніку, потім — на вогонь!");
  } else {
    // Кілька осередків одразу — їх ще треба помітити!
    for (var i = 0; i < level.startFires; i++) igniteRandom(game.map);
    showMessage("Почалося! Десь уже горить — шукай дим.");
  }
  updateBottomBar();
}

// Кінець рівня: показуємо результати
function endLevel(villageLost) {
  game.phase = "result";
  game.selected = null;
  updateBottomBar();
  var level = currentLevel();
  var r = computeResults(game.map, level, game.cart, villageLost);
  if (r.win) sfx.win(); else sfx.lose();
  // Наприкінці показуємо ВСЮ карту, навіть пожежі, яких ніхто не помітив
  for (var y = 0; y < MAP_H; y++) for (var x = 0; x < MAP_W; x++) game.map.seen[y][x] = true;
  showResults(r, level, game.demo || game.level === LEVELS.length - 1,
    function () {           // «Наступний рівень»
      game.level++;
      game.cart = {};
      newGame();
    },
    function () {           // «Спробувати ще» (покупки залишаються в кошику)
      if (game.demo) startDemo(); else newGame();
    },
    game.map, game.units, game.cart,
    showMenu);              // «Меню»
}

// Показати повідомлення вгорі екрана на 4 секунди
// quiet = true — без звукового сигналу.
// Кожне повідомлення висить щонайменше 2.5 с; якщо прийшло нове — воно чекає в черзі.
var messageQueue = [];
function showMessage(text, quiet) {
  if (game.message && game.message.text === text) return;   // те саме вже на екрані
  var msg = { text: text, left: 4, shown: 0, quiet: quiet };
  if (!game.message || game.message.shown >= 2.5) {
    game.message = msg;
    if (!quiet) sfx.alert();
  } else {
    messageQueue.push(msg);
    if (messageQueue.length > 3) messageQueue.shift();       // забагато — найстаріше викидаємо
  }
}

// ---------- Ігровий цикл ----------
// requestAnimationFrame викликає loop приблизно 60 разів на секунду.
// dt (delta time) — скільки секунд минуло з минулого кадру.
// Завдяки dt гра працює однаково швидко на слабкому і сильному комп'ютері.
var lastTime = 0;
function loop(now) {
  var dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.1) dt = 0.1;   // якщо вкладка «заснула», не робимо гігантський крок

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// Оновлення логіки
function update(dt) {
  if (game.restartAsk > 0) game.restartAsk -= dt;   // час на підтвердження «заново»
  if (game.message) {
    game.message.left -= dt;
    game.message.shown += dt;
    // Час минув або в черзі хтось чекає, а це вже висіло 2.5 с — показуємо наступне
    if (game.message.left <= 0 || (messageQueue.length > 0 && game.message.shown >= 2.5)) {
      game.message = messageQueue.shift() || null;
      if (game.message && !game.message.quiet) sfx.alert();
    }
  }
  // Панель оновлюємо 4 рази на секунду — цього досить
  game.panelTimer -= dt;
  if (game.panelTimer <= 0) {
    game.panelTimer = 0.25;
    updateFirePanel();
    updateWeatherPanel();
    updateGoalPanel();
    updateUnitStatuses();
  }

  if (game.phase !== "play" || game.paused) return;   // у магазині, на розстановці і на паузі час стоїть

  game.time += dt;
  updatePlayer(game.player, game.map, game.keys, dt);
  updateWater(game.player, game.map, game.keys, dt);

  // Погода змінюється з часом. Якщо сталася зміна — показуємо повідомлення.
  var w = game.weather;
  var weatherMsg = updateWeather(w, game.time);
  if (weatherMsg) showMessage(weatherMsg);

  // Погода впливає на вогонь (fireFactor) і на перегрів пожежника
  updateHeat(game.player, game.map, w, dt);
  updateIgnitions(game.map, w.fireFactor, dt);
  updateFire(game.map, w.wind, w.fireFactor, dt);
  updateUnits(game.units, game.map, w.wind, dt);

  // Чи помітили нову пожежу?
  var found = updateDetection(game.map, game.units, dt);
  if (found.length > 0) showMessage(found[0]);

  // Звуки: тріск вогню, гул вертольота, шипіння води
  var heliFlying = game.units.some(function (u) {
    return u.type === "heli" && (u.state === "fly" || u.state === "return" || u.state === "toWater");
  });
  var spraying = game.player.spraying || game.units.some(function (u) { return u.sprayTargets && u.sprayTargets.length > 0; });
  updateSounds(dt, game.seenFire, heliFlying, spraying);

  // Кінець рівня: вийшов час або згоріло забагато будинків
  var level = currentLevel();
  var lostHouses = game.map.houseTotal - housesLeft(game.map);
  if (lostHouses > game.map.houseTotal - level.goal.houses) {
    endLevel(true);
  } else if (game.time >= level.duration) {
    endLevel(false);
  }
}

// Показує в панелі, як просувається мета рівня
function updateGoalPanel() {
  var level = currentLevel();
  var houses = housesLeft(game.map);
  var v = computeValue(game.map);
  var hColor = houses >= level.goal.houses ? "#8cc05a" : "#e03a2a";
  var vColor = v.pct >= level.goal.value ? "#8cc05a" : "#e03a2a";
  document.getElementById("goal-info").innerHTML =
    "Будинки: <span style='color:" + hColor + "'>" + houses + " / " + game.map.houseTotal +
    "</span> (треба ≥ " + level.goal.houses + ")<br>" +
    "Цінність: <span style='color:" + vColor + "'>" + Math.round(v.pct * 100) +
    "%</span> (треба ≥ " + Math.round(level.goal.value * 100) + "%)";
}

// Чи бачимо вогонь у клітинці (непомічені пожежі не малюються)
function isVisible(x, y) {
  return fireVisible(game.map, game.units, game.player, x, y);
}

// Показує в панелі погоду та індекс пожежної небезпеки
function updateWeatherPanel() {
  var w = game.weather;
  var color = DANGER_COLORS[w.dangerLevel];
  document.getElementById("weather-info").innerHTML =
    "Температура: " + Math.round(w.temp) + "°C<br>" +
    "Вологість: " + Math.round(w.hum) + "%<br>" +
    "Вітер: " + w.wind.name + ", сила " + Math.round(w.wind.strength * 10) + "/10<br>" +
    "Небезпека: <span style='color:" + color + "'>клас " + (w.dangerLevel + 1) +
    " — " + DANGER_NAMES[w.dangerLevel] + "</span>" +
    // Смужка небезпеки
    "<div class='danger-bar'><div style='width:" + Math.round(w.danger * 100) +
    "%;background:" + color + "'></div></div>";
}

// Показує в панелі стан вогню (рахуємо лише ПОМІЧЕНИЙ вогонь)
function updateFirePanel() {
  var m = game.map;
  var seen = 0;
  for (var y = 0; y < MAP_H; y++) {
    for (var x = 0; x < MAP_W; x++) {
      if (m.state[y][x] === 1 && isVisible(x, y)) seen++;
    }
  }
  game.seenFire = seen;
  var html =
    "Помічено вогню: <span style='color:#ff7a1a'>" + seen + "</span> клітинок<br>" +
    "Згоріло: " + m.burntCount + "<br>" +
    "Загашено: <span style='color:#9ad0ff'>" + m.extinguished + "</span><br>" +
    "Вирито смуги: " + (m.dug || 0) + " клітинок";
  document.getElementById("fire-info").innerHTML = html;
}

// ---------- Нижня панель: кнопки техніки ----------
function updateBottomBar() {
  var bar = document.getElementById("unit-bar");
  bar.innerHTML = "";
  if (game.phase === "shop" || game.phase === "menu") return;

  game.units.forEach(function (u, i) {
    var btn = document.createElement("button");
    btn.className = "unit-btn" + (u === game.selected ? " selected" : "");
    var icon = document.createElement("canvas");
    icon.width = 8; icon.height = 8;
    icon.getContext("2d").drawImage(SPRITES[u.type], 0, 0);
    btn.appendChild(icon);
    var label = document.createElement("span");
    label.innerHTML = "<b>" + (i + 1 <= 9 ? "[" + (i + 1) + "] " : "") + unitName(u) +
      "</b><br><small id='status-" + i + "'>" + unitStatus(u) + "</small>";
    btn.appendChild(label);
    btn.onclick = function () { selectUnit(u); };
    bar.appendChild(btn);
  });

  if (game.phase === "result") return;
  if (game.units.length === 0) {
    var none = document.createElement("span");
    none.className = "hint";
    none.textContent = "Техніки немає — тільки ти і твій бак води!";
    bar.appendChild(none);
  }

  if (game.phase === "place") {
    var go = document.createElement("button");
    go.className = "big-btn";
    go.textContent = "▶ ПОЧАТИ";
    go.onclick = startPlay;
    bar.appendChild(go);
  }
}

// Оновлює лише підписи стану (не перебудовуючи кнопки)
function updateUnitStatuses() {
  for (var i = 0; i < game.units.length; i++) {
    var el = document.getElementById("status-" + i);
    if (el) el.textContent = unitStatus(game.units[i]);
  }
}

// Прибирає фокус з кнопки, щоб ПРОБІЛ не «натискав» її ще раз
function blurButtons() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function selectUnit(u) {
  blurButtons();
  game.selected = (game.selected === u) ? null : u;   // повторний клік знімає вибір
  updateBottomBar();
}

// ---------- Малювання ----------
function draw() {
  drawMap(ctx, game.map, game.time);
  drawFire(ctx, game.map, game.time, isVisible);
  if (game.showSectors) drawSectorGrid();
  if (game.hoverSector) drawSectorHighlight(game.hoverSector);
  drawPlayer(ctx, game.player);
  drawDrops(ctx, game.player);
  drawUnits(ctx, game.units, game.selected, game.time);
  drawWeatherHUD(ctx, game.weather);
  drawPlayerHUD(ctx, game.player, game.time);
  drawHeatHaze();
  if (game.phase === "play") drawTimer();
  if (game.paused) drawPause();
  drawDragLine();
  if (game.message) drawMessage(game.message.text);
}

// Жар по краях екрана: що більша пожежна небезпека — то помітніший
function drawHeatHaze() {
  var d = game.weather.danger;
  if (d < 0.5 || game.phase === "menu") return;
  var w = MAP_W * TILE, h = MAP_H * TILE;
  var grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, w * 0.62);
  grad.addColorStop(0, "rgba(255, 120, 20, 0)");
  grad.addColorStop(1, "rgba(255, 90, 10, " + ((d - 0.5) * 0.7).toFixed(2) + ")");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// Напис «ПАУЗА» посередині
function drawPause() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, MAP_W * TILE, MAP_H * TILE);
  ctx.font = "bold 40px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#000";
  ctx.strokeText("ПАУЗА", MAP_W * TILE / 2, MAP_H * TILE / 2);
  ctx.fillStyle = "#ffe066";
  ctx.fillText("ПАУЗА", MAP_W * TILE / 2, MAP_H * TILE / 2);
  ctx.font = "bold 14px monospace";
  ctx.fillStyle = "#fff";
  ctx.fillText("натисни P, щоб продовжити", MAP_W * TILE / 2, MAP_H * TILE / 2 + 34);
  ctx.textAlign = "left";
}

// Скільки часу лишилося до кінця рівня (вгорі ліворуч)
function drawTimer() {
  var left = Math.max(0, currentLevel().duration - game.time);
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(6, 6, 72, 24);
  ctx.fillStyle = left < 20 ? "#ffb84a" : "#ffffff";
  ctx.font = "bold 14px monospace";
  ctx.textBaseline = "middle";
  ctx.fillText("⏱ " + formatTime(left), 12, 18);
}

// Повідомлення: темна смуга з текстом угорі по центру карти
function drawMessage(text) {
  ctx.font = "bold 15px monospace";
  var w = ctx.measureText(text).width + 30;
  var x = (MAP_W * TILE - w) / 2;
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(x, 84, w, 30);
  ctx.strokeStyle = "#ffb84a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, 84, w, 30);
  ctx.fillStyle = "#ffe066";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, MAP_W * TILE / 2, 100);
  ctx.textAlign = "left";
}

// ---------- Межі та назви секторів ----------
// Малює межі сектора (або всіх секторів, якщо onlySector = null).
// Ідемо по клітинках: якщо сусід праворуч чи знизу з іншого сектора —
// між ними малюємо відрізок межі. Так межа повторює звивисту форму.
function drawBorders(onlySector, color, width) {
  var m = game.map;
  ctx.fillStyle = color;
  for (var y = 0; y < MAP_H; y++) {
    for (var x = 0; x < MAP_W; x++) {
      var s = m.sectorOf[y][x];
      if (onlySector) {
        // Для одного сектора перевіряємо всі 4 боки, включно з краєм карти
        if (s !== onlySector) continue;
        if (y === 0 || m.sectorOf[y - 1][x] !== s) ctx.fillRect(x * TILE, y * TILE, TILE, width);
        if (y === MAP_H - 1 || m.sectorOf[y + 1][x] !== s) ctx.fillRect(x * TILE, (y + 1) * TILE - width, TILE, width);
        if (x === 0 || m.sectorOf[y][x - 1] !== s) ctx.fillRect(x * TILE, y * TILE, width, TILE);
        if (x === MAP_W - 1 || m.sectorOf[y][x + 1] !== s) ctx.fillRect((x + 1) * TILE - width, y * TILE, width, TILE);
      } else {
        if (x < MAP_W - 1 && m.sectorOf[y][x + 1] !== s) ctx.fillRect((x + 1) * TILE - 1, y * TILE, width, TILE);
        if (y < MAP_H - 1 && m.sectorOf[y + 1][x] !== s) ctx.fillRect(x * TILE, (y + 1) * TILE - 1, TILE, width);
      }
    }
  }
}

function drawSectorGrid() {
  drawBorders(null, "rgba(255, 255, 255, 0.4)", 2);

  // Назва кожного сектора посередині
  ctx.font = "bold 12px monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (var row = 0; row < SECTOR_ROWS; row++) {
    for (var col = 0; col < SECTOR_COLS; col++) {
      var s = game.map.sectors[row][col];
      var tx = (col + 0.5) * SECTOR_W * TILE;
      var ty = (row + 0.5) * SECTOR_H * TILE;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#000";
      ctx.strokeText(s.name, tx, ty);   // чорний контур, щоб текст читався
      ctx.fillStyle = "#fff";
      ctx.fillText(s.name, tx, ty);
    }
  }
  ctx.textAlign = "left";
}

// Жовта рамка точно по формі сектора під мишкою
function drawSectorHighlight(s) {
  drawBorders(s, "#ffd84a", 3);
}

// ---------- Миша ----------
// Canvas на екрані може бути більшим чи меншим, ніж 960×640,
// тому перераховуємо координати мишки у «пікселі гри».
function mouseToPixel(e) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}
function mouseToTile(e) {
  var p = mouseToPixel(e);
  return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
}

canvas.addEventListener("mousemove", function (e) {
  var t = mouseToTile(e);
  if (!inMap(t.x, t.y)) return;
  var s = getSector(game.map, t.x, t.y);
  game.hoverSector = s;
  hoverTile = t;
  showSectorInfo(s, game.map.tiles[t.y][t.x]);
  // Тягнемо смугу для бригади — оновлюємо кінець лінії
  if (game.drag) {
    game.drag.x1 = t.x;
    game.drag.y1 = t.y;
  }
});

canvas.addEventListener("mouseleave", function () {
  game.hoverSector = null;
});

// Відпустили кнопку миші: якщо тягнули смугу — даємо бригаді наказ.
// Якщо мишка майже не рухалась — це звичайний клік (смуга впоперек вітру).
window.addEventListener("mouseup", function () {
  var d = game.drag;
  if (!d) return;
  game.drag = null;
  var err;
  if (d.x0 === d.x1 && d.y0 === d.y1) {
    err = orderUnit(game.map, d.unit, d.x0, d.y0);
  } else {
    err = orderBrigadeLine(game.map, d.unit, d.x0, d.y0, d.x1, d.y1);
  }
  if (err) { showMessage(err, true); sfx.error(); }
  else sfx.click();
});

// Жовтий слід смуги, поки тягнемо мишкою
function drawDragLine() {
  var d = game.drag;
  if (!d) return;
  var tiles = lineTiles(d.x0, d.y0, d.x1, d.y1);
  ctx.fillStyle = "rgba(255, 216, 74, 0.5)";
  for (var i = 0; i < tiles.length; i++) {
    ctx.fillRect(tiles[i][0] * TILE, tiles[i][1] * TILE, TILE, TILE);
  }
  ctx.strokeStyle = "#ffd84a";
  ctx.lineWidth = 2;
  ctx.strokeRect(d.x0 * TILE + 1, d.y0 * TILE + 1, TILE - 2, TILE - 2);
}

// Клік: якщо клікнули по техніці — вибираємо її.
// Якщо техніка вже вибрана — даємо їй наказ їхати/летіти/рити сюди.
canvas.addEventListener("mousedown", function (e) {
  if (game.phase === "shop" || game.phase === "result" || game.phase === "menu") return;
  var p = mouseToPixel(e);
  var t = mouseToTile(e);

  // 1) Чи клікнули по техніці?
  for (var i = 0; i < game.units.length; i++) {
    var u = game.units[i];
    if (Math.abs(u.x - p.x) < 12 && Math.abs(u.y - p.y) < 12) {
      selectUnit(u);
      return;
    }
  }

  // 2) Наказ вибраній техніці
  if (!game.selected || !inMap(t.x, t.y)) return;

  // Бригада під час гри: починаємо «тягнути» смугу (наказ — коли відпустиш кнопку)
  if (game.phase === "play" && game.selected.type === "brigade") {
    game.drag = { unit: game.selected, x0: t.x, y0: t.y, x1: t.x, y1: t.y };
    return;
  }

  var err;
  if (game.phase === "place") err = placeUnit(game.map, game.selected, t.x, t.y);
  else err = orderUnit(game.map, game.selected, t.x, t.y);
  if (err) { showMessage(err, true); sfx.error(); }
  else sfx.click();
});

var hoverTile = { x: 0, y: 0 };   // клітинка під мишкою

// Як назвати висоту клітинки
function reliefName(map, x, y) {
  var h = map.height[y][x];
  if (h > 0.7) return "вершина гори";
  if (h > 0.35) return "схил (угору вогонь швидший!)";
  if (h > 0.12) return "пагорб";
  return "рівнина";
}

// Показує інформацію про сектор у бічній панелі
function showSectorInfo(s, tileType) {
  document.getElementById("sector-info").innerHTML =
    "<b style='color:#ffd84a'>" + s.name + "</b><br>" +
    "Тип: " + s.info.name + "<br>" +
    "Рельєф: " + reliefName(game.map, hoverTile.x, hoverTile.y) + "<br>" +
    "Цінність: " + s.info.value + "<br>" +
    "Вогонь: " + s.info.fire + "<br>" +
    "Згоріло: " + Math.round(100 * s.burnt / Math.max(1, s.burnable)) + "%<br>" +
    "Під мишкою: " + TILE_INFO[tileType].name;
}

// ---------- Клавіші ----------
// e.code — це фізична клавіша, тому WASD працює і на українській розкладці
document.addEventListener("keydown", function (e) {
  game.keys[e.code] = true;
  if (e.code === "KeyG") game.showSectors = !game.showSectors;
  // R — повернути вибрану техніку (бригаду додому, машину по воду, вертоліт на базу)
  if (e.code === "KeyR" && game.phase === "play") {
    if (game.selected) { showMessage(recallUnit(game.map, game.selected), true); sfx.click(); }
    else { showMessage("Спершу вибери техніку, яку треба повернути", true); sfx.error(); }
  }
  // P — пауза, M — звук
  if (e.code === "KeyP" && game.phase === "play") game.paused = !game.paused;
  if (e.code === "KeyM") toggleSound();
  // Backspace двічі — почати рівень заново (щоб не натиснути випадково)
  if (e.code === "Backspace" && game.phase !== "menu") {
    e.preventDefault();
    if (game.restartAsk > 0) {
      game.restartAsk = 0;
      game.cart = game.cart || {};
      document.getElementById("shop").style.display = "none";
      if (game.demo) startDemo(); else newGame();
    } else {
      game.restartAsk = 3;
      showMessage("Почати рівень заново? Натисни Backspace ще раз");
    }
  }
  if (e.code === "Escape" && game.selected) selectUnit(game.selected);  // зняти вибір
  // Цифри 1–9 вибирають техніку
  if (e.code.indexOf("Digit") === 0) {
    var n = parseInt(e.code.substring(5), 10);
    if (n >= 1 && n <= game.units.length) selectUnit(game.units[n - 1]);
  }
  // Стрілки і пробіл не повинні прокручувати сторінку
  if (e.code.indexOf("Arrow") === 0 || e.code === "Space") e.preventDefault();
});

document.addEventListener("keyup", function (e) {
  game.keys[e.code] = false;
  if (e.code === "Space") e.preventDefault();
});

// Якщо вікно втратило фокус — «відпускаємо» всі клавіші, щоб гравець не біг сам
window.addEventListener("blur", function () {
  game.keys = {};
});

// ---------- Легенда в панелі ----------
function setupLegend() {
  var items = [T.CONIFER, T.DECIDUOUS, T.GRASS, T.FIELD, T.OLDTREE,
               T.HOUSE, T.WATER, T.ROAD, T.BRIDGE, T.FIREBREAK,
               T.REEDS, T.SWAMP, T.ROCK, T.DIRT, T.FORD];
  var box = document.getElementById("legend");
  for (var i = 0; i < items.length; i++) {
    var info = TILE_INFO[items[i]];
    var row = document.createElement("div");
    row.className = "legend-row";
    var c = document.createElement("canvas");
    c.width = 8;
    c.height = 8;
    c.getContext("2d").drawImage(SPRITES[info.sprites[0]], 0, 0);
    row.appendChild(c);
    row.appendChild(document.createTextNode(info.name));
    box.appendChild(row);
  }
}

start();
