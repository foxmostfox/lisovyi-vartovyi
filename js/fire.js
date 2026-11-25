// =============================================================
// fire.js — вогонь: загоряння, поширення, згоряння, дим.
//
// Кожна клітинка має стан:
//   0 — ціла, 1 — горить, 2 — згоріла.
// Клітинка, що горить, кожну секунду може підпалити сусідів.
// Шанс залежить від:
//   - типу сусідньої клітинки (TILE_INFO[тип].burn: трава 1.0, поле 0.03, вода 0);
//   - вітру (за вітром — набагато швидше, проти вітру — повільно);
//   - погоди (на етапі 5 сюди додамо спеку і вологість).
// Вода, дороги і міст мають burn = 0 — вогонь через них НЕ переходить.
// Лише іноді вітер переносить іскру через вузьку дорогу (але не через річку).
// =============================================================

// Кольори вогню і попелу
PALETTE.g = "#ffe066"; // жовте полум'я
PALETTE.x = "#ff7a1a"; // помаранчеве полум'я
PALETTE.z = "#c8281a"; // червоне полум'я
PALETTE.A = "#3a3530"; // попіл
PALETTE.B = "#1e1c1a"; // вугілля
PALETTE.C = "#5a5248"; // світлий попіл

SPRITE_DATA.flame1 = [
  "....z...",
  "...zx.z.",
  "..zxxzx.",
  ".zxgxxxz",
  ".zxggxxz",
  "zxgggxxz",
  "zxggggxz",
  ".zzzzzz."
];
SPRITE_DATA.flame2 = [
  "..z.....",
  ".zx..z..",
  ".zxz.xz.",
  "zxxgzxxz",
  "zxggxgxz",
  "zxgggxxz",
  "zxggggxz",
  ".zzzzzz."
];
SPRITE_DATA.ash = [
  "AAAAAAAA",
  "AACAAAAA",
  "AAAAABAA",
  "AABAAAAA",
  "AAAAAACA",
  "ACAAAAAA",
  "AAAABAAA",
  "AAAAAAAA"
];
SPRITE_DATA.ash_tree = [
  "AAAAAAAA",
  "AAABAAAA",
  "AABBBAAA",
  "AAABAACA",
  "AAABAAAA",
  "AACBAAAA",
  "AAAAAAAA",
  "AAAAAAAA"
];
SPRITE_DATA.ash_house = [
  "AAAAAAAA",
  "ABAAABAA",
  "ABBABBAA",
  "BCBBBCBA",
  "BBCBBBBA",
  "BBBBCBBA",
  "BBBBBBBA",
  "AAAAAAAA"
];

// ---------- Налаштування вогню (їх можна міняти для балансу) ----------
var FIRE = {
  spreadBase: 0.15,     // базовий шанс підпалити сусіда за секунду
  emberRate: 0.02       // шанс за секунду, що вітер понесе іскру на 2–3 клітинки
};

// Скільки секунд горить кожен тип клітинки
var BURN_TIME = [];
BURN_TIME[T.CONIFER] = 7;
BURN_TIME[T.DECIDUOUS] = 9;
BURN_TIME[T.GRASS] = 4;
BURN_TIME[T.FIELD] = 2;
BURN_TIME[T.HOUSE] = 8;
BURN_TIME[T.YARD] = 3;
BURN_TIME[T.OLDTREE] = 10;
BURN_TIME[T.REEDS] = 3;
BURN_TIME[T.SWAMP] = 6;

// Наскільки схил пришвидшує вогонь. Угору — швидше (полум'я гріє рослини вище),
// униз — повільніше.
var SLOPE_K = 7;
function slopeFactor(map, x, y, nx, ny) {
  var dh = map.height[ny][nx] - map.height[y][x];   // > 0 — сусід вище (вогонь іде вгору)
  return Math.max(0.5, Math.min(2.2, 1 + dh * SLOPE_K));
}

