import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSchedule, formatPhone, formatWonShort, regionTitle } from '../js/parser.js';
import { toIcs } from '../js/ics.js';

const now = new Date(2026, 9, 21, 10, 0); // 2026-10-21 (수)
const parse = (t) => parseSchedule(t, { now });

test('라벨이 붙은 전형적인 촬영 안내', () => {
  const r = parse(`[촬영 안내] 나이키 러닝화 광고
일시: 10월 24일(토) 오전 9시 ~ 오후 6시
집합: 8시 30분
장소: 서울 성동구 성수이로 113, 3층 스튜디오
담당: 김민지 실장 010-1234-5678
에이전시: 모노 에이전시
페이: 25만원 (3.3% 공제)
준비물: 블랙 정장, 구두
특이사항: 30분 전 도착 부탁드립니다
감사합니다`);
  assert.equal(r.title, '나이키 러닝화 광고');
  assert.equal(r.type, 'shoot');
  assert.equal(r.date, '2026-10-24');
  assert.equal(r.startTime, '09:00');
  assert.equal(r.endTime, '18:00');
  assert.equal(r.callTime, '08:30');
  assert.equal(r.location, '서울 성동구 성수이로 113, 3층 스튜디오');
  assert.equal(r.contactName, '김민지 실장');
  assert.equal(r.phone, '010-1234-5678');
  assert.equal(r.agency, '모노 에이전시');
  assert.equal(r.pay, 250000);
  assert.equal(r.tax, '3.3% 공제');
  assert.equal(r.payNote, '');
  assert.match(r.notes, /준비물: 블랙 정장, 구두/);
  assert.match(r.notes, /30분 전 도착/);
  assert.deepEqual(r.uncertain, {});
});

test('요일 불일치는 확인 필요로 표시', () => {
  const r = parse('일시: 10월 24일(금) 10:00\n행사');
  assert.equal(r.date, '2026-10-24');
  assert.match(r.uncertain.date, /금요일/);
});

test('라벨 없는 카톡 메시지', () => {
  const r = parse(`민지님 안녕하세요!
11/3 (화) 오후 2시~6시 신세계 팝업 행사 MC
더현대 서울 5층 이벤트홀
페이 30 / 당일 정산
문의 010 9876 5432 박팀장`);
  assert.equal(r.date, '2026-11-03');
  assert.equal(r.startTime, '14:00');
  assert.equal(r.endTime, '18:00');
  assert.equal(r.type, 'event');
  assert.match(r.title, /신세계 팝업 행사 MC/);
  assert.match(r.location, /더현대 서울/);
  assert.equal(r.pay, 300000);
  assert.ok(r.uncertain.pay, '단위 없는 금액은 확인 필요');
  assert.equal(r.payDate, '2026-11-03', '당일 정산 → 일정 날짜');
  assert.equal(r.payNote, '');
  assert.equal(r.tax, '');
  assert.equal(r.phone, '010-9876-5432');
  assert.equal(r.contactName, '박팀장');
});

test('연도가 있는 날짜와 24시간 표기', () => {
  const r = parse('2026.12.05 13:30-15:00 브랜드 미팅 @ 강남구 테헤란로 152');
  assert.equal(r.date, '2026-12-05');
  assert.equal(r.startTime, '13:30');
  assert.equal(r.endTime, '15:00');
  assert.equal(r.type, 'meeting');
});

test('오전/오후 없는 이른 시간은 오후로 추정', () => {
  const r = parse('내일 3시 오디션\n장소: 압구정 OO캐스팅 사무실');
  assert.equal(r.date, '2026-10-22');
  assert.equal(r.startTime, '15:00');
  assert.ok(r.uncertain.startTime);
  assert.equal(r.type, 'audition');
});

test('다음주 요일 표현', () => {
  const r = parse('다음주 금요일 저녁 7시 반 리허설');
  assert.equal(r.date, '2026-10-30');
  assert.equal(r.startTime, '19:30');
  assert.equal(r.type, 'lesson');
});

test('지난 달 날짜는 내년으로', () => {
  const r = parse('1월 5일 촬영');
  assert.equal(r.date, '2027-01-05');
});

test('다음 줄에 값이 오는 라벨', () => {
  const r = parse('장소\n서울 마포구 양화로 45\n\n페이\n150,000원');
  assert.equal(r.location, '서울 마포구 양화로 45');
  assert.equal(r.pay, 150000);
});

test('이모지 라벨', () => {
  const r = parse('📅 10/28 (수) 10:00\n📍 성수동 OO스튜디오\n📞 010-2222-3333\n💰 20만 5천원');
  assert.equal(r.date, '2026-10-28');
  assert.equal(r.location, '성수동 OO스튜디오');
  assert.equal(r.phone, '010-2222-3333');
  assert.equal(r.pay, 205000);
});

test('정보가 없는 텍스트는 날짜 없음으로 표시', () => {
  const r = parse('확인 부탁드립니다');
  assert.equal(r.date, null);
  assert.ok(r.uncertain.date);
});

test('시간 같은 문구는 라벨로 오인하지 않음', () => {
  const r = parse('10월 30일 촬영\n시간 엄수 부탁드립니다');
  assert.equal(r.startTime, null);
  assert.match(r.notes, /시간 엄수/);
});

test('여러 연락처', () => {
  const r = parse('담당: 김실장 010-1111-2222\n현장: 이매니저 010-3333-4444');
  assert.equal(r.phone, '010-1111-2222');
  assert.equal(r.contactName, '김실장');
  assert.match(r.notes, /010-3333-4444/);
});

