/** 표 정렬 — 결측·동점·방향. */

import { describe, expect, it } from "vitest";
import { compareRows } from "./RankTable";
import type { ProvinceRecord, Scored } from "@/lib/score";

const row = (code: string, priority: number | null, gap: number | null) =>
  ({ tis1099_code: code, priority, gap } as unknown as Scored<ProvinceRecord>);
const order = (rows: Scored<ProvinceRecord>[], asc: boolean) =>
  rows.slice().sort(compareRows((r) => r.priority, asc)).map((r) => r.tis1099_code);

describe("compareRows", () => {
  it("결측은 방향과 무관하게 맨 아래", () => {
    const rows = [row("a", null, 10), row("b", 5, 10), row("c", 9, 10)];
    expect(order(rows, false)).toEqual(["c", "b", "a"]);
    expect(order(rows, true)).toEqual(["b", "c", "a"]);
  });

  it("둘 다 결측이면 0 — 비교가 앞뒤가 맞아야 한다", () => {
    // 예전엔 (a, b)도 1, (b, a)도 1이었다. 정렬 알고리즘은 이 대칭성을 전제한다.
    const cmp = compareRows((r) => r.priority, false);
    const a = row("a", null, 5);
    const b = row("b", null, 5);
    expect(cmp(a, b)).toBe(0);
    expect(cmp(b, a)).toBe(0);
  });

  it("비교는 반대칭이다 — cmp(a,b)와 cmp(b,a)의 부호가 반대", () => {
    const rows = [row("a", 0, 30), row("b", 0, 20), row("c", null, 10), row("d", 7, 5), row("e", null, null)];
    for (const asc of [true, false]) {
      const cmp = compareRows((r) => r.priority, asc);
      for (const x of rows) for (const y of rows) {
        expect(Math.sign(cmp(x, y))).toBe(-Math.sign(cmp(y, x)) || 0);
      }
    }
  });

  it("우선순위가 같으면(대상 아님 = 0) 갭이 큰 쪽이 먼저", () => {
    // 40개 주가 정확히 0이다. 갭으로 가르지 않으면 주 코드 순으로 늘어선다.
    const rows = [row("10", 0, 16.1), row("11", 0, 29.6), row("12", 0, 26.5), row("30", 12, 60)];
    expect(order(rows, false)).toEqual(["30", "11", "12", "10"]);
  });
});
