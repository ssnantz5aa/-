// 붙여넣기 → 분석 → 결과 화면으로 이어지는 공통 흐름
import { parseSchedule } from './parser.js';
import { session } from './store.js';
import { go, toast } from './ui.js';

export async function readClipboard() {
  if (!navigator.clipboard?.readText) {
    toast('이 브라우저에서는 길게 눌러 붙여넣어 주세요');
    return null;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      toast('클립보드가 비어 있어요');
      return null;
    }
    return text;
  } catch {
    toast('클립보드 접근이 허용되지 않았어요. 길게 눌러 붙여넣어 주세요');
    return null;
  }
}

/** 분석은 즉시 끝나지만, 진행 표시가 깜빡이지 않도록 짧은 최소 시간을 둔다. */
export async function analyzeAndReview(text, { onStart, onEnd } = {}) {
  if (!text.trim()) {
    toast('분석할 텍스트를 먼저 입력해 주세요');
    return;
  }
  onStart?.();
  const started = performance.now();
  let result;
  try {
    result = parseSchedule(text);
  } catch (err) {
    console.error(err);
    onEnd?.();
    toast('텍스트를 분석하지 못했어요. 직접 입력해 주세요', { kind: 'error' });
    return;
  }
  const wait = Math.max(0, 480 - (performance.now() - started));
  await new Promise((r) => setTimeout(r, wait));
  session.set('compose', text);
  session.set('draft', { ...result, source: 'parsed' });
  onEnd?.();
  go('#/review');
}

export function startManual(date) {
  session.set('draft', {
    title: '', type: 'etc', date: date || null, startTime: null, endTime: null, callTime: null,
    location: '', contactName: '', phone: '', agency: '', pay: null, payNote: '', tax: '', payDate: null, paid: false, paidAt: null, notes: '', memo: '', raw: '',
    uncertain: {}, source: 'manual',
  });
  go('#/review');
}
