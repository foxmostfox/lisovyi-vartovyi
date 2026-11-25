// =============================================================
// units.js — куплена техніка: пожежні машини, вертольоти,
// бригади з лопатами, вежі спостереження.
// Керування: вибрати одиницю (клік по ній, кнопка внизу або цифра),
// потім клікнути на карту — вона поїде/полетить туди і працюватиме сама.
// =============================================================

// ---------- Спрайти техніки ----------
SPRITE_DATA.truck = [
  "........",
  "kkkkk...",
  "lllllii.",
  "llllllil",
  "llllllll",
  "looolllu",
  ".nn..nn.",
  "........"
];
SPRITE_DATA.heli = [
  "........",
  "...vv...",
  "..vvvv..",
  "..viiv..",
  "..vvvv..",
  "...vv...",
  "...nn...",
  "..vvvv.."
];
SPRITE_DATA.brigade = [
  "........",
  ".yy..yy.",
  ".ww..ww.",
  "bbbfbbbf",
  "bbbfbbbf",
  ".bb.fbb.",
  ".bb..bb.",
  ".nn..nn."
];
SPRITE_DATA.tower = [
  "..llll..",
  ".llllll.",
  "..fmmf..",
  "..f..f..",
  "..ffff..",
  ".f....f.",
  ".f....f.",
  "f......f"
];

// ---------- Налаштування техніки (для балансу) ----------
var UNIT = {
  truck:   { name: "Машина",    speed: 70,  water: 80,  radius: 2, use: 5, refill: 25 },
  heli:    { name: "Вертоліт",  speed: 170, radius: 2.5, scoopTime: 3 },
  brigade: { name: "Бригада",   speed: 50,  digTime: 1.0, stripHalf: 3 },
  tower:   { name: "Вежа",      radius: 9 }
};
var DETECT_DELAY = 15;     // без вежі пожежу помітять (подзвонять 101) через стільки секунд
var HELI_BASE = { x: 27, y: 11 };   // вертолітний майданчик (клітинка), на кожному рівні свій

// Початкові місця для техніки (клітинки), гравець може переставити до старту
var START_SPOTS = {
  truck:   [[18, 13], [16, 15], [20, 15]],
  brigade: [[14, 15], [12, 15], [22, 15]],
  tower:   [[14, 12], [21, 16], [17, 18]]
};

// Створює техніку за покупками. bought — наприклад { truck: 2, heli: 1 }
function createUnits(bought) {
  var units = [];
  var types = ["truck", "heli", "brigade", "tower"];
  for (var t = 0; t < types.length; t++) {
    var type = types[t];
    var count = bought[type] || 0;
    for (var i = 0; i < count; i++) {
      var u = {
        type: type,
        num: i + 1,             // номер: «Машина 2»
        x: 0, y: 0,             // позиція в пікселях (центр)
        state: "idle",          // що робить зараз
        path: [],               // маршрут по клітинках
        sprayTargets: [],       // куди зараз ллє воду (для малювання)
        // Для «Розбору рішень»:
        ext: 0,                 // скільки клітинок загасила
        drops: 0,               // скільки разів вертоліт скинув воду
        dug: 0,                 // скільки клітинок смуги вирила бригада
        detections: 0           // скільки пожеж помітила вежа
      };
      if (type === "heli") {
        u.homeX = (HELI_BASE.x + 0.5) * TILE + i * 18;  // кожен вертоліт — своє місце
        u.homeY = (HELI_BASE.y + 0.5) * TILE;
        u.x = u.homeX;
        u.y = u.homeY;
        u.state = "ready";     // на старті бак уже повний
        u.reload = 0;          // скільки ще набирати воду (секунд)
      } else {
        var spot = START_SPOTS[type][i % START_SPOTS[type].length];
        u.x = (spot[0] + 0.5) * TILE;
        u.y = (spot[1] + 0.5) * TILE;
        u.home = { x: spot[0], y: spot[1] };   // куди повертатися по клавіші R
      }
      if (type === "truck") u.water = UNIT.truck.water;
      if (type === "brigade") { u.digList = []; u.digTimer = 0; }
      units.push(u);
    }
  }
  return units;
}

