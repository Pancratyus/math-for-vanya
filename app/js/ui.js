/* ui.js — построители HTML экранов (чистые функции, без обработчиков).
   Обработчики — в main.js, через делегирование data-act. */

import {
  SECTIONS, LEVELS, ACHIEVEMENTS, HOME_SECTIONS,
  buildItems, mastery, isProblem, levelFromXp, rankName,
  greenCells, streakAlive, poolSize,
} from './engine.js';
import { MIN_GAPS_POOL } from './engine.js';

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = v => Math.round(v * 100);
export const fmtSec = t => t.toFixed(1).replace('.', ',') + ' с';

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const dayKey = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

/** Русская плюрализация: plural(1, 'день,дня,дней') → 'день' */
export function plural(n, forms) {
  const [one, few, many] = forms.split(',');
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

// ---------- Главный экран ----------

export function homeHtml(app) {
  const st = app.data;
  const lv = levelFromXp(st.xp);
  const alive = streakAlive(st.streak, dayKey(new Date()));
  const flame = alive ? '🔥' : '🕑';
  return `
  <div class="screen screen-home">
    <header class="home-head">
      <div class="app-title">Математика<br>для Вани</div>
      <button class="gear" data-act="go-settings" aria-label="Настройки">⚙️</button>
    </header>
    <div class="hero-card">
      <div class="hero-row">
        <div class="hero-level">
          <span class="level-badge">${lv.level}</span>
          <span class="rank">${rankName(lv.level)}</span>
        </div>
        <div class="streak ${alive ? '' : 'dead'}" title="Дни тренировок подряд">${flame} ${st.streak.count}</div>
      </div>
      <div class="xp-bar"><div class="xp-fill" style="width:${pct(lv.rest / lv.need)}%"></div></div>
      <div class="xp-note">${lv.rest} / ${lv.need} XP до уровня ${lv.level + 1}</div>
    </div>
    <nav class="home-nav">
      ${HOME_SECTIONS.map(s => `
        <button class="big-btn" data-act="go-section" data-section="${s.key}">
          <span class="big-btn-icon">${s.key === 'mul' ? '✖️' : '²'}</span>
          <span class="big-btn-text"><b>${s.title}</b><small>${s.sub}</small></span>
          <span class="chev">›</span>
        </button>`).join('')}
      <button class="big-btn alt" data-act="go-stats">
        <span class="big-btn-icon">📊</span>
        <span class="big-btn-text"><b>Статистика</b><small>прогресс и освоенность</small></span>
        <span class="chev">›</span>
      </button>
    </nav>
    <button class="rules-link" data-act="go-rules">📖 Правила игры</button>
  </div>`;
}

// ---------- Выбор уровня степеней ----------

export function levelsHtml(app) {
  const st = app.data;
  const th = st.settings.threshold;
  return `
  <div class="screen">
    <header class="bar">
      <button class="back" data-act="go-home">‹</button>
      <h1>Степени</h1><span class="bar-spacer"></span>
    </header>
    <div class="card-list">
      ${LEVELS.map(l => {
        const items = buildItems(l.key);
        const gaps = items.filter(it => isProblem(st.items[it.id], th)).length;
        return `
        <button class="big-btn" data-act="go-level" data-section="${l.key}">
          <span class="big-btn-icon">${l.key === 'pow2' ? '²' : l.key === 'pow3' ? '³' : '⁴'}</span>
          <span class="big-btn-text"><b>${l.title}</b><small>${l.sub} · освоено ${greenCells(st, l.key, th)} из ${l.size}</small></span>
          <span class="chev">›</span>
        </button>`;
      }).join('')}
    </div>
    <p class="hint-center">Выбери уровень — потом режим тренировки</p>
  </div>`;
}

// ---------- Выбор режима и длины сессии ----------

export function modeHtml(app) {
  const { section, length } = app.params;
  const st = app.data;
  const th = st.settings.threshold;
  const items = buildItems(section);
  const gaps = items.filter(it => isProblem(st.items[it.id], th));
  const gapsOk = gaps.length >= MIN_GAPS_POOL;
  const size = items.length;
  const fullLabel = section === 'mul' ? `Весь набор (${size})` : `Весь набор (${size})`;
  const lenFull = length === 'full';
  const title = SECTIONS[section] ? SECTIONS[section].name : section;
  return `
  <div class="screen">
    <header class="bar">
      <button class="back" data-act="back-from-mode">${section === 'mul' ? '‹' : '‹'}</button>
      <h1>${esc(title)}</h1><span class="bar-spacer"></span>
    </header>
    <div class="card-list">
      <button class="mode-card speed" data-act="start-session" data-mode="speed" data-length="${lenFull ? 'full' : '20'}">
        <span class="mode-icon">⚡</span>
        <span class="mode-text"><b>Скорость</b><small>все ${size} примеров вперемешку, нарабатываем автоматизм</small></span>
      </button>
      <button class="mode-card gaps ${gapsOk ? '' : 'disabled'}" data-act="${gapsOk ? 'start-session' : 'noop'}" data-mode="gaps" data-length="${lenFull ? 'full' : '20'}">
        <span class="mode-icon">🧠</span>
        <span class="mode-text"><b>Пробелы (${gaps.length})</b><small>${gapsOk ? 'только те примеры, где трудно' : `нужно хотя бы ${MIN_GAPS_POOL} проблемных — потренируйся в «Скорости»`}</small></span>
      </button>
    </div>
    <div class="segment-block">
      <div class="segment-label">Длина сессии</div>
      <div class="segment">
        <button class="${lenFull ? '' : 'on'}" data-act="set-length" data-length="20">20 вопросов</button>
        <button class="${lenFull ? 'on' : ''}" data-act="set-length" data-length="full">${fullLabel}</button>
      </div>
    </div>
    <p class="hint-center">Тренируйся каждый день — стрик 🔥 растёт!</p>
  </div>`;
}

// ---------- Экран сессии ----------

export function sessionHtml(app) {
  const s = app.session;
  const item = s.current;
  const total = s.planned + s.requeued;
  const done = s.answered;
  const empty = s.input === '';
  return `
  <div class="screen screen-session">
    <header class="sess-head">
      <button class="exit" data-act="exit-session">✕</button>
      <div class="sess-mid">
        <span class="chip mode-${s.mode}">${s.mode === 'gaps' ? '🧠 Пробелы' : '⚡ Скорость'}</span>
        <span class="chip">${s.sectionLabel}</span>
      </div>
      <div class="sess-progress">${done} / ${total}</div>
    </header>
    <div class="qpanel ${s.flash || ''}" id="qpanel">
      <div class="q-text">${esc(item.text)} = ?</div>
      <div class="q-meta"><span class="q-timer" id="qtimer">0,0 с</span></div>
      <div class="answer-box ${s.flash || ''}">
        ${s.feedback
          ? `<span class="fb ${s.flash}">${s.flash === 'ok' ? '✓' : '✗'} ${esc(s.feedback)}</span>`
          : `<span class="typed ${empty ? 'empty' : ''}">${empty ? '?' : esc(s.input)}</span><span class="caret"></span>`}
      </div>
    </div>
    <div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" data-act="key" data-key="${n}">${n}</button>`).join('')}
      <button class="key fn" data-act="key" data-key="back">⌫</button>
      <button class="key" data-act="key" data-key="0">0</button>
      <button class="key enter" data-act="key" data-key="enter">✓</button>
    </div>
  </div>`;
}

// ---------- Итоги сессии ----------

export function summaryHtml(app) {
  const s = app.session;
  const acc = s.answered ? s.correct / s.answered : 0;
  const avg = s.answered ? s.timeSum / s.answered : 0;
  const lv = levelFromXp(app.data.xp);
  const alive = streakAlive(app.data.streak, dayKey(new Date()));
  const news = (s.newAchievements || []).map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean);
  return `
  <div class="screen screen-summary">
    <h1 class="sum-title">Сессия завершена!</h1>
    <div class="sum-hero">${acc === 1 ? '🏆' : acc >= 0.9 ? '🎉' : '👍'}</div>
    <div class="sum-cards">
      <div class="sum-card"><b>${s.correct} / ${s.answered}</b><small>правильных</small></div>
      <div class="sum-card"><b>${pct(acc)}%</b><small>точность</small></div>
      <div class="sum-card"><b>${fmtSec(avg)}</b><small>среднее время</small></div>
    </div>
    <div class="sum-xp">
      <span>+${s.xpEarned} XP</span>
      <small>${rankName(lv.level)}, уровень ${lv.level} · ${lv.rest}/${lv.need} до след.</small>
    </div>
    <div class="sum-streak ${alive ? '' : 'dead'}">${alive ? '🔥' : '🕑'} Стрик: ${app.data.streak.count} ${plural(app.data.streak.count, 'день,дня,дней')} ${alive ? 'подряд' : '— тренируйся сегодня!'}</div>
    ${news.length ? `
      <div class="sum-ach">
        <div class="segment-label">Новые ачивки!</div>
        ${news.map(a => `<div class="ach-chip"><span>${a.icon}</span> <b>${esc(a.title)}</b></div>`).join('')}
      </div>` : ''}
    <div class="sum-actions">
      <button class="primary" data-act="restart-session">Ещё сессия</button>
      <button class="secondary" data-act="go-home">На главный</button>
    </div>
  </div>`;
}

// ---------- Статистика ----------

export function statsHtml(app) {
  const tab = app.params.tab || 'progress';
  return `
  <div class="screen">
    <header class="bar">
      <button class="back" data-act="go-home">‹</button>
      <h1>Статистика</h1><span class="bar-spacer"></span>
    </header>
    <div class="segment tabs">
      <button class="${tab === 'progress' ? 'on' : ''}" data-act="stats-tab" data-tab="progress">Прогресс</button>
      <button class="${tab === 'map' ? 'on' : ''}" data-act="stats-tab" data-tab="map">Карта</button>
      <button class="${tab === 'ach' ? 'on' : ''}" data-act="stats-tab" data-tab="ach">Ачивки</button>
    </div>
    <div class="stats-body">${tab === 'progress' ? progressHtml(app) : tab === 'map' ? mapHtml(app) : achHtml(app)}</div>
  </div>`;
}

function progressHtml(app) {
  const st = app.data;
  const th = st.settings.threshold;
  const days = lastNDays(7);
  const maxAcc = 100;
  const bars = days.map(dk => {
    const d = st.days[dk] || { a: 0, c: 0 };
    const acc = d.a ? Math.round(d.c / d.a * 100) : null;
    const wd = WEEKDAYS[new Date(dk + 'T12:00:00').getDay()];
    const h = acc === null ? 6 : Math.max(8, acc / maxAcc * 100);
    return `<div class="day-col">
      <div class="day-bar"><div class="day-fill ${acc === null ? 'empty' : acc >= 90 ? 'good' : acc >= 70 ? 'mid' : 'low'}" style="height:${h}%"></div></div>
      <div class="day-acc">${acc === null ? '–' : acc + '%'}</div>
      <div class="day-cnt">${d.a || ''}</div>
      <div class="day-wd">${wd}</div>
    </div>`;
  }).join('');

  // сравнение недель
  const cur = sumDays(st.days, lastNDays(7));
  const prev = sumDays(st.days, lastNDays(14).slice(0, 7));
  let compare;
  if (!cur.a && !prev.a) compare = `<div class="compare">Пока нет данных — пройди первую сессию!</div>`;
  else {
    const ca = cur.a ? Math.round(cur.c / cur.a * 100) : null;
    const pa = prev.a ? Math.round(prev.c / prev.a * 100) : null;
    const delta = ca !== null && pa !== null ? ca - pa : null;
    compare = `<div class="compare">
      <span>7 дней: <b>${ca === null ? '–' : ca + '%'}</b> (${cur.a} отв.)</span>
      <span>пред. 7: <b>${pa === null ? '–' : pa + '%'}</b> (${prev.a} отв.)</span>
      ${delta !== null ? `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲ +' : '▼ '}${delta}%</span>` : ''}
    </div>`;
  }

  // проблемные
  const problems = [];
  for (const sec of ['mul', 'pow2', 'pow3', 'pow4']) {
    for (const it of buildItems(sec)) {
      const s = st.items[it.id];
      if (isProblem(s, th)) {
        problems.push({ it, s, m: mastery(s, th), errs: s.h.slice(0, 3).filter(r => !r.o).length });
      }
    }
  }
  problems.sort((x, y) => x.m - y.m || y.s.a - x.s.a);
  const probHtml = problems.length
    ? problems.slice(0, 8).map(p => `
      <div class="prob-row"><span class="prob-q">${esc(p.it.text)}</span>
      <span class="prob-note">${p.s.c}/${p.s.a} · ${fmtSec(p.s.h.reduce((s, r) => s + r.t, 0) / Math.min(p.s.h.length, 3))}</span></div>`).join('')
    : `<div class="empty-note">Проблемных примеров нет — так держать! 🎉</div>`;

  const tot = st.totals;
  return `
    <div class="sum-cards tight">
      <div class="sum-card"><b>${tot.sessions}</b><small>сессий</small></div>
      <div class="sum-card"><b>${tot.a}</b><small>ответов</small></div>
      <div class="sum-card"><b>${tot.a ? Math.round(tot.c / tot.a * 100) + '%' : '–'}</b><small>точность</small></div>
    </div>
    <div class="card chart-card">
      <div class="segment-label">Последние 7 дней (точность)</div>
      <div class="chart">${bars}</div>
    </div>
    ${compare}
    <div class="card">
      <div class="segment-label">Требуют внимания</div>
      ${probHtml}
    </div>`;
}

export function lastNDays(n) {
  const res = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    res.push(dayKey(d));
  }
  return res;
}

function sumDays(days, keys) {
  let a = 0, c = 0;
  for (const k of keys) { const d = days[k]; if (d) { a += d.a; c += d.c; } }
  return { a, c };
}

function mapHtml(app) {
  const tab = app.params.mapTab || 'mul';
  const st = app.data;
  const th = st.settings.threshold;
  const tabs = [['mul', '×'], ['pow2', '²'], ['pow3', '³'], ['pow4', '⁴']]
    .map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="map-tab" data-tab="${k}">${l}</button>`).join('');
  const items = buildItems(tab);
  const green = greenCells(st, tab, th);
  let grid;
  if (tab === 'pow2') {
    // 100 клеток — сетка 10×10 без подписей, подробности по нажатию
    grid = `<div class="mgrid" style="--cols:10">` +
      items.map(it => {
        const m = mastery(st.items[it.id], th);
        return `<button class="mcell ${mcls(m)}" data-act="mastery-tap" data-id="${it.id}"></button>`;
      }).join('') + `</div>`;
  } else {
    // таблица (45) и мелкие уровни — клетки с подписью примера
    grid = `<div class="mgrid flow" style="--cols:9">` +
      items.map(it => {
        const m = mastery(st.items[it.id], th);
        return `<button class="mcell ${mcls(m)} labeled" data-act="mastery-tap" data-id="${it.id}">${esc(it.text.replace(/ /g, ''))}</button>`;
      }).join('') + `</div>`;
  }
  const legend = `
    <div class="legend">
      <span><i class="m0"></i>нет данных</span><span><i class="m1"></i>трудно</span>
      <span><i class="m2"></i>почти</span><span><i class="m3"></i>освоено</span>
    </div>`;
  return `
    <div class="segment mini">${tabs}</div>
    <div class="card">
      <div class="segment-label">Освоено ${green} из ${items.length}</div>
      <div class="map-scroll">${grid}</div>
      ${legend}
      <div class="mastery-detail" id="mastery-detail">Нажми на клетку — покажу подробности</div>
    </div>`;
}

