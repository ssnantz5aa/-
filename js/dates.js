// 날짜·시간 유틸리티. 모든 날짜는 로컬 기준 'YYYY-MM-DD', 시간은 'HH:MM' 문자열로 다룬다.

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const pad = (n) => String(n).padStart(2, '0');

export function toYmd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromYmd(s).getTime());
}

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addMonths(d, n) {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

export function isValidDate(y, m, d) {
  const t = new Date(y, m - 1, d);
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
}

export function diffDays(a, b) {
  return Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
}

export function startOfWeek(d, weekStart = 0) {
  const offset = (d.getDay() - weekStart + 7) % 7;
  return addDays(d, -offset);
}

export function todayYmd() {
  return toYmd(new Date());
}

export function toMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(min) {
  const v = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`;
}

/** '14:30' → { meridiem: '오후', clock: '2:30' } (12시간제) 또는 { meridiem: '', clock: '14:30' } */
export function timeParts(hhmm, format = '12h') {
  if (!hhmm) return { meridiem: '', clock: '' };
  const [h, m] = hhmm.split(':').map(Number);
  if (format === '24h') return { meridiem: '', clock: `${pad(h)}:${pad(m)}` };
  const meridiem = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { meridiem, clock: `${h12}:${pad(m)}` };
}

export function formatTime(hhmm, format = '12h') {
  const { meridiem, clock } = timeParts(hhmm, format);
  return meridiem ? `${meridiem} ${clock}` : clock;
}

export function formatTimeRange(start, end, format = '12h') {
  if (!start) return '';
  if (!end) return formatTime(start, format);
  const a = timeParts(start, format);
  const b = timeParts(end, format);
  if (format === '12h' && a.meridiem === b.meridiem) return `${a.meridiem} ${a.clock} – ${b.clock}`;
  return `${formatTime(start, format)} – ${formatTime(end, format)}`;
}

/** '10월 24일 금요일' */
export function formatDateLong(ymd, withYear = false) {
  const d = typeof ymd === 'string' ? fromYmd(ymd) : ymd;
  const year = withYear || d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}년 ` : '';
  return `${year}${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}

/** '10월 24일 (금)' */
export function formatDateMedium(ymd) {
  const d = typeof ymd === 'string' ? fromYmd(ymd) : ymd;
  const year = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}년 ` : '';
  return `${year}${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

/** 오늘/내일/모레 또는 'D-5' 같은 상대 표현 */
export function relativeLabel(ymd, now = new Date()) {
  const n = diffDays(fromYmd(ymd), now);
  if (n === 0) return '오늘';
  if (n === 1) return '내일';
  if (n === 2) return '모레';
  if (n === -1) return '어제';
  if (n > 0) return `${n}일 후`;
  return `${-n}일 전`;
}