test('포맷터', () => {
  assert.equal(formatPhone('01012345678'), '010-1234-5678');
  assert.equal(formatPhone('0212345678'), '02-1234-5678');
  assert.equal(formatWonShort(250000), '25만원');
  assert.equal(formatWonShort(255000), '25만 5천원');
});

test('시간 뒤 "쯤"은 제목에 남기지 않음', () => {
  const r = parse('내일 3시쯤 미팅');
  assert.equal(r.startTime, '15:00');
  assert.equal(r.title, '미팅');
});

test('한 줄에 여러 라벨', () => {
  const r = parse('미팅 장소: 홍대입구역 3번 출구 / 일시: 11월 4일 오후 2시');
  assert.equal(r.title, '미팅');
  assert.equal(r.location, '홍대입구역 3번 출구');
  assert.equal(r.date, '2026-11-04');
  assert.equal(r.startTime, '14:00');
});

// ── 지역 + 의전 제목 ──
test('제목이 없으면 지역 + 의전', () => {
  assert.equal(regionTitle('서울 강동구 고덕동 123-4'), '고덕의전');
  assert.equal(regionTitle('서울 강남구 테헤란로 152'), '강남의전');
  assert.equal(regionTitle('경기 남양주시 다산순환로 20'), '남양주의전');
  assert.equal(regionTitle('서울특별시 중구 세종대로 110'), '중의전');
  assert.equal(regionTitle('양평군 양서면 북한강로'), '양평의전');
  assert.equal(regionTitle('더현대 서울 5층 이벤트홀'), '더현대의전');
  assert.equal(regionTitle(''), '의전');
  const r = parse('10월 30일 오전 10시\n장소: 서울 강동구 고덕동 고덕로 333');
  assert.equal(r.title, '고덕의전');
  assert.ok(r.uncertain.title);
});

// ── 세금공제 ──
test('세금공제 표현', () => {
  assert.equal(parse('10/30 행사\n페이: 20만원 3.3 공제').tax, '3.3% 공제');
  assert.equal(parse('10/30 행사\n페이 20만 (8.8%)').tax, '8.8% 공제');
  assert.equal(parse('10/30 행사\n페이 20만원 원천징수').tax, '원천징수');
  assert.equal(parse('10/30 행사\n페이 20만원 세금 공제 후 입금').tax, '세금 공제');
  assert.equal(parse('10/30 행사\n페이 20만원 공제 없음').tax, '공제 없음');
  assert.equal(parse('10/30 행사\n페이 20만원(세후)').tax, '세후');
  assert.equal(parse('10/30 행사\n페이 실수령 20만원').tax, '실수령');
  assert.equal(parse('10/30 행사\n특이사항: 3.3% 공제 후 지급').tax, '3.3% 공제');
});

test('세금 이야기가 없으면 빈칸', () => {
  const r = parse('10/30 행사\n페이: 20만원');
  assert.equal(r.tax, '');
  assert.equal(r.payNote, '');
});

// ── 페이 지급일 ── (일정 날짜 2026-10-24 기준)
test('지급일 표현별 계산', () => {
  const base = '일시: 10월 24일 오전 10시\n장소: 강남구 테헤란로 1\n';
  const pd = (t) => parse(base + t).payDate;
  assert.equal(pd('페이: 25만원 당일 지급'), '2026-10-24');
  assert.equal(pd('페이 25만원 익일 입금'), '2026-10-25');
  assert.equal(pd('페이 25만원 익월 10일 지급'), '2026-11-10');
  assert.equal(pd('페이 25만원 다음달 10일'), '2026-11-10');
  assert.equal(pd('페이 25만원 말일 지급'), '2026-10-31');
  assert.equal(pd('페이 25만원 익월 말일'), '2026-11-30');
  assert.equal(pd('페이 25만원\n11월 5일 입금'), '2026-11-05');
  assert.equal(pd('지급일: 11/7'), '2026-11-07');
  assert.equal(pd('페이 25만원 2주 후 지급'), '2026-11-07');
  assert.equal(pd('페이 25만원 한 달 후 입금'), '2026-11-24');
  assert.equal(pd('입금일: 15일'), '2026-11-15');
  assert.equal(pd('페이 25만원'), null);
});

test('지급일 문구는 일정 날짜로 오인하지 않음', () => {
  const r = parse('페이 25만원 11월 5일 입금\n일시: 10월 24일 10시');
  assert.equal(r.date, '2026-10-24');
  assert.equal(r.payDate, '2026-11-05');
});

// ── 아이폰 캘린더 메모(DESCRIPTION) ──
const desc = (ics) => {
  const unfolded = ics.replace(/\r\n /g, '');
  return unfolded.match(/DESCRIPTION:(.*)/)[1].replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1');
};

test('원문을 그대로 메모 칸에 넣음', () => {
  const raw = '[촬영 안내] 나이키 광고\n일시: 10월 24일 9시, 장소; 성수\n페이: 25만원 (3.3% 공제)';
  const e = { id: 'a', title: 't', date: '2026-10-24', startTime: '09:00', raw, pay: 250000, agency: '모노' };
  assert.equal(desc(toIcs([e])), raw);
});

test('직접 쓴 메모는 원문 위에 빈 줄로 구분', () => {
  const e = { id: 'a', title: 't', date: '2026-10-24', raw: '원문 첫 줄\n둘째 줄', memo: '내 메모' };
  assert.equal(desc(toIcs([e])), '내 메모\n\n원문 첫 줄\n둘째 줄');
});

test('원문이 없으면 항목 요약', () => {
  const e = { id: 'a', title: 't', date: '2026-10-24', agency: '모노', pay: 250000, tax: '3.3% 공제' };
  assert.match(desc(toIcs([e])), /에이전시: 모노/);
  assert.match(desc(toIcs([e])), /3\.3% 공제/);
});
