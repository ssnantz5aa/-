import { store } from '../store.js';
import { esc, $, $$ } from '../ui.js';
import { icon } from '../icons.js';
import { eventRow, emptyState } from '../components.js';
import {
  WEEKDAYS, toYmd, fromYmd, isYmd, addDays, addMonths, startOfWeek, todayYmd, formatDateLong, toMinutes, timeParts,
} from '../dates.js';
import { startManual } from '../analyze.js';

const HOUR = 52; // 일간 보기 1시간 높이(px)
const VIEWS = [
  { id: 'month', label: '월' },
  { id: 'week', label: '주' },
  { id: 'day', label: '일' },
];

// 화면을 오가도 보던 위치가 유지되도록 모듈 상태로 둔다.
const state = { view: null, selected: null };

export function render(root, { query }) {
  if (!state.view) state.view = store.settings().defaultView || 'month';
  if (query.get('date') && isYmd(query.get('date'))) state.selected = query.get('date');
  if (query.get('view') && VIEWS.some((v) => v.id === query.get('view'))) state.view = query.get('view');
  if (!state.selected) state.selected = todayYmd();
  let focusId = query.get('focus');

  const draw = () => {
    const sel = fromYmd(state.selected);
    const today = todayYmd();
    root.innerHTML = `
      <header class="cal-head">
        <h1 class="title cal-head__title">
          <span class="num">${sel.getFullYear()}</span>년 <span class="num">${sel.getMonth() + 1}</span>월
        </h1>
        <div class="cal-head__nav">
          <a class="icon-btn" href="#/search" aria-label="일정 검색">${icon('search')}</a>
          <button type="button" class="btn btn--secondary btn--sm" data-nav="today" ${state.selected === today ? 'disabled' : ''}>오늘</button>
          <button type="button" class="icon-btn" data-nav="-1" aria-label="이전">${icon('chevronLeft')}</button>
          <button type="button" class="icon-btn" data-nav="1" aria-label="다음">${icon('chevronRight')}</button>
        </div>
      </header>
      <div class="segmented" role="tablist" aria-label="캘린더 보기">
        ${VIEWS.map((v) => `<button type="button" role="tab" class="segmented__item" data-view="${v.id}" aria-selected="${state.view === v.id}">${v.label}</button>`).join('')}
      </div>
      <div class="cal-body" id="cal-body">
        ${state.view === 'month' ? monthView(sel, today) : state.view === 'week' ? weekView(sel, today) : dayView(sel, today)}
      </div>`;

    $$('[data-view]', root).forEach((b) =>
      b.addEventListener('click', () => {
        state.view = b.dataset.view;
        draw();
      }),
    );
    $$('[data-nav]', root).forEach((b) => b.addEventListener('click', () => navigate(b.dataset.nav)));
    $$('[data-date]', root).forEach((b) =>
      b.addEventListener('click', () => {
        state.selected = b.dataset.date;
        if (state.view === 'week') {
          draw();
          root.querySelector(`[data-day-group="${state.selected}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else draw();
      }),
    );
    $$('[data-add-on]', root).forEach((b) => b.addEventListener('click', () => startManual(b.dataset.addOn)));

    const timeline = $('#timeline', root);
    if (timeline) {
      const first = store.byDate(state.selected).find((e) => e.startTime);
      const now = new Date();
      const hour = first ? Math.max(0, Math.floor(toMinutes(first.startTime) / 60) - 1) : state.selected === today ? Math.max(0, now.getHours() - 1) : 8;
      timeline.scrollTop = hour * HOUR;
    }
    if (focusId) {
      const el = root.querySelector(`a[href="#/event/${CSS.escape(focusId)}"]`);
      if (el) {
        el.classList.add('is-flash');
        el.scrollIntoView({ block: 'nearest' });
        focusId = null;
      }
    }
    bindSwipe($('#cal-body', root));
  };

  function navigate(dir) {
    const sel = fromYmd(state.selected);
    if (dir === 'today') state.selected = todayYmd();
    else {
      const n = Number(dir);
      state.selected = toYmd(state.view === 'month' ? addMonths(sel, n) : addDays(sel, state.view === 'week' ? 7 * n : n));
    }
    draw();
  }

  function bindSwipe(el) {
    let x0 = null;
    let y0 = null;
    el.addEventListener('touchstart', (e) => {
      if (e.target.closest('#timeline')) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) navigate(dx < 0 ? '1' : '-1');
    }, { passive: true });
  }

  draw();
}

// ── 월간 ──
function monthView(sel, today) {
  const weekStart = store.settings().weekStart;
  const first = new Date(sel.getFullYear(), sel.getMonth(), 1);
  const gridStart = startOfWeek(first, weekStart);
  const lastDay = new Date(sel.getFullYear(), sel.getMonth() + 1, 0);
  const weeks = Math.ceil((((first.getDay() - weekStart + 7) % 7) + lastDay.getDate()) / 7);
  const index = store.indexByDate();
  const selYmd = toYmd(sel);

  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(gridStart, i);
    const ymd = toYmd(day);
    const events = index.get(ymd) || [];
    const outside = day.getMonth() !== sel.getMonth();
    const cls = [
      'cell',
      outside && 'is-outside',
      ymd === today && 'is-today',
      ymd === selYmd && 'is-selected',
      day.getDay() === 0 && 'is-sun',
      day.getDay() === 6 && 'is-sat',
    ].filter(Boolean).join(' ');
    const label = `${day.getMonth() + 1}월 ${day.getDate()}일${events.length ? `, 일정 ${events.length}개` : ''}`;
    cells.push(`
      <button type="button" class="${cls}" data-date="${ymd}" aria-label="${label}" aria-pressed="${ymd === selYmd}">
        <span class="cell__num num">${day.getDate()}</span>
        <span class="cell__marks" aria-hidden="true">
          ${events.slice(0, 3).map((e) => `<span class="mark" data-type="${esc(e.type)}"></span>`).join('')}
          ${events.length > 3 ? `<span class="mark-more num">+${events.length - 3}</span>` : ''}
        </span>
        <span class="cell__events" aria-hidden="true">
          ${events.slice(0, events.length > 3 ? 2 : 3).map((e) => `<span class="cell__event" data-type="${esc(e.type)}">${esc(e.title)}</span>`).join('')}
          ${events.length > 3 ? `<span class="cell__more num">+${events.length - 2}개</span>` : ''}
        </span>
      </button>`);
  }

  return `
    <div class="month">
      <div class="month__weekdays" aria-hidden="true">${weekdayLabels(weekStart)}</div>
      <div class="month__grid" style="--weeks:${weeks}">${cells.join('')}</div>
    </div>
    ${agenda(selYmd, today)}`;
}

function weekdayLabels(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const wd = (weekStart + i) % 7;
    return `<span class="${wd === 0 ? 'is-sun' : wd === 6 ? 'is-sat' : ''}">${WEEKDAYS[wd]}</span>`;
  }).join('');
}

function agenda(ymd, today) {
  const events = store.byDate(ymd);
  return `
    <section class="agenda">
      <div class="section__head">
        <h2 class="section__title">${formatDateLong(ymd)}${ymd === today ? '<span class="tag">오늘</span>' : ''}</h2>
        <button type="button" class="btn btn--text btn--sm" data-add-on="${ymd}">${icon('plus', { size: 16 })}<span>추가</span></button>
      </div>
      ${
        events.length
          ? `<div class="list">${events.map((e) => eventRow(e)).join('')}</div>`
          : emptyState({ iconName: 'calendar', title: '일정이 없어요', body: '오른쪽 위 추가 버튼으로 이 날짜에 일정을 넣을 수 있어요.' })
      }
    </section>`;
}

// ── 주간 ──
function weekStrip(sel, today) {
  const weekStart = store.settings().weekStart;
  const start = startOfWeek(sel, weekStart);
  const index = store.indexByDate();
  const selYmd = toYmd(sel);
  return `
    <div class="strip">
      ${Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, i);
        const ymd = toYmd(day);
        const events = index.get(ymd) || [];
        const cls = ['strip__day', ymd === today && 'is-today', ymd === selYmd && 'is-selected', day.getDay() === 0 && 'is-sun', day.getDay() === 6 && 'is-sat'].filter(Boolean).join(' ');
        return `
          <button type="button" class="${cls}" data-date="${ymd}" aria-pressed="${ymd === selYmd}" aria-label="${day.getMonth() + 1}월 ${day.getDate()}일${events.length ? `, 일정 ${events.length}개` : ''}">
            <span class="strip__wd">${WEEKDAYS[day.getDay()]}</span>
            <span class="strip__num num">${day.getDate()}</span>
            <span class="cell__marks" aria-hidden="true">${events.slice(0, 3).map((e) => `<span class="mark" data-type="${esc(e.type)}"></span>`).join('')}</span>
          </button>`;
      }).join('')}
    </div>`;
}

function weekView(sel, today) {
  const start = startOfWeek(sel, store.settings().weekStart);
  const index = store.indexByDate();
  const days = Array.from({ length: 7 }, (_, i) => toYmd(addDays(start, i)));
  const total = days.reduce((n, d) => n + (index.get(d)?.length || 0), 0);
  return `
    ${weekStrip(sel, today)}
    <p class="week-summary">이번 주 일정 <span class="num">${total}</span>개</p>
    <div class="week-list">
      ${days
        .map((ymd) => {
          const events = index.get(ymd) || [];
          const d = fromYmd(ymd);
          const cls = ['day-group', ymd === toYmd(sel) && 'is-selected', ymd === today && 'is-today', !events.length && 'is-empty'].filter(Boolean).join(' ');
          return `
            <section class="${cls}" data-day-group="${ymd}">
              <h3 class="day-group__head">
                <span class="day-group__date"><span class="num">${d.getDate()}</span><small>${WEEKDAYS[d.getDay()]}</small></span>
                ${ymd === today ? '<span class="tag">오늘</span>' : ''}
                ${events.length ? '' : '<span class="day-group__none">일정 없음</span>'}
              </h3>
              ${events.length ? `<div class="list">${events.map((e) => eventRow(e)).join('')}</div>` : ''}
            </section>`;
        })
        .join('')}
    </div>`;
}

// ── 일간 ──
function dayView(sel, today) {
  const ymd = toYmd(sel);
  const events = store.byDate(ymd);
  const timed = events.filter((e) => e.startTime || e.callTime);
  const untimed = events.filter((e) => !e.startTime && !e.callTime);
  const fmt = store.settings().timeFormat;

  // 겹치는 일정은 열을 나눠 배치한다.
  const items = timed.map((e) => {
    const s = toMinutes(e.startTime || e.callTime);
    let end = e.endTime ? toMinutes(e.endTime) : s + 60;
    if (end <= s) end = 1440;
    return { e, s, end: Math.max(end, s + 30) };
  });
  const cols = [];
  for (const it of items) {
    let c = cols.findIndex((last) => last <= it.s);
    if (c === -1) c = cols.push(0) - 1;
    cols[c] = it.end;
    it.col = c;
  }
  for (const it of items) {
    const overlapping = items.filter((o) => o.s < it.end && o.end > it.s);
    it.cols = Math.max(...overlapping.map((o) => o.col)) + 1;
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return `
    ${weekStrip(sel, today)}
    <div class="day-head">
      <h2 class="section__title">${formatDateLong(ymd)}${ymd === today ? '<span class="tag">오늘</span>' : ''}</h2>
      <button type="button" class="btn btn--text btn--sm" data-add-on="${ymd}">${icon('plus', { size: 16 })}<span>추가</span></button>
    </div>
    ${
      untimed.length
        ? `<div class="untimed"><span class="untimed__label">시간 미정</span><div class="list">${untimed.map((e) => eventRow(e)).join('')}</div></div>`
        : ''
    }
    ${!events.length ? `<p class="day-empty">이 날은 일정이 없어요</p>` : ''}
    <div class="timeline" id="timeline" style="--hour:${HOUR}px">
      <div class="timeline__inner">
        ${Array.from({ length: 24 }, (_, h) => {
          const { meridiem, clock } = timeParts(`${String(h).padStart(2, '0')}:00`, fmt);
          return `<div class="timeline__hour"><span class="timeline__label num">${h === 0 ? '' : fmt === '12h' ? `${meridiem} ${clock.replace(':00', '')}시` : clock}</span></div>`;
        }).join('')}
        <div class="timeline__events">
          ${items
            .map(({ e, s, end, col, cols: n }) => {
              const short = end - s < 50;
              return `
                <a class="block ${short ? 'is-short' : ''}" data-type="${esc(e.type)}" href="#/event/${esc(e.id)}"
                   style="top:${(s / 60) * HOUR}px;height:${((end - s) / 60) * HOUR - 2}px;left:calc(${(col / n) * 100}% + 2px);width:calc(${100 / n}% - 4px)">
                  <span class="block__title">${esc(e.title)}</span>
                  <span class="block__time num">${timeParts(e.startTime || e.callTime, fmt).meridiem} ${timeParts(e.startTime || e.callTime, fmt).clock}${e.location && !short ? ` · ${esc(e.location.split('\n')[0])}` : ''}</span>
                </a>`;
            })
            .join('')}
        </div>
        ${ymd === today ? `<div class="timeline__now" style="top:${(nowMin / 60) * HOUR}px" aria-hidden="true"></div>` : ''}
      </div>
    </div>`;
}
