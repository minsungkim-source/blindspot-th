/**
 * 갭 지도 — 77개 주 코로플레스.
 *
 * MapLibre가 아니라 D3 + SVG로 그리는 이유가 접근성이다 (DESIGN.md §7).
 * **각 주가 실제 DOM 노드다** — 탭으로 순회되고, 스크린리더가 주 이름과 점수를 읽고,
 * 포커스 링이 붙는다. 캔버스 기반 지도로는 이게 안 된다.
 *
 * 규칙
 *   · 선택 상태는 **색이 아니라 2px `--ink` 스트로크**다. 색은 값 인코딩에 이미 쓰였고,
 *     선택으로 색을 덮으면 그 주의 값을 읽을 수 없게 된다.
 *   · 한 번에 레이어 하나. 순차 컨텍스트를 겹치지 않는다.
 *   · 값이 없는 주는 `--seq-null`. 램프의 가장 어두운 단계와 구분되어야 하므로
 *     범례에 "데이터 없음" 칸을 따로 낸다 (Legend 참조).
 */

import { useMemo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import { NO_DATA, divergingScale, sequentialScale } from "@/lib/scale";
import { useI18n } from "@/i18n";

const VIEW_W = 620;
const VIEW_H = 900;      // 태국은 세로로 길다. 가로 기준으로 맞추면 여백이 크게 남는다.

export interface MapDatum {
  code: string;
  name: string;
  nameTh: string;
  /** 현재 레이어의 값. 없으면 null — 0으로 바꾸지 않는다. */
  value: number | null;
  /** aria-label과 툴팁에 쓸 이미 포맷된 값 */
  display: string;
  /** 값이 없는 것이 아니라 사용자가 뺀 것 (방콕 제외 등). 범례의 '데이터 없음'과 구분한다. */
  excluded?: boolean;
}

export interface GapMapProps {
  topology: Topology;
  data: MapDatum[];
  layerLabel: string;
  scale: "sequential" | "diverging";
  /** 발산형 레이어에서 두 색을 가르는 기준 (보통 전국 중앙값) */
  midpoint?: number;
  selected: string | null;
  onSelect: (code: string | null) => void;
  onHover?: (code: string | null) => void;
}

interface ProvinceProps {
  tis1099_code: string;
}

export default function GapMap({
  topology, data, layerLabel, scale, midpoint, selected, onSelect, onHover,
}: GapMapProps) {
  const { t } = useI18n();

  const features = useMemo(() => {
    const key = Object.keys(topology.objects)[0]!;
    return feature(
      topology,
      topology.objects[key]!,
    ) as unknown as FeatureCollection<Geometry, ProvinceProps>;
  }, [topology]);

  const pathFor = useMemo(() => {
    const projection = geoMercator().fitSize([VIEW_W, VIEW_H], features);
    return geoPath(projection);
  }, [features]);

  const byCode = useMemo(() => new Map(data.map((d) => [d.code, d])), [data]);

  const colorFor = useMemo(() => {
    const values = data.map((d) => d.value).filter((v): v is number => v != null);
    if (!values.length) return () => NO_DATA;
    if (scale === "diverging") {
      const mid = midpoint ?? values.slice().sort((a, b) => a - b)[values.length >> 1]!;
      const s = divergingScale(values, mid);
      return (v: number | null) => (v == null ? NO_DATA : s(v));
    }
    const s = sequentialScale(values);
    return (v: number | null) => (v == null ? NO_DATA : s(v));
  }, [data, scale, midpoint]);

  // 정렬 순서가 곧 탭 순서다. 갭이 큰 주부터 도는 것이 이 도구의 읽는 순서와 맞는다.
  const ordered = useMemo(
    () =>
      features.features.slice().sort((a, b) => {
        const av = byCode.get(a.properties.tis1099_code)?.value ?? -Infinity;
        const bv = byCode.get(b.properties.tis1099_code)?.value ?? -Infinity;
        return bv - av;
      }),
    [features, byCode],
  );

  return (
    <div className="gapmap">
      <svg
        className="gapmap__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="group"
        aria-label={t("map.aria", { layer: layerLabel })}
        onMouseLeave={() => onHover?.(null)}
      >
        <defs>
          {/* forced-colors 모드에서는 배경색이 강제로 교체된다.
              값 구분이 사라지므로 패턴 채움으로 대체한다 (DESIGN.md §7). */}
          <pattern id="fc-hatch" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0,6 l6,-6" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>

        {ordered.map((f) => {
          const code = f.properties.tis1099_code;
          const d = byCode.get(code);
          const isSelected = selected === code;
          const label = d
            ? `${d.name} ${d.nameTh}. ${d.excluded ? t("map.excluded") : `${layerLabel} ${d.display}`}`
            : `${t("map.provinceCode", { code })}. ${layerLabel} ${t("map.noData")}`;

          return (
            <path
              key={code}
              className="gapmap__province"
              d={pathFor(f) ?? undefined}
              fill={colorFor(d?.value ?? null)}
              data-selected={isSelected || undefined}
              data-missing={d?.value == null || undefined}
              data-excluded={d?.excluded || undefined}
              tabIndex={0}
              role="button"
              aria-pressed={isSelected}
              aria-label={label}
              onClick={() => onSelect(isSelected ? null : code)}
              onMouseEnter={() => onHover?.(code)}
              onFocus={() => onHover?.(code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(isSelected ? null : code);
                }
                if (e.key === "Escape") onSelect(null);
              }}
            >
              <title>{label}</title>
            </path>
          );
        })}
      </svg>
    </div>
  );
}
