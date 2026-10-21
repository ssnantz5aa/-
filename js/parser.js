// 규칙 기반 일정 추출기. AI나 외부 서비스를 사용하지 않고 정규식과 키워드 사전만으로
// 메시지·메일·공지 텍스트에서 일정 항목을 뽑아낸다.

import { isValidDate, toYmd, addDays, startOfDay, diffDays, pad, WEEKDAYS } from './dates.js';

export const TYPES = [
  { id: 'shoot', label: '촬영' },
  { id: 'event', label: '행사' },
  { id: 'meeting', label: '미팅' },
  { id: 'audition', label: '오디션' },
  { id: 'lesson', label: '레슨' },
  { id: 'etc', label: '기타' },
];

const TYPE_KEYWORDS = {
  audition: /오디션|캐스팅|프로필\s*촬영|셀프\s*테이프/gi,
  shoot: /촬영|화보|광고|CF|뮤비|뮤직\s*비디오|룩북|스냅|드라마|영화|웹드|촬영장|콘텐츠|유튜브|라이브\s*커머스/gi,
  event: /행사|이벤트|프로모션|팝업|전시|박람회|\bMC\b|사회|공연|축제|런칭|론칭|쇼케이스|웨딩|시상식|페스티벌|부스/gi,
  meeting: /미팅|회의|면담|상담|피팅|미트|meeting|인터뷰/gi,
  lesson: /레슨|수업|강의|교육|클래스|연습|리허설|트레이닝|워크숍/gi,
};

const LABELS = {
  title: ['제목', '건명', '프로젝트', '작품명', '작품', '행사명', '촬영명', '일정명', '캠페인', '브랜드', '내용'],
  datetime: ['촬영일시', '행사일시', '진행일시', '날짜/시간', '일시', '날짜', '일자', '촬영일', '행사일', '진행일', '일정', '기간', '언제'],
  time: ['촬영시간', '행사시간', '진행시간', '근무시간', '시간', '타임'],
  call: ['집합시간', '콜타임', '콜 타임', '도착시간', '집결', '집합', '도착'],
  location: ['집합장소', '촬영장소', '행사장소', '진행장소', '장소', '위치', '주소', '촬영장', '현장', '로케이션', '로케'],
  contact: ['현장담당', '현장 담당', '담당자', '담당', '연락처', '문의', '연락', '전화번호', '전화', '핸드폰', '휴대폰', '매니저', '실장'],
  agency: ['에이전시', '소속사', '소속', '업체명', '업체', '회사', '주최', '주관', '클라이언트', '광고주', '제작사', '기획사', '섭외처', '섭외'],
  pay: ['출연료', '페이', '금액', '비용', '일당', '시급', '급여', '보수', '단가', '사례비', '수당', '개런티', '정산', 'pay', 'Pay', 'PAY'],
  notes: ['특이사항', '참고사항', '전달사항', '요청사항', '주의사항', '유의사항', '준비물', '드레스코드', '의상', '헤어', '메이크업', '참고', '비고', '주의', '기타', '메모'],
  type: ['구분', '유형', '종류', '분류'],
};

// 내용을 그대로 보여 주면 되는 일반적인 메모 라벨(라벨 없이 값만 남긴다)
const GENERIC_NOTE_LABELS = new Set(['특이사항', '참고사항', '전달사항', '요청사항', '참고', '비고', '기타', '메모']);

const LABEL_TO_FIELD = new Map();
for (const [field, words] of Object.entries(LABELS)) for (const w of words) LABEL_TO_FIELD.set(w, field);
const LABEL_ALT = [...LABEL_TO_FIELD.keys()]
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/[/\s]/g, (c) => (c === '/' ? '\\/' : '\\s*')))
  .join('|');
const LABEL_RE = new RegExp(
  `^(?:[\\[(<【「]\\s*(${LABEL_ALT})\\s*[\\])>】」]\\s*[:=\\-]?|(${LABEL_ALT})\\s*([:=]|\\s-\\s|\\s|$))\\s*(.*)$`,
);
// 일상 문장에도 자주 등장하는 라벨은 콜론이나 괄호가 있을 때만 라벨로 본다.
const STRICT_LABELS = new Set(['현장', '연락', '전화', '주의', '기타', '내용', '시간', '일정', '도착', '집합', '소속', '회사', '업체', '타임', '참고', '위치', '기간', '언제', '섭외', '정산', '비용', '의상', '헤어']);
// '일시: 10/24 장소: 성수'처럼 한 줄에 여러 라벨이 있으면 라벨마다 줄을 나눈다.
const INLINE_LABEL_RE = new RegExp(`([\\s,/|])(${LABEL_ALT})\\s*:`, 'g');
const POLITE = /부탁|주세요|바랍니다|드립니다|드려요|해요|합니다|예정/;

