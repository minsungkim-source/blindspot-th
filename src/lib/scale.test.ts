/**
 * 색 스케일 — 특히 **바닥값을 램프에서 빼내는** 처리.
 *
 * 고치기 전 실제 데이터에서 우선순위 레이어는 7단계 램프 중 4단계만 썼고
 * 77개 주 중 44개가 같은 색이었다. 원인은 `priority = clip(gap_raw × log10(인구), 0)`이라
 * 공급이 수요 이상인 40개 주가 **정확히 0**이고, 분위수가 그 덩어리를 한 칸에
 * 몰아넣으면서 경계까지 끌어당긴 것이다.
 *
 * 색이라 눈으로 봐야 알 것 같지만 실은 셀 수 있다. 세어서 고정한다.
 */

import { describe, expect, it } from "vitest";
import { FLOOR, NO_DATA, SEQUENTIAL, isFloor, sequentialScale } from "./scale";

/** 고친 뒤의 실제 색 결정 경로. GapMap의 colorFor와 같은 순서다. */
const paint = (values: number[], floor?: number) => {
  const s = sequentialScale(values, floor);
  return values.map((v) => (isFloor(v, floor) ? FLOOR : s(v)));
};

/** 실제 분포를 닮은 표본 — 77개 중 40개가 정확히 0. */
const priorityLike = () => [
  ...Array(40).fill(0),
  ...Array.from({ length: 37 }, (_, i) => 2.5 + i * 2.6),
];

describe("sequentialScale", () => {
  it("바닥값이 없으면 지금까지와 똑같이 동작한다", () => {
    const vals = Array.from({ length: 77 }, (_, i) => i + 1);
    expect(new Set(paint(vals)).size).toBe(SEQUENTIAL.length);
  });

  it("바닥값 덩어리가 램프를 잡아먹던 것을 막는다", () => {
    const vals = priorityLike();

    // 고치기 전: 바닥값도 램프에 넣으면 칸이 남아돈다
    const before = new Set(paint(vals));
    expect(before.size).toBeLessThan(SEQUENTIAL.length);

    // 고친 뒤: 램프 7칸이 전부 쓰이고 + 바닥값 색 하나
    const after = new Set(paint(vals, 0));
    expect(after.size).toBe(SEQUENTIAL.length + 1);
    expect(after.has(FLOOR)).toBe(true);
  });

  it("바닥값 주는 램프 색을 절대 받지 않는다", () => {
    const vals = priorityLike();
    const painted = paint(vals, 0);
    for (let i = 0; i < 40; i++) expect(painted[i]).toBe(FLOOR);
    for (let i = 40; i < vals.length; i++) expect(painted[i]).not.toBe(FLOOR);
  });

  it("바닥값 색은 '데이터 없음'과 달라야 한다 — 뜻이 다르다", () => {
    // 하나는 '값을 모른다', 다른 하나는 '값을 알고 그 값이 척도 밖이다'.
    // 같은 색이면 지도가 그 둘을 구분해 말할 수 없다.
    expect(FLOOR).not.toBe(NO_DATA);
    expect(SEQUENTIAL as readonly string[]).not.toContain(FLOOR);
  });

  it("전부 바닥값이어도 죽지 않는다", () => {
    const painted = paint(Array(10).fill(0), 0);
    expect(new Set(painted)).toEqual(new Set([FLOOR]));
  });

  it("바닥값이 하나도 없는 레이어에서는 램프가 온전하다", () => {
    // 갭 레이어처럼 바닥값 개념이 없는 경우. floor를 넘겨도 걸리는 값이 없다.
    const vals = Array.from({ length: 77 }, (_, i) => 18 + i * 0.8);
    expect(new Set(paint(vals, 0)).size).toBe(SEQUENTIAL.length);
  });
});

describe("isFloor", () => {
  it("floorAt이 없으면 아무것도 바닥값이 아니다", () => {
    expect(isFloor(0)).toBe(false);
    expect(isFloor(-1)).toBe(false);
  });

  it("결측은 바닥값이 아니다 — '모름'과 '해당 없음'은 다르다", () => {
    expect(isFloor(null, 0)).toBe(false);
  });

  it("경계는 포함한다", () => {
    expect(isFloor(0, 0)).toBe(true);
    expect(isFloor(0.0001, 0)).toBe(false);
  });
});
