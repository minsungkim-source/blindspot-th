"""월간 갱신 게이트 — 한 달에 정확히 한 번, 예약 실행이 늦거나 빠져도.

실제로 첫 예약 실행이 3시간 20분 늦게 떴고, GitHub는 부하가 몰리면 예약 실행을
빠뜨릴 수 있다고 명시한다. 예전 게이트는 한 달에 기회가 한 번이라 그 한 번이 빠지면
그 달 갱신이 조용히 사라졌다. 사이트는 직전 데이터로 멀쩡해 보여서 아무도 모른다.

눈으로는 1년에 한 번 볼까 말까 한 종류라, 1년치를 시뮬레이션해서 고정한다.
(예전 월말 버그 — 2월이 한 해에 한 번도 안 돌던 것 — 도 이렇게 잡았다.)
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))

import refresh_gate as g  # noqa: E402

UTC = timezone.utc
CRON_DAYS = (1, 2, 28, 29, 30, 31)   # refresh-data.yml의 cron과 같아야 한다


def utc(y, m, d, h=0, mi=0):
    return datetime(y, m, d, h, mi, tzinfo=UTC)


# ── 단위 ─────────────────────────────────────────────────────────────

def test_manual_dispatch_always_runs():
    assert g.decide(utc(2026, 9, 15, 3), "workflow_dispatch", [])[0] is True


def test_outside_window_skips():
    # 9/28 22:00 UTC = ICT 9/29 05:00 → 창 밖
    run, why = g.decide(utc(2026, 9, 28, 22), "schedule", [])
    assert run is False and "창" in why


def test_first_day_runs_when_no_pr_this_month():
    # 9/30 22:00 UTC = ICT 10/1 05:00
    assert g.decide(utc(2026, 9, 30, 22), "schedule", [utc(2026, 9, 3, 9)])[0] is True


def test_skips_when_pr_already_made_this_month():
    # 10/1에 PR을 만들었으면 10/2·10/3 회차는 건너뛴다
    made = [utc(2026, 9, 30, 22, 5)]            # ICT 10/1 05:05
    assert g.decide(utc(2026, 10, 1, 22), "schedule", made)[0] is False
    assert g.decide(utc(2026, 10, 2, 22), "schedule", made)[0] is False


def test_pr_month_is_judged_in_ict_not_utc():
    # 9/30 22:30 UTC에 만든 PR은 UTC로는 9월이지만 ICT로는 10월이다.
    # UTC로 판단하면 10/2 회차가 "10월 PR 없음"으로 보고 중복 PR을 연다.
    made = [utc(2026, 9, 30, 22, 30)]
    assert g.decide(utc(2026, 10, 1, 22), "schedule", made)[0] is False


def test_open_pr_this_month_is_rerun_to_update_it():
    """2026-10-01: 묵은 미러가 만든 나쁜 PR이 열려 있는 동안 2·3일 회차가 재시도하지 않았다.
    열린 PR은 다시 돌려 갱신한다 — 같은 브랜치라 새 PR은 생기지 않는다."""
    run, why = g.decide(utc(2026, 10, 1, 22), "schedule", [(utc(2026, 10, 1, 1, 14), "OPEN")])
    assert run is True and "열려 있다" in why


def test_merged_or_closed_pr_this_month_skips():
    for state in ("MERGED", "CLOSED"):
        run, _ = g.decide(utc(2026, 10, 1, 22), "schedule", [(utc(2026, 10, 1, 1), state)])
        assert run is False, state


def test_bare_timestamps_are_treated_as_merged():
    """상태 없이 시각만 오는 예전 형식은 '건너뛴다' 쪽으로 — 모르면 중복을 만들지 않는다."""
    assert g.decide(utc(2026, 10, 1, 22), "schedule", [utc(2026, 10, 1, 1)])[0] is False


def test_last_months_pr_does_not_block():
    assert g.decide(utc(2026, 10, 31, 22), "schedule", [utc(2026, 10, 1, 1)])[0] is True


def test_delay_keeps_the_ict_day():
    # 말일 22:00 UTC 예정이 18시간 늦어져도 ICT로는 여전히 1일이다
    assert g.decide(utc(2026, 10, 1, 16), "schedule", [])[0] is True


def test_february_is_not_skipped():
    # 28일뿐인 2월: 28일 22:00 UTC = ICT 3/1. 예전 버그가 정확히 여기서 한 해 한 번을 놓쳤다
    assert g.decide(utc(2027, 2, 28, 22), "schedule", [])[0] is True


# ── 1년 시뮬레이션 ───────────────────────────────────────────────────

def _fires(start: datetime, end: datetime):
    """cron `0 22 1,2,28-31 * *`의 발동 시각. 존재하지 않는 날짜(2/30 등)는 cron도 건너뛴다."""
    d = start
    while d <= end:
        if d.day in CRON_DAYS:
            yield d.replace(hour=22, minute=0)
        d += timedelta(days=1)


def _simulate(*, drop=lambda t: False, fail=lambda t, n: False, gate="new", seed=7, merge=True):
    """2026-12 ~ 2028-01을 돌려 2027년 각 ICT 달의 (성공 실행 수, 시도 수)를 센다.

    merge=True: 사람이 PR이 열린 그날 머지한다 (평소). False: 창이 끝날 때까지 열어 둔다.
    성공 실행은 PR을 '만들거나 갱신'한다 — 같은 브랜치라 그달 PR은 하나뿐이다.
    """
    rng = random.Random(seed)
    prs: list = []
    ok = {m: 0 for m in range(1, 13)}
    tries = {m: 0 for m in range(1, 13)}
    outside_window_runs = 0
    for fire in _fires(utc(2026, 12, 1), utc(2028, 1, 31)):
        if drop(fire):
            continue
        t = fire + timedelta(minutes=rng.randint(0, 6 * 60))       # 최대 6시간 지연
        if gate == "new":
            run, _ = g.decide(t, "schedule", prs)
        else:  # 예전 게이트: ICT 1일만
            run = t.astimezone(g.ICT).day == 1
        if not run:
            continue
        ict = t.astimezone(g.ICT)
        if ict.day not in g.WINDOW_DAYS:
            outside_window_runs += 1
        if ict.year != 2027:
            continue
        tries[ict.month] += 1
        if fail(t, tries[ict.month]):
            continue                      # ETL 실패 → PR 없음 → 다음 회차가 재시도해야 한다
        ok[ict.month] += 1
        if not any(isinstance(x, tuple) and (x[0].astimezone(g.ICT).year, x[0].astimezone(g.ICT).month)
                   == (ict.year, ict.month) for x in prs):
            prs.append((t, "MERGED" if merge else "OPEN"))     # 그달 첫 성공만 PR을 만든다
    return ok, tries, outside_window_runs


def _is_last_day_fire(t: datetime) -> bool:
    return (t + timedelta(days=1)).day == 1


def test_year_exactly_one_run_per_month():
    ok, _, outside = _simulate()
    assert ok == {m: 1 for m in range(1, 13)}
    assert outside == 0


def test_year_survives_every_last_day_fire_being_dropped():
    """매달 말일 발동이 **전부** 빠져도 12번 다 돈다 — 1일 발동(ICT 2일)이 받는다."""
    ok, _, _ = _simulate(drop=_is_last_day_fire)
    assert ok == {m: 1 for m in range(1, 13)}


def test_old_gate_loses_the_month_when_the_one_fire_is_dropped():
    """대조군: 예전 게이트는 같은 상황에서 **1년 내내 한 번도** 안 돈다.
    이 테스트가 통과한다는 것이 곧 새 게이트가 필요한 이유다."""
    ok, _, _ = _simulate(drop=_is_last_day_fire, gate="old")
    assert sum(ok.values()) == 0


def test_failed_first_attempt_is_retried_next_day():
    ok, tries, _ = _simulate(fail=lambda t, n: n == 1)     # 매달 첫 시도 실패
    assert ok == {m: 1 for m in range(1, 13)}
    assert all(tries[m] == 2 for m in range(1, 13))


def test_gives_up_after_the_window():
    """세 번 다 실패하면 그 달은 그걸로 끝이다 — 창 밖에서 계속 두드리지 않는다.
    (그 경우 Actions에 빨간불이 세 번 남는다. 파서 드리프트면 카나리도 따로 알린다.)"""
    ok, tries, outside = _simulate(fail=lambda t, n: True)
    assert sum(ok.values()) == 0
    assert all(tries[m] == 3 for m in range(1, 13))
    assert outside == 0


def test_cron_in_workflow_matches_simulation():
    """시뮬레이션이 가정한 cron과 실제 워크플로의 cron이 같아야 이 테스트들이 의미가 있다."""
    wf = (Path(__file__).resolve().parents[1] / ".github/workflows/refresh-data.yml").read_text(encoding="utf-8")
    assert 'cron: "0 22 1,2,28-31 * *"' in wf
    assert f'branch: {g.BRANCH}' in wf
    assert "refresh_gate.py" in wf


def test_year_open_pr_is_refreshed_daily_but_stays_one_pr():
    """사람이 머지하지 않고 두면 창 안에서 매일 다시 돌아 같은 PR을 갱신한다 — PR은 하나다."""
    ok, tries, outside = _simulate(merge=False)
    assert all(ok[m] == 3 for m in range(1, 13))      # 1·2·3일 모두 실행(갱신)
    assert outside == 0                                # 창 밖에서는 절대 안 돈다
