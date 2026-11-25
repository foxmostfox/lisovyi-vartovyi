// =============================================================
// player.js — гравець-пожежник: спрайт, рух, зіткнення з водою.
// =============================================================

// Додаткові кольори для пожежника (додаємо їх у спільну палітру)
PALETTE.y = "#f0c030"; // жовта каска
PALETTE.v = "#e06a20"; // помаранчевий костюм
PALETTE.w = "#f0b890"; // шкіра

// Три кадри: стоїть, крок лівою, крок правою.
// Крапка — прозорий піксель, тому видно траву під гравцем.
SPRITE_DATA.player_idle = [
  "..yyyy..",
  ".yyyyyy.",
  "..wnwn..",
  ".vvvvvv.",
  "wvoooovw",
  ".vvvvvv.",
  ".vv..vv.",
  ".nn..nn."
];
SPRITE_DATA.player_walk1 = [
  "..yyyy..",
  ".yyyyyy.",
  "..wnwn..",
  ".vvvvvv.",
  "wvoooovw",
  ".vvvvvv.",
  ".vv..v..",
  ".nn..n.."
];
SPRITE_DATA.player_walk2 = [
  "..yyyy..",
  ".yyyyyy.",
  "..wnwn..",
  ".vvvvvv.",
  "wvoooovw",
  ".vvvvvv.",
  "..v..vv.",
  "..n..nn."
];

// Створює гравця на клітинці (tx, ty)
function createPlayer(tx, ty) {
  return {
    x: tx * TILE + TILE / 2,   // позиція центру гравця в пікселях
    y: ty * TILE + TILE / 2,
    speed: 70,                 // швидкість: пікселів за секунду
    moving: false,             // чи йде зараз
    walkTime: 0,               // таймер для анімації кроків
    facingLeft: false,         // куди дивиться (щоб віддзеркалити спрайт)
    dirX: 0, dirY: 1,          // напрямок погляду — туди б'є струмінь (спочатку вниз)
    water: 100,                // скільки води в баку
    maxWater: 100,             // місткість бака
    spraying: false,           // чи ллє зараз воду
    refilling: false,          // чи набирає воду
    emptyWarning: 0,           // таймер підказки «бак порожній»
    heat: 0,                   // перегрів від 0 до 100
    overheated: false,         // якщо true — гравець повільніший
    cooling: "",               // чому охолоджується: "вода", "тінь" або ""
    drops: []                  // краплі струменя (для краси)
  };
}

// ---------- ВОДА ----------
var WATER_USE = 30;     // скільки води витрачається за секунду струменя
var WATER_REFILL = 45;  // скільки води набирається за секунду біля водойми

// Клітинки, на які падає струмінь: «конус» на 3 клітинки вперед.
// На відстані 2 і 3 струмінь розширюється на клітинку вбоки.
function jetTiles(p) {
  var tx = Math.floor(p.x / TILE);
  var ty = Math.floor((p.y + 4) / TILE);
  var list = [[tx, ty]];   // і клітинка під ногами
  for (var d = 1; d <= 3; d++) {
    var cx = tx + p.dirX * d;
    var cy = ty + p.dirY * d;
    list.push([cx, cy]);
    if (d >= 2) {
      // перпендикулярний напрямок: (-dirY, dirX)
      list.push([cx - p.dirY, cy + p.dirX]);
      list.push([cx + p.dirY, cy - p.dirX]);
    }
  }
  return list;
}

// Чи є вода поруч із гравцем (у квадраті 3×3 навколо ніг)
function nearWater(p, map) {
  var tx = Math.floor(p.x / TILE);
  var ty = Math.floor((p.y + 4) / TILE);
  for (var oy = -1; oy <= 1; oy++) {
    for (var ox = -1; ox <= 1; ox++) {
      if (inMap(tx + ox, ty + oy) && (map.tiles[ty + oy][tx + ox] === T.WATER ||
          map.tiles[ty + oy][tx + ox] === T.FORD)) return true;
    }
  }
  return false;
}

