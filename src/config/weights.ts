/** 가중치 기본값과 프리셋. etl/config.yaml의 index 블록과 값이 일치해야 한다. */

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

export const SUPPLY_LABEL: Record<SupplyKey, string> = {
  branch_density: "지점 밀도",
  geographic_access: "지리적 접근성",
  deposit_penetration: "예금 침투",
  credit_penetration: "신용 침투",
  atm_density: "ATM 밀도",
};

export const DEMAND_LABEL: Record<DemandKey, string> = {
  population_scale: "인구 규모",
  income_downside: "소득 하방",
  dispersion: "분산 거주",
  cash_economy: "현금경제 비중",
  credit_thirst: "신용 갈증",
};

export interface Preset {
  id: string;
  label: string;
  note: string;
  supply: Record<SupplyKey, number>;
  demand: Record<DemandKey, number>;
}

/**
 * 처음 열었을 때 보이는 순위가 사실상의 공식 견해가 된다.
 * 기본 프리셋은 영업·리스크·전략이 함께 확정한다 (METHODOLOGY §8).
 */
export const PRESETS: Preset[] = [
  {
    id: "balanced", label: "균형", note: "기본값",
    supply: SUPPLY_DEFAULT, demand: DEMAND_DEFAULT,
  },
  {
    id: "scale_first", label: "규모 우선", note: "큰 시장부터",
    supply: SUPPLY_DEFAULT,
    demand: { population_scale: 0.50, income_downside: 0.20, dispersion: 0.15, cash_economy: 0.10, credit_thirst: 0.05 },
  },
  {
    id: "remote_first", label: "원격지 우선", note: "이동거리 중심",
    supply: { branch_density: 0.20, geographic_access: 0.35, deposit_penetration: 0.15, credit_penetration: 0.20, atm_density: 0.10 },
    demand: { population_scale: 0.20, income_downside: 0.20, dispersion: 0.35, cash_economy: 0.20, credit_thirst: 0.05 },
  },
  {
    id: "credit_gap", label: "신용 갈증", note: "대출 상품 화이트스페이스",
    supply: { branch_density: 0.20, geographic_access: 0.15, deposit_penetration: 0.20, credit_penetration: 0.35, atm_density: 0.10 },
    demand: { population_scale: 0.25, income_downside: 0.25, dispersion: 0.10, cash_economy: 0.10, credit_thirst: 0.30 },
  },
];
