// =============================================================
// weather.js — погода: температура, вологість, вітер,
// індекс пожежної небезпеки. Погода змінюється під час рівня.
// =============================================================

// План погоди на рівень: у певну секунду погода стає такою.
// Між пунктами плану погода змінюється ПЛАВНО.
//   temp — температура °C, hum — вологість %,
//   windDir — куди дме вітер у градусах (0 = на схід, 90 = на південь,
//             -90 = на північ, 180 = на захід), wind — сила від 0 до 1,
//   msg — повідомлення гравцю, коли настає цей момент.
var LEVEL1_WEATHER = [
  { t: 0,   temp: 27, hum: 45, windDir: 0,   wind: 0.5 },
  { t: 60,  temp: 32, hum: 30, windDir: 0,   wind: 0.6,
    msg: "Спека посилюється, вологість падає!" },
  { t: 110, temp: 34, hum: 25, windDir: -45, wind: 0.8,
    msg: "Вітер повертає і дме на північний схід!" },
  { t: 180, temp: 30, hum: 35, windDir: -45, wind: 0.5,
    msg: "Трохи похолоднішало." }
];

// ДЕМО (1 хвилина): підказки для глядача + поворот вітру на 30-й секунді
var DEMO_WEATHER = [
  { t: 0,  temp: 31, hum: 32, windDir: 0,   wind: 0.6 },
  { t: 4,  temp: 31, hum: 32, windDir: 0,   wind: 0.6,
    msg: "Вогонь у степу йде за вітром на село — шли вертоліт і бригаду!" },
  { t: 14, temp: 32, hum: 30, windDir: 0,   wind: 0.6,
    msg: "А вогонь у Дубовому гаю сам упреться в річку — його можна не гасити." },
  { t: 26, temp: 33, hum: 28, windDir: 0,   wind: 0.7,
    msg: "Увага: за прогнозом зараз поверне вітер!" },
  { t: 32, temp: 34, hum: 25, windDir: -45, wind: 0.8,
    msg: "Вітер повернув на північний схід — перевір, що тепер під загрозою!" },
  { t: 60, temp: 33, hum: 27, windDir: -45, wind: 0.7 }
];

// Рівень 2: суха спека, вітер повертає кілька разів
var LEVEL2_WEATHER = [
  { t: 0,   temp: 31, hum: 30, windDir: 0,   wind: 0.6 },
  { t: 50,  temp: 35, hum: 22, windDir: 45,  wind: 0.7,
    msg: "Спека! Вітер повертає — тепер дме на південний схід." },
  { t: 100, temp: 37, hum: 18, windDir: 90,  wind: 0.8,
    msg: "Вітер північний — вогонь піде на південь!" },
  { t: 150, temp: 38, hum: 15, windDir: -90, wind: 0.9,
    msg: "Вітер різко змінився: сильний південний!" },
  { t: 210, temp: 34, hum: 20, windDir: -90, wind: 0.6 }
];

// Рівень 3: буревій у пекельну спеку
var LEVEL3_WEATHER = [
  { t: 0,   temp: 36, hum: 18, windDir: 180, wind: 0.8 },
  { t: 40,  temp: 38, hum: 15, windDir: 135, wind: 0.9,
    msg: "Вітер посилюється! Дме на південний захід." },
  { t: 90,  temp: 40, hum: 12, windDir: 45,  wind: 1.0,
    msg: "БУРЕВІЙ! Вітер розвернувся на південний схід!" },
  { t: 140, temp: 39, hum: 12, windDir: -45, wind: 0.9,
    msg: "Вітер знову повертає — тепер на північний схід." },
  { t: 220, temp: 35, hum: 18, windDir: -45, wind: 0.7 }
];

// Назви рівнів небезпеки (як класи пожежної небезпеки від 1 до 5)
var DANGER_NAMES = ["низька", "помірна", "висока", "дуже висока", "надзвичайна"];
var DANGER_COLORS = ["#4ac05a", "#c0c04a", "#ffb84a", "#ff7a1a", "#e03a2a"];

// Назви вітру. Вітер називають за тим, ЗВІДКИ він дме:
// «західний» дме із заходу на схід. Порядок: дме на 0°, 45°, 90°... (за годинниковою)
var WIND_FROM_NAMES = ["західний", "північно-західний", "північний", "північно-східний",
                       "східний", "південно-східний", "південний", "південно-західний"];

function createWeather(plan) {
  var w = {
    plan: plan,
    nextMsg: 1,   // номер наступного пункту плану з повідомленням
    temp: 0, hum: 0,
    wind: { x: 1, y: 0, strength: 0, name: "" },
    danger: 0,       // небезпека від 0 до 1
    dangerLevel: 0,  // клас від 0 до 4 (показуємо як 1..5)
    fireFactor: 1    // множник для вогню
  };
  updateWeather(w, 0);
  return w;
}

