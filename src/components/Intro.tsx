/**
 * 화면 맨 위의 소개.
 *
 * 이 도구는 축이 두 개인 지수를 보여준다 — 설명 없이 지도만 두면 색이 무엇을 뜻하는지
 * 추측하게 되고, "갭"이 좋은 건지 나쁜 건지부터 사람마다 다르게 읽는다.
 * 링크로 유통되는 물건이라 처음 여는 사람이 대부분이라는 점도 크다.
 *
 * 세 문단으로 끊는다: 무엇을 재는가 / 어떻게 쓰는가 / 어디서 왔는가.
 * 그 이상은 방법론 패널이 받는다.
 */

import { useI18n } from "@/i18n";

export default function Intro() {
  const { t } = useI18n();

  return (
    <section className="intro" aria-label={t("app.tagline")}>
      <p className="intro__lead">{t("app.intro.lead")}</p>
      {/* 강조가 문장 중간에 들어가고 언어마다 위치가 달라서 사전에 <b>를 담았다 */}
      <p className="intro__body" dangerouslySetInnerHTML={{ __html: t("app.intro.body") }} />
      <p className="intro__meta">
        <span>{t("app.intro.usage")}</span>
        <span>{t("app.intro.sources")}</span>
      </p>
    </section>
  );
}
