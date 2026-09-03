"""BOT 파서 — 정상 표는 통과하고, 구조가 흔들리면 ParserDriftError로 멈추는가.

이 테스트의 목적은 '파싱이 된다'가 아니라 **'틀린 파싱이 조용히 통과하지 않는다'**이다.
BOT 페이지가 바뀌었을 때 파서가 예외 대신 그럴듯한 숫자를 만들어내는 것이
이 프로젝트에서 가장 위험한 실패 모드다.

픽스처: tests/fixtures/bot_province_2025-06.html
        (2026-08-26 수집한 실제 응답에서 dgExcel 표만 남기고 속성 제거)
"""

from __future__ import annotations

import re

import pytest
from bs4 import BeautifulSoup
from conftest import FIXTURES

from sources.bot_province import MB, ParserDriftError, normalize_name, parse

FIXTURE = FIXTURES / "bot_province_2025-06.html"


@pytest.fixture(scope="module")
def html() -> str:
    return FIXTURE.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def parsed(html):
    return parse(html)


# ── 정상 경로 ────────────────────────────────────────────────────────────

def test_returns_exactly_77_provinces(parsed):
    df, _, _, _ = parsed
    assert len(df) == 77


def test_as_of_is_parsed_from_first_row(parsed):
    _, label, iso, _ = parsed
    assert label == "JUN 2025 p"        # 잠정치 표시 p를 라벨에 보존한다
    assert iso == "2025-06"


def test_regions_come_from_subtotal_rows(parsed):
    """권역 소계 행이 뒤따르는 주들의 NSO 5권역을 정의한다."""
    df, _, _, _ = parsed
    assert df["region_nso"].value_counts().to_dict() == {
        "Central": 25, "Northeast": 20, "North": 17, "South": 14, "Bangkok": 1,
    }


def test_subtotal_and_breakdown_rows_are_excluded(parsed):
    """Head office / Branches / 권역 소계 / Grand Total은 주가 아니다."""
    df, _, _, _ = parsed
    names = {n.lower() for n in df["province_raw"]}
    assert "head office" not in names
    assert "branches" not in names
    assert "grand total" not in names
    assert not any(n.endswith(" region") for n in names)
    assert "bangkok" in names          # 방콕은 주다 (Head office+Branches의 합)


def test_bangkok_row_matches_published_values(parsed):
    """열이 밀리면 가장 먼저 틀어지는 행. 공표값과 정확히 맞아야 한다."""
    df, _, _, _ = parsed
    bkk = df[df["province_raw"] == "Bangkok"].iloc[0]
    assert int(bkk["branches"]) == 1328
    assert bkk["deposits_total"] == pytest.approx(10_856_707 * MB)
    assert bkk["credits_total"] == pytest.approx(13_674_586 * MB)
    assert bkk["credit_deposit"] == pytest.approx(1.2597)


def test_province_branch_total_matches_grand_total(parsed):
    """77개 주의 합이 표의 Grand Total(4,808)과 같아야 한다.

    같지 않으면 소계 행이 주로 섞여 들어왔거나 주가 빠진 것이다.
    """
    df, _, _, _ = parsed
    assert int(df["branches"].sum()) == 4808


def test_money_is_converted_to_baht(parsed):
    """표 단위는 백만 바트. 프런트엔드는 바트를 기대한다."""
    df, _, _, _ = parsed
    # 최소 주(Samut Songkhram 급)도 예금이 10억 바트를 넘는다 — 백만 단위로 남았으면 이 값이 1000배 작다
    assert df["deposits_total"].min() > 1e9


def test_fingerprint_shape(parsed):
    _, _, _, fp = parsed
    assert fp["province_rows"] == 77
    assert fp["column_widths"] == [15]
    assert len(fp["header_hash"]) == 16


# ── 드리프트 감지 ────────────────────────────────────────────────────────
#
# 실제 BOT 페이지가 바뀌는 방식을 흉내 낸다. 전부 ParserDriftError여야 한다 —
# 예외 없이 통과하면 그 순간 잘못된 숫자가 배포된다.

def _mutate(html: str, fn) -> str:
    soup = BeautifulSoup(html, "html.parser")
    fn(soup.find("table", id="dgExcel"))
    return str(soup)


