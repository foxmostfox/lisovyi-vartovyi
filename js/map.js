// =============================================================
// map.js — карта: клітинки, сектори, рельєф (пагорби), річки,
// струмки, озера, болота, скелі, дороги, село.
// Кожен рівень має свою «географію» (LEVEL1_GEO, LEVEL2_GEO...).
// =============================================================

// Розміри карти
var SECTOR_COLS = 5;     // секторів по горизонталі
var SECTOR_ROWS = 4;     // секторів по вертикалі
var SECTOR_W = 12;       // клітинок у секторі по ширині
var SECTOR_H = 10;       // клітинок у секторі по висоті
var MAP_W = SECTOR_COLS * SECTOR_W;   // 60 клітинок
var MAP_H = SECTOR_ROWS * SECTOR_H;   // 40 клітинок
var TILE = 16;           // розмір клітинки на екрані (спрайт 8px × 2)

// Типи клітинок (числа, щоб було просто зберігати в масиві)
var T = {
  CONIFER: 0,    // хвойне дерево
  DECIDUOUS: 1,  // листяне дерево
  GRASS: 2,      // суха трава
  FIELD: 3,      // зоране поле
  HOUSE: 4,      // будинок
  YARD: 5,       // подвір'я, газон у селі
  WATER: 6,      // вода (річка, струмок, озеро)
  ROAD: 7,       // асфальтова дорога
  BRIDGE: 8,     // міст
  OLDTREE: 9,    // старе дерево заповідника
  FIREBREAK: 10, // протипожежна смуга (перекопана земля, не горить)
  REEDS: 11,     // очерет на вологому березі (горить погано)
  SWAMP: 12,     // болото (мокре, горить дуже погано)
  ROCK: 13,      // скелі (не горять, пройти не можна)
  DIRT: 14,      // ґрунтова лісова дорога (машини їздять, але повільніше)
  FORD: 15       // брід — мілке місце, де ґрунтовка перетинає річку
};

// Властивості кожного типу клітинки.
// burn — наскільки легко загоряється (0 = ніколи, 1 = дуже легко).
var TILE_INFO = [];
TILE_INFO[T.CONIFER]   = { name: "Хвойне дерево",   burn: 0.8,  sprites: ["conifer1", "conifer2"] };
TILE_INFO[T.DECIDUOUS] = { name: "Листяне дерево",  burn: 0.45, sprites: ["deciduous1", "deciduous2"] };
TILE_INFO[T.GRASS]     = { name: "Суха трава",      burn: 1.0,  sprites: ["grass1", "grass2"] };
TILE_INFO[T.FIELD]     = { name: "Зоране поле",     burn: 0.03, sprites: ["field1", "field2"] };
TILE_INFO[T.HOUSE]     = { name: "Будинок",         burn: 0.5,  sprites: ["house"] };
TILE_INFO[T.YARD]      = { name: "Подвір'я",        burn: 0.25, sprites: ["yard1", "yard2"] };
TILE_INFO[T.WATER]     = { name: "Вода",            burn: 0,    sprites: ["water1", "water2"] };
TILE_INFO[T.ROAD]      = { name: "Дорога",          burn: 0,    sprites: ["road"] };
TILE_INFO[T.BRIDGE]    = { name: "Міст",            burn: 0,    sprites: ["bridge"] };
TILE_INFO[T.OLDTREE]   = { name: "Старе дерево",    burn: 0.6,  sprites: ["oldtree"] };
TILE_INFO[T.FIREBREAK] = { name: "Протипожежна смуга", burn: 0, sprites: ["firebreak"] };
TILE_INFO[T.REEDS]     = { name: "Очерет (вологий берег)", burn: 0.3, sprites: ["reeds1", "reeds2"] };
TILE_INFO[T.SWAMP]     = { name: "Болото",          burn: 0.12, sprites: ["swamp1", "swamp2"] };
TILE_INFO[T.ROCK]      = { name: "Скелі",           burn: 0,    sprites: ["rock1", "rock2"] };
TILE_INFO[T.DIRT]      = { name: "Ґрунтова дорога", burn: 0,    sprites: ["dirt"] };
TILE_INFO[T.FORD]      = { name: "Брід",            burn: 0,    sprites: ["ford"] };

