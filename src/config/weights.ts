/** 가중치 기본값과 프리셋. etl/config.yaml의 index 블록과 값이 일치해야 한다.
 *
 * 표시 문구는 i18n 사전에 있고 여기는 키만 안다 (indicators.ts와 같은 이유). */

import type { Key } from "@/i18n/strings";

export type SupplyKey =
  | "branch_density" | "geographic_access" | "deposit_penetration"
  | "credit_penetration" | "atm_density";

export type DemandKey =
  | "population_scale" | "income_downside" | "dispersion"
  | "cash_economy" | "credit_thirst";

export const SUPPLY_DEFAULT: Record<SupplyKey, number> = {
  branch_density: 0.30,
  geographic_access: 0.20,
  deposit_penetration: 0.20,
  credit_penetration: 0.20,
  atm_density: 0.10,
};

export const DEMAND_DEFAULT: Record<DemandKey, number> = {
  population_scale: 0.30,
  income_downside: 0.25,
  dispersion: 0.20,
  cash_economy: 0.15,
  credit_thirst: 0.10,
};

export const SUPPLY_LABEL_KEY: Record<SupplyKey, Key> = {
  branch_density: "w.branch_density",
  geographic_access: "w.geographic_access",
  deposit_penetration: "w.deposit_penetration",
  credit_penetration: "w.credit_penetration",
  atm_density: "w.atm_density",
};

export const DEMAND_LABEL_KEY: Record<DemandKey, Key> = {
  population_scale: "w.population_scale",
  income_downside: "w.income_downside",
  dispersion: "w.dispersion",
  cash_economy: "w.cash_economy",
  credit_thirst: "w.credit_thirst",
};

type WeightKey = SupplyKey | DemandKey;

/**
 * 가중치 항목 → 그 항목이 재는 지표(`INDICATORS`의 key).
 *
 * 툴팁의 **출처와 신뢰등급은 여기 적지 않고 `INDICATORS`에서 끌어온다.** 같은 사실을
 * 두 곳에 적으면 한쪽만 고쳐지는 날이 온다 — ATM이 추정 등급이라는 사실은 이미
 * indicators.ts에 있다.
 */
export const WEIGHT_INDICATOR: Record<WeightKey, string> = {
  branch_density: "branch_density",
  geographic_access: "geographic_access",
  deposit_penetration: "deposit_per_capita",
  credit_penetration: "credit_per_capita",
  atm_density: "atm_density",
  population_scale: "population",
  income_downside: "gpp_per_capita",
  dispersion: "population_density",
  cash_economy: "gpp_agriculture_share",
  credit_thirst: "credit_deposit",
};

/** 툴팁 문구 — 한 줄 정의와 계산식. 산식의 단일 출처는 METHODOLOGY.md §3·§4다. */
export const WEIGHT_DEF_KEY: Record<WeightKey, Key> = {
  branch_density: "wdef.branch_density",
  geographic_access: "wdef.geographic_access",
  deposit_penetration: "wdef.deposit_penetration",
  credit_penetration: "wdef.credit_penetration",
  atm_density: "wdef.atm_density",
  population_scale: "wdef.population_scale",
  income_downside: "wdef.income_downside",
  dispersion: "wdef.dispersion",
  cash_economy: "wdef.cash_economy",
  credit_thirst: "wdef.credit_thirst",
};

export const WEIGHT_CALC_KEY: Record<WeightKey, Key> = {
  branch_density: "wcalc.branch_density",
  geographic_access: "wcalc.geographic_access",
  deposit_penetration: "wcalc.deposit_penetration",
  credit_penetration: "wcalc.credit_penetration",
  atm_density: "wcalc.atm_density",
  population_scale: "wcalc.population_scale",
  income_downside: "wcalc.income_downside",
  dispersion: "wcalc.dispersion",
  cash_economy: "wcalc.cash_economy",
  credit_thirst: "wcalc.credit_thirst",
};

export interface Preset {
  id: string;
  labelKey: Key;
  noteKey: Key;
  supply: Record<SupplyKey, number>;
  demand: Record<DemandKey, number>;
}

/**
 * 처음 열었을 때 보이는 순위가 사실상의 공식 견해가 된다.
 * 기본 프리셋은 영업·리스크·전략이 함께 확정한다 (METHODOLOGY §8).
 */
export const PRESETS: Preset[] = [
  {
    id: "balanced", labelKey: "preset.balanced", noteKey: "preset.balanced.note",
    supply: SUPPLY_DEFAULT, demand: DEMAND_DEFAULT,
  },
  {
    id: "scale_first", labelKey: "preset.scale_first", noteKey: "preset.scale_first.note",
    supply: SUPPLY_DEFAULT,
    demand: { population_scale: 0.50, income_downside: 0.20, dispersion: 0.15, cash_economy: 0.10, credit_thirst: 0.05 },
  },
  {
    id: "remote_first", labelKey: "preset.remote_first", noteKey: "preset.remote_first.note",
    supply: { branch_density: 0.20, geographic_access: 0.35, deposit_penetration: 0.15, credit_penetration: 0.20, atm_density: 0.10 },
    demand: { population_scale: 0.20, income_downside: 0.20, dispersion: 0.35, cash_economy: 0.20, credit_thirst: 0.05 },
  },
  {
    id: "credit_gap", labelKey: "preset.credit_gap", noteKey: "preset.credit_gap.note",
    supply: { branch_density: 0.20, geographic_access: 0.15, deposit_penetration: 0.20, credit_penetration: 0.35, atm_density: 0.10 },
    demand: { population_scale: 0.25, income_downside: 0.25, dispersion: 0.10, cash_economy: 0.10, credit_thirst: 0.30 },
  },
];
