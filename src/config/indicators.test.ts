/**
 * 지표 포맷 — 상세 패널에 찍히는 숫자.
 *
 * 고치기 전 실제 화면(Ang Thong): `1인당 여신 ฿0M 바트`, `농림어업 비중 16.6% %`.
 * 포맷 함수가 기호를 붙이고 패널이 단위를 또 붙였고, 1인당 금액을 백만으로 나눠
 * 수만 바트가 0이 됐다. 눈으로 한 주를 열어 봐야 보이는 종류라 여기서 고정한다.
 */

import { describe, expect, it } from "vitest";
import { INDICATORS, PRIORITY_FLOOR } from "./indicators";

const LOCALES = ["ko-KR", "en-US"];
const byKey = (k: string) => INDICATORS.find((i) => i.key === k)!;

describe("지표 포맷", () => {
  it("포맷 함수는 숫자만 낸다 — 단위는 화면이 따로 붙인다", () => {
    for (const locale of LOCALES) {
      for (const ind of INDICATORS) {
        const out = ind.format(1234.567, locale);
        // 숫자·자릿수 구분자·소수점만. %·฿·M 같은 기호가 섞이면 단위가 두 번 찍힌다.
        expect(out, `${ind.key} (${locale}) → "${out}"`).toMatch(/^-?[\d.,\s]+$/);
      }
    }
  });

  it("1인당 금액이 0으로 뭉개지지 않는다", () => {
    // Ang Thong의 1인당 여신은 수만 바트다. 예전엔 백만으로 나눠 `฿0M`이 됐다.
    for (const k of ["deposit_per_capita", "credit_per_capita", "gpp_per_capita"]) {
      expect(byKey(k).format(52_345.4, "en-US")).toBe("52,345");
      expect(byKey(k).format(52_345.4, "ko-KR")).toBe("52,345");
    }
  });

  it("비율은 소수 한 자리로 — 16.6이 16.6으로 나온다 (16.6% %가 아니라)", () => {
    expect(byKey("gpp_agriculture_share").format(16.6, "ko-KR")).toBe("16.6");
    expect(byKey("gpp_agriculture_share").format(3, "en-US")).toBe("3.0");
  });

  it("결측은 '—'", () => {
    for (const ind of INDICATORS) expect(ind.format(null, "ko-KR")).toBe("—");
  });

  it("우선순위 바닥값은 0이다 — score.ts의 clip(lower=0)과 같아야 한다", () => {
    expect(PRIORITY_FLOOR).toBe(0);
  });
});
