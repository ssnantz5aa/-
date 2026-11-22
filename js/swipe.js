// 목록 줄을 왼쪽으로 밀면 뒤에 숨은 '삭제' 버튼이 나온다(아이폰 기본 앱과 같은 방식).
// 세로 스크롤은 그대로 두고, 가로로 민 경우에만 줄을 움직인다.

import { icon } from './icons.js';
import { esc } from './ui.js';

const WIDTH = 88; // 삭제 버튼 너비

/** 줄 HTML을 스와이프 삭제 틀로 감싼다. */
export function swipeWrap(id, rowHtml) {
  return `
    <div class="swipe" data-swipe-id="${esc(id)}">
      <button type="button" class="swipe__del" tabindex="-1" aria-label="일정 삭제">${icon('trash', { size: 20 })}<span>삭제</span></button>
      ${rowHtml}
    </div>`;
}

/**
 * @param {HTMLElement} container
 * @param {{ onDelete: (id: string, el: HTMLElement) => void }} opts
 */
export function enableSwipeDelete(container, { onDelete }) {
  let opened = null;
  const rowOf = (sw) => sw.querySelector('.event-row');
  const close = (sw) => {
    if (!sw) return;
    sw.classList.remove('is-open');
    rowOf(sw).style.transform = '';
    if (opened === sw) opened = null;
  };

  // 다른 곳을 누르면 열린 줄을 닫는다.
  container.addEventListener('pointerdown', (e) => {
    if (opened && !opened.contains(e.target)) close(opened);
  }, true);

  container.querySelectorAll('.swipe').forEach((sw) => {
    const row = rowOf(sw);
    if (!row) return;
    let x0 = 0, y0 = 0, dx = 0, base = 0, pid = null;
    let tracking = false, decided = false, horizontal = false;

    row.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      tracking = true;
      decided = false;
      horizontal = false;
      dx = 0;
      x0 = e.clientX;
      y0 = e.clientY;
      pid = e.pointerId;
      base = sw.classList.contains('is-open') ? -WIDTH : 0;
    });

    row.addEventListener('pointermove', (e) => {
      if (!tracking || e.pointerId !== pid) return;
      const mx = e.clientX - x0;
      const my = e.clientY - y0;
      if (!decided) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        decided = true;
        horizontal = Math.abs(mx) > Math.abs(my);
        if (!horizontal) {
          tracking = false;
          return;
        }
        row.setPointerCapture?.(pid);
        sw.classList.add('is-swiping');
      }
      dx = mx;
      // 버튼 너비보다 더 당기면 살짝 저항을 준다.
      let t = Math.min(0, base + dx);
      if (t < -WIDTH) t = -WIDTH + (t + WIDTH) * 0.3;
      row.style.transition = 'none';
      row.style.transform = `translateX(${t}px)`;
    });

    const end = () => {
      if (!tracking) return;
      tracking = false;
      row.style.transition = '';
      if (!horizontal) return;
      if (base + dx < -WIDTH / 2) {
        if (opened && opened !== sw) close(opened);
        sw.classList.add('is-open');
        row.style.transform = `translateX(${-WIDTH}px)`;
        opened = sw;
      } else close(sw);
      // 닫히는 동안에도 버튼이 보이도록 잠시 뒤에 표시를 끈다.
      setTimeout(() => sw.classList.remove('is-swiping'), 260);
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);

    // 민 직후의 탭, 열린 줄을 누른 탭은 상세 화면으로 넘어가지 않는다.
    row.addEventListener('click', (e) => {
      if (horizontal || base !== 0) {
        e.preventDefault();
        if (!horizontal) close(sw);
      }
    });

    sw.querySelector('.swipe__del').addEventListener('click', () => {
      opened = null;
      onDelete(sw.dataset.swipeId, sw);
    });
  });
}