// Повна назва одиниці: «Вертоліт 1»
function unitName(u) {
  return UNIT[u.type].name + " " + u.num;
}

// Клітинка, на якій стоїть одиниця
function unitTile(u) {
  return { x: Math.floor(u.x / TILE), y: Math.floor(u.y / TILE) };
}

// ---------- Пошук шляху (BFS — «пошук у ширину») ----------
// Як хвиля від каменя у воді: спершу перевіряємо всі клітинки на відстані 1,
// потім 2, потім 3... Перша хвиля, що дійде до цілі, — найкоротший шлях.
// canPass(x, y) — чи можна пройти клітинку (для машини — лише дорога).
function findPath(map, sx, sy, tx, ty, canPass) {
  var prev = {};                // звідки ми прийшли в кожну клітинку
  var queue = [[sx, sy]];
  prev[sx + "," + sy] = null;
  while (queue.length > 0) {
    var cur = queue.shift();
    if (cur[0] === tx && cur[1] === ty) {
      // Дійшли! Відновлюємо шлях з кінця на початок
      var path = [];
      var key = tx + "," + ty;
      while (prev[key] !== null) {
        var parts = key.split(",");
        path.unshift([+parts[0], +parts[1]]);
        key = prev[key];
      }
      return path;
    }
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var d = 0; d < 4; d++) {
      var nx = cur[0] + dirs[d][0], ny = cur[1] + dirs[d][1];
      var nkey = nx + "," + ny;
      if (!inMap(nx, ny) || nkey in prev || !canPass(nx, ny)) continue;
      prev[nkey] = cur[0] + "," + cur[1];
      queue.push([nx, ny]);
    }
  }
  return null;   // шляху немає
}

// Де може їздити машина: асфальт, міст, ґрунтовка, брід
function isRoad(map, x, y) {
  var t = map.tiles[y][x];
  return t === T.ROAD || t === T.BRIDGE || t === T.DIRT || t === T.FORD;
}

// Найближча до (x, y) клітинка дороги
function nearestRoad(map, x, y) {
  var best = null, bestDist = 1e9;
  for (var ry = 0; ry < MAP_H; ry++) {
    for (var rx = 0; rx < MAP_W; rx++) {
      if (!isRoad(map, rx, ry)) continue;
      var d = (rx - x) * (rx - x) + (ry - y) * (ry - y);
      if (d < bestDist) { bestDist = d; best = { x: rx, y: ry }; }
    }
  }
  return best;
}

// ---------- НАКАЗИ ----------
// Розстановка до початку вогню: техніка ставиться одразу (без їзди).
// Повертає текст помилки або "".
function placeUnit(map, u, tx, ty) {
  if (u.type === "heli") return "Вертоліт чекає на вертолітному майданчику";
  if (u.type === "truck") {
    var r = nearestRoad(map, tx, ty);
    u.x = (r.x + 0.5) * TILE;
    u.y = (r.y + 0.5) * TILE;
    u.home = { x: r.x, y: r.y };
    return "";
  }
  if (!isWalkable(map, tx, ty)) return "Сюди не можна поставити";
  u.x = (tx + 0.5) * TILE;
  u.y = (ty + 0.5) * TILE;
  u.home = { x: tx, y: ty };
  return "";
}

