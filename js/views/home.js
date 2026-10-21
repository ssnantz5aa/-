import { store, session } from '../store.js';
import { esc, $, autoGrow } from '../ui.js';
import { icon } from '../icons.js';
import { eventRow, eventRowDated, emptyState } from '../components.js';
import { WEEKDAYS, todayYmd, toYmd, addDays, formatDateMedium, toMinutes } from '../dates.js';
import { analyzeAndReview, readClipboard } from '../analyze.js';

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
  const compose = session.get('compose') || '';

  const summary = todays.length
    ? next
      ? `오늘 일정 ${todays.length}개 중 다음은 <strong>${esc(next.title)}</strong>`
      : `오늘 일정 ${todays.length}개를 모두 지났어요`
    : '오늘은 예정된 일정이 없어요';

  root.innerHTML = `
    <header class="home-head">
      <p class="eyebrow">${greeting(now.getHours())}</p>
      <h1 class="display">${now.getMonth() + 1}월 ${now.getDate()}일 <span class="display__sub">${WEEKDAYS[now.getDay()]}요일</span></h1>
      <p class="home-head__summary">${summary}</p>
    </header>

    <section class="composer" id="composer" aria-label="일정 텍스트 붙여넣기">
      <div class="composer__progress" aria-hidden="true"></div>
      <label class="composer__label" for="quick-text">일정 텍스트 붙여넣기</label>
      <textarea id="quick-text" class="composer__input" rows="3" placeholder="받은 메시지나 메일을 그대로 붙여넣으세요.&#10;날짜, 시간, 장소, 연락처, 페이를 찾아 정리해 드려요." spellcheck="false">${esc(compose)}</textarea>
      <div class="composer__bar">
        <button type="button" class="btn btn--ghost" id="quick-paste">${icon('clipboard', { size: 18 })}<span>붙여넣기</span></button>
        <button type="button" class="btn btn--primary" id="quick-analyze" ${compose.trim() ? '' : 'disabled'}><span>일정 분석</span>${icon('arrowRight', { size: 18 })}</button>
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <h2 class="section__title">오늘</h2>
        <span class="section__count num">${todays.length ? `${todays.length}건` : ''}</span>
      </div>
      ${
        todays.length
          ? `<div class="list">${todays.map((e) => eventRow(e)).join('')}</div>`
          : emptyState({ iconName: 'sun', title: '오늘은 비어 있어요', body: '위에 일정 텍스트를 붙여넣어 바로 등록할 수 있어요.' })
      }
    </section>

    ${
      upcoming.length
        ? `<section class="section">
            <div class="section__head">
              <h2 class="section__title">다가오는 일정</h2>
              <a class="section__link" href="#/calendar">캘린더 ${icon('chevronRight', { size: 16 })}</a>
            </div>
            <div class="list">${groupUpcoming(upcoming, today)}</div>
          </section>`
        : ''
    }`;

  const input = $('#quick-text', root);
  const analyzeBtn = $('#quick-analyze', root);
  const composer = $('#composer', root);
  autoGrow(input);
  const sync = () => {
    analyzeBtn.disabled = !input.value.trim();
    session.set('compose', input.value);
  };
  input.addEventListener('input', sync);

  $('#quick-paste', root).addEventListener('click', async () => {
    const text = await readClipboard();
    if (text == null) return input.focus();
    input.value = text;
    input.dispatchEvent(new Event('input'));
  });

  analyzeBtn.addEventListener('click', () =>
    analyzeAndReview(input.value, {
      onStart: () => {
        composer.classList.add('is-busy');
        analyzeBtn.disabled = true;
        analyzeBtn.querySelector('span').textContent = '분석 중';
      },
      onEnd: () => composer.classList.remove('is-busy'),
    }),
  );
}

function groupUpcoming(list, today) {
  let lastMonth = '';
  return list
    .map((e, i) => {
      const label = e.date.slice(0, 7);
      const head = label !== lastMonth && lastMonth ? `<div class="list__divider">${formatDateMedium(e.date).replace(/\s*\d+일.*/, '')}</div>` : '';
      lastMonth = label;
      return head + eventRowDated(e, { today, repeat: !head && list[i - 1]?.date === e.date });
    })
    .join('');
}
