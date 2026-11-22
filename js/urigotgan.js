// 우리곳간(부부 가계부) 연결. 페이를 '입금 완료'로 표시하면 우리곳간에 수입으로 한 번만 기록한다.
// 열쇠가 없으면 아무것도 하지 않는다. 같은 일정 id로 여러 번 보내도 우리곳간에서 중복이 생기지 않는다.

import { store } from './store.js';

const ENDPOINT = 'https://urigotgan-beta.vercel.app/api/ingest/pay';
const PENDING_KEY = 'slate.urigotgan.pending'; // 보내지 못한 일정 id 목록(다음에 앱을 열 때 다시 보냄)
const TIMEOUT_MS = 8000;

/** 우리곳간 기록 상태 캐시: id → { recorded, amount, date, how } */
const statuses = new Map();

export const getKey = () => String(store.settings().urigotganKey || '').trim();
export const isConnected = () => getKey().startsWith('ob_');
export const statusOf = (id) => statuses.get(id) ?? null;

const validId = (id) => /^[A-Za-z0-9_-]{1,64}$/.test(String(id || ''));

function readPending() {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    return Array.isArray(list) ? list.filter(validId) : [];
  } catch {
    return [];
  }
}
function writePending(list) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify([...new Set(list)]));
  } catch {}
}
const addPending = (id) => writePending([...readPending(), id]);
const dropPending = (id) => writePending(readPending().filter((x) => x !== id));
export const isPending = (id) => readPending().includes(id);

async function call(method, url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${getKey()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {}
    return { httpStatus: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function payload(e) {
  if (!e.paid) return { id: e.id, paid: false };
  return {
    id: e.id,
    paid: true,
    pay: Number(e.pay) || 0,
    tax: e.tax || '',
    title: e.title || '',
    agency: e.agency || '',
    contactName: e.contactName || '',
    date: e.date || null,
    paidAt: e.paidAt || null,
  };
}

/**
 * 일정의 현재 입금 상태를 우리곳간에 보낸다.
 * @returns {Promise<null | { ok: boolean, status?: string, message: string, auth?: boolean, offline?: boolean }>}
 *   열쇠가 없거나 페이가 없는 일정이면 null
 */
export async function syncPay(id) {
  if (!isConnected() || !validId(id)) return null;
  const e = store.get(id);
  if (!e || e.pay == null) {
    dropPending(id);
    return null;
  }
  try {
    const { httpStatus, data } = await call('POST', ENDPOINT, payload(e));
    if (httpStatus === 401) {
      return { ok: false, auth: true, message: '우리곳간 열쇠가 맞지 않아요. 설정에서 다시 넣어 주세요' };
    }
    if (httpStatus >= 500 || !data) throw new Error('server');
    dropPending(id);
    if (!data.ok) return { ok: false, message: data.message || '우리곳간에 기록하지 못했어요' };
    if (['created', 'linked', 'already'].includes(data.status)) {
      statuses.set(id, { recorded: true, amount: data.amount, date: data.date, how: data.status === 'already' ? statuses.get(id)?.how : data.status });
    } else if (['removed', 'none'].includes(data.status)) {
      statuses.set(id, { recorded: false });
    }
    return { ok: true, status: data.status, message: data.message || '' };
  } catch {
    // 네트워크 실패: Slate 쪽 입금 표시는 그대로 두고 다음에 다시 보낸다.
    addPending(id);
    return { ok: false, offline: true, message: '우리곳간에 아직 못 보냈어요. 다음에 앱을 열 때 다시 보낼게요' };
  }
}

/** 앱을 열 때 지난번에 못 보낸 것을 다시 보낸다. */
export async function retryPending() {
  if (!isConnected()) return;
  for (const id of readPending()) {
    const r = await syncPay(id);
    if (r?.offline || r?.auth) break;
  }
}

/**
 * 우리곳간에 기록됐는지 한 번에 확인한다(200개씩).
 * @returns {Promise<boolean>} 상태가 바뀌었으면 true
 */
export async function refreshStatuses(ids) {
  if (!isConnected()) return false;
  const list = [...new Set(ids)].filter(validId);
  let changed = false;
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
    try {
      const { httpStatus, data } = await call('GET', `${ENDPOINT}?ids=${chunk.map(encodeURIComponent).join(',')}`);
      if (httpStatus !== 200 || !data?.statuses) return changed;
      for (const id of chunk) {
        const next = data.statuses[id] || { recorded: false };
        const prev = statuses.get(id);
        if (!prev || prev.recorded !== next.recorded || prev.amount !== next.amount) changed = true;
        statuses.set(id, next);
      }
    } catch {
      return changed;
    }
  }
  return changed;
}

/** 열쇠를 바꾸면 이전 상태는 버린다. */
export function resetStatuses() {
  statuses.clear();
}
