#!/usr/bin/env python3
"""월간 갱신 PR의 검토 요약 — 지난달 산출물과 비교해 사람이 볼 것만 추린다.

    python .github/scripts/refresh_summary.py [출력파일]

예전 PR 본문은 고정된 체크리스트였다. "`meta.json`의 `header_hash`가 지난달과 같은가"
같은 항목을 사람이 diff를 뒤져 확인해야 했다. 기계가 비교할 수 있는 건 기계가 비교하고,
사람은 판정만 보게 한다.

판정은 세 단계다.
  🛑 보류   — 머지하지 말고 원인을 본다. 틀린 숫자가 나갈 수 있는 신호다
  ⚠️ 알아둘 것 — 머지는 해도 된다. 다만 사람이 알고 있어야 하는 사실이다
  ✅ / ℹ️   — 정상

**기준시점이 오래된 것은 ⚠️이지 🛑가 아니다.** BOT이 새 달을 안 냈다고 이번 달 PR을 막으면
ATM·미리보기 같은 나머지 갱신까지 막힌다. 사실을 알리고, 결정은 사람에게 맡긴다.

표준 라이브러리만 쓴다.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# src/lib/dataAge.ts의 STALE_MONTHS와 같아야 한다 (tests/test_refresh_summary.py가 대조한다).
# 사이트 머리말 칩과 이 요약이 같은 기준으로 "오래됐다"고 말해야 한다.
STALE_MONTHS = 6

# 공표 주기가 1년이라 캐시본과 라이브본이 같은 파일인 소스. 여기만 캐시가 정상이다 (CLAUDE.md).
ANNUAL_SOURCES = {"nesdc_gpp"}

BLOCK, WARN, OK, INFO = "🛑", "⚠️", "✅", "ℹ️"


@dataclass
class Check:
    level: str
    title: str
    detail: str = ""


# ── 읽기 ──────────────────────────────────────────────────────────────

def _git_show(path: str) -> str | None:
    try:
        return subprocess.run(["git", "show", f"HEAD:{path}"], cwd=ROOT, check=True,
                              capture_output=True, text=True).stdout
    except subprocess.CalledProcessError:
        return None


def _load_pair(path: str):
    prev_raw = _git_show(path)
    new_file = ROOT / path
    prev = json.loads(prev_raw) if prev_raw else None
    new = json.loads(new_file.read_text(encoding="utf-8")) if new_file.exists() else None
    return prev, new


def _file_changed(path: str) -> bool:
    return subprocess.run(["git", "diff", "--quiet", "HEAD", "--", path], cwd=ROOT).returncode != 0


# ── 판정 ──────────────────────────────────────────────────────────────

def months_since(as_of: str | None, today: date) -> int | None:
    """'YYYY-MM…' → 몇 달 전. dataAge.ts의 monthsSince와 같은 규칙."""
    if not as_of or len(as_of) < 7 or as_of[4] != "-":
        return None
    try:
        y, m = int(as_of[:4]), int(as_of[5:7])
    except ValueError:
        return None
    if not 1 <= m <= 12:
        return None
    return max(0, (today.year - y) * 12 + (today.month - m))


def _bot(meta: dict | None) -> dict:
    return ((meta or {}).get("sources") or {}).get("bot_province") or {}


def check_as_of(prev: dict | None, new: dict, today: date) -> list[Check]:
    p, n = _bot(prev), _bot(new)
    pa, na = p.get("as_of"), n.get("as_of")
    pl, nl = p.get("as_of_label") or pa, n.get("as_of_label") or na
    out: list[Check] = []

    if pa and na and na < pa:
        out.append(Check(BLOCK, f"BOT 기준시점이 **뒤로 갔다** ({pl} → {nl})",
                         "파서가 다른 표를 읽었거나 BOT 페이지가 바뀌었을 수 있다. 머지하지 말 것."))
    elif pa and na and na > pa:
        out.append(Check(OK, f"BOT 기준시점 전진 ({pl} → {nl})"))
    elif pa == na and pl != nl:
        out.append(Check(INFO, f"BOT 기준시점 그대로, 개정 표시만 바뀜 ({pl} → {nl})",
                         "잠정치(p)가 수정·확정(r)된 것이다. 지점·예금·여신 값이 조금 바뀌었을 수 있다."))
    elif pa == na:
        out.append(Check(INFO, f"BOT 기준시점 그대로 ({nl})",
                         "BOT이 새 달을 공표하지 않았다. 지점·예금·여신 값은 지난달과 같다."))

    age = months_since(na, today)
    if age is not None and age >= STALE_MONTHS:
        out.append(Check(WARN, f"공급 데이터가 **{age}개월 전** 것이다",
                         f"지점·예금·여신 — 공급 축 전체가 {nl} 기준이다. 반년({STALE_MONTHS}개월)을 넘기면 "
                         "`docs/BACKLOG.md`의 'BOT API 포털 등록 보류' 재검토 조건에 해당한다. "
                         "**이것만으로는 머지를 막지 않는다** — 머지하지 않아도 사이트의 BOT 값은 똑같다."))
    return out


def check_degraded(prev: dict | None, new: dict) -> list[Check]:
    pd_ = (prev or {}).get("degraded_sources") or {}
    nd = new.get("degraded_sources") or {}
    out: list[Check] = []
    for name in sorted(set(nd) - set(pd_)):
        out.append(Check(BLOCK, f"이번에 새로 확보하지 못한 소스: `{name}`",
                         f"해당 지표가 결측이 되어 **모든 주의 점수가 재정규화로 이동한다.** 사유: `{nd[name][:160]}`"))
    for name in sorted(set(pd_) - set(nd)):
        out.append(Check(OK, f"지난달 빠졌던 `{name}`을 이번엔 확보했다",
                         "지표가 되살아나 점수가 움직였을 수 있다 — 아래 순위 변화를 같이 볼 것."))
    kept = sorted(set(pd_) & set(nd))
    if kept and not out:
        out.append(Check(INFO, f"확보 실패 소스 변화 없음 ({', '.join(f'`{k}`' for k in kept)})",
                         "지난달과 같은 상태다. `nso_ict`는 문서화된 영구 차단이다."))
    elif not pd_ and not nd:
        out.append(Check(OK, "모든 소스를 확보했다"))
    return out


def check_flags(new: dict) -> list[Check]:
    out: list[Check] = []
    for name, s in sorted((new.get("sources") or {}).items()):
        if s.get("from_snapshot"):
            out.append(Check(BLOCK, f"`{name}`이 저장된 응답(스냅숏)으로 빌드됐다",
                             "`--use-snapshot`은 개발용이다. CI에서 나오면 안 된다."))
        if s.get("from_cache"):
            if name in ANNUAL_SOURCES:
                out.append(Check(INFO, f"`{name}`은 저장본을 썼다 (라이브 서버 장애)",
                                 "연간 공표물이라 저장본과 라이브본이 같은 파일이다. 이것만으로는 머지를 막지 않는다."))
            else:
                out.append(Check(BLOCK, f"`{name}`이 저장본으로 빌드됐다",
                                 "캐시 폴백은 연간 소스에만 허용된다 (CLAUDE.md). 월간 소스면 지난달 숫자다."))
    if not out:
        out.append(Check(OK, "모든 소스를 이번에 새로 받았다 (저장본·스냅숏 없음)"))
    return out


def check_fingerprint(prev: dict | None, new: dict) -> list[Check]:
    ph = (_bot(prev).get("fingerprint") or {}).get("header_hash")
    nh = (_bot(new).get("fingerprint") or {}).get("header_hash")
    if ph and nh and ph != nh:
        return [Check(BLOCK, "BOT 표 머리의 지문이 바뀌었다",
                      f"`{ph}` → `{nh}`. 파서의 지문 검사를 통과했더라도 BOT이 표를 건드린 것이다. "
                      "열이 밀렸는지 `data/raw/`의 스냅숏과 대조할 것.")]
    if nh:
        return [Check(OK, f"BOT 표 구조 그대로 (지문 `{nh}`)")]
    return []


def _ranks(figi: list[dict]) -> dict[str, tuple[int, float]]:
    rows = sorted(figi, key=lambda r: -(r.get("priority") or 0))
    out, rank, last = {}, 0, None
    for i, r in enumerate(rows, 1):
        p = r.get("priority") or 0
        if p != last:
            rank, last = i, p
        out[r["tis1099_code"]] = (rank, p)
    return out


def check_ranking(prev_figi: list | None, new_figi: list, bot_unchanged: bool) -> list[Check]:
    names = {r["tis1099_code"]: r.get("name_en_canonical", r["tis1099_code"]) for r in new_figi}
    n_targets = sum(1 for r in new_figi if (r.get("priority") or 0) > 0)
    head = Check(INFO, f"주 {len(new_figi)}개 · 확장 대상 {n_targets}개 · 대상 아님 {len(new_figi) - n_targets}개")
    if not prev_figi:
        return [head]

    pr, nr = _ranks(prev_figi), _ranks(new_figi)
    top = lambda r: {c for c, (k, p) in r.items() if k <= 10 and p > 0}   # noqa: E731
    entered = top(nr) - top(pr)
    left = top(pr) - top(nr)

    # 대상 아님(0)끼리의 순위는 의미가 없다 — 어느 달이든 대상이었던 주만 본다
    moves = []
    for c in nr:
        if c not in pr:
            continue
        (a, ap), (b, bp) = pr[c], nr[c]
        if ap > 0 or bp > 0:
            moves.append((abs(a - b), c, a, b))
    moves.sort(reverse=True)
    prev_targets = sum(1 for r in prev_figi if (r.get("priority") or 0) > 0)
    head.title += f" (지난달 대상 {prev_targets}개)"

    out = [head]
    max_move = moves[0][0] if moves else 0
    if not entered and not left and max_move == 0:
        out.append(Check(OK, "우선순위 순위 변화 없음"))
        return out

    if entered or left:
        detail = []
        if entered:
            detail.append("들어옴: " + ", ".join(names[c] for c in sorted(entered, key=lambda c: nr[c][0])))
        if left:
            detail.append("빠짐: " + ", ".join(names.get(c, c) for c in sorted(left, key=lambda c: pr[c][0])))
        churn = len(entered)
        level = WARN if (bot_unchanged and churn >= 3) else INFO
        title = f"우선순위 상위 10 중 {churn}개 교체"
        if level == WARN:
            title += " — BOT이 그대로인데도"
            detail.append("BOT 값이 안 바뀌었으면 움직일 수 있는 건 OSM ATM뿐이다. ATM 개수 변화를 확인할 것.")
        out.append(Check(level, title, " / ".join(detail)))
    else:
        out.append(Check(OK, "우선순위 상위 10 그대로"))

    big = [m for m in moves if m[0] > 0][:5]
    if big:
        out.append(Check(INFO, f"순위가 가장 많이 움직인 주 (최대 {big[0][0]}계단)",
                         ", ".join(f"{names[c]} {a}→{b}" for _, c, a, b in big)))
    return out


def check_atm(prev_figi: list | None, new_figi: list) -> list[Check]:
    tot = lambda f: sum((r.get("atm_count") or 0) for r in f)   # noqa: E731
    if not prev_figi:
        return []
    a, b = tot(prev_figi), tot(new_figi)
    if a == b:
        return [Check(INFO, f"OSM ATM {b:,}개 (변화 없음)")]
    pct = (b - a) / a * 100 if a else 0
    level = WARN if abs(pct) >= 10 else INFO
    return [Check(level, f"OSM ATM {a:,} → {b:,}개 ({b - a:+,}, {pct:+.1f}%)",
                  "한 달에 10% 넘게 변하면 자원봉사 편집보다 수집 문제일 가능성이 크다." if level == WARN else
                  "자원봉사자 편집으로 매달 조금씩 변한다.")]


# ── 조립 ──────────────────────────────────────────────────────────────

def summarize(prev_meta, new_meta, prev_figi, new_figi, today: date, og_changed: bool = False) -> str:
    bot_unchanged = _bot(prev_meta).get("as_of") == _bot(new_meta).get("as_of")
    sections = [
        ("데이터 기준시점", check_as_of(prev_meta, new_meta, today)),
        ("소스 확보", check_degraded(prev_meta, new_meta) + check_flags(new_meta)),
        ("BOT 표 구조", check_fingerprint(prev_meta, new_meta)),
        ("우선순위 변화", check_ranking(prev_figi, new_figi, bot_unchanged) + check_atm(prev_figi, new_figi)),
    ]
    all_checks = [c for _, cs in sections for c in cs]
    blocks = [c for c in all_checks if c.level == BLOCK]
    warns = [c for c in all_checks if c.level == WARN]

    lines = ["ETL 자동 실행 결과다. 아래는 **지난달 산출물과 기계로 비교한** 요약이다.", ""]
    if blocks:
        lines += [f"## {BLOCK} 머지 보류 — {len(blocks)}개 항목 확인 필요", "",
                  "틀린 숫자가 나갈 수 있는 신호다. 원인을 보기 전에는 머지하지 말 것. "
                  "사이트는 머지하지 않는 동안 직전 데이터로 멀쩡하다.", ""]
    else:
        lines += [f"## {OK} 머지해도 된다", ""]
        if warns:
            lines += [f"{WARN} 표시는 머지를 막지 않는다 — 알고 있어야 할 사실이다.", ""]

    for name, cs in sections:
        if not cs:
            continue
        lines.append(f"### {name}")
        for c in cs:
            lines.append(f"- {c.level} {c.title}")
            if c.detail:
                lines.append(f"  <br><sub>{c.detail}</sub>")
        lines.append("")

    lines += ["### 사람이 볼 것", ""]
    if og_changed:
        lines.append("- [ ] `public/og.png` 미리보기 — Files changed에서 이미지가 지도처럼 보이는가, "
                     "한글이 □로 깨지지 않았는가")
    lines += ["- [ ] 위 판정에 동의하는가 — 데이터 갱신은 자동 머지하지 않는다 (CLAUDE.md)", "",
              f"<sub>생성 {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC · "
              "`.github/scripts/refresh_summary.py`</sub>"]
    return "\n".join(lines) + "\n"


def main() -> int:
    prev_meta, new_meta = _load_pair("data/processed/meta.json")
    prev_figi, new_figi = _load_pair("data/processed/figi.json")
    if new_meta is None or new_figi is None:
        print("::error::새 산출물이 없다 — ETL이 끝나지 않았다.", file=sys.stderr)
        return 1
    body = summarize(prev_meta, new_meta, prev_figi, new_figi,
                     datetime.now(timezone.utc).date(), og_changed=_file_changed("public/og.png"))
    out = sys.argv[1] if len(sys.argv) > 1 else None
    if out:
        Path(out).write_text(body, encoding="utf-8")
    else:
        sys.stdout.write(body)
    # Actions 실행 화면에도 남긴다 — PR이 안 열려도(게이트·검증 실패) 요약은 볼 수 있게
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(body)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
