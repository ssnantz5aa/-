// localStorage 기반 저장소. 모든 데이터는 이 기기에만 저장된다.

const KEY = 'slate.v1';
const DEFAULT_SETTINGS = { weekStart: 0, timeFormat: '12h', defaultView: 'month' };

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { events: [], settings: { ...DEFAULT_SETTINGS } };
    const data = JSON.parse(raw);
    return {
      events: Array.isArray(data.events) ? data.events : [],
      settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    };
  } catch (err) {
    // 손상된 데이터는 지우지 않고 따로 보관한 뒤 새로 시작한다.
    try {
      localStorage.setItem(`${KEY}.corrupt.${Date.now()}`, localStorage.getItem(KEY) ?? '');
    } catch {}
    console.error('저장된 데이터를 읽지 못했습니다', err);
    return { events: [], settings: { ...DEFAULT_SETTINGS }, loadError: true };
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ events: state.events, settings: state.settings }));
  } catch (err) {
    throw new Error(err?.name === 'QuotaExceededError' ? '저장 공간이 부족해 저장하지 못했어요' : '기기에 저장하지 못했어요');
  }
  listeners.forEach((fn) => fn());
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

const EVENT_FIELDS = ['title', 'type', 'date', 'startTime', 'endTime', 'callTime', 'location', 'contactName', 'phone', 'agency', 'pay', 'payNote', 'notes', 'raw'];

function sanitize(input) {
  const e = {};
  for (const k of EVENT_FIELDS) {
    const v = input[k];
    if (k === 'pay') e.pay = v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v);
    else if (['date', 'startTime', 'endTime', 'callTime'].includes(k)) e[k] = v || null;
    else e[k] = typeof v === 'string' ? v.trim() : v ?? '';
  }
  e.type ||= 'etc';
  e.title ||= '제목 없는 일정';
  return e;
}

export const store = {
  get loadError() {
    return !!state.loadError;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  all() {
    return state.events;
  },
  get(id) {
    return state.events.find((e) => e.id === id) ?? null;
  },
  byDate(ymd) {
    return sortEvents(state.events.filter((e) => e.date === ymd));
  },
  /** { 'YYYY-MM-DD': Event[] } */
  indexByDate() {
    const map = new Map();
    for (const e of state.events) {
      if (!e.date) continue;
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    for (const list of map.values()) sortEvents(list);
    return map;
  },
  upcoming(fromYmd, limit = 6) {
    return sortEvents(state.events.filter((e) => e.date && e.date >= fromYmd)).slice(0, limit);
  },
  add(input) {
    const now = new Date().toISOString();
    const event = { id: uid(), createdAt: now, updatedAt: now, ...sanitize(input) };
    state.events = [...state.events, event];
    try {
      persist();
    } catch (err) {
      state.events = state.events.filter((e) => e.id !== event.id);
      throw err;
    }
    return event;
  },
  update(id, input) {
    const prev = state.events;
    state.events = prev.map((e) => (e.id === id ? { ...e, ...sanitize({ ...e, ...input }), updatedAt: new Date().toISOString() } : e));
    try {
      persist();
    } catch (err) {
      state.events = prev;
      throw err;
    }
    return this.get(id);
  },
  remove(id) {
    const prev = state.events;
    state.events = prev.filter((e) => e.id !== id);
    try {
      persist();
    } catch (err) {
      state.events = prev;
      throw err;
    }
  },
  restore(event) {
    state.events = [...state.events.filter((e) => e.id !== event.id), event];
    persist();
  },
  settings() {
    return state.settings;
  },
  setSetting(key, value) {
    state.settings = { ...state.settings, [key]: value };
    persist();
  },
  exportJson() {
    return JSON.stringify({ app: 'slate', version: 1, exportedAt: new Date().toISOString(), events: state.events, settings: state.settings }, null, 2);
  },
  /** 백업 파일을 병합한다. 같은 id는 더 최근에 수정된 쪽을 남긴다. */
  importJson(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('백업 파일 형식이 올바르지 않아요');
    }
    const incoming = Array.isArray(data) ? data : data?.events;
    if (!Array.isArray(incoming)) throw new Error('일정 데이터를 찾지 못했어요');
    const map = new Map(state.events.map((e) => [e.id, e]));
    let added = 0;
    for (const raw of incoming) {
      if (!raw || typeof raw !== 'object') continue;
      const e = { id: raw.id || uid(), createdAt: raw.createdAt || new Date().toISOString(), updatedAt: raw.updatedAt || new Date().toISOString(), ...sanitize(raw) };
      const cur = map.get(e.id);
      if (!cur) added += 1;
      if (!cur || (e.updatedAt || '') > (cur.updatedAt || '')) map.set(e.id, e);
    }
    const prev = state.events;
    state.events = [...map.values()];
    try {
      persist();
    } catch (err) {
      state.events = prev;
      throw err;
    }
    return added;
  },
  clear() {
    state.events = [];
    persist();
  },
};

export function sortEvents(list) {
  return list.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.startTime || a.callTime || '99').localeCompare(b.startTime || b.callTime || '99') || (a.createdAt || '').localeCompare(b.createdAt || ''));
}

// 분석 결과 초안과 입력 중인 원문은 새로고침해도 유지되도록 sessionStorage에 둔다.
export const session = {
  get(key) {
    try {
      return JSON.parse(sessionStorage.getItem(`slate.${key}`));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) sessionStorage.removeItem(`slate.${key}`);
      else sessionStorage.setItem(`slate.${key}`, JSON.stringify(value));
    } catch {}
  },
};
