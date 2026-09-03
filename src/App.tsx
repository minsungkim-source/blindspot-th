/**
 * 레이아웃. 블록 A–H는 기획서 §5의 화면 스펙과 1:1 대응한다.
 *
 * 데이터는 빌드 타임에 확정된 정적 JSON이다 — 런타임 API 호출 없음.
 * 점수는 JSON에도 들어 있지만 화면은 항상 scoreAll()이 다시 계산한 값을 쓴다.
 * 가중치 슬라이더(Sprint 3)가 붙으면 그때부터 두 값이 갈라지기 때문이다.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Footer from "@/components/Footer";
import GapMap, { type MapDatum } from "@/components/GapMap";
import Legend from "@/components/Legend";
import FindexPanel, { type FindexData } from "@/components/FindexPanel";
import Methodology, { type MetaShape } from "@/components/Methodology";
import ProvincePanel, { type TimeseriesPoint } from "@/components/ProvincePanel";
import RankTable from "@/components/RankTable";
import ShareBar from "@/components/ShareBar";
import WeightPanel from "@/components/WeightPanel";
import { REPO_URL } from "@/config/attribution";
import { MAP_LAYERS } from "@/config/indicators";
import { scoreAll, type ProvinceRecord, type Scored } from "@/lib/score";
import { DEFAULT_STATE, fromSearch, pushState, type AppState } from "@/lib/urlState";
import type { Topology } from "topojson-specification";

import "@/components/Footer.css";
import "@/components/GapMap.css";
import "@/components/Legend.css";
import "@/components/ProvincePanel.css";
import "@/components/RankTable.css";
import "@/components/WeightPanel.css";
import "@/components/FindexPanel.css";
import "@/components/Methodology.css";
import "@/App.css";

const BASE = import.meta.env.BASE_URL;
const BANGKOK = "10";
const METHODOLOGY_URL = `${REPO_URL}/blob/main/METHODOLOGY.md`;

/** meta.json. Methodology 패널이 쓰는 필드까지 포함한다. */
type Meta = MetaShape & {
  digital_confidence?: "measured" | "derived" | "estimated" | "missing";
};

/** 레이어별로 어떤 값을 칠하고 어떻게 읽을지. 지도는 한 번에 하나만 보여준다. */
const LAYER_VALUE: Record<
  string,
  { get: (r: Scored<ProvinceRecord>) => number | null; format: (v: number | null) => string }
> = {
  gap: { get: (r) => finite(r.gap), format: (v) => (v == null ? "—" : v.toFixed(1)) },
  priority: { get: (r) => finite(r.priority), format: (v) => (v == null ? "—" : v.toFixed(1)) },
  branch_density: {
    get: (r) => finite(r.branch_density),
    format: (v) => (v == null ? "—" : `${v.toFixed(1)}개/10만명`),
  },
  deposit_per_capita: {
    get: (r) => finite(r.deposit_per_capita),
    format: (v) => (v == null ? "—" : `฿${(v / 1e6).toFixed(2)}M`),
  },
  credit_deposit: {
    get: (r) => finite(r.credit_deposit),
    format: (v) => (v == null ? "—" : `${v.toFixed(2)}배`),
  },
};

