import { describe, expect, it } from "vitest";
import { validSelection } from "./selection";

const codes = new Set(["10", "15", "36"]);

describe("validSelection", () => {
  it("있는 주는 그대로", () => {
    expect(validSelection("36", codes, new Set())).toBe("36");
  });
  it("없는 주 코드는 지운다 — 주소에 남아 공유 링크로 퍼지지 않게", () => {
    expect(validSelection("99", codes, new Set())).toBeNull();
  });
  it("제외된 주는 지운다 — '선택됨이면서 제외됨'은 모순이다", () => {
    expect(validSelection("10", codes, new Set(["10"]))).toBeNull();
  });
  it("선택이 없으면 없음", () => {
    expect(validSelection(null, codes, new Set())).toBeNull();
  });
});
