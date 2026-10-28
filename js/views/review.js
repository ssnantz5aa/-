import { store, session } from '../store.js';
import { esc, $, $$, autoGrow, toast, confirmSheet, go } from '../ui.js';
import { icon } from '../icons.js';
import { formatDateMedium, formatTime } from '../dates.js';
import { formatPhone, formatWonShort, countFields } from '../parser.js';
import { emptyState } from '../components.js';
import { openInDeviceCalendar } from '../ics.js';

// 선택 입력 항목. 값이 없으면 숨기고 '추가' 칩으로만 보여 준다.
const OPTIONAL = [
  { key: 'location', label: '장소', icon: 'pin' },
  { key: 'contact', label: '연락처', icon: 'user' },
  { key: 'agency', label: '에이전시', icon: 'building' },
  { key: 'pay', label: '페이', icon: 'won' },
  { key: 'notes', label: '특이사항', icon: 'note' },
  { key: 'callTime', label: '집합 시간', icon: 'flag' },
];

// 에이전시와 페이(세금공제·지급일 포함)는 값이 없어도 항상 보여 준다.
const ALWAYS = new Set(['agency', 'pay']);
const TAX_PRESETS = ['3.3% 공제', '8.8% 공제', '공제 없음'];

const hasValue = (d, key) => {
  if (key === 'contact') return !!(d.contactName || d.phone);
  if (key === 'pay') return d.pay != null || !!d.payNote || !!d.tax || !!d.payDate;
  return d[key] != null && d[key] !== '';
};

const hint = (text) => (text ? `<p class="hint hint--warn">${icon('alert', { size: 14 })}<span>${esc(text)}</span></p>` : '');

/**
 * @param {HTMLElement} root
 * @param {{ id?: string }} params  id가 있으면 저장된 일정 수정 모드
 */
