/**
 * 화면 언어. 문구는 strings.ts에 있고 여기는 고르는 장치다.
 *
 * **언어는 URL에 담긴다.** 이 도구의 사용 방식이 "가중치를 걸고 링크를 주고받는 것"이라
 * 언어도 그 링크를 따라가야 한다 — 한국어로 보던 화면을 영어권 동료에게 보내면
 * 그쪽에서도 같은 화면이 떠야 하고, 그 반대도 마찬가지다.
 *
 * 첫 방문에는 브라우저 언어를 본다. 한국어면 한국어, 아니면 영어.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { LOCALE, STRINGS, type Key, type Lang } from "./strings";

export { LANGS, LOCALE, type Lang, type Key } from "./strings";

/** `{name}` 자리에 값을 끼운다. 문구를 코드에서 이어붙이면 어순이 다른 언어에서 깨진다. */
export type Vars = Record<string, string | number>;

export interface I18n {
  lang: Lang;
  locale: string;
  t: (key: Key, vars?: Vars) => string;
  /** 숫자 포맷 — 로케일에 따라 자릿수 구분이 달라진다. */
  n: (v: number | null | undefined, digits?: number) => string;
}

const fill = (template: string, vars?: Vars) =>
  vars
    ? template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
    : template;

export function makeI18n(lang: Lang): I18n {
  const table = STRINGS[lang];
  const locale = LOCALE[lang];
  return {
    lang,
    locale,
    t: (key, vars) => fill(table[key] ?? key, vars),
    n: (v, digits = 0) =>
      v == null || !Number.isFinite(v)
        ? "—"
        : v.toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
          }),
  };
}

const I18nContext = createContext<I18n>(makeI18n("ko"));

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => makeI18n(lang), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = (): I18n => useContext(I18nContext);

/** 브라우저 언어. 첫 방문의 기본값을 정하는 데만 쓴다 — 이후는 URL이 이긴다. */
export function detectLang(): Lang {
  if (typeof navigator === "undefined") return "ko";
  return navigator.languages?.some((l) => l.toLowerCase().startsWith("ko")) ? "ko" : "en";
}

export function isLang(v: unknown): v is Lang {
  return v === "ko" || v === "en";
}
