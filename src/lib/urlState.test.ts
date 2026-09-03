/**
 * URL 상태 왕복 — "링크를 새 탭에 붙여넣으면 같은 화면이 뜨는가".
 *
 * 이 도구의 사용 방식이 "가중치를 걸고 링크를 주고받는 것"이라 이 왕복이 깨지면
 * 제품의 절반이 사라진다. 눈으로 확인하기 어려운 종류라 테스트로 고정한다.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, fromSearch, toSearch, type AppState } from "./urlState";
import { DEMAND_DEFAULT, PRESETS, SUPPLY_DEFAULT } from "@/config/weights";

const roundTrip = (s: AppState): AppState => fromSearch(`?${toSearch(s)}`);

describe("urlState 왕복", () => {
  it("기본 상태는 언어와 프리셋만 싣는다", () => {
    // 기본값을 URL에 실으면 공유 링크가 쓸데없이 길어지고, 나중에 기본값을 바꿨을 때
    // 예전 링크가 옛 기본값을 고정해 버린다. 다만 **언어는 예외로 항상 싣는다** —
    // 받는 사람의 브라우저 언어가 보낸 사람과 다르면 다른 화면이 뜨기 때문이다.
    expect(toSearch(DEFAULT_STATE)).toBe("lang=ko&p=balanced");
  });

  it("언어는 항상 URL에 실린다 — 링크를 받는 쪽 브라우저 설정에 좌우되면 안 된다", () => {
    for (const lang of ["ko", "en"] as const) {
      const qs = toSearch({ ...DEFAULT_STATE, lang });
      expect(qs).toContain(`lang=${lang}`);
      expect(fromSearch(`?${qs}`).lang).toBe(lang);
    }
  });

  it("모르는 언어 코드는 무시한다", () => {
    // 링크가 손상되거나 누가 손으로 고쳤을 때 화면이 죽지 않아야 한다.
    for (const q of ["?lang=fr", "?lang=", "?lang=ko-KR"]) {
      expect(["ko", "en"]).toContain(fromSearch(q).lang);
    }
  });

  it("기본 상태를 왕복해도 그대로다", () => {
    expect(roundTrip(DEFAULT_STATE)).toEqual(DEFAULT_STATE);
  });

  it("프리셋은 이름만 싣는다", () => {
    const s: AppState = { ...DEFAULT_STATE, preset: "remote_first" };
    const qs = toSearch(s);
    expect(qs).toContain("p=remote_first");
    expect(qs).not.toContain("s=");        // 프리셋이면 가중치를 풀어 싣지 않는다
    expect(fromSearch(`?${qs}`).preset).toBe("remote_first");
  });

  it("사용자 가중치는 값으로 실리고 그대로 돌아온다", () => {
    const supply = { ...SUPPLY_DEFAULT, branch_density: 0.45, atm_density: 0.05 };
    const demand = { ...DEMAND_DEFAULT, dispersion: 0.35 };
    const s: AppState = { ...DEFAULT_STATE, preset: "custom", supply, demand };

    const back = roundTrip(s);
    expect(back.preset).toBe("custom");
    expect(back.supply).toEqual(supply);
    expect(back.demand).toEqual(demand);
  });

  it("레이어·선택·방콕 제외가 살아 돌아온다", () => {
    const s: AppState = {
      ...DEFAULT_STATE,
      layer: "credit_deposit",
      selected: "50",
      excludeBangkok: true,
    };
    const back = roundTrip(s);
    expect(back.layer).toBe("credit_deposit");
    expect(back.selected).toBe("50");
    expect(back.excludeBangkok).toBe(true);
  });

  it("망가진 쿼리스트링은 기본값으로 떨어진다", () => {
    // 링크가 잘려서 전달되는 일은 흔하다. 그때 화면이 죽는 대신 기본 화면이 떠야 한다.
    for (const q of ["?s=1,2,3", "?s=abc,def,ghi,jkl,mno", "?d=", "?s=10,10,10,10,10,10"]) {
      const back = fromSearch(q);
      expect(back.supply).toEqual(SUPPLY_DEFAULT);
      expect(back.demand).toEqual(DEMAND_DEFAULT);
    }
  });

  it("가중치는 정수 퍼센트로 인코딩된다 (링크 길이와 가독성)", () => {
    const s: AppState = { ...DEFAULT_STATE, preset: "custom" };
    const qs = toSearch(s);
    expect(qs).toMatch(/s=30,20,20,20,10/);
    expect(qs).toMatch(/d=30,25,20,15,10/);
  });

  it("모든 프리셋이 왕복을 견딘다", () => {
    for (const p of PRESETS) {
      const s: AppState = { ...DEFAULT_STATE, preset: p.id, supply: p.supply, demand: p.demand };
      expect(roundTrip(s).preset).toBe(p.id);
    }
  });
});