function updateWater(p, map, keys, dt) {
  // 1) Струмінь: тримаємо пробіл, поки є вода
  p.spraying = false;
  if (keys.Space) {
    if (p.water > 0) {
      p.spraying = true;
      p.water = Math.max(0, p.water - WATER_USE * dt);
      var tiles = jetTiles(p);
      for (var i = 0; i < tiles.length; i++) {
        if (douseTile(map, tiles[i][0], tiles[i][1], dt)) map.playerExt++;
      }
      // Краплі летять у напрямку погляду з невеликим розкидом
      for (var k = 0; k < 4; k++) {
        var len = Math.sqrt(p.dirX * p.dirX + p.dirY * p.dirY);
        var speed = 120 + Math.random() * 60;
        p.drops.push({
          x: p.x, y: p.y,
          vx: (p.dirX / len) * speed + (Math.random() - 0.5) * 50,
          vy: (p.dirY / len) * speed + (Math.random() - 0.5) * 50,
          life: 0.3
        });
      }
    } else {
      p.emptyWarning = 2;   // показати підказку 2 секунди
    }
  }
  if (p.emptyWarning > 0) p.emptyWarning -= dt;

  // 2) Поповнення: стоїш біля води і не ллєш — бак наповнюється
  p.refilling = false;
  if (!p.spraying && p.water < p.maxWater && nearWater(p, map)) {
    p.refilling = true;
    p.water = Math.min(p.maxWater, p.water + WATER_REFILL * dt);
  }

  // 3) Краплі летять і зникають
  for (var d = p.drops.length - 1; d >= 0; d--) {
    var drop = p.drops[d];
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
    drop.life -= dt;
    if (drop.life <= 0) p.drops.splice(d, 1);
  }
}

// ---------- ПЕРЕГРІВ ----------
// Росте: від спеки (вище 25°C) і біля вогню.
// Спадає: біля води (дуже швидко) і в тіні дерев.
// Якщо шкала повна — гравець удвічі повільніший, поки не охолоне до 60.
function updateHeat(p, map, weather, dt) {
  var tx = Math.floor(p.x / TILE);
  var ty = Math.floor((p.y + 4) / TILE);

  // Чи є вогонь поруч (у квадраті 5×5)
  var nearFire = false;
  for (var oy = -2; oy <= 2; oy++) {
    for (var ox = -2; ox <= 2; ox++) {
      if (inMap(tx + ox, ty + oy) && map.state[ty + oy][tx + ox] === 1) nearFire = true;
    }
  }

  // Тінь — це ціле (не згоріле) дерево під ногами
  var tile = map.tiles[ty][tx];
  var shade = map.state[ty][tx] === 0 &&
    (tile === T.CONIFER || tile === T.DECIDUOUS || tile === T.OLDTREE);

  var change = Math.max(0, weather.temp - 25) * 0.3;  // спека: при 35°C це +3 за секунду
  if (nearFire) change += 8;                          // жар від вогню
  p.cooling = "";
  if (nearWater(p, map)) {
    change -= 30;
    p.cooling = "вода";
  } else if (shade && !nearFire) {
    change -= 8;
    p.cooling = "тінь";
  }
  // Шоколадки з магазину: гріємося повільніше (heatMult = 0.8)
  if (change > 0 && p.heatMult) change *= p.heatMult;

  p.heat = Math.max(0, Math.min(100, p.heat + change * dt));
  if (p.heat >= 100) p.overheated = true;
  if (p.overheated && p.heat < 60) p.overheated = false;
}

// Малює краплі струменя
function drawDrops(ctx, p) {
  ctx.fillStyle = "#9ad0ff";
  for (var i = 0; i < p.drops.length; i++) {
    ctx.fillRect(Math.round(p.drops[i].x) - 1, Math.round(p.drops[i].y) - 1, 3, 3);
  }
}

// Малює одну шкалу: підпис, порожня частина і заповнена частина
function drawBar(ctx, x, y, label, value, max, color) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(x, y, 190, 22);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px monospace";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 6, y + 11);
  ctx.fillStyle = "#1a1a24";
  ctx.fillRect(x + 48, y + 5, 134, 12);
  ctx.fillStyle = color;
  ctx.fillRect(x + 48, y + 5, Math.round(134 * value / max), 12);
}

// Шкали гравця в лівому нижньому куті: ВОДА і ЖАР (перегрів)
function drawPlayerHUD(ctx, p, time) {
  var x = 8, y = MAP_H * TILE - 30;
  drawBar(ctx, x, y, "ВОДА", p.water, p.maxWater, p.water < 25 ? "#ff7a1a" : "#4a8ad8");

  // Шкала жару: коли перегрівся — блимає червоним
  var heatColor = "#ffb84a";
  if (p.heat > 70) heatColor = "#ff7a1a";
  if (p.overheated) heatColor = (Math.floor(time * 4) % 2) ? "#e03a2a" : "#ffe066";
  drawBar(ctx, x, y - 26, "ЖАР", p.heat, 100, heatColor);

  // Підказка над шкалами
  var msg = "", msgColor = "#ffb84a";
  if (p.overheated) {
    msg = "ПЕРЕГРІВ! Шукай тінь або воду";
    msgColor = "#ff7a1a";
  } else if (p.emptyWarning > 0) {
    msg = "Бак порожній! Біжи до річки чи озера";
  } else if (p.refilling) {
    msg = "Набираю воду...";
    msgColor = "#9ad0ff";
  } else if (p.cooling === "тінь" && p.heat > 0) {
    msg = "Відпочиваю в тіні";
    msgColor = "#8cc05a";
  }
  if (msg) {
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(x, y - 50, ctx.measureText(msg).width + 12, 20);
    ctx.fillStyle = msgColor;
    ctx.fillText(msg, x + 6, y - 40);
  }
}

