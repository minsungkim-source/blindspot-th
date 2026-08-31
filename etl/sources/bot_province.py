"""
BOT — Commercial Banks' Deposits and Loans Classified by Provinces
표 ID: FI_CB_011_S4  (reportID=781)

이 표가 프로젝트의 척추다. 77개 주 각각에 대해:
  - No. of Branches           ← 주별 지점 수. 다른 어떤 BOT 공표물에도 없다.
  - Deposits (5개 세부 + 계)
  - Credits  (4개 세부 + 계)
  - Credit of Deposits (%)    ← 예대율

────────────────────────────────────────────────────────────────────────────
BOT API 포털 등록을 미뤘으므로 이 스크래퍼가 v1의 유일한 경로다.
ASP.NET 렌더 페이지는 예고 없이 구조가 바뀌고, 그때 파서는 예외를 던지지 않고
'그럴듯한 쓰레기'를 만들어낸다 — 열이 하나 밀리면 예금 자리에 예대율이 들어앉는다.

그래서 세 겹으로 막는다.
  1. 스키마 지문(fingerprint) — 헤더 텍스트·열 수·행 수가 기대와 다르면 파싱 자체를 거부
  2. 원본 스냅샷 — 매 실행마다 응답 HTML을 data/raw/에 남겨 사후 분석 가능
  3. 값의 상식 범위 — validate.py의 게이트

원칙: **틀린 숫자를 만드는 것보다 멈추는 것이 낫다.**
────────────────────────────────────────────────────────────────────────────

2026-08-26 실측 보정 (Sprint 1)
  · 표는 `<table id="dgExcel" class="Grid">` 하나. 86행 × 15열.
  · 0행 = 기준시점("JUN 2025 p"), 1행 = 컬럼 헤더, 2..85행 = 데이터, 각 15셀.
  · **0번 셀은 일련번호다.** 주 이름은 1번 셀. 스캐폴드의 COLUMNS는 한 칸 밀려 있었다.
  · 데이터 84행 = 주 77 + 권역 소계 4 + Bangkok 내역 2(Head office/Branches) + Grand Total 1.
  · 권역 소계 행이 뒤따르는 주들의 권역을 정의한다 → NSO 5권역 구분을 표에서 그대로 얻는다.
    (Bangkok 1 / Central 25 / Northeast 20 / North 17 / South 14 = 77)
    크로스워크의 `region`은 6권역(Central·East·West 분리)이라 NSO와 맞지 않는다.
  · 금액 단위는 **백만 바트**. 이 모듈이 바트로 환산해 내보낸다.
  · 과거 시점은 GET 파라미터가 아니라 __VIEWSTATE 포함 POST 폼 전송이다.
"""

from __future__ import annotations

import hashlib
import re
import time
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

BASE = "https://app.bot.or.th/BTWS_STAT/statistics/ReportPage.aspx"
QUERY = {"reportID": "781", "language": "eng"}
HEADERS = {
    "User-Agent": "blindspot-th/0.1 (+https://github.com/minsungkim-source/blindspot-th)",
    "Accept-Language": "en",
}

GRID_ID = "dgExcel"
MB = 1_000_000.0          # 표의 금액 단위: 백만 바트 → 바트

RETRIES = 3
BACKOFF_S = (2, 8, 20)

# 권역 소계 행. 이 행 자체는 버리되, 뒤따르는 주들의 권역을 정의한다.
REGION_HEADERS = {
    "central region": "Central",
    "northeastern region": "Northeast",
    "northern region": "North",
    "southern region": "South",
}
# 표 첫 데이터 행(Bangkok)은 권역 헤더 없이 등장한다. NSO 5권역에서 방콕은 독립 권역.
FIRST_REGION = "Bangkok"

# 주가 아닌 행. Head office / Branches는 Bangkok(1,328 = 28 + 1,300)의 내역이다.
NON_PROVINCE_ROWS = {
    "head office", "branches", "total", "grand total", "whole kingdom",
    "bangkok metropolis and vicinity", "vicinity",
}

