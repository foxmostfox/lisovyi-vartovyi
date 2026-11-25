// =============================================================
// shop.js — екран планування і закупівлі перед рівнем:
// прогноз погоди, індекс небезпеки, поради радника, бюджет, покупки.
// =============================================================

// Що можна купити. max — скільки штук максимум.
var SHOP_ITEMS = [
  { id: "truck", name: "Пожежна машина", price: 350, max: 2, icon: "truck",
    desc: "Їздить дорогами і ґрунтовками (через брід теж). Сама гасить вогонь поруч (2 клітинки), поки є вода. Воду набирає біля річки чи озера." },
  { id: "heli", name: "Вертоліт", price: 450, max: 2, icon: "heli",
    desc: "Летить куди завгодно і скидає воду на велику ділянку. Потім сам летить до найближчої річки чи озера набрати воду (3 с)." },
  { id: "brigade", name: "Бригада з лопатами", price: 200, max: 3, icon: "brigade",
    desc: "Риє протипожежну смугу: клік — впоперек вітру, ПОТЯГНИ мишкою — куди хочеш (до 12 клітинок). Через смугу вогонь не пройде." },
  { id: "tower", name: "Вежа спостереження", price: 150, max: 3, icon: "tower",
    desc: "Одразу бачить вогонь навколо себе. Без вежі пожежу помітять лише через 15 с, коли люди побачать дим." },
  { id: "tank", name: "Додатковий бак", price: 80, max: 2, icon: "water1",
    desc: "+50 води в баку пожежника, яким ти бігаєш сам." },
  { id: "snacks", name: "Шоколадки й бутерброди", price: 30, max: 1, icon: "snacks",
    desc: "Ситна команда — весела команда! Пожежник бігає на 15% швидше і повільніше перегрівається." }
];

// Спрайт шоколадки для магазину
SPRITE_DATA.snacks = [
  "........",
  ".ffffff.",
  ".fnfnff.",
  ".ffffff.",
  ".mmmmmm.",
  ".mccccm.",
  ".mmmmmm.",
  "........"
];

// Назва вітру за кутом (той самий принцип, що в weather.js)
function windNameByDeg(deg) {
  var deg360 = ((deg % 360) + 360) % 360;
  return WIND_FROM_NAMES[Math.round(deg360 / 45) % 8];
}

// Секунди → «1:30»
function formatTime(sec) {
  var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

// Показує екран магазину. level — дані рівня, cart — покупки { truck: 1, ... }
// onDone — що робити, коли гравець натисне «Далі»
function showShop(level, cart, onDone) {
  var box = document.getElementById("shop");
  box.style.display = "block";

  // Небезпека на початку і найбільша за рівень (прогноз)
  var wStart = createWeather(level.weather);
  var maxLevel = 0;
  for (var t = 0; t <= level.duration; t += 5) {
    var wt = createWeather(level.weather);
    updateWeather(wt, t);
    maxLevel = Math.max(maxLevel, wt.dangerLevel);
  }

  // Прогноз: старт + кожна зміна з плану погоди
  var forecast = "";
  for (var i = 0; i < level.weather.length; i++) {
    var p = level.weather[i];
    if (p.t > level.duration) break;
    forecast += "<li><b>" + formatTime(p.t) + "</b> — " + p.temp + "°C, вологість " + p.hum +
      "%, вітер " + windNameByDeg(p.windDir) + " " + Math.round(p.wind * 10) + "/10</li>";
  }

  var tips = "";
  for (var k = 0; k < level.tips.length; k++) tips += "<li>" + level.tips[k] + "</li>";

  box.innerHTML =
    "<h2>" + level.name + " — ПЛАНУВАННЯ</h2>" +
    "<p class='goal'>🎯 МЕТА за " + formatTime(level.duration) + ": зберегти щонайменше <b>" +
      level.goal.houses + " будинків</b> у селі і <b>" + Math.round(level.goal.value * 100) +
      "% цінності</b> всієї карти (ліси, заповідник теж рахуються!)</p>" +
    "<div class='shop-cols'>" +
      "<div class='shop-left'>" +
        "<h3>ПРОГНОЗ ПОГОДИ</h3><ul>" + forecast + "</ul>" +
        "<p>Небезпека зараз: <span style='color:" + DANGER_COLORS[wStart.dangerLevel] + "'>клас " +
          (wStart.dangerLevel + 1) + " — " + DANGER_NAMES[wStart.dangerLevel] + "</span><br>" +
        "Найвища за прогнозом: <span style='color:" + DANGER_COLORS[maxLevel] + "'>клас " +
          (maxLevel + 1) + " — " + DANGER_NAMES[maxLevel] + "</span></p>" +
        "<h3>🧓 ПОРАДИ РАДНИКА</h3><ul class='tips'>" + tips + "</ul>" +
        "<div class='fact-card'><b>💡 ЧИ ЗНАЄШ ТИ?</b><p>" + randomFactCard() + "</p></div>" +
      "</div>" +
      "<div class='shop-right'>" +
        "<h3>ЗАКУПІВЛЯ</h3>" +
        "<div id='shop-items'></div>" +
        "<div id='shop-money'></div>" +
        "<button id='shop-done' class='big-btn'>Далі: розставити техніку ▶</button>" +
      "</div>" +
    "</div>";

  renderShopItems(level, cart);
  document.getElementById("shop-done").onclick = function () {
    box.style.display = "none";
    onDone();
  };
}

// Скільки грошей уже витрачено
function cartCost(cart) {
  var sum = 0;
  for (var i = 0; i < SHOP_ITEMS.length; i++) {
    sum += (cart[SHOP_ITEMS[i].id] || 0) * SHOP_ITEMS[i].price;
  }
  return sum;
}

// Малює список товарів з кнопками − і +
function renderShopItems(level, cart) {
  var list = document.getElementById("shop-items");
  list.innerHTML = "";
  var left = level.budget - cartCost(cart);

  SHOP_ITEMS.forEach(function (item) {
    var count = cart[item.id] || 0;
    var row = document.createElement("div");
    row.className = "shop-item";

    var icon = document.createElement("canvas");
    icon.width = 8; icon.height = 8;
    icon.getContext("2d").drawImage(SPRITES[item.icon], 0, 0);
    row.appendChild(icon);

    var text = document.createElement("div");
    text.className = "shop-text";
    text.innerHTML = "<b>" + item.name + "</b> — " + item.price + " ₴<br><small>" + item.desc + "</small>";
    row.appendChild(text);

    var minus = document.createElement("button");
    minus.textContent = "−";
    minus.disabled = count === 0;
    minus.onclick = function () { cart[item.id] = count - 1; renderShopItems(level, cart); };

    var num = document.createElement("span");
    num.className = "shop-count";
    num.textContent = count;

    var plus = document.createElement("button");
    plus.textContent = "+";
    plus.disabled = count >= item.max || item.price > left;   // не вистачає грошей
    plus.onclick = function () { cart[item.id] = count + 1; renderShopItems(level, cart); };

    row.appendChild(minus);
    row.appendChild(num);
    row.appendChild(plus);
    list.appendChild(row);
  });

  document.getElementById("shop-money").innerHTML =
    "Бюджет: " + level.budget + " ₴ &nbsp; Витрачено: " + cartCost(cart) +
    " ₴ &nbsp; <b style='color:#8cc05a'>Залишок: " + left + " ₴</b><br>" +
    "<small>Очки = збережена цінність − витрати + половина невитрачених грошей.</small>";
}