// Чи можна стояти на цій клітинці? По воді й крізь будинки ходити не можна.
// Міст — можна.
function isWalkable(map, tx, ty) {
  if (!inMap(tx, ty)) return false;
  var type = map.tiles[ty][tx];
  return type !== T.WATER && type !== T.HOUSE && type !== T.ROCK;
}

// Перевіряє, чи вільне місце для «ніг» гравця в точці (px, py).
// Ноги — маленький прямокутник 10×6 пікселів, перевіряємо його 4 кути.
function canStand(map, px, py) {
  var halfW = 5;
  var points = [
    [px - halfW, py + 2], [px + halfW, py + 2],
    [px - halfW, py + 7], [px + halfW, py + 7]
  ];
  for (var i = 0; i < points.length; i++) {
    var tx = Math.floor(points[i][0] / TILE);
    var ty = Math.floor(points[i][1] / TILE);
    if (!isWalkable(map, tx, ty)) return false;
  }
  return true;
}

// Рух гравця. keys — які клавіші зараз натиснуті.
function updatePlayer(p, map, keys, dt) {
  // 1) Напрямок з клавіш: -1, 0 або 1 по кожній осі
  var dx = 0, dy = 0;
  if (keys.KeyA || keys.ArrowLeft)  dx -= 1;
  if (keys.KeyD || keys.ArrowRight) dx += 1;
  if (keys.KeyW || keys.ArrowUp)    dy -= 1;
  if (keys.KeyS || keys.ArrowDown)  dy += 1;

  // 2) По діагоналі не бігаємо швидше: ділимо на √2
  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }

  // 3) Швидкість залежить від місцевості: по дорозі швидше, у лісі повільніше
  var speed = p.speed;
  var tile = map.tiles[Math.floor((p.y + 4) / TILE)][Math.floor(p.x / TILE)];
  if (tile === T.ROAD || tile === T.BRIDGE) speed *= 1.3;
  if (tile === T.CONIFER || tile === T.OLDTREE) speed *= 0.75;
  if (tile === T.DIRT) speed *= 1.15;
  if (tile === T.SWAMP || tile === T.FORD) speed *= 0.6;   // у болоті й броді ноги грузнуть
  if (p.overheated) speed *= 0.5;   // перегрівся — ледве йде

  // 4) Рухаємо окремо по X і по Y.
  //    Так гравець «ковзає» вздовж річки, а не застрягає в ній.
  var newX = p.x + dx * speed * dt;
  if (canStand(map, newX, p.y)) p.x = newX;
  var newY = p.y + dy * speed * dt;
  if (canStand(map, p.x, newY)) p.y = newY;

  // 5) Анімація
  p.moving = (dx !== 0 || dy !== 0);
  // Запам'ятовуємо напрямок погляду (8 напрямків) — туди бризкатиме вода
  if (p.moving) {
    p.dirX = Math.sign(dx);
    p.dirY = Math.sign(dy);
  }
  if (p.moving) p.walkTime += dt;
  if (dx < 0) p.facingLeft = true;
  if (dx > 0) p.facingLeft = false;
}

// Малює гравця з тінню
function drawPlayer(ctx, p) {
  var left = Math.round(p.x - TILE / 2);
  var top = Math.round(p.y - TILE / 2);

  // Тінь під ногами (темний напівпрозорий овал)
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 7, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Обираємо кадр: стоїть або чергує кроки 8 разів на секунду
  var sprite = SPRITES.player_idle;
  if (p.moving) {
    sprite = (Math.floor(p.walkTime * 8) % 2 === 0) ? SPRITES.player_walk1 : SPRITES.player_walk2;
  }

  if (p.facingLeft) {
    // Віддзеркалюємо картинку по горизонталі
    ctx.save();
    ctx.translate(left + TILE, top);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, 0, TILE, TILE);
    ctx.restore();
  } else {
    ctx.drawImage(sprite, left, top, TILE, TILE);
  }
}
