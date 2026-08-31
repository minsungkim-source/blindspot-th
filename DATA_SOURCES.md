# DATA_SOURCES

각 소스의 URL, 실제 해상도, 갱신 주기, 라이선스, 확보 방법.
**등급**은 확보 확실성이다 — A: 다운로드/파싱 검증 완료 · B: 소스 확인, 포맷 손질 필요 · C: 해상도 부족, 추정/보조 전용.

---

## A등급 — 검증 완료

### BOT — 주별 예수신 및 지점 수 `FI_CB_011_S4`

- URL: <https://app.bot.or.th/BTWS_STAT/statistics/ReportPage.aspx?reportID=781&language=eng>
- 제목: *Commercial Banks' Deposits and Loans Classified by Provinces*
- 해상도: **77개 주** + 권역 소계 + 총계 (84행)
- 컬럼: `No. of Branches`, Demand / Saving / Time / Promissory Note / NCD / **Total Deposits**,
  Overdraft / Loan / Bills / Others / **Total Credits**, **Credit of Deposits (%)**
- 주기: 월간. 확인 시점 최신 **2025-06** (`JUN 2025 p` — 잠정치)
- 확보: ASP.NET 렌더 HTML 파싱 (`etl/sources/bot_province.py`)
- 라이선스: 명시 페이지 미발견. 귀속 표기 + 집계 지표만 게시. 문의 `DMD-FIDataT@bot.or.th`

**표 구조 (2026-08-26 실측 · 파서가 이 지문에 의존한다)**

| 항목 | 값 |
|---|---|
| 표 엘리먼트 | `<table id="dgExcel" class="Grid">` — 페이지의 표 11개 중 이것 하나 |
| 행 구성 | 0행 기준시점 · 1행 헤더 · 2–85행 데이터 (84행) |
| 데이터 84행 | 주 **77** + 권역 소계 4 + 방콕 내역 2(`Head office`/`Branches`) + `Grand Total` 1 |
| 열 수 | **15** — 0열이 **일련번호**, 1열이 주 이름, 2열부터 수치 13개 |
| 금액 단위 | **백만 바트.** `bot_province.py`가 바트로 환산해 내보낸다 |

> ⚠️ **0열이 일련번호다.** 스캐폴드의 `COLUMNS`는 주 이름을 0열로 가정해 한 칸 밀려 있었다.
> 열 정렬은 세 겹으로 검사한다 — 열 수 고정(15), 헤더 토큰 13개, 그리고
> **공표 예대율과 `credits/deposits` 계산값의 교차 검증**(1%p 이상 벌어지면 `ParserDriftError`).
> 마지막 검사가 "행 수·열 수·헤더는 그대로인데 값만 밀린" 경우를 잡는 유일한 그물이다.

**권역은 표에서 그대로 얻는다.** 권역 소계 행(`Central Region` 등)이 뒤따르는 주들의 권역을
정의한다 → Bangkok 1 / Central 25 / Northeast 20 / North 17 / South 14 = 77.
이것이 NSO·NESDC가 쓰는 **5권역** 구분이다. 크로스워크의 `region`은 East·West를 분리한
**6권역**이라 하향 추정에 그대로 쓰면 안 된다.

**과거 시점은 GET 파라미터가 아니다.** ASP.NET 폼 포스트백이다 —
`__VIEWSTATE` + `__EVENTVALIDATION`을 매 응답에서 다시 뽑아
`drpFromYear=2025xxxx` / `drpFromMonth=xxxx06xx` / `drpPeriod=MTH` / `btnSubmit=Submit`으로 POST.
12개월 시계열은 이 왕복을 12번 돈다 (요청 간 1초 간격).

> **BOT API 포털 등록은 미뤘다 (결정 2026-08).** 스크래핑이 v1의 유일한 경로이므로
> 파서에 스키마 지문 검사·원본 스냅샷을 넣고, 주간 카나리(`parser-canary.yml`)로
> 표 구조 변경을 감시한다. 카나리가 반복 실패하면 등록을 앞당긴다.

> **이 표가 프로젝트의 척추다.** 사전 조사에서는 "BOT 지점 통계는 5개 권역뿐"으로 보였으나,
> 이 표에 `No. of Branches`가 주별로 붙어 있다. 지점 주소록 지오코딩이 불필요해진다.

### BOT — 군별 예수신 및 지점 수 (ZIP)