function mcls(m) { return m < 0 ? 'm0' : m < 0.4 ? 'm1' : m < 0.8 ? 'm2' : 'm3'; }

function achHtml(app) {
  const st = app.data;
  return `<div class="ach-grid">` + ACHIEVEMENTS.map(a => {
    const got = st.ach[a.id];
    return `<div class="ach-card ${got ? 'got' : ''}">
      <div class="ach-icon">${a.icon}</div>
      <b>${esc(a.title)}</b>
      <small>${esc(a.desc)}</small>
      ${got ? `<span class="ach-date">✓ ${got.slice(5).replace('-', '.')}</span>` : ''}
    </div>`;
  }).join('') + `</div>`;
}

// ---------- Правила игры ----------
// ВАЖНО ДЛЯ РАЗРАБОТЧИКОВ: при любом изменении механик приложения
// синхронизируй этот экран с фактическим поведением (формулы и правила
// описаны в PROJECT_STATE.md §4). Проверка — пункт чек-листа обновления в README.

export function rulesHtml(app) {
  const th = app.data.settings.threshold;
  return `
  <div class="screen">
    <header class="bar">
      <button class="back" data-act="go-home">‹</button>
      <h1>Правила игры</h1><span class="bar-spacer"></span>
    </header>
    <div class="card-list rules">
      <div class="card rule"><span class="rule-icon">🎯</span><p><b>Что делать.</b> Программа показывает пример — набери ответ цифрами и нажми <b>✓</b>. Кнопка <b>⌫</b> стирает лишнюю цифру.</p></div>
      <div class="card rule"><span class="rule-icon">⚡</span><p><b>Режим «Скорость».</b> Все примеры раздела — вперемешку. Тренируешь отвечать быстро и без ошибок.</p></div>
      <div class="card rule"><span class="rule-icon">🧠</span><p><b>Режим «Пробелы».</b> Только те примеры, где трудно (2 ошибки из последних 3 или ответ дольше порога). Появится, когда наберётся хотя бы 5 таких.</p></div>
      <div class="card rule"><span class="rule-icon">⏱</span><p><b>Секундомер.</b> Время на ответ не ограничено — но быстрый верный ответ (не дольше <b>${th} сек</b>) приносит больше опыта.</p></div>
      <div class="card rule"><span class="rule-icon">💡</span><p><b>Если ошибся.</b> Покажем правильный ответ, а этот пример ещё раз придёт в конце сессии — чтобы ты его запомнил.</p></div>
      <div class="card rule"><span class="rule-icon">✨</span><p><b>Опыт (XP).</b> Верный ответ — 10, быстрый — 15, даже неверный — 1 за старание. За сессию с точностью 90% — бонус +30, а без единой ошибки — +75!</p></div>
      <div class="card rule"><span class="rule-icon">🎓</span><p><b>Уровни и звания.</b> Новичок → Ученик → Знаток → Умник → Магистр → Профессор. Опыт растёт — растёт и звание.</p></div>
      <div class="card rule"><span class="rule-icon">🔥</span><p><b>Стрик.</b> Тренируйся каждый день — счётчик дней подряд растёт. Пропустишь день — начнётся с единицы.</p></div>
      <div class="card rule"><span class="rule-icon">🏅</span><p><b>Ачивки.</b> 16 медалей открываются сами: за первую сессию, за сотню ответов, за покорённую таблицу и другие.</p></div>
      <div class="card rule"><span class="rule-icon">🗺️</span><p><b>Карта освоенности.</b> В статистике каждая клетка — пример: зелёный — освоено, жёлтый — почти, красный — трудно, серый — ещё не встречался.</p></div>
      <div class="card rule parent"><span class="rule-icon">⚙️</span><p><small><b>Родителям:</b> порог «медленного» ответа (сейчас ${th} сек), звук и сброс прогресса — в настройках. Прогресс хранится на устройстве и не передаётся в интернет.</small></p></div>
    </div>
    <p class="hint-center">Главная тренировка — каждый день по чуть-чуть. Удачи! 🍀</p>
  </div>`;
}

