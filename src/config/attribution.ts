/**
 * 데이터 귀속 — 푸터에 반드시 렌더한다.
 *
 * 공개 저장소이고 ODbL(OpenStreetMap)과 CC BY(행정경계) 소스를 쓰므로
 * 귀속 표기는 선택이 아니라 라이선스 의무다. 전체 조건은 DATA_SOURCES.md.
 */

export interface Attribution {
  name: string;
  url: string;
  license: string;
  /** 이 소스가 화면의 어느 부분을 만드는가 */
  provides: string;
}

export const ATTRIBUTIONS: Attribution[] = [
  {
    name: "Bank of Thailand",
    url: "https://app.bot.or.th/BTWS_STAT/statistics/ReportPage.aspx?reportID=781&language=eng",
    license: "귀속 표기 · 집계 형태 게시",
    provides: "주별 지점 수 · 예금 · 여신 · 예대율",
  },
  {
    name: "NESDC",
    url: "https://www.nesdc.go.th/en/info/gross-regional-and-provincial-product-gpp/",
    license: "귀속 표기",
    provides: "주별 GPP · 인구 · 산업구성",
  },
  {
    name: "National Statistical Office of Thailand",
    url: "https://www.nso.go.th/nsoweb/nso/survey_detail/a4",
    license: "귀속 표기",
    provides: "권역별 ICT 이용률 (디지털 준비도 추정의 원자료)",
  },
  {
    name: "World Bank Global Findex 2025",
    url: "https://www.worldbank.org/en/publication/globalfindex/report",
    license: "집계 지표만 사용 · 마이크로데이터 미포함",
    provides: "전국 벤치마크 (주별 아님)",
  },
  {
    name: "OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/copyright",
    license: "ODbL 1.0",
    provides: "ATM · 은행 POI",
  },
  {
    name: "thailand-canonical-admin-names",
    url: "https://github.com/DevelopedbyWill/thailand-canonical-admin-names",
    license: "CC BY 4.0 · 폴리곤 CC BY 3.0 IGO",
    provides: "행정구역 크로스워크 · 경계 폴리곤 · 면적",
  },
];

export const REPO_URL = "https://github.com/blindspot-th/blindspot-th";
export const CODE_LICENSE = "MIT";
