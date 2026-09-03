"""figi.py 와 score.ts 가 같은 결과를 내는가.

두 구현이 존재하는 이유는 가중치 슬라이더다 — ETL이 기본 가중치로 한 번 굽고,
브라우저가 슬라이더를 움직일 때마다 같은 산식으로 다시 계산한다.
둘이 갈라지면 "링크로 받은 화면"과 "직접 연 화면"이 다른 순위를 보여준다.

**패리티의 경계는 백분위 이후다.** 백분위 계산은 Python에만 있고(77개 주 전체가 필요하다),
브라우저는 ETL이 구운 백분위를 받아 가중치만 바꾼다. 그래서 이 테스트가 고정하는 것은:

    같은 백분위 + 같은 가중치 → 같은 supply / demand / gap / priority / archetype

절차
  1. 이 파일이 `tests/fixtures/parity_vectors.json`을 만든다 (입력 + Python 기대값).
  2. `src/lib/score.parity.test.ts`가 같은 파일을 읽어 TypeScript 결과와 대조한다.
  3. 산식을 고치면 벡터가 바뀐다 — `--update-vectors`로 다시 굽고 diff를 사람이 본다.
     자동으로 덮어쓰지 않는 이유가 그것이다.

    pytest tests/test_parity.py --update-vectors
"""

from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd
import pytest
from conftest import FIXTURES

from transform.figi import DEFAULT_DEMAND_W, DEFAULT_SUPPLY_W, score

VECTORS = FIXTURES / "parity_vectors.json"

# 기본값과 다른 가중치도 한 벌 넣는다 — 슬라이더를 움직인 상태가 실제 사용 방식이다.
ALT_SUPPLY_W = {
    "branch_density": 0.20, "geographic_access": 0.35, "deposit_penetration": 0.15,
    "credit_penetration": 0.20, "atm_density": 0.10,
}
ALT_DEMAND_W = {
    "population_scale": 0.20, "income_downside": 0.20, "dispersion": 0.35,
    "cash_economy": 0.20, "credit_thirst": 0.05,
}

OUTPUTS = ["supply", "demand", "gap", "priority", "archetype", "archetype_borderline"]


def _sample() -> pd.DataFrame:
    """산식이 갈라질 만한 자리를 일부러 밟는 8개 가상 주.

    · 방콕 같은 극단 이상치 (백분위를 쓰는 이유)
    · ATM 결측 → 가중치에서 빠지고 재정규화되는가
    · 디지털 결측 → 아키타입이 null이 되는가
    · 동점 → 평균 순위
    · 중앙값 ±5pt 경계 → borderline 플래그
    """
    return pd.DataFrame({
        "tis1099_code": [10, 20, 30, 40, 50, 60, 70, 80],
        "branches":     [1328.0, 252.0, 92.0, 40.0, 40.0, 22.0, 14.0, 11.0],
        "population":   [9.1e6, 2.05e6, 6.2e5, 7.7e5, 7.7e5, 6.8e5, 4.3e5, 2.46e5],
        "area_km2":     [1568.7, 4363.0, 543.0, 6641.0, 6641.0, 7195.0, 11472.0, 12681.0],
        "deposits_total":  [1.09e13, 6.41e11, 2.02e11, 6.7e10, 6.7e10, 3.5e10, 2.6e10, 1.4e10],
        "credits_total":   [1.37e13, 4.56e11, 1.81e11, 7.1e10, 7.1e10, 2.0e10, 1.7e10, 9.5e9],
        "gpp_per_capita":  [697528.0, 601976.0, 439652.0, 86650.0, 86650.0, 83912.0, 90496.0, 72789.0],
        "gpp_agriculture_share": [0.1, 1.4, 3.1, 25.1, 25.1, 28.0, 24.6, 30.2],
        # 6번 주는 ATM 미집계 — 0이 아니라 결측이다
        "atm_count":    [1200.0, 310.0, 180.0, 44.0, 44.0, np.nan, 18.0, 9.0],
        # 8번 주는 디지털 결측 — 아키타입이 null이어야 한다
        "digital_readiness": [92.0, 78.0, 74.0, 61.0, 59.0, 52.0, 41.0, np.nan],
    })


