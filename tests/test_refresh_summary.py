"""월간 갱신 PR의 검토 요약 — 판정이 맞는 단계로 나오는가.

이 요약이 틀리면 두 방향으로 해롭다. 🛑를 놓치면 틀린 숫자가 "머지해도 된다"는 문구를
달고 나가고, 반대로 ⚠️를 🛑로 올리면 BOT이 새 달을 안 낸 것만으로 매달 PR이 막혀
사람들이 경고를 무시하는 법을 배운다. 둘 다 여기서 고정한다.
"""

from __future__ import annotations

import copy
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".github" / "scripts"))

import refresh_summary as s  # noqa: E402

TODAY = date(2026, 10, 1)


def meta(as_of="2026-08", label=None, hash_="3bf442c80cbbe289", degraded=None, **flags):
    srcs = {
        "bot_province": {"as_of": as_of, "as_of_label": label or f"{as_of} p",
                         "fingerprint": {"header_hash": hash_}},
        "nesdc_gpp": {"as_of": "2024"},
        "osm_atm": {"as_of": "2026-10-01"},
    }
    for key, names in flags.items():          # from_cache=["nesdc_gpp"] 형태
        for n in names:
            srcs[n][key] = True
    return {"sources": srcs, "degraded_sources": degraded if degraded is not None else {"nso_ict": "418"}}


def figi(prios, atm=100):
    return [{"tis1099_code": f"{i:02d}", "name_en_canonical": f"P{i:02d}",
             "priority": p, "atm_count": atm} for i, p in enumerate(prios, 10)]


BASE_PRIOS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 3, 0, 0, 0]


def run(pm, nm, pf=None, nf=None, today=TODAY):
    pf = pf if pf is not None else figi(BASE_PRIOS)
    nf = nf if nf is not None else figi(BASE_PRIOS)
    return s.summarize(pm, nm, pf, nf, today)


def verdict(body):
    return "block" if "머지 보류" in body else "ok"


# ── 판정 단계 ─────────────────────────────────────────────────────────

def test_nothing_changed_recent_data_is_clean():
    body = run(meta(), meta())
    assert verdict(body) == "ok"
    assert s.WARN not in body and s.BLOCK not in body


def test_stale_data_warns_but_does_not_block():
    """가장 중요한 성질. 15개월 된 BOT 데이터는 알려야 하지만 머지를 막으면 안 된다 —
    막으면 BOT이 새 달을 낼 때까지 ATM·미리보기 갱신까지 매달 멈춘다."""
    body = run(meta("2025-06"), meta("2025-06"))
    assert verdict(body) == "ok"
    assert "16개월 전" in body and s.WARN in body


def test_as_of_going_backwards_blocks():
    assert verdict(run(meta("2026-08"), meta("2026-07"))) == "block"


def test_as_of_advancing_is_ok():
    body = run(meta("2026-07"), meta("2026-08"))
    assert verdict(body) == "ok" and "전진" in body


def test_revision_flag_change_is_info():
    body = run(meta("2026-08", "AUG 2026 p"), meta("2026-08", "AUG 2026 r"))
    assert verdict(body) == "ok" and "개정 표시" in body


def test_newly_degraded_source_blocks():
    body = run(meta(), meta(degraded={"nso_ict": "418", "osm_atm": "Overpass 504"}))
    assert verdict(body) == "block" and "`osm_atm`" in body


def test_recovered_source_is_ok():
    body = run(meta(degraded={"nso_ict": "x", "osm_atm": "504"}), meta(degraded={"nso_ict": "x"}))
    assert verdict(body) == "ok" and "확보했다" in body


def test_snapshot_blocks():
    assert verdict(run(meta(), meta(from_snapshot=["osm_atm"]))) == "block"


def test_cache_on_annual_source_is_fine_but_on_monthly_blocks():
    """캐시 폴백은 연간 소스에만 허용된다 (CLAUDE.md). BOT에 붙으면 지난달 숫자다."""
    assert verdict(run(meta(), meta(from_cache=["nesdc_gpp"]))) == "ok"
    assert verdict(run(meta(), meta(from_cache=["bot_province"]))) == "block"