export function render(root, { id } = {}) {
  const editing = !!id;
  const source = editing ? store.get(id) : session.get('draft');

  if (!source) {
    root.innerHTML = `
      <header class="topbar"><a class="topbar__back" href="#/home">${icon('chevronLeft')}<span>홈</span></a></header>
      ${emptyState({
        iconName: editing ? 'alert' : 'text',
        title: editing ? '일정을 찾을 수 없어요' : '확인할 분석 결과가 없어요',
        body: editing ? '이미 삭제되었을 수 있어요.' : '일정 텍스트를 붙여넣고 분석을 시작해 주세요.',
        action: editing ? '' : '<a class="btn btn--primary" href="#/add">텍스트 붙여넣기</a>',
      })}`;
    return;
  }

  const d = { uncertain: {}, ...structuredClone(source) };
  if (editing) d.uncertain = {};
  const parsed = d.source === 'parsed';
  const visible = new Set(OPTIONAL.filter((f) => ALWAYS.has(f.key) || hasValue(d, f.key) || d.uncertain[f.key === 'contact' ? 'phone' : f.key]).map((f) => f.key));
  const fmt = store.settings().timeFormat;
  const found = countFields(d);
  const unsure = Object.keys(d.uncertain).length;
  const sparse = parsed && !d.date && found <= 1;
  const summary = parsed && !sparse;

  const persistDraft = () => {
    if (!editing) session.set('draft', d);
  };

  root.innerHTML = `
    <header class="topbar">
      ${
        editing
          ? `<a class="topbar__back" href="#/event/${esc(id)}">${icon('chevronLeft')}<span>취소</span></a>`
          : `<a class="topbar__back" href="#/add">${icon('chevronLeft')}<span>${parsed ? '다시 입력' : '뒤로'}</span></a>`
      }
      <span class="topbar__title">${editing ? '일정 수정' : parsed ? '분석 결과' : '직접 입력'}</span>
      <span class="topbar__spacer"></span>
    </header>

    ${
      summary
        ? `<div class="review-summary">
            <span class="review-summary__item">${icon('check', { size: 16 })}<span><span class="num">${found}</span>개 항목을 찾았어요</span></span>
            ${unsure ? `<span class="review-summary__item is-warn">${icon('alert', { size: 16 })}<span>확인 필요 <span class="num">${unsure}</span></span></span>` : ''}
          </div>`
        : ''
    }
    ${sparse ? `<div class="banner banner--warn">${icon('info', { size: 18 })}<div><strong>일정 정보를 충분히 찾지 못했어요</strong><p>날짜와 시간을 직접 선택하고 필요한 항목을 추가해 주세요.</p></div></div>` : ''}

    <form class="editor" id="editor" novalidate>
      <div class="editor__title">
        <textarea id="f-title" class="title-input" rows="1" placeholder="일정 제목" aria-label="일정 제목" maxlength="120">${esc(d.title)}</textarea>
        <div data-hint="title">${hint(d.uncertain.title)}</div>
      </div>

      <div class="when">
        <div class="when__row">
          <span class="when__icon">${icon('calendar')}</span>
          <label class="pill ${d.date ? '' : 'is-empty'} ${d.uncertain.date ? 'is-warn' : ''}" id="pill-date">
            <span class="pill__text">${d.date ? formatDateMedium(d.date) : '날짜 선택'}</span>
            <input type="date" id="f-date" value="${esc(d.date || '')}" aria-label="날짜">
          </label>
        </div>
        <div data-hint="date">${hint(d.uncertain.date)}</div>
        <div class="when__row">
          <span class="when__icon">${icon('clock')}</span>
          <label class="pill ${d.startTime ? '' : 'is-empty'} ${d.uncertain.startTime ? 'is-warn' : ''}" id="pill-start">
            <span class="pill__text num">${d.startTime ? formatTime(d.startTime, fmt) : '시작 시간'}</span>
            <input type="time" id="f-start" value="${esc(d.startTime || '')}" aria-label="시작 시간">
          </label>
          <span class="when__sep" aria-hidden="true">–</span>
          <label class="pill ${d.endTime ? '' : 'is-empty'}" id="pill-end">
            <span class="pill__text num">${d.endTime ? formatTime(d.endTime, fmt) : '종료 시간'}</span>
            <input type="time" id="f-end" value="${esc(d.endTime || '')}" aria-label="종료 시간">
          </label>
          <button type="button" class="icon-btn icon-btn--sm" id="clear-time" aria-label="시간 지우기" ${d.startTime || d.endTime ? '' : 'hidden'}>${icon('x', { size: 16 })}</button>
        </div>
        <div data-hint="startTime">${hint(d.uncertain.startTime)}</div>
      </div>

      <div class="fields" id="fields">
        ${fieldBlock('callTime', `
          <label class="pill ${d.callTime ? '' : 'is-empty'}" id="pill-call">
            <span class="pill__text num">${d.callTime ? formatTime(d.callTime, fmt) : '시간 선택'}</span>
            <input type="time" id="f-call" value="${esc(d.callTime || '')}" aria-label="집합 시간">
          </label>`)}
        ${fieldBlock('location', `<textarea class="field__input" id="f-location" rows="1" placeholder="장소 또는 주소" data-key="location">${esc(d.location)}</textarea>`, d.uncertain.location)}
        ${fieldBlock('contact', `
          <div class="field__pair">
            <input class="field__input" id="f-contactName" placeholder="담당자" value="${esc(d.contactName)}" data-key="contactName" autocomplete="off">
            <input class="field__input num" id="f-phone" type="tel" inputmode="tel" placeholder="010-0000-0000" value="${esc(d.phone)}" data-key="phone" autocomplete="off">
          </div>`, d.uncertain.phone)}
        ${fieldBlock('agency', `<input class="field__input" id="f-agency" placeholder="에이전시 또는 업체" value="${esc(d.agency)}" data-key="agency" autocomplete="off">`, d.uncertain.agency)}
        ${fieldBlock('pay', `
          <div class="money">
            <input class="field__input num money__input" id="f-pay" inputmode="numeric" placeholder="0" value="${d.pay != null ? Number(d.pay).toLocaleString('ko-KR') : ''}" autocomplete="off" aria-label="금액">
            <span class="money__unit">원</span>
            <span class="money__mirror num" id="pay-mirror" aria-hidden="true"></span>
            <span class="money__short num" id="pay-short">${d.pay ? formatWonShort(d.pay) : ''}</span>
          </div>
          <div class="pay-meta">
            <div class="pay-meta__row">
              <span class="pay-meta__label">세금공제</span>
              <input class="field__input pay-meta__input" id="f-tax" placeholder="없으면 비워 두세요" value="${esc(d.tax || '')}" data-key="tax" autocomplete="off">
            </div>
            <div class="tax-presets" role="group" aria-label="세금공제 빠른 선택">
              ${TAX_PRESETS.map((t) => `<button type="button" class="tax-chip" data-tax="${t}" aria-pressed="${d.tax === t}">${t}</button>`).join('')}
            </div>
            <div class="pay-meta__row">
              <span class="pay-meta__label">지급일</span>
              <label class="pill ${d.payDate ? '' : 'is-empty'} ${d.uncertain.payDate ? 'is-warn' : ''}" id="pill-paydate">
                <span class="pill__text">${d.payDate ? formatDateMedium(d.payDate) : '날짜 선택'}</span>
                <input type="date" id="f-paydate" value="${esc(d.payDate || '')}" aria-label="페이 지급일">
              </label>
              <button type="button" class="icon-btn icon-btn--sm" id="clear-paydate" aria-label="지급일 지우기" ${d.payDate ? '' : 'hidden'}>${icon('x', { size: 16 })}</button>
            </div>
            <div data-hint="payDate">${hint(d.uncertain.payDate)}</div>
          </div>
          <input class="field__input field__input--sub" id="f-payNote" placeholder="기타 지급 조건" value="${esc(d.payNote)}" data-key="payNote" autocomplete="off">`, d.uncertain.pay)}
        ${fieldBlock('notes', `<textarea class="field__input" id="f-notes" rows="2" placeholder="준비물, 의상, 주의사항 등" data-key="notes">${esc(d.notes)}</textarea>`)}
      </div>

      <div class="field field--memo">
        <span class="field__icon">${icon('edit')}</span>
        <div class="field__main">
          <label class="field__label" for="f-memo">메모</label>
          <textarea class="field__input" id="f-memo" rows="2" placeholder="직접 남길 메모를 적어 주세요" data-key="memo">${esc(d.memo || '')}</textarea>
        </div>
        <span></span>
      </div>

      <div class="add-fields" id="add-fields">
        <span class="add-fields__label">항목 추가</span>
        <div class="add-fields__chips">
          ${OPTIONAL.map((f) => `<button type="button" class="add-chip" data-add="${f.key}" ${visible.has(f.key) ? 'hidden' : ''}>${icon('plus', { size: 14 })}${f.label}</button>`).join('')}
        </div>
      </div>
    </form>

    ${
      d.raw
        ? `<details class="raw" ${sparse ? 'open' : ''}>
            <summary>${icon('text', { size: 16 })}<span>원문 보기</span><span class="raw__count num">${d.raw.trim().split('\n').length}줄</span>${icon('chevronDown', { size: 16, cls: 'raw__chev' })}</summary>
            <pre class="raw__body">${esc(d.raw)}</pre>
          </details>`
        : ''
    }
    ${editing ? `<button type="button" class="btn btn--text btn--danger-text delete-link" id="delete">${icon('trash', { size: 18 })}<span>일정 삭제</span></button>` : ''}

    <div class="action-bar">
      <button type="button" class="btn btn--primary btn--lg btn--grow" id="save">${icon('calendar', { size: 18 })}<span>${editing ? '변경사항 저장' : '아이폰 캘린더에 추가'}</span></button>
    </div>`;

  function fieldBlock(key, inner, warn) {
    const f = OPTIONAL.find((x) => x.key === key);
    return `
      <div class="field" data-field="${key}" ${visible.has(key) ? '' : 'hidden'}>
        <span class="field__icon">${icon(f.icon)}</span>
        <div class="field__main">
          <span class="field__label">${f.label}${warn ? '<span class="warn-dot" aria-label="확인 필요"></span>' : ''}</span>
          ${inner}
          <div data-hint="${key === 'contact' ? 'phone' : key}">${hint(warn)}</div>
        </div>
        <button type="button" class="icon-btn icon-btn--sm field__remove" data-remove="${key}" aria-label="${f.label} 지우기">${icon('x', { size: 16 })}</button>
      </div>`;
  }

  // ── 동작 ──
  const clearWarn = (key) => {
    if (!d.uncertain[key]) return;
    delete d.uncertain[key];
    const h = root.querySelector(`[data-hint="${key}"]`);
    if (h) h.innerHTML = '';
    const field = h?.closest('.field');
    field?.querySelector('.warn-dot')?.remove();
    ({ date: $('#pill-date', root), startTime: $('#pill-start', root), payDate: $('#pill-paydate', root) })[key]?.classList.remove('is-warn');
  };

  const title = $('#f-title', root);
  autoGrow(title);
  title.addEventListener('input', () => {
    d.title = title.value;
    clearWarn('title');
    persistDraft();
  });


  // 날짜·시간 알약: 투명한 기본 입력을 덮어 아이폰 기본 선택기를 그대로 사용한다.
  const bindPill = (inputId, pillId, key, format, placeholder) => {
    const input = $(inputId, root);
    const pill = $(pillId, root);
    pill.addEventListener('click', (e) => {
      if (e.target !== input) return;
      try {
        input.showPicker?.();
      } catch {}
    });
    input.addEventListener('change', () => {
      d[key] = input.value || null;
      pill.classList.toggle('is-empty', !input.value);
      pill.classList.remove('is-error');
      pill.querySelector('.pill__text').textContent = input.value ? format(input.value) : placeholder;
      clearWarn(key);
      if (key === 'date') root.querySelector('[data-hint="date"]').innerHTML = '';
      $('#clear-time', root).hidden = !(d.startTime || d.endTime);
      $('#clear-paydate', root).hidden = !d.payDate;
      persistDraft();
    });
    return input;
  };
  bindPill('#f-date', '#pill-date', 'date', (v) => formatDateMedium(v), '날짜 선택');
  const start = bindPill('#f-start', '#pill-start', 'startTime', (v) => formatTime(v, fmt), '시작 시간');
  const end = bindPill('#f-end', '#pill-end', 'endTime', (v) => formatTime(v, fmt), '종료 시간');
  const call = bindPill('#f-call', '#pill-call', 'callTime', (v) => formatTime(v, fmt), '시간 선택');
  const payDate = bindPill('#f-paydate', '#pill-paydate', 'payDate', (v) => formatDateMedium(v), '날짜 선택');
  $('#clear-paydate', root).addEventListener('click', () => {
    payDate.value = '';
    payDate.dispatchEvent(new Event('change'));
  });

  const taxInput = $('#f-tax', root);
  const syncTaxChips = () => $$('[data-tax]', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tax === taxInput.value)));
  taxInput.addEventListener('input', syncTaxChips);
  $$('[data-tax]', root).forEach((b) =>
    b.addEventListener('click', () => {
      taxInput.value = taxInput.value === b.dataset.tax ? '' : b.dataset.tax;
      taxInput.dispatchEvent(new Event('input'));
    }),
  );

  $('#clear-time', root).addEventListener('click', () => {
    for (const inp of [start, end]) {
      inp.value = '';
      inp.dispatchEvent(new Event('change'));
    }
  });

  $$('[data-key]', root).forEach((el) => {
    if (el.tagName === 'TEXTAREA') autoGrow(el);
    el.addEventListener('input', () => {
      d[el.dataset.key] = el.value;
      clearWarn(el.dataset.key === 'contactName' ? 'phone' : el.dataset.key === 'payNote' ? 'pay' : el.dataset.key);
      persistDraft();
    });
  });
  $('#f-phone', root).addEventListener('blur', (e) => {
    if (!e.target.value.trim()) return;
    e.target.value = formatPhone(e.target.value);
    d.phone = e.target.value;
    persistDraft();
  });

  const pay = $('#f-pay', root);
  // 금액 입력칸은 내용 길이에 맞춰 늘어나 '원' 단위가 숫자 바로 옆에 붙는다.
  const mirror = $('#pay-mirror', root);
  const fitPay = () => {
    mirror.textContent = pay.value || pay.placeholder;
    pay.style.width = `${Math.ceil(mirror.getBoundingClientRect().width) + 3}px`;
  };
  fitPay();
  document.fonts?.ready.then(fitPay);
  pay.addEventListener('input', () => {
    const digits = pay.value.replace(/\D/g, '').slice(0, 12);
    d.pay = digits ? Number(digits) : null;
    pay.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
    fitPay();
    $('#pay-short', root).textContent = d.pay ? formatWonShort(d.pay) : '';
    clearWarn('pay');
    persistDraft();
  });

  const showField = (key, focus) => {
    visible.add(key);
    const field = root.querySelector(`.field[data-field="${key}"]`);
    field.hidden = false;
    root.querySelector(`[data-add="${key}"]`).hidden = true;
    syncAddRow();
    if (focus) {
      const target = field.querySelector('textarea, input:not([type="time"])');
      if (target) target.focus();
      else if (key === 'callTime') {
        try {
          call.showPicker?.();
        } catch {}
      }
    }
  };
  const syncAddRow = () => {
    $('#add-fields', root).hidden = OPTIONAL.every((f) => visible.has(f.key));
  };
  syncAddRow();

  $$('[data-add]', root).forEach((b) => b.addEventListener('click', () => showField(b.dataset.add, true)));
  $$('[data-remove]', root).forEach((b) =>
    b.addEventListener('click', () => {
      const key = b.dataset.remove;
      const field = root.querySelector(`.field[data-field="${key}"]`);
      field.querySelectorAll('input, textarea').forEach((el) => {
        el.value = '';
      });
      if (key === 'contact') Object.assign(d, { contactName: '', phone: '' });
      else if (key === 'pay') {
        Object.assign(d, { pay: null, payNote: '', tax: '', payDate: null });
        payDate.dispatchEvent(new Event('change'));
        syncTaxChips();
      }
      else d[key] = key === 'callTime' ? null : '';
      clearWarn(key === 'contact' ? 'phone' : key);
      if (key === 'callTime') {
        $('#pill-call', root).classList.add('is-empty');
        $('#pill-call .pill__text', root).textContent = '시간 선택';
      }
      if (key === 'pay') {
        $('#pay-short', root).textContent = '';
        fitPay();
      }
      if (ALWAYS.has(key)) {
        persistDraft();
        return;
      }
      field.hidden = true;
      visible.delete(key);
      root.querySelector(`[data-add="${key}"]`).hidden = false;
      syncAddRow();
      persistDraft();
    }),
  );

  // ── 저장 ──
  const saveBtn = $('#save', root);
  saveBtn.addEventListener('click', () => {
    if (!d.date) {
      const pill = $('#pill-date', root);
      pill.classList.add('is-error');
      root.querySelector('[data-hint="date"]').innerHTML = `<p class="hint hint--error">${icon('alert', { size: 14 })}<span>날짜를 선택해 주세요</span></p>`;
      pill.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!d.title.trim()) d.title = '새 일정';

    let saved;
    try {
      saved = editing ? store.update(id, d) : store.add(d);
    } catch (err) {
      toast(err.message || '저장하지 못했어요', { kind: 'error' });
      return;
    }
    saveBtn.disabled = true;
    saveBtn.classList.add('is-done');
    saveBtn.innerHTML = `${icon('check', { size: 18 })}<span>${editing ? '저장됨' : '추가 화면 여는 중'}</span>`;
    if (editing) {
      setTimeout(() => {
        toast('변경사항을 저장했어요', { kind: 'success' });
        go(`#/event/${saved.id}`);
      }, 380);
      return;
    }
    session.set('draft', null);
    session.set('compose', null);
    // 상세 화면으로 먼저 옮긴 뒤 아이폰 캘린더의 일정 추가 화면을 연다.
    go(`#/event/${saved.id}`);
    setTimeout(() => openInDeviceCalendar(saved), 250);
  });

  $('#delete', root)?.addEventListener('click', async () => {
    const ok = await confirmSheet({ title: '이 일정을 삭제할까요?', message: `‘${source.title}’ 일정이 이 기기에서 삭제돼요.`, confirm: '삭제', danger: true });
    if (!ok) return;
    try {
      store.remove(id);
    } catch (err) {
      toast(err.message, { kind: 'error' });
      return;
    }
    toast('일정을 삭제했어요', { action: '실행 취소', onAction: () => store.restore(source) });
    go(`#/calendar?date=${source.date}`);
  });
}
