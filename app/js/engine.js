/* engine.js — чистая логика приложения «Математика для Вани».
   Без DOM: работает и в браузере, и в Node (tests). */

export const THRESHOLD_DEFAULT = 4; // сек: дольше — ответ считается «медленным»
export const SQUARES_MAX_DEFAULT = 20; // квадраты по умолчанию 1–20 (настраивается)
export const MAX_REQUEUE = 2;       // макс. повторов ошибочного примера в сессии
export const MIN_GAPS_POOL = 5;     // меньше проблемных — кнопка «Пробелы» неактивна
export const EASY_MUL_WEIGHT = 0.3; // «умножение на 10» выпадает в ~3 раза реже
export const GAP_EXIT_STREAK = 3;   // верных подряд, чтобы пример покинул «Пробелы»

// ---------- Пулы примеров ----------

export const SECTIONS = {
  mul:  { name: 'Таблица умножения', icon: '×' },
  pow2: { name: 'Степень два',       icon: 'x²' },
  pow3: { name: 'Степень три',       icon: 'x³' },
  pow4: { name: 'Степень четыре',    icon: 'x⁴' },
};

const SUP = { 2: '²', 3: '³', 4: '⁴' };

/** Все примеры раздела: [{id, text, answer, section, n}] */
export function buildItems(section, squaresMax = SQUARES_MAX_DEFAULT) {
  const items = [];
  if (section === 'mul') {
    for (let a = 2; a <= 10; a++)
      for (let b = a; b <= 10; b++)
        items.push({ id: `mul:${a}:${b}`, text: `${a} × ${b}`, answer: a * b, section, n: a * 10 + b });
  } else {
    const p = Number(section.slice(3)); // 2 | 3 | 4
    const max = { 2: squaresMax, 3: 12, 4: 5 }[p];
    for (let n = 1; n <= max; n++)
      items.push({ id: `${section}:${n}`, text: `${n}${SUP[p]}`, answer: Math.pow(n, p), section, n });
  }
  return items;
}

export function poolSize(section) { return buildItems(section).length; }

/** Разделы на главном экране */
export const HOME_SECTIONS = [
  { key: 'mul',  title: 'Таблица умножения', sub: 'от 2×2 до 10×10' },
  { key: 'pow2', title: 'Степени',           sub: 'степени два, три и четыре' },
];

export const LEVELS = [
  { key: 'pow2', title: 'Степень два',   sub: 'от 1 до 20', size: 20 },
  { key: 'pow3', title: 'Степень три',   sub: 'от 1 до 12', size: 12 },
  { key: 'pow4', title: 'Степень четыре', sub: 'от 1 до 5',  size: 5 },
];

/** Лестница званий: [уровень, звание] */
export const RANKS = [[1, 'Новичок'], [3, 'Ученик'], [5, 'Знаток'], [7, 'Умник'], [9, 'Магистр'], [12, 'Профессор']];

// ---------- Состояние примера ----------

export function newItemState() { return { h: [], a: 0, c: 0 }; }

/** Освоенность 0..1 по последним 5 ответам; свежие весят больше. */
export function mastery(st, threshold = THRESHOLD_DEFAULT) {
  if (!st || st.h.length === 0) return -1; // -1: не встречался
  const last = st.h.slice(0, 5);
  let sw = 0, s = 0;
  last.forEach((r, i) => {
    const w = Math.pow(0.6, i);
    sw += w;
    s += w * (r.o ? Math.min(1, Math.max(0.2, threshold / Math.max(r.t, 0.1))) : 0);
  });
  return s / sw;
}

/** Сколько верных ответов подряд с начала истории (свежейшей стороны). */
function leadingCorrect(h) {
  let n = 0;
  for (const r of h) { if (!r.o) break; n++; }
  return n;
}

/**
 * Проблемный пример (для режима «Пробелы»). Правила:
 * 1) медленный, но верный — всё ещё пробел, пока не ускорится;
 * 2) если в сохранённой истории была ошибка и серия верных подряд меньше
 *    GAP_EXIT_STREAK — пример остаётся в пробелах: связи нужно несколько
 *    повторений (как минимум трижды решить правильно).
 */
export function isProblem(st, threshold = THRESHOLD_DEFAULT) {
  if (!st || st.h.length === 0) return false;
  const last3 = st.h.slice(0, 3);
  const errors = last3.filter(r => !r.o).length;
  if (errors === 0 && last3.length >= 2) {
    const avg = last3.reduce((s, r) => s + r.t, 0) / last3.length;
    if (avg > threshold) return true;
  }
  if (st.h.some(r => !r.o) && leadingCorrect(st.h) < GAP_EXIT_STREAK) return true;
  return false;
}

