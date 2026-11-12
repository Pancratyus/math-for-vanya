/* Тесты логики engine.js + storage.migrate. Запуск: node tests/engine.test.mjs */

import * as E from '../app/js/engine.js';
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.error('  ✗', name, '\n   ', e.message); }
}

const seeded = (() => {
  let s = 42;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
})();

console.log('Пулы примеров:');
t('mul: 45 примеров, ответы верные', () => {
  const items = E.buildItems('mul');
  assert.equal(items.length, 45);
  for (const it of items) {
    const [a, b] = it.id.split(':').slice(1).map(Number);
    assert.equal(it.answer, a * b);
    assert.ok(a <= b, 'пары нормализованы a<=b');
  }
});
t('pow2: 100 примеров 1..100', () => {
  const items = E.buildItems('pow2');
  assert.equal(items.length, 100);
  assert.equal(items[0].answer, 1);
  assert.equal(items[99].answer, 10000);
});
t('pow3: 12 примеров, pow4: 5', () => {
  assert.equal(E.buildItems('pow3').length, 12);
  assert.equal(E.buildItems('pow4').length, 5);
  assert.equal(E.buildItems('pow3').find(i => i.n === 12).answer, 1728);
});

console.log('Освоенность и проблемные:');
t('mastery без данных = -1', () => {
  assert.equal(E.mastery(E.newItemState()), -1);
  assert.equal(E.mastery(undefined), -1);
});
t('mastery: быстрые верные ≈ 1; ошибки заметно роняют', () => {
  const st = E.newItemState();
  for (const t of [2, 2, 2, 2, 2]) E.applyAnswer(st, true, t);
  assert.ok(E.mastery(st, 4) > 0.95);
  E.applyAnswer(st, false, 3); // одна свежая ошибка: падение, но не обнуление
  const m1 = E.mastery(st, 4);
  assert.ok(m1 < 0.7 && m1 > 0.4, `m1=${m1}`);
  E.applyAnswer(st, false, 3); // две ошибки из последних 3 — красная зона
  const m2 = E.mastery(st, 4);
  assert.ok(m2 < 0.4, `m2=${m2}`);
});
t('isProblem: 2 ошибки из последних 3', () => {
  const st = E.newItemState();
  E.applyAnswer(st, true, 2); E.applyAnswer(st, false, 3); E.applyAnswer(st, false, 3);
  assert.ok(E.isProblem(st, 4));
});
t('isProblem: верно, но медленно', () => {
  const st = E.newItemState();
  E.applyAnswer(st, true, 6); E.applyAnswer(st, true, 7);
  assert.ok(E.isProblem(st, 4));
});
t('isProblem: верно и быстро — не проблемный', () => {
  const st = E.newItemState();
  E.applyAnswer(st, true, 2); E.applyAnswer(st, true, 3);
  assert.ok(!E.isProblem(st, 4));
});
t('isProblem: единственная ошибка не делает проблемным', () => {
  const st = E.newItemState();
  E.applyAnswer(st, true, 2); E.applyAnswer(st, true, 2); E.applyAnswer(st, false, 2);
  assert.ok(!E.isProblem(st, 4));
});

console.log('Сессии:');
t('speed: без повторов, покрыл весь пул на full', () => {
  const items = E.buildItems('mul');
  const q = E.buildSession(items, {}, 'speed', 45, 4);
  assert.equal(q.length, 45);
  const ids = new Set(q.map(x => x.id));
  assert.equal(ids.size, 45);
});
t('speed: порядок случаен (seeded shuffle перемешивает)', () => {
  const items = E.buildItems('mul');
  const q = E.buildSession(items, {}, 'speed', 45, 4);
  assert.notDeepEqual(q.map(x => x.id), items.map(i => i.id));
});
t('gaps: только проблемные, длина ограничена', () => {
  const items = E.buildItems('mul');
  const map = {};
  items.forEach((it, i) => { if (i < 7) { const s = E.newItemState(); E.applyAnswer(s, false, 2); E.applyAnswer(s, false, 2); map[it.id] = s; } });
  const q = E.buildSession(items, map, 'gaps', 20, 4);
  assert.equal(q.length, 7);
  for (const e of q) assert.ok(E.isProblem(map[e.id], 4));
});
t('gaps: пустой пул → пустая сессия', () => {
  const q = E.buildSession(E.buildItems('mul'), {}, 'gaps', 20, 4);
  assert.equal(q.length, 0);
});
t('длина 20 в speed', () => {
  const q = E.buildSession(E.buildItems('pow2'), {}, 'speed', 20, 4);
  assert.equal(q.length, 20);
});