const EMOJI_LABELS = [
  [/^(?:📍|🗺️?|🏢|🏠|📌)/u, '장소: '],
  [/^(?:📞|☎️?|📱)/u, '연락처: '],
  [/^(?:💰|💵|💸|💳)/u, '페이: '],
  [/^(?:📅|🗓️?|📆)/u, '일시: '],
  [/^(?:⏰|🕘|🕐|⌚️?|⏱️?)/u, '시간: '],
  [/^(?:📝|✏️?|❗️?|⚠️?)/u, '특이사항: '],
];

const LEADING_JUNK = /^(?:[\s\-•·*▶▷►■□▪▫○●◆◇★☆✔✓✅☑※>❯→=_~]|\p{Extended_Pictographic}|️)+/u;
const NUMBERED = /^\d{1,2}[.)]\s+(?=\D)/;
const GREETING = /^(?:[^\s\d]{1,8}님[,!.~\s]*)?(?:안녕하세요|안녕하십니까|감사합니다|고맙습니다|수고하세요|수고하십시오|수고하셨습니다|잘\s*부탁|확인\s*부탁|부탁드립니다|참고\s*부탁|좋은\s*(?:하루|저녁|주말)|문의\s*주세요|회신\s*부탁)/;
const ADDRESS_RE = /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\S*\s+\S+(?:시|구|군)|\S+(?:구|동|읍|면)\s+\S+(?:로|길)\s*\d|\S+(?:로|길)\s*\d+(?:-\d+)?(?:\s|,|$)|\S+역\s*\d+\s*번\s*출구|스튜디오|빌딩|센터|호텔|타워|컨벤션|\S+홀(?=\s|,|$)/;
const AGENCY_RE = /에이전시|엔터테인먼트|엔터(?![가-힣])|프로덕션|컴퍼니|캐스팅|\(주\)|㈜|주식회사|매니지먼트/;
const LETTERS = /[\p{L}]/gu;

// ── 전화번호 ────────────────────────────────────────────
const PHONE_RE = /(?:\+?82[-.\s]?)?(0?1[016789]|02|0[3-6][1-5]|070|050\d?)[-.\s)]?\s?(\d{3,4})[-.\s]?(\d{4})(?!\d)/g;

export function formatPhone(raw) {
  const digits = String(raw).replace(/\D/g, '').replace(/^82/, '0');
  if (/^02\d{7,8}$/.test(digits)) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3');
  if (/^0\d{9,10}$/.test(digits)) return digits.replace(/^(0\d{2})(\d{3,4})(\d{4})$/, '$1-$2-$3');
  if (/^1\d{9}$/.test(digits)) return formatPhone('0' + digits);
  return String(raw).trim();
}

function extractPhones(str) {
  const phones = [];
  const rest = str.replace(PHONE_RE, (m, a, b, c, offset, whole) => {
    if (offset > 0 && /\d/.test(whole[offset - 1])) return m;
    const prefix = a.startsWith('1') ? '0' + a : a;
    phones.push(formatPhone(prefix + b + c));
    return ' ';
  });
  return { phones, rest };
}

// ── 금액 ────────────────────────────────────────────────
const AMOUNT_RE = /(?:₩\s*)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(만\s*(?:(\d)\s*천)?\s*원?|천\s*원|원)|₩\s*(\d{1,3}(?:,\d{3})+|\d+)/g;