// Наказ під час гри. Повертає текст для повідомлення або "".
function orderUnit(map, u, tx, ty) {
  var from = unitTile(u);

  if (u.type === "tower") return "Вежу можна ставити лише до початку";

  if (u.type === "heli") {
    if (u.state === "fly") return unitName(u) + " ще летить до попередньої цілі";
    if (u.state === "toWater") return unitName(u) + " летить по воду до річки чи озера";
    if (u.state === "scoop") return unitName(u) + " набирає воду (" + Math.ceil(u.reload) + " с)";
    if (u.state === "return" && !u.keepWater) return unitName(u) + " летить на базу";
    // "ready" або повертається з повним баком — можна відправити
    u.keepWater = false;
    u.targetX = (tx + 0.5) * TILE;
    u.targetY = (ty + 0.5) * TILE;
    u.state = "fly";
    return "";
  }

  if (u.type === "truck") {
    // Машина їде лише дорогами: шукаємо найближчу до кліку дорогу
    var r = nearestRoad(map, tx, ty);
    var path = findPath(map, from.x, from.y, r.x, r.y, function (x, y) { return isRoad(map, x, y); });
    if (!path) return "Машина не може туди доїхати";
    u.path = path;
    u.state = "move";
    u.goingForWater = false;
    if (Math.abs(r.x - tx) + Math.abs(r.y - ty) > UNIT.truck.radius + 1) {
      return "Машина їде лише дорогами — стане на найближчій";
    }
    return "";
  }

  if (u.type === "brigade") {
    if (!isWalkable(map, tx, ty)) return "Бригада туди не пройде";
    var bpath = findPath(map, from.x, from.y, tx, ty, function (x, y) {
      return isWalkable(map, x, y) && map.state[y][x] !== 1;   // крізь вогонь не йдуть
    });
    if (!bpath) return "Бригада не знайшла дороги";
    u.path = bpath;
    u.state = "move";
    u.recalled = false;
    u.digList = [];
    u.plannedLine = null;   // звичайний клік — смуга впоперек вітру
    return "";
  }
  return "";
}

// ---------- СМУГА, ЯКУ ГРАВЕЦЬ НАМАЛЮВАВ МИШКОЮ ----------
var MAX_STRIP = 12;   // найдовша смуга (клітинок)

// Клітинки прямої лінії від (x0, y0) до (x1, y1) «сходинками»:
// кожна наступна клітинка має спільну СТОРОНУ з попередньою.
// Так у смузі немає щілин по діагоналі, і вогонь не проскочить через кут.
function lineTiles(x0, y0, x1, y1) {
  var tiles = [[x0, y0]];
  var x = x0, y = y0;
  var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  var sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
  // Робимо крок по X або по Y — туди, де ми більше «відстали» від прямої
  while ((x !== x1 || y !== y1) && tiles.length < MAX_STRIP) {
    var errX = Math.abs((x + sx - x0) * (y1 - y0) - (y - y0) * (x1 - x0));
    var errY = Math.abs((x - x0) * (y1 - y0) - (y + sy - y0) * (x1 - x0));
    if (x !== x1 && (y === y1 || errX <= errY)) x += sx;
    else y += sy;
    tiles.push([x, y]);
  }
  return tiles;
}

// Наказ бригаді: прийти на початок лінії і вирити смугу до її кінця
function orderBrigadeLine(map, u, x0, y0, x1, y1) {
  var line = lineTiles(x0, y0, x1, y1);
  // Йдемо до першої клітинки лінії, на яку можна стати
  var start = null;
  for (var i = 0; i < line.length; i++) {
    if (isWalkable(map, line[i][0], line[i][1]) && map.state[line[i][1]][line[i][0]] !== 1) {
      start = line[i];
      break;
    }
  }
  if (!start) return "Тут бригада не може рити";
  var from = unitTile(u);
  var path = findPath(map, from.x, from.y, start[0], start[1], function (x, y) {
    return isWalkable(map, x, y) && map.state[y][x] !== 1;
  });
  if (!path) return "Бригада не знайшла дороги";
  u.path = path;
  u.state = "move";
  u.recalled = false;
  u.plannedLine = line;   // після приходу риємо саме цю лінію
  u.digList = [];
  return "";
}

