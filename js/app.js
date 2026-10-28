import { store } from './store.js';
import { icon } from './icons.js';
import { toast } from './ui.js';
import * as home from './views/home.js';
import * as compose from './views/compose.js';
import * as review from './views/review.js';
import * as detail from './views/detail.js';
import * as calendar from './views/calendar.js';
import * as search from './views/search.js';
import * as settings from './views/settings.js';
import * as pay from './views/pay.js';

const TABS = [
  { id: 'home', label: '홈', icon: 'home', href: '#/home' },
  { id: 'calendar', label: '캘린더', icon: 'calendar', href: '#/calendar' },
  { id: 'add', label: '일정 추가', icon: 'plus', href: '#/add', primary: true },
  { id: 'pay', label: '페이', icon: 'wallet', href: '#/pay' },
  { id: 'settings', label: '설정', icon: 'settings', href: '#/settings' },
];

function match(hash) {
  const [path, qs = ''] = hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const query = new URLSearchParams(qs);
  const [a, b, c] = parts;
  if (!a || a === 'home') return { view: home, tab: 'home', query };
  if (a === 'add') return { view: compose, tab: 'add', query };
  if (a === 'review') return { view: review, tab: 'add', query, flow: true };
  if (a === 'calendar') return { view: calendar, tab: 'calendar', query };
  if (a === 'search') return { view: search, tab: 'calendar', query };
  if (a === 'pay') return { view: pay, tab: 'pay', query };
  if (a === 'settings') return { view: settings, tab: 'settings', query };
  if (a === 'event' && b && c === 'edit') return { view: review, tab: 'calendar', query, params: { id: b }, flow: true };
  if (a === 'event' && b) return { view: detail, tab: query.get('from') === 'pay' ? 'pay' : 'calendar', query, params: { id: b } };
  return { view: home, tab: 'home', query };
}

const tabbar = document.getElementById('tabbar');
const main = document.getElementById('view');

tabbar.innerHTML = TABS.map(
  (t) => `<a class="tab ${t.primary ? 'tab--primary' : ''}" href="${t.href}" data-tab="${t.id}"><span class="tab__icon">${icon(t.icon, { size: t.primary ? 20 : 22 })}</span><span class="tab__label">${t.label}</span></a>`,
).join('');

let lastHash = '';
function route() {
  const hash = location.hash || '#/home';
  const r = match(hash);
  const samePage = lastHash.split('?')[0] === hash.split('?')[0];
  lastHash = hash;

  document.body.classList.toggle('is-flow', !!r.flow);
  tabbar.querySelectorAll('.tab').forEach((el) => {
    const on = el.dataset.tab === r.tab;
    el.classList.toggle('is-active', on);
    if (on) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });

  main.classList.remove('is-entering');
  void main.offsetWidth;
  main.classList.add('is-entering');
  try {
    r.view.render(main, { query: r.query, ...(r.params || {}) });
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="empty"><span class="empty__icon">${icon('alert', { size: 22 })}</span><p class="empty__title">화면을 불러오지 못했어요</p><p class="empty__body">새로고침하거나 홈으로 이동해 주세요.</p><a class="btn btn--secondary" href="#/home">홈으로</a></div>`;
  }
  if (!samePage) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

if (store.loadError) toast('저장된 데이터를 읽지 못해 새로 시작했어요. 이전 데이터는 별도로 보관했어요.', { kind: 'error', duration: 5000 });

// 다른 탭에서 데이터가 바뀌면 현재 화면을 다시 그린다(입력 중인 화면 제외).
window.addEventListener('storage', (e) => {
  if (e.key === 'slate.v1' && !document.body.classList.contains('is-flow')) location.reload();
});
