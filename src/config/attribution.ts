/**
 * 데이터 귀속 — 푸터에 반드시 렌더한다.
 *
 * 공개 저장소이고 ODbL(OpenStreetMap)과 CC BY(행정경계) 소스를 쓰므로
 * 귀속 표기는 선택이 아니라 라이선스 의무다. 전체 조건은 DATA_SOURCES.md.
 */

import type { Key } from "@/i18n/strings";

export interface Attribution {
  /** 기관명은 번역하지 않는다 — 고유명사다 */
  name: string;
  url: string;
  licenseKey: Key;
  /** 이 소스가 화면의 어느 부분을 만드는가 */
  providesKey: Key;
  /** meta.json의 소스 키. 기준시점 배지를 붙일 때 쓴다 */
  metaKey?: string;
}

export const ATTRIBUTIONS: Attribution[] = [
  {
    name: "Bank of Thailand",
    url: "https://app.bot.or.th/BTWS_STAT/statistics/ReportPage.aspx?reportID=781&language=eng",
    licenseKey: "lic.bot",
    providesKey: "src.bot",
    metaKey: "bot_province",
  },
  {
    name: "NESDC",
    url: "https://www.nesdc.go.th/en/info/gross-regional-and-provincial-product-gpp/",
    licenseKey: "lic.attribution",
    providesKey: "src.nesdc",
    metaKey: "nesdc_gpp",
  },
  {
    name: "National Statistical Office of Thailand",
    url: "https://www.nso.go.th/nsoweb/nso/survey_detail/a4",
    licenseKey: "lic.attribution",
    providesKey: "src.nso",
    metaKey: "nso_ict",
  },
  {
    name: "World Bank Global Findex 2025",
    url: "https://www.worldbank.org/en/publication/globalfindex/report",
    licenseKey: "lic.findex",
    providesKey: "src.findex",
    metaKey: "findex",
  },
  {
    name: "OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/copyright",
    licenseKey: "lic.odbl",
    providesKey: "src.osm",
    metaKey: "osm_atm",
  },
  {
    name: "thailand-canonical-admin-names",
    url: "https://github.com/DevelopedbyWill/thailand-canonical-admin-names",
    licenseKey: "lic.crosswalk",
    providesKey: "src.crosswalk",
    metaKey: "admin_ref",
  },
];

export const REPO_URL = "https://github.com/minsungkim-source/blindspot-th";
export const CODE_LICENSE = "MIT";