// ---------- ПОВЕРНЕННЯ (клавіша R) ----------
// Бригада — додому, машина — до води, вертоліт — на базу. Повертає текст повідомлення.
function recallUnit(map, u) {
  var from = unitTile(u);

  if (u.type === "tower") return "Вежа стоїть на місці";

  if (u.type === "heli") {
    if (u.state === "fly") {
      u.state = "return";
      u.keepWater = true;
      return unitName(u) + " повертається на базу з водою";
    }
    if (u.state === "ready") {
      u.state = "return";
      u.keepWater = true;
      return unitName(u) + " летить на базу";
    }
    return unitName(u) + " зараз набирає воду — зачекай";
  }

  if (u.type === "brigade") {
    var path = findPath(map, from.x, from.y, u.home.x, u.home.y, function (x, y) {
      return isWalkable(map, x, y) && map.state[y][x] !== 1;
    });
    if (!path) return "Бригада не може пройти додому";
    u.path = path;
    u.digList = [];
    u.plannedLine = null;
    u.state = "move";
    u.recalled = true;
    return unitName(u) + " повертається додому";
  }

  if (u.type === "truck") {
    // Шукаємо дорогу, біля якої є вода, і найкоротший шлях до неї
    var best = null;
    for (var y = 0; y < MAP_H; y++) {
      for (var x = 0; x < MAP_W; x++) {
        if (!isRoad(map, x, y) || !waterNear(map, x, y)) continue;
        var p = findPath(map, from.x, from.y, x, y, function (px, py) { return isRoad(map, px, py); });
        if (p && (!best || p.length < best.length)) best = p;
      }
    }
    if (!best) return "Машина не знайшла, де набрати воду";
    u.path = best;
    u.state = "move";
    u.goingForWater = true;
    return unitName(u) + " їде по воду";
  }
  return "";
}

// Чи є вода в квадраті 5×5 навколо клітинки (там машина може набрати воду)
function waterNear(map, x, y) {
  for (var oy = -2; oy <= 2; oy++) {
    for (var ox = -2; ox <= 2; ox++) {
      if (inMap(x + ox, y + oy) && map.tiles[y + oy][x + ox] === T.WATER) return true;
    }
  }
  return false;
}

// ---------- ОНОВЛЕННЯ ----------
// Рух по маршруту (path) з потрібною швидкістю. Повертає true, коли дійшли.
function followPath(u, speed, dt) {
  if (u.path.length === 0) return true;
  var next = u.path[0];
  var tx = (next[0] + 0.5) * TILE, ty = (next[1] + 0.5) * TILE;
  var dx = tx - u.x, dy = ty - u.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  var step = speed * dt;
  if (dist <= step) {
    u.x = tx; u.y = ty;
    u.path.shift();
  } else {
    u.x += dx / dist * step;
    u.y += dy / dist * step;
  }
  return u.path.length === 0;
}

// Летить по прямій до точки. Повертає true, коли долетіли.
function flyTo(u, tx, ty, speed, dt) {
  var dx = tx - u.x, dy = ty - u.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= speed * dt) { u.x = tx; u.y = ty; return true; }
  u.x += dx / dist * speed * dt;
  u.y += dy / dist * speed * dt;
  return false;
}

function updateUnits(units, map, wind, dt) {
  for (var i = 0; i < units.length; i++) {
    var u = units[i];
    if (u.type === "truck") updateTruck(u, map, dt);
    if (u.type === "heli") updateHeli(u, map, dt);
    if (u.type === "brigade") updateBrigade(u, map, wind, dt);
  }
}

