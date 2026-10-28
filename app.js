/*
 * Deutsch Trainer — JavaScript port of the customtkinter application.
 * Behaviour mirrors the original Python version (flashcards, quiz,
 * sentence builder, grammar reference and dictionary).
 */
"use strict";

const QUIZ_MAX_QUESTIONS = 10;
const QUIZ_FEEDBACK_DELAY_MS = 1500;
const QUIZ_MIN_WORDS = 4;

const state = {
  wordsData: [],
  sentencesData: [],

  // flashcards
  flashcardPool: [],
  flashcardIndex: 0,

  // quiz
  quizWords: [],
  quizIndex: 0,
  quizCorrectAnswers: 0,
  correctAnswerText: "",
  quizTimer: null,

  // sentence game
  sentenceWords: [],     // words still in the pool
  sentenceChips: [],     // [{ el, word }] words placed in the answer row
  currentSentence: null,
};

const $ = (id) => document.getElementById(id);
const SCREENS = ["menu", "flashcards", "quiz", "sentence", "grammar", "dictionary"];

/* ------------------------------------------------------------------ */
/* Утилиты                                                             */
/* ------------------------------------------------------------------ */

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function sample(array, k) {
  return shuffle([...array]).slice(0, k);
}

function choice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function showScreen(name) {
  for (const screen of SCREENS) {
    $(`screen-${screen}`).hidden = screen !== name;
  }
}

function showMainMenu() {
  clearTimeout(state.quizTimer);   // не продолжаем викторину после выхода в меню
  state.quizTimer = null;
  showScreen("menu");
}

function disableApp() {
  document.querySelectorAll("button").forEach((btn) => (btn.disabled = true));
}

/* ------------------------------------------------------------------ */
/* Загрузка данных                                                     */
/* ------------------------------------------------------------------ */

function normalizeWord(item) {
  return {
    word: item.deutsch,
    translation: item.russian,
    article: item.article ?? "",
  };
}

