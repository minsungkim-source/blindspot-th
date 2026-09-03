"""World Bank Global Findex — 국가 단위 벤치마크.

지도 레이어가 아니다. 태국 표본 n=1,000, 하위지역 식별자 없음 → 주별 추정 불가.
마이크로데이터는 라이선스상 재배포 불가이므로 다운로드하지 않고 지표 API만 쓴다.
구 코드(FX.OWN.TOTL.ZS)는 400을 반환한다 — source=28의 신 코드 체계를 쓸 것.
"""

from __future__ import annotations

import requests


def load(config: dict) -> dict:
    scfg = config["sources"]["findex"]
    base, sid, country = scfg["api"], scfg["source_id"], scfg["country"]

    series = {}
    for label, code in scfg["indicators"].items():
        url = f"{base}/country/{country}/indicator/{code}"
        r = requests.get(url, params={"source": sid, "format": "json", "per_page": 100}, timeout=60)
        r.raise_for_status()
        payload = r.json()
        if len(payload) < 2 or not payload[1]:
            series[label] = []
            continue
        series[label] = [
            {"year": int(o["date"]), "value": o["value"]}
            for o in payload[1] if o.get("value") is not None
        ]

    latest_year = max(
        (p["year"] for pts in series.values() for p in pts), default=None
    )
    return {
        "series": series,
        "as_of": str(latest_year) if latest_year else None,
        "grade": "A",
        "source_url": "https://www.worldbank.org/en/publication/globalfindex/report",
        "scope": "national",     # 프런트엔드가 "주별 아님" 라벨을 붙이는 근거
    }