// МАШИНА: їде дорогою; сама гасить вогонь у радіусі, поки є вода;
// біля води (міст, берег) набирає воду.
function updateTruck(u, map, dt) {
  // По ґрунтовці й броду машина їде повільніше
  var tt = unitTile(u);
  var slow = (map.tiles[tt.y][tt.x] === T.DIRT || map.tiles[tt.y][tt.x] === T.FORD) ? 0.6 : 1;
  if (u.state === "move" && followPath(u, UNIT.truck.speed * slow, dt)) {
    u.state = "idle";
    u.goingForWater = false;
  }

  var t = unitTile(u);
  var R = UNIT.truck.radius;
  u.sprayTargets = [];

  // Шукаємо до 3 найближчих палаючих клітинок у радіусі
  if (u.water > 0) {
    var found = [];
    for (var oy = -R; oy <= R; oy++) {
      for (var ox = -R; ox <= R; ox++) {
        var x = t.x + ox, y = t.y + oy;
        if (!inMap(x, y) || map.state[y][x] !== 1) continue;
        if (ox * ox + oy * oy > R * R) continue;
        found.push([x, y, ox * ox + oy * oy]);
      }
    }
    found.sort(function (a, b) { return a[2] - b[2]; });
    for (var k = 0; k < found.length && k < 3; k++) {
      if (douseTile(map, found[k][0], found[k][1], dt)) u.ext++;
      u.water = Math.max(0, u.water - UNIT.truck.use * dt);
      u.sprayTargets.push(found[k]);
    }
  }

  // Набирає воду, якщо поруч вода і нічого не гасить
  if (u.sprayTargets.length === 0 && u.water < UNIT.truck.water) {
    for (var wy = -2; wy <= 2; wy++) {
      for (var wx = -2; wx <= 2; wx++) {
        if (inMap(t.x + wx, t.y + wy) && map.tiles[t.y + wy][t.x + wx] === T.WATER) {
          u.water = Math.min(UNIT.truck.water, u.water + UNIT.truck.refill * dt);
          u.refilling = true;
          return;
        }
      }
    }
  }
  u.refilling = false;
}

