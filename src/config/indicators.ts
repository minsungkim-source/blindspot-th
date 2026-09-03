/**
 * 지표 정의 — 단위·포맷·신뢰등급의 단일 출처.
 * 지표를 추가하거나 문구를 바꿀 때 컴포넌트를 건드리지 않는다.
 *
 * **표시 문구는 여기 없고 i18n 사전에 있다.** 여기는 어떤 키를 쓰는지만 안다 —
 * 라벨을 여기에 두면 언어가 늘 때마다 이 파일이 언어 수만큼 부풀고,
 * 결국 사전과 어긋난다.
 */

import type { Key } from "@/i18n/strings";

export type Grade = "measured" | "derived" | "estimated" | "missing";

export const GRADE_KEY: Record<Grade, Key> = {
  measured: "grade.measured",
  derived: "grade.derived",
  estimated: "grade.estimated",
  missing: "grade.missing",
};

export const GRADE_COLOR: Record<Grade, string> = {
  measured: "var(--good)",
  derived: "var(--warning)",
  estimated: "var(--serious)",
  missing: "var(--critical)",
};

/** 숫자 포맷은 로케일을 받는다 — 자릿수 구분이 언어마다 다르다. */
export type Formatter = (v: number | null, locale: string) => string;

export interface Indicator {
  key: string;
  /** i18n 사전의 라벨 키 */
  labelKey: Key;
  unitKey: Key;
  axis: "supply" | "demand" | "digital" | "context";
  grade: Grade;
  /** 출처는 기관명이라 번역하지 않는다 */
  source: string;
  /** 낮을수록 갭이 크다는 뜻이면 true */
  invert?: boolean;
  format: Formatter;
}

const dec = (digits: number): Formatter => (v, locale) =>
  v == null ? "—" : v.toLocaleString(locale, { maximumFractionDigits: digits });
const pct: Formatter = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
const baht: Formatter = (v, locale) =>
  v == null ? "—" : `฿${(v / 1e6).toLocaleString(locale, { maximumFractionDigits: 1 })}M`;

export const INDICATORS: Indicator[] = [
  { key: "branches",           labelKey: "ind.branches",           unitKey: "unit.count",   axis: "supply",  grade: "measured",  source: "BOT FI_CB_011_S4", format: dec(0) },
  { key: "branch_density",     labelKey: "ind.branch_density",     unitKey: "unit.perPop",  axis: "supply",  grade: "derived",   source: "BOT + NESDC",      format: dec(1) },
  { key: "geographic_access",  labelKey: "ind.geographic_access",  unitKey: "unit.perArea", axis: "supply",  grade: "derived",   source: "BOT + ADM1",       format: dec(1) },
  { key: "deposit_per_capita", labelKey: "ind.deposit_per_capita", unitKey: "unit.baht",    axis: "supply",  grade: "derived",   source: "BOT + NESDC",      format: baht },
  { key: "credit_per_capita",  labelKey: "ind.credit_per_capita",  unitKey: "unit.baht",    axis: "supply",  grade: "derived",   source: "BOT + NESDC",      format: baht },
  { key: "atm_density",        labelKey: "ind.atm_density",        unitKey: "unit.perPop",  axis: "supply",  grade: "estimated", source: "OpenStreetMap",    format: dec(1) },

  { key: "population",             labelKey: "ind.population",             unitKey: "unit.people",  axis: "demand", grade: "measured", source: "NESDC",            format: dec(0) },
  { key: "gpp_per_capita",         labelKey: "ind.gpp_per_capita",         unitKey: "unit.baht",    axis: "demand", grade: "measured", source: "NESDC", invert: true, format: dec(0) },
  { key: "population_density",     labelKey: "ind.population_density",     unitKey: "unit.perKm2",  axis: "demand", grade: "derived",  source: "NESDC + ADM1", invert: true, format: dec(1) },
  { key: "gpp_agriculture_share",  labelKey: "ind.gpp_agriculture_share",  unitKey: "unit.percent", axis: "demand", grade: "measured", source: "NESDC",            format: pct },
  { key: "credit_deposit",         labelKey: "ind.credit_deposit",         unitKey: "unit.times",   axis: "demand", grade: "measured", source: "BOT",   invert: true, format: dec(2) },

  { key: "digital_readiness", labelKey: "ind.digital_readiness", unitKey: "unit.point", axis: "digital", grade: "estimated", source: "NSO ICT", format: dec(1) },
];

/** 지도 레이어 — 한 번에 하나만 보여준다 (순차 컨텍스트를 겹치지 않는다) */
export const MAP_LAYERS = [
  { key: "gap",                labelKey: "layer.gap" as Key,                scale: "sequential" as const },
  { key: "priority",           labelKey: "layer.priority" as Key,           scale: "sequential" as const },
  { key: "branch_density",     labelKey: "layer.branch_density" as Key,     scale: "sequential" as const },
  { key: "deposit_per_capita", labelKey: "layer.deposit_per_capita" as Key, scale: "sequential" as const },
  { key: "credit_deposit",     labelKey: "layer.credit_deposit" as Key,     scale: "diverging" as const },
];

export const ARCHETYPES = {
  agent_kiosk:      { labelKey: "arch.agent_kiosk" as Key,      actionKey: "arch.agent_kiosk.action" as Key },
  digital_first:    { labelKey: "arch.digital_first" as Key,    actionKey: "arch.digital_first.action" as Key },
  retain_crosssell: { labelKey: "arch.retain_crosssell" as Key, actionKey: "arch.retain_crosssell.action" as Key },
  watch:            { labelKey: "arch.watch" as Key,            actionKey: "arch.watch.action" as Key },
} as const;

export type ArchetypeKey = keyof typeof ARCHETYPES;