// Типи секторів: чим заповнені, скільки коштують, як горять
var SECTOR_TYPES = {
  conifer: {
    name: "Хвойний ліс", value: 30, fire: "горить ШВИДКО",
    // [тип клітинки, частка]
    fill: [[T.CONIFER, 0.8], [T.GRASS, 0.12], [T.DECIDUOUS, 0.08]]
  },
  deciduous: {
    name: "Листяний ліс", value: 30, fire: "горить повільніше",
    fill: [[T.DECIDUOUS, 0.8], [T.YARD, 0.12], [T.CONIFER, 0.08]]
  },
  grass: {
    name: "Суха трава", value: 5, fire: "горить ДУЖЕ швидко",
    fill: [[T.GRASS, 0.9], [T.DECIDUOUS, 0.1]]
  },
  field: {
    name: "Поле", value: 5, fire: "майже не горить",
    fill: [[T.FIELD, 0.95], [T.GRASS, 0.05]]
  },
  village: {
    name: "Село", value: 100, fire: "ТРЕБА ЗАХИЩАТИ!",
    fill: [[T.YARD, 1.0]]
  },
  reserve: {
    name: "Заповідник", value: 80, fire: "цінний старий ліс",
    fill: [[T.OLDTREE, 0.6], [T.DECIDUOUS, 0.25], [T.CONIFER, 0.15]]
  }
};

// ---------- РІВЕНЬ 1 ----------
// Сектори: 4 рядки по 5 секторів. Село завжди в другому рядку, другий стовпчик.
var LEVEL1_LAYOUT = [
  [ { type: "conifer", name: "Соснова гора" },
    { type: "conifer", name: "Бір" },
    { type: "deciduous", name: "Дубовий гай" },
    { type: "reserve", name: "Заповідник" },
    { type: "conifer", name: "Північний бір" } ],
  [ { type: "grass", name: "Сухий степ" },
    { type: "village", name: "Село Калинівка" },
    { type: "field", name: "Колгоспне поле" },
    { type: "conifer", name: "Східний бір" },
    { type: "deciduous", name: "Кленовий гай" } ],
  [ { type: "deciduous", name: "Березовий ліс" },
    { type: "grass", name: "Луки" },
    { type: "conifer", name: "Ялинник" },
    { type: "deciduous", name: "Далекий ліс" },
    { type: "grass", name: "Пасовище" } ],
  [ { type: "conifer", name: "Південний бір" },
    { type: "field", name: "Нива" },
    { type: "deciduous", name: "Вільшаник" },
    { type: "reserve", name: "Старий дубняк" },
    { type: "conifer", name: "Глушина" } ]
];

// Географія рівня 1.
//   rivers — річки і струмки: ламана points, ширина w (1 = струмок), хвиля wave (вигини),
//            wide — де річка розливається ширше і має острів;
//   lakes, swamps — овали { x, y, rx, ry };
//   hills — пагорби { x, y, r — радіус, h — висота від 0 до 1 };
//   dirt — ґрунтові дороги (лінії з точок); де перетинають воду — брід;
//   heliBase — вертолітний майданчик.
var LEVEL1_GEO = {
  rivers: [
    // Головна річка тече згори донизу і звивається петлями, з островом посередині
    { w: 2, points: [[34, 0], [36, 10], [34, 20], [35, 29], [36, 40]],
      wave: { axis: "y", amp: 3, f: 0.42, ph: 0 },
      wide: { from: 18, to: 24, w: 4, island: true } },
    // Друга річка тече на півдні зліва направо і впадає в головну
    { w: 2, points: [[0, 31], [35, 31]],
      wave: { axis: "x", amp: 2, f: 0.3, ph: 1 } },
    // Струмок з озера впадає в річку
    { w: 1, points: [[12, 25], [33, 26]],
      wave: { axis: "x", amp: 1.3, f: 0.55, ph: 1 } },
    // Північно-східний струмок тече до південного озера
    { w: 1, points: [[49, 0], [50, 20], [51, 33]],
      wave: { axis: "y", amp: 1.6, f: 0.45, ph: 2 } }
  ],
  lakes: [{ x: 8.5, y: 24.5, rx: 3.6, ry: 2.6 }, { x: 51, y: 35.5, rx: 4.5, ry: 2.8 }],
  swamps: [{ x: 5, y: 27, rx: 4, ry: 2.2 }, { x: 56, y: 37, rx: 3, ry: 2 }],
  hills: [
    { x: 5, y: 4, r: 7, h: 1.0 },      // Соснова гора — справжня гора!
    { x: 42, y: 5, r: 6, h: 0.8 },     // пагорб у заповіднику
    { x: 28, y: 23, r: 5, h: 0.6 },    // пагорб у Ялиннику
    { x: 20, y: 36, r: 6, h: 0.8 },
    { x: 56, y: 22, r: 6, h: 0.9 }
  ],
  dirt: [
    [[18, 6], [29, 6], [29, 9]],              // у Бір і Дубовий гай
    [[37, 15], [40, 11], [43, 9], [44, 3]],   // за річку до заповідника
    [[7, 15], [7, 21]],                       // до озера (машини наберуть воду)
    [[18, 22], [26, 22], [33, 22], [40, 22], [44, 26]],  // через брід у Далекий ліс
    [[18, 36], [30, 36], [40, 35], [46, 36]], // на південь до Старого дубняку
    [[53, 15], [54, 24], [57, 28]]            // до Пасовища
  ],
  heliBase: { x: 27, y: 11 }
};