- URL: <https://www.bot.or.th/content/dam/bot/documents/en/statistics/financial-institutions-statistics/cb_t3E-district.zip>
- 해상도: **군(อำเภอ)**. 단 각주 명시 — *"Especially Districts which have four commercial banks or more"*
  → 2026-01 시트 기준 약 **306행** (주 헤더 포함). 전체 928개 군이 아니다.
- 내용: 연도별 파일 2005–2026, 각 파일에 월별 시트. 컬럼 구조는 주별 표와 동일
- 주기: 월간. 확인 시점 최신 **2026-06**
- 확보: 직접 다운로드 **검증 완료** (8.9MB, 24개 파일, .xls + .xlsx 혼재)
- 주의: 2018년 이전은 `.xls` (xlrd 필요), 2019년 이후는 `.xlsx` (openpyxl)

> **누락된 622개 군 자체가 정보다** — "상업은행이 4곳 미만인 군".
> 이걸 결측으로 숨길지 갭 신호로 쓸지는 제품 결정 사항 (README 참조).

### thailand-canonical-admin-names — 크로스워크 + 폴리곤

- Repo: <https://github.com/DevelopedbyWill/thailand-canonical-admin-names>
- 버전: v1.0.2 (2026-05-06) · DOI `10.5281/zenodo.20049930`
- 파일:
  - `data/v1.0.0/thailand-adm1-provinces-v1.0.0.csv` — 77행 × 36컬럼
  - `data/v1.0.0/thailand-adm1-polygons-v1.0.0.geojson`
  - `data/v1.0.0/thailand-adm2-districts-v1.0.0.csv` — 928행 × 14컬럼
  - `data/v1.0.0/thailand-adm2-polygons-v1.0.0.geojson`
  - `data/overrides.csv`, `data/historical_mappings.csv`
- 주요 컬럼: `tis1099_code`, `iso3166_2`, `hasc`, `fips_code`, `wikidata_qid`, `geonames_id`,
  `osm_relation_id`, `name_en_canonical`, `name_th`, `name_alternates_en`, `region`,
  `centroid_lat/lon`, **`area_km2`**, `num_amphoe`, `num_tambon`
- 라이선스: 데이터 **CC BY 4.0** / 코드 MIT / 번들 폴리곤 CC BY 3.0 IGO (OCHA COD 경유)

> **`name_alternates_en`가 핵심이다.** BOT의 영문 주명 표기는 표준과 다르다
> (예: `Prathumwan`, `Pomprabsattruphai`). 이 컬럼 + `overrides.csv`가 조인을 붙인다.

**실측 (2026-08-26)**

- `name_alternates_en`의 구분자는 세미콜론이 아니라 **파이프(`|`)**다.
- 정식명 + 별칭을 정규화하면 키 **97개**가 나온다. 이것으로 BOT 77개 중 **66개**,
  NESDC 77개 중 **73개**가 바로 붙는다.
- 남는 15개는 `data/reference/province_name_aliases.csv`에서 해소한다
  (BOT 11: `Trad`·`Ayuthaya`·`Chiengmai`·`Phrea`·`Satul` 등, NESDC 4:
  `AMNAT CHAREON`·`PHACHUAP KHIRI KHAN`·`PHRA NAKHON SRI AYUTHAYA`·`BANGKOK METROPOLIS`).
  **별칭 테이블에 추가할 뿐, 이름을 코드에서 치환하지 않는다.**
- 폴리곤의 조인 키는 `ADM1_PCODE` = `TH` + 2자리 TIS-1099 (예: `TH10`). 77개 전부 매칭.
- 폴리곤 파일은 96KB로 **표시용 단순화본**이다. 좌표 할당(point-in-polygon)에는 오차가 있다 —
  아래 OpenStreetMap 항목 참조.

### World Bank — Global Findex (지표 API)

- API: `https://api.worldbank.org/v2/country/THA/indicator/{code}?source=28&format=json`
- 인증: **불필요**
- `source=28` = Global Financial Inclusion (Findex). 최종 갱신 2025-10-06
- 검증된 코드:

  | 코드 | 내용 |
  |---|---|
  | `account.t.d` | 계좌 보유 (15세+) |
  | `account.t.d.1` / `.2` | 여성 / 남성 |
  | `account.t.d.9` / `.10` | **농촌 / 도시** |
  | `account.t.d.7` | 소득 하위 40% |
  | `borrow.any.t.d` (+ `.1/.2/.9/.10`) | 차입 |
  | `con1` (+ `.1/.2/.9/.10`) | **휴대폰 보유** |

