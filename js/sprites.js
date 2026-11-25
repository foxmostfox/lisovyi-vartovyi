// =============================================================
// sprites.js — піксельні малюнки (спрайти), намальовані літерами.
// Кожна літера — це один піксель певного кольору з палітри.
// Крапка "." — прозорий піксель (нічого не малюємо).
// =============================================================

// ПАЛІТРА: обмежений набір кольорів для всієї гри
var PALETTE = {
  a: "#1e4d2b", // темно-зелений (хвоя)
  b: "#2f7a3a", // зелений
  c: "#5aa64a", // світло-зелений (листя)
  d: "#8cc05a", // трава біля дерев
  e: "#c9a74a", // суха трава
  q: "#a88a3a", // суха трава темніша
  f: "#6b4426", // стовбур / дерево
  t: "#8a5a32", // дошки мосту
  r: "#7a5a34", // рілля темна
  s: "#946f42", // рілля світла
  h: "#2a5aa8", // вода темна
  i: "#4a8ad8", // вода світла
  j: "#7a7266", // дорога
  k: "#9a9082", // дорога світліша
  l: "#b03a2e", // дах
  u: "#7a2a22", // тінь даху
  m: "#e0d2b0", // стіна будинку
  n: "#2a2420", // темний (двері, контур)
  o: "#f0f0e8", // білий
  p: "#a060c0", // фіолетова квітка (заповідник)
  D: "#4f94dc", // мілка вода
  E: "#bfe0f6", // піна, блиск
  F: "#8a8a84", // камінь
  G: "#5e5e5a", // камінь у тіні
  I: "#b8b8b0", // камінь на сонці
  J: "#a07c4a", // ґрунтова дорога
  K: "#80603a", // ґрунтова дорога темніша
  L: "#4a6a3a", // болото
  M: "#33482a", // болото темне
  N: "#d8cc6a"  // волоть очерету
};

// Розмір одного спрайта клітинки в пікселях
var SPRITE_SIZE = 8;

