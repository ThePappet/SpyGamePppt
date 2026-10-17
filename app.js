(function () {
  "use strict";

  var DATA = window.GAME_DATA || {};
  var categoryKeys = Object.keys(DATA).filter(function (k) {
    return Array.isArray(DATA[k]) && DATA[k].length > 0;
  });

  var state = {
    players: [],
    category: categoryKeys[0] || "",
    spyMode: "fixed",
    spyCount: 1,
    lastWord: null,
    word: "",
    spies: new Set(),
    dealIndex: 0,
    locked: false
  };

  var el = {
    setup: document.getElementById("screen-setup"),
    deal: document.getElementById("screen-deal"),
    results: document.getElementById("screen-results"),
    addForm: document.getElementById("add-player-form"),
    playerInput: document.getElementById("player-input"),
    playersList: document.getElementById("players-list"),
    playersCount: document.getElementById("players-count"),
    playersHint: document.getElementById("players-hint"),
    categories: document.getElementById("categories"),
    spyMode: document.getElementById("spy-mode"),
    spyFixed: document.getElementById("spy-fixed"),
    spyValue: document.getElementById("spy-value"),
    spyMinus: document.getElementById("spy-minus"),
    spyPlus: document.getElementById("spy-plus"),
    spyHint: document.getElementById("spy-hint"),
    btnStart: document.getElementById("btn-start"),
    dealProgress: document.getElementById("deal-progress"),
    dealHint: document.getElementById("deal-hint"),
    card: document.getElementById("card"),
    cardName: document.getElementById("card-name"),
    cardBack: document.getElementById("card-back"),
    roleKicker: document.getElementById("role-kicker"),
    roleReveal: document.getElementById("role-reveal"),
    turnOrder: document.getElementById("turn-order"),
    revealPanel: document.getElementById("reveal-panel"),
    revealWord: document.getElementById("reveal-word"),
    revealSpies: document.getElementById("reveal-spies"),
    btnFinish: document.getElementById("btn-finish"),
    footerActions: document.getElementById("footer-actions"),
    btnNewGame: document.getElementById("btn-new-game"),
    btnReplay: document.getElementById("btn-replay")
  };

  /* ---------- утилиты ---------- */

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1);
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function humanize(key) {
    return key.replace(/_/g, " ");
  }

  function showScreen(screen) {
    [el.setup, el.deal, el.results].forEach(function (s) {
      s.classList.toggle("active", s === screen);
    });
  }

  /* ---------- экран создания ---------- */

  function renderPlayers() {
    el.playersList.innerHTML = "";
    state.players.forEach(function (name, i) {
      var li = document.createElement("li");
      li.className = "chip";
      var span = document.createElement("span");
      span.textContent = name;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "remove";
      btn.setAttribute("aria-label", "Удалить " + name);
      btn.textContent = "✕";
      btn.addEventListener("click", function () {
        state.players.splice(i, 1);
        renderPlayers();
      });
      li.appendChild(span);
      li.appendChild(btn);
      el.playersList.appendChild(li);
    });

    el.playersList.hidden = state.players.length === 0;
    el.playersCount.textContent = state.players.length;

    var ok = state.players.length >= 3;
    el.btnStart.disabled = !ok;
    el.playersHint.classList.toggle("warn", state.players.length > 0 && !ok);
    el.playersHint.textContent = ok
      ? "Всё готово — можно начинать"
      : "Добавьте минимум 3 игроков (сейчас " + state.players.length + ")";

    clampSpyCount();
    renderSpyControls();
  }

  function renderCategories() {
    el.categories.innerHTML = "";
    categoryKeys.forEach(function (key) {
      var li = document.createElement("li");
      li.className = "chip" + (key === state.category ? " selected" : "");
      li.textContent = humanize(key);
      li.addEventListener("click", function () {
        state.category = key;
        renderCategories();
      });
      el.categories.appendChild(li);
    });
  }

  function clampSpyCount() {
    if (state.players.length === 0) return;
    state.spyCount = Math.max(0, Math.min(state.spyCount, state.players.length));
  }

  function renderSpyControls() {
    var n = state.players.length;
    var hasPlayers = n > 0;
    el.spyValue.textContent = hasPlayers ? state.spyCount : 0;
    el.spyMinus.disabled = !hasPlayers || state.spyCount <= 0;
    el.spyPlus.disabled = !hasPlayers || state.spyCount >= n;

    var fixed = state.spyMode === "fixed";
    el.spyFixed.hidden = !fixed;
    el.spyHint.textContent = fixed
      ? n > 0
        ? "Шпионов: " + state.spyCount + " из " + n + ". Остальные получат одно слово."
        : "Выберите количество шпионов после добавления игроков."
      : n > 0
        ? "Случайно: от 0 (шпионов нет) до " + n + " (все — шпионы)."
        : "Шпионов может оказаться половина, все или вообще никто.";
  }

  el.addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = el.playerInput.value.trim();
    if (!name) return;
    state.players.push(name);
    el.playerInput.value = "";
    el.playerInput.focus();
    renderPlayers();
  });

  el.spyMode.addEventListener("click", function (e) {
    var btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.spyMode = btn.dataset.mode;
    el.spyMode.querySelectorAll(".seg-btn").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
    renderSpyControls();
  });

  el.spyMinus.addEventListener("click", function () {
    state.spyCount = Math.max(0, state.spyCount - 1);
    renderSpyControls();
  });

  el.spyPlus.addEventListener("click", function () {
    state.spyCount = Math.min(state.players.length, state.spyCount + 1);
    renderSpyControls();
  });

  /* ---------- раунд ---------- */

  function pickWord() {
    var words = DATA[state.category];
    if (words.length > 1 && state.lastWord) {
      var w;
      do {
        w = words[randInt(words.length)];
      } while (w === state.lastWord);
      return w;
    }
    return words[randInt(words.length)];
  }

  function pickSpies(count) {
    var chosen = shuffle(state.players).slice(0, count);
    return new Set(chosen);
  }

  function startRound() {
    state.word = pickWord();
    state.lastWord = state.word;

    var spyCount =
      state.spyMode === "random"
        ? randInt(state.players.length + 1)
        : Math.min(state.spyCount, state.players.length);
    state.spies = pickSpies(spyCount);
    state.dealIndex = 0;
    state.locked = false;

    renderCard();
    showScreen(el.deal);
  }

  function renderCard() {
    var name = state.players[state.dealIndex];

    el.card.classList.remove("flipped");
    el.cardName.textContent = name;
    el.dealProgress.textContent =
      "Карточка " + (state.dealIndex + 1) + " из " + state.players.length;
    el.dealHint.textContent = "Передайте телефон · " + name;
  }

  function renderFront() {
    var name = state.players[state.dealIndex];

    el.cardName.textContent = name;
    el.dealProgress.textContent =
      "Карточка " + (state.dealIndex + 1) + " из " + state.players.length;
    el.dealHint.textContent = "Передайте телефон · " + name;
  }

  function toggleCard() {
    if (state.locked) return;
    state.locked = true;
    setTimeout(function () {
      state.locked = false;
    }, 500);

    var opening = !el.card.classList.contains("flipped");

    if (opening) {
      var name = state.players[state.dealIndex];
      if (state.spies.has(name)) {
        el.roleKicker.textContent = "Ваша роль";
        el.roleReveal.textContent = "ШПИОН";
      } else {
        el.roleKicker.textContent = "Ваше слово";
        el.roleReveal.textContent = state.word;
      }
      el.cardBack.classList.toggle("spy", state.spies.has(name));
      el.card.classList.add("flipped");
      el.dealHint.textContent = "Запомните и передайте телефон";
    } else if (state.dealIndex + 1 < state.players.length) {
      state.dealIndex++;
      renderFront();
      el.card.classList.remove("flipped");
    } else {
      el.dealHint.textContent = "";
      el.card.classList.remove("flipped");
      setTimeout(showResults, 430);
    }
  }

  el.card.addEventListener("click", toggleCard);
  el.card.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleCard();
    }
  });

  /* ---------- итоги ---------- */

  function showResults() {
    var order = shuffle(state.players);
    el.turnOrder.innerHTML = "";
    order.forEach(function (name, i) {
      var li = document.createElement("li");
      li.className = "turn-item";
      li.style.animationDelay = i * 0.05 + "s";
      var num = document.createElement("span");
      num.className = "turn-num";
      num.textContent = i + 1;
      var nameEl = document.createElement("span");
      nameEl.className = "turn-name";
      nameEl.textContent = name;
      li.appendChild(num);
      li.appendChild(nameEl);
      el.turnOrder.appendChild(li);
    });

    el.revealPanel.hidden = true;
    el.footerActions.hidden = true;
    el.btnFinish.hidden = false;

    showScreen(el.results);
  }

  function finishRound() {
    el.revealWord.textContent = state.word;

    el.revealSpies.innerHTML = "";
    if (state.spies.size === 0) {
      el.revealSpies.textContent = "Шпионов не было — все получили слово";
    } else if (state.spies.size === state.players.length) {
      el.revealSpies.textContent = "Все игроки были шпионами";
    } else {
      state.players.forEach(function (name) {
        if (!state.spies.has(name)) return;
        var span = document.createElement("span");
        span.className = "spy-name";
        span.textContent = name;
        el.revealSpies.appendChild(span);
      });
    }

    el.revealPanel.hidden = false;
    el.btnFinish.hidden = true;
    el.footerActions.hidden = false;
  }

  /* ---------- кнопки ---------- */

  el.btnStart.addEventListener("click", startRound);

  el.btnFinish.addEventListener("click", finishRound);

  el.btnReplay.addEventListener("click", startRound);

  el.btnNewGame.addEventListener("click", function () {
    state.lastWord = null;
    state.word = "";
    state.spies = new Set();
    state.dealIndex = 0;
    renderPlayers();
    showScreen(el.setup);
  });

  /* ---------- инициализация ---------- */

  if (categoryKeys.length === 0) {
    el.categories.innerHTML =
      '<li class="chip" style="cursor:default">Данные не загружены</li>';
  }
  renderPlayers();
  renderCategories();
  renderSpyControls();
})();