- 태국 `account.t.d`: 2011 72.7 → 2014 78.1 → 2017 81.6 → 2021 95.6 → **2024 91.8**
- 구 코드(`FX.OWN.TOTL.ZS`)는 400을 반환한다. 위 신 코드 체계를 쓸 것.

### 마이크로데이터 (참조만, 다운로드/재배포 안 함)

- <https://microdata.worldbank.org/index.php/catalog/7985>
- 태국 n=**1,000**, 변수 199개, 수집 2024
- **하위지역 식별자 없음** → 주별 추정 불가
- 라이선스: 통계·과학 연구 목적, **집계 형태 보고만**. 사전 동의 없는 재배포 금지
- → 이 리포는 마이크로데이터를 다운로드하지 않는다. 지표 API의 집계값만 쓴다.

---

## B등급 — 손질 필요

### NESDC — 주별 GPP (Gross Provincial Product)

- URL: <https://www.nesdc.go.th/en/info/gross-regional-and-provincial-product-gpp/>
- 해상도: 77개 주. 산업 대분류별 구성 포함 (농림어업 비중 = D4)
- 주기: 연간 (2~3년 시차)
- 확보: 공표 XLSX 다운로드 **검증 완료** (`etl/sources/nesdc_gpp.py`)
- **인구 분모도 여기서 가져온다** — GPP per capita 표에 주별 인구가 동봉된다

**확보 경로 (2026-08-26 실측)**

1. 페이지가 **세션 쿠키 없이는 자기 자신으로 302 무한 리다이렉트**한다.
   `requests.Session()`으로 한 번 받아두면 이후 요청이 통과한다.
2. 파일 목록은 서버 렌더가 아니라 **DataTable 초기화 스크립트 안의 JSON 리터럴**이다
   (`jQuery('#dataTable').DataTable({ ... data: [ {...} ] })`). JS 안에 박혀 있어
   슬래시·따옴표가 이스케이프되어 있다 — 되돌린 뒤에 링크를 뽑는다.
3. 각 항목의 `?p=<post>&ddl=<file>` 링크가 `wp-content/uploads`의 실제 XLSX로 302한다.
4. 최신본: **Table of Gross Regional and Provincial Product 2024 (Excel)**
   → `GPP-2024-On-Web-1995-2024.xlsx` (2.2MB, 갱신 2026-03-31)

**시트 구조** (12개 중 둘만 쓴다)

| 시트 | 내용 | 뽑는 값 |
|---|---|---|
| `PER CAPITA` | 77개 주 × GPP(백만바트) · 인구(천명) · 1인당 GPP(바트) | `population`, `gpp_per_capita`, `gpp_total` |
| `NE` `NO` `SO` `EA` `WE` `CE` `BKK&VIC` | 주별 블록: 연도 열 × 산업 행 | `gpp_agriculture_share` = Agriculture / GPP |

- 주별 블록은 **경상가격(CURRENT MARKET PRICES)**과 실질(CHAIN VOLUME) 두 벌이 연달아 온다.
  비중은 경상가격 블록에서만 읽는다.
- 연도 열 라벨은 `2019` · `2020r` · `2024p`처럼 섞여 있다. 접미사를 떼고 최대 연도를 고른다.
- 주 코드(`0101` 등)는 NESDC 내부 코드다. TIS-1099가 아니므로 **이름으로 조인한다.**

**가용성 (2026-08-27~31 관찰)**

NESDC는 5xx를 간헐적으로 낸다 — 302 → 502 → 502가 수십 분 이어진 적이 있다.
**필수 소스**라 여기서 죽으면 월간 갱신 전체가 멈춘다. 두 겹으로 막는다.

1. **재시도** — 5xx·네트워크만 3회, 백오프 3/10/25초. 4xx는 즉시 실패(경로 문제다).
2. **캐시 폴백** — `data/raw/nesdc-gpp-<연도>.xlsx`. 라이브가 죽으면 캐시본으로 계속 간다.
   `meta.json`의 `sources.nesdc_gpp.from_cache: true`로 기록되고 PR 체크리스트에 뜬다.

