import { store, session, sortEvents } from '../store.js';
import { esc, $, $$ } from '../ui.js';
import { icon } from '../icons.js';
import { eventRowDated, emptyState } from '../components.js';
import { todayYmd } from '../dates.js';

const FIELDS = ['title', 'location', 'contactName', 'phone', 'agency', 'notes', 'memo', 'payNote', 'raw'];
const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, '');

export function render(root) {
  const saved = session.get('search') || { q: '', type: 'all', scope: 'upcoming' };
  let { q, scope } = saved;

  root.innerHTML = `
    <header class="page-head page-head--tight">
      <h1 class="title">검색</h1>
    </header>
    <div class="search-box">
      ${icon('search', { size: 20 })}
      <input type="search" id="q" class="search-box__input" placeholder="제목, 장소, 담당자, 에이전시" value="${esc(q)}" autocomplete="off" enterkeyhint="search" aria-label="일정 검색">
      <button type="button" class="icon-btn icon-btn--sm" id="q-clear" aria-label="검색어 지우기" ${q ? '' : 'hidden'}>${icon('x', { size: 16 })}</button>
    </div>
    <div class="scope" role="group" aria-label="기간">
      <button type="button" class="scope__btn" data-scope="upcoming" aria-pressed="${scope === 'upcoming'}">예정</button>
      <button type="button" class="scope__btn" data-scope="past" aria-pressed="${scope === 'past'}">지난 일정</button>
      <button type="button" class="scope__btn" data-scope="all" aria-pressed="${scope === 'all'}">전체 기간</button>
    </div>
    <div id="results" class="results" aria-live="polite"></div>`;

  const input = $('#q', root);
  const results = $('#results', root);

  const draw = () => {
    session.set('search', { q, scope });
    const today = todayYmd();
    const terms = q.trim().split(/\s+/).filter(Boolean).map(norm);
    let list = store.all().filter((e) => {
      if (scope === 'upcoming' && (e.date || '') < today) return false;
      if (scope === 'past' && (e.date || '') >= today) return false;
      if (!terms.length) return true;
      const hay = norm(FIELDS.map((f) => e[f]).join(' '));
      return terms.every((t) => hay.includes(t));
    });
    list = sortEvents([...list]);
    if (scope === 'past') list.reverse();

    if (!store.all().length) {
      results.innerHTML = emptyState({ iconName: 'search', title: '아직 등록된 일정이 없어요', body: '일정을 등록하면 이곳에서 찾아볼 수 있어요.', action: '<a class="btn btn--primary" href="#/add">일정 추가</a>' });
      return;
    }
    if (!list.length) {
      results.innerHTML = emptyState({
        iconName: 'search',
        title: q ? `‘${q}’에 맞는 일정이 없어요` : '조건에 맞는 일정이 없어요',
        body: scope !== 'all' ? '기간을 ‘전체 기간’으로 바꿔 보세요.' : '다른 검색어로 찾아보세요.',
      });
      return;
    }

    const highlight = (text) => {
      let html = esc(text);
      for (const t of q.trim().split(/\s+/).filter(Boolean)) {
        const re = new RegExp(`(${esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        html = html.replace(re, '<mark>$1</mark>');
      }
      return html;
    };

    let month = '';
    const rows = list.map((e, i) => {
      const m = (e.date || '').slice(0, 7);
      const head = m !== month ? `<div class="list__divider">${m ? `${Number(m.slice(0, 4))}년 ${Number(m.slice(5))}월` : '날짜 미정'}</div>` : '';
      month = m;
      return head + eventRowDated(e, { highlight, today, repeat: !head && list[i - 1]?.date === e.date });
    });
    results.innerHTML = `<p class="results__count"><span class="num">${list.length}</span>개의 일정</p><div class="list">${rows.join('')}</div>`;
  };

  let timer;
  input.addEventListener('input', () => {
    q = input.value;
    $('#q-clear', root).hidden = !q;
    clearTimeout(timer);
    timer = setTimeout(draw, 80);
  });
  input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
  $('#q-clear', root).addEventListener('click', () => {
    input.value = '';
    q = '';
    $('#q-clear', root).hidden = true;
    draw();
    input.focus();
  });
  $$('[data-scope]', root).forEach((b) =>
    b.addEventListener('click', () => {
      scope = b.dataset.scope;
      $$('[data-scope]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      draw();
    }),
  );
  draw();
}
