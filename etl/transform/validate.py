"""
검증 게이트. 여기서 실패하면 빌드가 죽고 데이터 갱신 PR이 열리지 않는다.

BOT 페이지는 ASP.NET 렌더라 구조가 바뀌면 파서가 조용히 깨진다.
"42개 주의 지점수가 0이 됨" 같은 변화를 사람이 보기 전에 자동으로 잡는 것이 목적이다.
"""

from __future__ import annotations

import pandas as pd


class ValidationError(Exception):
    pass


def run(
    df: pd.DataFrame,
    previous: pd.DataFrame | None,
    config: dict,
) -> list[str]:
    """실패는 예외로 던지고, 경고는 문자열 리스트로 반환한다."""
    cfg = config.get("validation", {})
    warnings: list[str] = []
    errors: list[str] = []

    n_expected = config.get("n_units", 77)

    # 1. 완전성
    if cfg.get("require_all_units", True) and len(df) != n_expected:
        errors.append(f"주 개수가 {len(df)}개다. {n_expected}개여야 한다.")

    # 2. 조인 실패
    #    normalize.resolve_codes()가 소스 쪽 미매칭을 이미 터뜨린다. 여기서 잡는 것은
    #    그 반대 방향 — 크로스워크에는 있는데 어떤 소스에도 붙지 않은 주다.
    max_fail = cfg.get("max_join_failures", 0)
    for source_col, source_name in (
        ("province_raw", "BOT"),
        ("gpp_per_capita", "NESDC"),
    ):
        if source_col not in df.columns:
            errors.append(f"'{source_col}'이 없다 — {source_name} 조인이 통째로 빠졌다.")
            continue
        unmatched = df[df[source_col].isna()]
        if len(unmatched) > max_fail:
            names = ", ".join(unmatched["name_en_canonical"].head(10).astype(str))
            errors.append(
                f"{source_name} 값이 붙지 않은 주 {len(unmatched)}개: {names}. "
                f"data/reference/province_name_aliases.csv에 별칭을 추가할 것."
            )

    # 3. 필수 필드 결측
    for field in cfg.get("required_fields", []):
        if field not in df.columns:
            errors.append(f"필수 컬럼 '{field}'가 없다.")
            continue
        n_null = df[field].isna().sum()
        if n_null:
            errors.append(f"'{field}'에 결측 {n_null}건. 대체하지 않고 실패시킨다.")

    # 4. 값의 상식 범위
    if "branches" in df.columns:
        zero_branches = (df["branches"].fillna(0) == 0).sum()
        if zero_branches > 0:
            errors.append(
                f"지점수가 0인 주 {zero_branches}개. 태국의 모든 주에 상업은행 지점이 있다 — "
                f"파싱 오류일 가능성이 높다."
            )
    if "credit_deposit" in df.columns:
        weird = df[(df["credit_deposit"] < 0.05) | (df["credit_deposit"] > 20)]
        if len(weird):
            warnings.append(f"예대율이 상식 범위를 벗어난 주 {len(weird)}개 — 단위 확인 필요.")

    # 5. 전월 대비 급변
    if previous is not None and not previous.empty:
        limit = cfg.get("max_mom_change_pct", 30)
        merged = df.merge(previous, on="tis1099_code", suffixes=("", "_prev"))

        # 병합이 비면 급변 감지가 조용히 꺼진다 — 게이트가 있다고 착각하게 되는 최악의 상태다.
        # 산출물은 코드를 문자열로 담고 파이프라인은 int로 조인하므로 타입이 어긋나기 쉽다.
        if merged.empty:
            errors.append(
                "직전 figi.json과 tis1099_code로 병합했는데 일치 행이 0개다. "
                "코드 타입이 어긋났을 가능성이 높다 — 전월 대비 급변 감지가 무력화된다."
            )
        elif len(merged) < len(df):
            warnings.append(
                f"직전 산출물과 {len(merged)}/{len(df)}개 주만 대응된다 — 신규·소멸 주를 확인할 것."
            )

        for field in ("branches", "population", "deposits_total"):
            if field not in merged or f"{field}_prev" not in merged:
                continue
            prev = merged[f"{field}_prev"].replace(0, pd.NA)
            change = ((merged[field] - prev) / prev * 100).abs()
            spikes = merged[change > limit]
            if len(spikes):
                names = ", ".join(spikes["name_en_canonical"].head(5).astype(str))
                errors.append(
                    f"'{field}'이 전월 대비 {limit}% 넘게 변한 주 {len(spikes)}개: {names}"
                )

    # 6. 지수 산출 결과
    for col in ("supply", "demand", "gap", "digital_readiness"):
        if col in df.columns:
            out_of_range = df[(df[col] < 0) | (df[col] > 100)]
            if len(out_of_range):
                errors.append(f"'{col}'이 0..100을 벗어난 주 {len(out_of_range)}개.")

    # 7. 지수가 실제로 계산됐는가
    #    입력 지표가 통째로 결측이면 _weighted()가 NaN을 돌려준다. 그 상태로 배포하면
    #    지도가 전부 '데이터 없음'으로 칠해진 채 조용히 나간다.
    for col in ("supply", "demand", "gap"):
        if col in df.columns:
            n_null = df[col].isna().sum()
            if n_null:
                errors.append(f"'{col}'이 계산되지 않은 주 {n_null}개. 입력 지표 결측을 확인할 것.")

    # 8. 지표가 통째로 사라졌는가
    #
    #    보조 소스가 한 달 실패하면 그 지표는 결측이 되고, _weighted()가 가중치에서 빼고
    #    재정규화한다 — **모든 주의 축 점수가 움직인다.** 실측(2026-08-31): Overpass가
    #    한 번 실패하면 공급 점수가 평균 2.7pt, 최대 7.9pt 변하고 순위가 최대 7계단 밀린다.
    #
    #    앞의 게이트들은 branches·population·deposits만 본다. 지표가 '틀린 값'이 아니라
    #    '없는 값'이 되는 이 경우는 어디에도 걸리지 않아서, 평범한 월간 갱신처럼 보인다.
    #    사람이 판단하도록 여기서 세운다.
    if previous is not None and not previous.empty:
        for col in cfg.get("indicator_columns", []):
            if col not in df.columns or col not in previous.columns:
                continue
            had = previous[col].notna().sum()
            has = df[col].notna().sum()
            if had > 0 and has == 0:
                errors.append(
                    f"'{col}'이 지난달에는 {had}개 주에 있었는데 이번에는 0개다. "
                    f"지표가 통째로 빠지면 가중치가 재정규화되어 **모든 주의 점수가 바뀐다** — "
                    f"소스 장애인지 확인할 것 (meta.json의 degraded_sources)."
                )
            elif had > 0 and has < had * 0.5:
                warnings.append(
                    f"'{col}'의 관측 주가 {had}개 → {has}개로 줄었다. 축 점수가 이동한다."
                )

    # 9. 디지털 축은 추정치다 — 없어도 빌드를 막지 않지만, 조용히 넘어가지도 않는다.
    if "digital_readiness" in df.columns and df["digital_readiness"].isna().all():
        warnings.append(
            "디지털 준비도가 전 주 결측이다. 사분면·아키타입이 비활성화된 채로 배포된다 "
            "(원인은 meta.json의 degraded_sources 참조)."
        )

    if errors:
        raise ValidationError(
            "검증 실패 — 데이터를 배포하지 않는다:\n  - " + "\n  - ".join(errors)
        )

    return warnings