COLUMNS = [
    "row_no", "province_raw", "branches",
    "dep_demand", "dep_saving", "dep_time", "dep_pn", "dep_ncd", "deposits_total",
    "cr_overdraft", "cr_loan", "cr_bills", "cr_others", "credits_total",
    "credit_deposit_pct",
]
MONEY_COLUMNS = [
    "dep_demand", "dep_saving", "dep_time", "dep_pn", "dep_ncd", "deposits_total",
    "cr_overdraft", "cr_loan", "cr_bills", "cr_others", "credits_total",
]

# ── 스키마 지문 ──────────────────────────────────────────────────────────
# 2026-08-26 실제 응답으로 보정. BOT이 표를 바꾸면 여기가 먼저 터진다.
# 카나리가 터졌을 때는 data/raw/의 스냅샷을 보고 **의도적으로** 갱신한다.
# 검사를 느슨하게 만들어 통과시키지 마라.
EXPECT_HEADER_TOKENS = [
    "no. of branches", "demand deposit", "saving deposit", "time deposit",
    "promissory note", "ncd", "total deposits",
    "overdraft", "loan", "bills", "others", "total credits",
    "credit of deposits",
]
EXPECT_COLUMNS = 15               # 일련번호 + 주명 + 13개 수치
EXPECT_PROVINCE_ROWS = 77         # 정확히 77개. 태국의 주 수는 고정이다.
EXPECT_TABLE_ROWS = (80, 92)      # 데이터 행 총계 (주 + 소계 + 내역 + 합계)

MONTH_ABBR = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


class ParserDriftError(RuntimeError):
    """BOT 페이지 구조가 기대와 달라졌다. 파싱을 진행하지 않는다."""


def _to_num(cell: str) -> float | None:
    """'1,234.5' → 1234.5 · '-' / '' / 'n.a.' → None"""
    s = (cell or "").strip().replace(",", "").replace("\xa0", " ").strip()
    if s in {"", "-", "–", "n.a.", "N.A.", "..", "*"}:
        return None
    try:
        return float(s)
    except ValueError:
        return None


# ── 수집 ─────────────────────────────────────────────────────────────────

def _request(session: requests.Session, method: str, **kw) -> requests.Response:
    """재시도는 네트워크·5xx에만. 4xx는 즉시 실패시킨다 —
    파라미터가 틀린 것을 계속 두드려봐야 소용없다."""
    last: Exception | None = None
    for attempt in range(RETRIES):
        try:
            r = session.request(method, BASE, params=QUERY, headers=HEADERS, **kw)
            if 400 <= r.status_code < 500:
                r.raise_for_status()
            if r.status_code >= 500:
                raise requests.HTTPError(f"{r.status_code} from BOT", response=r)
            r.encoding = r.apparent_encoding or "utf-8"
            return r
        except requests.HTTPError as e:
            if e.response is not None and 400 <= e.response.status_code < 500:
                raise
            last = e
        except requests.RequestException as e:
            last = e
        if attempt < RETRIES - 1:
            time.sleep(BACKOFF_S[attempt])
    raise RuntimeError(f"BOT 응답을 {RETRIES}회 시도 후에도 받지 못했다: {last}")


def fetch_html(
    session: requests.Session | None = None,
    period: tuple[int, int] | None = None,
    timeout: int = 60,
) -> str:
    """period=(year, month). None이면 BOT이 주는 최신 시점.

    과거 시점은 GET 파라미터로 지정할 수 없다 — ASP.NET 폼 포스트백이다.
    드롭다운 값 형식: drpFromYear='2025xxxx', drpFromMonth='xxxx06xx'.
    __VIEWSTATE / __EVENTVALIDATION은 매 응답에서 다시 뽑아야 한다.
    """
    s = session or requests.Session()
    r = _request(s, "GET", timeout=timeout)
    if period is None:
        return r.text

    year, month = period
    soup = BeautifulSoup(r.text, "html.parser")

    def hidden(name: str) -> str:
        el = soup.find("input", {"name": name})
        if el is None:
            raise ParserDriftError(
                f"BOT 폼에서 숨은 필드 '{name}'을 찾지 못했다. "
                f"페이지가 ASP.NET 포스트백 구조를 벗어났을 수 있다."
            )
        return el.get("value") or ""

    form = {
        "__VIEWSTATE": hidden("__VIEWSTATE"),
        "__VIEWSTATEGENERATOR": hidden("__VIEWSTATEGENERATOR"),
        "__EVENTVALIDATION": hidden("__EVENTVALIDATION"),
        "__EVENTTARGET": "",
        "__EVENTARGUMENT": "",
        "drpPeriod": "MTH",
        "drpFromYear": f"{year}xxxx",
        "drpFromMonth": f"xxxx{month:02d}xx",
        "btnSubmit": "Submit",
    }
    return _request(s, "POST", data=form, timeout=timeout).text


