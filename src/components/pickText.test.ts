/**
 * ETL이 굽는 캡션은 언어별 객체({ko, en})지만, 이미 배포된 옛 산출물은 문자열이다.
 * 사이트는 데이터를 런타임에 fetch하므로 **새 코드가 옛 데이터를 만나는 창이 실재한다**
 * (배포는 즉시, 데이터 갱신은 월 1회 PR). 그 창에서 캡션이 통째로 사라지면
 * 화면에는 아무 오류도 안 뜨고 문장만 비어 보인다 — 눈치채기 어려운 종류라 고정한다.
 */

import { describe, expect, it } from "vitest";
import { pickText } from "./FindexPanel";

describe("pickText", () => {
  const bi = { ko: "한국어 캡션", en: "English caption" };

  it("언어별 객체에서 현재 언어를 고른다", () => {
    expect(pickText(bi, "ko")).toBe("한국어 캡션");
    expect(pickText(bi, "en")).toBe("English caption");
  });

  it("옛 산출물의 문자열을 그대로 쓴다", () => {
    // 이게 깨지면 데이터 갱신 전까지 캡션이 빈 채로 배포된다.
    expect(pickText("옛 문자열", "en")).toBe("옛 문자열");
  });

  it("모르는 언어는 영어로, 영어도 없으면 있는 값으로 떨어진다", () => {
    expect(pickText(bi, "th")).toBe("English caption");
    expect(pickText({ ko: "한국어만" }, "en")).toBe("한국어만");
  });

  it("값이 없으면 빈 문자열이다 — undefined가 화면에 찍히지 않는다", () => {
    expect(pickText(undefined, "en")).toBe("");
    expect(pickText({}, "en")).toBe("");
  });
});