function extractAmounts(str, { bare = false } = {}) {
  const amounts = [];
  let assumed = false;
  let rest = str.replace(AMOUNT_RE, (m, num, unit, chun, wonOnly) => {
    if (wonOnly) {
      amounts.push(Number(wonOnly.replace(/,/g, '')));
      return ' ';
    }
    const n = Number(num.replace(/,/g, ''));
    if (unit.startsWith('만')) amounts.push(Math.round(n * 10000 + (chun ? Number(chun) * 1000 : 0)));
    else if (unit.startsWith('천')) amounts.push(Math.round(n * 1000));
    else amounts.push(Math.round(n));
    return ' ';
  });
  if (!amounts.length && bare) {
    // 라벨이 붙은 줄에서는 단위 없는 숫자도 금액으로 본다. (페이 25 → 25만원으로 추정)
    rest = rest.replace(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?![\d.]*\s*%)/, (m, num, offset, whole) => {
      if (offset > 0 && /[\d.]/.test(whole[offset - 1])) return m;
      const n = Number(num.replace(/,/g, ''));
      if (n >= 1000) amounts.push(Math.round(n));
      else {
        amounts.push(Math.round(n * 10000));
        assumed = true;
      }
      return ' ';
    });
  }
  return { amounts, rest, assumed };
}