def test_fingerprint_change_blocks():
    assert verdict(run(meta(), meta(hash_="deadbeef00000000"))) == "block"


# ── 순위 ──────────────────────────────────────────────────────────────

def _churned(n):
    """상위 10 중 n개를 11위 밖의 주로 바꾼다."""
    p = BASE_PRIOS.copy()
    for k in range(n):
        p[9 - k], p[12 + k] = 0, 95 - k        # 10·9·8위를 0으로, 대상 아니던 주를 위로
    return p


def test_top10_churn_with_bot_unchanged_warns():
    """BOT이 그대로면 움직일 수 있는 건 ATM뿐이다 — 상위 10이 크게 바뀌면 이상하다."""
    body = run(meta("2026-08"), meta("2026-08"), nf=figi(_churned(3)))
    assert "3개 교체" in body and "BOT이 그대로인데도" in body
    assert verdict(body) == "ok"                      # 알릴 일이지 막을 일은 아니다


def test_top10_churn_with_bot_advanced_is_info():
    body = run(meta("2026-07"), meta("2026-08"), nf=figi(_churned(3)))
    assert "3개 교체" in body and "BOT이 그대로인데도" not in body


def test_floor_ties_do_not_count_as_moves():
    """대상 아님(0)끼리는 순위가 없다. 그 안에서 순서가 바뀐 걸 '이동'으로 세면 소음이다."""
    pf = figi(BASE_PRIOS)
    nf = copy.deepcopy(pf)
    nf[-1], nf[-2] = nf[-2], nf[-1]                    # 0인 두 주의 자리만 바꿈
    assert "순위 변화 없음" in run(meta(), meta(), pf, nf)


def test_atm_jump_warns():
    body = run(meta(), meta(), figi(BASE_PRIOS, atm=100), figi(BASE_PRIOS, atm=80))
    assert s.WARN in body and "ATM" in body


# ── 다른 파일과의 약속 ────────────────────────────────────────────────

def test_stale_threshold_matches_the_site():
    """사이트 머리말 칩과 이 요약이 같은 기준으로 '오래됐다'고 말해야 한다."""
    ts = (ROOT / "src/lib/dataAge.ts").read_text(encoding="utf-8")
    m = re.search(r"export const STALE_MONTHS = (\d+);", ts)
    assert m and int(m.group(1)) == s.STALE_MONTHS


def test_months_since_matches_dataAge_rules():
    # src/lib/dataAge.test.ts와 같은 사례
    assert s.months_since("2025-06", date(2026, 9, 15)) == 15
    assert s.months_since("2025-12", date(2026, 1, 15)) == 1
    assert s.months_since("2026-09", date(2026, 7, 15)) == 0
    for bad in (None, "", "JUN 2025 p", "2025-13"):
        assert s.months_since(bad, TODAY) is None


def test_workflow_uses_the_summary_as_pr_body():
    wf = (ROOT / ".github/workflows/refresh-data.yml").read_text(encoding="utf-8")
    assert "refresh_summary.py" in wf
    assert "body-path:" in wf
    # 고정 체크리스트(body:)가 남아 있으면 body-path가 이기긴 하지만, 두 벌이 어긋난다
    assert not re.search(r"^\s+body: \|", wf, re.M)


def test_item_wording_does_not_contradict_a_block_verdict():
    """🛑 판정 아래에 '머지해도 된다'는 항목 문구가 섞이면 읽는 사람이 헷갈린다.
    ⚠️·ℹ️ 항목은 '이것만으로는 막지 않는다'고 말해야 한다 — 전체 판정은 머리에서 한다."""
    body = run(meta("2025-06"), meta("2025-06", hash_="0000aaaa1111bbbb", from_cache=["nesdc_gpp"]))
    assert verdict(body) == "block"
    items = body.split("### ", 1)[1]            # 머리의 판정 문단을 뺀 항목들
    assert "머지해도 된다" not in items
    assert "머지는 해도 된다" not in items
