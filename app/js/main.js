/* main.js — навигация, сессия, события. Точка входа приложения. */

import {
  SECTIONS, buildItems, buildSession, applyAnswer,
  answerXp, sessionBonus, levelFromXp, updateStreak, todayKey,
  checkAchievements, mastery, isProblem, MAX_REQUEUE,
} from './engine.js';
import { loadState, saveState, resetState, itemState, dayEntry, defaultState } from './storage.js';
import { soundCorrect, soundWrong, soundFinish } from './audio.js';
import {
  homeHtml, levelsHtml, modeHtml, sessionHtml, summaryHtml, statsHtml, settingsHtml, rulesHtml, fmtSec,
} from './ui.js';

const app = {
  data: loadState(),
  screen: 'home',
  params: {},
  session: null,
  confirmReset: false,
};

const el = document.getElementById('app');

// ---------- Отрисовка ----------

function render() {
  const html = {
    home: homeHtml,
    levels: levelsHtml,
    mode: modeHtml,
    session: sessionHtml,
    summary: summaryHtml,
    stats: statsHtml,
    settings: settingsHtml,
    rules: rulesHtml,
  }[app.screen](app);
  el.innerHTML = html;
  if (app.screen === 'session') startTimer();
}

function go(screen, params = {}) {
  app.screen = screen;
  app.params = params;
  app.confirmReset = false;
  render();
  window.scrollTo(0, 0);
}

// ---------- Таймер вопроса ----------

function startTimer() {
  const s = app.session;
  if (!s) return;
  stopTimer();
  const label = document.getElementById('qtimer');
  s.timerHandle = setInterval(() => {
    if (!s.questionStart || s.locked) return;
    const t = (Date.now() - s.questionStart) / 1000;
    if (label) label.textContent = fmtSec(t);
  }, 100);
}

function stopTimer() {
  const s = app.session;
  if (s && s.timerHandle) { clearInterval(s.timerHandle); s.timerHandle = null; }
}

// ---------- Сессия ----------

function sectionLabel(section) {
  return (SECTIONS[section] && SECTIONS[section].name) || section;
}

function startSession(section, mode, lengthOpt) {
  const items = buildItems(section);
  const length = lengthOpt === 'full' ? items.length : Math.min(20, items.length);
  const queue = buildSession(items, app.data.items, mode, length, app.data.settings.threshold);
  if (queue.length === 0) { alert('Пока нет примеров для этого режима — потренируйся в «Скорости».'); return; }
  app.session = {
    mode, section, lengthOpt,
    sectionLabel: sectionLabel(section),
    planned: queue.length, requeued: 0,
    queue, idx: 0,
    input: '', current: null,
    startedAt: null, timerHandle: null,
    answered: 0, correct: 0, timeSum: 0, xpEarned: 0,
    fastStreak: 0, fastStreakBest: 0,
    flash: '', feedback: null, locked: false,
    newAchievements: [],
    speedFull: mode === 'speed' && section === 'mul' && lengthOpt === 'full',
  };
  nextQuestion(true);
  app.screen = 'session';
  render();
}

function nextQuestion(first = false) {
  const s = app.session;
  if (!s) return;
  if (s.idx >= s.queue.length) { finishSession(); return; }
  const entry = s.queue[s.idx];
  const item = buildItems(s.section).find(it => it.id === entry.id);
  s.current = item;
  s.input = '';
  s.flash = '';
  s.feedback = null;
  s.locked = false;
  s.questionStart = Date.now();
  if (!first) render();
}

function onKey(k) {
  const s = app.session;
  if (!s || s.locked) return;
  if (k === 'back') { s.input = s.input.slice(0, -1); render(); return; }
  if (k === 'enter') { if (s.input !== '') submitAnswer(); return; }
  if (/^\d$/.test(k)) {
    if (s.input.length >= 6) return;
    // не даём начинать ответ с нуля-числа: "0" сам по себе бессмысленный
    if (s.input === '0') s.input = '';
    s.input += k;
    render();
  }
}

function submitAnswer() {
  const s = app.session;
  const th = app.data.settings.threshold;
  const t = (Date.now() - s.questionStart) / 1000;
  const ok = parseInt(s.input, 10) === s.current.answer;
  const today = todayKey();

  // состояние примера
  const st = itemState(app.data, s.current.id);
  applyAnswer(st, ok, t);

  // дневная и общая статистика, XP — сразу, чтобы ничего не терялось
  const day = dayEntry(app.data, today);
  day.a += 1;
  const xp = answerXp(ok, t, th);
  if (ok) day.c += 1;
  day.xp += xp;
  app.data.totals.a += 1;
  if (ok) app.data.totals.c += 1;
  app.data.xp += xp;
  s.xpEarned += xp;
  s.answered += 1;
  s.timeSum += t;

  s.locked = true;
  stopTimer();

  if (ok) {
    s.correct += 1;
    s.fastStreak = t <= th ? s.fastStreak + 1 : 0;
    s.fastStreakBest = Math.max(s.fastStreakBest, s.fastStreak);
    s.flash = 'ok';
    s.feedback = s.input;
    if (app.data.settings.sound) soundCorrect();
    saveState(app.data);
    render();
    setTimeout(() => advance(), 600);
  } else {
    s.fastStreak = 0;
    s.flash = 'bad';
    s.feedback = String(s.current.answer);
    if (app.data.settings.sound) soundWrong();
    const entry = s.queue[s.idx];
    if (entry.tries < MAX_REQUEUE) {
      s.queue.push({ id: entry.id, tries: entry.tries + 1 });
      s.requeued += 1;
    }
    saveState(app.data);
    render();
    setTimeout(() => advance(), 1500);
  }
}