export function formatWon(n) {
  if (n == null || Number.isNaN(n)) return '';
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

/** 250000 → '25만원', 255000 → '25만 5천원' */
export function formatWonShort(n) {
  if (!n) return '';
  if (n < 10000) return formatWon(n);
  const man = Math.floor(n / 10000);
  const rem = n % 10000;
  if (!rem) return `${man.toLocaleString('ko-KR')}만원`;
  if (rem % 1000 === 0) return `${man.toLocaleString('ko-KR')}만 ${rem / 1000}천원`;
  return formatWon(n);
}

// ── 시간 ────────────────────────────────────────────────
const MER = '(오전|오후|아침|낮|저녁|밤|새벽|AM|PM|am|pm|a\\.m\\.|p\\.m\\.)';
const TIME_RE = new RegExp(
  `(?:${MER}\\s*)?(?:(정오|자정)|(\\d{1,2})\\s*(?::\\s*(\\d{2})|시(?!간|즌|청|장|각|내|작)\\s*(?:(\\d{1,2})\\s*분|(반))?))(?:\\s*${MER})?(?:\\s*(?:쯤|경|정각|즈음))?`,
  'g',
);

function meridiemKind(m) {
  if (!m) return null;
  const v = m.toLowerCase().replace(/\./g, '');
  if (['오후', '저녁', '밤', 'pm'].includes(v)) return 'pm';
  if (v === '낮') return 'noon';
  return 'am';
}

function applyMeridiem(kind, h) {
  if (kind === 'pm') return h < 12 ? h + 12 : h;
  if (kind === 'noon') return h <= 6 ? h + 12 : h;
  if (kind === 'am') return h === 12 ? 0 : h;
  return h;
}

function extractTimes(str) {
  const found = [];
  const rest = str.replace(TIME_RE, (m, mer1, special, hh, mmColon, mmKo, half, mer2, offset, whole) => {
    const prev = whole[offset - 1];
    if (prev && /[\d.,/]/.test(prev)) return m; // 날짜·금액의 일부
    if (special) {
      found.push({ h: special === '정오' ? 12 : 0, m: 0, kind: 'abs', colon: true });
      return ' ';
    }
    const h = Number(hh);
    const min = half ? 30 : Number(mmColon ?? mmKo ?? 0);
    if (h > 24 || min > 59) return m;
    const kind = meridiemKind(mer1 || mer2);
    found.push({ h, m: min, kind, colon: mmColon != null });
    return ' ';
  });

  const result = { start: null, end: null, assumed: false, rest };
  if (!found.length) return result;

  const resolve = (t, ref) => {
    if (t.kind === 'abs') return { min: t.h * 60 + t.m, assumed: false };
    if (t.kind) return { min: applyMeridiem(t.kind, t.h) * 60 + t.m, assumed: false };
    if (t.h >= 13 || t.h === 0) return { min: (t.h % 24) * 60 + t.m, assumed: false };
    if (ref != null) {
      // 앞 시간의 오전/오후를 이어받고, 앞 시간보다 이르면 12시간을 더한다.
      let min = t.h * 60 + t.m;
      if (ref >= 720 && t.h < 12) min += 720;
      if (min <= ref && min + 720 < 1440) min += 720;
      return { min, assumed: false };
    }
    if (t.h === 12) return { min: 720 + t.m, assumed: false };
    if (t.h <= 6) return { min: (t.h + 12) * 60 + t.m, assumed: true };
    return { min: t.h * 60 + t.m, assumed: false };
  };

  const a = resolve(found[0], null);
  result.start = fmt(a.min);
  result.assumed = a.assumed;
  if (found[1]) {
    const b = resolve(found[1], found[0].kind || !a.assumed ? a.min : null);
    result.end = fmt(b.min);
    if (b.assumed && !found[0].kind) result.assumed = true;
  }
  return result;
}

const fmt = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;

// ── 날짜 ────────────────────────────────────────────────
const WD_INDEX = Object.fromEntries(WEEKDAYS.map((w, i) => [w, i]));
const WEEKDAY_AFTER = /^\s*\.?\s*[([]?\s*([월화수목금토일])(?:요일)?\s*[)\]]?/;

function inferYear(m, d, today) {
  let y = today.getFullYear();
  if (!isValidDate(y, m, d)) return null;
  // 두 달 이상 지난 날짜라면 내년 일정으로 본다.
  if (diffDays(new Date(y, m - 1, d), today) < -60) y += 1;
  return y;
}

function extractDate(str, today) {
  let date = null;
  let reason = null;
  let rest = str;
  let weekdayHint = null;

  const take = (re, build) => {
    if (date) return;
    rest = rest.replace(re, (...args) => {
      if (date) return args[0];
      const offset = args[args.length - 2];
      const whole = args[args.length - 1];
      const prev = whole[offset - 1];
      if (prev && /[\d.,:]/.test(prev)) return args[0];
      const r = build(...args);
      if (!r) return args[0];
      date = r.date;
      reason = r.reason ?? null;
      const after = whole.slice(offset + args[0].length);
      const wd = after.match(WEEKDAY_AFTER);
      if (wd) weekdayHint = WD_INDEX[wd[1]];
      return '\u0001';
    });
    // 날짜 바로 뒤의 '(금)' 같은 요일 표기도 함께 지운다.
    rest = rest.replace(/\u0001\s*\.?\s*[([]?\s*[월화수목금토일](?:요일)?\s*[)\]]?/, ' ').replace('\u0001', ' ');
  };

  // 2026.10.24 / 2026-10-24 / 2026년 10월 24일
  take(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/g, (m, y, mo, d) =>
    isValidDate(+y, +mo, +d) ? { date: new Date(+y, +mo - 1, +d) } : null,
  );
  // 26.10.24
  take(/(\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})(?![\d만천원%])/g, (m, y, mo, d) =>
    isValidDate(2000 + +y, +mo, +d) ? { date: new Date(2000 + +y, +mo - 1, +d) } : null,
  );
  // 10월 24일
  take(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, (m, mo, d) => {
    const y = inferYear(+mo, +d, today);
    return y ? { date: new Date(y, +mo - 1, +d), inferred: true } : null;
  });
  // 10/24, 10.24
  take(/(\d{1,2})\s*[./]\s*(\d{1,2})(?!\s*(?:[\d만천원%:]|시간))\.?/g, (m, mo, d) => {
    const y = inferYear(+mo, +d, today);
    return y ? { date: new Date(y, +mo - 1, +d) } : null;
  });
  // 오늘, 내일, 모레
  take(/(오늘|금일|내일|명일|모레|내일모레|글피)(?![가-힣]*(?:까지|중으로))/g, (m, w) => {
    const map = { 오늘: 0, 금일: 0, 내일: 1, 명일: 1, 모레: 2, 내일모레: 2, 글피: 3 };
    return { date: addDays(today, map[w]) };
  });
  // 다음주 금요일, 이번 주 토요일, 금요일
  take(/(이번\s*주|금주|다음\s*주|차주|담주|다다음\s*주)?\s*([월화수목금토일])요일/g, (m, week, wd) => {
    const target = WD_INDEX[wd];
    if (week) {
      const monday = addDays(today, -((today.getDay() + 6) % 7));
      const weeks = /다다음/.test(week) ? 2 : /다음|차주|담주/.test(week) ? 1 : 0;
      return { date: addDays(monday, weeks * 7 + ((target + 6) % 7)) };
    }
    const delta = (target - today.getDay() + 7) % 7;
    return { date: addDays(today, delta), reason: '요일만 적혀 있어 가장 가까운 날짜로 추정했어요' };
  });
  // 24일
  take(/(\d{1,2})\s*일(?![\d시간정차]|\s*(?:간|동안|째|부터\s*\d))/g, (m, d) => {
    let y = today.getFullYear();
    let mo = today.getMonth() + 1;
    if (+d < today.getDate()) mo += 1;
    if (mo > 12) {
      mo = 1;
      y += 1;
    }
    if (!isValidDate(y, mo, +d)) return null;
    return { date: new Date(y, mo - 1, +d), reason: '월이 적혀 있지 않아 추정했어요' };
  });

  if (date && weekdayHint != null && date.getDay() !== weekdayHint) {
    // 연도를 바꾸면 요일이 맞는 경우(연도 미기재)를 먼저 확인
    const alt = new Date(date.getFullYear() + 1, date.getMonth(), date.getDate());
    if (!/^\d{4}/.test(str.trim()) && alt.getDay() === weekdayHint && diffDays(alt, today) < 400) {
      date = alt;
    } else {
      reason = `${WEEKDAYS[weekdayHint]}요일로 적혀 있지만 실제로는 ${WEEKDAYS[date.getDay()]}요일이에요`;
    }
  }
  return { date: date ? toYmd(startOfDay(date)) : null, reason, rest };
}

