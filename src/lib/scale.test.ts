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


/* ── 램프 자체의 성질 ─────────────────────────────────────────────
   "갭이 클수록 진하게" — 사용자가 짚은 요구를 측정 가능한 형태로 고정한다.
   예전 램프는 밝기는 올랐지만 채도가 3단계부터 빠져서(0.161 → 0.041) 갭이 가장 큰
   주가 파스텔로 보였다. 밝기만 보면 통과하던 램프라, 채도를 따로 잰다. */

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number];

/** OKLCH의 L(밝기)·C(채도). 사람 눈의 밝기·선명도에 가깝게 맞춘 색공간이다. */
function oklch(hex: string) {
  const [r, g, b] = rgb(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B) };
}

const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

const SURFACE = "#0e1113"; // tokens.css --surface

describe("순차 램프의 성질", () => {
  const steps = SEQUENTIAL.map(oklch);

  it("갭이 클수록 밝다 — 어두운 배경에서 밝은 쪽이 눈에 먼저 들어온다", () => {
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.L).toBeGreaterThan(steps[i - 1]!.L);
    }
  });

  it("갭이 클수록 진하다 — 위 끝이 파스텔로 흐려지면 '약하다'로 읽힌다", () => {
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.C, `${i + 1}단계 채도가 ${i}단계보다 낮다`).toBeGreaterThanOrEqual(steps[i - 1]!.C - 0.002);
    }
    // 가장 진한 색이 갭 최고 단계에 있어야 한다
    const maxC = Math.max(...steps.map((s) => s.C));
    expect(steps.at(-1)!.C).toBeCloseTo(maxC, 2);
  });

  it("가장 어두운 단계도 표면에서 보인다 — 77개 주가 전부 보여야 한다 (DESIGN.md §2.2)", () => {
    expect(contrast(SEQUENTIAL[0], SURFACE)).toBeGreaterThan(2);
  });

  it("램프의 첫 칸은 바닥값·데이터없음과 채도로 구분된다", () => {
    // 우선순위 레이어에서 '대상 아님'(회색)과 '대상 중 최하위'(남색)가 나란히 선다.
    // 밝기가 비슷해도 색기가 있어야 둘을 가를 수 있다.
    expect(steps[0]!.C).toBeGreaterThan(oklch(FLOOR).C + 0.05);
    expect(steps[0]!.C).toBeGreaterThan(oklch(NO_DATA).C + 0.05);
  });
});
