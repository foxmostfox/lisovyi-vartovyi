// =============================================================
// report.js — підсумок рівня: очки, зірки і «Розбір рішень»,
// а також навчальні картки «Чи знаєш ти?».
// Розбір будується ТІЛЬКИ з того, що реально сталося в грі.
// =============================================================

// ---------- Картки «Чи знаєш ти?» ----------
// Лише перевірені поради, без вигаданих цифр.
var FACT_CARDS = [
  "Найчастіше ліс загоряється через людей: недогасле багаття, кинутий недопалок, спалювання сухої трави і сміття.",
  "Спалювати суху траву і листя небезпечно: вогонь легко перекидається на ліс і будинки. В Україні це заборонено і карається штрафом.",
  "Багаття розпалюй лише там, де дозволено, далеко від дерев і сухої трави. Перед відходом залий його водою і перемішай, доки попіл не стане холодним.",
  "Побачив пожежу — одразу телефонуй 101 (рятувальники) або 112. Скажи, що горить, де саме і чи є поруч люди.",
  "Якщо вогонь поруч — виходь у бік, протилежний вітру і вогню: до дороги, річки чи зораного поля. Ніс і рот прикрий мокрою тканиною від диму.",
  "Не тікай від лісової пожежі вгору схилом: угору вогонь біжить швидше, бо полум'я нагріває рослини, що вище.",
  "Вологі місця — берег з очеретом, болото — горять набагато гірше за сухий ліс і траву.",
  "Велику пожежу гасять рятувальники. Не намагайся гасити її сам — твоє завдання вийти в безпечне місце і подзвонити 101.",
  "Протипожежна смуга — це переорана земля без рослин. Їх роблять навколо лісів і сіл заздалегідь, щоб вогонь не мав чим живитися.",
  "У спеку трава й ліс висихають, і пожежна небезпека зростає. Тоді в ліс можуть заборонити заходити — стеж за попередженнями.",
  "Вітер несе іскри далеко вперед. Так вогонь «перестрибує» дороги і навіть річки.",
  "Річки, озера, дороги і зорані поля — природні перешкоди для вогню. Рятувальники використовують їх, щоб зупинити пожежу.",
  "Після сильної пожежі ліс відновлюється дуже багато років. Тому пожежу легше не допустити, ніж загасити."
];

// Випадкова картка (але не та, що була щойно)
var lastCard = -1;
function randomFactCard() {
  var i;
  do { i = Math.floor(Math.random() * FACT_CARDS.length); } while (i === lastCard && FACT_CARDS.length > 1);
  lastCard = i;
  return FACT_CARDS[i];
}

// ---------- Підрахунок ----------
// Рахує, скільки цінності збережено.
// Для кожного сектора: цінність × частка того, що НЕ згоріло.
function computeValue(map) {
  var saved = 0, total = 0;
  var sectors = [];
  for (var row = 0; row < SECTOR_ROWS; row++) {
    for (var col = 0; col < SECTOR_COLS; col++) {
      var s = map.sectors[row][col];
      var lostPart = s.burnt / Math.max(1, s.burnable);   // burnt = згоріло + горить зараз
      var keep = s.info.value * (1 - lostPart);
      saved += keep;
      total += s.info.value;
      sectors.push({ s: s, name: s.name, type: s.info.name, value: s.info.value,
                     lostPct: Math.round(lostPart * 100), saved: keep });
    }
  }
  return { saved: saved, total: total, pct: saved / total, sectors: sectors };
}

// Скільки будинків ціле (будинок, що горить, — уже втрачений)
function housesLeft(map) {
  var left = 0;
  for (var y = 0; y < MAP_H; y++) {
    for (var x = 0; x < MAP_W; x++) {
      if (map.tiles[y][x] === T.HOUSE && map.state[y][x] === 0) left++;
    }
  }
  return left;
}

// Повний підсумок рівня
function computeResults(map, level, cart, villageLost) {
  var v = computeValue(map);
  var houses = housesLeft(map);
  var spent = cartCost(cart);
  var unspent = level.budget - spent;

  // ОЧКИ = збережена цінність × 10 − витрати + половина невитрачених грошей
  var valuePoints = Math.round(v.saved * 10);
  var bonus = Math.round(unspent * 0.5);
  var score = valuePoints - spent + bonus;

  // Перемога: виконано обидві умови мети
  var win = !villageLost && houses >= level.goal.houses && v.pct >= level.goal.value;
  var stars = 0;
  if (win) {
    stars = 1;
    if (v.pct >= level.goal.value + 0.1) stars = 2;
    if (v.pct >= level.goal.value + 0.2 && houses === map.houseTotal) stars = 3;
  }

  return {
    value: v, houses: houses, houseTotal: map.houseTotal,
    spent: spent, unspent: unspent, valuePoints: valuePoints, bonus: bonus,
    score: score, win: win, stars: stars, villageLost: villageLost
  };
}