// ── 텍스트 정리 ─────────────────────────────────────────
function normalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[～〜∼]/g, '~')
    .replace(/[‐-―−]/g, '-')
    .replace(/[  -​　]/g, ' ')
    .replace(/[ \t]+/g, ' ');
}

function cleanLine(line) {
  let s = line.trim();
  for (const [re, label] of EMOJI_LABELS) {
    if (re.test(s)) {
      s = s.replace(re, label);
      break;
    }
  }
  return s.replace(LEADING_JUNK, '').replace(NUMBERED, '').trim();
}

function tidy(s) {
  return String(s ?? '')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,/|:~\-·]+|[\s,/|:~\-·]+$/g, '')
    .trim();
}

function cleanTitle(s) {
  let src = String(s);
  // '[촬영 안내] 나이키 광고'처럼 머리말 태그 뒤에 본문이 있으면 태그는 버린다.
  const tag = src.match(/^\s*[[【<「『]([^\]】>」』]*)[\]】>」』]\s*(.+)$/);
  if (tag && meaningful(tag[2])) src = tag[2];
  const t = tidy(
    src
      .replace(/[[\]【】<>「」『』]/g, ' ')
      .replace(/\(\s*[월화수목금토일](?:요일)?\s*\)/g, ' ')
      .replace(/(?:안내|공지|확정|알림|공유|전달|드립니다|드려요|입니다|관련|일정|건)(?=[\s!.,]|$)/g, ' '),
  );
  return t.replace(/[!.,]+$/, '').trim();
}

const meaningful = (s) => (String(s).match(LETTERS) || []).length >= 2;

function classify(text) {
  let best = 'etc';
  let score = 0;
  for (const [type, re] of Object.entries(TYPE_KEYWORDS)) {
    const n = (String(text).match(re) || []).length;
    if (n > score) {
      best = type;
      score = n;
    }
  }
  return best;
}

// ── 메인 ────────────────────────────────────────────────
/**
 * @param {string} text 붙여넣은 원문
 * @param {{ now?: Date }} [options]
 */
