#!/usr/bin/env python3
"""월간 갱신을 이번 회차에 돌릴지 정한다 — refresh-data.yml의 첫 단계.

## 왜 cron만으로 안 되는가

cron은 "매월 1일"을 표현하지 못한다 (말일이 28~31일로 달라서). 그래서 28~31일에
매일 깨어나 "지금이 태국 날짜로 1일인가"를 보고 아니면 건너뛰는 게이트를 둔다.

예전 게이트는 **ICT 1일 하루만** 허용했다. 1일에 닿는 발동은 말일 22:00 UTC 한 번뿐이라
**한 달에 기회가 한 번**이었다. 그런데 GitHub 예약 실행은 부하가 몰리면 늦어지거나
**아예 빠진다** (공식 문서에 명시). 실제로 첫 예약 실행(2026-09-28 22:00 UTC 예정)이
3시간 20분 늦게 떴다. 그 한 번이 빠지면 그 달 갱신은 조용히 사라지고, 사이트는 직전
데이터로 멀쩡해 보여서 아무도 모른다.

## 지금 규칙

- 갱신 창을 **ICT 1~3일**로 넓힌다. cron에 1·2일을 더해 기회가 세 번이 된다
  (말일 22:00 UTC → ICT 1일 05:00, 1일 → 2일 05:00, 2일 → 3일 05:00)
- **이번 ICT 달에 만든 갱신 PR이 이미 있으면 건너뛴다.** 열려 있든, 머지됐든,
  사람이 닫았든 — 닫은 것도 사람의 결정이므로 다시 열지 않는다
- 첫 시도가 실패해 PR을 못 만들었으면 다음 날 자동으로 다시 시도한다

지연은 문제되지 않는다. 판단 기준이 **태국 날짜**라서, 1일 05:00 ICT 예정이 몇 시간
늦어져도 여전히 1일이다.

외부 의존성 없이 표준 라이브러리만 쓴다 — 이 단계는 setup-python보다 먼저 돈다.
"""

from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timedelta, timezone

ICT = timezone(timedelta(hours=7))
WINDOW_DAYS = (1, 2, 3)
BRANCH = "data/auto-refresh"   # refresh-data.yml의 create-pull-request branch와 같아야 한다


def in_window(now_utc: datetime) -> bool:
    return now_utc.astimezone(ICT).day in WINDOW_DAYS


def decide(now_utc: datetime, event: str, prior_prs: list[datetime]) -> tuple[bool, str]:
    """(돌릴지, 사유). 순수 함수 — 테스트가 이것만 부른다."""
    if event != "schedule":
        return True, f"수동 실행({event or '알 수 없음'}) — 게이트를 적용하지 않는다"

    now = now_utc.astimezone(ICT)
    if now.day not in WINDOW_DAYS:
        return False, f"ICT {now:%m-%d} — 갱신 창(매월 1~3일) 밖이라 건너뛴다"

    for created in prior_prs:
        c = created.astimezone(ICT)
        if (c.year, c.month) == (now.year, now.month):
            return False, (f"ICT {now:%m-%d} — 이번 달 갱신 PR이 이미 있다 "
                           f"({c:%m-%d %H:%M} ICT 생성). 건너뛴다")

    return True, f"ICT {now:%m-%d %H:%M} — 이번 달 첫 갱신이다"


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def fetch_prior_prs() -> list[datetime]:
    """이 브랜치로 만든 PR들의 생성 시각. 조회에 실패하면 빈 목록 — 실행하는 쪽으로 간다.

    실패 시 돌리는 이유: 한 달을 조용히 놓치는 것보다, 이미 있는 PR을 한 번 더 갱신하거나
    타임스탬프만 바뀐 PR이 하나 더 열리는 편이 낫다. 후자는 사람이 보고 닫으면 된다.
    """
    try:
        out = subprocess.run(
            ["gh", "pr", "list", "--head", BRANCH, "--state", "all",
             "--json", "createdAt", "--limit", "50"],
            check=True, capture_output=True, text=True, timeout=60,
        ).stdout
        return [_parse(x["createdAt"]) for x in json.loads(out)]
    except Exception as e:  # noqa: BLE001 — 조회 실패가 갱신을 막으면 안 된다
        print(f"::warning::이전 갱신 PR을 조회하지 못했다 ({type(e).__name__}: {e}) — 실행하는 쪽으로 간다.")
        return []


def main() -> int:
    event = os.environ.get("GITHUB_EVENT_NAME", "")
    now = datetime.now(timezone.utc)
    # 창 밖이면 조회할 필요가 없다 (28~31일의 대부분 회차)
    prior = fetch_prior_prs() if event == "schedule" and in_window(now) else []
    run, reason = decide(now, event, prior)
    print(reason)
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"run={'true' if run else 'false'}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
