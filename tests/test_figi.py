"""FIGI 산식 — 백분위·가중합·아키타입 분류.

산식의 단일 출처는 METHODOLOGY.md다. 코드와 문서가 어긋나면 코드가 틀린 것으로 본다.
여기서 고정하는 것은 그 문서가 말하는 성질들이다:

  · 백분위는 0..100, 동점은 평균 순위, 결측은 결측으로 남는다
  · 결측 지표는 0이 아니라 **가중치에서 빠지고** 남은 것끼리 재정규화된다
  · 아키타입은 평균이 아니라 중앙값으로 가른다 (방콕이 평균을 끌어간다)
  · 디지털 축이 없으면 분류하지 않는다 (절반을 찍지 않는다)
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from transform.figi import DEFAULT_SUPPLY_W, _renorm, _weighted, derive, percentile, score


# ── 백분위 ───────────────────────────────────────────────────────────────

def test_percentile_spans_full_range():
    p = percentile(pd.Series([1, 2, 3, 4, 5]))
    assert p.iloc[0] == 0.0
    assert p.iloc[-1] == 100.0


def test_percentile_invert_flips_the_scale():
    s = pd.Series([1, 2, 3, 4, 5])
    assert percentile(s, invert=True).tolist() == percentile(s).tolist()[::-1]


def test_percentile_ties_get_average_rank():
    p = percentile(pd.Series([10, 10, 20]))
    assert p.iloc[0] == p.iloc[1]
    assert p.iloc[0] == pytest.approx(25.0)      # 순위 1,2의 평균 → (1.5-1)/2*100


def test_percentile_keeps_missing_missing():
    """결측을 순위 안으로 끌어들이면 없는 데이터가 점수를 얻는다."""
    p = percentile(pd.Series([1.0, np.nan, 3.0]))
    assert np.isnan(p.iloc[1])
    assert p.iloc[0] == 0.0 and p.iloc[2] == 100.0


def test_percentile_single_value_is_undefined():
    assert percentile(pd.Series([42.0])).isna().all()


# ── 가중합 ───────────────────────────────────────────────────────────────

def test_renorm_sums_to_one():
    assert sum(_renorm({"a": 2, "b": 2}).values()) == pytest.approx(1.0)
    assert _renorm({"a": 2, "b": 2})["a"] == pytest.approx(0.5)


def test_renorm_rejects_zero_total():
    with pytest.raises(ValueError):
        _renorm({"a": 0, "b": 0})


def test_weighted_drops_missing_and_renormalizes():
    """결측 지표를 0으로 채우면 점수가 인위적으로 낮아진다. 빼고 재정규화해야 한다."""
    parts = {
        "a": pd.Series([80.0, 80.0]),
        "b": pd.Series([40.0, np.nan]),
    }
    out = _weighted(parts, {"a": 0.5, "b": 0.5})
    assert out.iloc[0] == pytest.approx(60.0)    # (80+40)/2
    assert out.iloc[1] == pytest.approx(80.0)    # b가 빠지고 a만 남아 재정규화


def test_weighted_all_missing_is_nan_not_zero():
    parts = {"a": pd.Series([np.nan]), "b": pd.Series([np.nan])}
    assert np.isnan(_weighted(parts, {"a": 0.5, "b": 0.5}).iloc[0])


def test_default_supply_weights_sum_to_one():
    """config.yaml · weights.ts와 같은 값이어야 한다 (METHODOLOGY §3)."""
    assert sum(DEFAULT_SUPPLY_W.values()) == pytest.approx(1.0)


# ── 파생 지표 ────────────────────────────────────────────────────────────

def _frame(**overrides) -> pd.DataFrame:
    n = 4
    base = {
        "tis1099_code": [10, 20, 30, 40],
        "branches": [100.0, 50.0, 20.0, 10.0],
        "population": [1e6, 5e5, 3e5, 2e5],
        "area_km2": [1000.0, 5000.0, 8000.0, 12000.0],
        "deposits_total": [5e11, 1e11, 3e10, 1e10],
        "credits_total": [6e11, 8e10, 2e10, 9e9],
        "gpp_per_capita": [500000.0, 200000.0, 120000.0, 80000.0],
        "gpp_agriculture_share": [2.0, 12.0, 25.0, 33.0],
        "digital_readiness": [90.0, 70.0, 50.0, 30.0],
    }
    base.update(overrides)
    assert all(len(v) == n for v in base.values())
    return pd.DataFrame(base)


def test_derive_units():
    d = derive(_frame())
    assert d["branch_density"].iloc[0] == pytest.approx(10.0)        # 100 / (1e6/1e5)
    assert d["geographic_access"].iloc[0] == pytest.approx(100.0)    # 100 / (1000/1e3)
    assert d["population_density"].iloc[0] == pytest.approx(1000.0)
    assert d["credit_deposit"].iloc[0] == pytest.approx(1.2)


def test_derive_atm_density_is_nan_when_uncounted():
    """ATM이 없는 주와 ATM을 세지 못한 주는 다르다."""
    d = derive(_frame())
    assert d["atm_density"].isna().all()


# ── 지수와 아키타입 ──────────────────────────────────────────────────────

def test_score_produces_bounded_axes():
    d = score(_frame())
    for col in ("supply", "demand", "gap"):
        assert d[col].between(0, 100).all()


def test_high_supply_province_has_low_gap():
    """지점·예금이 몰린 주는 갭이 낮아야 한다. 부호가 뒤집히면 지도 전체가 거짓말이 된다."""
    d = score(_frame())
    assert d.loc[d["supply"].idxmax(), "gap"] < d.loc[d["supply"].idxmin(), "gap"]


def test_archetypes_split_on_medians():
    d = score(_frame())
    assert set(d["archetype"]) <= {
        "agent_kiosk", "digital_first", "retain_crosssell", "watch",
    }
    # 갭 상위 + 디지털 상위 = 디지털 우선, 갭 상위 + 디지털 하위 = 에이전트·키오스크
    hi_gap = d[d["gap"] >= d["gap"].median()]
    assert set(hi_gap["archetype"]) <= {"digital_first", "agent_kiosk"}


def test_archetype_is_null_when_digital_missing():
    """디지털 축이 없으면 좌우를 가를 수 없다. 절반을 찍는 대신 분류하지 않는다.

    src/lib/score.ts도 같은 규칙이어야 한다 (test_parity.py).
    """
    d = score(_frame(digital_readiness=[np.nan] * 4))
    assert d["archetype"].isna().all()
    assert not d["archetype_borderline"].any()
    # 갭은 여전히 계산된다 — 디지털이 없다고 지도까지 죽지는 않는다
    assert d["gap"].notna().all()


def test_borderline_flag_marks_the_uncertain_middle():
    """디지털은 추정치다. 중앙값 ±5pt 안이면 좌우 분류를 신뢰할 수 없다."""
    d = score(_frame(digital_readiness=[90.0, 61.0, 59.0, 30.0]))
    assert d["archetype_borderline"].tolist() == [False, True, True, False]


def test_priority_is_zero_floored_and_peaks_at_100():
    d = score(_frame())
    assert d["priority"].max() == pytest.approx(100.0)
    assert (d["priority"] >= 0).all()


def test_percentiles_are_emitted_for_the_weight_sliders():
    """프런트엔드는 백분위를 받아 가중치만 바꿔 재계산한다. 컬럼이 없으면 슬라이더가 죽는다."""
    d = score(_frame())
    for key in DEFAULT_SUPPLY_W:
        assert f"pct_supply_{key}" in d.columns
