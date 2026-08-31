"""검증 게이트 — 일부러 깨뜨렸을 때 정말로 막히는가.

`docs/BACKLOG.md` Sprint 4의 "validate.py 게이트를 일부러 깨뜨려 PR이 안 열리는지 확인"이
이 파일이다. 게이트가 있다고 **믿는 것**과 게이트가 **작동하는 것**은 다르고,
이 프로젝트에서 후자를 확인할 방법은 이것뿐이다.

각 테스트는 정상 프레임에서 한 곳만 망가뜨린다. 한 번에 여러 곳을 깨면
"뭐라도 걸렸다"는 것만 알게 되고 어느 그물이 잡았는지는 모른다.

게이트가 막으면 `ValidationError` → `build.py`가 죽음 → 갱신 PR이 열리지 않음.
사이트에는 **직전 데이터가 그대로** 남는다 (낡은 데이터가 배포되는 게 아니라 갱신이 멈춘다).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from transform.validate import ValidationError, run

N = 77

CONFIG = {
    "n_units": N,
    "validation": {
        "require_all_units": True,
        "max_join_failures": 0,
        "max_mom_change_pct": 30,
        "required_fields": [
            "branches", "deposits_total", "credits_total",
            "population", "area_km2", "gpp_per_capita", "gpp_agriculture_share",
        ],
    },
}


def frame(n: int = N) -> pd.DataFrame:
    """게이트를 전부 통과하는 정상 프레임. 여기서 한 곳씩만 망가뜨린다."""
    i = np.arange(n)
    return pd.DataFrame({
        "tis1099_code": i + 10,
        "name_en_canonical": [f"Province {k}" for k in i],
        "province_raw": [f"Province {k}" for k in i],
        "branches": 10 + i,
        "deposits_total": 1e10 + i * 1e9,
        "credits_total": 8e9 + i * 8e8,
        "credit_deposit": np.full(n, 0.8),
        "population": 3e5 + i * 1e4,
        "area_km2": 5000.0 + i * 10,
        "gpp_per_capita": 90000.0 + i * 1000,
        "gpp_agriculture_share": 20.0 + (i % 10),
        "supply": np.linspace(5, 95, n),
        "demand": np.linspace(95, 5, n),
        "gap": np.linspace(10, 90, n),
        "digital_readiness": np.full(n, np.nan),
    })


def test_clean_frame_passes():
    """기준선. 이게 실패하면 아래 테스트가 무엇을 증명하는지 알 수 없다."""
    warnings = run(frame(), None, CONFIG)
    assert isinstance(warnings, list)


# ── 1. 완전성 ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("n", [76, 78])
def test_wrong_province_count_blocks(n):
    """77개가 아니면 백분위가 전부 어긋난다. 통과시키면 안 된다."""
    with pytest.raises(ValidationError, match="주 개수"):
        run(frame(n), None, CONFIG)


# ── 2. 조인 실패 ─────────────────────────────────────────────────────────

def test_unjoined_bot_rows_block():
    """크로스워크에는 있는데 BOT 값이 안 붙은 주 — 별칭 테이블에 구멍이 났다는 뜻."""
    df = frame()
    df.loc[df.index[:3], "province_raw"] = None
    with pytest.raises(ValidationError, match="BOT 값이 붙지 않은 주 3개"):
        run(df, None, CONFIG)


def test_unjoined_nesdc_rows_block():
    df = frame()
    df.loc[df.index[:2], "gpp_per_capita"] = None
    with pytest.raises(ValidationError) as e:
        run(df, None, CONFIG)
    # NESDC 조인 실패와 필수 필드 결측 두 그물에 동시에 걸린다 — 둘 다 언급되어야 한다
    assert "NESDC" in str(e.value)
    assert "gpp_per_capita" in str(e.value)


def test_missing_join_column_blocks():
    """컬럼 자체가 사라진 경우. 조용히 건너뛰면 조인이 통째로 빠진 채 배포된다."""
    with pytest.raises(ValidationError, match="province_raw"):
        run(frame().drop(columns=["province_raw"]), None, CONFIG)


# ── 3. 필수 필드 결측 ────────────────────────────────────────────────────

@pytest.mark.parametrize("field", [
    "branches", "deposits_total", "credits_total",
    "population", "area_km2", "gpp_agriculture_share",
])
def test_required_field_null_blocks(field):
    """결측을 0으로 대체하지 않고 실패시킨다 (CLAUDE.md의 첫 번째 규칙)."""
    df = frame()
    df.loc[df.index[5], field] = None
    with pytest.raises(ValidationError, match=f"'{field}'에 결측"):
        run(df, None, CONFIG)


def test_required_column_absent_blocks():
    with pytest.raises(ValidationError, match="필수 컬럼 'area_km2'가 없다"):
        run(frame().drop(columns=["area_km2"]), None, CONFIG)


# ── 4. 값의 상식 범위 ────────────────────────────────────────────────────

def test_zero_branch_province_blocks():
    """태국의 모든 주에 상업은행 지점이 있다. 0이 나오면 파싱 오류다 —
    이것이 스캐폴드가 예로 든 '42개 주의 지점수가 0이 됨' 시나리오다."""
    df = frame()
    df.loc[df.index[:42], "branches"] = 0
    with pytest.raises(ValidationError, match="지점수가 0인 주 42개"):
        run(df, None, CONFIG)


def test_absurd_credit_deposit_warns_but_does_not_block():
    """단위 착오는 경고로 남긴다 — 사람이 볼 수 있게 하되 갱신을 막지는 않는다."""
    df = frame()
    df.loc[df.index[0], "credit_deposit"] = 250.0        # % 를 배수로 착각한 값
    warnings = run(df, None, CONFIG)
    assert any("예대율" in w for w in warnings)


# ── 5. 전월 대비 급변 ────────────────────────────────────────────────────

def test_month_over_month_spike_blocks():
    """BOT 파서가 조용히 깨졌을 때의 대표 증상. 전월 대비로만 잡힌다."""
    prev = frame()
    df = frame()
    df.loc[df.index[:4], "branches"] = df.loc[df.index[:4], "branches"] * 2
    with pytest.raises(ValidationError, match="전월 대비 30% 넘게 변한 주 4개"):
        run(df, prev, CONFIG)


def test_small_month_over_month_change_passes():
    """정상적인 지점 증감까지 막으면 게이트가 무력화된다 (사람이 꺼 버린다)."""
    prev = frame()
    df = frame()
    df.loc[df.index[:4], "branches"] = df.loc[df.index[:4], "branches"] + 1
    run(df, prev, CONFIG)


def test_type_mismatch_with_previous_is_caught():
    """산출물은 코드를 문자열로, 파이프라인은 int로 다룬다. 타입이 어긋나면
    병합이 비면서 급변 감지가 **조용히 꺼진다** — 게이트가 있다고 착각하는 최악의 상태다.

    pandas가 먼저 막으면 그것대로 좋고, 통과하면 validate가 빈 병합을 잡아야 한다.
    """
    prev = frame()
    prev["tis1099_code"] = prev["tis1099_code"].astype(str)
    with pytest.raises((ValidationError, ValueError)) as e:
        run(frame(), prev, CONFIG)
    assert "tis1099_code" in str(e.value) or "일치 행이 0개" in str(e.value)


# ── 6·7. 지수 산출 결과 ──────────────────────────────────────────────────

@pytest.mark.parametrize("col", ["supply", "demand", "gap"])
def test_score_out_of_range_blocks(col):
    df = frame()
    df.loc[df.index[0], col] = 140.0
    with pytest.raises(ValidationError, match=f"'{col}'이 0..100"):
        run(df, None, CONFIG)


@pytest.mark.parametrize("col", ["supply", "demand", "gap"])
def test_uncomputed_score_blocks(col):
    """입력 지표가 통째로 결측이면 가중합이 NaN을 낸다.
    그 상태로 배포하면 지도가 전부 '데이터 없음'으로 칠해진 채 조용히 나간다."""
    df = frame()
    df.loc[df.index[:3], col] = np.nan
    with pytest.raises(ValidationError, match=f"'{col}'이 계산되지 않은 주 3개"):
        run(df, None, CONFIG)


# ── 8. 디지털 축 ─────────────────────────────────────────────────────────

def test_missing_digital_axis_warns_but_does_not_block():
    """v1의 현재 상태다. 갭·우선순위는 멀쩡하므로 배포를 막지 않되,
    조용히 넘어가지도 않는다."""
    warnings = run(frame(), None, CONFIG)
    assert any("디지털 준비도가 전 주 결측" in w for w in warnings)


def test_present_digital_axis_does_not_warn():
    df = frame()
    df["digital_readiness"] = np.linspace(30, 90, N)
    assert not any("디지털" in w for w in run(df, None, CONFIG))


# ── 실패 메시지의 품질 ───────────────────────────────────────────────────

def test_error_message_names_every_broken_gate():
    """한 번의 실행에서 여러 게이트가 걸리면 전부 보여야 한다.
    첫 번째만 알려주면 고치고 돌리고를 반복하게 된다 — ETL 한 번이 2분이다.
    """
    df = frame(76)
    df.loc[df.index[0], "branches"] = 0
    df.loc[df.index[1], "population"] = None

    with pytest.raises(ValidationError) as e:
        run(df, None, CONFIG)
    msg = str(e.value)
    assert "주 개수" in msg
    assert "지점수가 0인 주" in msg
    assert "'population'에 결측" in msg
    assert "배포하지 않는다" in msg