// Українські відмінки для чисел: 1 клітинку, 2 клітинки, 5 клітинок, 21 клітинку...
function plural(n, one, few, many) {
  var d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return n + " " + one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return n + " " + few;
  return n + " " + many;
}
function cells(n) { return plural(n, "клітинку", "клітинки", "клітинок"); }
function times(n) { return plural(n, "раз", "рази", "разів"); }

// ---------- РОЗБІР РІШЕНЬ ----------
// Повертає два списки пунктів { icon, text }:
//   decisions — що сталося на карті, що було вигідно, а що ні;
//   purchases — які покупки допомогли, а які були зайві.
function buildDebrief(map, units, cart, r) {
  var decisions = [];
  var purchases = [];
  function add(list, icon, text) { list.push({ icon: icon, text: text }); }

  // 1) Загалом
  add(decisions, "🗺", "Збережено " + Math.round(r.value.pct * 100) + "% цінності карти і " +
    r.houses + " з " + r.houseTotal + " будинків.");

  // 2) Де вогонь зупинила перешкода
  var kinds = [
    ["річка", "🌊", "Річка"], ["озеро", "🌊", "Озеро"], ["дорога", "🛣", "Дорога"],
    ["поле", "🌾", "Зоране поле"], ["скелі", "🪨", "Скелі"], ["смуга", "⛏", "Твоя протипожежна смуга"]
  ];
  var anyNatural = false;
  for (var k = 0; k < kinds.length; k++) {
    var st = map.stops[kinds[k][0]];
    if (!st) continue;
    var names = Object.keys(st.sectors).sort(function (a, b) { return st.sectors[b] - st.sectors[a]; });
    var where = names.slice(0, 3).join(", ");
    var verb = (kinds[k][0] === "поле" || kinds[k][0] === "озеро") ? " зупинило" :
               (kinds[k][0] === "скелі" ? " зупинили" : " зупинила");
    var text = kinds[k][2] + verb + " вогонь у " + plural(st.count, "місці", "місцях", "місцях") +
      ": " + where + ".";
    if (kinds[k][0] === "смуга") text += " Смуга спрацювала!";
    add(decisions, kinds[k][1], text);
    if (kinds[k][0] !== "смуга") anyNatural = true;
  }
  if (anyNatural) {
    add(decisions, "💡", "Річки, озера, скелі, дороги й поля зупиняють вогонь самі. Якщо за перешкодою нічого цінного — там гасити не обов'язково.");
  }

  // 3) Сектори: що було вигідно гасити, а що ні
  var houseLost = r.houseTotal - r.houses;
  r.value.sectors.forEach(function (sec) {
    var s = sec.s;
    var effort = s.extinguished + s.heliDrops * 5;   // скільки сил сюди вкладено
    if (s.type === "village") {
      if (houseLost === 0) add(decisions, "✅", "Село вціліло повністю — головне завдання виконано!");
      else add(decisions, "❌", "У селі згоріло будинків: " + houseLost + ". Село — найцінніше на карті, його треба прикривати першим.");
      return;
    }
    if (sec.value >= 30 && effort >= 5 && sec.lostPct < 40) {
      add(decisions, "✅", "Вигідно: ти захистив «" + sec.name + "» (цінність " + sec.value +
        ") — згоріло лише " + sec.lostPct + "%.");
    } else if (sec.value <= 5 && effort >= 15) {
      add(decisions, "⚠", "Невигідно: на «" + sec.name + "» (цінність лише " + sec.value +
        ") пішло багато сил — загашено " + cells(s.extinguished) +
        (s.heliDrops ? ", скидів вертольота: " + s.heliDrops : "") +
        ". Цю ділянку можна було віддати вогню до перешкоди, а сили кинути на цінніше.");
    } else if (sec.value >= 30 && sec.lostPct >= 50 && effort < 5) {
      add(decisions, "❌", "«" + sec.name + "» (цінність " + sec.value + ") згорів на " + sec.lostPct +
        "%, а техніка туди майже не потрапила. Варто було раніше послати вертоліт або бригаду.");
    } else if (sec.value >= 30 && sec.lostPct >= 50) {
      add(decisions, "⚠", "«" + sec.name + "» (цінність " + sec.value + "): ти гасив, але згоріло " + sec.lostPct +
        "%. Велику пожежу важко зупинити — техніку краще слати, поки вогонь ще маленький.");
    } else if (sec.value <= 5 && sec.lostPct >= 30 && effort < 5) {
      add(decisions, "✅", "Правильно: «" + sec.name + "» має малу цінність (" + sec.value +
        "), і ти не витрачав на нього сили.");
    }
  });

  // 4) Помічання пожеж
  if (map.lateFound.length > 0) {
    add(decisions, "🕐", "Люди помітили пожежу лише через " + DETECT_DELAY + " с " + times(map.lateFound.length) +
      " (" + map.lateFound.slice(0, 3).join(", ") + "). Вежа побачила б її одразу.");
  }

  // 5) Покупки
  units.forEach(function (u) {
    var name = unitName(u);
    if (u.type === "truck") {
      if (u.ext >= 15) add(purchases, "✅", name + " загасила " + cells(u.ext) + " — корисна покупка.");
      else if (u.ext > 0) add(purchases, "⚠", name + " загасила лише " + cells(u.ext) + ". Машина працює тільки біля доріг.");
      else add(purchases, "❌", name + " жодного разу не гасила — 350 ₴ витрачено даремно.");
    }
    if (u.type === "heli") {
      if (u.drops >= 3) add(purchases, "✅", name + " скидав воду " + times(u.drops) + " і загасив " + cells(u.ext) + ".");
      else if (u.drops > 0) add(purchases, "⚠", name + " злітав лише " + times(u.drops) + ". Після скиду він сам набирає воду в річці — відправляй його частіше.");
      else add(purchases, "❌", name + " жодного разу не злітав — 450 ₴ витрачено даремно.");
    }
    if (u.type === "brigade") {
      var fbStops = map.stops["смуга"] ? map.stops["смуга"].count : 0;
      if (u.dug > 0 && fbStops > 0) add(purchases, "✅", name + " вирила " + cells(u.dug) + " смуги, і вогонь об неї зупинявся.");
      else if (u.dug > 0) add(purchases, "⚠", name + " вирила " + cells(u.dug) + " смуги, але вогонь до неї не дійшов — смугу варто рити на шляху вогню, за вітром.");
      else add(purchases, "❌", name + " нічого не вирила — 200 ₴ витрачено даремно.");
    }
    if (u.type === "tower") {
      if (u.detections > 0) add(purchases, "✅", name + " одразу помітила вогонь " + times(u.detections) + ", без 15 с очікування.");
      else add(purchases, "⚠", name + " нічого не помітила — поряд не було пожеж. Став вежі там, звідки вітер жене вогонь на цінне.");
    }
  });
  if (cart.tank) {
    if (map.playerExt >= 10) add(purchases, "✅", "Додатковий бак знадобився: пожежник загасив " + cells(map.playerExt) + ".");
    else add(purchases, "⚠", "Додатковий бак майже не знадобився: пожежник загасив лише " + cells(map.playerExt) + ".");
  }
  if (cart.snacks) add(purchases, "🍫", "Шоколадки й бутерброди: команда була ситна і весела. Дешево і приємно!");
  if (units.length === 0 && !cart.tank && !cart.snacks) {
    add(purchases, "💰", "Ти нічого не купив. Бонус за невитрачені гроші: +" + r.bonus +
      ", але без техніки важко захистити все.");
  } else if (r.unspent > 0) {
    add(purchases, "💰", "Невитрачені " + r.unspent + " ₴ дали +" + r.bonus + " очок.");
  }
  if (map.playerExt > 0 && !cart.tank) {
    add(purchases, "🧑‍🚒", "Пожежник сам загасив " + cells(map.playerExt) + ".");
  }

  return { decisions: decisions, purchases: purchases };
}

