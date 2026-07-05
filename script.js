// ===== Константы и данные =====

/** Все изображения котиков из папки images/ */
const CAT_IMAGES = [
  "images/cat1.jpg", "images/cat2.jpg", "images/cat3.jpg", "images/cat4.jpg",
  "images/cat5.jpg", "images/cat6.jpg", "images/cat7.jpg", "images/cat8.jpg",
  "images/cat9.jpg", "images/cat10.jpg", "images/cat11.jpg", "images/cat12.jpg",
  "images/cat13.jpg", "images/cat14.jpg", "images/cat15.jpg", "images/cat16.jpg",
  "images/cat17.jpg", "images/cat18.jpg", "images/cat19.jpg","images/cat20.jpg", 
  "images/cat21.jpg", "images/cat22.jpg", "images/cat23.jpg", "images/cat24.jpg", 
  "images/cat25.jpg",  "images/cat26.jpg", "images/cat27.jpg", "images/cat28.jpg",
   "images/cat29.jpg",  "images/cat30.jpg","images/cat31.jpg",  "images/cat32.jpg",
];

/** Количество карточек на каждом уровне */
const LEVELS = [4, 5, 6, 7, 7, 7, 7];

/** Базовое время показа на 1-м уровне (мс) */
const BASE_SHOW_TIME = 3000;

/** Время показа: уровни 1–4 растут на +1 сек, уровни 5–7 уменьшаются на −1 сек */
function getShowTime(level) {
  if (level <= 4) {
    return BASE_SHOW_TIME + (level - 1) * 1000;
  }
  const level4Time = BASE_SHOW_TIME + 3 * 1000;
  return level4Time - (level - 4) * 1000;
}

/** Специальные изображения для экранов результата */
const HAPPY_CAT = "images/cat_ok!.jpg";
const SAD_CAT = "images/cat_fail!.jpg";
const BLANKET_CAT = "images/cat3.jpg";

/** Случайные фразы при правильном ответе */
const SUCCESS_PHRASES = [
  "Мяу! Молодец!",
  "Отличная память!",
  "Я тобой горжусь!",
  "Почеши меня за ушком!",
  "Ты настоящий друг котиков!",
  "Так держать!",
];

/** Итоговые звания */
const FINAL_TITLES = [
  "Повелитель котиков",
  "Лучший кошачий друг",
  "Профессор кошачьей памяти",
  "Мастер пушистых воспоминаний",
  "Великий запоминатель котиков",
];

// ===== Состояние игры =====

const state = {
  screen: "start",        // start | game | success | fail | final
  phase: "memorize",      // memorize | select (только для screen === "game")
  level: 1,
  sequence: [],
  shuffled: [],
  selection: [],
  attempts: 0,
  levelsPassed: 0,
  bestLevel: 0,
  memorizeStart: 0,
  hidingMemorize: false,
  memorizeTimeout: null,
  progressRAF: null,
};

const app = document.getElementById("app");

// ===== Утилиты =====

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateSequence(count) {
  return shuffle(CAT_IMAGES).slice(0, count);
}

function clearTimers() {
  if (state.memorizeTimeout) {
    clearTimeout(state.memorizeTimeout);
    state.memorizeTimeout = null;
  }
  if (state.progressRAF) {
    cancelAnimationFrame(state.progressRAF);
    state.progressRAF = null;
  }
}

function gridClass(count) {
  return count === 7 ? "cards-grid cards-grid--7" : "cards-grid";
}

function renderCard(src, options = {}) {
  const { selectable, selected, number, key, feedback } = options;
  const classes = ["card"];
  if (selectable) classes.push("card--selectable");
  if (selected) classes.push("card--selected");
  if (feedback === "correct") classes.push("card--feedback-correct");
  if (feedback === "wrong") classes.push("card--feedback-wrong");

  const numberClass = feedback ? ` card__number--${feedback}` : "";
  const numberHtml = number
    ? `<span class="card__number${numberClass}">${number}</span>`
    : "";

  return `
    <div class="${classes.join(" ")}" data-key="${key ?? ""}" ${selectable ? 'role="button" tabindex="0"' : ""}>
      <img src="${src}" alt="Котик" draggable="false">
      ${numberHtml}
    </div>
  `;
}

// ===== Экраны =====

