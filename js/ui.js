import { icon } from './icons.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ── 토스트 ──
let toastTimer;
export function toast(message, { kind = 'default', action, onAction, duration = 2600 } = {}) {
  const host = document.getElementById('toast');
  clearTimeout(toastTimer);
  const ic = kind === 'success' ? icon('check', { size: 18 }) : kind === 'error' ? icon('alert', { size: 18 }) : '';
  host.innerHTML = `<div class="toast toast--${kind}" role="status">${ic}<span>${esc(message)}</span>${action ? `<button type="button" class="toast__action">${esc(action)}</button>` : ''}</div>`;
  host.classList.add('is-visible');
  if (action) host.querySelector('.toast__action').addEventListener('click', () => {
    hideToast();
    onAction?.();
  });
  toastTimer = setTimeout(hideToast, action ? 5000 : duration);
}

function hideToast() {
  document.getElementById('toast').classList.remove('is-visible');
}

// ── 확인 시트 ──
export function confirmSheet({ title, message = '', confirm = '확인', cancel = '취소', danger = false }) {
  return new Promise((resolve) => {
    const host = document.getElementById('sheet');
    host.innerHTML = `
      <div class="sheet-backdrop" data-close></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <h2 class="sheet__title" id="sheet-title">${esc(title)}</h2>
        ${message ? `<p class="sheet__message">${esc(message)}</p>` : ''}
        <div class="sheet__actions">
          <button type="button" class="btn btn--secondary btn--lg" data-close>${esc(cancel)}</button>
          <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'} btn--lg" data-ok>${esc(confirm)}</button>
        </div>
      </div>`;
    host.classList.add('is-open');
    const done = (v) => {
      host.classList.remove('is-open');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => (host.innerHTML = ''), 180);
      resolve(v);
    };
    const onKey = (e) => e.key === 'Escape' && done(false);
    document.addEventListener('keydown', onKey);
    host.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => done(false)));
    host.querySelector('[data-ok]').addEventListener('click', () => done(true));
    host.querySelector('[data-ok]').focus();
  });
}

export function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** textarea 높이를 내용에 맞춘다 */
export function autoGrow(el) {
  const fit = () => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  el.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return fit;
}

export const go = (hash) => {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
};
