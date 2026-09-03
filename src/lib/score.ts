/**
 * etl/transform/figi.py 의 TypeScript 미러.
 *
 * 가중치 슬라이더가 브라우저에서 재계산해야 하므로 같은 로직이 두 곳에 존재한다.
 * 두 구현은 반드시 같은 결과를 내야 한다 — ETL이 굽는 figi.json의 기본 가중치 결과와
 * 이 함수의 기본 가중치 결과를 비교하는 패리티 테스트를 CI에 둔다.
 */

import type { DemandKey, SupplyKey } from "@/config/weights";
import { DEMAND_DEFAULT, SUPPLY_DEFAULT } from "@/config/weights";
import type { ArchetypeKey, Grade } from "@/config/indicators";

export interface ProvinceRow {
  tis1099_code: string;
  name_en_canonical: string;
  name_th: string;
  region: string;
  /** ETL이 미리 구운 백분위. 슬라이더는 가중치만 바꾸므로 재정규화가 필요 없다. */
  pct_supply: Record<SupplyKey, number | null>;
  pct_demand: Record<DemandKey, number | null>;
  digital_readiness: number | null;
  population: number;
  [k: string]: unknown;
}

/** scoreAll이 덧붙이는 것. 입력 행의 나머지 필드는 그대로 통과한다. */
export interface ScoreFields {
  supply: number;
  demand: number;
  gap: number;
  priority: number;
  /** 디지털 축이 결측이면 null — 절반을 찍지 않는다. figi.py의 archetype()과 같은 규칙. */
  archetype: ArchetypeKey | null;
  archetypeBorderline: boolean;
}

export type Scored<T extends ProvinceRow = ProvinceRow> = T & ScoreFields;

/**
 * figi.json 한 행의 실제 모양. ETL이 굽는 것과 1:1이어야 한다
 * (etl/build.py의 _to_records — 값이 어긋나면 화면이 조용히 비어 보인다).
 *
 * 점수 필드(supply·gap·…)도 JSON에 들어 있지만 **기본 가중치 기준값**이다.
 * 화면은 항상 scoreAll()이 다시 계산한 값을 쓴다 — 슬라이더를 움직이면 달라지기 때문.
 */
export interface ProvinceRecord extends ProvinceRow {
  iso3166_2: string;
  region_nso: string;
  area_km2: number;
  centroid_lat: number;
  centroid_lon: number;

  branches: number;
  deposits_total: number;
  credits_total: number;
  credit_deposit: number;
  atm_count: number | null;

  gpp_per_capita: number;
  gpp_agriculture_share: number;

  branch_density: number;
  geographic_access: number;
  deposit_per_capita: number;
  credit_per_capita: number;
  atm_density: number | null;
  population_density: number;

  digital_confidence: Grade;
}

function renorm<K extends string>(w: Record<K, number>): Record<K, number> {
  // 제네릭 Record에 Object.values/entries를 쓰면 값이 unknown으로 넓어진다.
  // 입력 타입이 이미 number를 보장하므로 여기서 좁혀 준다.
  const values = Object.values(w) as number[];
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error("가중치 합이 0입니다.");
  return Object.fromEntries(
    (Object.entries(w) as [K, number][]).map(([k, v]) => [k, v / total]),
  ) as Record<K, number>;
}

/** 결측 지표는 0으로 채우지 않고 가중치에서 빼고 남은 것끼리 재정규화한다. */
function weighted<K extends string>(
  parts: Record<K, number | null>,
  weights: Record<K, number>,
): number {
  let num = 0;
  let den = 0;
  for (const key of Object.keys(weights) as K[]) {
    const v = parts[key];
    const w = weights[key];
    if (v == null || Number.isNaN(v)) continue;
    num += v * w;
    den += w;
  }
  return den === 0 ? NaN : num / den;
}

function median(xs: number[]): number {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function scoreAll<T extends ProvinceRow>(
  rows: T[],
  supplyW: Record<SupplyKey, number> = SUPPLY_DEFAULT,
  demandW: Record<DemandKey, number> = DEMAND_DEFAULT,
): Scored<T>[] {
  const sw = renorm(supplyW);
  const dw = renorm(demandW);

  const base = rows.map((r) => {
    const supply = weighted(r.pct_supply, sw);
    const demand = weighted(r.pct_demand, dw);
    const gapRaw = demand - supply;                 // -100..100
    return { r, supply, demand, gapRaw, gap: (gapRaw + 100) / 2 };
  });

  const maxPrio = Math.max(
    ...base.map((b) => b.gapRaw * Math.log10(Math.max(b.r.population, 1))),
  );
  const prioUsable = Number.isFinite(maxPrio) && maxPrio > 0;

  // 평균이 아니라 중앙값 — 방콕이 평균을 끌어간다
  const gapMid = median(base.map((b) => b.gap));
  const digMid = median(rows.map((r) => r.digital_readiness ?? NaN));
  const digUsable = Number.isFinite(digMid);

  return base.map(({ r, supply, demand, gapRaw, gap }) => {
    const dig = r.digital_readiness;

    // 디지털 축이 없으면 좌우를 가를 수 없다. 절반을 찍는 대신 분류하지 않는다.
    // figi.py의 archetype()과 같은 규칙 — 한쪽만 고치면 test_parity.py가 잡는다.
    let archetype: ArchetypeKey | null = null;
    if (digUsable && dig != null && Number.isFinite(gap)) {
      const hiGap = gap >= gapMid;
      const hiDig = dig >= digMid;
      archetype = hiGap
        ? hiDig ? "digital_first" : "agent_kiosk"
        : hiDig ? "retain_crosssell" : "watch";
    }

    return {
      ...r,
      supply: round2(supply),
      demand: round2(demand),
      gap: round2(gap),
      priority: prioUsable
        ? round2(Math.max(0, (gapRaw * Math.log10(Math.max(r.population, 1))) / maxPrio * 100))
        : NaN,
      archetype,
      // 디지털 축은 추정치다. 중앙값 근처면 좌우 분류를 신뢰할 수 없다.
      archetypeBorderline: digUsable && dig != null && Math.abs(dig - digMid) < 5,
      // 제네릭 스프레드의 결과 타입을 TS가 T & ScoreFields로 좁혀주지 못한다.
      // 위 리터럴이 ScoreFields를 전부 채우고 있으므로 여기서 단언한다.
    } as Scored<T>;
  });
}

const round2 = (x: number) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : NaN);