console.log('XP, уровни, стрик, бонусы:');
t('answerXp: быстрый 15, обычный 10, ошибка 1', () => {
  assert.equal(E.answerXp(true, 3, 4), 15);
  assert.equal(E.answerXp(true, 5, 4), 10);
  assert.equal(E.answerXp(false, 1, 4), 1);
});
t('levelFromXp: монотонная и корректная', () => {
  assert.equal(E.levelFromXp(0).level, 1);
  const { level } = E.levelFromXp(100 + 160); // 1-й и 2-й уровни целиком
  assert.equal(level, 3);
  const l2 = E.levelFromXp(100);
  assert.equal(l2.level, 2); assert.equal(l2.rest, 0); assert.equal(l2.need, 160);
});
t('rankName по уровням', () => {
  assert.equal(E.rankName(1), 'Новичок');
  assert.equal(E.rankName(5), 'Знаток');
  assert.equal(E.rankName(12), 'Профессор');
  assert.equal(E.rankName(99), 'Профессор');
});
t('updateStreak: сегодня не удваивает, вчера +1, пропуск сбрасывает', () => {
  assert.equal(E.updateStreak({ count: 3, lastDay: '2026-11-12' }, '2026-11-12').count, 3);
  assert.equal(E.updateStreak({ count: 3, lastDay: '2026-11-11' }, '2026-11-12').count, 4);
  assert.equal(E.updateStreak({ count: 3, lastDay: '2026-11-01' }, '2026-11-12').count, 1);
  assert.equal(E.updateStreak({ count: 0, lastDay: null }, '2026-11-12').count, 1);
});
t('sessionBonus: 100% от 10+ = 75, >=90% = 30, иначе 0', () => {
  assert.equal(E.sessionBonus(10, 10), 75);
  assert.equal(E.sessionBonus(9, 9), 30);
  assert.equal(E.sessionBonus(20, 19), 30);
  assert.equal(E.sessionBonus(10, 8), 0);
  assert.equal(E.sessionBonus(0, 0), 0);
});

console.log('Ачивки:');
t('first_session открывается после сессии', () => {
  const state = { version: 1, settings: { threshold: 4 }, xp: 0, streak: { count: 1, lastDay: '2026-11-12' }, items: {}, days: {}, ach: {}, totals: { a: 10, c: 10, sessions: 1 } };
  const news = E.checkAchievements(state, {});
  assert.ok(news.includes('first_session'));
  assert.equal(news.length, 1);
  assert.ok(state.ach.first_session);
});
t('mul_all требует все 45 зелёных', () => {
  const state = { version: 1, settings: { threshold: 4 }, xp: 0, streak: { count: 0, lastDay: null }, items: {}, days: {}, ach: {}, totals: { a: 0, c: 0, sessions: 0 } };
  for (const it of E.buildItems('mul')) {
    const s = E.newItemState();
    for (let i = 0; i < 5; i++) E.applyAnswer(s, true, 2);
    state.items[it.id] = s;
  }
  const news = E.checkAchievements(state, {});
  assert.ok(news.includes('mul_all'));
  assert.ok(news.includes('mul_half'));
});
t('fast_15 по контексту сессии', () => {
  const state = { version: 1, settings: { threshold: 4 }, xp: 0, streak: { count: 0, lastDay: null }, items: {}, days: {}, ach: {}, totals: { a: 0, c: 0, sessions: 0 } };
  const news = E.checkAchievements(state, { fastStreak: 15 });
  assert.ok(news.includes('fast_15'));
});

console.log('Миграция хранилища:');
t('migrate досыпает недостающие поля', async () => {
  const { migrate } = await import('../app/js/storage.js');
  const st = migrate({ version: 1, xp: 50 });
  assert.equal(st.settings.threshold, 4);
  assert.equal(st.settings.sound, true);
  assert.deepEqual(st.totals, { a: 0, c: 0, sessions: 0 });
  assert.equal(st.xp, 50);
});

console.log(`\nИтог: ${passed} прошли, ${failed} упали`);
process.exit(failed ? 1 : 0);