async function loadData() {
  try {
    const response = await fetch("words.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();

    if (data && typeof data === "object" && !Array.isArray(data)) {
      if ("words" in data) {
        for (const item of data.words) {
          state.wordsData.push(normalizeWord(item));
        }
      }
      if ("sentences" in data) {
        state.sentencesData = data.sentences;
      }
    }
    return true;
  } catch (err) {
    if (err instanceof SyntaxError) {
      alert("Файл words.json поврежден. Проверьте его синтаксис.");
      disableApp();
      return false;
    }
    // Файл не найден / недоступен — используем запасные данные (как в оригинале)
    console.warn("words.json не загружен, используются запасные данные:", err);
    state.wordsData = [{ word: "der Hund", translation: "собака", article: "der" }];
    state.sentencesData = [];
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* Карточки слов                                                       */
/* ------------------------------------------------------------------ */

function startFlashcards() {
  if (!state.wordsData.length) {
    alert("Словарь пуст!");
    return;
  }
  showScreen("flashcards");
  state.flashcardPool = shuffle([...state.wordsData]);
  state.flashcardIndex = 0;
  showCurrentFlashcard();
}

function showCurrentFlashcard() {
  if (!state.flashcardPool.length) {
    $("word-label").textContent = "Словарь пуст";
    return;
  }
  const info = state.flashcardPool[state.flashcardIndex];
  $("word-label").textContent = info.word;
  $("translation-label").textContent = "";
}

function showTranslation() {
  if (!state.flashcardPool.length) return;
  const info = state.flashcardPool[state.flashcardIndex];
  $("translation-label").textContent = info.translation;
}

function nextFlashcard() {
  if (!state.flashcardPool.length) return;
  state.flashcardIndex = (state.flashcardIndex + 1) % state.flashcardPool.length;
  showCurrentFlashcard();
}

/* ------------------------------------------------------------------ */
/* Викторина                                                           */
/* ------------------------------------------------------------------ */

const quizButtons = Array.from(document.querySelectorAll(".quiz-option"));

function startQuiz() {
  if (state.wordsData.length < QUIZ_MIN_WORDS) {
    alert("Для викторины нужно минимум 4 слова в базе!");
    return;
  }
  showScreen("quiz");
  state.quizWords = sample(state.wordsData, state.wordsData.length);
  state.quizIndex = 0;
  state.quizCorrectAnswers = 0;
  nextQuizQuestion();
}

function nextQuizQuestion() {
  if (state.quizIndex >= state.quizWords.length || state.quizIndex >= QUIZ_MAX_QUESTIONS) {
    const total = Math.min(QUIZ_MAX_QUESTIONS, state.quizWords.length);
    alert(`Викторина окончена\n\nВаш результат: ${state.quizCorrectAnswers} из ${total}`);
    showMainMenu();
    return;
  }

  for (const btn of quizButtons) {
    btn.classList.remove("correct", "wrong");
    btn.disabled = false;
  }

  const correctWord = state.quizWords[state.quizIndex];
  $("quiz-word-label").textContent = `Как переводится:\n\n${correctWord.word}?`;
  state.correctAnswerText = correctWord.translation;

  // Уникальные неправильные варианты (в оригинале могли повторяться)
  const wrongOptions = [...new Set(state.wordsData.map((w) => w.translation))]
    .filter((t) => t !== state.correctAnswerText);
  const options = shuffle([
    ...sample(wrongOptions, Math.min(3, wrongOptions.length)),
    state.correctAnswerText,
  ]);

  quizButtons.forEach((btn, i) => {
    if (i < options.length) {
      btn.textContent = options[i];
      btn.hidden = false;
    } else {
      btn.textContent = "";
      btn.hidden = true;
    }
  });
}

function checkQuizAnswer(index) {
  const btn = quizButtons[index];

  if (btn.textContent === state.correctAnswerText) {
    btn.classList.add("correct");
    state.quizCorrectAnswers += 1;
  } else {
    btn.classList.add("wrong");
    quizButtons.forEach((other) => {
      if (!other.hidden && other.textContent === state.correctAnswerText) {
        other.classList.add("correct");
      }
    });
  }

  quizButtons.forEach((b) => (b.disabled = true));
  state.quizTimer = setTimeout(advanceQuiz, QUIZ_FEEDBACK_DELAY_MS);
}

function advanceQuiz() {
  state.quizTimer = null;
  state.quizIndex += 1;
  nextQuizQuestion();
}

/* ------------------------------------------------------------------ */
/* Составь предложение                                                 */
/* ------------------------------------------------------------------ */

function createPoolChip(word) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chip chip-pool";
  btn.textContent = word;
  btn.addEventListener("click", () => addWordToSentence(word, btn));
  return btn;
}

function createAnswerChip(word) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip chip-answer";
  chip.textContent = word;
  chip.addEventListener("click", () => returnWordToPool(word, chip));
  return chip;
}

function startSentenceGame() {
  showScreen("sentence");
  clearSentenceWidgets();

  if (!state.sentencesData.length) {
    $("sentence-target-label").textContent = "Нет предложений для игры.";
    return;
  }

  state.currentSentence = choice(state.sentencesData);
  $("sentence-target-label").textContent =
    `Рус: ${state.currentSentence.russian}\nСоберите нем. предложение:`;

  state.sentenceWords = shuffle([...state.currentSentence.words]);
  const container = $("sentence-container");
  for (const word of state.sentenceWords) {
    container.appendChild(createPoolChip(word));
  }
}

function addWordToSentence(word, poolBtn) {
  poolBtn.remove();

  const chip = createAnswerChip(word);
  $("sentence-container").appendChild(chip);
  state.sentenceChips.push({ el: chip, word });

  const idx = state.sentenceWords.indexOf(word);
  if (idx !== -1) state.sentenceWords.splice(idx, 1);
}

function returnWordToPool(word, chip) {
  chip.remove();
  state.sentenceChips = state.sentenceChips.filter((entry) => entry.el !== chip);
  state.sentenceWords.push(word);
  $("sentence-container").appendChild(createPoolChip(word));
}

function undoLastWord() {
  if (!state.sentenceChips.length) return;

  const last = state.sentenceChips.pop();
  last.el.remove();
  state.sentenceWords.push(last.word);
  $("sentence-container").appendChild(createPoolChip(last.word));
}

function clearSentenceWidgets() {
  $("sentence-container").innerHTML = "";
  state.sentenceChips = [];
}

function checkSentence() {
  if (!state.currentSentence || !state.currentSentence.words) {
    alert("Сначала начните игру.");
    return;
  }

  const userAnswer = state.sentenceChips.map((e) => e.word).join(" ");
  const correctAnswer = state.currentSentence.words.join(" ");

  if (userAnswer === correctAnswer) {
    alert("Успех\n\nПредложение составлено верно!");
  } else {
    alert(`Ошибка\n\nПравильно:\n${correctAnswer}`);
  }

  clearSentenceWidgets();
}

/* ------------------------------------------------------------------ */
/* Справочник и словарь                                                */
/* ------------------------------------------------------------------ */

function showGrammar() {
  showScreen("grammar");
}

function showDictionary() {
  showScreen("dictionary");
  const box = $("dict-text");

  if (!state.wordsData.length) {
    box.textContent = "Словарь пуст.";
    return;
  }

  const sorted = [...state.wordsData].sort((a, b) => {
    const x = String(a.word ?? "");
    const y = String(b.word ?? "");
    return x < y ? -1 : x > y ? 1 : 0;
  });

  box.textContent = sorted
    .map((item) => {
      const article = item.article ? `${item.article} ` : "";
      return `${article}${item.word} — ${item.translation}`;
    })
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Инициализация                                                       */
/* ------------------------------------------------------------------ */

function bindEvents() {
  $("btn-flashcards").addEventListener("click", startFlashcards);
  $("btn-quiz").addEventListener("click", startQuiz);
  $("btn-sentence").addEventListener("click", startSentenceGame);
  $("btn-grammar").addEventListener("click", showGrammar);
  $("btn-dictionary").addEventListener("click", showDictionary);

  $("btn-show-translation").addEventListener("click", showTranslation);
  $("btn-next-card").addEventListener("click", nextFlashcard);
  $("btn-back-flashcards").addEventListener("click", showMainMenu);

  quizButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => checkQuizAnswer(i));
  });
  $("btn-back-quiz").addEventListener("click", showMainMenu);

  $("btn-check-sentence").addEventListener("click", checkSentence);
  $("btn-undo").addEventListener("click", undoLastWord);
  $("btn-next-sentence").addEventListener("click", startSentenceGame);
  $("btn-back-sentence").addEventListener("click", showMainMenu);

  $("btn-back-grammar").addEventListener("click", showMainMenu);
  $("btn-back-dictionary").addEventListener("click", showMainMenu);
}

document.addEventListener("DOMContentLoaded", async () => {
  const loaded = await loadData();
  bindEvents();
  if (!loaded) disableApp();
  showScreen("menu");
});
