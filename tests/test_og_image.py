"""OG 이미지 — 링크 미리보기가 실제로 그려지는가.

미리보기는 이 도구의 유통 경로다 (링크를 붙여 넣는 것이 사용 방식이다).
조용히 깨지면 아무도 모른다 — 이미지가 안 보인다고 이슈를 여는 사람은 없다.

여기서 고정하는 것은 '예쁘게 나왔는가'가 아니라 다음 셋이다.
  · 규격(1200×630)을 지키는가 — 아니면 스크래퍼가 자른다
  · 지도가 실제로 칠해졌는가 — 배경색만 남은 검은 사각형이 나가지 않는가
  · 값이 없어도 죽지 않는가 — 미리보기 때문에 데이터 갱신을 막지 않는다
"""

from __future__ import annotations

import pytest

import og_image

pytest.importorskip("PIL", reason="Pillow가 없으면 OG 이미지는 건너뛰는 기능이다")

from PIL import Image  # noqa: E402


def square(lon: float, lat: float, size: float = 1.0) -> dict:
    return {
        "type": "Polygon",
        "coordinates": [[
            (lon, lat), (lon + size, lat), (lon + size, lat + size), (lon, lat + size), (lon, lat),
        ]],
    }


@pytest.fixture
def geo() -> dict:
    """태국 경도·위도 범위 안의 격자. 실제 폴리곤 대신 모양만 맞춘다."""
    feats = []
    for i in range(9):
        lon = 98 + (i % 3) * 2.0
        lat = 6 + (i // 3) * 4.0
        feats.append({
            "type": "Feature",
            "properties": {"tis1099_code": f"{10 + i:02d}"},
            "geometry": square(lon, lat, 1.8),
        })
    return {"type": "FeatureCollection", "features": feats}


@pytest.fixture
def rows() -> list[dict]:
    return [{"tis1099_code": f"{10 + i:02d}", "gap": 10.0 + i * 9} for i in range(9)]


def test_renders_at_og_spec(tmp_path, geo, rows):
    out = og_image.render(geo, rows, tmp_path / "og.png", as_of="JUN 2025 p")
    assert out is not None and out.exists()
    with Image.open(out) as im:
        assert im.size == (1200, 630)      # OG 표준. 어긋나면 스크래퍼가 자른다
        assert im.mode == "RGB"


def test_map_is_actually_painted(tmp_path, geo, rows):
    """배경만 남은 검은 사각형이 나가지 않는가.

    램프 색이 화면에 실제로 존재해야 한다 — 투영이 화면 밖으로 나가면
    파일은 정상이지만 지도는 비어 있다.
    """
    out = og_image.render(geo, rows, tmp_path / "og.png")
    with Image.open(out) as im:
        colors = {c for _, c in im.getcolors(maxcolors=1_000_000)}

    ramp = {og_image._hex(c) for c in og_image.SEQUENTIAL}
    assert ramp & colors, "램프 색이 하나도 안 보인다 — 투영이나 폴리곤이 깨졌다"
    assert len(ramp & colors) >= 3, "분위 색이 거의 안 쓰였다 — 색 스케일이 무너졌다"


def test_missing_values_use_no_data_color(tmp_path, geo):
    """값이 없는 주를 램프 색으로 칠하면 '값이 낮다'로 읽힌다."""
    rows = [{"tis1099_code": "10", "gap": 50.0}] + [
        {"tis1099_code": f"{11 + i:02d}", "gap": None} for i in range(8)
    ]
    out = og_image.render(geo, rows, tmp_path / "og.png")
    with Image.open(out) as im:
        colors = {c for _, c in im.getcolors(maxcolors=1_000_000)}
    assert og_image.NO_DATA in colors


def test_no_values_at_all_skips_without_raising(tmp_path, geo):
    """미리보기 하나 때문에 ETL 전체를 죽이지 않는다."""
    rows = [{"tis1099_code": f"{10 + i:02d}", "gap": None} for i in range(9)]
    assert og_image.render(geo, rows, tmp_path / "og.png") is None


def test_unknown_province_does_not_crash(tmp_path, geo, rows):
    """폴리곤에는 있는데 figi.json에 없는 코드 — 결측으로 칠하고 넘어간다."""
    out = og_image.render(geo, rows[:4], tmp_path / "og.png")
    assert out is not None and out.exists()


def test_colors_match_tokens_css():
    """OG 이미지와 화면이 다른 색을 쓰면 미리보기가 다른 제품처럼 보인다.

    tokens.css의 `--seq-*`가 단일 출처다. 한쪽만 바꾸면 여기서 걸린다.
    """
    import re
    from pathlib import Path

    css = (Path(__file__).resolve().parents[1] / "src/styles/tokens.css").read_text(encoding="utf-8")
    seq = re.findall(r"--seq-\d:\s*(#[0-9a-fA-F]{6});", css)
    assert seq, "tokens.css에서 --seq-* 를 찾지 못했다"
    assert [c.lower() for c in seq] == [c.lower() for c in og_image.SEQUENTIAL]


def test_font_resolution_never_returns_korean_strings_without_korean_font(monkeypatch):
    """한글 폰트가 없으면 한글 문구를 쓰면 안 된다 — 두부(□□□)가 나온다."""
    monkeypatch.setattr(og_image, "KOREAN_FONTS", [])
    path, korean = og_image._resolve_font_family()
    assert korean is False
    # 라틴 폰트조차 없는 환경이면 path가 None이고, 그때는 글자를 아예 안 그린다
    assert path is None or path.endswith((".ttf", ".ttc"))