// ---------- Настройки ----------

export function settingsHtml(app) {
  const st = app.data;
  return `
  <div class="screen">
    <header class="bar">
      <button class="back" data-act="go-home">‹</button>
      <h1>Настройки</h1><span class="bar-spacer"></span>
    </header>
    <div class="card-list">
      <div class="card">
        <div class="segment-label">Порог «медленного» ответа: <b id="th-val">${st.settings.threshold}</b> сек</div>
        <input type="range" id="th-slider" min="2" max="12" step="1" value="${st.settings.threshold}" data-act="threshold">
        <p class="hint">Ответы дольше этого времени считаются медленными: такие примеры попадают в режим «Пробелы». Быстрые верные ответы дают больше XP.</p>
      </div>
      <div class="card row">
        <span>Звуки</span>
        <button class="toggle ${st.settings.sound ? 'on' : ''}" data-act="sound-toggle" aria-label="Звук"><i></i></button>
      </div>
      <button class="card danger" data-act="reset-progress">Сбросить весь прогресс…</button>
      ${app.confirmReset ? `
      <div class="card confirm">
        <p>Точно сбросить? Вся статистика, XP, стрик и ачивки будут удалены безвозвратно.</p>
        <div class="confirm-row">
          <button class="secondary" data-act="reset-cancel">Отмена</button>
          <button class="danger-solid" data-act="reset-yes">Да, сбросить</button>
        </div>
      </div>` : ''}
    </div>
    <p class="hint-center">Математика для Вани · v1.0</p>
  </div>`;
}