// Маленька карта: що згоріло, що вціліло (по 4 пікселі на клітинку)
function drawMiniMap(map) {
  var c = document.createElement("canvas");
  c.width = MAP_W * 4;
  c.height = MAP_H * 4;
  var g = c.getContext("2d");
  for (var y = 0; y < MAP_H; y++) {
    for (var x = 0; x < MAP_W; x++) {
      var t = map.tiles[y][x];
      var col = "#3f8a3a";                                    // ціле
      if (t === T.GRASS) col = "#c9a74a";
      if (t === T.FIELD) col = "#946f42";
      if (t === T.HOUSE) col = "#e0d2b0";
      if (t === T.WATER) col = "#2a5aa8";
      if (t === T.ROAD || t === T.BRIDGE) col = "#7a7266";
      if (t === T.FIREBREAK) col = "#ffb84a";                 // вирита смуга
      if (t === T.REEDS) col = "#6a9a4a";
      if (t === T.SWAMP) col = "#3a5a30";
      if (t === T.ROCK) col = "#9a9a94";
      if (t === T.DIRT) col = "#a07c4a";
      if (t === T.FORD) col = "#4f94dc";
      if (map.state[y][x] === 1) col = "#ff5a1a";             // горить
      if (map.state[y][x] === 2) col = (t === T.HOUSE) ? "#e03a2a" : "#1e1c1a";  // згоріло
      g.fillStyle = col;
      g.fillRect(x * 4, y * 4, 4, 4);
    }
  }
  return c;
}

