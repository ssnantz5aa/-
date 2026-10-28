// iCalendar(.ics) 내보내기 — 아이폰 캘린더 등 외부 캘린더로 옮길 때 사용한다.
import { addDays, fromMinutes, fromYmd, toMinutes, toYmd } from './dates.js';
import { formatWon } from './parser.js';
import { download } from './ui.js';

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

function fold(line) {
  // RFC 5545: 75옥텟마다 줄을 접는다.
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > 73) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

/** 직접 입력한 일정의 메모 칸 내용: 항목 요약 */
function summary(e) {
  const pay = e.pay != null && [formatWon(e.pay), e.tax, e.payNote].filter(Boolean).join(' · ');
  return [
    e.callTime && `집합: ${e.callTime}`,
    (e.contactName || e.phone) && `연락처: ${[e.contactName, e.phone].filter(Boolean).join(' ')}`,
    e.agency && `에이전시: ${e.agency}`,
    pay && `페이: ${pay}`,
    !pay && e.tax && `세금공제: ${e.tax}`,
    e.payDate && `지급일: ${e.payDate}`,
    e.notes && `\n${e.notes}`,
  ].filter(Boolean).join('\n');
}

/**
 * 캘린더 메모 칸(DESCRIPTION). 붙여넣은 원문이 있으면 손대지 않고 그대로 넣고,
 * 직접 쓴 메모가 있으면 원문 위에 먼저 넣은 뒤 빈 줄로 구분한다.
 */
export function description(e) {
  const raw = String(e.raw ?? '').replace(/\r\n?/g, '\n');
  const body = raw.trim() ? raw : summary(e);
  const memo = String(e.memo ?? '').trim();
  return [memo, body].filter(Boolean).join('\n\n');
}

const stamp = (ymd, hhmm) => `${ymd.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;

function vevent(e) {
  if (!e.date) return null;
  const lines = ['BEGIN:VEVENT', `UID:${e.id}@slate`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`];
  const start = e.startTime || e.callTime;
  if (start) {
    const endMin = e.endTime ? toMinutes(e.endTime) : toMinutes(start) + 60;
    let endDate = e.date;
    if (endMin <= toMinutes(start) || endMin >= 1440) {
      endDate = toYmd(addDays(fromYmd(e.date), 1));
    }
    lines.push(`DTSTART;TZID=Asia/Seoul:${stamp(e.date, start)}`, `DTEND;TZID=Asia/Seoul:${stamp(endDate, fromMinutes(endMin))}`);
  } else {
    const next = toYmd(addDays(fromYmd(e.date), 1));
    lines.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${next.replace(/-/g, '')}`);
  }
  lines.push(`SUMMARY:${esc(e.title)}`);
  if (e.location) lines.push(`LOCATION:${esc(e.location.replace(/\n/g, ', '))}`);
  lines.push(`DESCRIPTION:${esc(description(e))}`, 'END:VEVENT');
  return lines.map(fold).join('\r\n');
}

const VTIMEZONE = ['BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE'];

export function toIcs(events) {
  const body = events.map(vevent).filter(Boolean);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Slate//Schedule//KO', 'CALSCALE:GREGORIAN', ...VTIMEZONE, ...body, 'END:VCALENDAR'].join('\r\n');
}

/** Google 캘린더 일정 추가 링크. 파일 다운로드가 막힌 환경에서도 새 탭으로 열린다. */
export function googleCalendarUrl(e) {
  if (!e.date) return null;
  const day = e.date.replace(/-/g, '');
  const start = e.startTime || e.callTime;
  let dates;
  if (start) {
    const endMin = e.endTime ? toMinutes(e.endTime) : toMinutes(start) + 60;
    const endDay = endMin <= toMinutes(start) || endMin >= 1440 ? toYmd(addDays(fromYmd(e.date), 1)).replace(/-/g, '') : day;
    dates = `${day}T${start.replace(':', '')}00/${endDay}T${fromMinutes(endMin).replace(':', '')}00`;
  } else {
    dates = `${day}/${toYmd(addDays(fromYmd(e.date), 1)).replace(/-/g, '')}`;
  }
  const details = description(e);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, ctz: 'Asia/Seoul' });
  if (details) params.set('details', details);
  if (e.location) params.set('location', e.location.replace(/\n/g, ', '));
  return `https://calendar.google.com/calendar/render?${params}`;
}

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * 기기의 캘린더 앱으로 일정을 보낸다.
 * 아이폰에서는 캘린더 데이터를 직접 열어 iOS의 '일정 추가' 화면을 띄우고,
 * 그 밖의 기기에서는 .ics 파일을 내려받는다.
 */
export function openInDeviceCalendar(e) {
  const ics = toIcs([e]);
  if (isIOS()) {
    location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    return;
  }
  download(`${e.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || 'schedule'}.ics`, ics, 'text/calendar;charset=utf-8');
}