def _case(label: str, supply_w: dict, demand_w: dict) -> dict:
    scored = score(_sample(), supply_w, demand_w)

    rows = []
    for _, r in scored.iterrows():
        rows.append({
            "tis1099_code": f"{int(r['tis1099_code']):02d}",
            "population": float(r["population"]),
            "digital_readiness": _num(r["digital_readiness"]),
            "pct_supply": {k: _num(r[f"pct_supply_{k}"]) for k in supply_w},
            "pct_demand": {k: _num(r[f"pct_demand_{k}"]) for k in demand_w},
            "expected": {
                "supply": _num(r["supply"]),
                "demand": _num(r["demand"]),
                "gap": _num(r["gap"]),
                "priority": _num(r["priority"]),
                "archetype": r["archetype"] if isinstance(r["archetype"], str) else None,
                "archetypeBorderline": bool(r["archetype_borderline"]),
            },
        })

    return {"label": label, "supplyWeights": supply_w, "demandWeights": demand_w, "rows": rows}


def _num(v):
    """NaN·NA를 JSON의 null로. 0으로 바꾸지 않는다."""
    if v is None or (isinstance(v, float) and math.isnan(v)) or pd.isna(v):
        return None
    return round(float(v), 4)


def build_vectors() -> dict:
    return {
        "_comment": (
            "tests/test_parity.py가 만든다. 손으로 고치지 마라. "
            "산식을 바꿨으면 pytest tests/test_parity.py --update-vectors 로 다시 굽고 diff를 확인한다."
        ),
        "cases": [
            _case("default", DEFAULT_SUPPLY_W, DEFAULT_DEMAND_W),
            _case("remote_first", ALT_SUPPLY_W, ALT_DEMAND_W),
        ],
    }


def test_vectors_match_current_formula(request):
    """커밋된 벡터가 지금의 figi.py와 같은가.

    다르면 산식이 바뀐 것이다 — TypeScript도 같이 고쳤는지 확인하고 벡터를 다시 구워라.
    """
    fresh = build_vectors()

    if request.config.getoption("--update-vectors"):
        VECTORS.write_text(json.dumps(fresh, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        pytest.skip(f"벡터를 새로 구웠다: {VECTORS}. diff를 확인하고 커밋할 것.")

    assert VECTORS.exists(), (
        f"{VECTORS}가 없다. pytest tests/test_parity.py --update-vectors 로 먼저 구울 것."
    )
    committed = json.loads(VECTORS.read_text(encoding="utf-8"))
    assert committed["cases"] == fresh["cases"], (
        "figi.py의 결과가 커밋된 패리티 벡터와 다르다. 산식을 바꿨다면 "
        "src/lib/score.ts도 같이 고치고 --update-vectors로 다시 구울 것."
    )


def test_vectors_cover_the_tricky_cases():
    """벡터가 실제로 경계를 밟고 있는지. 전부 평범한 값이면 패리티 테스트가 무의미하다."""
    rows = build_vectors()["cases"][0]["rows"]
    assert any(r["pct_supply"]["atm_density"] is None for r in rows), "ATM 결측 케이스가 없다"
    assert any(r["digital_readiness"] is None for r in rows), "디지털 결측 케이스가 없다"
    assert any(r["expected"]["archetype"] is None for r in rows), "archetype null 케이스가 없다"
    assert any(r["expected"]["archetypeBorderline"] for r in rows), "borderline 케이스가 없다"


def test_missing_indicator_is_dropped_not_zeroed():
    """ATM이 결측인 주가 ATM 0인 주처럼 취급되면 공급 점수가 부당하게 낮아진다."""
    rows = build_vectors()["cases"][0]["rows"]
    missing = next(r for r in rows if r["pct_supply"]["atm_density"] is None)
    # 나머지 네 지표의 가중 평균과 같아야 한다 (atm 가중치는 빠지고 재정규화)
    w = {k: v for k, v in DEFAULT_SUPPLY_W.items() if k != "atm_density"}
    total = sum(w.values())
    expected = sum(missing["pct_supply"][k] * v for k, v in w.items()) / total
    assert missing["expected"]["supply"] == pytest.approx(expected, abs=0.01)
