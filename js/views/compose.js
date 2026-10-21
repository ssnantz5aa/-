import { session } from '../store.js';
import { esc, $, toast } from '../ui.js';
import { icon } from '../icons.js';
import { analyzeAndReview, readClipboard, startManual } from '../analyze.js';

const SAMPLE = `[촬영 안내] 나이키 러닝화 광고
일시: 10월 29일(목) 오전 9시 ~ 오후 6시
집합: 8시 30분
장소: 서울 성동구 성수이로 113, 3층 스튜디오
담당: 김민지 실장 010-1234-5678
에이전시: 모노 에이전시
페이: 25만원 (3.3% 공제)
준비물: 블랙 정장, 구두
특이사항: 30분 전 도착 부탁드립니다`;

export function render(root) {
  const text = session.get('compose') || '';

  root.innerHTML = `
    <header class="page-head">
      <h1 class="title">새 일정</h1>
      <p class="page-head__desc">메시지, 메일, 공지에서 일정이 담긴 부분을 그대로 붙여넣으세요. 기기 안에서 규칙에 따라 분석하며 외부로 전송하지 않아요.</p>
    </header>

    <section class="compose" id="compose">
      <div class="compose__field">
        <div class="composer__progress" aria-hidden="true"></div>
        <textarea id="compose-text" class="compose__input" placeholder="예) 10월 29일(목) 오전 9시 성수 스튜디오 촬영&#10;담당 김민지 실장 010-1234-5678&#10;페이 25만원" spellcheck="false" aria-label="일정 텍스트">${esc(text)}</textarea>
        <div class="compose__meta">
          <span class="num" id="compose-count"></span>
          <button type="button" class="link-btn" id="compose-clear" ${text ? '' : 'hidden'}>지우기</button>
        </div>
      </div>
      <div class="compose__tools">
        <button type="button" class="btn btn--secondary" id="compose-paste">${icon('clipboard', { size: 18 })}<span>붙여넣기</span></button>
        <button type="button" class="btn btn--ghost" id="compose-sample">${icon('text', { size: 18 })}<span>예시 넣기</span></button>
      </div>
    </section>

    <div class="tips">
      <p class="tips__title">이렇게 적혀 있으면 더 정확해요</p>
      <ul class="tips__list">
        <li><span class="tips__key">일시</span><span>10월 29일 오후 2시 ~ 6시, 10/29 14:00</span></li>
        <li><span class="tips__key">장소</span><span>장소: 서울 성동구 성수이로 113</span></li>
        <li><span class="tips__key">연락처</span><span>담당 김민지 010-1234-5678</span></li>
        <li><span class="tips__key">페이</span><span>페이 25만원, 250,000원</span></li>
      </ul>
    </div>

    <div class="action-bar action-bar--tabbed">
      <button type="button" class="btn btn--text" id="compose-manual">직접 입력</button>
      <button type="button" class="btn btn--primary btn--lg btn--grow" id="compose-analyze"><span>일정 분석</span>${icon('arrowRight', { size: 18 })}</button>
    </div>`;

  const input = $('#compose-text', root);
  const count = $('#compose-count', root);
  const clear = $('#compose-clear', root);
  const analyze = $('#compose-analyze', root);
  const wrap = $('#compose', root);

  const sync = () => {
    const v = input.value;
    const lines = v.trim() ? v.trim().split('\n').length : 0;
    count.textContent = v.trim() ? `${lines}줄 · ${v.length.toLocaleString()}자` : '';
    clear.hidden = !v;
    analyze.disabled = !v.trim();
    session.set('compose', v);
  };
  input.addEventListener('input', sync);
  sync();
  if (!text) setTimeout(() => input.focus({ preventScroll: true }), 50);

  $('#compose-paste', root).addEventListener('click', async () => {
    const t = await readClipboard();
    if (t == null) return input.focus();
    input.value = t;
    sync();
  });
  $('#compose-sample', root).addEventListener('click', () => {
    input.value = SAMPLE;
    sync();
  });
  clear.addEventListener('click', () => {
    input.value = '';
    sync();
    input.focus();
  });
  $('#compose-manual', root).addEventListener('click', () => startManual());
  analyze.addEventListener('click', () =>
    analyzeAndReview(input.value, {
      onStart: () => {
        wrap.classList.add('is-busy');
        analyze.disabled = true;
        input.readOnly = true;
        analyze.querySelector('span').textContent = '분석 중';
      },
      onEnd: () => {
        wrap.classList.remove('is-busy');
        input.readOnly = false;
      },
    }),
  );
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!analyze.disabled) analyze.click();
      else toast('분석할 텍스트를 먼저 입력해 주세요');
    }
  });
}