def test_drift_extra_column_shifts_every_row(html):
    """열이 하나 추가되면 예금 자리에 여신이 들어앉는다. 가장 위험한 변화."""
    def add_column(table):
        for tr in table.find_all("tr"):
            cell = tr.find_all(["td", "th"])[0]
            dup = BeautifulSoup(f"<{cell.name}>0</{cell.name}>", "html.parser")
            cell.insert_before(dup)

    with pytest.raises(ParserDriftError, match="열 수"):
        parse(_mutate(html, add_column))


def test_drift_renamed_header_token(html):
    """BOT이 'Total Credits'를 다른 말로 바꾸면 멈춰야 한다."""
    def rename(table):
        header = table.find_all("tr")[1]
        for cell in header.find_all(["td", "th"]):
            if "Total Credits" in cell.get_text():
                cell.string = "Aggregate Lending"

    with pytest.raises(ParserDriftError, match="기대 토큰"):
        parse(_mutate(html, rename))


def test_drift_missing_province_rows(html):
    """주가 빠지면 77개가 아니다. 76개로 지수를 만들면 백분위가 전부 어긋난다."""
    def drop_rows(table):
        for tr in table.find_all("tr")[10:14]:
            tr.decompose()

    with pytest.raises(ParserDriftError, match="주 행이"):
        parse(_mutate(html, drop_rows))


def test_drift_branches_column_holds_money(html):
    """지점 수 자리에 금액이 들어오는 전형적 밀림. 상한 검사가 잡아야 한다."""
    def inflate(table):
        for tr in table.find_all("tr")[2:]:
            cells = tr.find_all(["td", "th"])
            cells[2].string = "806,521"

    with pytest.raises(ParserDriftError, match="지점 수"):
        parse(_mutate(html, inflate))


def test_drift_ratio_cross_check(html):
    """공표 예대율과 credits/deposits가 어긋나면 열 정렬이 깨진 것이다.

    행 수·열 수·헤더가 전부 그대로여도 값만 밀리는 경우를 잡는 마지막 그물.
    """
    def swap(table):
        # Total Deposits(8)와 Total Credits(13)의 값만 맞바꾼다.
        # 행 수·열 수·헤더는 그대로다 — 앞의 세 검사는 전부 통과한다.
        for tr in table.find_all("tr")[2:]:
            cells = tr.find_all(["td", "th"])
            dep, cred = cells[8].get_text(strip=True), cells[13].get_text(strip=True)
            cells[8].string, cells[13].string = cred, dep

    with pytest.raises(ParserDriftError, match="예대율"):
        parse(_mutate(html, swap))


def test_drift_no_table_at_all():
    with pytest.raises(ParserDriftError, match="table"):
        parse("<html><body><p>Service temporarily unavailable</p></body></html>")


# ── 이름 정규화 ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("Chiengmai", "chiengmai"),
    ("Prachuapkhirikhun", "prachuapkhirikhun"),
    ("Bueng Kan", "buengkan"),
    ("Phra Nakhon Si Ayutthaya", "phranakhonsiayutthaya"),
    ("Nong Khai (Nongkhai)", "nongkhai"),
])
def test_normalize_name(raw, expected):
    assert normalize_name(raw) == expected


def test_every_fixture_name_is_normalizable(parsed):
    df, _, _, _ = parsed
    keys = df["province_raw"].map(normalize_name)
    assert all(re.fullmatch(r"[a-z]+", k) for k in keys)
    assert keys.nunique() == 77          # 두 주가 같은 키로 뭉개지지 않는다


# ── 기준시점 파싱 ────────────────────────────────────────────────────────

@pytest.mark.parametrize("cell,label,iso", [
    ("JUN 2025 p", "JUN 2025 p", "2025-06"),   # 잠정
    ("AUG 2024 r", "AUG 2024 r", "2024-08"),   # 수정 — 초기 정규식이 놓쳤던 형태
    ("SEP 2024", "SEP 2024", "2024-09"),       # 확정
    ("Jan. 2013", "Jan. 2013", "2013-01"),
])
def test_parse_as_of_handles_revision_markers(cell, label, iso):
    from sources.bot_province import parse_as_of
    assert parse_as_of(["", "", cell, ""]) == (label, iso)


def test_parse_as_of_ignores_non_period_cells():
    from sources.bot_province import parse_as_of
    assert parse_as_of(["", "No. of Branches", "Total Deposits"]) == (None, None)
