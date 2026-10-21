import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSchedule, formatPhone, formatWonShort } from '../js/parser.js';

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
  assert.equal(r.payNote, '3.3% 공제');
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
