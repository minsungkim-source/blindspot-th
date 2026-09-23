/** 색 스케일. 값의 근거와 대비 수치는 DESIGN.md §2. */

import { scaleQuantile, scaleThreshold } from "d3-scale";

/** 순차 램프 — 갭 강도. 어두움→밝음. 가장 어두운 단계도 표면 대비 2.87:1. */
export const SEQUENTIAL = [
  "#1c5cab", "#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#9ec5f4", "#cde2fb",
] as const;

export const NO_DATA = "#21262b";

/**
 * 바닥값 — 순차 램프에서 **빼내는** 범주.
 *
 * `NO_DATA`와 다르다. 저쪽은 "값을 모른다"이고 이쪽은 "값을 알고, 그 값이
 * 척도의 바깥이다"이다. 우선순위가 정확히 그 경우다 — 공급이 수요 이상인 주는
 * `clip(lower=0)`에 걸려 전부 0이고, 그것은 '우선순위가 낮은 것'이 아니라
 * '우선순위 대상이 아닌 것'이다.
 *
 * 램프 한 칸을 주면 두 가지가 동시에 망가진다. 연속선상의 최하위처럼 읽히고,
 * 분위수가 그 덩어리에 먹혀 나머지 주들이 쓸 칸이 줄어든다 (실측: 7칸 중 4칸).
 */
export const FLOOR = "#2e353b";

/** 발산형 — 전국 평균이라는 자연스러운 중간값이 있는 지표에만. 중간값은 무채색. */
export const DIVERGING = [
  "#1c5cab", "#3987e5", "#2e353b", "#e66767", "#c04a4a",
] as const;

/**
 * @param floorAt 이 값 이하는 분위수 계산에서 **제외한다**. 제외하지 않으면
 *   바닥값 덩어리가 분위 경계를 끌어당겨 나머지 값들이 램프를 다 못 쓴다.
 */
export function sequentialScale(values: number[], floorAt?: number) {
  const finite = values.filter(Number.isFinite);
  const domain = floorAt == null ? finite : finite.filter((v) => v > floorAt);
  return scaleQuantile<string>()
    // 전부 바닥값이면 도메인이 비는데, 그때는 아래 isFloor가 모든 값을 가로채므로
    // 이 스케일이 호출되지 않는다. 그래도 d3가 undefined를 내지 않게 원본으로 둔다.
    .domain(domain.length ? domain : finite)
    .range([...SEQUENTIAL]);
}

/** 값이 바닥값 범주인가. `floorAt`이 없으면 항상 false다. */
export const isFloor = (v: number | null, floorAt?: number) =>
  floorAt != null && v != null && v <= floorAt;

/** 전국 평균을 중심으로 대칭 구간을 잡는다. */
export function divergingScale(values: number[], midpoint: number) {
  const finite = values.filter(Number.isFinite);
  const spread = Math.max(
    ...finite.map((v) => Math.abs(v - midpoint)),
  );
  const step = spread / 2;
  return scaleThreshold<number, string>()
    .domain([midpoint - step, midpoint - step / 2, midpoint + step / 2, midpoint + step])
    .range([...DIVERGING]);
}

export const fillFor = (color: string | undefined) => color ?? NO_DATA;
