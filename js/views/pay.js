import { store } from '../store.js';
import { esc, $, $$, toast } from '../ui.js';
import { icon } from '../icons.js';
import { emptyState } from '../components.js';
import { fromYmd, diffDays, todayYmd, addDays, toYmd, WEEKDAYS, formatDateMedium } from '../dates.js';
import { formatWon, formatWonShort } from '../parser.js';

const RECENT_DAYS = 30; // 입금 확인 후 이 기간까지는 '입금 완료'를 뚜렷하게 보여 준다.

// 화면을 다시 그려도 펼친 상태를 유지한다.
const state = { showOld: false, showUpcoming: false };

/** 미입금 정렬 기준일: 지급일, 없으면 일정 날짜 */
const keyDate = (e) => e.payDate || e.date || '9999-12-31';

/**
 * 페이 목록을 나눈다.
 * - unpaid: 일정 날짜가 오늘이거나 지난 미입금 건. 지급일이 지난 건(지연)이 맨 위, 나머지는 기준일이 가까운 순.
 * - upcoming: 아직 진행 전인 일정의 페이
 * - recent / old: 입금 완료(최신순), 30일 이내와 그 이전
 */
export function groupPays(events, today = todayYmd()) {
  const withPay = events.filter((e) => e.pay != null);
  const unpaid = [];
  const upcoming = [];
  const paid = [];
  for (const e of withPay) {
    if (e.paid === true) paid.push(e);
    else if (!e.date || e.date <= today) unpaid.push(e);
    else upcoming.push(e);
  }
  const overdue = (e) => !!e.payDate && e.payDate < today;
  unpaid.sort((a, b) => Number(overdue(b)) - Number(overdue(a)) || keyDate(a).localeCompare(keyDate(b)));
  upcoming.sort((a, b) => keyDate(a).localeCompare(keyDate(b)));
  paid.sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const cutoff = toYmd(addDays(fromYmd(today), -RECENT_DAYS));
  return {
    unpaid,
    upcoming,
    recent: paid.filter((e) => (e.paidAt || today) >= cutoff),
    old: paid.filter((e) => (e.paidAt || today) < cutoff),
    overdue,
  };
}

const sum = (list) => list.reduce((n, e) => n + (Number(e.pay) || 0), 0);

function dueBadge(e, today) {
  if (!e.payDate) return '<span class="pay-badge pay-badge--none">지급일 미정</span>';
  const n = diffDays(fromYmd(e.payDate), fromYmd(today));
  if (n < 0) return `<span class="pay-badge pay-badge--late">지연 <span class="num">${-n}</span>일</span>`;
  if (n === 0) return '<span class="pay-badge pay-badge--today">오늘 지급</span>';
  return `<span class="pay-badge">D-<span class="num">${n}</span></span>`;
}

function dateCol(ymd, today) {
  if (!ymd) return '<span class="pay-row__date"><span class="num">–</span><small>미정</small></span>';
  const d = fromYmd(ymd);
  return `<span class="pay-row__date ${ymd === today ? 'is-today' : ''}">
    <small class="pay-row__month num">${d.getMonth() + 1}월</small>
    <span class="num">${d.getDate()}</span>
    <small>${ymd === today ? '오늘' : WEEKDAYS[d.getDay()]}</small>
  </span>`;
}

function payRow(e, today, { mode }) {
  const paid = mode === 'paid';
  const shownDate = paid ? e.paidAt : mode === 'unpaid' || mode === 'upcoming' ? e.payDate || e.date : e.date;
  const meta = [
    e.contactName ? `<span class="pay-row__who">${esc(e.contactName)}</span>` : '<span class="muted">실장 미정</span>',
    e.date ? `<span class="num">일정 ${formatDateMedium(e.date).replace(/^\d+년\s*/, '')}</span>` : '',
  ].filter(Boolean).join('<span class="dot-sep" aria-hidden="true"></span>');
  const status = paid
    ? `<span class="pay-badge pay-badge--paid">${icon('check', { size: 12 })}입금 완료</span>`
    : mode === 'unpaid'
      ? dueBadge(e, today)
      : e.payDate ? `<span class="pay-badge">지급 ${formatDateMedium(e.payDate).replace(/^\d+년\s*/, '')}</span>` : '<span class="pay-badge pay-badge--none">지급일 미정</span>';
  return `
    <div class="pay-row ${paid ? 'is-paid' : ''} ${mode === 'unpaid' && e.payDate && e.payDate < today ? 'is-late' : ''}" data-row="${esc(e.id)}">
      ${dateCol(shownDate, today)}
      <a class="pay-row__body" href="#/event/${esc(e.id)}?from=pay">
        <span class="pay-row__title">${esc(e.title)}</span>
        <span class="pay-row__meta">${meta}</span>
        <span class="pay-row__status">${status}${e.tax ? `<span class="pay-row__tax">${esc(e.tax)}</span>` : ''}</span>
      </a>
      <div class="pay-row__side">
        <span class="pay-row__amount num">${formatWonShort(e.pay) || formatWon(e.pay)}</span>
        <button type="button" class="paid-check ${paid ? 'is-on' : ''}" data-toggle="${esc(e.id)}" aria-pressed="${paid}" aria-label="${paid ? '입금 완료 취소' : '입금 완료로 표시'}">
          ${icon('check', { size: 18 })}
        </button>
      </div>
    </div>`;
}

