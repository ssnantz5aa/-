import { esc } from './ui.js';
import { icon } from './icons.js';
import { fromYmd, timeParts, WEEKDAYS, formatTimeRange, formatTime } from './dates.js';
import { formatWonShort } from './parser.js';
import { typeLabel } from './types.js';
import { store } from './store.js';

const fmtSetting = () => store.settings().timeFormat;

const sep = '<span class="dot-sep" aria-hidden="true"></span>';

function place(e) {
  const text = e.location ? e.location.split('\n')[0] : e.agency;
  return text ? `${sep}<span class="event-row__place">${esc(text)}</span>` : '';
}

/** 종료 시간: 시작과 오전/오후가 같으면 생략한다 */
function endLabel(e) {
  if (!e.startTime || !e.endTime) return '';
  const f = fmtSetting();
  const a = timeParts(e.startTime, f);
  const b = timeParts(e.endTime, f);
  return `~ ${a.meridiem === b.meridiem ? b.clock : formatTime(e.endTime, f)}`;
}

/** 시간 열이 있는 일정 행 (하루 목록) */
export function eventRow(e, { highlight } = {}) {
  const start = e.startTime || e.callTime;
  const { meridiem, clock } = timeParts(start, fmtSetting());
  const title = highlight ? highlight(e.title) : esc(e.title);
  return `
    <a class="event-row" href="#/event/${esc(e.id)}" data-type="${esc(e.type)}">
      <span class="event-row__time ${start ? '' : 'is-empty'}">
        ${start ? `${meridiem ? `<small>${meridiem}</small>` : ''}<span>${clock}</span>` : '<span class="muted">미정</span>'}
        ${endLabel(e) ? `<em>${endLabel(e)}</em>` : ''}
      </span>
      <span class="event-row__bar" aria-hidden="true"></span>
      <span class="event-row__body">
        <span class="event-row__title">${title}</span>
        <span class="event-row__meta"><span class="type-label">${typeLabel(e.type)}</span>${place(e)}</span>
      </span>
      ${e.pay ? `<span class="event-row__aside num">${formatWonShort(e.pay)}</span>` : ''}
    </a>`;
}

/** 날짜 열이 있는 일정 행 (다가오는 일정, 검색 결과) */
export function eventRowDated(e, { highlight, today, repeat = false } = {}) {
  const d = fromYmd(e.date);
  const title = highlight ? highlight(e.title) : esc(e.title);
  const isToday = e.date === today;
  return `
    <a class="event-row event-row--dated" href="#/event/${esc(e.id)}" data-type="${esc(e.type)}">
      <span class="event-row__date ${isToday ? 'is-today' : ''} ${repeat ? 'is-repeat' : ''}" ${repeat ? 'aria-hidden="true"' : ''}>
        <span class="num">${d.getDate()}</span>
        <small>${isToday ? '오늘' : WEEKDAYS[d.getDay()]}</small>
      </span>
      <span class="event-row__bar" aria-hidden="true"></span>
      <span class="event-row__body">
        <span class="event-row__title">${title}</span>
        <span class="event-row__meta"><span class="num">${e.startTime ? esc(formatTimeRange(e.startTime, e.endTime, fmtSetting())) : '시간 미정'}</span>${place(e)}</span>
      </span>
      ${e.pay ? `<span class="event-row__aside num">${formatWonShort(e.pay)}</span>` : ''}
    </a>`;
}

export function emptyState({ iconName = 'calendar', title, body = '', action = '' }) {
  return `
    <div class="empty">
      <span class="empty__icon">${icon(iconName, { size: 22 })}</span>
      <p class="empty__title">${esc(title)}</p>
      ${body ? `<p class="empty__body">${esc(body)}</p>` : ''}
      ${action}
    </div>`;
}

export function typeDot(type) {
  return `<span class="type-dot" data-type="${esc(type)}" aria-hidden="true"></span>`;
}
