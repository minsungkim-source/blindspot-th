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