// ---------- РІВЕНЬ 2 ----------
var LEVEL2_LAYOUT = [
  [ { type: "grass", name: "Сухі пагорби" },
    { type: "conifer", name: "Сосняк" },
    { type: "conifer", name: "Бір" },
    { type: "reserve", name: "Заповідник" },
    { type: "conifer", name: "Кедровий бір" } ],
  [ { type: "conifer", name: "Західний бір" },
    { type: "village", name: "Село Липове" },
    { type: "grass", name: "Пустир" },
    { type: "conifer", name: "Східний бір" },
    { type: "grass", name: "Степ" } ],
  [ { type: "deciduous", name: "Гай" },
    { type: "conifer", name: "Ялинник" },
    { type: "field", name: "Поле" },
    { type: "deciduous", name: "Далекий ліс" },
    { type: "conifer", name: "Темний бір" } ],
  [ { type: "grass", name: "Вигін" },
    { type: "deciduous", name: "Діброва" },
    { type: "conifer", name: "Хвойник" },
    { type: "reserve", name: "Урочище" },
    { type: "deciduous", name: "Липовий гай" } ]
];
var LEVEL2_GEO = {
  rivers: [
    // Річка тече зліва направо над селом і звивається, з островом
    { w: 2, points: [[0, 6], [60, 6]],
      wave: { axis: "x", amp: 1.8, f: 0.28, ph: 0.5 },
      wide: { from: 31, to: 36, w: 4, island: true } },
    // Друга річка тече зі сходу на південь
    { w: 2, points: [[47, 6], [46, 40]],
      wave: { axis: "y", amp: 2.5, f: 0.35, ph: 1 } },
    // Струмок з річки до озера
    { w: 1, points: [[40, 8], [41, 19]],
      wave: { axis: "y", amp: 1.2, f: 0.6, ph: 2 } },
    // Південний струмок впадає у східну річку
    { w: 1, points: [[0, 33], [46, 32]],
      wave: { axis: "x", amp: 1.4, f: 0.5, ph: 0.7 } }
  ],
  lakes: [{ x: 41, y: 22, rx: 4, ry: 3 }, { x: 10, y: 37, rx: 3.5, ry: 2 }],
  swamps: [{ x: 44, y: 26, rx: 4, ry: 2.5 }, { x: 4, y: 9, rx: 3, ry: 1.5 }],
  hills: [
    { x: 30, y: 17, r: 6, h: 1.0 },    // пагорб на Пустирі, схилом до села!
    { x: 6, y: 25, r: 6, h: 0.8 },
    { x: 4, y: 2, r: 5, h: 0.7 },
    { x: 54, y: 28, r: 6, h: 0.9 },
    { x: 25, y: 35, r: 5, h: 0.7 }
  ],
  dirt: [
    [[18, 22], [30, 22], [37, 22]],          // до озера
    [[28, 15], [28, 3], [33, 1]],            // через брід у Бір
    [[18, 25], [8, 25], [3, 28]],            // до Гаю
    [[18, 36], [30, 36], [44, 36], [52, 38]],
    [[50, 15], [54, 25]]
  ],
  heliBase: { x: 26, y: 12 }
};