// 8 сусідів: 4 прямі і 4 по діагоналі
var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Готує карту до вогню: всі клітинки цілі, рахуємо, скільки в секторах може згоріти.
// ignitionEvery — як часто (секунд) виникають нові осередки на цьому рівні.
function initFire(map, ignitionEvery) {
  map.state = [];
  map.burnLeft = [];
  map.houseTotal = 0;   // скільки будинків на карті
  map.wet = [];     // скільки секунд клітинка ще мокра (мокре не горить)
  map.douse = [];   // скільки води вже вилито на палаючу клітинку
  map.seen = [];    // чи бачив гравець вогонь у цій клітинці (тоді показуємо попіл)
  for (var row = 0; row < SECTOR_ROWS; row++) {
    for (var col = 0; col < SECTOR_COLS; col++) {
      map.sectors[row][col].burnable = 0;  // скільки клітинок може згоріти
      map.sectors[row][col].burnt = 0;     // скільки вже згоріло або горить
      map.sectors[row][col].burningNow = 0; // скільки горить саме зараз
      map.sectors[row][col].fireTime = 0;   // скільки секунд у секторі вже горить
      map.sectors[row][col].detected = false; // чи помітили люди цю пожежу
      map.sectors[row][col].extinguished = 0; // скільки клітинок тут загасили (для розбору)
      map.sectors[row][col].heliDrops = 0;    // скільки разів сюди скидали воду з вертольота
    }
  }
  for (var y = 0; y < MAP_H; y++) {
    map.state.push([]);
    map.burnLeft.push([]);
    map.wet.push([]);
    map.douse.push([]);
    map.seen.push([]);
    for (var x = 0; x < MAP_W; x++) {
      map.state[y].push(0);
      map.burnLeft[y].push(0);
      map.wet[y].push(0);
      map.douse[y].push(0);
      map.seen[y].push(false);
      if (TILE_INFO[map.tiles[y][x]].burn > 0) map.sectorOf[y][x].burnable++;
      if (map.tiles[y][x] === T.HOUSE) map.houseTotal++;
    }
  }
  map.burningCount = 0;
  map.burntCount = 0;
  map.extinguished = 0;                 // скільки клітинок загасили (для розбору)
  map.playerExt = 0;                    // скільки загасив сам пожежник
  map.lateFound = [];                   // пожежі, які помітили лише люди (без вежі)
  // Де вогонь уперся в перешкоду: { "річка": { count, sectors: { назва: скільки } }, ... }
  map.stops = {};
  map.stopSeen = [];                    // кожну клітинку-перешкоду рахуємо один раз
  for (var sy = 0; sy < MAP_H; sy++) {
    map.stopSeen.push([]);
    for (var sx = 0; sx < MAP_W; sx++) map.stopSeen[sy].push(false);
  }
  map.smoke = [];                       // частинки диму
  map.sparks = [];                      // іскри, що летять за вітром (для краси)
  map.ignitionEvery = ignitionEvery;
  map.nextIgnition = ignitionEvery;      // таймер до нового осередку
}

// Підпалює клітинку (якщо вона може горіти і ще ціла)
function ignite(map, x, y) {
  if (!inMap(x, y)) return false;
  if (map.state[y][x] !== 0) return false;
  var type = map.tiles[y][x];
  if (TILE_INFO[type].burn <= 0) return false;
  if (map.wet[y][x] > 0) return false;   // мокра клітинка не загоряється
  map.state[y][x] = 1;
  map.douse[y][x] = 0;
  // Час горіння трохи випадковий, щоб вогонь виглядав живим
  map.burnLeft[y][x] = BURN_TIME[type] * (0.8 + Math.random() * 0.4);
  map.burningCount++;
  map.sectorOf[y][x].burnt++;
  map.sectorOf[y][x].burningNow++;
  return true;
}

