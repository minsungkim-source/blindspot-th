"""OpenStreetMap Overpass — ATM / 은행 POI 주별 집계.

주별 ATM 공식 집계가 존재하지 않아서 쓰는 보조 지표다(BOT는 전국 PDF만 공표).
도시가 농촌보다 잘 매핑되어 있어 갭을 '과소평가'하는 방향으로 편향된다 →
가중치 0.10, 신뢰등급 C. 귀속 표기 필수 (ODbL).

2026-08-26 실측 확인 (Sprint 1)
  · amenity=atm 노드 3,324개. 응답 ~1MB, 7초.
  · 좌표를 ADM1 폴리곤에 point-in-polygon으로 할당한다 (shapely STRtree).
  · 폴리곤 밖으로 떨어지는 점이 나온다(해안선 단순화, 국경 인근). 버리되 개수를 남긴다 —
    이 수가 갑자기 늘면 좌표계나 폴리곤이 바뀐 것이다.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import requests
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

QUERY = """
[out:json][timeout:{timeout}];
area["ISO3166-1"="TH"][admin_level=2]->.th;
(
  node(area.th)["amenity"="atm"];
  node(area.th)["amenity"="bank"]["atm"="yes"];
);
out center;
"""

HEADERS = {"User-Agent": "blindspot-th/0.1 (+https://github.com/blindspot-th/blindspot-th)"}

# 폴리곤 밖으로 떨어진 점을 가장 가까운 주에 붙일 때의 상한.
#
# 2026-08-26 실측: 4,446개 중 271개(6.1%)가 어느 폴리곤에도 들어가지 않는다.
# 그중 절반이 3.2km 이내(해안선 단순화 오차), 최대가 39.5km(섬)다.
# 크로스워크의 ADM1 폴리곤은 코로플레스 표시용으로 단순화되어 있어서(77개 주에 96KB)
# 사모이·창·따오 같은 섬이 본토 폴리곤에서 떨어져 나간다.
#
# 50km는 관측 최대값에 여유를 둔 값이다. 주 평균 면적이 6,700km²라 이 거리에서
# '가장 가까운 주'가 오답일 여지는 경계 근처로 한정된다. ATM은 등급 C·가중치 0.10이다.
# 좌표계가 깨지거나 폴리곤이 바뀌면 거리가 수백 km 단위로 뛰므로 이 상한이 그걸 잡는다.
SNAP_KM = 50.0
KM_PER_DEG = 111.0

# 상한 밖으로 버려지는 비율. 여기를 넘으면 붙이지 않고 실패시킨다.
MAX_UNASSIGNED_SHARE = 0.01


class SourceUnavailable(RuntimeError):
    """소스에 도달하지 못했다. 파싱 오류(ValueError)와 구분한다."""


def _points(elements: list[dict]) -> pd.DataFrame:
    rows = []
    for e in elements:
        lat = e.get("lat") if e.get("lat") is not None else (e.get("center") or {}).get("lat")
        lon = e.get("lon") if e.get("lon") is not None else (e.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        rows.append({"lat": float(lat), "lon": float(lon)})
    return pd.DataFrame(rows)


def assign(points: pd.DataFrame, geojson: dict) -> tuple[pd.DataFrame, dict]:
    """점을 주 폴리곤에 할당한다. (주별 집계, 진단) 반환.

    2단계다. 폴리곤 안에 들어가면 그대로 쓰고, 밖이면 SNAP_KM 안의 가장 가까운 주에 붙인다.
    상한 밖은 버린다 — 붙일 근거가 없다.
    """
    codes = [f["properties"]["tis1099_code"] for f in geojson["features"]]
    polys = [shape(f["geometry"]) for f in geojson["features"]]
    tree = STRtree(polys)
    snap_deg = SNAP_KM / KM_PER_DEG

    counts = {c: 0 for c in codes}
    exact = snapped = unassigned = 0
    max_snap_km = 0.0

    for lat, lon in zip(points["lat"], points["lon"]):
        p = Point(lon, lat)
        hit = next((codes[int(i)] for i in tree.query(p) if polys[int(i)].contains(p)), None)
        if hit is not None:
            counts[hit] += 1
            exact += 1
            continue

        j = int(tree.nearest(p))
        dist = polys[j].distance(p)
        if dist <= snap_deg:
            counts[codes[j]] += 1
            snapped += 1
            max_snap_km = max(max_snap_km, dist * KM_PER_DEG)
        else:
            unassigned += 1

    df = pd.DataFrame(
        sorted(counts.items()), columns=["tis1099_code", "atm_count"]
    ).astype({"tis1099_code": int, "atm_count": int})
    return df, {
        "n_exact": exact,
        "n_snapped": snapped,
        "n_unassigned": unassigned,
        "max_snap_km": round(max_snap_km, 1),
    }


SNAPSHOT_NAME = "osm_atm-latest.json"


def _snapshot_path(config: dict) -> Path | None:
    raw_dir = config.get("_raw_dir")
    return Path(raw_dir) / SNAPSHOT_NAME if raw_dir else None


def load(config: dict) -> dict:
    scfg = config["sources"]["osm_atm"]
    geojson = config["_geojson"]
    timeout = int(scfg.get("timeout_s", 180))

    # --use-snapshot: 직전 응답을 재사용한다. **개발 편의용이다.**
    # Overpass는 무료 공개 서비스라 파서를 손볼 때마다 다시 긁는 것은 예의가 아니고,
    # 인스턴스가 죽어 있으면 다른 소스 작업까지 막힌다.
    # 재사용했다는 사실은 meta.json에 남는다 — 이 상태로 배포되면 리뷰에서 보여야 한다.
    snap = _snapshot_path(config)
    if config.get("_use_snapshot") and snap and snap.exists():
        payload = json.loads(snap.read_text(encoding="utf-8"))
        print(f"         WARN  Overpass를 호출하지 않고 스냅샷을 재사용한다: {snap.name}")
        return _build(payload, geojson, from_snapshot=True)

    # 공개 Overpass 인스턴스는 부하가 몰리면 504·429를 자주 돌려준다.
    # 미러를 순서대로 시도한다 — 월 1회 작업이 인스턴스 하나의 컨디션에 걸리면 안 된다.
    endpoints = [scfg["endpoint"], *scfg.get("mirrors", [])]
    payload = None
    failures = []
    for endpoint in endpoints:
        try:
            # Overpass는 UA 없는 요청에 406을 돌려준다. 연락 가능한 UA를 붙이는 것이 규약이다.
            r = requests.post(
                endpoint,
                data={"data": QUERY.format(timeout=timeout)},
                headers=HEADERS,
                timeout=timeout + 30,
            )
            r.raise_for_status()
            payload = r.json()
            break
        except (requests.RequestException, ValueError) as e:
            failures.append(f"{endpoint}: {e}")
            print(f"         WARN  Overpass {endpoint} 실패 — 다음 미러를 시도한다.")

    if payload is None:
        raise SourceUnavailable("Overpass 인스턴스에 모두 실패했다:\n               "
                                + "\n               ".join(failures))

    # BOT과 같은 이유로 원본을 남긴다. Overpass는 재현이 안 되는 스냅샷 소스다
    # (다음 달에 같은 쿼리를 던져도 같은 답이 오지 않는다).
    if snap:
        snap.parent.mkdir(parents=True, exist_ok=True)
        snap.write_text(json.dumps(payload), encoding="utf-8")

    return _build(payload, geojson, from_snapshot=False)


def _build(payload: dict, geojson: dict, from_snapshot: bool) -> dict:
    points = _points(payload.get("elements", []))
    if points.empty:
        raise SourceUnavailable("Overpass가 ATM 노드를 0개 반환했다 — 쿼리나 서버 상태를 확인할 것.")

    counts, diag = assign(points, geojson)
    share = diag["n_unassigned"] / len(points)
    if share > MAX_UNASSIGNED_SHARE:
        raise ValueError(
            f"ATM {len(points)}개 중 {diag['n_unassigned']}개({share:.1%})가 "
            f"어느 주에서도 {SNAP_KM:.0f}km 안에 들어가지 않는다. 허용치 {MAX_UNASSIGNED_SHARE:.0%}. "
            f"좌표계나 폴리곤이 바뀌었을 수 있다."
        )
    print(f"         atm    {diag['n_exact']} 정확 + {diag['n_snapped']} 스냅"
          f"(최대 {diag['max_snap_km']}km) + {diag['n_unassigned']} 버림")

    return {
        "counts": counts,
        "as_of": payload.get("osm3s", {}).get("timestamp_osm_base"),
        "grade": "C",
        "source_url": "https://www.openstreetmap.org/copyright",
        "n_points": len(points),
        **diag,
        "snap_km": SNAP_KM,
        "from_snapshot": from_snapshot,
        "license": "ODbL 1.0 — © OpenStreetMap contributors",
    }