// ---------- РІВЕНЬ 3 ----------
var LEVEL3_LAYOUT = [
  [ { type: "conifer", name: "Соснова гора" },
    { type: "conifer", name: "Бір" },
    { type: "conifer", name: "Ялинова падь" },
    { type: "reserve", name: "Північний заповідник" },
    { type: "conifer", name: "Кам'яний бір" } ],
  [ { type: "grass", name: "Степ" },
    { type: "village", name: "Село Сонячне" },
    { type: "grass", name: "Сухі луки" },
    { type: "reserve", name: "Старий ліс" },
    { type: "grass", name: "Вигоряни" } ],
  [ { type: "grass", name: "Пустка" },
    { type: "conifer", name: "Ялинник" },
    { type: "deciduous", name: "Діброва" },
    { type: "conifer", name: "Південний бір" },
    { type: "conifer", name: "Глухомань" } ],
  [ { type: "conifer", name: "Чорний ліс" },
    { type: "grass", name: "Пустище" },
    { type: "conifer", name: "Смерековий ліс" },
    { type: "deciduous", name: "Вербовий гай" },
    { type: "reserve", name: "Дике урочище" } ]
];
var LEVEL3_GEO = {
  rivers: [
    // Річка тече навскіс і звивається
    { w: 2, points: [[27, 0], [60, 28]],
      wave: { axis: "x", amp: 2.5, f: 0.45, ph: 1.2 } },
    // Довгий звивистий струмок на заході
    { w: 1, points: [[3, 0], [3, 40]],
      wave: { axis: "y", amp: 1.5, f: 0.5, ph: 0.3 } },
    // Південна річка
    { w: 2, points: [[0, 34], [60, 33]],
      wave: { axis: "x", amp: 2, f: 0.32, ph: 2.2 } }
  ],
  lakes: [{ x: 28, y: 26, rx: 3, ry: 2 }, { x: 52, y: 38, rx: 4, ry: 1.8 }],
  swamps: [{ x: 31, y: 28, rx: 3, ry: 1.5 }],
  hills: [
    { x: 9, y: 4, r: 7, h: 1.0 },
    { x: 40, y: 25, r: 6, h: 1.0 },
    { x: 23, y: 24, r: 5, h: 0.7 },
    { x: 44, y: 4, r: 4, h: 0.6 },
    { x: 12, y: 30, r: 6, h: 0.9 },
    { x: 55, y: 12, r: 5, h: 0.8 }
  ],
  dirt: [
    [[22, 15], [30, 15], [33, 12], [38, 4], [43, 2]],   // до Північного заповідника (через брід)
    [[18, 21], [28, 21], [36, 24]],                     // до озера
    [[10, 15], [6, 15], [5, 10]],
    [[18, 37], [40, 37], [55, 38]]
  ],
  heliBase: { x: 26, y: 12 }
};

// ---------- Випадкові числа з «зерном» ----------
// Звичайний Math.random() щоразу дає різну карту.
// А ця функція з тим самим зерном дає ОДНАКОВУ карту — рівень завжди той самий.
function makeRandom(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// Обирає тип клітинки за частками з fill (наприклад 80% хвоя, 12% трава...)
function pickFill(fill, rnd) {
  var r = rnd();
  var sum = 0;
  for (var i = 0; i < fill.length; i++) {
    sum += fill[i][1];
    if (r < sum) return fill[i][0];
  }
  return fill[fill.length - 1][0];
}

// Перевірка, чи клітинка всередині карти
function inMap(x, y) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

// Іде від (x0, y0) до (x1, y1) «сходинками» (без діагональних щілин)
// і для кожної клітинки викликає paint(x, y).
function walkLine(x0, y0, x1, y1, paint) {
  var x = x0, y = y0;
  var sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
  paint(x, y);
  while (x !== x1 || y !== y1) {
    var errX = Math.abs((x + sx - x0) * (y1 - y0) - (y - y0) * (x1 - x0));
    var errY = Math.abs((x - x0) * (y1 - y0) - (y + sy - y0) * (x1 - x0));
    if (x !== x1 && (y === y1 || errX <= errY)) x += sx;
    else y += sy;
    paint(x, y);
  }
}

// Малює ламану лінію через точки
function walkPolyline(points, paint) {
  for (var i = 0; i < points.length - 1; i++) {
    walkLine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], paint);
  }
}