// Самі малюнки. Кожен — 8 рядків по 8 літер.
var SPRITE_DATA = {
  conifer1: [
    "bbbabbbb",
    "bbaaabbb",
    "baaaaabb",
    "bbaaabbb",
    "baaaaabb",
    "aaaaaaab",
    "bbbfbbbb",
    "bbbbbbbb"
  ],
  conifer2: [
    "bbabbbbb",
    "baaabbab",
    "aaaaabaa",
    "bbfbbaaa",
    "bbbbaaaa",
    "bbbbbbfb",
    "bbbbbbbb",
    "bbbbbbbb"
  ],
  deciduous1: [
    "dddddddd",
    "ddccccdd",
    "dcccccbd",
    "dccccbbd",
    "ddcbbbdd",
    "dddffddd",
    "dddffddd",
    "dddddddd"
  ],
  deciduous2: [
    "dccddddd",
    "cccbdddd",
    "ccbbddcc",
    "dfddcccb",
    "dfddcbbb",
    "ddddddfd",
    "ddddddfd",
    "dddddddd"
  ],
  grass1: [
    "eeeeeeee",
    "eqeeeeqe",
    "eeeeqeee",
    "eeeeeeee",
    "eeqeeeee",
    "eeeeeeqe",
    "eqeeeeee",
    "eeeeqeee"
  ],
  grass2: [
    "eeeqeeee",
    "eeeeeeee",
    "qeeeeeqe",
    "eeeeeeee",
    "eeeeqeee",
    "eqeeeeee",
    "eeeeeeqe",
    "eeeeeeee"
  ],
  field1: [
    "ssssssss",
    "rrrrrrrr",
    "scsscssc",
    "rrrrrrrr",
    "ssssssss",
    "rrrrrrrr",
    "sscsscss",
    "rrrrrrrr"
  ],
  field2: [
    "ssssssss",
    "rrrrrrrr",
    "ssssssss",
    "rrrrrrrr",
    "csscsssc",
    "rrrrrrrr",
    "ssssssss",
    "rrrrrrrr"
  ],
  house: [
    "ddllllld",
    "dlllllld",
    "llllllll",
    "uuuuuuuu",
    "dmmmmmmd",
    "dmimmnmd",
    "dmmmmnmd",
    "dddddddd"
  ],
  yard1: [
    "dddddddd",
    "ddddcddd",
    "dddddddd",
    "dcdddddd",
    "dddddddd",
    "ddddddcd",
    "dddddddd",
    "dddcdddd"
  ],
  yard2: [
    "dddddddd",
    "dcdddddd",
    "dddddcdd",
    "dddddddd",
    "ddcddddd",
    "dddddddd",
    "ddddddcd",
    "dddddddd"
  ],
  water1: [
    "hhhhhhhh",
    "hhiihhhh",
    "hhhhhhhh",
    "hhhhhiih",
    "hhhhhhhh",
    "hiihhhhh",
    "hhhhhhhh",
    "hhhhiihh"
  ],
  water2: [
    "hhhhhhhh",
    "hhhhiihh",
    "hhhhhhhh",
    "hiihhhhh",
    "hhhhhhhh",
    "hhhhhiih",
    "hhhhhhhh",
    "hhiihhhh"
  ],
  shallow1: [
    "DDDDDDDD",
    "DDEEDDDD",
    "DDDDDDDD",
    "DDDDDEED",
    "DDDDDDDD",
    "DEEDDDDD",
    "DDDDDDDD",
    "DDDDEEDD"
  ],
  shallow2: [
    "DDDDDDDD",
    "DDDDEEDD",
    "DDDDDDDD",
    "DEEDDDDD",
    "DDDDDDDD",
    "DDDDDEED",
    "DDDDDDDD",
    "DDEEDDDD"
  ],
  reeds1: [
    "dNddNdNd",
    "dbdNbdbd",
    "Nbdbbdbd",
    "bbdbbNbd",
    "bbNbbbbd",
    "bbbbbbbN",
    "DDbDDbbD",
    "DDDDDDDD"
  ],
  reeds2: [
    "NddNddNd",
    "bdNbdNbd",
    "bdbbdbbN",
    "bNbbdbbb",
    "bbbbNbbb",
    "bbbbbbbb",
    "bDDbbDDb",
    "DDDDDDDD"
  ],
  swamp1: [
    "MLLMLLML",
    "LLDDLLML",
    "LDDDLMLL",
    "LLDLLLLM",
    "MLLLMLDL",
    "LLMLLDDL",
    "LDLLLLDL",
    "LLLMLLLL"
  ],
  swamp2: [
    "LLMLLLLM",
    "LMLLDDLL",
    "LLLDDDLL",
    "MLLLDLLM",
    "LLDLLLLL",
    "LDDLMLLL",
    "LLLLLLDL",
    "MLLLMLLL"
  ],
  rock1: [
    "ddFFFddd",
    "dFIIFGdd",
    "FIIFFGGd",
    "FFFFGGGd",
    "dGGGGGdd",
    "ddddFFFd",
    "dddFIFGd",
    "dddGGGGd"
  ],
  rock2: [
    "dddddFFd",
    "dFFdFIFG",
    "FIIFdGGG",
    "FIFFGdGd",
    "GGGGGddd",
    "dddFFFdd",
    "ddFIIFGd",
    "ddGGGGGd"
  ],
  dirt: [
    "JJJJJJJJ",
    "JKJJJJKJ",
    "JJJJKJJJ",
    "JJKJJJJJ",
    "JJJJJJKJ",
    "KJJJJJJJ",
    "JJJJKJJJ",
    "JJJJJJJJ"
  ],
  ford: [
    "DDDDDDDD",
    "DIDDDEDD",
    "DDDGDDDD",
    "DEDDDDID",
    "DDDDIDDD",
    "DDGDDDED",
    "DIDDDDDD",
    "DDDDEDGD"
  ],
  road: [
    "jjjjjjjj",
    "jjjkjjjj",
    "jjjjjjkj",
    "jkjjjjjj",
    "jjjjjjjj",
    "jjjjkjjj",
    "jjkjjjjj",
    "jjjjjjjj"
  ],
  bridge: [
    "nnnnnnnn",
    "tftftftf",
    "tftftftf",
    "tftftftf",
    "tftftftf",
    "tftftftf",
    "tftftftf",
    "nnnnnnnn"
  ],
  firebreak: [
    "rrrrrrrr",
    "rsrrrrsr",
    "rrrrrrrr",
    "rrsrrrrr",
    "rrrrrsrr",
    "rrrrrrrr",
    "srrrrrrs",
    "rrrrrrrr"
  ],
  oldtree: [
    "cbbbbbcc",
    "bbaabbbc",
    "baabbaab",
    "bbbaabbb",
    "cbbbbbbc",
    "cccffccc",
    "cpcffcoc",
    "cccccccc"
  ]
};

// Тут зберігатимуться готові картинки (маленькі canvas) для кожного спрайта
var SPRITES = {};

// Перетворює масив літер у маленький canvas з пікселями
function makeSprite(rows) {
  var canvas = document.createElement("canvas");
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  var c = canvas.getContext("2d");

  for (var y = 0; y < rows.length; y++) {
    for (var x = 0; x < rows[y].length; x++) {
      var letter = rows[y][x];
      if (letter === ".") continue;          // прозорий піксель
      c.fillStyle = PALETTE[letter];
      c.fillRect(x, y, 1, 1);                // малюємо 1 піксель
    }
  }
  return canvas;
}

// Створює всі спрайти один раз на початку гри
function loadSprites() {
  for (var name in SPRITE_DATA) {
    SPRITES[name] = makeSprite(SPRITE_DATA[name]);
  }
}