> **왜 이 소스에만 캐시 폴백을 허용하는가** — 공표 주기가 **1년**이기 때문이다.
> 지난달에 받은 GPP 2024와 오늘 받는 GPP 2024는 같은 파일이라 신선도 손해가 없다.
> BOT은 월간이라 같은 논리가 성립하지 않고, 그래서 BOT에는 캐시 폴백이 **없다** —
> 깨지면 그냥 멈춘다.
>
> 캐시는 `data/raw/`(gitignore)에 둔다. 정부 공표 XLSX를 공개 저장소에 재배포하지
> 않기 위해서다. CI에서는 `actions/cache`가 실행 간에 이어 준다.
>
> **응답이 스프레드시트가 아닌 경우는 캐시로 덮지 않는다.** 그건 장애가 아니라
> 형식 변경이고, 캐시로 가리면 NESDC가 파일 구조를 바꾼 것을 영영 모르게 된다.

> ⚠️ **도시화율(`urbanization_rate`)은 이 공표물에 없다.** 디지털 하향추정의 가중치 키다
> — 아래 "디지털 축" 절 참조.

### 인구 — DOPA 등록인구

- URL: <https://stat.bora.dopa.go.th/stat/statnew/>
- 해상도: 주 · 군 · 면. 월간
- 문제: **JavaScript SPA**. 정적 다운로드(`/download/list.php`)는 2019-06에서 멈춤
- 대응: v1은 NESDC 동봉 인구를 쓴다. 월간 정밀도가 필요해지면 Playwright로 별도 수집

---

## C등급 — 해상도 부족, 추정/보조 전용

### NSO — ICT 가구조사

- 조사: สำรวจการมีการใช้เทคโนโลยีสารสนเทศและการสื่อสารในครัวเรือน
- Catalog API: `https://catalogapi.nso.go.th/api/datadic?table={TABLE}&format=csv` — **키 불필요**
- 반환 컬럼: `year, region, area, Per_have_Mo, unit, source`
- 해상도: **권역 5개 × 시가지/비시가지.** 주별 컬럼 없음 — 본문 확인
- CKAN: <https://catalog.nso.go.th/dataset/> (CKAN 2.10.7, 913건, `/api/3` 공개)
- 2025 보고서 PDF: <https://www.nso.go.th/nsoweb/storage/survey_detail/2025/20250526075340_14241.pdf>
- → METHODOLOGY §5의 하향 추정에만 사용. 신뢰등급 `추정`

> 🚫 **2026-08-26 현재 접근 불가.** `catalogapi.nso.go.th`가 CloudWAF 뒤에 있고
> `HTTP 418` + 차단 페이지(`访问被拦截`)를 돌려준다. User-Agent·헤더를 바꿔도 같다.
> 자격증명이나 우회가 필요한 경로는 공개 저장소 원칙상 v1 경로가 아니다.
> `nso_ict.py`는 이를 `SourceUnavailable`로 올리고, 빌드는 디지털 축을 결측으로 두고 계속 간다.

### OpenStreetMap — ATM / 은행 POI

- Overpass: `https://overpass-api.de/api/interpreter`
- 쿼리: `area["ISO3166-1"="TH"]` 안의 `amenity=atm` + `amenity=bank[atm=yes]` 노드
- 라이선스: **ODbL** — 귀속 필수, 파생 DB 공유 조건 확인 필요
- 편향: 도시가 잘 매핑되어 있어 **갭을 과소평가**하는 방향. 가중치 0.10

**실측 (2026-08-26)**

- `amenity=atm` 단독 3,324개 · 은행 ATM 포함 **4,446개**.
- 주 할당은 shapely STRtree point-in-polygon. **4,175개가 폴리곤 안에 정확히 들어간다.**
- 나머지 **271개(6.1%)**는 어느 폴리곤에도 들어가지 않는다. 절반이 3.2km 이내(해안선 단순화
  오차), 최대 39.5km(섬 — 사무이·창·따오). 크로스워크 폴리곤이 **표시용 단순화본**이라
  섬이 본토에서 떨어져 나가기 때문이다.
  → **50km 상한**으로 가장 가까운 주에 스냅한다. 상한 밖은 버린다.
  주 평균 면적이 6,700km²라 이 거리에서 '가장 가까운 주'가 오답일 여지는 경계 근처로 한정된다.
  좌표계가 깨지거나 폴리곤이 바뀌면 거리가 수백 km로 뛰므로 이 상한이 그걸 잡는다.
- 공개 인스턴스는 **504·429가 잦다.** `overpass.kumi.systems`로 폴백한다.
  ⚠️ `overpass.osm.ch`는 지역 추출본이라 태국 쿼리에 정상 응답으로 **0건**을 돌려준다 —
  미러 목록에 넣으면 안 된다 (0건 게이트가 잡지만, 애초에 넣지 않는다).

