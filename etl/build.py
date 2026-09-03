#!/usr/bin/env python3
"""
Blindspot TH — ETL 파이프라인.

  python build.py                      전체
  python build.py --only bot_province  소스 하나만
  python build.py --dry-run            다운로드만, 산출물 미기록
  python build.py --use-snapshot       Overpass 응답을 재사용 (개발용, meta에 기록됨)

산출물:
  data/processed/figi.json         주별 원값 + 백분위 + 점수 + 아키타입
  data/processed/timeseries.json   주별 12개월 지점수·예금·여신
  data/processed/meta.json         소스별 기준시점·등급·라이선스·수집시각
  data/processed/findex.json       전국 벤치마크 시계열 (주별 아님)
  data/reference/provinces.topo.json
  public/og.png                    링크 미리보기 이미지 (데이터로 그린다)

소스 실패의 두 등급
  · **필수(A·B)** — admin_ref, bot_province, nesdc_gpp. 하나라도 실패하면 빌드가 죽는다.
    지점수·인구·GPP는 지수의 뼈대다. 없으면 아무것도 못 만든다.
  · **보조(C)** — nso_ict, osm_atm, findex. 도달하지 못하면 경고하고 계속 간다.
    해당 지표는 **결측으로** 남고 (0으로 채우지 않는다) meta.json에 사유가 기록된다.
    figi.py의 가중합이 결측 지표를 가중치에서 빼고 재정규화한다.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import og_image  # noqa: E402
from sources import admin_ref, bot_province, findex, nesdc_gpp, nso_ict, osm_atm  # noqa: E402
from transform import figi, normalize, validate  # noqa: E402

# 순서가 의존성이다. admin_ref가 alias_map과 폴리곤을 만들고,
# nesdc_gpp는 alias_map을, osm_atm은 폴리곤을 필요로 한다.
SOURCES = [
    ("admin_ref", admin_ref, True),
    ("bot_province", bot_province, True),
    ("nesdc_gpp", nesdc_gpp, True),
    ("nso_ict", nso_ict, False),
    ("osm_atm", osm_atm, False),
    ("findex", findex, False),
]

PCT_PREFIXES = {"pct_supply_": "pct_supply", "pct_demand_": "pct_demand"}


def _code_str(code) -> str:
    """TIS-1099를 2자리 문자열로. 식별자를 숫자로 흘리면 조인 타입이 갈라진다."""
    return f"{int(code):02d}"


def load_config() -> dict:
    with open(ROOT / "config.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="이 소스만 실행")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--use-snapshot", action="store_true",
        help="Overpass를 호출하지 않고 data/raw의 직전 응답을 재사용한다 (개발용). "
             "재사용 사실은 meta.json에 기록된다.",
    )
    args = ap.parse_args()

    cfg = load_config()
    raw_dir = (ROOT / cfg["paths"]["raw"]).resolve()
    ref_dir = (ROOT / cfg["paths"]["reference"]).resolve()
    out_dir = (ROOT / cfg["paths"]["processed"]).resolve()
    for d in (raw_dir, ref_dir, out_dir):
        d.mkdir(parents=True, exist_ok=True)

    # 소스 모듈이 원본 스냅샷을 남길 위치. BOT 파서가 깨졌을 때의 유일한 단서다.
    cfg["_raw_dir"] = str(raw_dir)
    cfg["_reference_dir"] = str(ref_dir)
    cfg["_use_snapshot"] = args.use_snapshot

    wanted = set(args.only) if args.only else None
    collected: dict[str, dict] = {}
    degraded: dict[str, str] = {}

    for name, module, required in SOURCES:
        scfg = cfg["sources"].get(name, {})
        if not scfg.get("enabled", False):
            print(f"  skip   {name}  (disabled)")
            continue
        # admin_ref는 --only에서도 항상 돈다. alias_map과 폴리곤이 없으면
        # nesdc_gpp·osm_atm이 아예 실행되지 않는다.
        if wanted and name not in wanted and name != "admin_ref":
            continue
        print(f"  fetch  {name} ...", flush=True)
        try:
            collected[name] = module.load(cfg)
        except Exception as e:
            if required:
                raise
            # 보조 소스다. 결측으로 두고 계속 간다 — 0으로 채우지 않는다.
            degraded[name] = f"{type(e).__name__}: {e}"
            print(f"         WARN  {name} 사용 불가 → 해당 지표는 결측으로 둔다.\n"
                  f"               {degraded[name]}")
            continue
        print(f"         as_of={collected[name].get('as_of')} grade={collected[name].get('grade')}")

        # 뒤 소스가 필요로 하는 산출물을 config에 실어 넘긴다
        if name == "admin_ref":
            cfg["_alias_map"] = collected[name]["alias_map"]
            cfg["_geojson"] = collected[name]["geojson"]

    if wanted:
        print("\n--only 모드 — 조인·지수 계산을 건너뛴다.")
        return 0

    # ---------- 조인: TIS-1099 코드가 마스터 키 ----------
    print("\n  join   crosswalk (TIS-1099) ...")
    base = collected["admin_ref"]["provinces"]          # tis1099_code, name_*, area_km2, region, ...
    df = normalize.attach(base, collected)

    # ---------- 디지털 준비도 하향 추정 ----------
    df = normalize.downscale_digital(df, collected.get("nso_ict"))

    # ---------- 지수 ----------
    print("  score  FIGI ...")
    df = figi.score(df)

    # ---------- 검증 ----------
    print("  check  validation gate ...")
    previous = _load_previous(out_dir)
    warnings = validate.run(df, previous, cfg)
    for w in warnings:
        print(f"         WARN  {w}")

    if args.dry_run:
        print("\n--dry-run — 산출물을 쓰지 않는다.")
        print(df[["name_en_canonical", "branches", "supply", "demand", "gap", "archetype"]]
              .sort_values("gap", ascending=False).head(15).to_string(index=False))
        return 0

    # ---------- 기록 ----------
    _write_json(out_dir / "figi.json", _to_records(df))
    _write_json(out_dir / "timeseries.json", _timeseries(collected, df))
    _write_json(out_dir / "meta.json", _meta(cfg, collected, degraded, df))
    _write_findex(out_dir / "findex.json", collected.get("findex"))
    _write_topology(ref_dir / "provinces.topo.json", collected["admin_ref"]["geojson"])

    # OG 이미지. 실패해도 빌드를 죽이지 않는다 — 미리보기가 없는 것과
    # 데이터가 없는 것은 심각도가 다르다.
    try:
        og_image.render(
            collected["admin_ref"]["geojson"],
            _to_records(df),
            (ROOT.parent / "public" / "og.png"),
            as_of=collected["bot_province"].get("as_of_label")
                  or collected["bot_province"].get("as_of"),
        )
    except Exception as e:      # noqa: BLE001 — 미리보기 때문에 데이터 갱신을 막지 않는다
        print(f"         WARN  OG 이미지 생성 실패 (무시하고 계속): {type(e).__name__}: {e}")

    print(f"\n  wrote  {out_dir}/figi.json  ({len(df)} provinces)")
    return 0


def _to_records(df: pd.DataFrame) -> list[dict]:
    """플랫한 pct_* 컬럼을 score.ts의 ProvinceRow 형태(중첩 객체)로 접는다.

    프런트엔드는 가중치 슬라이더 때문에 백분위를 축별로 묶어서 받아야 한다
    (src/lib/score.ts의 pct_supply / pct_demand).
    """
    keep = [c for c in df.columns if not c.startswith("_")]
    out_df = df[keep].copy()
    # TIS-1099는 수량이 아니라 식별자다. 문자열로 내보내야 URL 상태·TopoJSON 키·
    # 프런트엔드 조회가 전부 같은 타입으로 맞는다 (score.ts의 ProvinceRow도 string).
    out_df["tis1099_code"] = out_df["tis1099_code"].map(_code_str)
    records = json.loads(out_df.to_json(orient="records", double_precision=4))

    out = []
    for rec in records:
        folded: dict = {prefix_out: {} for prefix_out in PCT_PREFIXES.values()}
        rest = {}
        for k, v in rec.items():
            for prefix, target in PCT_PREFIXES.items():
                if k.startswith(prefix):
                    folded[target][k[len(prefix):]] = v
                    break
            else:
                rest[k] = v
        out.append({**rest, **folded})
    return out


def _timeseries(collected: dict, df: pd.DataFrame) -> list[dict]:
    """BOT 시계열에 tis1099_code를 붙인다. 프런트엔드는 코드로만 조회한다."""
    ts = collected["bot_province"]["timeseries"].copy()
    codes = dict(zip(df["province_raw"], df["tis1099_code"]))
    ts["tis1099_code"] = ts["province_raw"].map(codes)
    ts = ts.dropna(subset=["tis1099_code"])
    ts["tis1099_code"] = ts["tis1099_code"].map(_code_str)
    cols = ["tis1099_code", "period", "branches", "deposits_total", "credits_total"]
    return json.loads(ts[cols].to_json(orient="records", double_precision=2))


def _write_findex(path: Path, payload: dict | None) -> None:
    """전국 벤치마크. **지도 레이어가 아니다.**

    표본 n=1,000에 지역 식별자가 없어서 주별로 쪼갤 수 없다. 그 사실을 산출물 안에
    `scope`와 `not_by_province`로 박아 둔다 — 프런트엔드가 "주별 아님" 라벨을 붙이는 근거이고,
    나중에 누가 이 파일을 보고 주별 레이어를 만들려는 것을 막는 장치이기도 하다.

    소스에 도달하지 못했으면 파일을 쓰지 않는다. 빈 파일을 남기면 화면이
    "0%"짜리 차트를 그린다.
    """
    if payload is None:
        print("         WARN  findex 없음 → findex.json을 쓰지 않는다 (패널이 숨겨진다).")
        path.unlink(missing_ok=True)
        return

    series = {k: v for k, v in payload["series"].items() if v}
    if not series:
        print("         WARN  findex 시계열이 전부 비었다 → findex.json을 쓰지 않는다.")
        path.unlink(missing_ok=True)
        return

    _write_json(path, {
        "scope": payload.get("scope", "national"),
        "not_by_province": True,
        "as_of": payload.get("as_of"),
        "source_url": payload.get("source_url"),
        # 화면에 그대로 나가는 캡션이라 언어별로 굽는다. 화면이 언어를 고를 수 있어야 하는데
        # 데이터가 한 언어로만 오면 그 지점에서 번역이 끊긴다.
        "sample_note": {
            "ko": "태국 표본 n=1,000 · 지역 식별자 없음 — 주별 분해 불가",
            "en": "Thai sample n=1,000 · no sub-national identifier — cannot be split by province",
        },
        "series": series,
    })
    print(f"  wrote  {path.name}  ({len(series)} series)")


def _load_previous(out_dir: Path) -> pd.DataFrame | None:
    p = out_dir / "figi.json"
    if not p.exists():
        return None
    try:
        prev = pd.read_json(p)
    except ValueError:
        return None
    # 산출물은 코드를 문자열로 담지만 파이프라인 내부는 int로 조인한다.
    # 타입이 어긋나면 validate의 전월 대비 병합이 빈 결과가 되어 급변 감지가 조용히 꺼진다.
    if "tis1099_code" in prev.columns:
        prev["tis1099_code"] = pd.to_numeric(prev["tis1099_code"], errors="coerce").astype("Int64")
    return prev


def _meta(cfg: dict, collected: dict, degraded: dict, df: pd.DataFrame) -> dict:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "country": cfg["country"],
        "admin_level": cfg["admin_level"],
        "n_units": len(df),
        "money_unit": "baht",
        # 화면에 "추정"/"없음" 배지를 붙일 근거. 프런트엔드는 이 값을 신뢰한다.
        "digital_confidence": (
            df["digital_confidence"].iloc[0] if "digital_confidence" in df.columns else "missing"
        ),
        "degraded_sources": degraded,
        "sources": {
            name: {
                "as_of": payload.get("as_of"),
                "grade": payload.get("grade"),
                "url": payload.get("source_url") or cfg["sources"].get(name, {}).get("url"),
                "license": cfg["sources"].get(name, {}).get("license"),
                # 스크래핑 소스는 구조 지문을 남긴다 — 다음 실행과 비교하면 표 변경이 보인다
                **({"fingerprint": payload["fingerprint"]} if payload.get("fingerprint") else {}),
                **({"as_of_label": payload["as_of_label"]} if payload.get("as_of_label") else {}),
                # 네트워크를 타지 않고 저장본을 쓴 경우는 반드시 드러나야 한다.
                # PR 리뷰어가 "이번 갱신은 진짜 새 데이터인가"를 판단하는 근거다.
                **({"from_snapshot": True} if payload.get("from_snapshot") else {}),
                **({"from_cache": True} if payload.get("from_cache") else {}),
            }
            for name, payload in collected.items()
        },
        "index": _index_block(cfg, df),
    }


def _index_block(cfg: dict, df: pd.DataFrame) -> dict:
    """config의 지수 정의를 그대로 싣되, 실제 결과와 어긋나는 곳은 실제로 맞춘다.

    config.yaml의 `digital.confidence`는 '이렇게 만들 계획'이고,
    이번 빌드에서 정말 만들어졌는지는 별개다. 화면의 방법론 패널이 이 블록을 읽으므로
    계획을 그대로 보여주면 없는 축을 '추정'이라고 말하게 된다.
    """
    index = json.loads(json.dumps(cfg["index"]))     # config를 건드리지 않도록 복사
    actual = (
        df["digital_confidence"].iloc[0]
        if "digital_confidence" in df.columns and len(df) else "missing"
    )
    if index.get("digital", {}).get("confidence") != actual:
        index.setdefault("digital", {})
        index["digital"]["confidence_planned"] = index["digital"].get("confidence")
        index["digital"]["confidence"] = actual
    return index


def _write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")


def _write_topology(path: Path, geojson: dict) -> None:
    """GeoJSON → TopoJSON. 폴리곤은 이미 단순화되어 있어(96KB) 추가 단순화는 하지 않는다.

    해상도를 더 깎으면 Phuket·Samut Songkhram 같은 작은 주가 사라진다.
    77개 주가 전부 보이는 것이 이 도구의 전제다.
    """
    import topojson

    # 폴리곤 속성의 코드도 figi.json과 같은 문자열이어야 한다 — 지도가 이 키로 조인한다.
    for feat in geojson["features"]:
        feat["properties"]["tis1099_code"] = _code_str(feat["properties"]["tis1099_code"])

    topo = topojson.Topology(geojson, prequantize=False).to_dict()
    path.write_text(json.dumps(topo, ensure_ascii=False), encoding="utf-8")
    print(f"  wrote  {path}  ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    raise SystemExit(main())