// Малює одну звивисту річку.
// Беремо ламану river.points і «гнемо» її хвилею: зсув = дві синусоїди (велика й мала),
// тому вигини різні, як у справжньої річки.
//   wave.axis = "y" — річка тече згори вниз, хвиля зсуває її вліво-вправо;
//   wave.axis = "x" — річка тече зліва направо, хвиля зсуває її вгору-вниз.
function paintRiver(map, river, islandTiles) {
  var wave = river.wave;
  var prev = null;
  for (var i = 0; i < river.points.length - 1; i++) {
    var ax = river.points[i][0], ay = river.points[i][1];
    var bx = river.points[i + 1][0], by = river.points[i + 1][1];
    var len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
    var steps = Math.ceil(len * 4);
    for (var k = 0; k <= steps; k++) {
      var t = k / steps;
      var px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
      var a = (wave.axis === "y") ? py : px;          // «відстань» уздовж течії
      var off = wave.amp * Math.sin(a * wave.f + wave.ph) +
                wave.amp * 0.4 * Math.sin(a * wave.f * 2.3 + wave.ph * 1.7);
      if (wave.axis === "y") px += off; else py += off;
      var cur = [Math.round(px), Math.round(py)];

      // Ширина: у «широкій» частині річка розливається
      var w = river.w;
      var isWide = river.wide && a >= river.wide.from && a <= river.wide.to;
      if (isWide) w = river.wide.w;

      if (!prev) prev = cur;
      walkLine(prev[0], prev[1], cur[0], cur[1], function (x, y) {
        for (var oy = 0; oy < w; oy++) {
          for (var ox = 0; ox < w; ox++) {
            var wx = x + ox - Math.floor((w - 1) / 2);
            var wy = y + oy - Math.floor((w - 1) / 2);
            if (inMap(wx, wy)) map.tiles[wy][wx] = T.WATER;
          }
        }
        // Острів — дві середні клітинки широкої частини (не на самих краях)
        if (isWide && river.wide.island && a > river.wide.from + 1 && a < river.wide.to - 1) {
          islandTiles.push([x, y]);
          islandTiles.push(wave.axis === "y" ? [x + 1, y] : [x, y + 1]);
        }
      });
      prev = cur;
    }
  }
}

// Чи клітинка — рослинність (її можна замінити на очерет, болото, скелі)
function isPlant(t) {
  return t === T.CONIFER || t === T.DECIDUOUS || t === T.GRASS || t === T.FIELD || t === T.OLDTREE;
}

