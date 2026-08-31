/** 색 스케일. 값의 근거와 대비 수치는 DESIGN.md §2. */

import { scaleQuantile, scaleThreshold } from "d3-scale";

/** 순차 램프 — 갭 강도. 어두움→밝음. 가장 어두운 단계도 표면 대비 2.87:1. */
export const SEQUENTIAL = [
  "#1c5cab", "#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#9ec5f4", "#cde2fb",
] as const;

export const NO_DATA = "#21262b";

/** 발산형 — 전국 평균이라는 자연스러운 중간값이 있는 지표에만. 중간값은 무채색. */
export const DIVERGING = [
  "#1c5cab", "#3987e5", "#2e353b", "#e66767", "#c04a4a",
] as const;

export function sequentialScale(values: number[]) {
  return scaleQuantile<string>()
    .domain(values.filter(Number.isFinite))
    .range([...SEQUENTIAL]);
}

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