// Чи ця вода — озеро (широка вода з усіх боків на 2 клітинки), а не річка
function isLakeTile(map, x, y) {
  var n = 0;
  for (var oy = -2; oy <= 2; oy++) {
    for (var ox = -2; ox <= 2; ox++) {
      if (inMap(x + ox, y + oy) && map.tiles[y + oy][x + ox] === T.WATER) n++;
    }
  }
  return n >= 15;
}

// Записує, що вогонь у клітинці (x, y) дійшов до перешкоди і не пройшов далі.
// Дивимось на 4 сусідів: вода, дорога, поле, протипожежна смуга.
function recordStops(map, x, y) {
  var near = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (var i = 0; i < 4; i++) {
    var nx = x + near[i][0], ny = y + near[i][1];
    if (!inMap(nx, ny) || map.stopSeen[ny][nx]) continue;
    var t = map.tiles[ny][nx];
    var kind = null;
    if (t === T.WATER || t === T.FORD) kind = isLakeTile(map, nx, ny) ? "озеро" : "річка";
    else if (t === T.ROAD || t === T.BRIDGE || t === T.DIRT) kind = "дорога";
    else if (t === T.ROCK) kind = "скелі";
    else if (t === T.FIREBREAK) kind = "смуга";
    else if (t === T.FIELD && map.state[ny][nx] === 0) kind = "поле";
    if (!kind) continue;
    map.stopSeen[ny][nx] = true;
    if (!map.stops[kind]) map.stops[kind] = { count: 0, sectors: {} };
    map.stops[kind].count++;
    var name = map.sectorOf[y][x].name;
    map.stops[kind].sectors[name] = (map.stops[kind].sectors[name] || 0) + 1;
  }
}

// Поливає клітинку водою. amount — скільки секунд на неї ллється струмінь.
// Повертає true, якщо саме зараз клітинку загасили (щоб знати, хто молодець).
// Ціла клітинка стає мокрою (кілька секунд не горить) — так можна
// «намочити» смугу перед вогнем. Палаюча — гасне, якщо лити досить довго.
var DOUSE_NEEDED = 0.6;   // скільки секунд лити, щоб загасити клітинку
function douseTile(map, x, y, amount) {
  if (!inMap(x, y)) return;
  if (map.state[y][x] === 2) return;          // згоріле вже не врятуєш
  map.wet[y][x] = Math.max(map.wet[y][x], 6);
  if (map.state[y][x] === 1) {
    map.douse[y][x] += amount;
    if (map.douse[y][x] >= DOUSE_NEEDED) {
      // Загасили!
      map.state[y][x] = 0;
      map.douse[y][x] = 0;
      map.wet[y][x] = 10;
      map.burningCount--;
      map.sectorOf[y][x].burnt--;
      map.sectorOf[y][x].burningNow--;
      map.sectorOf[y][x].extinguished++;
      map.extinguished++;
      return true;
    }
  }
  return false;
}

// Множник вітру для напрямку (dx, dy).
// Скалярний добуток: +1 — точно за вітром, -1 — точно проти вітру.
function windFactor(wind, dx, dy) {
  var len = Math.sqrt(dx * dx + dy * dy);
  var dot = (dx * wind.x + dy * wind.y) / len;
  var f = 1 + wind.strength * dot * 1.5;
  return Math.max(0.15, f);   // навіть проти вітру вогонь трохи повзе
}

