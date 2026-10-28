import { store } from '../store.js';
import { $, $$, toast, confirmSheet, download } from '../ui.js';
import { icon } from '../icons.js';
import { toIcs } from '../ics.js';
import { todayYmd } from '../dates.js';

const seg = (key, options, value) => `
  <div class="segmented segmented--sm" role="radiogroup">
    ${options.map(([v, label]) => `<button type="button" role="radio" class="segmented__item" data-setting="${key}" data-value="${v}" aria-checked="${String(value) === String(v)}" aria-selected="${String(value) === String(v)}">${label}</button>`).join('')}
  </div>`;

export function render(root) {
  const s = store.settings();
  const count = store.all().length;
  const upcoming = store.all().filter((e) => e.date >= todayYmd()).length;

  root.innerHTML = `
    <header class="page-head page-head--tight">
      <h1 class="title">설정</h1>
    </header>

    <section class="group">
      <h2 class="group__title">표시</h2>
      <div class="group__body">
        <div class="setting"><span class="setting__label">주 시작 요일</span>${seg('weekStart', [[0, '일요일'], [1, '월요일']], s.weekStart)}</div>
        <div class="setting"><span class="setting__label">시간 표시</span>${seg('timeFormat', [['12h', '오전/오후'], ['24h', '24시간']], s.timeFormat)}</div>
        <div class="setting"><span class="setting__label">기본 캘린더 보기</span>${seg('defaultView', [['month', '월'], ['week', '주'], ['day', '일']], s.defaultView)}</div>
      </div>
    </section>

    <section class="group">
      <h2 class="group__title">데이터</h2>
      <div class="group__body">
        <div class="setting setting--stat">
          <span class="setting__label">저장된 일정</span>
          <span class="setting__value num">${count}개 <small>예정 ${upcoming}개</small></span>
        </div>
        <button type="button" class="list-btn" id="export-ics" ${count ? '' : 'disabled'}>${icon('calendar')}<span>전체 일정 캘린더 파일로 내보내기</span><small>.ics</small></button>
        <button type="button" class="list-btn" id="export-json" ${count ? '' : 'disabled'}>${icon('download')}<span>백업 파일 저장</span><small>.json</small></button>
        <label class="list-btn" for="import-json">${icon('upload')}<span>백업 파일 불러오기</span><input type="file" id="import-json" accept="application/json,.json" hidden></label>
        <button type="button" class="list-btn list-btn--danger" id="clear" ${count ? '' : 'disabled'}>${icon('trash')}<span>모든 일정 삭제</span></button>
      </div>
    </section>

    <section class="group">
      <h2 class="group__title">정보</h2>
      <div class="group__body about">
        <p><strong>Slate</strong> <span class="num muted">1.0</span></p>
        <p>붙여넣은 텍스트는 AI나 외부 서버를 거치지 않고 기기 안에서 규칙에 따라 분석해요. 모든 일정은 이 브라우저에만 저장되니 기기를 바꾸기 전에 백업 파일을 저장해 두세요.</p>
        <p class="muted">Safari 공유 버튼 → ‘홈 화면에 추가’로 앱처럼 사용할 수 있어요.</p>
      </div>
    </section>`;

  $$('[data-setting]', root).forEach((b) =>
    b.addEventListener('click', () => {
      const key = b.dataset.setting;
      const value = key === 'weekStart' ? Number(b.dataset.value) : b.dataset.value;
      try {
        store.setSetting(key, value);
      } catch (err) {
        toast(err.message, { kind: 'error' });
        return;
      }
      $$(`[data-setting="${key}"]`, root).forEach((x) => {
        const on = x === b;
        x.setAttribute('aria-checked', String(on));
        x.setAttribute('aria-selected', String(on));
      });
    }),
  );

  const stamp = todayYmd().replace(/-/g, '');
  $('#export-ics', root).addEventListener('click', () => {
    download(`slate-${stamp}.ics`, toIcs(store.all()), 'text/calendar;charset=utf-8');
    toast('캘린더 파일을 만들었어요', { kind: 'success' });
  });
  $('#export-json', root).addEventListener('click', () => {
    download(`slate-backup-${stamp}.json`, store.exportJson(), 'application/json');
    toast('백업 파일을 저장했어요', { kind: 'success' });
  });
  $('#import-json', root).addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const added = store.importJson(await file.text());
      toast(added ? `일정 ${added}개를 불러왔어요` : '새로 추가된 일정이 없어요', { kind: 'success' });
      render(root);
    } catch (err) {
      toast(err.message || '불러오지 못했어요', { kind: 'error' });
    }
  });
  $('#clear', root).addEventListener('click', async () => {
    const ok = await confirmSheet({ title: '모든 일정을 삭제할까요?', message: `저장된 일정 ${count}개가 모두 삭제되며 되돌릴 수 없어요. 필요하다면 먼저 백업 파일을 저장해 주세요.`, confirm: '모두 삭제', danger: true });
    if (!ok) return;
    try {
      store.clear();
    } catch (err) {
      toast(err.message, { kind: 'error' });
      return;
    }
    toast('모든 일정을 삭제했어요');
    render(root);
  });
}
