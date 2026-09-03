/**
 * 가중치·레이어·선택 주를 URL에 인코딩한다.
 *
 * 이 도구의 실제 사용 방식은 "각자 가중치를 걸고 결과를 링크로 주고받는 것"이다.
 * 상태가 URL에 없으면 그 사용 방식 자체가 성립하지 않는다.
 *
 * 예: ?layer=gap&p=remote_first&s=20,35,15,20,10&d=20,20,35,20,5&sel=50
 */

import type { DemandKey, SupplyKey } from "@/config/weights";
import { DEMAND_DEFAULT, SUPPLY_DEFAULT } from "@/config/weights";

const S_ORDER: SupplyKey[] = [
  "branch_density", "geographic_access", "deposit_penetration",
  "credit_penetration", "atm_density",
];
const D_ORDER: DemandKey[] = [
  "population_scale", "income_downside", "dispersion",
  "cash_economy", "credit_thirst",
];

export interface AppState {
  layer: string;
  preset: string;
  supply: Record<SupplyKey, number>;
  demand: Record<DemandKey, number>;
  selected: string | null;
  excludeBangkok: boolean;
}

export const DEFAULT_STATE: AppState = {
  layer: "gap",
  preset: "balanced",
  supply: SUPPLY_DEFAULT,
  demand: DEMAND_DEFAULT,
  selected: null,
  excludeBangkok: false,
};

const pack = (w: Record<string, number>, order: string[]) =>
  order.map((k) => Math.round((w[k] ?? 0) * 100)).join(",");

const unpack = <K extends string>(s: string | null, order: K[], fallback: Record<K, number>) => {
  if (!s) return fallback;
  const parts = s.split(",").map(Number);
  if (parts.length !== order.length || parts.some((n) => !Number.isFinite(n))) return fallback;
  return Object.fromEntries(order.map((k, i) => [k, parts[i]! / 100])) as Record<K, number>;
};

export function toSearch(s: AppState): string {
  const q = new URLSearchParams();
  if (s.layer !== DEFAULT_STATE.layer) q.set("layer", s.layer);
  if (s.preset !== "custom") q.set("p", s.preset);
  else {
    q.set("s", pack(s.supply, S_ORDER));
    q.set("d", pack(s.demand, D_ORDER));
  }
  if (s.selected) q.set("sel", s.selected);
  if (s.excludeBangkok) q.set("nobkk", "1");

  // URLSearchParams는 쉼표를 %2C로 인코딩한다. 이 링크는 사람이 슬랙에 붙여 넣고
  // 눈으로 훑는 물건이라 가중치 벡터가 읽혀야 한다 — 쉼표는 쿼리스트링에서 합법적인
  // sub-delim이고, new URLSearchParams()가 그대로 되읽는다.
  return q.toString().replace(/%2C/g, ",");
}

export function fromSearch(search: string): AppState {
  const q = new URLSearchParams(search);
  return {
    layer: q.get("layer") ?? DEFAULT_STATE.layer,
    preset: q.get("p") ?? (q.get("s") ? "custom" : DEFAULT_STATE.preset),
    supply: unpack(q.get("s"), S_ORDER, SUPPLY_DEFAULT),
    demand: unpack(q.get("d"), D_ORDER, DEMAND_DEFAULT),
    selected: q.get("sel"),
    excludeBangkok: q.get("nobkk") === "1",
  };
}

export function pushState(s: AppState): void {
  const qs = toSearch(s);
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}