---

### 디지털 축 — v1에서 결측

**디지털 준비도는 v1에서 계산되지 않는다.** 입력 두 개가 모두 없다.

| 필요한 것 | 상태 |
|---|---|
| 권역별 ICT 이용률 | NSO 카탈로그 API가 CloudWAF로 차단 (위 참조) |
| 주별 도시화율 (하향추정 가중치 키) | **v1의 어떤 공개 소스도 주지 않는다.** NESDC GPP 공표물에 없다 |

결과: `digital_readiness = null`, `digital_confidence = "missing"`,
`archetype = null` (절반을 찍지 않는다). 사분면과 아키타입 필터는 비활성 상태로 배포되고,
`meta.json`의 `degraded_sources`에 사유가 남는다. **0으로 채우지 않는다.**

되살리려면 둘 다 필요하다. 후보:

- **NSO 이용률** — CKAN(`catalog.nso.go.th`)이 살아 있는지 재확인, 또는 2025 보고서 PDF에서
  권역 × 시가지/비시가지 표를 직접 뽑는다 (연 1회라 수동 갱신도 감당 가능).
- **도시화율** — 등록인구의 시가지(เทศบาล) 비율. DOPA가 SPA라 정적 확보가 막혀 있다.
  대안으로 크로스워크의 `num_amphoe`/`num_tambon`은 도시화율의 대리 지표가 **아니다** — 쓰지 않는다.
- **내부 데이터** — Phase 2에서 앱 MAU/인구로 이 축을 직접 대체하는 편이 추정보다 낫다
  (프라이빗 저장소).

### NBTC / 통신

- data.go.th 경유: <https://data.go.th/en/dataset?organization=nbtc> (121건)
- 해상도: **전국 단위만.** 주별 가입자·커버리지 분해 없음
- 자체 카탈로그(`datacatalog.nbtc.go.th`)는 접근 불가 상태
- → v1 미사용

---

## 확보 실패 — 대체 필요

| 원했던 것 | 상태 | 대체 |
|---|---|---|
| 주별 ATM/CDM 공식 집계 | **없음.** BOT는 전국 PDF만 (`Payment Data Indicators`) | OSM Overpass (C등급) |
| 주별 스마트폰 보급률 | **없음.** NSO는 권역, NBTC는 전국 | 권역값 × 도시화율 하향 추정 — **v1에서 불발** (아래) |
| 권역별 ICT 이용률 | NSO 카탈로그 API가 CloudWAF로 차단 (418) | 없음 → 디지털 축 결측 |
| 주별 도시화율 | **없음.** NESDC GPP에 미수록, DOPA는 SPA | 없음 → 디지털 축 결측 |
| 은행 에이전트 위치 | **없음.** BOT 공표 대상 아님 | Phase 2 내부 데이터 |
| Findex 주별 분해 | **불가.** n=1,000, 지역 식별자 없음 | 전국 벤치마크로 강등 |

---

## 보류 — BOT API 포털

- <https://portal.api.bot.or.th/> · 상태 **deferred** (결정 2026-08)
- 등록·승인 리드타임이 있고, 자격증명이 필요한데 이 저장소는 공개다
  (키를 두지 않는다 — `CONTRIBUTING.md` 참조).
- 승인되면 `bot_province.py`를 공식 API 호출로 교체한다. 그 시점에
  스크래핑 리스크와 주간 카나리가 함께 사라진다.
- 재검토 트리거: 카나리가 2회 이상 연속 실패하거나, 월간 갱신이 한 번이라도 막힐 때.

## 참고 — 미확인 / 재조사 대상

- BOT API `Statistics` / `Others` 제품에 주별 시리즈나 지점 엔드포인트가 실재하는지
- BOT API rate limit / 요금 정책
- BOT 통계 재배포 약관 전문
- DGA Open Government License의 파생물 조항
- `data.go.th` CKAN API는 키 불필요하나 `fq=` 쿼리에서 timeout 빈발 — `q=` + `rows≤25` 사용

---

## 귀속 표기 (사이트 푸터 필수)

```
Data: Bank of Thailand · NESDC · National Statistical Office of Thailand ·
World Bank Global Findex 2025 · OpenStreetMap contributors (ODbL) ·
thailand-canonical-admin-names (CC BY 4.0) · geoBoundaries (CC BY 3.0 IGO)
```