function renderStart() {
  app.innerHTML = `
    <div class="screen start-screen">
      <h1 class="title">Запомни котиков</h1>
      <button class="btn btn--large" id="btn-start">Начать игру</button>
    </div>
  `;
  document.getElementById("btn-start").addEventListener("click", startGame);
}

function renderGame() {
  const showMemorize = state.phase === "memorize";
  const showSelect = state.phase === "select";

  const showTime = getShowTime(state.level);
  const elapsed = showMemorize ? Date.now() - state.memorizeStart : 0;
  const remaining = Math.max(0, Math.ceil((showTime - elapsed) / 1000));
  const progress = Math.min(100, (elapsed / showTime) * 100);

  let cardsHtml = "";

  const cardCount = LEVELS[state.level - 1];

  if (showMemorize) {
    const hideClass = state.hidingMemorize ? " cards-grid--hide" : "";
    cardsHtml = `
      <div class="${gridClass(cardCount)} cards-grid--memorize${hideClass}">
        ${state.sequence.map((src, i) => renderCard(src, { key: i })).join("")}
      </div>
    `;
  }

  if (showSelect) {
    cardsHtml = `
      <div class="${gridClass(cardCount)}">
        ${state.shuffled.map((src, i) => {
          const selIndex = state.selection.indexOf(i);
          const isSelected = selIndex !== -1;
          return renderCard(src, {
            key: i,
            selectable: !isSelected,
            selected: isSelected,
            number: isSelected ? selIndex + 1 : null,
          });
        }).join("")}
      </div>
    `;
  }

  app.innerHTML = `
    <div class="screen game-screen">
      <div class="game-header">
        <span class="level-badge">Уровень ${state.level}</span>
        <p class="phase-hint">${showMemorize ? "Запоминай порядок котиков!" : "Нажми котиков в правильном порядке"}</p>
      </div>

      ${showMemorize ? `
        <div class="memorize-bar">
          <div class="memorize-bar__top">
            <span>Запоминай!</span>
            <span id="countdown">${remaining}</span>
          </div>
          <div class="memorize-bar__track">
            <div class="memorize-bar__fill" id="progress-fill" style="width: ${progress}%"></div>
          </div>
        </div>
      ` : ""}

      ${cardsHtml}
    </div>
  `;

  if (showSelect) {
    bindCardClicks();
  }

  if (showMemorize && !state.hidingMemorize) {
    startProgressAnimation();
  }
}

function renderSuccess() {
  const phrase = pickRandom(SUCCESS_PHRASES);
  const isLastLevel = state.level >= LEVELS.length;

  app.innerHTML = `
    <div class="screen result-screen">
      <div class="result-modal">
        <h2 class="result-modal__title">Отлично!</h2>
        <p class="result-modal__subtitle">Котики довольны!</p>
      </div>

      <div class="cat-hero">
        <div class="speech-bubble">${phrase}</div>
        <img src="${HAPPY_CAT}" alt="Счастливый котик">
      </div>

      <button class="btn btn--large" id="btn-next">Следующий уровень</button>
    </div>
  `;

  document.getElementById("btn-next").addEventListener("click", () => {
    if (isLastLevel) {
      state.screen = "final";
      render();
    } else {
      state.level++;
      startLevel();
    }
  });
}

function renderFail() {
  const playerOrder = state.selection.map((i) => state.shuffled[i]);

  const correctHtml = state.sequence
    .map((src, i) => renderCard(src, { number: i + 1, feedback: "correct" }))
    .join("");

  const playerHtml = playerOrder
    .map((src, i) => {
      const isWrong = src !== state.sequence[i];
      return renderCard(src, { number: i + 1, feedback: isWrong ? "wrong" : "correct" });
    })
    .join("");

  const compareGrid = state.sequence.length === 7
    ? "cards-grid cards-grid--compare cards-grid--7"
    : "cards-grid cards-grid--compare";

  app.innerHTML = `
    <div class="screen result-screen">
      <div class="result-modal">
        <h2 class="result-modal__title">Ой!</h2>
        <p class="result-modal__subtitle">Котик немного запутался...</p>
      </div>

      <div class="answer-compare">
        <div class="answer-block">
          <h3 class="answer-block__title">Правильный порядок</h3>
          <div class="${compareGrid}">${correctHtml}</div>
        </div>
        <div class="answer-block">
          <h3 class="answer-block__title">Твой ответ</h3>
          <div class="${compareGrid}">${playerHtml}</div>
        </div>
      </div>

      <div class="cat-hero cat-hero--small">
        <img src="${SAD_CAT}" alt="Грустный котик">
      </div>

      <button class="btn btn--large" id="btn-retry">Попробовать ещё</button>
    </div>
  `;

  document.getElementById("btn-retry").addEventListener("click", startLevel);
}

