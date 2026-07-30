// ===== Константы и данные =====

const CAT_COUNT = 35;
const BREED_SIZE = 5;

/** Путь к файлу по номеру: cat001.jpg … cat035.jpg */
function getCatPath(num) {
  return `images/cat${String(num).padStart(3, "0")}.jpg`;
}

/** Порода по номеру файла: каждые 5 файлов — одна порода (1–7) */
function getBreed(num) {
  return Math.ceil(num / BREED_SIZE);
}

/** Все котики: путь и порода считаются из номера, без ручного списка */
const CAT_IMAGES = Array.from({ length: CAT_COUNT }, (_, i) => {
  const num = i + 1;
  return {
    num,
    path: getCatPath(num),
    breed: getBreed(num),
  };
});

/** Уровни сложности: у каждого по 4 подуровня */
const DIFFICULTIES = [
  {
    id: 1,
    name: "Любитель котиков",
    hint: "Котики разных пород",
    cards: [4, 5, 6, 7],
    showTimes: [3000, 5000, 7000, 7000],
    uniqueBreeds: true,
  },
  {
    id: 2,
    name: "Знаток котиков",
    hint: "Случайные котики",
    cards: [4, 5, 6, 7],
    showTimes: [3000, 5000, 7000, 7000],
  },
  {
    id: 3,
    name: "Повелитель котиков",
    hint: "Две породы, на 3–4 подуровне — три",
    cards: [4, 5, 6, 7],
    showTimes: [3000, 5000, 7000, 7000],
    breedsPerSubLevel: [2, 2, 3, 3],
  },
];

const SUBLEVELS_COUNT = 4;

function getCurrentDifficulty() {
  return DIFFICULTIES[state.difficulty - 1];
}

function getCardCount() {
  return getCurrentDifficulty().cards[state.subLevel - 1];
}

/** Время показа для текущего подуровня */
function getShowTime() {
  const diff = getCurrentDifficulty();
  if (diff.showTimes) {
    return diff.showTimes[state.subLevel - 1];
  }
  return diff.baseShowTime + (state.subLevel - 1) * 1000;
}

function getProgressLabel() {
  return `Уровень ${state.difficulty} → Подуровень ${state.subLevel} из ${SUBLEVELS_COUNT}`;
}

/** Специальные изображения для экранов результата */
const HAPPY_CAT = "images/cat_ok!.jpg";
const SAD_CAT = "images/cat_fail!.jpg";
const BLANKET_CAT = getCatPath(3);

/** Случайные фразы при правильном ответе */
const SUCCESS_PHRASES = [
  "Мяу! Молодец!",
  "Отличная память!",
  "Я тобой горжусь!",
  "Почеши меня за ушком!",
  "Ты настоящий друг котиков!",
  "Так держать!",
];

// ===== Состояние игры =====

const state = {
  screen: "start",        // start | difficulty | game | success | fail | final
  phase: "memorize",      // memorize | select
  difficulty: 1,          // 1–3 выбранный уровень сложности
  subLevel: 1,            // 1–4 подуровень
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
  checkTimeout: null,
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
  const diff = getCurrentDifficulty();
  if (diff.uniqueBreeds) {
    return generateUniqueBreedSequence(count);
  }
  if (diff.breedsPerSubLevel) {
    return generateLimitedBreedSequence(count, diff.breedsPerSubLevel[state.subLevel - 1]);
  }
  return shuffle(CAT_IMAGES).slice(0, count).map((cat) => cat.path);
}

/** Котики, сгруппированные по породе */
function getCatsByBreed() {
  const byBreed = {};
  CAT_IMAGES.forEach((cat) => {
    if (!byBreed[cat.breed]) byBreed[cat.breed] = [];
    byBreed[cat.breed].push(cat);
  });
  return byBreed;
}

/** Случайный котик из каждой выбранной породы — породы в подуровне не повторяются */
function generateUniqueBreedSequence(count) {
  const byBreed = getCatsByBreed();
  const breeds = shuffle(Object.keys(byBreed)).slice(0, count);
  return breeds.map((breed) => pickRandom(byBreed[breed]).path);
}

/** Несколько случайных пород; из каждой — разные фотографии */
function generateLimitedBreedSequence(count, breedCount) {
  const byBreed = getCatsByBreed();
  const breeds = shuffle(Object.keys(byBreed)).slice(0, breedCount);

  // Базово по одной карточке на породу, остальное распределяем случайно
  const quotas = breeds.map(() => 1);
  let remaining = count - breedCount;

  while (remaining > 0) {
    const i = Math.floor(Math.random() * breeds.length);
    if (quotas[i] < byBreed[breeds[i]].length) {
      quotas[i]++;
      remaining--;
    }
  }

  const selected = [];
  breeds.forEach((breed, i) => {
    selected.push(...shuffle(byBreed[breed]).slice(0, quotas[i]));
  });

  return shuffle(selected).map((cat) => cat.path);
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
  if (state.checkTimeout) {
    clearTimeout(state.checkTimeout);
    state.checkTimeout = null;
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
  document.getElementById("btn-start").addEventListener("click", () => {
    state.screen = "difficulty";
    render();
  });
}

/** Экран выбора уровня сложности */
function renderDifficulty() {
  app.innerHTML = `
    <div class="screen difficulty-screen">
      <h1 class="title title--small">Выбери уровень</h1>
      <div class="difficulty-list">
        ${DIFFICULTIES.map((diff) => `
          <button class="difficulty-card" data-id="${diff.id}">
            <span class="difficulty-card__num">Уровень ${diff.id}</span>
            <span class="difficulty-card__name">${diff.name}</span>
            <span class="difficulty-card__hint">${diff.hint}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  app.querySelectorAll(".difficulty-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      startGame(parseInt(btn.dataset.id, 10));
    });
  });
}

