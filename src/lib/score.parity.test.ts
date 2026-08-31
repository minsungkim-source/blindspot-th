/**
 * score.ts 가 figi.py 와 같은 결과를 내는가.
 *
 * 골든 벡터는 Python 쪽이 굽는다 — `pytest tests/test_parity.py --update-vectors`.
 * 여기서는 같은 입력을 scoreAll()에 먹이고 같은 값이 나오는지만 본다.
 *
 * 이 테스트가 깨지면 둘 중 하나다.
 *   · 산식을 한쪽만 고쳤다 → 다른 쪽도 고친다
 *   · 산식을 의도적으로 바꿨다 → 벡터를 다시 굽고 diff를 사람이 확인한다
 *
 * 산식의 단일 출처는 METHODOLOGY.md다. 코드와 문서가 어긋나면 코드가 틀린 것으로 본다.
 */

import { describe, expect, it } from "vitest";
import vectors from "../../tests/fixtures/parity_vectors.json";
import { scoreAll, type ProvinceRow } from "./score";
import type { DemandKey, SupplyKey } from "@/config/weights";

interface VectorRow {
  tis1099_code: string;
  population: number;
  digital_readiness: number | null;
  pct_supply: Record<string, number | null>;
  pct_demand: Record<string, number | null>;
  expected: {
    supply: number | null;
    demand: number | null;
    gap: number | null;
    priority: number | null;
    archetype: string | null;
    archetypeBorderline: boolean;
  };
}

interface VectorCase {
  label: string;
  supplyWeights: Record<string, number>;
  demandWeights: Record<string, number>;
  rows: VectorRow[];
}

/** Python은 소수 4자리로 굽는다. 부동소수 마지막 자리까지 요구하지는 않는다. */
const TOLERANCE = 0.011;

const toRow = (v: VectorRow): ProvinceRow => ({
  tis1099_code: v.tis1099_code,
  name_en_canonical: `P${v.tis1099_code}`,
  name_th: "",
  region: "",
  population: v.population,
  digital_readiness: v.digital_readiness,
  pct_supply: v.pct_supply as Record<SupplyKey, number | null>,
  pct_demand: v.pct_demand as Record<DemandKey, number | null>,
});

describe("figi.py ↔ score.ts 패리티", () => {
  for (const c of (vectors as { cases: VectorCase[] }).cases) {
    describe(c.label, () => {
      const scored = scoreAll(
        c.rows.map(toRow),
        c.supplyWeights as Record<SupplyKey, number>,
        c.demandWeights as Record<DemandKey, number>,
      );

      it("주 개수가 같다", () => {
        expect(scored).toHaveLength(c.rows.length);
      });

      c.rows.forEach((v, i) => {
        const got = scored[i]!;
        const want = v.expected;

        it(`${v.tis1099_code}: supply · demand · gap`, () => {
          expect(got.supply).toBeCloseTo(want.supply!, 1);
          expect(got.demand).toBeCloseTo(want.demand!, 1);
          expect(Math.abs(got.gap - want.gap!)).toBeLessThan(TOLERANCE);
        });

        it(`${v.tis1099_code}: priority`, () => {
          expect(Math.abs(got.priority - want.priority!)).toBeLessThan(TOLERANCE);
        });

        it(`${v.tis1099_code}: archetype = ${want.archetype ?? "null"}`, () => {
          // 디지털이 결측인 주는 양쪽 다 null이어야 한다 — 절반을 찍지 않는다
          expect(got.archetype).toBe(want.archetype);
          expect(got.archetypeBorderline).toBe(want.archetypeBorderline);
        });
      });
    });
  }
});
