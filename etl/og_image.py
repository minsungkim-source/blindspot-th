"""OG 이미지 — 링크를 붙여 넣었을 때 보이는 미리보기.

이 도구는 **링크로 유통된다** (가중치를 걸고 슬랙에 붙여 넣는 것이 사용 방식이다).
미리보기가 비어 있으면 링크가 그냥 URL로 보이고, 그러면 아무도 안 연다.
그래서 OG 이미지는 장식이 아니라 유통 경로의 일부다.

**데이터로 그린다.** 손으로 만든 이미지는 지수가 바뀌어도 그대로 남아 거짓말이 된다.
ETL이 figi.json을 구울 때마다 같은 색 램프로 다시 그린다.

색은 tokens.css의 값을 그대로 쓴다 — 미리보기와 실제 화면이 달라 보이면 안 된다.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

W, H = 1200, 630            # OG 표준 비율 1.91:1

# src/styles/tokens.css 와 같은 값. 한쪽을 바꾸면 다른 쪽도 바꾼다.
GROUND = (8, 9, 10)
SURFACE = (14, 17, 19)
BORDER = (33, 38, 43)
INK = (241, 244, 245)
INK_2 = (153, 162, 170)
INK_3 = (106, 115, 123)
SEQUENTIAL = ["#1c5cab", "#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#9ec5f4", "#cde2fb"]
NO_DATA = (33, 38, 43)

# 한글이 되는 폰트를 먼저 찾는다. 없으면 라틴 폰트로 내려가되 **문구도 영어로 바꾼다** —
# 없는 글리프를 그리면 두부(□□□)가 나오고, 그건 글자가 없는 것보다 나쁘다.
# CI(우분투)에는 `fonts-nanum`을 설치해 두면 한글판이 나온다 (refresh-data.yml 참조).
KOREAN_FONTS = [
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
]
LATIN_FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]

# 같은 내용의 두 벌. 한글 폰트를 못 찾으면 아래쪽을 쓴다.
STRINGS_KO = {
    "sub": "태국 77개 주 금융포용 갭",
    "desc": "공급(지점·예수신) 대비 수요(인구·소득·원격성)의 격차",
    "low": "갭 낮음", "high": "갭 높음",
    "as_of": "{} 기준", "src": "출처: BOT · NESDC · OpenStreetMap(ODbL)",
}
STRINGS_EN = {
    "sub": "Financial inclusion gap across 77 provinces",
    "desc": "Demand (population, income, remoteness) against supply (branches, deposits)",
    "low": "Lower gap", "high": "Higher gap",
    "as_of": "as of {}", "src": "Sources: BOT · NESDC · OpenStreetMap (ODbL)",
}


def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _resolve_font_family() -> tuple[str | None, bool]:
    """(폰트 경로, 한글 가능 여부). 실제로 '갭'이 그려지는지 확인한다 —
    파일이 존재한다고 해서 글리프가 있는 것은 아니다."""
    from PIL import Image, ImageDraw, ImageFont

    for path in KOREAN_FONTS:
        if not Path(path).exists():
            continue
        try:
            f = ImageFont.truetype(path, 24)
            probe = Image.new("L", (60, 40), 0)
            ImageDraw.Draw(probe).text((0, 0), "갭", font=f, fill=255)
            if probe.getbbox():
                return path, True
        except OSError:
            continue

    for path in LATIN_FONTS:
        if Path(path).exists():
            return path, False
    return None, False


def _font(path: str | None, size: int):
    from PIL import ImageFont

    if path is None:
        return None
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return None


def _mercator(lon: float, lat: float) -> tuple[float, float]:
    """구면 메르카토르. d3.geoMercator와 같은 식이다 (스케일·평행이동은 뒤에서)."""
    x = math.radians(lon)
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def _rings(geom: dict) -> list[list[tuple[float, float]]]:
    """Polygon / MultiPolygon의 외곽 링만. 구멍은 무시한다 — OG 크기에서 안 보인다."""
    t = geom["type"]
    if t == "Polygon":
        return [geom["coordinates"][0]]
    if t == "MultiPolygon":
        return [poly[0] for poly in geom["coordinates"]]
    return []


def _quantile_colors(values: list[float]) -> list[tuple[float, tuple[int, int, int]]]:
    """분위 경계와 색. scale.ts의 scaleQuantile과 같은 방식이다."""
    s = sorted(values)
    n = len(SEQUENTIAL)
    cuts = [s[min(len(s) - 1, int(len(s) * (i + 1) / n))] for i in range(n)]
    return list(zip(cuts, [_hex(c) for c in SEQUENTIAL]))


def render(
    geojson: dict,
    rows: list[dict],
    out_path: Path,
    as_of: str | None = None,
    value_key: str = "gap",
) -> Path | None:
    """figi.json + 폴리곤 → OG PNG. Pillow가 없으면 조용히 건너뛴다."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("         WARN  Pillow가 없어 OG 이미지를 건너뛴다.")
        return None

    by_code = {str(r["tis1099_code"]).zfill(2): r for r in rows}
    values = [
        float(r[value_key]) for r in rows
        if isinstance(r.get(value_key), (int, float))
    ]
    if not values:
        print(f"         WARN  '{value_key}' 값이 없어 OG 이미지를 건너뛴다.")
        return None
    ramp = _quantile_colors(values)

    def color_for(v: float | None) -> tuple[int, int, int]:
        if v is None:
            return NO_DATA
        for cut, c in ramp:
            if v <= cut:
                return c
        return ramp[-1][1]

    # ── 지도를 오른쪽 절반에 맞춘다
    pts = [
        _mercator(lon, lat)
        for f in geojson["features"]
        for ring in _rings(f["geometry"])
        for lon, lat in ring
    ]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    pad = 42
    box_x, box_w = 640, W - 640 - pad
    box_y, box_h = pad, H - pad * 2
    scale = min(box_w / (max(xs) - min(xs)), box_h / (max(ys) - min(ys)))
    off_x = box_x + (box_w - (max(xs) - min(xs)) * scale) / 2
    off_y = box_y + (box_h - (max(ys) - min(ys)) * scale) / 2

    def project(lon: float, lat: float) -> tuple[float, float]:
        x, y = _mercator(lon, lat)
        return (off_x + (x - min(xs)) * scale, off_y + (max(ys) - y) * scale)

    img = Image.new("RGB", (W, H), GROUND)
    d = ImageDraw.Draw(img)

    for f in geojson["features"]:
        code = str(f["properties"]["tis1099_code"]).zfill(2)
        row = by_code.get(code)
        raw = row.get(value_key) if row else None
        v = float(raw) if isinstance(raw, (int, float)) else None
        for ring in _rings(f["geometry"]):
            poly = [project(lon, lat) for lon, lat in ring]
            if len(poly) > 2:
                d.polygon(poly, fill=color_for(v), outline=GROUND)

    # ── 왼쪽 텍스트
    font_path, korean = _resolve_font_family()
    txt = STRINGS_KO if korean else STRINGS_EN
    title_f, sub_f, small_f = _font(font_path, 52), _font(font_path, 21), _font(font_path, 16)
    if title_f is None:
        print("         WARN  TTF 폰트를 찾지 못해 OG 이미지를 지도만으로 낸다.")
    else:
        if not korean:
            print("         WARN  한글 폰트가 없어 OG 이미지를 영문 문구로 낸다 "
                  "(두부 글자를 내느니 영어가 낫다). CI에 fonts-nanum을 설치하면 한글판이 나온다.")
        d.text((pad + 10, 150), "Blindspot TH", font=title_f, fill=INK)
        d.text((pad + 10, 224), txt["sub"], font=sub_f, fill=INK_2)
        d.text((pad + 10, 258), txt["desc"], font=small_f, fill=INK_3)

        # 램프 + 양끝 값. 색이 무엇을 뜻하는지 없으면 그림일 뿐이다.
        bar_y, bar_w = 340, 44
        for i, c in enumerate(SEQUENTIAL):
            d.rectangle(
                [pad + 10 + i * bar_w, bar_y, pad + 10 + (i + 1) * bar_w - 2, bar_y + 12],
                fill=_hex(c),
            )
        d.text((pad + 10, bar_y + 22), txt["low"], font=small_f, fill=INK_3)
        right = d.textlength(txt["high"], font=small_f)
        d.text((pad + 10 + len(SEQUENTIAL) * bar_w - 2 - right, bar_y + 22), txt["high"],
               font=small_f, fill=INK_3)

        if as_of:
            d.text((pad + 10, 420), txt["as_of"].format(f"BOT {as_of}"),
                   font=small_f, fill=INK_3)
        d.text((pad + 10, 446), txt["src"], font=small_f, fill=INK_3)

    # 하단 구분선 — 이미지가 잘려도 아래가 끝임을 보여준다
    d.rectangle([0, H - 4, W, H], fill=SURFACE)
    d.rectangle([0, H - 5, W, H - 4], fill=BORDER)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG", optimize=True)
    print(f"  wrote  {out_path.name}  ({out_path.stat().st_size // 1024} KB)")
    return out_path


if __name__ == "__main__":
    import sys

    root = Path(__file__).resolve().parent.parent
    geo = json.loads((root / "data/reference/provinces.topo.json").read_text())
    # 단독 실행 시에는 GeoJSON이 필요하다 — build.py 경로에서는 admin_ref가 넘겨준다
    print("build.py를 통해 실행할 것 (폴리곤은 admin_ref가 제공한다).", file=sys.stderr)
