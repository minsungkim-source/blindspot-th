"""thailand-canonical-admin-names — 조인 마스터.

BOT는 영문 주명 문자열, geoBoundaries는 shapeID, DOPA는 숫자 코드를 쓴다.
이 저장소의 크로스워크(name_alternates_en + overrides.csv)가 그 넷을 잇는
유일한 검증된 다리다. v1.0.2 / CC BY 4.0 / DOI 10.5281/zenodo.20049930

2026-08-26 실측 보정 (Sprint 1)
  · name_alternates_en의 구분자는 세미콜론이 아니라 **파이프(|)**다.
  · 폴리곤 GeoJSON의 조인 키는 ADM1_PCODE = 'TH' + 2자리 TIS-1099 (예: TH10).
  · 크로스워크의 `region`은 6권역(Central/East/West/North/Northeast/South)이다.
    NSO·NESDC·BOT이 쓰는 5권역과 다르므로 지역 하향추정에 그대로 쓰면 안 된다 —
    NSO 5권역은 bot_province가 표의 소계 행에서 직접 읽어 `region_nso`로 넘긴다.
"""

from __future__ import annotations

import io
import json
import re
from pathlib import Path

import pandas as pd
import requests

RAW = "https://raw.githubusercontent.com/DevelopedbyWill/thailand-canonical-admin-names/{ref}/{path}"
ALIAS_SEP = "|"
ALIAS_FILE = "province_name_aliases.csv"

# 프런트엔드가 실제로 쓰는 컬럼만 남긴다. 크로스워크는 36개 컬럼짜리다.
KEEP = [
    "tis1099_code", "iso3166_2", "name_en_canonical", "name_th",
    "region", "capital", "capital_th",
    "centroid_lat", "centroid_lon", "area_km2",
    "distance_to_bangkok_km", "is_coastal", "has_international_border",
    "num_amphoe", "num_tambon",
]


def norm(name: str) -> str:
    """조인 정규화 — 소문자 + 알파벳만. bot_province.normalize_name()과 같은 규칙."""
    s = str(name).lower()
    s = re.sub(r"\(.*?\)", "", s)
    return re.sub(r"[^a-z]", "", s)


def _get(url: str, timeout: int = 60) -> str:
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    return r.text


def _load_local_aliases(ref_dir: Path, alias_map: dict[str, int]) -> dict[str, int]:
    """로컬 별칭 테이블. 상류가 흡수한 별칭은 경고하고 무시한다."""
    path = ref_dir / ALIAS_FILE
    if not path.exists():
        print(f"         WARN  {ALIAS_FILE}이 없다. BOT·NESDC 표기 15개가 붙지 않을 것이다.")
        return {}

    df = pd.read_csv(path, comment="#")
    local: dict[str, int] = {}
    for _, row in df.iterrows():
        key = str(row["join_key"]).strip()
        code = int(row["tis1099_code"])
        if key in local and local[key] != code:
            raise ValueError(
                f"별칭 '{key}'이 {ALIAS_FILE} 안에서 서로 다른 주를 가리킨다 "
                f"({local[key]} vs {code}). 소스별로 같은 철자가 다른 주일 수는 없다."
            )
        if key in alias_map:
            if alias_map[key] == code:
                print(f"         WARN  별칭 '{key}'은 상류 크로스워크가 이미 흡수했다 — "
                      f"{ALIAS_FILE}에서 지울 것.")
            else:
                raise ValueError(
                    f"별칭 '{key}'이 상류({alias_map[key]})와 로컬({code})에서 다른 주를 가리킨다. "
                    f"둘 중 하나가 틀렸다 — 사람이 판단할 것."
                )
            continue
        local[key] = code
    return local


def load(config: dict) -> dict:
    scfg = config["sources"]["admin_ref"]
    ref, files = scfg["ref"], scfg["files"]
    ref_dir = Path(config["_reference_dir"])

    prov = pd.read_csv(io.StringIO(_get(RAW.format(ref=ref, path=files["provinces_csv"]))))
    if len(prov) != config.get("n_units", 77):
        raise ValueError(f"크로스워크가 {len(prov)}행이다. {config.get('n_units', 77)}행이어야 한다.")

    # 정식명 + 별칭을 전부 정규화 키로 펼쳐 BOT 표기를 흡수한다
    alias_map: dict[str, int] = {}
    for _, row in prov.iterrows():
        code = int(row["tis1099_code"])
        names = [row["name_en_canonical"]]
        if isinstance(row.get("name_alternates_en"), str):
            names += [n.strip() for n in row["name_alternates_en"].split(ALIAS_SEP) if n.strip()]
        for n in names:
            alias_map.setdefault(norm(n), code)

    n_upstream = len(alias_map)
    alias_map.update(_load_local_aliases(ref_dir, alias_map))
    print(f"         alias  상류 {n_upstream}개 + 로컬 {len(alias_map) - n_upstream}개")

    prov["tis1099_code"] = prov["tis1099_code"].astype(int)
    base = prov[[c for c in KEEP if c in prov.columns]].copy()

    # 폴리곤 — ADM1_PCODE('TH10')에서 TIS-1099를 뽑아 붙인다
    geo = json.loads(_get(RAW.format(ref=ref, path=files["provinces_geojson"]), timeout=120))
    for feat in geo["features"]:
        pcode = feat["properties"].get("ADM1_PCODE", "")
        m = re.fullmatch(r"TH(\d{2})", str(pcode))
        if not m:
            raise ValueError(f"폴리곤 ADM1_PCODE 형식이 바뀌었다: {pcode!r}")
        feat["properties"] = {"tis1099_code": int(m.group(1))}

    geo_codes = {f["properties"]["tis1099_code"] for f in geo["features"]}
    missing = set(base["tis1099_code"]) - geo_codes
    if missing:
        raise ValueError(f"폴리곤이 없는 주: {sorted(missing)}")

    return {
        "provinces": base,
        "alias_map": alias_map,       # normalize된 별칭 → tis1099_code
        "geojson": geo,
        "as_of": ref,
        "grade": "A",
        "source_url": f"https://github.com/{scfg['repo']}",
    }