/** Записать ответ в состояние примера. time — секунды, rev — пример был показан в развороте (b×a). */
export function applyAnswer(st, ok, time, rev = false) {
  st.h.unshift({ o: ok ? 1 : 0, t: Math.round(time * 10) / 10, rev: rev ? 1 : 0 });
  st.h = st.h.slice(0, 10);
  st.a += 1;
  if (ok) st.c += 1;
  return st;
}

// ---------- Направление примера (4×6 vs 6×4) ----------

/** Оценка недавних ответов в одном направлении: точность со штрафом за медлительность. */
function sideScore(st, rev) {
  const arr = (st && st.h ? st.h : []).filter(r => !!r.rev === rev).slice(0, 4);
  if (arr.length === 0) return null;
  const acc = arr.reduce((s, r) => s + r.o, 0) / arr.length;
  const avgT = arr.reduce((s, r) => s + r.t, 0) / arr.length;
  return acc - avgT / 20; // 20 сек обнуляют победу быстрых над верными
}

/**
 * Какую сторону пары показать: 'normal' (a×b, меньшее первым) или 'reverse' (b×a).
 * Нет данных — 50/50; есть данные лишь с одной стороны — ту другую подтягиваем
 * (35%); если одна сторона явно слабее — показываем её в 70% случаев.
 */
export function pickOrientation(item, st, rnd = Math.random) {
  if (item.section !== 'mul') return 'normal';
  const [, a, b] = item.id.split(':');
  if (a === b) return 'normal';
  const N = sideScore(st, false);
  const R = sideScore(st, true);
  let weak = null;
  if (N === null && R === null) weak = null;
  else if (N === null) weak = 'normal';       // разворот уже знают — подтягиваем прямой
  else if (R === null) weak = 'reverse';      // прямой знают — потихоньку вводим разворот
  else if (R < N - 0.1) weak = 'reverse';
  else if (N < R - 0.1) weak = 'normal';
  if (!weak) return rnd() < 0.5 ? 'normal' : 'reverse';
  return rnd() < 0.7 ? weak : (weak === 'reverse' ? 'normal' : 'reverse');
}

// ---------- Сессии ----------

/** Вес примера при выборке в «Скорость»: умножение на 10 — слишком лёгкое, реже. */
function itemWeight(it) {
  return it.section === 'mul' && /:10$/.test(it.id) ? EASY_MUL_WEIGHT : 1;
}

/** Очередь вопросов: [{id, tries}] */
export function buildSession(items, stateMap, mode, length, threshold = THRESHOLD_DEFAULT, rnd = Math.random) {
  let pool;
  if (mode === 'gaps') {
    pool = items.filter(it => isProblem(stateMap[it.id], threshold));
    shuffle(pool, rnd);
  } else {
    // взвешенное перемешивание (экспоненциальные часы): больший вес — раньше выпадает
    pool = items
      .map(it => ({ it, key: -Math.log(Math.max(rnd(), 1e-9)) / itemWeight(it) }))
      .sort((a, b) => a.key - b.key)
      .map(x => x.it);
  }
  return pool.slice(0, Math.min(length, pool.length)).map(it => ({ id: it.id, tries: 0 }));
}

