/**
 * 데이터 귀속 푸터.
 *
 * 이 컴포넌트는 **라이선스 의무**다. OpenStreetMap(ODbL)과 행정경계(CC BY)를 쓰는 한
 * 귀속 표기 없이 배포하면 라이선스 위반이다. 다른 UI보다 먼저 붙였다 (docs/BACKLOG.md Sprint 0).
 *
 * 목록의 단일 출처는 src/config/attribution.ts다. 여기서 문자열을 직접 쓰지 않는다.
 */

import { ATTRIBUTIONS, CODE_LICENSE, REPO_URL } from "@/config/attribution";
import { useI18n } from "@/i18n";

export interface FooterProps {
  /** meta.json의 소스별 기준시점. 있으면 각 출처 옆에 붙인다. */
  asOf?: Record<string, string | null | undefined>;
  /** meta.json의 generated_at. 이 화면의 데이터가 언제 구워졌는지. */
  generatedAt?: string | null;
}

export default function Footer({ asOf, generatedAt }: FooterProps) {
  const { t } = useI18n();

  return (
    <footer className="footer">
      <h2 className="footer__title">{t("footer.title")}</h2>

      <ul className="footer__list">
        {ATTRIBUTIONS.map((a) => {
          const stamp = asOf?.[a.metaKey ?? ""];
          return (
            <li key={a.name} className="footer__item">
              <a className="footer__link" href={a.url} target="_blank" rel="noreferrer noopener">
                {a.name}
              </a>
              {stamp ? <span className="footer__stamp num">{stamp}</span> : null}
              <span className="footer__provides">{t(a.providesKey)}</span>
              <span className="footer__license">{t(a.licenseKey)}</span>
            </li>
          );
        })}
      </ul>

      <p className="footer__meta">
        {t("footer.code", { license: CODE_LICENSE })} ·{" "}
        <a className="footer__link" href={REPO_URL} target="_blank" rel="noreferrer noopener">
          {t("footer.repo")}
        </a>
        {generatedAt ? (
          <>
            {t("footer.generated", { date: "" })}
            <span className="num">{generatedAt.slice(0, 10)}</span>
          </>
        ) : null}
      </p>

      <p className="footer__note">
        {t("footer.disclaimer")}
      </p>
    </footer>
  );
}