// Головна функція вогню: викликається кожен кадр
// weatherFactor — множник від погоди (поки 1, на етапі 5 буде залежати від спеки)
function updateFire(map, wind, weatherFactor, dt) {
  var toIgnite = [];   // спершу збираємо, що загориться, а підпалюємо потім

  for (var y = 0; y < MAP_H; y++) {
    for (var x = 0; x < MAP_W; x++) {
      if (map.wet[y][x] > 0) map.wet[y][x] -= dt;   // клітинка поступово висихає
      if (map.state[y][x] !== 1) continue;

      // 1) Клітинка догоряє
      map.burnLeft[y][x] -= dt;
      if (map.burnLeft[y][x] <= 0) {
        map.state[y][x] = 2;
        map.burningCount--;
        map.burntCount++;
        map.sectorOf[y][x].burningNow--;
        recordStops(map, x, y);   // чи впирався вогонь тут у перешкоду?
        continue;
      }

      // 2) Підпалюємо сусідів
      for (var d = 0; d < DIRS.length; d++) {
        var dx = DIRS[d][0], dy = DIRS[d][1];
        var nx = x + dx, ny = y + dy;
        if (!inMap(nx, ny) || map.state[ny][nx] !== 0) continue;
        var burn = TILE_INFO[map.tiles[ny][nx]].burn;
        if (burn <= 0) continue;                  // вода, дорога — не горять

        var diagonal = (dx !== 0 && dy !== 0) ? 0.5 : 1;
        var rate = FIRE.spreadBase * burn * windFactor(wind, dx, dy) * diagonal * weatherFactor *
                   slopeFactor(map, x, y, nx, ny);
        // rate — «скільки разів за секунду», множимо на dt — шанс у цьому кадрі
        if (Math.random() < rate * dt) toIgnite.push([nx, ny]);
      }

      // 3) Іскра: вітер може перенести вогонь на 2 клітинки вперед
      //    (так вогонь перескакує вузьку дорогу). Лише буревій (вітер 9–10)
      //    іноді несе іскру на 3 клітинки — тоді зрідка перелітає навіть річку.
      if (Math.random() < FIRE.emberRate * wind.strength * weatherFactor * dt) {
        var dist = (wind.strength >= 0.88 && Math.random() < 0.3) ? 3 : 2;
        var ex = x + Math.round(wind.x * dist);
        var ey = y + Math.round(wind.y * dist);
        if (inMap(ex, ey) && Math.random() < TILE_INFO[map.tiles[ey][ex]].burn) {
          toIgnite.push([ex, ey]);
        }
      }

      // 4) Іскри для краси (вогонь від них не загоряється — це робить пункт 3)
      if (map.sparks.length < 150 && Math.random() < 0.8 * dt) {
        map.sparks.push({ tx: x, ty: y, x: (x + 0.5) * TILE, y: (y + 0.3) * TILE,
                          life: 0.6 + Math.random() * 0.8, vx: (Math.random() - 0.5) * 20 });
      }

      // 5) Дим (не більше 300 частинок, щоб не гальмувало)
      if (map.smoke.length < 300 && Math.random() < 1.5 * dt) {
        map.smoke.push({
          tx: x, ty: y,   // з якої клітинки дим (щоб ховати дим непоміченої пожежі)
          x: (x + Math.random()) * TILE,
          y: (y + Math.random()) * TILE,
          life: 2 + Math.random() * 1.5,
          size: 3 + Math.random() * 3
        });
      }
    }
  }

  for (var i = 0; i < toIgnite.length; i++) {
    ignite(map, toIgnite[i][0], toIgnite[i][1]);
  }

  // Іскри летять за вітром і вгору, швидко гаснуть
  for (var k = map.sparks.length - 1; k >= 0; k--) {
    var sp = map.sparks[k];
    sp.x += (wind.x * wind.strength * 45 + sp.vx) * dt;
    sp.y += (wind.y * wind.strength * 45 - 18) * dt;
    sp.life -= dt;
    if (sp.life <= 0) map.sparks.splice(k, 1);
  }

  // Дим летить за вітром і поступово зникає
  for (var s = map.smoke.length - 1; s >= 0; s--) {
    var p = map.smoke[s];
    p.x += wind.x * wind.strength * 25 * dt;
    p.y += wind.y * wind.strength * 25 * dt - 10 * dt;  // трохи вгору
    p.size += 3 * dt;
    p.life -= dt;
    if (p.life <= 0) map.smoke.splice(s, 1);
  }
}