// Обмежує число між 0 і 1
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// Оновлює погоду. Повертає текст повідомлення, якщо настала зміна погоди.
function updateWeather(w, time) {
  var plan = w.plan;

  // 1) Шукаємо, між якими пунктами плану ми зараз
  var a = plan[0], b = plan[0];
  for (var i = 0; i < plan.length; i++) {
    if (plan[i].t <= time) {
      a = plan[i];
      b = plan[Math.min(i + 1, plan.length - 1)];
    }
  }
  // k — наскільки ми просунулись від a до b (від 0 до 1)
  var k = (b.t > a.t) ? clamp01((time - a.t) / (b.t - a.t)) : 0;
  function mix(va, vb) { return va + (vb - va) * k; }

  // 2) Плавно змішуємо значення + маленькі коливання, щоб погода «жила»
  w.temp = mix(a.temp, b.temp) + Math.sin(time * 0.3) * 0.5;
  w.hum = mix(a.hum, b.hum) + Math.sin(time * 0.23 + 1) * 1.5;
  var dirDeg = mix(a.windDir, b.windDir) + Math.sin(time * 0.17) * 6;
  w.wind.strength = clamp01(mix(a.wind, b.wind) + Math.sin(time * 0.41) * 0.05);

  // 3) Напрямок вітру з кута: x = cos, y = sin (на екрані y росте вниз)
  var rad = dirDeg * Math.PI / 180;
  w.wind.x = Math.cos(rad);
  w.wind.y = Math.sin(rad);
  // Назва: ділимо коло на 8 частин по 45°. Список WIND_FROM_NAMES
  // іде саме в такому порядку: 0° (дме на схід) = «західний», 45° = «північно-західний»...
  var deg360 = ((dirDeg % 360) + 360) % 360;
  w.wind.name = WIND_FROM_NAMES[Math.round(deg360 / 45) % 8];

  // 4) Індекс пожежної небезпеки:
  //    що спекотніше, сухіше і вітряніше — то небезпечніше
  var heat = clamp01((w.temp - 15) / 25);   // 15°C → 0,  40°C → 1
  var dry = clamp01((70 - w.hum) / 60);     // 70% → 0,   10% → 1
  w.danger = 0.45 * heat + 0.35 * dry + 0.2 * w.wind.strength;
  var limits = [0.25, 0.45, 0.65, 0.8];
  w.dangerLevel = 0;
  while (w.dangerLevel < 4 && w.danger >= limits[w.dangerLevel]) w.dangerLevel++;

  // 5) Множник для вогню: у сильну спеку вогонь швидший і осередків більше
  //    (від 0.6 у прохолоду до 1.5 у найсильнішу спеку)
  w.fireFactor = 0.6 + w.danger * 0.9;

  // 6) Повідомлення про зміну погоди (кожне — лише один раз)
  if (w.nextMsg < plan.length && time >= plan[w.nextMsg].t) {
    var msg = plan[w.nextMsg].msg;
    w.nextMsg++;
    return msg || null;
  }
  return null;
}

// Віконце погоди у правому верхньому куті: стрілка вітру, температура, вологість
function drawWeatherHUD(ctx, w) {
  var bx = MAP_W * TILE - 150, by = 6;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(bx, by, 144, 66);

  // Стрілка вітру (що сильніший вітер — то довша)
  var cx = bx + 30, cy = by + 28;
  var len = 8 + w.wind.strength * 12;
  var ex = cx + w.wind.x * len, ey = cy + w.wind.y * len;
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - w.wind.x * len, cy - w.wind.y * len);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex + w.wind.x * 6, ey + w.wind.y * 6);
  ctx.lineTo(ex - w.wind.y * 6, ey + w.wind.x * 6);
  ctx.lineTo(ex + w.wind.y * 6, ey - w.wind.x * 6);
  ctx.fill();

  ctx.font = "bold 11px monospace";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillText("ВІТЕР", cx, by + 60);
  ctx.textAlign = "left";

  // Температура, вологість і небезпека
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = w.temp >= 32 ? "#ff7a1a" : "#ffffff";
  ctx.fillText(Math.round(w.temp) + "°C", bx + 64, by + 20);
  ctx.fillStyle = "#9ad0ff";
  ctx.fillText(Math.round(w.hum) + "% вол.", bx + 64, by + 38);
  ctx.fillStyle = DANGER_COLORS[w.dangerLevel];
  ctx.fillText("Клас " + (w.dangerLevel + 1), bx + 64, by + 56);
}