// Перетворює список пунктів на HTML
function listHtml(items) {
  var html = "<ul class='debrief'>";
  items.forEach(function (it) {
    html += "<li><span class='ico'>" + it.icon + "</span>" + it.text + "</li>";
  });
  return html + "</ul>";
}

// ---------- Вікно результатів ----------
function showResults(r, level, isLastLevel, onNext, onRetry, map, units, cart, onMenu) {
  var box = document.getElementById("shop");
  box.style.display = "block";

  var title = r.win ? "🏆 ПЕРЕМОГА!" : "🔥 ПОРАЗКА";
  var reason = "";
  if (r.villageLost) reason = "Згоріло забагато будинків — село не вдалося захистити.";
  else if (r.houses < level.goal.houses) reason = "Збережено замало будинків.";
  else if (!r.win) reason = "Згоріло забагато лісу — збережено замало цінності.";

  var starText = "";
  for (var i = 0; i < 3; i++) starText += (i < r.stars) ? "★" : "☆";

  var deb = buildDebrief(map, units, cart, r);

  // Таблиця секторів
  var rows = "";
  r.value.sectors.forEach(function (s) {
    var color = s.lostPct === 0 ? "#8cc05a" : (s.lostPct < 50 ? "#ffb84a" : "#e03a2a");
    rows += "<tr><td>" + s.name + "</td><td>" + s.value +
      "</td><td style='color:" + color + "'>" + s.lostPct + "%</td></tr>";
  });

  box.innerHTML =
    "<h2>" + level.name + " — " + title + " <span class='stars'>" + starText + "</span></h2>" +
    (reason ? "<p class='goal'>" + reason + "</p>" : "") +
    "<div class='shop-cols'>" +
      "<div class='shop-left'>" +
        "<h3>КАРТА ПІСЛЯ ПОЖЕЖІ</h3>" +
        "<div id='mini-map'></div>" +
        "<small>чорне — згоріло, червоне — згорілі будинки, помаранчеве — твої смуги</small>" +
        "<h3>ОЧКИ</h3>" +
        "<p>Будинків: <b>" + r.houses + " з " + r.houseTotal + "</b> (треба ≥ " + level.goal.houses + ")<br>" +
        "Цінності: <b>" + Math.round(r.value.pct * 100) + "%</b> (треба ≥ " +
          Math.round(level.goal.value * 100) + "%)<br>" +
        "Збережена цінність: +" + r.valuePoints + "<br>" +
        "Витрати на техніку: −" + r.spent + "<br>" +
        "Бонус за невитрачені " + r.unspent + " ₴: +" + r.bonus + "<br>" +
        "<b style='font-size:20px;color:#ffe066'>РАЗОМ: " + r.score + "</b></p>" +
        "<h3>СЕКТОРИ</h3>" +
        "<table class='report-table'><tr><th>Сектор</th><th>Цінність</th><th>Згоріло</th></tr>" +
        rows + "</table>" +
      "</div>" +
      "<div class='shop-right'>" +
        "<h3>🧠 РОЗБІР РІШЕНЬ</h3>" + listHtml(deb.decisions) +
        "<h3>🛒 ПОКУПКИ</h3>" + listHtml(deb.purchases) +
        "<div class='fact-card'><b>💡 ЧИ ЗНАЄШ ТИ?</b><p id='fact-text'>" + randomFactCard() + "</p>" +
          "<button id='btn-fact'>Ще картка</button></div>" +
        "<div class='fact-card sos'><b>🆘 ПОБАЧИВ ПОЖЕЖУ?</b> Телефонуй <b>101</b> або <b>112</b>, " +
          "відійди в безпечне місце проти вітру.</div>" +
      "</div>" +
    "</div>" +
    "<p>" +
      "<button id='btn-menu' class='big-btn'>🏠 Меню</button> " +
      "<button id='btn-retry' class='big-btn'>↻ Спробувати ще</button> " +
      ((r.win && !isLastLevel) ? "<button id='btn-next' class='big-btn'>Наступний рівень ▶</button>" : "") +
      ((r.win && isLastLevel) ? "<b style='color:#8cc05a'> Ти пройшов усі рівні! Справжній лісовий вартовий!</b>" : "") +
    "</p>";

  var mini = drawMiniMap(map);
  mini.className = "mini-map";
  document.getElementById("mini-map").appendChild(mini);

  document.getElementById("btn-fact").onclick = function () {
    document.getElementById("fact-text").textContent = randomFactCard();
  };
  document.getElementById("btn-retry").onclick = onRetry;
  document.getElementById("btn-menu").onclick = onMenu;
  var next = document.getElementById("btn-next");
  if (next) next.onclick = onNext;
  box.scrollTop = 0;
}
