import { store } from '../store.js';
import { esc, $, toast } from '../ui.js';
import { swipeWrap, enableSwipeDelete } from '../swipe.js';
import { icon } from '../icons.js';
import { eventRow, eventRowDated, emptyState } from '../components.js';
import { WEEKDAYS, todayYmd, toYmd, addDays, formatDateMedium, toMinutes } from '../dates.js';

function greeting(h) {
  if (h < 5) return '늦은 밤이에요';
  if (h < 11) return '좋은 아침이에요';
  if (h < 17) return '좋은 오후예요';
  return '편안한 저녁이에요';
}

export function render(root) {
  const now = new Date();
  const today = todayYmd();
  const todays = store.byDate(today);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next = todays.find((e) => (e.startTime || e.callTime) && toMinutes(e.endTime || e.startTime || e.callTime) >= nowMin);
  const upcoming = store.upcoming(toYmd(addDays(now, 1)), 5);

  const summary = todays.length
    ? next
      ? `오늘 일정 ${todays.length}개 중 다음은 <strong>${esc(next.title)}</strong>`
      : `오늘 일정 ${todays.length}개를 모두 지났어요`
    : '오늘은 예정된 일정이 없어요';

  root.innerHTML = `
    <header class="home-head">
      <div class="home-head__top">
        <p class="eyebrow">${greeting(now.getHours())}</p>
        <a class="icon-btn home-head__search" href="#/search" aria-label="일정 검색">${icon('search')}</a>
      </div>
      <h1 class="display">${now.getMonth() + 1}월 ${now.getDate()}일 <span class="display__sub">${WEEKDAYS[now.getDay()]}요일</span></h1>
      <p class="home-head__summary">${summary}</p>
    </header>

    <section class="section">
      <div class="section__head">
        <h2 class="section__title">오늘</h2>
        <span class="section__count num">${todays.length ? `${todays.length}건` : ''}</span>
      </div>
      ${
        todays.length
          ? `<div class="list">${todays.map((e) => eventRow(e)).join('')}</div>`
          : emptyState({ iconName: 'sun', title: '오늘은 비어 있어요', body: '아래 ‘일정 추가’에서 받은 메시지를 붙여넣어 등록할 수 있어요.' })
      }
    </section>

    ${
      upcoming.length
        ? `<section class="section">
            <div class="section__head">
              <h2 class="section__title">다가오는 일정</h2>
              <a class="section__link" href="#/calendar">캘린더 ${icon('chevronRight', { size: 16 })}</a>
            </div>
            <div class="list" id="upcoming-list">${groupUpcoming(upcoming, today)}</div>
          </section>`
        : ''
    }`;

  // 다가오는 일정: 왼쪽으로 밀면 삭제
  const upList = $('#upcoming-list', root);
  if (upList) {
    enableSwipeDelete(upList, {
      onDelete: (id, el) => {
        const e = store.get(id);
        if (!e) return;
        el.classList.add('is-removing');
        setTimeout(() => {
          try {
            store.remove(id);
          } catch (err) {
            toast(err.message, { kind: 'error' });
            render(root);
            return;
          }
          render(root);
          toast(`‘${e.title}’ 삭제했어요`, {
            action: '실행 취소',
            onAction: () => {
              try {
                store.restore(e);
              } catch (err) {
                toast(err.message, { kind: 'error' });
              }
              const onHome = !location.hash || location.hash === '#/' || location.hash.startsWith('#/home');
              if (root.isConnected && onHome) render(root);
            },
          });
        }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
      },
    });
  }
}

function groupUpcoming(list, today) {
  let lastMonth = '';
  return list
    .map((e, i) => {
      const label = e.date.slice(0, 7);
      const head = label !== lastMonth && lastMonth ? `<div class="list__divider">${formatDateMedium(e.date).replace(/\s*\d+일.*/, '')}</div>` : '';
      lastMonth = label;
      return head + swipeWrap(e.id, eventRowDated(e, { today, repeat: !head && list[i - 1]?.date === e.date }));
    })
    .join('');
}
