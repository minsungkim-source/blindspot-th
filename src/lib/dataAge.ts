/**
 * 데이터 기준시점의 나이.
 *
 * 머리말에 `BOT JUN 2025 p`라고만 적어 두면, 보는 사람이 그게 얼마나 오래된 건지
 * 직접 계산해야 한다. 2026-09 현재 BOT이 공개한 최신 주별 통계가 2025-06이다 —
 * 지점·예금·여신, 즉 공급 축 전체가 15개월 전 상태다. 확장 판단에 쓰는 도구라면
 * 이건 한눈에 보여야 한다.
 */

/**
 * 반년 넘게 새 달이 안 나왔으면 경고한다. 월간 통계에 반년의 공백은 평소의 공표
 * 지연으로 보기 어렵다 — 그때부터는 "최신 데이터"가 아니라 "그 시점의 스냅숏"이다.
 */
export const STALE_MONTHS = 6;

/** 'YYYY-MM'(또는 'YYYY-MM-DD…') 기준시점이 오늘로부터 몇 달 전인가. 못 읽으면 null. */
export function monthsSince(asOfIso: string | null | undefined, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(asOfIso ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const diff = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - mo);
  return diff < 0 ? 0 : diff;   // 시계가 틀린 기기에서 "−2개월 전"을 내지 않는다
}

/** "15개월 전" / "15 months ago" / "지난달" — 복수형·0·1은 로캘이 처리한다. */
export function formatAge(months: number, locale: string): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-months, "month");
}