// Нові осередки пожежі виникають випадково через певний час.
// Обираємо клітинку, яка легко горить (не поле, не село).
function updateIgnitions(map, weatherFactor, dt) {
  map.nextIgnition -= dt;
  if (map.nextIgnition > 0) return;
  map.nextIgnition = map.ignitionEvery / weatherFactor;
  igniteRandom(map);
}

// Підпалює випадкову клітинку, що легко горить (не в селі)
function igniteRandom(map) {
  for (var tries = 0; tries < 50; tries++) {
    var x = Math.floor(Math.random() * MAP_W);
    var y = Math.floor(Math.random() * MAP_H);
    var type = map.tiles[y][x];
    if (map.sectorOf[y][x].type === "village") continue;
    if (TILE_INFO[type].burn >= 0.4 && ignite(map, x, y)) return;
  }
}

// Малює вогонь, попіл і дим ПОВЕРХ карти.
// isVisible(x, y) — чи бачимо ми цю клітинку. Непомічений вогонь не малюємо:
// він горить, але гравець про нього ще не знає (для цього й потрібні вежі).
function drawFire(ctx, map, time, isVisible) {
  for (var y = 0; y < MAP_H; y++) {
    for (var x = 0; x < MAP_W; x++) {
      var st = map.state[y][x];
      if (st === 0) {
        // Мокра клітинка трохи синіє, поки не висохне
        if (map.wet[y][x] > 0) {
          ctx.fillStyle = "rgba(60, 120, 230, " + (0.3 * Math.min(1, map.wet[y][x] / 3)) + ")";
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
        continue;
      }
      var px = x * TILE, py = y * TILE;
      var type = map.tiles[y][x];

      // Вогонь, якого ніхто не бачив, не показуємо — навіть попіл
      if (isVisible(x, y)) map.seen[y][x] = true;
      if (!map.seen[y][x]) continue;

      if (st === 2) {
        // Згоріла клітинка: попіл, пеньок або руїни будинку
        var ash = "ash";
        if (type === T.HOUSE) ash = "ash_house";
        else if (type === T.CONIFER || type === T.DECIDUOUS || type === T.OLDTREE) ash = "ash_tree";
        ctx.drawImage(SPRITES[ash], px, py, TILE, TILE);
      } else {
        // Світіння навколо вогню (мерехтить)
        ctx.fillStyle = "rgba(255, 140, 30, " + (0.10 + 0.05 * Math.sin(time * 9 + x * 3 + y)) + ")";
        ctx.fillRect(px - TILE / 2, py - TILE / 2, TILE * 2, TILE * 2);
        // Горить: затемнюємо клітинку і малюємо полум'я, що мерехтить
        ctx.fillStyle = "rgba(90, 25, 0, 0.5)";
        ctx.fillRect(px, py, TILE, TILE);
        var frame = (Math.floor(time * 6) + x + y) % 2;
        ctx.drawImage(frame ? SPRITES.flame1 : SPRITES.flame2, px, py, TILE, TILE);
      }
    }
  }

  // Іскри: маленькі жовто-помаранчеві квадратики, що блимають
  for (var k = 0; k < map.sparks.length; k++) {
    var sp = map.sparks[k];
    if (!isVisible(sp.tx, sp.ty)) continue;
    ctx.fillStyle = (Math.floor(time * 12 + k) % 2) ? "#ffe066" : "#ff7a1a";
    ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 2, 2);
  }

  // Дим: сірі напівпрозорі квадратики (піксельний стиль)
  for (var i = 0; i < map.smoke.length; i++) {
    var p = map.smoke[i];
    if (!isVisible(p.tx, p.ty)) continue;
    ctx.fillStyle = "rgba(70, 70, 70, " + Math.min(0.4, p.life * 0.15) + ")";
    var sz = Math.round(p.size);
    ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
  }
}
