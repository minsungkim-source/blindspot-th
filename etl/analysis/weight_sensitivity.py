#!/usr/bin/env python3
"""가중치 민감도 — 기본 가중치 확정 세션의 근거 자료를 다시 굽는다.

    python etl/analysis/weight_sensitivity.py            전체
    python etl/analysis/weight_sensitivity.py --samples 5000

`docs/WEIGHT_SENSITIVITY.md`의 모든 수치가 여기서 나온다. 데이터가 갱신되면
문서는 낡지만 스크립트는 낡지 않는다 — 문서를 고칠 때 이걸 다시 돌려라.

**산식을 다시 구현하지 않는다.** `transform.figi`의 primitive(derive / percentile /
safe_log / _weighted / _renorm)를 그대로 불러 쓴다. figi.py와 score.ts가 이미 같은
산식의 두 사본이고 패리티 테스트가 그 둘을 붙들고 있다. 세 번째 사본을 만들면
그 그물 밖에서 조용히 갈라진다.

분석 대상은 **v1에서 실제로 계산되는 10개 지표**뿐이다. 디지털 축은 결측이라
(DATA_SOURCES.md의 '디지털 축' 절) 여기에도 들어가지 않는다.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "etl"))

from transform import figi  # noqa: E402

SUPPLY_KEYS = ["branch_density", "geographic_access", "deposit_penetration",
               "credit_penetration", "atm_density"]
DEMAND_KEYS = ["population_scale", "income_downside", "dispersion",
               "cash_economy", "credit_thirst"]

# config.yaml의 index.presets와 같은 값. 여기서 다시 적는 이유는 이 스크립트가
# 설정을 읽는 도구가 아니라 '그 설정이 낳는 결과'를 재는 도구이기 때문이다.
PRESETS: dict[str, tuple[dict, dict]] = {
    "balanced":     (dict(zip(SUPPLY_KEYS, [.30, .20, .20, .20, .10])),
                     dict(zip(DEMAND_KEYS, [.30, .25, .20, .15, .10]))),
    "scale_first":  (dict(zip(SUPPLY_KEYS, [.30, .20, .20, .20, .10])),
                     dict(zip(DEMAND_KEYS, [.50, .20, .15, .10, .05]))),
    "remote_first": (dict(zip(SUPPLY_KEYS, [.20, .35, .15, .20, .10])),
                     dict(zip(DEMAND_KEYS, [.20, .20, .35, .20, .05]))),
    "credit_gap":   (dict(zip(SUPPLY_KEYS, [.20, .15, .20, .35, .10])),
                     dict(zip(DEMAND_KEYS, [.25, .25, .10, .10, .30]))),
}

SEED = 42


def load() -> pd.DataFrame:
    """굽힌 figi.json에서 원값을 되읽는다. 네트워크를 타지 않는다."""
    rows = json.loads((ROOT / "data/processed/figi.json").read_text(encoding="utf-8"))
    flat = [{k: v for k, v in r.items() if k not in ("pct_supply", "pct_demand")} for r in rows]
    return figi.derive(pd.DataFrame(flat))


def axes(d: pd.DataFrame, with_scale: bool = False) -> tuple[dict, dict]:
    """공급·수요 축의 백분위 구성요소. figi.score()와 같은 정의다.

    `with_scale`이면 공급에 **규모 항**(`log(지점 수)`의 백분위)을 하나 더 만든다.
    현재 공급 축은 다섯 항이 전부 밀도(1인당·면적당)라, 인구 62만에 지점 92개인
    푸껫이 인구 910만인 방콕을 앞선다. 절대 규모를 넣는 것이 그 구조를 바꾸는
    유일한 방법이라 후보로 계산해 둔다 (기본 산식에는 없다).
    """
    p = {
        "branch_density": figi.percentile(d["branch_density"]),
        "geographic_access": figi.percentile(d["geographic_access"]),
        "deposit_penetration": figi.percentile(figi.safe_log(d["deposit_per_capita"])),
        "credit_penetration": figi.percentile(figi.safe_log(d["credit_per_capita"])),
        "atm_density": figi.percentile(d["atm_density"]),
    }
    if with_scale:
        p["branch_scale"] = figi.percentile(figi.safe_log(d["branches"]))
    q = {
        "population_scale": figi.percentile(figi.safe_log(d["population"])),
        "income_downside": figi.percentile(d["gpp_per_capita"], invert=True),
        "dispersion": figi.percentile(d["population_density"], invert=True),
        "cash_economy": figi.percentile(d["gpp_agriculture_share"]),
        "credit_thirst": figi.percentile(d["credit_deposit"], invert=True),
    }
    return p, q


def run(d, p, q, sw, dw) -> pd.DataFrame:
    """figi.score()와 같은 순서 — 뺄셈이 먼저, 반올림은 표시에서만.

    중간값을 반올림하면 gap_raw가 어긋나고 그 오차가 priority에서 log10(인구)만큼
    증폭된다 (실제로 두 구현이 이것 때문에 갈라진 적이 있다).
    """
    supply = figi._weighted(p, figi._renorm(sw))
    demand = figi._weighted(q, figi._renorm(dw))
    gap_raw = demand - supply
    prio = gap_raw * np.log10(d["population"].clip(lower=1))
    pmax = prio.max()
    out = pd.DataFrame({
        "name": d["name_en_canonical"],
        "supply": supply,
        "gap": (gap_raw + 100.0) / 2.0,
        "priority": (prio / pmax * 100.0).clip(lower=0) if pmax > 0 else np.nan,
    })
    out["rank"] = out["priority"].rank(ascending=False, method="min").astype(int)
    return out


def spearman(a, b) -> float:
    """동순위를 평균순위로 다시 매긴 뒤 피어슨. scipy를 끌어오지 않는다 —
    이 리포의 의존성이 아니고, 분석 편의로 늘릴 이유가 없다."""
    ra, rb = pd.Series(a).rank(), pd.Series(b).rank()
    return float(np.corrcoef(ra, rb)[0, 1])


def ensemble(d, p, q, n: int) -> np.ndarray:
    """Dirichlet(1)로 가중치를 균등 샘플링해 순위 행렬 (n × 77)을 만든다.

    **이것은 '그럴듯한 사업 가중치의 분포'가 아니다.** 단체(simplex) 위의 균등분포일
    뿐이고, 중립적인 기준선으로만 쓸 수 있다. 어떤 주가 관점과 무관하게 올라오는지를
    보는 용도이지, 이 합의가 정답이라는 뜻이 아니다.
    """
    rng = np.random.default_rng(SEED)
    out = np.empty((n, len(d)), dtype=np.int16)
    for i in range(n):
        sw = dict(zip(SUPPLY_KEYS, rng.dirichlet(np.ones(5))))
        dw = dict(zip(DEMAND_KEYS, rng.dirichlet(np.ones(5))))
        out[i] = run(d, p, q, sw, dw)["rank"].values
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", type=int, default=2000)
    args = ap.parse_args()

    d = load()
    p, q = axes(d)
    p_scale, _ = axes(d, with_scale=True)
    base = run(d, p, q, *PRESETS["balanced"]).set_index("name")
    names = base.index.values

    print(f"# 가중치 민감도  (주 {len(d)}개 · 표본 {args.samples}개 · seed {SEED})\n")

    # ── 1. 프리셋별 상위 20
    print("## 1. 프리셋별 우선순위 상위 20\n")
    top = base.sort_values("priority", ascending=False).head(20)
    tbl = pd.DataFrame({"주": top.index, "balanced": top["rank"].values})
    for nm in ("scale_first", "remote_first", "credit_gap"):
        r = run(d, p, q, *PRESETS[nm]).set_index("name")["rank"]
        tbl[nm] = [f"{r[n]} ({top['rank'][n] - r[n]:+d})" for n in top.index]
    print(tbl.to_string(index=False), "\n")

    # ── 2. 공급 1위와 규모 항
    print("## 2. 공급 1위 — 규모 항 가중치 스윕\n")
    s = base["supply"].sort_values(ascending=False)
    print(f"현재 산식 공급 상위 3: " +
          " · ".join(f"{n} {v:.2f}" for n, v in s.head(3).items()))
    print(f"방콕 − 푸껫 = {s.get('Bangkok', np.nan) - s.get('Phuket', np.nan):+.2f}pt\n")
    sw0 = PRESETS["balanced"][0]
    top10 = set(base.sort_values("priority", ascending=False).head(10).index)
    rows = []
    for w in (0.0, .05, .10, .15, .20, .30):
        sw = {k: v * (1 - w) for k, v in sw0.items()}
        if w:
            sw["branch_scale"] = w
        r = run(d, p_scale if w else p, q, sw, PRESETS["balanced"][1]).set_index("name")
        new10 = set(r.sort_values("priority", ascending=False).head(10).index)
        rows.append({
            "규모항 w": f"{w:.2f}",
            "방콕": round(r.loc["Bangkok", "supply"], 2),
            "푸껫": round(r.loc["Phuket", "supply"], 2),
            "공급1위": r["supply"].idxmax(),
            "상위10 교체": len(top10 ^ new10) // 2,
            "최대 순위이동": int((r["rank"] - base["rank"]).abs().max()),
        })
    print(pd.DataFrame(rows).to_string(index=False), "\n")

    # ── 3. 앙상블 강건성
    ranks = ensemble(d, p, q, args.samples)
    p10 = (ranks <= 10).mean(axis=0)
    p20 = (ranks <= 20).mean(axis=0)
    consensus = np.median(ranks, axis=0)

    print("## 3. 가중치 앙상블에서의 강건성\n")
    print(f"한 번이라도 상위 10에 든 주: {(ranks <= 10).any(axis=0).sum()} / {len(d)}")
    print(f"95% 이상 상위 10에 든 주:   {(p10 >= .95).sum()}\n")
    t = pd.DataFrame({
        "P(상위10)%": (p10 * 100).round().astype(int),
        "P(상위20)%": (p20 * 100).round().astype(int),
        "합의순위": consensus.astype(int),
        "balanced": base["rank"].values,
    }, index=names)
    print(t.sort_values("P(상위10)%", ascending=False).head(15).to_string(), "\n")

    # ── 4. 프리셋 vs 합의
    print("## 4. 프리셋이 합의와 얼마나 가까운가\n")
    for nm in PRESETS:
        r = run(d, p, q, *PRESETS[nm]).set_index("name").loc[names, "rank"].values
        hit = len(set(names[np.argsort(r)[:10]]) & set(names[np.argsort(consensus)[:10]]))
        print(f"  {nm:<13} rho={spearman(r, consensus):.3f}   "
              f"평균 순위오차 {np.abs(r - consensus).mean():4.1f}계단   상위10 일치 {hit}/10")

    diff = pd.Series(base["rank"].values - consensus, index=names).sort_values()
    print("\n  balanced가 합의보다 높이 올리는 주:", ", ".join(
        f"{n}({int(v):+d})" for n, v in diff.head(4).items()))
    print("  balanced가 합의보다 낮게 내리는 주:", ", ".join(
        f"{n}({int(v):+d})" for n, v in diff.tail(4).items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
