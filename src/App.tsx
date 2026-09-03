/**
 * 레이아웃. 블록 A–H는 기획서 §5의 화면 스펙과 1:1 대응한다.
 *
 * 데이터는 빌드 타임에 확정된 정적 JSON이다 — 런타임 API 호출 없음.
 * 점수는 JSON에도 들어 있지만 화면은 항상 scoreAll()이 다시 계산한 값을 쓴다 —
 * 가중치 슬라이더를 움직이면 두 값이 갈라지기 때문이다.
 *
 * 언어는 URL 상태의 일부라 App이 들고 있고, I18nProvider가 그것을 아래로 내린다.
 * 상태를 들고 있는 쪽과 문구를 쓰는 쪽을 나눠 두면 provider 위에서 useI18n을 부르는
 * 실수가 구조적으로 불가능해진다.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Footer from "@/components/Footer";
import GapMap, { type MapDatum } from "@/components/GapMap";
import Intro from "@/components/Intro";
import Legend from "@/components/Legend";
import FindexPanel, { type FindexData } from "@/components/FindexPanel";
import Methodology, { type MetaShape } from "@/components/Methodology";
import ProvincePanel, { type TimeseriesPoint } from "@/components/ProvincePanel";
import RankTable from "@/components/RankTable";
import ShareBar from "@/components/ShareBar";
import WeightPanel from "@/components/WeightPanel";
import { REPO_URL } from "@/config/attribution";
import { MAP_LAYERS } from "@/config/indicators";
import { I18nProvider, LANGS, LOCALE, makeI18n, useI18n, type Lang } from "@/i18n";
import type { Key } from "@/i18n/strings";
import { scoreAll, type ProvinceRecord, type Scored } from "@/lib/score";
import { DEFAULT_STATE, fromSearch, pushState, type AppState } from "@/lib/urlState";
import type { Topology } from "topojson-specification";

import "@/components/Footer.css";
import "@/components/GapMap.css";
import "@/components/Intro.css";
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

interface Data {
  rows: ProvinceRecord[];
  topology: Topology;
  meta: Meta;
  timeseries: TimeseriesPoint[];
  findex: FindexData | null;
}

export default function App() {
  const [state, setState] = useState<AppState>(() =>
    typeof window === "undefined" ? DEFAULT_STATE : fromSearch(window.location.search),
  );

  useEffect(() => { pushState(state); }, [state]);

  // 문서 언어를 실제로 바꾼다 — 스크린리더의 발음과 브라우저 번역 제안이 여기에 걸린다.
  // 제목과 설명도 같이 옮긴다. 탭 제목·북마크·공유 카드가 화면 언어와 어긋나면
  // 링크를 받은 쪽은 읽지 못하는 언어의 제목을 먼저 본다.
  useEffect(() => {
    const { t } = makeI18n(state.lang);
    document.documentElement.lang = state.lang;
    document.title = t("app.docTitle");
    for (const sel of ['meta[name="description"]', 'meta[property="og:description"]']) {
      document.querySelector(sel)?.setAttribute("content", t("app.docDesc"));
    }
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", t("app.docTitle"));
    document.querySelector('meta[property="og:locale"]')?.setAttribute("content", LOCALE[state.lang]);
  }, [state.lang]);

  // URL이 곧 상태이므로 주소가 바뀌면 화면도 따라가야 한다.
  // 지금은 pushState()가 replaceState를 쓰기 때문에 이 앱 자신은 히스토리를 쌓지 않는다 —
  // 외부 네비게이션에서만 발화한다.
  useEffect(() => {
    const onPop = () => setState(fromSearch(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <I18nProvider lang={state.lang}>
      <Screen state={state} setState={setState} />
    </I18nProvider>
  );
}

function Screen({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
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
      .then(([rows, topology, meta, timeseries, findex]) =>
        setData({ rows, topology, meta, timeseries, findex }),
      )
      .catch(() => setFailed(true));
  }, []);

  /** 단위 문구가 언어를 타므로 레이어 포맷터도 언어와 함께 다시 만든다. */
  const specs = useMemo(() => {
    const perPop = t("layer.unit.perPop");
    const times = t("layer.unit.times");
    return {
      gap: { get: (r: Scored<ProvinceRecord>) => finite(r.gap), format: (v: number | null) => (v == null ? "—" : v.toFixed(1)) },
      priority: { get: (r: Scored<ProvinceRecord>) => finite(r.priority), format: (v: number | null) => (v == null ? "—" : v.toFixed(1)) },
      branch_density: {
        get: (r: Scored<ProvinceRecord>) => finite(r.branch_density),
        format: (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}${perPop}`),
      },
      deposit_per_capita: {
        get: (r: Scored<ProvinceRecord>) => finite(r.deposit_per_capita),
        format: (v: number | null) => (v == null ? "—" : `฿${(v / 1e6).toFixed(2)}M`),
      },
      credit_deposit: {
        get: (r: Scored<ProvinceRecord>) => finite(r.credit_deposit),
        format: (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}${times}`),
      },
    } as Record<string, { get: (r: Scored<ProvinceRecord>) => number | null; format: (v: number | null) => string }>;
  }, [t]);

  const scored = useMemo(() => {
    if (!data) return null;
    // 방콕은 거의 모든 지표에서 극단 이상치다. 빼면 나머지 76개 주의 백분위가 펴진다.
    const filtered = state.excludeBangkok
      ? data.rows.filter((r) => r.tis1099_code !== BANGKOK)
      : data.rows;
    return scoreAll(filtered, state.supply, state.demand);
  }, [data, state.supply, state.demand, state.excludeBangkok]);

  const layer = useMemo(
    () => MAP_LAYERS.find((l) => l.key === state.layer) ?? MAP_LAYERS[0]!,
    [state.layer],
  );
  const layerLabel = t(layer.labelKey);

  const mapData = useMemo<MapDatum[]>(() => {
    if (!scored) return [];
    const spec = specs[layer.key] ?? specs.gap!;
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
      const bkk = data?.rows.find((r) => r.tis1099_code === BANGKOK);
      if (bkk) {
        out.push({
          code: BANGKOK,
          name: bkk.name_en_canonical,
          nameTh: bkk.name_th,
          value: null,
          display: t("map.excluded"),
          excluded: true,
        });
      }
    }
    return out;
  }, [scored, data, layer.key, specs, state.excludeBangkok, t]);

  const legendBounds = useMemo(() => {
    const spec = specs[layer.key] ?? specs.gap!;
    const vals = mapData.map((d) => d.value).filter((v): v is number => v != null).sort((a, b) => a - b);
    if (!vals.length) {
      return { min: "—", max: "—", mid: undefined as string | undefined, midVal: undefined as number | undefined };
    }
    const midVal = vals[vals.length >> 1]!;
    return {
      min: spec.format(vals[0]!),
      max: spec.format(vals[vals.length - 1]!),
      mid: spec.format(midVal),
      midVal,
    };
  }, [mapData, layer.key, specs]);

  const selectedRow = useMemo(
    () => scored?.find((r) => r.tis1099_code === state.selected) ?? null,
    [scored, state.selected],
  );

  const digitalMissing = data?.meta.digital_confidence === "missing";
  const asOfLabel =
    data?.meta.sources?.bot_province?.as_of_label ?? data?.meta.sources?.bot_province?.as_of;

  // 귀속 표기는 라이선스 의무다. 로딩·에러 화면에서도 빠지지 않는다.
  const chrome = (body: ReactNode) => (
    <div className="app">
      {body}
      <Footer
        asOf={Object.fromEntries(
          Object.entries(data?.meta.sources ?? {}).map(([k, v]) => [k, v.as_of]),
        )}
        generatedAt={data?.meta.generated_at ?? null}
      />
    </div>
  );

  const langPicker = (
    <label className="app__control">
      <span className="sr-only">{t("app.language")}</span>
      <select
        value={state.lang}
        onChange={(e) => setState((s) => ({ ...s, lang: e.target.value as Lang }))}
        aria-label={t("app.language")}
      >
        {LANGS.map((l) => (
          <option key={l.id} value={l.id}>{l.label}</option>
        ))}
      </select>
    </label>
  );

  if (failed) return chrome(<Fallback message={t("app.error")} />);
  if (!scored || !data) return chrome(<Fallback message={t("app.loading")} />);

  return chrome(
    <>
      {/* A. 헤더 바 — 레이어 선택 · 기준시점 배지 · 방콕 제외 · 언어 */}
      <header className="app__bar">
        <div className="app__brand">
          <h1>{t("app.title")}</h1>
          <p>{t("app.tagline")}</p>
        </div>

        <div className="app__controls">
          <label className="app__control">
            <span>{t("app.layer")}</span>
            <select
              value={layer.key}
              onChange={(e) => setState((s) => ({ ...s, layer: e.target.value }))}
            >
              {MAP_LAYERS.map((l) => (
                <option key={l.key} value={l.key}>{t(l.labelKey as Key)}</option>
              ))}
            </select>
          </label>

          <label className="app__toggle">
            <input
              type="checkbox"
              checked={state.excludeBangkok}
              onChange={(e) => setState((s) => ({ ...s, excludeBangkok: e.target.checked }))}
            />
            {t("app.excludeBangkok")}
          </label>

          {langPicker}
          {asOfLabel ? <span className="chip num">BOT {asOfLabel}</span> : null}
          <ShareBar />
        </div>
      </header>

      {/* 이 도구가 무엇을 재는지 먼저 말한다 — 지도만 보고 축의 의미를 짐작하게 두지 않는다 */}
      <Intro />

      {digitalMissing ? (
        <p className="app__notice" role="status">
          <strong>{t("app.notice.digital.title")}</strong> {t("app.notice.digital.body")}
        </p>
      ) : null}

      <div className="app__work">
        <section className="app__map panel" aria-label={layerLabel}>
          <Legend
            label={layerLabel}
            scale={layer.scale}
            min={legendBounds.min}
            max={legendBounds.max}
            midpoint={layer.scale === "diverging" ? legendBounds.mid : undefined}
            hasMissing={mapData.some((d) => d.value == null && !d.excluded)}
          />
          <GapMap
            topology={data.topology}
            data={mapData}
            layerLabel={layerLabel}
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
              : " "}
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
              timeseries={data.timeseries}
              onClose={() => setState((s) => ({ ...s, selected: null }))}
            />
          ) : (
            <div className="panel app__empty">{t("app.empty")}</div>
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
      {data.findex ? <FindexPanel data={data.findex} /> : null}

      {/* H. 방법론 — 문서가 아니라 이번 빌드의 meta.json을 렌더한다 */}
      <Methodology meta={data.meta} docUrl={METHODOLOGY_URL} />

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
