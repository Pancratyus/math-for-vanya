/* storage.js — состояние приложения в localStorage телефона. */

import { newItemState, THRESHOLD_DEFAULT, SQUARES_MAX_DEFAULT } from './engine.js';

const KEY = 'mv_state_v1';

export function defaultState() {
  return {
    version: 1,
    settings: { threshold: THRESHOLD_DEFAULT, squaresMax: SQUARES_MAX_DEFAULT, sound: true },
    xp: 0,
    streak: { count: 0, lastDay: null },
    items: {},   // id -> {h:[{o,t}], a, c}
    days: {},    // 'YYYY-MM-DD' -> {s, a, c, xp}
    ach: {},     // id -> 'YYYY-MM-DD' открытия
    totals: { a: 0, c: 0, sessions: 0 },
  };
}

export function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { /* приватный режим */ }
  if (!raw) return defaultState();
  try {
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.error('Повреждённое состояние, начинаем с чистого', e);
    return defaultState();
  }
}

/** Мягкая миграция: досыпаем недостающие поля из дефолта (совместимость версий). */
export function migrate(saved) {
  const def = defaultState();
  const st = { ...def, ...saved };
  st.settings = { ...def.settings, ...(saved.settings || {}) };
  st.streak = { ...def.streak, ...(saved.streak || {}) };
  st.totals = { ...def.totals, ...(saved.totals || {}) };
  st.items = saved.items || {};
  st.days = saved.days || {};
  st.ach = saved.ach || {};
  return st;
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error('Не удалось сохранить состояние', e); }
}

export function resetState() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

/** Состояние конкретного примера (создаётся при первом ответе). */
export function itemState(state, id) {
  if (!state.items[id]) state.items[id] = newItemState();
  return state.items[id];
}

/** Дневная запись (создаётся при первом ответе дня). */
export function dayEntry(state, dayKey) {
  if (!state.days[dayKey]) state.days[dayKey] = { s: 0, a: 0, c: 0, xp: 0 };
  return state.days[dayKey];
}