// ---------- Створення карти ----------
// Повертає об'єкт map:
//   map.tiles[y][x]   — тип клітинки
//   map.height[y][x]  — висота від 0 (низина) до 1 (вершина гори)
//   map.sectors[row][col] — інформація про сектор
function buildMap(layout, seed, geo) {
  var rnd = makeRandom(seed);
  // map.sectorOf[y][x] — до якого сектора належить клітинка.
  // Межі секторів звивисті, тому це не завжди «квадрат 12×10».
  var map = { tiles: [], sectors: [], sectorOf: [], height: [] };

  // 1) Сектори
  for (var row = 0; row < SECTOR_ROWS; row++) {
    map.sectors.push([]);
    for (var col = 0; col < SECTOR_COLS; col++) {
      var s = layout[row][col];
      map.sectors[row].push({
        col: col, row: row,
        type: s.type,
        name: s.name,
        info: SECTOR_TYPES[s.type]
      });
    }
  }

  // 2) Рослинність зі звивистими межами секторів:
  //  - синуси дають плавні хвилі (межа звивається, як край лісу);
  //  - випадковий шум дає «розсип» дерев у траві біля межі.
  var phase1 = rnd() * 10, phase2 = rnd() * 10;
  for (var y = 0; y < MAP_H; y++) {
    map.tiles.push([]);
    map.sectorOf.push([]);
    map.height.push([]);
    for (var x = 0; x < MAP_W; x++) {
      // Плавна хвиля — за нею проходить МЕЖА сектора
      var shiftX = 2.2 * Math.sin(y * 0.55 + x * 0.15 + phase1) + 1.0 * Math.sin(y * 1.3 + phase2);
      var shiftY = 2.0 * Math.sin(x * 0.45 + y * 0.12 + phase2) + 1.0 * Math.sin(x * 1.1 + phase1);
      map.sectorOf[y].push(sectorAt(map, x + shiftX, y + shiftY));

      // Хвиля + випадковий шум — за цим обираємо РОСЛИНИ.
      var noisyX = x + shiftX + (rnd() - 0.5) * 2.2;
      var noisyY = y + shiftY + (rnd() - 0.5) * 2.2;
      var plantSector = sectorAt(map, noisyX, noisyY);
      map.tiles[y].push(pickFill(plantSector.info.fill, rnd));

      // 3) Висота: сума «горбиків» від кожного пагорба (крива-дзвін)
      map.height[y].push(smoothHeight(geo.hills, x, y));
    }
  }

  // 4) Скелі на вершинах гір
  for (var ry = 0; ry < MAP_H; ry++) {
    for (var rx = 0; rx < MAP_W; rx++) {
      if (map.height[ry][rx] > 0.78 && isPlant(map.tiles[ry][rx]) && rnd() < 0.4) {
        map.tiles[ry][rx] = T.ROCK;
      }
    }
  }

  // 5) Болота (овали)
  geo.swamps.forEach(function (sw) {
    for (var sy = 0; sy < MAP_H; sy++) {
      for (var sx = 0; sx < MAP_W; sx++) {
        var dx = (sx - sw.x) / sw.rx, dy = (sy - sw.y) / sw.ry;
        if (dx * dx + dy * dy < 1 && rnd() < 0.85) map.tiles[sy][sx] = T.SWAMP;
      }
    }
  });

  // 6) Річки і струмки звиваються, а «пензель» шириною w клітинок малює воду
  var islandTiles = [];
  geo.rivers.forEach(function (river) {
    paintRiver(map, river, islandTiles);
  });
  // Острів посеред широкої частини річки (на ньому росте старий ліс)
  islandTiles.forEach(function (p) { map.tiles[p[1]][p[0]] = T.OLDTREE; });

  // 7) Озера (овали)
  geo.lakes.forEach(function (lake) {
    for (var ly = 0; ly < MAP_H; ly++) {
      for (var lx = 0; lx < MAP_W; lx++) {
        var dx = (lx - lake.x) / lake.rx, dy = (ly - lake.y) / lake.ry;
        if (dx * dx + dy * dy < 1) map.tiles[ly][lx] = T.WATER;
      }
    }
  });

  // 8) Вологий берег: рослини біля води часто стають очеретом
  var reeds = [];
  for (var by = 0; by < MAP_H; by++) {
    for (var bx = 0; bx < MAP_W; bx++) {
      if (!isPlant(map.tiles[by][bx])) continue;
      var near = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var n = 0; n < 4; n++) {
        var nx = bx + near[n][0], ny = by + near[n][1];
        if (inMap(nx, ny) && map.tiles[ny][nx] === T.WATER && rnd() < 0.7) {
          reeds.push([bx, by]);
          break;
        }
      }
    }
  }
  reeds.forEach(function (p) { map.tiles[p[1]][p[0]] = T.REEDS; });

  // 9) Ґрунтові дороги: де перетинають воду — брід
  geo.dirt.forEach(function (line) {
    walkPolyline(line, function (px, py) {
      if (!inMap(px, py)) return;
      var t = map.tiles[py][px];
      if (t === T.WATER) map.tiles[py][px] = T.FORD;
      else if (t !== T.ROAD && t !== T.BRIDGE) map.tiles[py][px] = T.DIRT;
    });
  });

  // 10) Асфальтові дороги: одна горизонтальна через всю карту, одна вертикальна через село.
  //     Де дорога перетинає воду — міст.
  for (var hx = 0; hx < MAP_W; hx++) {
    var th = map.tiles[15][hx];
    map.tiles[15][hx] = (th === T.WATER || th === T.FORD) ? T.BRIDGE : T.ROAD;
  }
  for (var vy = 0; vy < MAP_H; vy++) {
    var tv = map.tiles[vy][18];
    if (tv === T.WATER || tv === T.FORD) map.tiles[vy][18] = T.BRIDGE;
    else if (tv !== T.BRIDGE) map.tiles[vy][18] = T.ROAD;
  }

  // 11) Будинки села (сектор у центрі зліва: x 12..23, y 10..19)
  var houses = [
    [13, 11], [15, 11], [20, 11], [22, 11],
    [13, 13], [16, 13], [20, 13], [22, 13],
    [13, 17], [15, 17], [20, 17], [22, 17],
    [16, 18], [21, 19]
  ];
  // Кожен будинок і подвір'я навколо нього точно належать селу,
  // навіть якщо звивиста межа пройшла поруч. (Село завжди в центрі-ліворуч.)
  var village = map.sectors[1][1];
  for (var i = 0; i < houses.length; i++) {
    var hx2 = houses[i][0], hy2 = houses[i][1];
    for (var oy2 = -1; oy2 <= 1; oy2++) {
      for (var ox2 = -1; ox2 <= 1; ox2++) {
        var yx = hx2 + ox2, yy = hy2 + oy2;
        if (!inMap(yx, yy)) continue;
        map.sectorOf[yy][yx] = village;
        var tt = map.tiles[yy][yx];
        if (tt !== T.ROAD && tt !== T.BRIDGE && tt !== T.WATER) map.tiles[yy][yx] = T.YARD;
      }
    }
  }
  // Будинки ставимо ПІСЛЯ всіх подвір'їв, щоб подвір'я сусіда не затерло будинок
  for (var hh = 0; hh < houses.length; hh++) {
    map.tiles[houses[hh][1]][houses[hh][0]] = T.HOUSE;
  }

  // 12) Де вертоліт може набрати воду: «велика» вода (річка, озеро), не вузький струмок
  map.scoopTiles = [];
  for (var wy2 = 0; wy2 < MAP_H; wy2++) {
    for (var wx2 = 0; wx2 < MAP_W; wx2++) {
      if (map.tiles[wy2][wx2] !== T.WATER) continue;
      var count = 0;
      for (var a = -1; a <= 1; a++) {
        for (var b = -1; b <= 1; b++) {
          if (inMap(wx2 + b, wy2 + a) && map.tiles[wy2 + a][wx2 + b] === T.WATER) count++;
        }
      }
      if (count >= 5) map.scoopTiles.push([wx2, wy2]);
    }
  }

  map.relief = makeReliefLayer(map, geo.hills);
  return map;
}