// Найближче місце, де вертоліт може набрати воду (річка чи озеро, не струмок)
function nearestScoop(map, px, py) {
  var best = null, bestD = 1e9;
  for (var i = 0; i < map.scoopTiles.length; i++) {
    var t = map.scoopTiles[i];
    var dx = (t[0] + 0.5) * TILE - px, dy = (t[1] + 0.5) * TILE - py;
    var d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

// ВЕРТОЛІТ: летить до цілі → скидає воду на велику ділянку →
// летить до НАЙБЛИЖЧОЇ річки чи озера → набирає воду → висить там готовий.
// Тому що ближче вода до пожежі — то частіше вертоліт може скидати воду!
function updateHeli(u, map, dt) {
  var H = UNIT.heli;
  if (u.state === "fly") {
    if (flyTo(u, u.targetX, u.targetY, H.speed, dt)) {
      // Скидаємо воду: гасимо все в радіусі і намочуємо землю
      var cx = Math.floor(u.x / TILE), cy = Math.floor(u.y / TILE);
      var R = Math.ceil(H.radius);
      u.drops++;
      if (inMap(cx, cy)) map.sectorOf[cy][cx].heliDrops++;
      for (var oy = -R; oy <= R; oy++) {
        for (var ox = -R; ox <= R; ox++) {
          if (ox * ox + oy * oy > H.radius * H.radius) continue;
          var x = cx + ox, y = cy + oy;
          if (!inMap(x, y)) continue;
          if (douseTile(map, x, y, DOUSE_NEEDED)) u.ext++;
          if (map.state[y][x] === 0) map.wet[y][x] = 15;
        }
      }
      u.splash = 0.6;   // анімація сплеску
      sfx.splash();
      u.splashX = u.x; u.splashY = u.y;
      // Летимо по воду до найближчої річки чи озера
      var w = nearestScoop(map, u.x, u.y);
      if (w) {
        u.waterX = (w[0] + 0.5) * TILE;
        u.waterY = (w[1] + 0.5) * TILE;
        u.state = "toWater";
      } else {
        u.state = "return";       // води на карті немає — на базу
      }
    }
  } else if (u.state === "toWater") {
    if (flyTo(u, u.waterX, u.waterY, H.speed, dt)) {
      u.state = "scoop";
      u.reload = H.scoopTime;
    }
  } else if (u.state === "scoop") {
    u.reload -= dt;
    if (u.reload <= 0) u.state = "ready";   // бак повний, висимо над водою і чекаємо наказу
  } else if (u.state === "return") {
    if (flyTo(u, u.homeX, u.homeY, H.speed, dt)) {
      if (u.keepWater) {           // повернули по клавіші R — вода не витрачена
        u.keepWater = false;
        u.state = "ready";
      } else {                     // порожній — набираємо воду на базі довше
        u.state = "scoop";
        u.reload = H.scoopTime * 3;
      }
    }
  }
  if (u.splash > 0) u.splash -= dt;
}

// БРИГАДА: іде до цілі, потім риє смугу ВПОПЕРЕК вітру
// (саме так смуга перегороджує вогню шлях).
function updateBrigade(u, map, wind, dt) {
  if (u.state === "move") {
    if (followPath(u, UNIT.brigade.speed, dt)) {
      if (u.recalled) {          // повернулися додому по клавіші R — відпочиваємо
        u.recalled = false;
        u.state = "idle";
        return;
      }
      // Прийшли. Якщо гравець намалював лінію мишкою — риємо її по порядку.
      if (u.plannedLine) {
        u.digList = u.plannedLine;
        u.plannedLine = null;
        u.state = "dig";
        u.digTimer = UNIT.brigade.digTime;
        return;
      }
      // Інакше складаємо смугу автоматично.
      // Перпендикуляр до вітру (x, y) — це (-y, x).
      var px = Math.round(-wind.y), py = Math.round(wind.x);
      if (px === 0 && py === 0) py = 1;
      var c = unitTile(u);
      u.digList = [];
      var half = UNIT.brigade.stripHalf;
      for (var k = -half; k <= half; k++) {
        u.digList.push([c.x + px * k, c.y + py * k]);
      }
      // Риємо від центру назовні: 0, -1, 1, -2, 2...
      u.digList.sort(function (a, b) {
        return (Math.abs(a[0] - c.x) + Math.abs(a[1] - c.y)) - (Math.abs(b[0] - c.x) + Math.abs(b[1] - c.y));
      });
      u.state = "dig";
      u.digTimer = UNIT.brigade.digTime;
    }
    return;
  }
  if (u.state === "dig") {
    if (u.digList.length === 0) { u.state = "idle"; return; }
    var cell = u.digList[0];
    // Чи варто тут рити? Вода, дорога, будинок вже не горять; палаюче не скопаєш
    var ok = inMap(cell[0], cell[1]) && map.state[cell[1]][cell[0]] === 0 &&
             TILE_INFO[map.tiles[cell[1]][cell[0]]].burn > 0 &&
             map.tiles[cell[1]][cell[0]] !== T.HOUSE;
    if (!ok) { u.digList.shift(); return; }
    // Підходимо до клітинки
    if (!flyTo(u, (cell[0] + 0.5) * TILE, (cell[1] + 0.5) * TILE, UNIT.brigade.speed, dt)) return;
    u.digTimer -= dt;
    if (u.digTimer <= 0) {
      map.tiles[cell[1]][cell[0]] = T.FIREBREAK;
      map.dug = (map.dug || 0) + 1;
      sfx.dig();
      u.dug++;
      u.digList.shift();
      u.digTimer = UNIT.brigade.digTime;
    }
  }
}

// ---------- ПОМІЧАННЯ ПОЖЕЖ ----------
// Без вежі пожежу в секторі помітять лише через DETECT_DELAY секунд
// (люди побачать дим і подзвонять 101). Вежа бачить вогонь одразу.
// Повертає список повідомлень про нові помічені пожежі.
function updateDetection(map, units, dt) {
  var messages = [];
  for (var row = 0; row < SECTOR_ROWS; row++) {
    for (var col = 0; col < SECTOR_COLS; col++) {
      var s = map.sectors[row][col];
      if (s.burningNow > 0) {
        s.fireTime += dt;
        if (!s.detected && s.fireTime >= DETECT_DELAY) {
          s.detected = true;
          map.lateFound.push(s.name);
          messages.push("Люди побачили дим і подзвонили 101: пожежа — " + s.name + "!");
        }
      } else {
        s.fireTime = 0;
        s.detected = false;
      }
    }
  }
  // Вежі: перевіряємо палаючі клітинки в радіусі кожної вежі
  for (var i = 0; i < units.length; i++) {
    if (units[i].type !== "tower") continue;
    var t = unitTile(units[i]);
    var R = UNIT.tower.radius;
    for (var oy = -R; oy <= R; oy++) {
      for (var ox = -R; ox <= R; ox++) {
        var x = t.x + ox, y = t.y + oy;
        if (!inMap(x, y) || map.state[y][x] !== 1 || ox * ox + oy * oy > R * R) continue;
        var sec = map.sectorOf[y][x];
        if (!sec.detected) {
          sec.detected = true;
          units[i].detections++;
          messages.push(unitName(units[i]) + " помітила вогонь: " + sec.name + "!");
        }
      }
    }
  }
  return messages;
}

// Чи бачить гравець вогонь у клітинці: сектор помічений, або поруч хтось із наших
function fireVisible(map, units, player, x, y) {
  if (map.sectorOf[y][x].detected) return true;
  var px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
  var near = 4 * TILE;
  if (Math.abs(player.x - px) < near && Math.abs(player.y - py) < near) return true;
  for (var i = 0; i < units.length; i++) {
    if (Math.abs(units[i].x - px) < near && Math.abs(units[i].y - py) < near) return true;
  }
  return false;
}

// ---------- МАЛЮВАННЯ ----------
function drawUnits(ctx, units, selected, time) {
  // Вертолітний майданчик
  if (units.some(function (u) { return u.type === "heli"; })) {
    var hx = (HELI_BASE.x + 0.5) * TILE + 8, hy = (HELI_BASE.y + 0.5) * TILE;
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(hx - 22, hy - 12, 44, 24);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("H", hx, hy + 1);
    ctx.textAlign = "left";
  }

  // Спершу наземна техніка, потім вертольоти (вони літають вище)
  for (var pass = 0; pass < 2; pass++) {
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      if ((u.type === "heli") !== (pass === 1)) continue;
      drawUnit(ctx, u, u === selected, time);
    }
  }
}

function drawUnit(ctx, u, isSelected, time) {
  var size = (u.type === "heli") ? 24 : TILE;
  var lift = 0;   // вертоліт у повітрі малюємо вище за тінь
  if (u.type === "heli" && !(u.x === u.homeX && u.y === u.homeY)) lift = 10;   // не на майданчику — в повітрі

  // Струмені води від машини до вогню
  for (var s = 0; s < (u.sprayTargets || []).length; s++) {
    var tgt = u.sprayTargets[s];
    ctx.strokeStyle = "rgba(154, 208, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    ctx.lineTo((tgt[0] + 0.5) * TILE, (tgt[1] + 0.5) * TILE);
    ctx.stroke();
  }

  // Радіус гасіння вибраної машини (щоб було видно, що вона захищає)
  if (u.type === "truck" && isSelected) {
    ctx.strokeStyle = "rgba(154, 208, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(u.x, u.y, (UNIT.truck.radius + 0.5) * TILE, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Радіус вежі (тонке коло)
  if (u.type === "tower") {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(u.x, u.y, UNIT.tower.radius * TILE, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Тінь
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(u.x, u.y + 6, size / 2.5, size / 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Сам спрайт
  ctx.drawImage(SPRITES[u.type], Math.round(u.x - size / 2), Math.round(u.y - size / 2 - lift), size, size);

  // Гвинт вертольота крутиться
  if (u.type === "heli") {
    var landed = (u.x === u.homeX && u.y === u.homeY);
    var a = landed ? time * 2 : time * 25;
    // Набирає воду: відро на тросі опущене у воду
    if (u.state === "scoop" && !landed) {
      ctx.strokeStyle = "#2a2420";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(u.x, u.y - lift + 6);
      ctx.lineTo(u.x, u.y + 4);
      ctx.stroke();
      ctx.fillStyle = "#e06a20";
      ctx.fillRect(u.x - 3, u.y + 3, 6, 4);
    }
    ctx.strokeStyle = "#2a2420";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(u.x + Math.cos(a) * 14, u.y - lift - 2 + Math.sin(a) * 14);
    ctx.lineTo(u.x - Math.cos(a) * 14, u.y - lift - 2 - Math.sin(a) * 14);
    ctx.stroke();
    // Сплеск води
    if (u.splash > 0) {
      ctx.fillStyle = "rgba(120, 180, 255, " + (u.splash * 0.8) + ")";
      ctx.beginPath();
      ctx.arc(u.splashX, u.splashY, (1 - u.splash / 0.6) * UNIT.heli.radius * TILE + 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Шкала води в машини
  if (u.type === "truck") {
    ctx.fillStyle = "#1a1a24";
    ctx.fillRect(u.x - 8, u.y + 9, 16, 3);
    ctx.fillStyle = "#4a8ad8";
    ctx.fillRect(u.x - 8, u.y + 9, Math.round(16 * u.water / UNIT.truck.water), 3);
  }

  // Номер одиниці
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#000";
  ctx.fillText(u.num, u.x + 1, u.y - size / 2 - lift);
  ctx.fillStyle = "#fff";
  ctx.fillText(u.num, u.x, u.y - size / 2 - lift - 1);
  ctx.textAlign = "left";

  // Рамка вибраної одиниці і її маршрут
  if (isSelected) {
    ctx.strokeStyle = "#ffd84a";
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(u.x - size / 2) - 2, Math.round(u.y - size / 2 - lift) - 2, size + 4, size + 4);
    if (u.path && u.path.length > 0) {
      var last = u.path[u.path.length - 1];
      ctx.strokeStyle = "rgba(255, 216, 74, 0.8)";
      ctx.strokeRect(last[0] * TILE + 2, last[1] * TILE + 2, TILE - 4, TILE - 4);
    }
    if (u.type === "brigade") {
      var plan = u.digList.length > 0 ? u.digList : (u.plannedLine || []);
      ctx.fillStyle = "rgba(255, 216, 74, 0.35)";
      for (var d = 0; d < plan.length; d++) {
        ctx.fillRect(plan[d][0] * TILE, plan[d][1] * TILE, TILE, TILE);
      }
    }
  }
}

// Короткий опис того, що робить одиниця (для кнопок унизу)
function unitStatus(u) {
  if (u.type === "truck") {
    var w = Math.round(100 * u.water / UNIT.truck.water) + "% води";
    if (u.sprayTargets.length > 0) return "гасить, " + w;
    if (u.state === "move") return (u.goingForWater ? "їде по воду, " : "їде, ") + w;
    if (u.refilling) return "набирає воду, " + w;
    if (u.water <= 0) return "ПОРОЖНЯ — натисни R: по воду";
    return "чекає, " + w;
  }
  if (u.type === "heli") {
    if (u.state === "ready") return (u.x === u.homeX && u.y === u.homeY) ? "готовий (на базі)" : "готовий (над водою)";
    if (u.state === "fly") return "летить гасити";
    if (u.state === "toWater") return "летить по воду";
    if (u.state === "scoop") return "набирає воду " + Math.ceil(u.reload) + " с";
    return "летить на базу";
  }
  if (u.type === "brigade") {
    if (u.state === "move") return u.recalled ? "повертається" : "іде";
    if (u.state === "dig") return "риє смугу";
    return "чекає";
  }
  if (u.type === "tower") return "стежить";
  return "";
}