function renderFinal() {
  const title = pickRandom(FINAL_TITLES);

  app.innerHTML = `
    <div class="screen final-screen">
      <div class="final-cat">
        <img src="${BLANKET_CAT}" alt="Котик под пледом">
      </div>

      <h2 class="final-title">Поздравляем!</h2>
      <p class="final-subtitle">Ты прошёл все уровни!</p>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-card__value">${state.levelsPassed}</div>
          <div class="stat-card__label">Пройдено уровней</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${state.attempts}</div>
          <div class="stat-card__label">Количество попыток</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${state.bestLevel}</div>
          <div class="stat-card__label">Лучший уровень</div>
        </div>
      </div>

      <div class="rank-badge">${title}</div>
      <br>
      <button class="btn btn--large" id="btn-restart">Играть ещё</button>
    </div>
  `;

  document.getElementById("btn-restart").addEventListener("click", startGame);
}

function render() {
  switch (state.screen) {
    case "start":
      renderStart();
      break;
    case "game":
      renderGame();
      break;
    case "success":
      renderSuccess();
      break;
    case "fail":
      renderFail();
      break;
    case "final":
      renderFinal();
      break;
  }
}

// ===== Игровая логика =====

function startGame() {
  clearTimers();
  state.level = 1;
  state.attempts = 0;
  state.levelsPassed = 0;
  state.bestLevel = 0;
  state.screen = "game";
  startLevel();
}

function startLevel() {
  clearTimers();
  state.attempts++;
  state.screen = "game";
  state.phase = "memorize";
  state.selection = [];
  state.shuffled = [];
  state.hidingMemorize = false;

  const count = LEVELS[state.level - 1];
  state.sequence = generateSequence(count);
  state.memorizeStart = Date.now();

  render();
  startMemorizeTimer();
}

/** Запуск таймера фазы запоминания */
function startMemorizeTimer() {
  const showTime = getShowTime(state.level);

  state.memorizeTimeout = setTimeout(() => {
    state.hidingMemorize = true;
    render();

    setTimeout(() => {
      state.phase = "select";
      state.shuffled = shuffle(state.sequence);
      state.hidingMemorize = false;
      render();
    }, 500);
  }, showTime);
}

/** Анимация полоски прогресса и обратного отсчёта */
function startProgressAnimation() {
  const showTime = getShowTime(state.level);

  function tick() {
    if (state.phase !== "memorize" || state.hidingMemorize) return;

    const elapsed = Date.now() - state.memorizeStart;
    const fill = document.getElementById("progress-fill");
    const countdown = document.getElementById("countdown");

    if (fill) {
      fill.style.width = `${Math.min(100, (elapsed / showTime) * 100)}%`;
    }
    if (countdown) {
      countdown.textContent = Math.max(0, Math.ceil((showTime - elapsed) / 1000));
    }

    if (elapsed < showTime) {
      state.progressRAF = requestAnimationFrame(tick);
    }
  }

  state.progressRAF = requestAnimationFrame(tick);
}

function bindCardClicks() {
  app.querySelectorAll(".card--selectable").forEach((card) => {
    const handler = () => {
      const index = parseInt(card.dataset.key, 10);
      if (state.selection.includes(index)) return;

      state.selection.push(index);
      render();

      const count = LEVELS[state.level - 1];
      if (state.selection.length === count) {
        setTimeout(checkAnswer, 400);
      }
    };

    card.addEventListener("click", handler);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler();
      }
    });
  });
}

/** Проверка ответа игрока */
function checkAnswer() {
  const playerOrder = state.selection.map((i) => state.shuffled[i]);
  const isCorrect = playerOrder.every((src, i) => src === state.sequence[i]);

  clearTimers();

  if (isCorrect) {
    state.levelsPassed = state.level;
    state.bestLevel = Math.max(state.bestLevel, state.level);
    state.screen = "success";
  } else {
    state.screen = "fail";
  }

  render();
}

// ===== Запуск =====
render();
