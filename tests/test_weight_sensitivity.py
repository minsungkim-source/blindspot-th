"""민감도 분석 하네스가 파이프라인과 같은 답을 내는가.

`etl/analysis/weight_sensitivity.py`는 figi.py의 primitive를 조립해 점수를 다시
계산한다. 조립 순서가 `figi.score()`와 어긋나면 **분석만 조용히 틀린다** —
사이트는 멀쩡하고 CI도 초록이고, 가중치 세션만 잘못된 표를 보고 결정한다.

그래서 여기서 고정하는 것은 하나다: balanced 가중치로 돌렸을 때 하네스가
**커밋된 figi.json을 재현하는가.** 재현하지 못하면 그 분석은 읽을 가치가 없다.

패리티 테스트(test_parity.py)가 figi.py ↔ score.ts를 붙들고 있는 것과 같은 취지이고,
이 테스트가 세 번째 사본을 막는 장치이기도 하다.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "etl" / "analysis"))

import weight_sensitivity as ws  # noqa: E402

FIGI = ROOT / "data/processed/figi.json"

pytestmark = pytest.mark.skipif(
    not FIGI.exists(),
    reason="figi.json이 없다 — 먼저 build.py를 돌려야 하는 분석 스크립트다",
)

# 산출물은 소수 2자리로 반올림되어 저장된다. 재현 오차의 상한은 그 반올림 폭이다.
ROUNDING = 0.005


@pytest.fixture(scope="module")
def frames():
    d = ws.load()
    p, q = ws.axes(d)
    mine = ws.run(d, p, q, *ws.PRESETS["balanced"]).set_index("name")
    ref = json.loads(FIGI.read_text(encoding="utf-8"))
    ref = {r["name_en_canonical"]: r for r in ref}
    return mine, ref


def test_reproduces_committed_scores(frames):
    """balanced는 파이프라인이 실제로 쓴 가중치다 — 값이 같아야 한다."""
    mine, ref = frames
    assert len(mine) == len(ref) == 77

    for col in ("supply", "gap", "priority"):
        worst = max(abs(mine.loc[n, col] - ref[n][col]) for n in ref)
        assert worst <= ROUNDING, f"'{col}'이 {worst:.4f} 어긋난다 (반올림 폭 {ROUNDING})"


def test_ranking_order_is_identical_where_it_is_defined(frames):
    """값이 반올림 안에서 맞아도 순위가 뒤집히면 분석의 결론이 달라진다.

    단 **priority가 0인 구간에는 순위가 존재하지 않는다.** 공급이 수요 이상인 주는
    `clip(lower=0)`에 걸려 전부 정확히 0이고, 그 40개의 상대 순서는 정렬 안정성이
    정하는 것이지 데이터가 정하는 것이 아니다. 그 구간까지 일치를 요구하면
    테스트가 데이터가 아니라 정렬 구현을 고정하게 된다.
    """
    mine, ref = frames
    nz = [n for n in mine.index if mine.loc[n, "priority"] > 0]
    mine_order = [n for n in mine.sort_values("priority", ascending=False).index if n in nz]
    ref_order = [k for k, v in sorted(ref.items(), key=lambda kv: -kv[1]["priority"])
                 if k in nz]
    assert mine_order == ref_order

    # 0인 집합 자체는 일치해야 한다 — 경계가 밀리면 그건 진짜 불일치다
    assert {n for n in mine.index if mine.loc[n, "priority"] == 0} == \
           {k for k, v in ref.items() if v["priority"] == 0}


def test_priority_has_a_large_exact_tie_at_zero(frames):
    """**이 도구의 성질을 고정한다.** 공급이 수요 이상인 주는 priority가 정확히 0이고,
    현재 데이터에서 그런 주가 77개 중 40개다 — 절반 이상이 한 값에 뭉쳐 있다.

    이것 자체는 의도된 정의다 ('확장 대상이 아님'). 문제는 이 사실이 화면 쪽에
    전달되지 않는다는 것이고, 실제로 우선순위 레이어의 7단계 램프가 4단계로
    주저앉아 있다 (docs/WEIGHT_SENSITIVITY.md §5). 그 비율이 크게 달라지면
    화면 처리도 다시 봐야 하므로 여기서 눈에 띄게 세워 둔다.
    """
    mine, _ = frames
    zeros = (mine["priority"] == 0).sum()
    assert zeros > 0, "clip(lower=0)이 사라졌다 — priority 정의가 바뀌었는지 확인하라"
    assert zeros / len(mine) > 0.25, (
        f"0인 주가 {zeros}개로 줄었다. 화면의 우선순위 레이어 처리를 다시 검토하라."
    )


def test_scale_term_is_opt_in(frames):
    """규모 항은 후보일 뿐 기본 산식이 아니다. 기본 호출에 새어 들어오면 안 된다."""
    d = ws.load()
    assert "branch_scale" not in ws.axes(d)[0]
    assert "branch_scale" in ws.axes(d, with_scale=True)[0]


def test_ensemble_is_deterministic():
    """seed 고정. 문서의 숫자가 돌릴 때마다 바뀌면 인용할 수 없다."""
    d = ws.load()
    p, q = ws.axes(d)
    a = ws.ensemble(d, p, q, 50)
    b = ws.ensemble(d, p, q, 50)
    assert (a == b).all()