// Який сектор у «сітці 4×3» лежить у точці (fx, fy). Не виходимо за краї карти.
function sectorAt(map, fx, fy) {
  var col = Math.max(0, Math.min(SECTOR_COLS - 1, Math.floor(fx / SECTOR_W)));
  var row = Math.max(0, Math.min(SECTOR_ROWS - 1, Math.floor(fy / SECTOR_H)));
  return map.sectors[row][col];
}

// Повертає сектор, до якого належить клітинка (x, y)
function getSector(map, x, y) {
  return map.sectorOf[y][x];
}

// Висота клітинки (за межами карти — як у найближчої)
function heightAt(map, x, y) {
  x = Math.max(0, Math.min(MAP_W - 1, x));
  y = Math.max(0, Math.min(MAP_H - 1, y));
  return map.height[y][x];
}

// ---------- РЕЛЬЄФ: тіні від пагорбів і лінії висоти ----------
// Висота в будь-якій точці (не лише в клітинці): сума «горбиків» від пагорбів
function smoothHeight(hills, fx, fy) {
  var h = 0;
  for (var k = 0; k < hills.length; k++) {
    var hill = hills[k];
    var d2 = (fx - hill.x) * (fx - hill.x) + (fy - hill.y) * (fy - hill.y);
    h += hill.h * Math.exp(-d2 / (2 * (hill.r / 2) * (hill.r / 2)));
  }
  return Math.min(1, h);
}

