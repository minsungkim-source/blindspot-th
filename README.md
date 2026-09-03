# Blindspot TH

태국 77개 주(จังหวัด)의 **금융포용 갭**을 지도로 보여주고, 에이전트·키오스크·지점 확장의
우선순위를 정하는 데 쓰는 정적 웹 도구.

공급(은행 지점·예수신) 대비 수요(인구·소득·원격성)의 격차를 지수화하고,
디지털 준비도를 겹쳐 **물리 접점이 필요한 곳**과 **앱만으로 되는 곳**을 갈라낸다.

**라이브**: <https://minsungkim-source.github.io/blindspot-th/>
(한국어 · English — `?lang=en`. 언어를 포함한 화면 상태가 전부 주소에 담기므로
조정한 화면을 링크로 그대로 주고받을 수 있다.)

- 기획서: [Product Plan](https://claude.ai/code/artifact/5cd9b4d0-d01d-451d-a032-c0c823b84ee7)
- 지수 정의: [`METHODOLOGY.md`](./METHODOLOGY.md)
- 데이터 계보: [`DATA_SOURCES.md`](./DATA_SOURCES.md)
- 디자인 브리프: [`DESIGN.md`](./DESIGN.md)

---

## 구조

```
etl/     Python. 공개 소스 → data/processed/*.json 을 굽는다. CI에서 월 1회 실행.
src/     Vite + React + TypeScript + D3. 굽힌 JSON을 fetch 해서 그린다.
         화면 문구는 전부 src/i18n/strings.ts 한 곳에 있다 (한국어·영어).
data/    reference(크로스워크·폴리곤) / processed(빌드 산출물) / raw(gitignored)
```

런타임 백엔드가 없다. 데이터는 빌드 타임에 정적 JSON으로 확정되고,
사이트는 GitHub Pages에서 순수 정적으로 서빙된다.

---

## 개발

### 프런트엔드

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/
npm run preview
npm test             # vitest — figi.py와의 패리티 검증 포함
npm run typecheck    # tsc --noEmit
```

> **`vite preview`는 `vite.config.ts`의 `base`를 다시 읽는다.** 빌드할 때 `VITE_BASE`를
> 넘겼다면 preview에도 같은 값을 넘겨야 한다 — 아니면 자산 경로가 어긋나 빈 화면이 뜬다.
> 기본값 그대로 쓰면 `http://localhost:4173/blindspot-th/` 에서 열린다.

`public/data/`가 비어 있으면 화면이 뜨지 않는다. 먼저 ETL을 한 번 돌리거나,
저장소에 커밋된 `data/processed/`를 복사한다.

```bash
npm run data:sync    # data/processed → public/data
```

### ETL

```bash
cd etl
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python build.py                      # 전체 파이프라인 (~2분, BOT 12개월 왕복 포함)
python build.py --only bot_province  # 소스 하나만 (admin_ref는 항상 함께 돈다)
python build.py --dry-run            # 다운로드·검증만 하고 산출물은 안 씀
python build.py --use-snapshot       # Overpass 응답 재사용 (개발용)
```

`--use-snapshot`은 개발 편의용이다. Overpass는 무료 공개 서비스라 504·429가 잦고,
파서를 손볼 때마다 다시 긁는 것은 예의가 아니다. 재사용하면 `meta.json`의
`sources.osm_atm.from_snapshot`에 기록이 남는다 — **이 표시가 붙은 산출물은 머지하지 않는다.**

### 테스트

```bash
etl/.venv/bin/python -m pytest tests/ -q
```

| 파일 | 무엇을 고정하는가 |
|---|---|
| `test_bot_parser.py` | 정상 표는 통과, 열 밀림·헤더 변경·행수 이상은 `ParserDriftError` |
| `test_figi.py` | 백분위·가중합·아키타입. 결측을 0으로 채우지 않는가 |
| `test_validate.py` | 게이트를 일부러 깨뜨렸을 때 정말 막히는가 |
| `test_parity.py` | `figi.py` ↔ `score.ts` 골든 벡터 |
| `test_og_image.py` | OG 이미지 규격·채색·색 일치 |

`test_validate.py`는 **뮤테이션 테스트로 검증했다** — `validate.py`의 게이트를 하나씩
무력화하면 전부 테스트가 실패한다. 통과하는 게이트가 하나라도 있으면 그 그물은 헛것이다.
패리티는 골든 벡터(`tests/fixtures/parity_vectors.json`)를 Python이 굽고
TypeScript가 대조하는 방식이다. 산식을 바꿨으면 **양쪽을 다 고친 뒤**:

```bash
etl/.venv/bin/python -m pytest tests/test_parity.py --update-vectors
```

벡터 diff는 사람이 본다. 자동으로 덮어쓰지 않는다.

산출물:

| 파일 | 내용 |
|---|---|
| `data/processed/figi.json` | 주별 지표 원값 + 백분위 + Supply/Demand/Digital/GAP + 아키타입 |
| `data/processed/timeseries.json` | 주별 12개월 지점수·예금·여신 |
| `data/processed/meta.json` | 소스별 기준시점·신뢰등급·라이선스·수집시각 + 이번 빌드가 쓴 지수 정의 |
| `data/processed/findex.json` | 전국 벤치마크 시계열 — **주별 아님** |
| `data/reference/provinces.topo.json` | ADM1 폴리곤 (TopoJSON, TIS-1099 키) |

`figi.json`의 `tis1099_code`는 **2자리 문자열**이다 (`"10"`). TopoJSON 속성과 타입이 같아야
지도가 조인된다. 금액은 전부 **바트** — BOT 표의 백만 바트 단위는 ETL이 한 번만 환산한다.

> **v1에서 디지털 준비도는 결측이다.** NSO 카탈로그 API가 차단되어 있고 주별 도시화율을
> 주는 공개 소스가 없다. `digital_readiness`와 `archetype`이 `null`이고 사분면은 비활성이다.
> 0으로 채우지 않는다 — 사유는 `meta.json`의 `degraded_sources`와 `DATA_SOURCES.md`.

---

## 데이터 갱신

`.github/workflows/refresh-data.yml`이 매월 1일 05:00 ICT에 ETL을 돌린다.
(cron은 말일 22:00 UTC에 발화한다 — ICT가 UTC+7이라 그 순간이 곧 1일 05:00이다.
28~31일에 걸어 두고 게이트로 걸러내며, 게이트 로직은 1년치 시뮬레이션으로 검증했다.)
산출물이 바뀌면 **PR을 자동으로 연다** — 자동 머지하지 않는다.

BOT 통계 페이지는 ASP.NET 렌더링이라 구조가 바뀌면 파서가 조용히 깨진다.
PR diff에서 "42개 주의 지점수가 0이 됨" 같은 변화를 사람이 잡는 것이 이 설계의 목적이다.

BOT API 포털 등록은 미뤘으므로 **스크래핑이 v1의 유일한 경로다.** 그에 맞춰
세 겹의 방어를 둔다.

1. `bot_province.py`의 **스키마 지문 검사** — 표의 헤더·행수·열수가 기대와 다르면
   파싱을 진행하지 않고 실패한다. 잘못된 숫자를 만들어내는 것보다 멈추는 게 낫다.
2. **원본 스냅샷** — 매 실행마다 응답 HTML을 `data/raw/`에 남긴다.
   파서가 깨졌을 때 원인을 사후에 볼 수 있다.
3. **주간 카나리** (`parser-canary.yml`) — 월간 ETL 사이에 구조가 바뀌면
   최대 한 달을 모른다. 주 1회 파싱만 점검하고 실패하면 이슈를 연다.

`etl/transform/validate.py`의 게이트를 통과하지 못하면 빌드가 실패하고 PR이 열리지 않는다.

- 77개 주가 전부 존재하는가
- 조인 실패(크로스워크에 매칭되지 않는 이름)가 0건인가
- 전월 대비 지점수·인구가 ±30% 이상 변한 주가 있는가
- 필수 컬럼에 결측이 있는가

---

## 배포

`main`에 push하면 `.github/workflows/deploy.yml`이 빌드해서 GitHub Pages로 배포한다.
`vite.config.ts`의 `base`를 리포 이름에 맞춰야 한다 (사용자/조직 페이지면 `/`).

---

## 확장

- **ADM2(군) 드릴다운** — `etl/sources/bot_district.py`가 이미 306개 군을 읽는다.
  나머지 622개 군은 BOT 공표 대상이 아니다(은행 4곳 미만). 결측으로 숨길지 갭 신호로 쓸지는 결정 사항.
- **다국가** — `etl/config.yaml`의 `countries:` 아래에 국가를 추가하고
  `etl/sources/<country>_*.py` 어댑터를 붙인다. 지수 로직(`transform/figi.py`)은 국가 무관.
- **내부 데이터** — TrueMoney 에이전트 레이어는 별도 프라이빗 리포로 분기한다.
  이 리포는 공개 데이터만 유지한다.

---

## 공개 저장소

이 저장소는 **공개**다. v1은 100% 공개 출처 데이터만 쓰기 때문에 공개로 운영할 수 있고,
그래서 GitHub Pages가 무료이며 방법론이 외부 검증에 열려 있다.

그 대가로 지켜야 할 선이 있다.

- **내부·비공개 데이터는 이 저장소에 들어오지 않는다.** TrueMoney 에이전트 위치,
  거래 데이터, 내부 KPI, 확장 계획. Phase 2의 내부 데이터 레이어는
  **별도 프라이빗 저장소로 분기**한다.
- **자격증명이 필요한 소스를 쓰지 않는다.** v1의 모든 소스는 인증 없이 접근 가능하다.
  BOT API 포털은 승인 대기 중이며 v1 경로가 아니다.
- **World Bank Findex 마이크로데이터를 커밋하지 않는다.** 라이선스상 재배포 불가.
- **귀속 표기는 의무다.** OpenStreetMap(ODbL)과 행정경계(CC BY)를 쓰므로
  푸터의 귀속 표기를 제거하면 라이선스 위반이다. `src/config/attribution.ts` 참조.

기여 규칙은 [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## 라이선스

코드 **MIT** ([`LICENSE`](./LICENSE)). 데이터는 각 소스의 라이선스를 따른다 —
[`DATA_SOURCES.md`](./DATA_SOURCES.md) 참조.
