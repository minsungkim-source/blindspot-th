"""소스별 DataFrame을 TIS-1099 코드 위에 붙이고, 디지털 축을 하향 추정한다."""

from __future__ import annotations

import pandas as pd

BOT_COLUMNS = [
    "tis1099_code", "region_nso", "province_raw", "branches",
    "deposits_total", "credits_total", "credit_deposit", "credit_deposit_pct",
    "dep_demand", "dep_saving", "dep_time", "dep_pn", "dep_ncd",
    "cr_overdraft", "cr_loan", "cr_bills", "cr_others",
]


def resolve_codes(df: pd.DataFrame, alias_map: dict[str, int], source: str) -> pd.DataFrame:
    """join_key → tis1099_code. 하나라도 못 붙으면 즉시 실패시킨다.

    조용히 NaN으로 흘려보내면 뒤에서 '지점수 결측 12건'처럼 원인이 흐려진 채로 터진다.
    여기서 터뜨리면 어떤 철자가 문제인지 그 자리에서 보인다.
    """
    out = df.copy()
    out["tis1099_code"] = out["join_key"].map(alias_map)
    bad = out[out["tis1099_code"].isna()]
    if len(bad):
        names = ", ".join(f"{r.province_raw!r}(→{r.join_key})" for r in bad.itertuples())
        raise ValueError(
            f"{source}의 주명 {len(bad)}개가 크로스워크에 붙지 않는다: {names}. "
            f"data/reference/province_name_aliases.csv에 별칭을 추가할 것 "
            f"(이름을 코드에서 치환하지 마라)."
        )
    dupes = out["tis1099_code"][out["tis1099_code"].duplicated()]
    if len(dupes):
        raise ValueError(f"{source}에서 두 행이 같은 주로 붙었다: {sorted(set(dupes))}")

    out["tis1099_code"] = out["tis1099_code"].astype(int)
    return out


def attach(base: pd.DataFrame, collected: dict) -> pd.DataFrame:
    """crosswalk(base)에 각 소스를 left join 한다.

    base 는 77행이 보장되어야 한다. 어떤 소스가 매칭에 실패하면
    해당 컬럼이 NaN으로 남고 validate.run() 이 잡는다 — 조용히 0으로 채우지 않는다.
    """
    df = base.copy()
    alias_map = collected["admin_ref"]["alias_map"]

    bot = resolve_codes(collected["bot_province"]["current"], alias_map, "BOT FI_CB_011_S4")
    df = df.merge(bot[[c for c in BOT_COLUMNS if c in bot.columns]],
                  on="tis1099_code", how="left")

    if "nesdc_gpp" in collected:
        nesdc = collected["nesdc_gpp"]["provinces"].drop(columns=["nesdc_name"], errors="ignore")
        df = df.merge(nesdc, on="tis1099_code", how="left")

    if "osm_atm" in collected:
        df = df.merge(collected["osm_atm"]["counts"], on="tis1099_code", how="left")
    else:
        # 소스가 꺼졌거나 도달하지 못했다. 0이 아니라 결측이다 —
        # ATM이 없는 주와 ATM을 세지 못한 주는 다른 것이다.
        df["atm_count"] = pd.NA

    return df


def downscale_digital(df: pd.DataFrame, nso: dict | None) -> pd.DataFrame:
    """R(p) = u(p)·rate[region, urban] + (1-u(p))·rate[region, rural]

    주 단위 원본이 없어서 하는 추정이다. METHODOLOGY §5.
    결과에는 반드시 confidence='estimated' 가 따라붙는다.

    v1에서는 두 입력이 모두 없다 — NSO 카탈로그 API는 차단되어 있고(nso_ict 참조),
    주별 도시화율(urbanization_rate)을 주는 공개 소스도 아직 없다.
    둘 중 하나라도 없으면 추정하지 않고 결측으로 둔다. 0으로 채우지 않는다.
    """
    d = df.copy()

    if nso is None or not nso.get("rates"):
        d["digital_readiness"] = float("nan")
        d["digital_confidence"] = "missing"
        return d

    if "urbanization_rate" not in d.columns or d["urbanization_rate"].isna().all():
        d["digital_readiness"] = float("nan")
        d["digital_confidence"] = "missing"
        print("         WARN  주별 도시화율이 없어 디지털 하향추정을 건너뛴다 "
              "(권역값만으로는 주별 값을 만들 수 없다).")
        return d

    rates = nso["rates"]          # {(region, 'urban'|'rural'): pct}
    u = d["urbanization_rate"].clip(0, 1)
    region = d["region_nso"] if "region_nso" in d.columns else d["region"]

    d["digital_readiness"] = [
        u_i * rates.get((r, "urban"), float("nan"))
        + (1 - u_i) * rates.get((r, "rural"), float("nan"))
        for r, u_i in zip(region, u)
    ]
    d["digital_confidence"] = "estimated"
    return d