export function render(root) {
  const today = todayYmd();
  const all = store.all();
  const g = groupPays(all, today);
  const late = g.unpaid.filter(g.overdue);
  const hasAny = g.unpaid.length + g.upcoming.length + g.recent.length + g.old.length > 0;

  root.innerHTML = `
    <header class="page-head page-head--tight">
      <h1 class="title">페이</h1>
    </header>

    ${
      hasAny
        ? `<div class="pay-summary">
            <div class="pay-summary__main">
              <span class="pay-summary__label">아직 안 들어온 페이</span>
              <span class="pay-summary__amount num">${formatWon(sum(g.unpaid))}</span>
            </div>
            <div class="pay-summary__facts">
              <span><span class="num">${g.unpaid.length}</span>건</span>
              ${late.length ? `<span class="is-late">지연 <span class="num">${late.length}</span>건</span>` : ''}
              <span>최근 30일 입금 <span class="num">${formatWonShort(sum(g.recent)) || '0원'}</span></span>
            </div>
          </div>`
        : ''
    }

    ${
      !hasAny
        ? emptyState({ iconName: 'wallet', title: '페이가 적힌 일정이 없어요', body: '일정에 페이를 넣으면 이곳에서 입금 여부를 관리할 수 있어요.', action: '<a class="btn btn--primary" href="#/add">일정 추가</a>' })
        : `
    <section class="section section--first">
      <div class="section__head">
        <h2 class="section__title">미입금</h2>
        <span class="section__count">지급일 가까운 순</span>
      </div>
      ${
        g.unpaid.length
          ? `<div class="pay-list">${g.unpaid.map((e) => payRow(e, today, { mode: 'unpaid' })).join('')}</div>`
          : `<p class="pay-empty">${icon('check', { size: 16 })}<span>받을 페이를 모두 받았어요</span></p>`
      }
      ${
        g.upcoming.length
          ? `<button type="button" class="more-btn" id="toggle-upcoming" aria-expanded="${state.showUpcoming}">
              <span>진행 전 일정 페이 <span class="num">${g.upcoming.length}</span>건 · <span class="num">${formatWonShort(sum(g.upcoming))}</span></span>${icon('chevronDown', { size: 16, cls: 'more-btn__chev' })}
            </button>
            <div class="pay-list" ${state.showUpcoming ? '' : 'hidden'}>${g.upcoming.map((e) => payRow(e, today, { mode: 'upcoming' })).join('')}</div>`
          : ''
      }
    </section>

    <section class="section">
      <div class="section__head">
        <h2 class="section__title">입금 완료</h2>
        <span class="section__count">최신순</span>
      </div>
      ${
        g.recent.length
          ? `<div class="pay-list">${g.recent.map((e) => payRow(e, today, { mode: 'paid' })).join('')}</div>`
          : '<p class="pay-empty pay-empty--muted"><span>최근 30일 동안 입금 완료로 표시한 페이가 없어요</span></p>'
      }
      ${
        g.old.length
          ? `<button type="button" class="more-btn" id="toggle-old" aria-expanded="${state.showOld}">
              <span>${state.showOld ? '이전 내역 접기' : '이전 내역 보기'} <span class="num">${g.old.length}</span>건</span>${icon('chevronDown', { size: 16, cls: 'more-btn__chev' })}
            </button>
            <div class="pay-list pay-list--old" ${state.showOld ? '' : 'hidden'}>${g.old.map((e) => payRow(e, today, { mode: 'old' })).join('')}</div>`
          : ''
      }
    </section>`
    }`;

  $('#toggle-old', root)?.addEventListener('click', () => {
    state.showOld = !state.showOld;
    render(root);
  });
  $('#toggle-upcoming', root)?.addEventListener('click', () => {
    state.showUpcoming = !state.showUpcoming;
    render(root);
  });

  $$('[data-toggle]', root).forEach((b) =>
    b.addEventListener('click', () => {
      const e = store.get(b.dataset.toggle);
      if (!e) return;
      const prev = { paid: e.paid === true, paidAt: e.paidAt || null };
      try {
        store.setPaid(e.id, !prev.paid);
      } catch (err) {
        toast(err.message, { kind: 'error' });
        return;
      }
      render(root);
      toast(prev.paid ? `‘${e.title}’ 미입금으로 되돌렸어요` : `‘${e.title}’ 입금 완료`, {
        kind: 'success',
        action: '실행 취소',
        onAction: () => {
          try {
            store.update(e.id, prev);
          } catch (err) {
            toast(err.message, { kind: 'error' });
          }
          render(root);
        },
      });
    }),
  );
}
