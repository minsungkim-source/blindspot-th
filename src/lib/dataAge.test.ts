import { describe, expect, it } from "vitest";
import { STALE_MONTHS, formatAge, monthsSince } from "./dataAge";

const d = (y: number, m: number, day = 15) => new Date(y, m - 1, day);

describe("monthsSince", () => {
  it("지금 실제 상황 — BOT 2025-06, 오늘 2026-09 → 15개월", () => {
    expect(monthsSince("2025-06", d(2026, 9))).toBe(15);
  });
  it("같은 달은 0, 연도를 넘어도 맞다", () => {
    expect(monthsSince("2026-09", d(2026, 9))).toBe(0);
    expect(monthsSince("2025-12", d(2026, 1))).toBe(1);
  });
  it("날짜가 붙은 ISO도 읽는다", () => {
    expect(monthsSince("2025-06-30T00:00:00Z", d(2026, 9))).toBe(15);
  });
  it("못 읽는 값은 null — 추측하지 않는다", () => {
    for (const v of [null, undefined, "", "JUN 2025 p", "2025-13"]) {
      expect(monthsSince(v, d(2026, 9))).toBeNull();
    }
  });
  it("기기 시계가 과거여도 음수를 내지 않는다", () => {
    expect(monthsSince("2026-09", d(2026, 7))).toBe(0);
  });
  it("15개월은 경고 대상이다", () => {
    expect(15).toBeGreaterThanOrEqual(STALE_MONTHS);
  });
});

describe("formatAge", () => {
  it("로캘이 복수형과 0·1을 처리한다", () => {
    expect(formatAge(15, "ko-KR")).toBe("15개월 전");
    expect(formatAge(15, "en-US")).toBe("15 months ago");
    expect(formatAge(1, "en-US")).toBe("last month");
    expect(formatAge(0, "ko-KR")).toBe("이번 달");
  });
});
