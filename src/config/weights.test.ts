/**
 * 가중치 툴팁의 데이터 무결성.
 *
 * 툴팁은 출처·신뢰등급을 INDICATORS에서 key로 찾아온다. 그 key가 어긋나면
 * 타입 검사는 통과하고 화면에는 출처 "—"와 '없음' 배지가 **조용히** 찍힌다.
 * 눈으로 열 개를 하나씩 올려 보지 않으면 모르는 종류라 여기서 고정한다.
 */

import { describe, expect, it } from "vitest";
import {
  DEMAND_LABEL_KEY, SUPPLY_LABEL_KEY,
  WEIGHT_CALC_KEY, WEIGHT_DEF_KEY, WEIGHT_INDICATOR,
} from "./weights";
import { INDICATORS } from "./indicators";
import { makeI18n } from "@/i18n";

const WEIGHT_KEYS = [
  ...Object.keys(SUPPLY_LABEL_KEY),
  ...Object.keys(DEMAND_LABEL_KEY),
] as (keyof typeof WEIGHT_INDICATOR)[];

describe("가중치 툴팁", () => {
  it("슬라이더 10개 전부에 지표가 연결돼 있다", () => {
    expect(WEIGHT_KEYS).toHaveLength(10);
    for (const k of WEIGHT_KEYS) {
      const ind = INDICATORS.find((i) => i.key === WEIGHT_INDICATOR[k]);
      expect(ind, `'${k}' → '${WEIGHT_INDICATOR[k]}'가 INDICATORS에 없다`).toBeDefined();
      expect(ind!.source).toBeTruthy();
    }
  });

  it("축이 맞는다 — 공급 슬라이더는 공급 지표를, 수요 슬라이더는 수요 지표를 가리킨다", () => {
    for (const k of Object.keys(SUPPLY_LABEL_KEY) as (keyof typeof WEIGHT_INDICATOR)[]) {
      expect(INDICATORS.find((i) => i.key === WEIGHT_INDICATOR[k])!.axis).toBe("supply");
    }
    for (const k of Object.keys(DEMAND_LABEL_KEY) as (keyof typeof WEIGHT_INDICATOR)[]) {
      expect(INDICATORS.find((i) => i.key === WEIGHT_INDICATOR[k])!.axis).toBe("demand");
    }
  });

  it("ATM은 추정 등급으로 나간다 — 추정치에는 항상 배지를 붙인다 (CLAUDE.md)", () => {
    expect(INDICATORS.find((i) => i.key === WEIGHT_INDICATOR.atm_density)!.grade).toBe("estimated");
  });

  it("두 언어 모두 정의와 계산식이 비어 있지 않다", () => {
    for (const lang of ["ko", "en"] as const) {
      const { t } = makeI18n(lang);
      for (const k of WEIGHT_KEYS) {
        const def = t(WEIGHT_DEF_KEY[k]);
        const calc = t(WEIGHT_CALC_KEY[k]);
        // 사전에 없는 키면 t()가 키 문자열을 그대로 돌려준다 — 그것도 실패로 본다
        expect(def.length, `${lang}/${k} 정의`).toBeGreaterThan(10);
        expect(def).not.toBe(WEIGHT_DEF_KEY[k]);
        expect(calc).not.toBe(WEIGHT_CALC_KEY[k]);
      }
    }
  });

  it("역방향 지표는 정의에 방향이 드러난다 — '높을수록'이 무엇을 뜻하는지 헷갈리지 않게", () => {
    // income_downside·dispersion·credit_thirst는 원값이 '낮을수록' 점수가 높다.
    // 계산식 문구에 그 사실이 빠지면 슬라이더를 반대로 이해하게 된다.
    const inverted = WEIGHT_KEYS.filter(
      (k) => INDICATORS.find((i) => i.key === WEIGHT_INDICATOR[k])!.invert,
    );
    expect(inverted.sort()).toEqual(["credit_thirst", "dispersion", "income_downside"]);
    const ko = makeI18n("ko").t;
    const en = makeI18n("en").t;
    for (const k of inverted) {
      expect(ko(WEIGHT_CALC_KEY[k])).toContain("역순");
      expect(en(WEIGHT_CALC_KEY[k])).toContain("reversed");
    }
  });
});
