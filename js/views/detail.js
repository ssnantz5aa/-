import { store, session } from '../store.js';
import { esc, $, toast, confirmSheet, download, go } from '../ui.js';
import { icon } from '../icons.js';
import { formatDateLong, formatTime, formatTimeRange, relativeLabel, todayYmd } from '../dates.js';
import { formatWon, formatWonShort } from '../parser.js';
import { typeLabel } from '../types.js';
import { emptyState } from '../components.js';
import { toIcs } from '../ics.js';

const row = (iconName, label, body) => `
  <div class="info-row">
    <span class="info-row__icon">${icon(iconName)}</span>
    <div class="info-row__main">
      <span class="info-row__label">${label}</span>
      ${body}
    </div>
  </div>`;

export function render(root, { id }) {
  const e = store.get(id);
  if (!e) {
    root.innerHTML = `
      <header class="topbar"><a class="topbar__back" href="#/calendar">${icon('chevronLeft')}<span>캘린더</span></a></header>
      ${emptyState({ iconName: 'alert', title: '일정을 찾을 수 없어요', body: '이미 삭제되었을 수 있어요.', action: '<a class="btn btn--secondary" href="#/calendar">캘린더로 이동</a>' })}`;
    return;
  }
  const fmt = store.settings().timeFormat;
  const rel = e.date ? relativeLabel(e.date) : '';
  const isPast = e.date && e.date < todayYmd();
  const mapUrl = e.location ? `https://map.naver.com/p/search/${encodeURIComponent(e.location.split('\n')[0])}` : '';
  const tel = e.phone ? e.phone.replace(/[^\d+]/g, '') : '';

  root.innerHTML = `
    <header class="topbar">
      <a class="topbar__back" href="#/calendar?date=${esc(e.date || '')}">${icon('chevronLeft')}<span>캘린더</span></a>
      <span class="topbar__spacer"></span>
      <a class="btn btn--text" href="#/event/${esc(e.id)}/edit">${icon('edit', { size: 18 })}<span>수정</span></a>
    </header>

    <article class="detail" data-type="${esc(e.type)}">
      <div class="detail__head">
        <p class="detail__type"><span class="type-dot" data-type="${esc(e.type)}"></span>${typeLabel(e.type)}${rel ? `<span class="dot-sep"></span><span class="${isPast ? 'muted' : 'accent'}">${rel}</span>` : ''}</p>
        <h1 class="detail__title">${esc(e.title)}</h1>
        <p class="detail__date">${e.date ? formatDateLong(e.date) : '날짜 미정'}</p>
        <p class="detail__time num">${e.startTime ? formatTimeRange(e.startTime, e.endTime, fmt) : '시간 미정'}</p>
        ${e.callTime ? `<p class="detail__call">${icon('flag', { size: 16 })}<span>집합 <span class="num">${formatTime(e.callTime, fmt)}</span></span></p>` : ''}
      </div>

      <div class="info">
        ${e.location ? row('pin', '장소', `<p class="info-row__value pre">${esc(e.location)}</p><div class="info-row__actions"><a class="chip-btn" href="${mapUrl}" target="_blank" rel="noopener">${icon('map', { size: 16 })}지도</a><button type="button" class="chip-btn" data-copy="${esc(e.location)}">${icon('copy', { size: 16 })}복사</button></div>`) : ''}
        ${
          e.contactName || e.phone
            ? row('user', '연락처', `
                ${e.contactName ? `<p class="info-row__value">${esc(e.contactName)}</p>` : ''}
                ${e.phone ? `<p class="info-row__value num phone">${esc(e.phone)}</p><div class="info-row__actions"><a class="chip-btn" href="tel:${esc(tel)}">${icon('phone', { size: 16 })}전화</a><a class="chip-btn" href="sms:${esc(tel)}">${icon('message', { size: 16 })}문자</a><button type="button" class="chip-btn" data-copy="${esc(e.phone)}">${icon('copy', { size: 16 })}복사</button></div>` : ''}`)
            : ''
        }
        ${e.agency ? row('building', '에이전시', `<p class="info-row__value">${esc(e.agency)}</p>`) : ''}
        ${
          e.pay != null || e.payNote
            ? row('won', '페이', `
                ${e.pay != null ? `<p class="info-row__value amount num">${formatWon(e.pay)}<span class="amount__short">${formatWonShort(e.pay) !== formatWon(e.pay) ? formatWonShort(e.pay) : ''}</span></p>` : ''}
                ${e.payNote ? `<p class="info-row__sub">${esc(e.payNote)}</p>` : ''}`)
            : ''
        }
        ${e.notes ? row('note', '특이사항', `<p class="info-row__value pre">${esc(e.notes)}</p>`) : ''}
        ${!e.location && !e.phone && !e.contactName && !e.agency && e.pay == null && !e.notes ? `<p class="info__empty">추가 정보가 없어요. <a href="#/event/${esc(e.id)}/edit">항목 추가하기</a></p>` : ''}
      </div>

      ${
        e.raw
          ? `<details class="raw">
              <summary>${icon('text', { size: 16 })}<span>원문 보기</span><span class="raw__count num">${e.raw.trim().split('\n').length}줄</span>${icon('chevronDown', { size: 16, cls: 'raw__chev' })}</summary>
              <pre class="raw__body">${esc(e.raw)}</pre>
            </details>`
          : ''
      }

      <div class="detail__actions">
        <button type="button" class="list-btn" id="export">${icon('download')}<span>iPhone 캘린더로 내보내기</span><small>.ics</small></button>
        <button type="button" class="list-btn" id="duplicate">${icon('copy')}<span>복제해서 새 일정 만들기</span></button>
        <button type="button" class="list-btn list-btn--danger" id="delete">${icon('trash')}<span>일정 삭제</span></button>
      </div>
      <p class="detail__stamp">등록 ${new Date(e.createdAt).toLocaleDateString('ko-KR')}${e.updatedAt !== e.createdAt ? ` · 수정 ${new Date(e.updatedAt).toLocaleDateString('ko-KR')}` : ''}</p>
    </article>`;

  root.querySelectorAll('[data-copy]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        toast('복사했어요', { kind: 'success' });
      } catch {
        toast('복사하지 못했어요', { kind: 'error' });
      }
    }),
  );

  $('#export', root).addEventListener('click', () => {
    download(`${e.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || 'schedule'}.ics`, toIcs([e]), 'text/calendar;charset=utf-8');
    toast('캘린더 파일을 만들었어요', { kind: 'success' });
  });

  $('#duplicate', root).addEventListener('click', () => {
    const { id: _id, createdAt, updatedAt, ...rest } = e;
    session.set('draft', { ...rest, uncertain: {}, source: 'manual' });
    go('#/review');
  });

  $('#delete', root).addEventListener('click', async () => {
    const ok = await confirmSheet({ title: '이 일정을 삭제할까요?', message: `‘${e.title}’ 일정이 이 기기에서 삭제돼요.`, confirm: '삭제', danger: true });
    if (!ok) return;
    try {
      store.remove(e.id);
    } catch (err) {
      toast(err.message, { kind: 'error' });
      return;
    }
    toast('일정을 삭제했어요', { action: '실행 취소', onAction: () => store.restore(e) });
    go(`#/calendar?date=${e.date || ''}`);
  });
}