// Малюємо ОДИН раз у окремий невидимий canvas, а потім просто накладаємо.
// Рахуємо не по клітинках (16 пікселів), а дрібніше — по 4 пікселі, тому тіні плавні.
//  - Схил, повернутий до сонця (сонце зліва-згори), світліший; протилежний — темніший.
//  - Тонкі коричневі лінії (горизонталі) з'єднують місця однакової висоти, як на туристичній мапі.
function makeReliefLayer(map, hills) {
  var layer = document.createElement("canvas");
  layer.width = MAP_W * TILE;
  layer.height = MAP_H * TILE;
  var g = layer.getContext("2d");
  var STEP = 4;                       // розмір «дрібної клітинки» в пікселях
  var per = TILE / STEP;              // скільки дрібних у одній клітинці
  for (var sy = 0; sy < MAP_H * per; sy++) {
    for (var sx = 0; sx < MAP_W * per; sx++) {
      var tx = Math.floor(sx / per), ty = Math.floor(sy / per);
      var t = map.tiles[ty][tx];
      if (t === T.WATER || t === T.FORD) continue;
      // Координати в «клітинках» (центр клітинки x має координату x)
      var fx = (sx + 0.5) / per - 0.5, fy = (sy + 0.5) / per - 0.5;
      var h = smoothHeight(hills, fx, fy);
      if (h < 0.03) continue;          // рівнина — нічого не малюємо
      var nx = smoothHeight(hills, fx + 0.5, fy) - smoothHeight(hills, fx - 0.5, fy);
      var ny = smoothHeight(hills, fx, fy + 0.5) - smoothHeight(hills, fx, fy - 0.5);
      var light = (nx + ny) * 2.5;
      if (light > 0) g.fillStyle = "rgba(255, 240, 190, " + Math.min(0.3, light).toFixed(3) + ")";
      else g.fillStyle = "rgba(20, 25, 45, " + Math.min(0.38, -light).toFixed(3) + ")";
      g.fillRect(sx * STEP, sy * STEP, STEP, STEP);

      // Горизонталь: тут «поверх» висоти інший, ніж у сусіда праворуч чи знизу
      var lvl = Math.floor(h * 5);
      var hr = smoothHeight(hills, fx + 1 / per, fy), hd = smoothHeight(hills, fx, fy + 1 / per);
      if (lvl > 0 && (Math.floor(hr * 5) !== lvl || Math.floor(hd * 5) !== lvl)) {
        g.fillStyle = "rgba(90, 55, 25, 0.55)";
        g.fillRect(sx * STEP, sy * STEP, 2, 2);
      }
    }
  }
  // Піна біля берега: світла смужка там, де вода торкається суші
  g.fillStyle = "rgba(220, 240, 255, 0.55)";
  var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (var y = 0; y < MAP_H; y++) {
    for (var x = 0; x < MAP_W; x++) {
      var wt = map.tiles[y][x];
      if (wt !== T.WATER && wt !== T.FORD) continue;
      for (var d = 0; d < 4; d++) {
        var bx = x + dirs[d][0], by = y + dirs[d][1];
        if (!inMap(bx, by)) continue;
        var bt = map.tiles[by][bx];
        if (bt === T.WATER || bt === T.FORD || bt === T.BRIDGE) continue;
        if (dirs[d][0] === 1) g.fillRect((x + 1) * TILE - 2, y * TILE, 2, TILE);
        if (dirs[d][0] === -1) g.fillRect(x * TILE, y * TILE, 2, TILE);
        if (dirs[d][1] === 1) g.fillRect(x * TILE, (y + 1) * TILE - 2, TILE, 2);
        if (dirs[d][1] === -1) g.fillRect(x * TILE, y * TILE, TILE, 2);
      }
    }
  }
  return layer;
}

// Чи вода в цій клітинці «глибока» (з усіх боків вода) — тоді вона темніша
function deepWater(map, x, y) {
  var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (var d = 0; d < 4; d++) {
    var nx = x + dirs[d][0], ny = y + dirs[d][1];
    if (inMap(nx, ny) && map.tiles[ny][nx] !== T.WATER) return false;
  }
  return true;
}

// ---------- Малювання карти ----------
// time — час у секундах, щоб вода текла і переливалась
function drawMap(ctx, map, time) {
  for (var y = 0; y < MAP_H; y++) {
    for (var x = 0; x < MAP_W; x++) {
      var type = map.tiles[y][x];
      var name;
      if (type === T.WATER) {
        // Вода «тече»: кадр зсувається з часом, а біля берега вода світліша (мілка)
        var frame = Math.floor(time * 2 - y * 0.5 + x * 0.25);
        var deep = deepWater(map, x, y);
        name = (deep ? "water" : "shallow") + (((frame % 2) + 2) % 2 + 1);
      } else {
        var list = TILE_INFO[type].sprites;
        name = list[(x * 7 + y * 13) % list.length];  // різні дерева, щоб не було однаково
      }
      // Малюємо спрайт 8×8, збільшений до 16×16
      ctx.drawImage(SPRITES[name], x * TILE, y * TILE, TILE, TILE);
    }
  }
  // Рельєф і піна поверх клітинок
  ctx.drawImage(map.relief, 0, 0);

  // Відблиски сонця на воді: декілька білих пікселів, що мерехтять
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  for (var i = 0; i < map.scoopTiles.length; i += 7) {
    var p = map.scoopTiles[i];
    if (Math.sin(time * 3 + i * 1.7) > 0.85) {
      ctx.fillRect(p[0] * TILE + (i * 5) % 12 + 2, p[1] * TILE + (i * 3) % 10 + 3, 2, 2);
    }
  }
}