export function shuffle(arr, rnd = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Бонус XP за завершённую сессию. */
export function sessionBonus(total, correct) {
  if (total === 0) return 0;
  const acc = correct / total;
  if (acc === 1 && total >= 10) return 75;
  if (acc >= 0.9) return 30;
  return 0;
}

// ---------- XP, уровни, звания ----------

export function answerXp(ok, time, threshold = THRESHOLD_DEFAULT) {
  return ok ? (time <= threshold ? 15 : 10) : 1;
}

export function xpForNextLevel(level) { return 100 + (level - 1) * 60; }

export function levelFromXp(xp) {
  let level = 1, rest = xp;
  while (rest >= xpForNextLevel(level)) { rest -= xpForNextLevel(level); level++; }
  return { level, rest, need: xpForNextLevel(level) };
}

export function rankName(level) {
  let name = RANKS[0][1];
  for (const [lv, nm] of RANKS) if (level >= lv) name = nm;
  return name;
}

// ---------- Стрик ----------

export function todayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysBetween(keyA, keyB) {
  const [a, b] = [new Date(keyA + 'T12:00:00'), new Date(keyB + 'T12:00:00')];
  return Math.round((b - a) / 86400000);
}

/** Обновить стрик после завершённой сессии. today — ключ сегодняшнего дня. */
export function updateStreak(streak, today) {
  if (!streak.lastDay) return { count: 1, lastDay: today };
  const d = daysBetween(streak.lastDay, today);
  if (d === 0) return { count: Math.max(streak.count, 1), lastDay: today };
  if (d === 1) return { count: streak.count + 1, lastDay: today };
  return { count: 1, lastDay: today };
}

/** Стрик активен (тренировался сегодня или вчера). */
export function streakAlive(streak, today) {
  if (!streak.lastDay) return false;
  const d = daysBetween(streak.lastDay, today);
  return d === 0 || d === 1;
}

// ---------- Ачивки ----------

export function greenCells(state, section, threshold, squaresMax = SQUARES_MAX_DEFAULT) {
  const items = buildItems(section, squaresMax);
  return items.filter(it => mastery(state.items[it.id], threshold) >= 0.8).length;
}

export const ACHIEVEMENTS = [
  { id: 'first_session', icon: '🎉', title: 'Первый шаг',        desc: 'Заверши первую сессию' },
  { id: 'answers_100',   icon: '💯', title: 'Сотка',             desc: '100 ответов всего' },
  { id: 'answers_500',   icon: '🚀', title: 'Пятьсот!',          desc: '500 ответов всего' },
  { id: 'perfect_10',    icon: '🎯', title: 'Без промаха',      desc: 'Сессия от 10 вопросов без ошибок' },
  { id: 'streak_3',      icon: '🔥', title: 'Три дня подряд',   desc: 'Стрик 3 дня' },
  { id: 'streak_7',      icon: '📅', title: 'Неделя силы',      desc: 'Стрик 7 дней' },
  { id: 'streak_30',     icon: '🏆', title: 'Месяц дисциплины', desc: 'Стрик 30 дней' },
  { id: 'mul_half',      icon: '🧩', title: 'Половина таблицы', desc: '23 из 45 примеров освоены' },
  { id: 'mul_all',       icon: '👑', title: 'Таблица покорена', desc: 'Все 45 примеров освоены' },
  { id: 'sq_all',        icon: '⬜', title: 'Все квадраты',     desc: 'Все квадраты (по текущей настройке) освоены' },
  { id: 'cubes_all',     icon: '🧊', title: 'Кубы покорены',    desc: 'Все 12 кубов освоены' },
  { id: 'pow4_all',      icon: '⚡', title: 'Четвёртая степень', desc: 'Все степени 1–5 освоены' },
  { id: 'fast_15',       icon: '💨', title: 'Молния',           desc: '15 верных подряд быстрее порога за сессию' },
  { id: 'level_5',       icon: '🎓', title: 'Знаток',           desc: 'Достигни 5 уровня' },
  { id: 'level_10',      icon: '🌟', title: 'Магистр',          desc: 'Достигни 10 уровня' },
  { id: 'speed_full',    icon: '🏎️', title: 'Спринтер',        desc: 'Полная сессия «Скорость» по таблице с точностью ≥ 90%' },
];

/** Проверить все ачивки, открыть новые. Возвращает список новых id. */
export function checkAchievements(state, ctx = {}) {
  const threshold = state.settings.threshold;
  const squaresMax = state.settings.squaresMax || SQUARES_MAX_DEFAULT;
  const lv = levelFromXp(state.xp).level;
  const mulGreen = greenCells(state, 'mul', threshold);
  const sqGreen = greenCells(state, 'pow2', threshold, squaresMax);
  const cubesGreen = greenCells(state, 'pow3', threshold);
  const pow4Green = greenCells(state, 'pow4', threshold);
  const cond = {
    first_session: state.totals.sessions >= 1,
    answers_100: state.totals.a >= 100,
    answers_500: state.totals.a >= 500,
    perfect_10: !!ctx.perfect10,
    streak_3: state.streak.count >= 3,
    streak_7: state.streak.count >= 7,
    streak_30: state.streak.count >= 30,
    mul_half: mulGreen >= 23,
    mul_all: mulGreen >= 45,
    sq_all: sqGreen >= buildItems('pow2', squaresMax).length,
    cubes_all: cubesGreen >= 12,
    pow4_all: pow4Green >= 5,
    fast_15: (ctx.fastStreak || 0) >= 15,
    level_5: lv >= 5,
    level_10: lv >= 10,
    speed_full: !!ctx.speedFull,
  };
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!state.ach[a.id] && cond[a.id]) { state.ach[a.id] = todayKey(); unlocked.push(a.id); }
  }
  return unlocked;
}