def snapshot(html: str, raw_dir: Path, label: str = "bot_province") -> Path:
    """응답 원본을 남긴다. 파서가 깨진 뒤에 원인을 볼 수 있는 유일한 방법이다."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = raw_dir / f"{label}-{stamp}.html"
    path.write_text(html, encoding="utf-8")

    # 오래된 스냅샷 정리 — 최근 12개만 남긴다 (data/raw는 gitignore 되어 있다)
    for f in sorted(raw_dir.glob(f"{label}-*.html"))[:-12]:
        f.unlink(missing_ok=True)
    return path


# ── 검사 ─────────────────────────────────────────────────────────────────

def check_schema(header_text: str, records: list[list], n_provinces: int) -> dict:
    """구조가 기대와 다르면 ParserDriftError. 반환값은 meta.json에 기록할 지문."""
    missing = [t for t in EXPECT_HEADER_TOKENS if t not in header_text]
    if missing:
        raise ParserDriftError(
            f"표 헤더에서 기대 토큰을 찾지 못했다: {missing}. "
            f"BOT이 FI_CB_011_S4의 열 구성을 바꿨을 가능성이 높다. "
            f"data/raw/의 스냅샷을 열어 확인하고 COLUMNS / EXPECT_HEADER_TOKENS를 갱신할 것."
        )

    widths = sorted({len(r) for r in records})
    if widths != [EXPECT_COLUMNS]:
        raise ParserDriftError(
            f"데이터 행의 열 수가 {widths}다. 모든 행이 정확히 {EXPECT_COLUMNS}개여야 한다. "
            f"열이 밀렸거나 병합 셀이 생겼다."
        )

    lo, hi = EXPECT_TABLE_ROWS
    if not (lo <= len(records) <= hi):
        raise ParserDriftError(
            f"데이터 행이 {len(records)}개다. {lo}–{hi}개를 기대한다. "
            f"필터가 과하게 걸렸거나 표가 바뀌었다."
        )

    if n_provinces != EXPECT_PROVINCE_ROWS:
        raise ParserDriftError(
            f"주 행이 {n_provinces}개다. 정확히 {EXPECT_PROVINCE_ROWS}개여야 한다. "
            f"권역 소계·합계 행 필터(NON_PROVINCE_ROWS / REGION_HEADERS)를 확인할 것."
        )

    return {
        "header_hash": hashlib.sha256(header_text.encode()).hexdigest()[:16],
        "data_rows": len(records),
        "province_rows": n_provinces,
        "column_widths": widths,
    }


# ── 파싱 ─────────────────────────────────────────────────────────────────

def parse_as_of(cells: list[str]) -> tuple[str | None, str | None]:
    """0행의 'JUN 2025 p' → ('JUN 2025 p', '2025-06').

    끝의 한 글자는 개정 상태 표시다 — `p` 잠정, `r` 수정, 표시가 없으면 확정.
    (2024-08은 `AUG 2024 r`이라 `p`만 허용하던 초기 정규식이 이 달을 통째로 놓쳤다.)
    라벨은 표시까지 그대로 보존하고, ISO 시점만 따로 만든다.
    """
    for c in cells:
        m = re.match(r"^([A-Za-z]{3})[A-Za-z.]*\s+(\d{4})\s*([A-Za-z])?$", c.strip())
        if m:
            mon = MONTH_ABBR.get(m.group(1).lower())
            if mon:
                return c.strip(), f"{int(m.group(2)):04d}-{mon:02d}"
    return None, None


def parse(html: str) -> tuple[pd.DataFrame, str | None, str | None, dict]:
    """(주별 DataFrame, as_of 라벨, as_of ISO(YYYY-MM), 스키마 지문) 반환."""
    soup = BeautifulSoup(html, "html.parser")

    table = soup.find("table", id=GRID_ID)
    if table is None:
        # id가 바뀐 경우를 대비해 가장 큰 표로 폴백하되, 지문 검사가 뒤에서 잡는다.
        tables = soup.find_all("table")
        if not tables:
            raise ParserDriftError(
                "BOT 페이지에서 table을 찾지 못했다. 렌더링 방식이 바뀌었거나 차단되었을 수 있다."
            )
        table = max(tables, key=lambda t: len(t.find_all("td")))

    rows = [
        [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
        for tr in table.find_all("tr")
    ]
    if len(rows) < 3:
        raise ParserDriftError(f"표에 행이 {len(rows)}개뿐이다. 헤더 2행 + 데이터가 있어야 한다.")

    as_of_label, as_of_iso = parse_as_of(rows[0])
    header_text = " ".join(rows[1]).lower()

    records: list[list[str]] = []
    provinces: list[tuple[str, list[str]]] = []
    region = FIRST_REGION

    for cells in rows[2:]:
        if len(cells) < 3:
            continue
        label = cells[1].strip()
        if not label:
            continue
        records.append(cells)

        key = label.lower()
        if key in REGION_HEADERS:
            region = REGION_HEADERS[key]
            continue
        if key in NON_PROVINCE_ROWS:
            continue
        provinces.append((region, cells))

    fingerprint = check_schema(header_text, records, len(provinces))

    data = []
    for region_name, cells in provinces:
        row: dict = {"region_nso": region_name}
        for i, col in enumerate(COLUMNS):
            if col == "province_raw":
                row[col] = cells[i].strip()
            elif col == "row_no":
                continue
            else:
                row[col] = _to_num(cells[i])
        data.append(row)

    df = pd.DataFrame(data)
    df["branches"] = df["branches"].astype("Int64")

    # 열 밀림의 대표 증상: 지점 수가 예금 규모만큼 커진다.
    # 전국 상업은행 지점은 약 4,800개이고 최대 주(방콕)가 1,400개 수준이다.
    if df["branches"].notna().any() and int(df["branches"].max()) > 3000:
        raise ParserDriftError(
            f"주별 지점 수 최대값이 {int(df['branches'].max())}이다. "
            f"방콕도 1,400개 수준이므로 열이 밀렸거나 합계 행이 섞였을 가능성이 높다."
        )

    # 표 단위는 백만 바트. 여기서 한 번만 바트로 환산한다.
    for col in MONEY_COLUMNS:
        df[col] = df[col] * MB

    # BOT이 공표한 예대율(%)과 우리가 계산한 비율이 어긋나면 열이 밀린 것이다.
    calc = df["credits_total"] / df["deposits_total"] * 100.0
    drift = (calc - df["credit_deposit_pct"]).abs()
    bad = drift[drift > 1.0].dropna()
    if len(bad):
        raise ParserDriftError(
            f"공표 예대율과 credits/deposits 계산값이 {len(bad)}개 주에서 1%p 넘게 어긋난다. "
            f"열 정렬이 깨졌다. 최대 편차 {bad.max():.1f}%p."
        )

    df["credit_deposit"] = df["credit_deposit_pct"] / 100.0
    df["period"] = as_of_iso

    return df, as_of_label, as_of_iso, fingerprint


def normalize_name(name: str) -> str:
    """조인 전 정규화. BOT 표기는 표준 로마자와 자주 다르다.

    예: 'Chiengmai' vs 'Chiang Mai', 'Phrea' vs 'Phrae', 'Satul' vs 'Satun'
    공백·하이픈·대소문자를 죽이고 crosswalk의 name_alternates_en과 맞춘다.
    남는 불일치는 data/reference/bot_name_aliases.csv에서 해소한다 —
    이름을 하드코딩으로 치환하지 않는다.
    """
    s = name.lower().strip()
    s = re.sub(r"\(.*?\)", "", s)
    return re.sub(r"[^a-z]", "", s)


# ── 시계열 ───────────────────────────────────────────────────────────────

def _month_sequence(latest_iso: str, months_back: int) -> list[tuple[int, int]]:
    """최신 시점에서 과거로 months_back개월. 최신 시점 자신은 제외한다."""
    year, month = (int(x) for x in latest_iso.split("-"))
    out = []
    for _ in range(months_back - 1):
        month -= 1
        if month == 0:
            year, month = year - 1, 12
        out.append((year, month))
    return out


def fetch_timeseries(
    session: requests.Session,
    current: pd.DataFrame,
    latest_iso: str | None,
    months_back: int,
    raw_dir: Path | None = None,
) -> pd.DataFrame:
    """최근 months_back개월의 주별 지점수·예금·여신.

    한 시점당 요청 1회 + 파싱 1회. 12개월이면 12회 왕복이라 월 1회 ETL에서만 돈다.
    과거 시점의 파싱 실패는 **전체를 죽이지 않는다** — 최신 시점은 이미 확보했고
    스파크라인이 짧아질 뿐이다. 다만 무엇이 빠졌는지는 로그로 남긴다.
    """
    keep = ["period", "province_raw", "branches", "deposits_total", "credits_total"]
    frames = [current[keep]]
    if not latest_iso or months_back <= 1:
        return pd.concat(frames, ignore_index=True)

    for year, month in _month_sequence(latest_iso, months_back):
        try:
            html = fetch_html(session, period=(year, month))
            past, _, iso, _ = parse(html)
        except (ParserDriftError, RuntimeError, requests.RequestException) as e:
            print(f"         WARN  시계열 {year}-{month:02d} 건너뜀: {e}")
            continue
        if iso != f"{year}-{month:02d}":
            print(f"         WARN  시계열 {year}-{month:02d} 요청에 {iso}가 돌아왔다 — 버린다.")
            continue
        if raw_dir:
            snapshot(html, raw_dir, label=f"bot_province-{iso}")
        frames.append(past[keep])
        time.sleep(1.0)          # BOT 서버에 대한 예의

    return pd.concat(frames, ignore_index=True).sort_values(["province_raw", "period"])


# ── 진입점 ───────────────────────────────────────────────────────────────

def load(config: dict) -> dict:
    """빌드 파이프라인 진입점.

    반환: {'current', 'timeseries', 'as_of', 'source_url', 'grade', 'fingerprint'}
    """
    scfg = (config.get("sources") or {}).get("bot_province", {})
    months_back = int(scfg.get("months_back", 1))

    session = requests.Session()
    html = fetch_html(session)

    raw_dir = config.get("_raw_dir")
    snap = snapshot(html, Path(raw_dir)) if raw_dir else None

    df, as_of_label, as_of_iso, fingerprint = parse(html)
    df["join_key"] = df["province_raw"].map(normalize_name)

    timeseries = fetch_timeseries(
        session, df, as_of_iso, months_back,
        Path(raw_dir) if raw_dir and scfg.get("snapshot_raw") else None,
    )

    return {
        "current": df,
        "timeseries": timeseries,
        "as_of": as_of_iso,
        "as_of_label": as_of_label,
        "source_url": f"{BASE}?reportID=781&language=eng",
        "grade": "A",
        "fingerprint": fingerprint,
        "snapshot": str(snap) if snap else None,
        "unit": "baht",
    }


def canary() -> dict:
    """구조만 점검한다. 산출물을 쓰지 않으므로 주 1회 싸게 돌릴 수 있다.

    .github/workflows/parser-canary.yml 에서 호출한다.
    월간 ETL 사이에 BOT이 표를 바꾸면 최대 한 달을 모르는 문제를 막는다.
    """
    df, label, iso, fingerprint = parse(fetch_html())
    return {
        "ok": True,
        "as_of": iso,
        "as_of_label": label,
        "checked_at": date.today().isoformat(),
        "rows": len(df),
        **fingerprint,
    }


if __name__ == "__main__":
    import json
    import sys

    if "--canary" in sys.argv:
        print(json.dumps(canary(), ensure_ascii=False, indent=2))
    else:
        out = load({"sources": {"bot_province": {"months_back": 1}}})
        d = out["current"]
        print(f"as_of={out['as_of']}  rows={len(d)}  fingerprint={out['fingerprint']}")
        print(d[["province_raw", "region_nso", "branches", "deposits_total",
                 "credits_total", "credit_deposit"]].head(12).to_string())