function renderGame() {
  const showMemorize = state.phase === "memorize";
  const showSelect = state.phase === "select";
  const diff = getCurrentDifficulty();

  const showTime = getShowTime();
  const elapsed = showMemorize ? Date.now() - state.memorizeStart : 0;
  const remaining = Math.max(0, Math.ceil((showTime - elapsed) / 1000));
  const progress = Math.min(100, (elapsed / showTime) * 100);

  let cardsHtml = "";
  const cardCount = getCardCount();

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
        <span class="level-badge">${getProgressLabel()}</span>
        <p class="difficulty-name">${diff.name}</p>
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

      ${showSelect ? `
        <div class="game-actions">
          <button class="btn btn--secondary" id="btn-undo" ${state.selection.length === 0 ? "disabled" : ""}>
            Отменить ход
          </button>
        </div>
      ` : ""}
    </div>
  `;

  if (showSelect) {
    bindCardClicks();
    document.getElementById("btn-undo").addEventListener("click", undoLastMove);
  }

  if (showMemorize && !state.hidingMemorize) {
    startProgressAnimation();
  }
}

function renderSuccess() {
  const phrase = pickRandom(SUCCESS_PHRASES);
  const isLastSubLevel = state.subLevel >= SUBLEVELS_COUNT;

  app.innerHTML = `
    <div class="screen result-screen">
      <div class="result-modal">
        <h2 class="result-modal__title">Отлично!</h2>
        <p class="result-modal__subtitle">Котики довольны!</p>
        <p class="result-progress">${getProgressLabel()}</p>
      </div>

      <div class="cat-hero">
        <div class="speech-bubble">${phrase}</div>
        <img src="${HAPPY_CAT}" alt="Счастливый котик">
      </div>

      <button class="btn btn--large" id="btn-next">
        ${isLastSubLevel ? "Завершить" : "Следующий подуровень"}
      </button>
    </div>
  `;

  document.getElementById("btn-next").addEventListener("click", () => {
    if (isLastSubLevel) {
      state.screen = "final";
      render();
    } else {
      state.subLevel++;
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
        <p class="result-progress">${getProgressLabel()}</p>
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
  const diff = getCurrentDifficulty();

  app.innerHTML = `
    <div class="screen final-screen">
      <div class="final-cat">
        <img src="${BLANKET_CAT}" alt="Котик под пледом">
      </div>

      <h2 class="final-title">Поздравляем!</h2>
      <p class="final-subtitle">Ты прошёл уровень «${diff.name}»!</p>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-card__value">${state.levelsPassed}</div>
          <div class="stat-card__label">Пройдено подуровней</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${state.attempts}</div>
          <div class="stat-card__label">Количество попыток</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${state.bestLevel}</div>
          <div class="stat-card__label">Лучший подуровень</div>
        </div>
      </div>

      <div class="rank-badge">${diff.name}</div>
      <br>
      <button class="btn btn--large" id="btn-restart">Играть ещё</button>
    </div>
  `;

  document.getElementById("btn-restart").addEventListener("click", () => {
    state.screen = "difficulty";
    render();
  });
}

function render() {
  switch (state.screen) {
    case "start":
      renderStart();
      break;
    case "difficulty":
      renderDifficulty();
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

function startGame(difficultyId) {
  clearTimers();
  state.difficulty = difficultyId;
  state.subLevel = 1;
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

  state.sequence = generateSequence(getCardCount());
  state.memorizeStart = Date.now();

  render();
  startMemorizeTimer();
}

/** Запуск таймера фазы запоминания */
function startMemorizeTimer() {
  const showTime = getShowTime();

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
  const showTime = getShowTime();

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
  app.querySelectorAll(".card").forEach((card) => {
    const index = parseInt(card.dataset.key, 10);

    const handler = () => {
      const selIndex = state.selection.indexOf(index);

      // Повторный клик по последней выбранной карточке — отмена хода
      if (selIndex !== -1) {
        if (selIndex === state.selection.length - 1) {
          undoLastMove();
        }
        return;
      }

      if (state.selection.length >= getCardCount()) return;

      state.selection.push(index);
      render();

      if (state.selection.length === getCardCount()) {
        state.checkTimeout = setTimeout(checkAnswer, 400);
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

/** Отменить последний выбор карточки */
function undoLastMove() {
  if (state.phase !== "select" || state.selection.length === 0) return;

  if (state.checkTimeout) {
    clearTimeout(state.checkTimeout);
    state.checkTimeout = null;
  }

  state.selection.pop();
  render();
}

/** Проверка ответа игрока */
function checkAnswer() {
  const playerOrder = state.selection.map((i) => state.shuffled[i]);
  const isCorrect = playerOrder.every((src, i) => src === state.sequence[i]);

  clearTimers();

  if (isCorrect) {
    state.levelsPassed = state.subLevel;
    state.bestLevel = Math.max(state.bestLevel, state.subLevel);
    state.screen = "success";
  } else {
    state.screen = "fail";
  }

  render();
}

// ===== Запуск =====
render();
