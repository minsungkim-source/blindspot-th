"""Overpass 응답 가드 — HTTP 200인데 받으면 안 되는 응답.

2026-10-01: 주 서버가 504를 세 번 내자 미러로 넘어갔고, 그 미러는 DB가 07-24에 멈춰
있었다. ATM이 4,451 → 2,536개(−43%)로 찍힌 PR이 "머지해도 된다"를 달고 열렸다.
상태 코드만 보면 정상 응답과 구별되지 않는 종류라, 응답 내용으로 거른다.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from sources import osm_atm as o

NOW = datetime(2026, 10, 1, 1, 14, tzinfo=timezone.utc)


def payload(base="2026-10-01T00:55:00Z", remark=None, n=5):
    p = {"osm3s": {"timestamp_osm_base": base},
         "elements": [{"type": "node", "lat": 13.7 + i * 0.01, "lon": 100.5, "tags": {"amenity": "atm"}}
                      for i in range(n)]}
    if remark is not None:
        p["remark"] = remark
    return p


def test_fresh_full_response_is_accepted():
    assert o.payload_problem(payload(), NOW) is None


def test_partial_response_is_rejected():
    """Overpass는 시간 초과면 모은 데까지만 담고 remark를 붙여 200으로 보낸다."""
    why = o.payload_problem(payload(remark='runtime error: Query timed out in "query" at line 4 after 181 seconds.'), NOW)
    assert why and "부분 응답" in why


def test_stale_mirror_is_rejected():
    """10/1 실제 상황: 미러 DB 기준이 07-24 — 69일 묵었다."""
    why = o.payload_problem(payload(base="2026-07-24T11:04:51Z"), NOW)
    assert why and "묵었다" in why


def test_slightly_lagging_mirror_is_fine():
    """미러가 몇 시간~며칠 늦는 건 정상이다. 그것까지 막으면 미러를 둔 의미가 없다."""
    lag = (NOW - timedelta(days=o.MAX_BASE_AGE_DAYS - 1)).isoformat().replace("+00:00", "Z")
    assert o.payload_problem(payload(base=lag), NOW) is None


@pytest.mark.parametrize("base", [None, "", "어제"])
def test_unknown_age_is_rejected(base):
    """얼마나 묵었는지 모르는 응답은 받지 않는다 — 모르면 묵은 것과 같다."""
    p = payload()
    p["osm3s"]["timestamp_osm_base"] = base
    assert o.payload_problem(p, NOW) is not None


class _Resp:
    def __init__(self, status, body):
        self.status_code, self._body = status, body

    def raise_for_status(self):
        if self.status_code >= 400:
            import requests
            raise requests.HTTPError(f"{self.status_code}")

    def json(self):
        if isinstance(self._body, Exception):
            raise self._body
        return self._body


def test_load_skips_stale_mirror_and_fails_loudly(monkeypatch):
    """10/1의 순서를 그대로 재현한다: 주 서버 504 ×3 → 미러가 묵은 DB.
    예전엔 미러 응답을 받았다. 이제는 둘 다 실패로 치고 SourceUnavailable을 던진다
    → build.py가 결측으로 두고 → validate.py '사라진 지표' 게이트가 빌드를 세운다
    → PR이 안 열리고 다음 날 다시 시도한다."""
    calls = []

    def fake_post(url, **kw):
        calls.append(url)
        if "overpass-api.de" in url:
            return _Resp(504, ValueError("html"))
        return _Resp(200, payload(base="2026-07-24T11:04:51Z", n=2536))

    monkeypatch.setattr(o.requests, "post", fake_post)
    monkeypatch.setattr(o.time, "sleep", lambda s: None)
    cfg = {"sources": {"osm_atm": {"endpoint": "https://overpass-api.de/api/interpreter",
                                   "mirrors": ["https://overpass.kumi.systems/api/interpreter"]}},
           "_geojson": {"type": "FeatureCollection", "features": []}}
    with pytest.raises(o.SourceUnavailable, match="묵었다"):
        o.load(cfg)
    assert len(calls) == 2 * o.RETRIES          # 둘 다 재시도까지 다 했다


def test_load_falls_through_to_a_good_mirror(monkeypatch):
    """반대로, 주 서버가 죽어도 멀쩡한 미러가 있으면 그걸 쓴다 — 미러를 둔 이유다."""
    seen = {}

    def fake_post(url, **kw):
        if "overpass-api.de" in url:
            return _Resp(504, ValueError("html"))
        return _Resp(200, payload())

    def fake_build(p, geojson, from_snapshot):
        seen["n"] = len(p["elements"])
        return {"ok": True}

    monkeypatch.setattr(o.requests, "post", fake_post)
    monkeypatch.setattr(o.time, "sleep", lambda s: None)
    monkeypatch.setattr(o, "_build", fake_build)
    o.load({"sources": {"osm_atm": {"endpoint": "https://overpass-api.de/api/interpreter",
                                    "mirrors": ["https://mirror.example/api/interpreter"]}},
            "_geojson": {}})
    assert seen["n"] == 5
