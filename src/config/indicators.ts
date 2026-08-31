/**
 * 지표 정의 — 라벨·단위·포맷·신뢰등급의 단일 출처.
 * 지표를 추가하거나 문구를 바꿀 때 컴포넌트를 건드리지 않는다.
 */

export type Grade = "measured" | "derived" | "estimated" | "missing";

export const GRADE_LABEL: Record<Grade, string> = {
  measured: "실측",
  derived: "가공",
  estimated: "추정",
  missing: "없음",
};

export const GRADE_COLOR: Record<Grade, string> = {
  measured: "var(--good)",
  derived: "var(--warning)",
  estimated: "var(--serious)",
  missing: "var(--critical)",
};

export interface Indicator {
  key: string;
  label: string;
  unit: string;
  axis: "supply" | "demand" | "digital" | "context";
  grade: Grade;
  source: string;
  /** 낮을수록 갭이 크다는 뜻이면 true */
  invert?: boolean;
  format: (v: number | null) => string;
}

const n0 = (v: number | null) => (v == null ? "—" : v.toLocaleString("ko-KR", { maximumFractionDigits: 0 }));
const n1 = (v: number | null) => (v == null ? "—" : v.toLocaleString("ko-KR", { maximumFractionDigits: 1 }));
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const baht = (v: number | null) => (v == null ? "—" : `฿${(v / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}M`);

export const INDICATORS: Indicator[] = [
  { key: "branches",          label: "지점 수",        unit: "개",        axis: "supply",  grade: "measured",  source: "BOT FI_CB_011_S4", format: n0 },
  { key: "branch_density",    label: "지점 밀도",      unit: "개/10만명", axis: "supply",  grade: "derived",   source: "BOT + NESDC",      format: n1 },
  { key: "geographic_access", label: "지리적 접근성",  unit: "개/1,000km²", axis: "supply", grade: "derived",  source: "BOT + 행정경계",   format: n1 },
  { key: "deposit_per_capita",label: "1인당 예금",     unit: "바트",      axis: "supply",  grade: "derived",   source: "BOT + NESDC",      format: baht },
  { key: "credit_per_capita", label: "1인당 여신",     unit: "바트",      axis: "supply",  grade: "derived",   source: "BOT + NESDC",      format: baht },
  { key: "atm_density",       label: "ATM 밀도",       unit: "개/10만명", axis: "supply",  grade: "estimated", source: "OpenStreetMap",    format: n1 },

  { key: "population",        label: "인구",           unit: "명",        axis: "demand",  grade: "measured",  source: "NESDC",            format: n0 },
  { key: "gpp_per_capita",    label: "1인당 GPP",      unit: "바트",      axis: "demand",  grade: "measured",  source: "NESDC",  invert: true, format: n0 },
  { key: "population_density",label: "인구밀도",       unit: "명/km²",    axis: "demand",  grade: "derived",   source: "NESDC + 행정경계", invert: true, format: n1 },
  { key: "gpp_agriculture_share", label: "농림어업 비중", unit: "%",     axis: "demand",  grade: "measured",  source: "NESDC",            format: pct },
  { key: "credit_deposit",    label: "예대율",         unit: "배",        axis: "demand",  grade: "measured",  source: "BOT",    invert: true, format: n1 },

  { key: "digital_readiness", label: "디지털 준비도",  unit: "점",        axis: "digital", grade: "estimated", source: "NSO ICT 권역값 하향 추정", format: n1 },
];

/** 지도 레이어 — 한 번에 하나만 보여준다 (순차 컨텍스트를 겹치지 않는다) */
export const MAP_LAYERS = [
  { key: "gap",                 label: "갭 점수",     scale: "sequential" as const, grade: "derived" as Grade },
  { key: "priority",            label: "우선순위",     scale: "sequential" as const, grade: "derived" as Grade },
  { key: "branch_density",      label: "지점 밀도",   scale: "sequential" as const, grade: "derived" as Grade },
  { key: "deposit_per_capita",  label: "1인당 예금",  scale: "sequential" as const, grade: "derived" as Grade },
  { key: "credit_deposit",      label: "예대율",      scale: "diverging" as const,  grade: "measured" as Grade },
];

export const ARCHETYPES = {
  agent_kiosk:      { label: "에이전트 · 키오스크", action: "에이전트 리크루팅, 키오스크 배치, 캐시인/아웃 유동성" },
  digital_first:    { label: "디지털 우선",         action: "원격 KYC, 앱 획득 캠페인, 디지털 대출 파일럿" },
  retain_crosssell: { label: "유지 · 크로스셀",      action: "상품 침투 확대, 저예대율이면 대출 푸시" },
  watch:            { label: "관망",                action: "분기별 재평가, 인접 주 확장의 부수 효과" },
} as const;

export type ArchetypeKey = keyof typeof ARCHETYPES;
