"""NESDC 캐시 폴백 — 그쪽 서버가 죽은 달에도 갱신이 도는가.

2026-08-27에 NESDC가 502를 연달아 냈고, **필수 소스**라 월간 갱신 전체가 멈췄다.
연 1회 공표물이라 지난달 워크북과 이번 달 워크북은 같은 파일이다 —
그래서 이 소스에 한해 캐시 폴백을 허용한다. BOT(월간)에는 같은 논리가 없다.

여기서 고정하는 것:
  · 라이브가 죽고 캐시가 있으면 → 캐시로 계속 간다 (from_cache=True)
  · 라이브가 죽고 캐시도 없으면 → 죽는다 (필수 소스이므로 맞다)
  · 라이브가 살아 있으면 → 캐시를 갱신한다
"""

from __future__ import annotations

import pytest

from sources import nesdc_gpp
from sources.nesdc_gpp import SourceUnavailable


def test_cache_is_used_when_live_fails(tmp_path, monkeypatch):
    (tmp_path / "nesdc-gpp-2024.xlsx").write_bytes(b"PK\x03\x04stub")

    def dead(*a, **k):
        raise SourceUnavailable("502 Bad Gateway")

    monkeypatch.setattr(nesdc_gpp, "_get", dead)
    content, year, src, from_cache = nesdc_gpp._fetch_workbook(raw_dir=tmp_path)

    assert from_cache is True
    assert year == 2024
    assert content.startswith(b"PK")
    assert "nesdc-gpp-2024.xlsx" in src


def test_no_cache_means_hard_fail(tmp_path, monkeypatch):
    """캐시가 없으면 조용히 넘어가지 않는다 — 필수 소스다."""
    def dead(*a, **k):
        raise SourceUnavailable("502 Bad Gateway")

    monkeypatch.setattr(nesdc_gpp, "_get", dead)
    with pytest.raises(SourceUnavailable, match="502"):
        nesdc_gpp._fetch_workbook(raw_dir=tmp_path)


def test_newest_edition_wins(tmp_path, monkeypatch):
    for y in (2022, 2024, 2023):
        (tmp_path / f"nesdc-gpp-{y}.xlsx").write_bytes(b"PK\x03\x04" + str(y).encode())

    monkeypatch.setattr(nesdc_gpp, "_get",
                        lambda *a, **k: (_ for _ in ()).throw(SourceUnavailable("down")))
    _, year, _, _ = nesdc_gpp._fetch_workbook(raw_dir=tmp_path)
    assert year == 2024


def test_successful_fetch_refreshes_cache(tmp_path, monkeypatch):
    """다음 달의 장애에 대비해 성공할 때마다 캐시를 새로 쓴다."""
    class FakeResponse:
        headers = {"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
        content = b"PK\x03\x04fresh"
        text = ""
        url = "https://example/GPP-2024.xlsx"

    monkeypatch.setattr(nesdc_gpp, "_get", lambda *a, **k: FakeResponse())
    monkeypatch.setattr(nesdc_gpp, "_find_download", lambda html: ("https://example/x", 2024))

    content, year, url, from_cache = nesdc_gpp._fetch_workbook(raw_dir=tmp_path)
    assert from_cache is False
    assert (tmp_path / "nesdc-gpp-2024.xlsx").read_bytes() == b"PK\x03\x04fresh"


def test_parse_error_does_not_fall_back_to_cache(tmp_path, monkeypatch):
    """스프레드시트가 아닌 응답은 **장애가 아니라 구조 변경**이다.
    캐시로 덮으면 NESDC가 형식을 바꾼 것을 영영 모른다."""
    (tmp_path / "nesdc-gpp-2024.xlsx").write_bytes(b"PK\x03\x04stub")

    class NotASpreadsheet:
        headers = {"Content-Type": "text/html"}
        content = b"<html>maintenance</html>"
        text = ""
        url = "https://example/x"

    monkeypatch.setattr(nesdc_gpp, "_get", lambda *a, **k: NotASpreadsheet())
    monkeypatch.setattr(nesdc_gpp, "_find_download", lambda html: ("https://example/x", 2024))

    with pytest.raises(ValueError, match="스프레드시트가 아니다"):
        nesdc_gpp._fetch_workbook(raw_dir=tmp_path)
