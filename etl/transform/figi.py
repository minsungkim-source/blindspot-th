"""
FIGI — Financial Inclusion Gap Index

산식의 단일 출처. METHODOLOGY.md와 이 파일이 어긋나면 이 파일이 틀린 것이다.
프런트엔드의 src/lib/score.ts는 이 로직을 TypeScript로 미러링한다 —
가중치 슬라이더가 브라우저에서 재계산해야 하기 때문. 두 구현은 같은 결과를 내야 한다
(tests/test_parity.py 참조).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# ---------------------------------------------------------------- 정규화


def percentile(s: pd.Series, invert: bool = False) -> pd.Series:
    """77개 주 내 백분위 순위 0..100. 동점은 평균 순위.

    z-score를 쓰지 않는 이유: 방콕이 거의 모든 지표에서 극단 이상치라
    나머지 76개 주가 한 덩어리로 눌린다. METHODOLOGY §2 참조.
    """
    r = s.rank(method="average", na_option="keep")
    n = r.notna().sum()
    if n <= 1:
        return pd.Series(np.nan, index=s.index)
    p = (r - 1) / (n - 1) * 100.0
    return 100.0 - p if invert else p


def safe_log(s: pd.Series) -> pd.Series:
    return np.log(s.where(s > 0))


# ---------------------------------------------------------------- 파생 지표


def derive(df: pd.DataFrame) -> pd.DataFrame:
    """원값에서 지수 입력 지표를 만든다. 단위는 툴팁에 그대로 쓰이므로 유지."""
    d = df.copy()

    pop_100k = d["population"] / 1e5
    area_1k = d["area_km2"] / 1e3

    d["branch_density"] = d["branches"] / pop_100k
    d["geographic_access"] = d["branches"] / area_1k
    d["deposit_per_capita"] = d["deposits_total"] / d["population"]
    d["credit_per_capita"] = d["credits_total"] / d["population"]
    atm = pd.to_numeric(d.get("atm_count", pd.Series(np.nan, index=d.index)), errors="coerce")
    d["atm_density"] = atm / pop_100k
    d["population_density"] = d["population"] / d["area_km2"]
    d["credit_deposit"] = d["credits_total"] / d["deposits_total"]

    return d


# ---------------------------------------------------------------- 지수

DEFAULT_SUPPLY_W = {
    "branch_density": 0.30,
    "geographic_access": 0.20,
    "deposit_penetration": 0.20,
    "credit_penetration": 0.20,
    "atm_density": 0.10,
}

DEFAULT_DEMAND_W = {
    "population_scale": 0.30,
    "income_downside": 0.25,
    "dispersion": 0.20,
    "cash_economy": 0.15,
    "credit_thirst": 0.10,
}


def score(
    df: pd.DataFrame,
    supply_w: dict[str, float] | None = None,
    demand_w: dict[str, float] | None = None,
) -> pd.DataFrame:
    """Supply / Demand / GAP / Priority / 아키타입을 계산해 컬럼으로 붙인다."""
    supply_w = _renorm(supply_w or DEFAULT_SUPPLY_W)
    demand_w = _renorm(demand_w or DEFAULT_DEMAND_W)

    d = derive(df)

    # --- 공급 축 (전부 BOT 실데이터, ATM만 OSM 보조)
    p = {}
    p["branch_density"] = percentile(d["branch_density"])
    p["geographic_access"] = percentile(d["geographic_access"])
    p["deposit_penetration"] = percentile(safe_log(d["deposit_per_capita"]))
    p["credit_penetration"] = percentile(safe_log(d["credit_per_capita"]))
    p["atm_density"] = percentile(d["atm_density"])

    # --- 수요 축
    q = {}
    q["population_scale"] = percentile(safe_log(d["population"]))
    q["income_downside"] = percentile(d["gpp_per_capita"], invert=True)
    q["dispersion"] = percentile(d["population_density"], invert=True)
    q["cash_economy"] = percentile(d["gpp_agriculture_share"])
    q["credit_thirst"] = percentile(d["credit_deposit"], invert=True)

    for k, v in p.items():
        d[f"pct_supply_{k}"] = v
    for k, v in q.items():
        d[f"pct_demand_{k}"] = v

    # **중간값을 반올림하지 않는다.** 반올림은 표시의 문제이고, 계산에 끼어들면
    # gap_raw가 최대 0.01 어긋나고 그 오차가 priority에서 log10(인구)만큼 증폭된다.
    # score.ts도 같은 순서다 (뺄셈 먼저, 반올림은 출력에서) — 어긋나면 패리티 테스트가 잡는다.
    supply = _weighted(p, supply_w)
    demand = _weighted(q, demand_w)

    # --- 갭
    d["gap_raw"] = demand - supply                        # -100 .. 100
    gap = (d["gap_raw"] + 100.0) / 2.0                    # 0 .. 100 (표시용)

    prio = d["gap_raw"] * np.log10(d["population"].clip(lower=1))
    prio_max = prio.max()
    d["priority"] = (
        pd.Series(np.nan, index=d.index) if not np.isfinite(prio_max) or prio_max <= 0
        else (prio / prio_max * 100.0).clip(lower=0)
    )

    # --- 아키타입 (평균이 아니라 중앙값 — 방콕이 평균을 끌어간다)
    #     비교도 반올림 전 값으로 한다. 경계에 걸친 주의 분류가 반올림에 좌우되면 안 된다.
    gap_mid = gap.median()
    dig = pd.to_numeric(d.get("digital_readiness", pd.Series(np.nan, index=d.index)),
                        errors="coerce")
    # 전부 결측이면 median()이 빈 슬라이스 경고를 낸다. 물어볼 것도 없는 경우다.
    dig_mid = dig.median() if dig.notna().any() else float("nan")

    d["gap"] = gap        # archetype()이 행 단위로 읽을 수 있도록 붙여 둔다 (아래에서 반올림)

    def archetype(row) -> str | None:
        # 디지털 축이 없으면 좌우를 가를 수 없다. 절반을 찍는 대신 분류하지 않는다.
        if pd.isna(row["digital_readiness"]) or pd.isna(dig_mid) or pd.isna(row["gap"]):
            return None
        hi_gap = row["gap"] >= gap_mid
        hi_dig = row["digital_readiness"] >= dig_mid
        if hi_gap and hi_dig:
            return "digital_first"
        if hi_gap and not hi_dig:
            return "agent_kiosk"
        if not hi_gap and hi_dig:
            return "retain_crosssell"
        return "watch"

    d["digital_readiness"] = dig
    d["archetype"] = d.apply(archetype, axis=1)

    # 디지털 축은 추정치다. 중앙값 ±5pt 안이면 좌우 분류를 신뢰할 수 없다.
    d["archetype_borderline"] = ((dig - dig_mid).abs() < 5.0).fillna(False)

    # --- 반올림은 여기서 한 번만. 위의 모든 계산과 비교는 전체 정밀도로 끝났다.
    d["supply"] = supply.round(2)
    d["demand"] = demand.round(2)
    d["gap"] = gap.round(2)

    return d


def _renorm(w: dict[str, float]) -> dict[str, float]:
    total = sum(w.values())
    if total <= 0:
        raise ValueError("가중치 합이 0이다.")
    return {k: v / total for k, v in w.items()}


def _weighted(parts: dict[str, pd.Series], weights: dict[str, float]) -> pd.Series:
    """결측 지표는 가중치에서 빼고 남은 것끼리 재정규화한다 (0으로 처리하지 않는다)."""
    num = None
    den = None
    for k, w in weights.items():
        s = parts[k]
        contrib = s.fillna(0) * w
        mask = s.notna().astype(float) * w
        num = contrib if num is None else num + contrib
        den = mask if den is None else den + mask
    # 반올림하지 않는다 — 호출부가 출력 직전에 한 번만 반올림한다 (score() 참조)
    return num / den.replace(0, np.nan)