export function parseSchedule(text, { now = new Date() } = {}) {
  const today = startOfDay(now);
  const raw = String(text ?? '');
  const out = {
    title: '',
    type: 'etc',
    date: null,
    startTime: null,
    endTime: null,
    callTime: null,
    location: '',
    contactName: '',
    phone: '',
    agency: '',
    pay: null,
    payNote: '',
    notes: '',
    raw,
    uncertain: {},
  };
  const notes = [];
  const extraPhones = [];
  const dates = new Set();
  let titleFromLabel = false;
  let typeFromLabel = false;
  let payLines = 0;
  let locationGuessed = false;
  let agencyGuessed = false;

  const setDate = (r) => {
    if (!r.date) return;
    dates.add(r.date);
    if (!out.date) {
      out.date = r.date;
      if (r.reason) out.uncertain.date = r.reason;
    }
  };
  const setTimes = (r) => {
    if (!r.start || out.startTime) return;
    out.startTime = r.start;
    out.endTime = r.end;
    if (r.assumed) out.uncertain.startTime = '오전/오후 표기가 없어 추정했어요';
  };
  const addPhones = (phones) => {
    for (const p of phones) {
      if (!out.phone) out.phone = p;
      else if (p !== out.phone && !extraPhones.includes(p)) extraPhones.push(p);
    }
  };
  const setPay = (value, { bare }) => {
    const { amounts, rest, assumed } = extractAmounts(value, { bare });
    if (!amounts.length) return null;
    payLines += 1;
    if (out.pay == null) {
      out.pay = amounts[0];
      const note = tidy(rest.replace(/^(?:원|₩)/, '')).replace(/^\((.*)\)$/, '$1').trim();
      if (note && meaningful(note)) out.payNote = note;
      if (amounts.length > 1 && !out.payNote) out.payNote = amounts.slice(1).map(formatWon).join(', ');
      if (assumed) out.uncertain.pay = '단위가 없어 만원 단위로 추정했어요';
    } else {
      notes.push(tidy(value));
    }
    return rest;
  };

  const lines = normalize(raw)
    .replace(INLINE_LABEL_RE, (m, sep, label) => `${sep === ' ' ? '' : sep}\n${label}:`)
    .split('\n')
    .map(cleanLine);
  let pending = null; // 값이 다음 줄에 이어지는 라벨

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line) {
      pending = null;
      continue;
    }

    let field = null;
    let label = '';
    let value = line;
    const m = line.match(LABEL_RE);
    const strictMiss = m && m[2] && STRICT_LABELS.has(m[2]) && m[3] && !m[3].trim() && m[4];
    if (m && !strictMiss) {
      label = (m[1] || m[2]).replace(/\s+/g, '');
      field = LABEL_TO_FIELD.get(label) ?? LABEL_TO_FIELD.get(m[1] || m[2]);
      value = (m[4] || '').trim();
      if (!value) {
        pending = { field, label };
        continue;
      }
    } else if (pending) {
      ({ field, label } = pending);
    }
    pending = null;

    if (!field && GREETING.test(line) && line.length < 40) continue;
    if (!field && /^\S{1,8}님\s*[,!.~]*$/.test(line)) continue;

    switch (field) {
      case 'title': {
        const t = cleanTitle(value);
        if (t && (!titleFromLabel || !out.title)) {
          if (label === '내용' && out.title && titleFromLabel) notes.push(value);
          else {
            out.title = t;
            titleFromLabel = true;
          }
        }
        continue;
      }
      case 'type': {
        const id = TYPES.find((t) => value.includes(t.label))?.id ?? classify(value);
        if (id !== 'etc') {
          out.type = id;
          typeFromLabel = true;
        }
        continue;
      }
      case 'datetime':
      case 'time': {
        const { phones, rest: noPhone } = extractPhones(value);
        addPhones(phones);
        const d = extractDate(noPhone, today);
        setDate(d);
        const t = extractTimes(d.rest);
        setTimes(t);
        const leftover = tidy(t.rest.replace(/부터|까지|~|-/g, ' '));
        if (!d.date && !t.start) notes.push(`${label}: ${value}`);
        else if (leftover && meaningful(leftover) && leftover.length > 1) notes.push(leftover);
        continue;
      }
      case 'call': {
        const t = extractTimes(value);
        if (t.start) {
          if (!out.callTime) out.callTime = t.start;
          const d = extractDate(t.rest, today);
          setDate(d);
        } else notes.push(`${label}: ${value}`);
        continue;
      }
      case 'location': {
        const { phones, rest } = extractPhones(value);
        addPhones(phones);
        const loc = tidy(rest);
        if (!loc) continue;
        if (!out.location || locationGuessed) {
          out.location = loc;
          locationGuessed = false;
        } else if (!out.location.includes(loc)) out.location += `\n${loc}`;
        continue;
      }
      case 'contact': {
        const { phones, rest } = extractPhones(value);
        const name = tidy(rest.replace(/[()]/g, ' '));
        const isName = name && meaningful(name) && name.length <= 30 && !POLITE.test(name);
        if (isName && out.contactName && name !== out.contactName) {
          // 두 번째 담당자는 이름과 번호를 함께 메모로 남긴다.
          if (!out.phone) addPhones(phones);
          notes.push(`${label}: ${tidy(value)}`);
          continue;
        }
        addPhones(phones);
        if (isName) out.contactName ||= name;
        else if (!phones.length && name) notes.push(`${label}: ${value}`);
        if (['매니저', '실장'].includes(label) && out.contactName && !out.contactName.includes(label)) {
          out.contactName = `${out.contactName} ${label}`;
        }
        continue;
      }
      case 'agency': {
        const { phones, rest } = extractPhones(value);
        addPhones(phones);
        const a = tidy(rest);
        if (a && (!out.agency || agencyGuessed)) {
          out.agency = a;
          agencyGuessed = false;
        } else if (a && a !== out.agency) notes.push(`${label}: ${a}`);
        continue;
      }
      case 'pay': {
        if (setPay(value, { bare: true }) == null) notes.push(`${label}: ${value}`);
        else if (['시급', '일당'].includes(label) && !out.payNote.includes(label)) {
          out.payNote = tidy(`${label} ${out.payNote}`);
        }
        continue;
      }
      case 'notes': {
        notes.push(GENERIC_NOTE_LABELS.has(label) ? value : `${label}: ${value}`);
        continue;
      }
      default:
        break;
    }

    // ── 라벨이 없는 줄: 내용으로 추론 ──
    let rest = line;
    const ph = extractPhones(rest);
    rest = ph.rest;
    if (ph.phones.length) {
      addPhones(ph.phones);
      const name = tidy(rest.replace(/[()]/g, ' '));
      if (name && meaningful(name) && name.length <= 20 && !ADDRESS_RE.test(name) && !POLITE.test(name) && !out.contactName) {
        out.contactName = name;
        continue;
      }
    }

    if (/원|₩|만\s*원|\d\s*만(?![가-힣])/.test(rest)) {
      const r = setPay(rest, { bare: false });
      if (r != null) {
        rest = r;
        if (!meaningful(tidy(rest))) continue;
      }
    }

    const d = extractDate(rest, today);
    if (d.date) {
      setDate(d);
      rest = d.rest;
    }
    const t = extractTimes(rest);
    if (t.start) {
      setTimes(t);
      rest = t.rest;
    }

    const remainder = tidy(rest.replace(/부터|까지|\s~\s|^~|~$/g, ' '));
    if (!remainder || !meaningful(remainder)) continue;

    if (!out.location && ADDRESS_RE.test(remainder) && !/촬영|행사|미팅|오디션/.test(remainder.slice(0, 6))) {
      out.location = remainder;
      locationGuessed = true;
      continue;
    }
    if (!out.agency && AGENCY_RE.test(remainder) && remainder.length <= 30) {
      out.agency = remainder;
      agencyGuessed = true;
      continue;
    }
    if (!out.title) {
      const t2 = cleanTitle(remainder);
      if (t2 && meaningful(t2)) {
        out.title = t2;
        continue;
      }
    }
    notes.push(remainder);
  }

  // ── 마무리 ──
  if (!typeFromLabel) out.type = classify(`${out.title} ${out.title} ${raw}`);
  if (extraPhones.length) notes.push(`추가 연락처: ${extraPhones.join(', ')}`);
  out.notes = [...new Set(notes.filter(Boolean))].join('\n');

  if (!out.date) out.uncertain.date = '날짜를 찾지 못했어요';
  else if (dates.size > 1 && !out.uncertain.date) out.uncertain.date = '여러 날짜가 적혀 있어요. 첫 번째 날짜를 사용했어요';
  if (!out.title) {
    const label = TYPES.find((t) => t.id === out.type)?.label;
    out.title = out.type === 'etc' ? '' : `${label} 일정`;
    out.uncertain.title = '제목을 찾지 못해 자동으로 붙였어요';
  }
  if (out.endTime && out.startTime && out.endTime === out.startTime) out.endTime = null;
  if (locationGuessed) out.uncertain.location = '라벨이 없어 내용으로 추정했어요';
  if (agencyGuessed) out.uncertain.agency = '라벨이 없어 내용으로 추정했어요';
  if (payLines > 1 && !out.uncertain.pay) out.uncertain.pay = '금액이 여러 개 있어요. 첫 번째 금액을 사용했어요';
  if (extraPhones.length) out.uncertain.phone = '연락처가 여러 개 있어요';

  return out;
}

/** 추출된 항목 수(제목 제외) — 결과 요약에 사용 */
export function countFields(r) {
  return ['date', 'startTime', 'location', 'phone', 'contactName', 'agency', 'pay', 'notes'].filter(
    (k) => r[k] != null && r[k] !== '',
  ).length;
}