function advance() {
  const s = app.session;
  if (!s) return;
  s.idx += 1;
  nextQuestion();
}

function finishSession() {
  const s = app.session;
  stopTimer();
  const today = todayKey();

  // бонус и стрик — только за доведённую до конца сессию
  const bonus = sessionBonus(s.answered, s.correct);
  app.data.xp += bonus;
  s.xpEarned += bonus;
  app.data.streak = updateStreak(app.data.streak, today);
  const day = dayEntry(app.data, today);
  day.s += 1;
  day.xp += bonus;
  app.data.totals.sessions += 1;

  s.newAchievements = checkAchievements(app.data, {
    perfect10: s.answered >= 10 && s.correct === s.answered,
    fastStreak: s.fastStreakBest,
    speedFull: s.speedFull && s.answered === s.planned && s.correct / s.answered >= 0.9,
  });
  saveState(app.data);
  if (app.data.settings.sound) soundFinish();
  app.screen = 'summary';
  render();
}

function exitSession() {
  if (!app.session) return;
  const s = app.session;
  const mid = s.answered > 0 && s.idx < s.queue.length;
  const msg = mid
    ? 'Выйти из сессии? Ответы уже сохранены, но бонусы и стрик за сессию не начислятся.'
    : 'Выйти из сессии?';
  if (!confirm(msg)) return;
  stopTimer();
  const keep = { mode: s.mode, section: s.section, lengthOpt: s.lengthOpt };
  app.session = null;
  go('mode', { section: keep.section, length: keep.lengthOpt });
}

// ---------- Делегирование событий ----------

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;

  switch (act) {
    case 'go-home': go('home'); break;
    case 'go-settings': go('settings'); break;
    case 'go-rules': go('rules'); break;
    case 'go-stats': go('stats', { tab: 'progress' }); break;
    case 'go-section':
      if (t.dataset.section === 'mul') go('mode', { section: 'mul', length: '20' });
      else go('levels');
      break;
    case 'go-level':
      go('mode', { section: t.dataset.section, length: '20' });
      break;
    case 'back-from-mode':
      go(app.params.section === 'mul' ? 'home' : 'levels');
      break;
    case 'set-length':
      app.params.length = t.dataset.length;
      render();
      break;
    case 'start-session':
      startSession(app.params.section, t.dataset.mode, t.dataset.length);
      break;
    case 'noop': break;
    case 'key': onKey(t.dataset.key); break;
    case 'exit-session': exitSession(); break;
    case 'restart-session': {
      const s = app.session;
      if (s) startSession(s.section, s.mode, s.lengthOpt);
      break;
    }
    case 'stats-tab': app.params.tab = t.dataset.tab; render(); break;
    case 'map-tab': app.params.mapTab = t.dataset.tab; render(); break;
    case 'mastery-tap': showMasteryDetail(t.dataset.id); break;
    case 'sound-toggle':
      app.data.settings.sound = !app.data.settings.sound;
      saveState(app.data);
      render();
      break;
    case 'reset-progress': app.confirmReset = true; render(); break;
    case 'reset-cancel': app.confirmReset = false; render(); break;
    case 'reset-yes':
      resetState();
      app.data = defaultState();
      app.confirmReset = false;
      go('home');
      break;
  }
});

// слайдер порога
document.addEventListener('input', (e) => {
  if (e.target.matches('#th-slider')) {
    app.data.settings.threshold = Number(e.target.value);
    const label = document.getElementById('th-val');
    if (label) label.textContent = e.target.value;
    saveState(app.data);
  }
});

// ---------- Карта освоенности: подробности клетки ----------

function showMasteryDetail(id) {
  const out = document.getElementById('mastery-detail');
  if (!out) return;
  const th = app.data.settings.threshold;
  const st = app.data.items[id];
  const [sec, a, b] = id.split(':');
  const item = buildItems(sec).find(it => it.id === id);
  if (!item) return;
  const m = mastery(st, th);
  let text;
  if (!st || st.h.length === 0) {
    text = `${item.text} = ${item.answer} · пока не встречался`;
  } else {
    const avg = st.h.reduce((s, r) => s + r.t, 0) / st.h.length;
    text = `${item.text} = ${item.answer} · верных ${st.c} из ${st.a} · среднее ${fmtSec(avg)} · освоено ${m < 0 ? 0 : Math.round(m * 100)}%`;
  }
  out.textContent = text;
}

// ---------- Запуск ----------

render();

// снимаем свайп-назад Safari внутри PWA (история не используется)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* офлайн недоступен — не критично */ });
}