export default function App() {
  const [state, setState] = useState<AppState>(() =>
    typeof window === "undefined" ? DEFAULT_STATE : fromSearch(window.location.search),
  );
  const [rows, setRows] = useState<ProvinceRecord[] | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [findex, setFindex] = useState<FindexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}data/figi.json`).then((r) => r.json()),
      fetch(`${BASE}data/provinces.topo.json`).then((r) => r.json()),
      fetch(`${BASE}data/meta.json`).then((r) => r.json()),
      fetch(`${BASE}data/timeseries.json`).then((r) => r.json()).catch(() => []),
      // findex는 보조 소스라 파일 자체가 없을 수 있다. 없으면 패널을 숨긴다.
      fetch(`${BASE}data/findex.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([f, t, m, ts, fx]) => {
        setRows(f); setTopology(t); setMeta(m); setTimeseries(ts); setFindex(fx);
      })
      .catch(() =>
        setError("데이터 파일이 없습니다. etl/build.py를 실행하거나 npm run data:sync를 먼저 돌리세요."),
      );
  }, []);

  useEffect(() => { pushState(state); }, [state]);

  // URL이 곧 상태이므로 주소가 바뀌면 화면도 따라가야 한다.
  // 지금은 pushState()가 replaceState를 쓰기 때문에 이 앱 자신은 히스토리를 쌓지 않는다 —
  // 외부 네비게이션에서만 발화한다. 가중치 변경을 히스토리에 남기기로 하면(Sprint 3에서
  // 결정) 이 핸들러가 뒤로가기를 그대로 받아낸다.
  useEffect(() => {
    const onPop = () => setState(fromSearch(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const scored = useMemo(() => {
    if (!rows) return null;
    // 방콕은 거의 모든 지표에서 극단 이상치다. 빼면 나머지 76개 주의 백분위가 펴진다.
    // 백분위는 ETL이 구운 값이라 여기서 다시 계산되지 않는다 — 순위만 다시 매겨진다.
    const filtered = state.excludeBangkok
      ? rows.filter((r) => r.tis1099_code !== BANGKOK)
      : rows;
    return scoreAll(filtered, state.supply, state.demand);
  }, [rows, state.supply, state.demand, state.excludeBangkok]);

  const layer = useMemo(
    () => MAP_LAYERS.find((l) => l.key === state.layer) ?? MAP_LAYERS[0]!,
    [state.layer],
  );

  const mapData = useMemo<MapDatum[]>(() => {
    if (!scored) return [];
    const spec = LAYER_VALUE[layer.key] ?? LAYER_VALUE.gap!;
    const out: MapDatum[] = scored.map((r) => {
      const value = spec.get(r);
      return {
        code: r.tis1099_code,
        name: r.name_en_canonical,
        nameTh: r.name_th,
        value,
        display: spec.format(value),
      };
    });

    // 방콕을 뺐어도 폴리곤은 77개 그려진다. 값 없이 두면 스크린리더가 "데이터 없음"으로
    // 읽는데, 없는 것과 뺀 것은 다르다 — 명시적으로 '제외됨'이라고 말한다.
    if (state.excludeBangkok) {
      const bkk = rows?.find((r) => r.tis1099_code === BANGKOK);
      if (bkk) {
        out.push({
          code: BANGKOK,
          name: bkk.name_en_canonical,
          nameTh: bkk.name_th,
          value: null,
          display: "제외됨",
          excluded: true,
        });
      }
    }
    return out;
  }, [scored, rows, layer.key, state.excludeBangkok]);

  const legendBounds = useMemo(() => {
    const spec = LAYER_VALUE[layer.key] ?? LAYER_VALUE.gap!;
    const vals = mapData.map((d) => d.value).filter((v): v is number => v != null).sort((a, b) => a - b);
    if (!vals.length) return { min: "—", max: "—", mid: undefined as string | undefined, midVal: undefined as number | undefined };
    const midVal = vals[vals.length >> 1]!;
    return {
      min: spec.format(vals[0]!),
      max: spec.format(vals[vals.length - 1]!),
      mid: spec.format(midVal),
      midVal,
    };
  }, [mapData, layer.key]);

  const selectedRow = useMemo(
    () => scored?.find((r) => r.tis1099_code === state.selected) ?? null,
    [scored, state.selected],
  );

  const digitalMissing = meta?.digital_confidence === "missing";
  const asOfLabel = meta?.sources?.bot_province?.as_of_label ?? meta?.sources?.bot_province?.as_of;

  // 귀속 표기는 라이선스 의무다. 로딩·에러 화면에서도 빠지지 않는다.
  const chrome = (body: ReactNode) => (
    <div className="app">
      {body}
      <Footer
        asOf={Object.fromEntries(
          Object.entries(meta?.sources ?? {}).map(([k, v]) => [k, v.as_of]),
        )}
        generatedAt={meta?.generated_at ?? null}
      />
    </div>
  );

  if (error) return chrome(<Fallback message={error} />);
  if (!scored || !topology) return chrome(<Fallback message="불러오는 중…" />);

  return chrome(
    <>
      {/* A. 헤더 바 — 레이어 선택 · 기준시점 배지 · 방콕 제외 */}
      <header className="app__bar">
        <div className="app__brand">
          <h1>Blindspot TH</h1>
          <p>태국 77개 주 금융포용 갭</p>
        </div>

        <div className="app__controls">
          <label className="app__control">
            <span>레이어</span>
            <select
              value={layer.key}
              onChange={(e) => setState((s) => ({ ...s, layer: e.target.value }))}
            >
              {MAP_LAYERS.map((l) => (
                <option key={l.key} value={l.key}>{l.label}</option>
              ))}
            </select>
          </label>

          <label className="app__toggle">
            <input
              type="checkbox"
              checked={state.excludeBangkok}
              onChange={(e) => setState((s) => ({ ...s, excludeBangkok: e.target.checked }))}
            />
            방콕 제외
          </label>

          {asOfLabel ? <span className="chip num">BOT {asOfLabel}</span> : null}
          <ShareBar />
        </div>
      </header>

      {digitalMissing ? (
        <p className="app__notice" role="status">
          <strong>디지털 준비도 축이 비어 있습니다.</strong> 권역별 ICT 이용률과 주별 도시화율을
          공개 소스에서 확보하지 못해 v1에서는 계산하지 않습니다. 사분면과 아키타입 분류가
          비활성 상태이며, 갭·우선순위·랭킹은 영향을 받지 않습니다.
        </p>
      ) : null}

      <div className="app__work">
        <section className="app__map panel" aria-label={`${layer.label} 지도`}>
          <Legend
            label={layer.label}
            scale={layer.scale}
            min={legendBounds.min}
            max={legendBounds.max}
            midpoint={layer.scale === "diverging" ? legendBounds.mid : undefined}
            hasMissing={mapData.some((d) => d.value == null && !d.excluded)}
          />
          <GapMap
            topology={topology}
            data={mapData}
            layerLabel={layer.label}
            scale={layer.scale}
            midpoint={legendBounds.midVal}
            selected={state.selected}
            onSelect={(code) => setState((s) => ({ ...s, selected: code }))}
            onHover={setHovered}
          />
          <p className="app__hovered num">
            {hovered
              ? `${mapData.find((d) => d.code === hovered)?.name ?? ""} · ${
                  mapData.find((d) => d.code === hovered)?.display ?? ""
                }`
              : " "}
          </p>
        </section>

        <div className="app__side">
          <WeightPanel
            supply={state.supply}
            demand={state.demand}
            presetId={state.preset}
            onChange={({ supply, demand, presetId }) =>
              setState((s) => ({ ...s, supply, demand, preset: presetId }))
            }
          />
          {selectedRow ? (
            <ProvincePanel
              province={selectedRow}
              timeseries={timeseries}
              onClose={() => setState((s) => ({ ...s, selected: null }))}
            />
          ) : (
            <div className="panel app__empty">
              지도나 표에서 주를 선택하면 상세가 여기 표시됩니다.
            </div>
          )}
        </div>
      </div>

      {/* D. 랭킹 테이블 — 지도의 테이블 뷰 대안이기도 하다 */}
      <RankTable
        rows={scored}
        selected={state.selected}
        onSelect={(code) => setState((s) => ({ ...s, selected: code }))}
        onHover={setHovered}
        showArchetype={!digitalMissing}
      />

      {/* G. Findex 벤치마크 — "주별 아님" 라벨은 컴포넌트 안에 상시 붙어 있다 */}
      {findex ? <FindexPanel data={findex} /> : null}

      {/* H. 방법론 — 문서가 아니라 이번 빌드의 meta.json을 렌더한다 */}
      {meta ? <Methodology meta={meta} docUrl={METHODOLOGY_URL} /> : null}

      {/* C. 사분면 — 디지털 축 결측으로 v1 보류 (docs/BACKLOG.md Sprint 3) */}
    </>,
  );
}

function Fallback({ message }: { message: string }) {
  return (
    <div style={{ padding: 40, color: "var(--ink-2)", fontFamily: "var(--sans)" }}>
      {message}
    </div>
  );
}

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
