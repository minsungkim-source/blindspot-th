/**
 * 데이터 귀속 푸터.
 *
 * 이 컴포넌트는 **라이선스 의무**다. OpenStreetMap(ODbL)과 행정경계(CC BY)를 쓰는 한
 * 귀속 표기 없이 배포하면 라이선스 위반이다. 다른 UI보다 먼저 붙였다 (docs/BACKLOG.md Sprint 0).
 *
 * 목록의 단일 출처는 src/config/attribution.ts다. 여기서 문자열을 직접 쓰지 않는다.
 */

import { ATTRIBUTIONS, CODE_LICENSE, REPO_URL } from "@/config/attribution";

export interface FooterProps {
  /** meta.json의 소스별 기준시점. 있으면 각 출처 옆에 붙인다. */
  asOf?: Record<string, string | null | undefined>;
  /** meta.json의 generated_at. 이 화면의 데이터가 언제 구워졌는지. */
  generatedAt?: string | null;
}

/** meta.json의 소스 키 → ATTRIBUTIONS의 name. 기준시점 배지를 붙일 때만 쓴다. */
const SOURCE_KEY: Record<string, string> = {
  "Bank of Thailand": "bot_province",
  NESDC: "nesdc_gpp",
  "National Statistical Office of Thailand": "nso_ict",
  "World Bank Global Findex 2025": "findex",
  "OpenStreetMap contributors": "osm_atm",
  "thailand-canonical-admin-names": "admin_ref",
};

export default function Footer({ asOf, generatedAt }: FooterProps) {
  return (
    <footer className="footer">
      <h2 className="footer__title">데이터 출처</h2>

      <ul className="footer__list">
        {ATTRIBUTIONS.map((a) => {
          const stamp = asOf?.[SOURCE_KEY[a.name] ?? ""];
          return (
            <li key={a.name} className="footer__item">
              <a className="footer__link" href={a.url} target="_blank" rel="noreferrer noopener">
                {a.name}
              </a>
              {stamp ? <span className="footer__stamp num">{stamp}</span> : null}
              <span className="footer__provides">{a.provides}</span>
              <span className="footer__license">{a.license}</span>
            </li>
          );
        })}
      </ul>

      <p className="footer__meta">
        코드 {CODE_LICENSE} ·{" "}
        <a className="footer__link" href={REPO_URL} target="_blank" rel="noreferrer noopener">
          저장소
        </a>
        {generatedAt ? (
          <>
            {" · 데이터 생성 "}
            <span className="num">{generatedAt.slice(0, 10)}</span>
          </>
        ) : null}
      </p>

      <p className="footer__note">
        데이터는 각 출처의 라이선스를 따른다. 지수와 순위는 이 도구의 해석이며 출처 기관의
        견해가 아니다.
      </p>
    </footer>
  );
}
