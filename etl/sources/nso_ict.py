"""NSO ICT 가구조사 — 권역 5개 × 시가지/비시가지.

주별 컬럼이 존재하지 않는다(본문 확인). 이 값을 도시화율로 하향 추정해 쓰고,
결과에는 항상 confidence='estimated' 배지가 붙는다. METHODOLOGY §5.

2026-08-26 실측 확인 (Sprint 1) — **v1에서 이 경로는 죽어 있다**
  · catalogapi.nso.go.th가 CloudWAF 뒤에 있고 HTTP 418 + 차단 페이지를 돌려준다.
    User-Agent·헤더를 바꿔도 같다. 자격증명이 필요한 우회는 공개 저장소 원칙상 v1 경로가 아니다.
  · 설령 이 API가 살아나도 하향추정에는 주별 **도시화율**이 필요한데,
    v1의 어떤 소스도 그걸 주지 않는다 (NESDC GPP 공표물에 없다).
  · 그래서 디지털 축은 v1에서 결측이다. 0으로 채우지 않는다.
    `normalize.downscale_digital()`이 digital_confidence='missing'을 붙이고,
    프런트엔드는 사분면·필터를 비활성화한 채 그 사실을 화면에 밝힌다.
  · 재개 조건과 대안 후보는 DATA_SOURCES.md의 "디지털 축" 절.
"""

from __future__ import annotations

import io

import pandas as pd
import requests

REGION_MAP = {
    "bangkok": "Bangkok", "กรุงเทพมหานคร": "Bangkok",
    "central": "Central", "ภาคกลาง": "Central",
    "northeast": "Northeast", "northeastern": "Northeast", "ภาคตะวันออกเฉียงเหนือ": "Northeast",
    "north": "North", "northern": "North", "ภาคเหนือ": "North",
    "south": "South", "southern": "South", "ภาคใต้": "South",
}

# 차단 페이지가 200으로 돌아오는 경우까지 잡는다
BLOCK_MARKERS = ("CloudWAF", "访问被拦截", "Access Denied", "<html")


class SourceUnavailable(RuntimeError):
    """소스에 도달하지 못했다. 파싱 오류(ValueError)와 구분한다."""


def load(config: dict) -> dict:
    scfg = config["sources"]["nso_ict"]
    try:
        r = requests.get(
            scfg["api"],
            params={"table": scfg["table"], "format": "csv"},
            timeout=60,
        )
    except requests.RequestException as e:
        raise SourceUnavailable(f"NSO 카탈로그 API에 도달하지 못했다: {e}") from e

    if r.status_code != 200:
        raise SourceUnavailable(
            f"NSO 카탈로그 API가 HTTP {r.status_code}를 돌려줬다 "
            f"(2026-08 기준 CloudWAF가 418로 차단 중)."
        )
    head = r.text[:400]
    if any(marker in head for marker in BLOCK_MARKERS):
        raise SourceUnavailable(
            "NSO 카탈로그 API가 CSV 대신 차단 페이지를 돌려줬다 (CloudWAF). "
            "공개 저장소 원칙상 우회하지 않는다 — 디지털 축을 결측으로 둔다."
        )

    df = pd.read_csv(io.StringIO(r.text))

    # 반환 컬럼: year, region, area, Per_have_Mo, unit, source
    value_col = next((c for c in df.columns if c.lower().startswith("per_")), None)
    if value_col is None:
        raise ValueError(f"NSO 응답에서 값 컬럼을 찾지 못했다: {list(df.columns)}")

    latest = df[df["year"] == df["year"].max()]
    rates: dict[tuple[str, str], float] = {}
    for _, row in latest.iterrows():
        region = REGION_MAP.get(str(row["region"]).strip().lower())
        area = str(row["area"]).strip().lower()
        bucket = "urban" if any(k in area for k in ("municipal", "urban", "ในเขต")) else "rural"
        if region:
            rates[(region, bucket)] = float(row[value_col])

    return {
        "rates": rates,
        "as_of": str(latest["year"].iloc[0]) if len(latest) else None,
        "grade": "C",
        "source_url": "https://www.nso.go.th/nsoweb/nso/survey_detail/a4",
        "resolution": "region",
    }
