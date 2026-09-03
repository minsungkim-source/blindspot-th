/**
 * 주 상세 패널 — 지표 카드 · 전국 대비 위치 바 · 12개월 스파크라인 · 신뢰등급.
 *
 * "이 주가 왜 여기 있는가"에 답하는 곳이다. 갭 점수 하나만 보여주면
 * 그 숫자를 믿을지 말지 판단할 근거가 없다. 그래서 원값과 전국 대비 위치를 같이 낸다.
 *
 * 위치 바는 백분위(0..100)를 그대로 그린다. 이미 ETL이 구워 둔 값이라
 * 여기서 다시 계산하지 않는다 — 계산이 두 곳에 생기면 어긋난다.
 */

import { useMemo } from "react";
import GradeBadge from "@/components/GradeBadge";
import { ARCHETYPES, INDICATORS } from "@/config/indicators";
import { DEMAND_LABEL_KEY, SUPPLY_LABEL_KEY, type DemandKey, type SupplyKey } from "@/config/weights";
import { useI18n } from "@/i18n";
import type { ProvinceRecord, Scored } from "@/lib/score";

export interface TimeseriesPoint {
  tis1099_code: string;
  period: string;
  branches: number | null;
  deposits_total: number | null;
  credits_total: number | null;
}

export interface ProvincePanelProps {
  province: Scored<ProvinceRecord>;
  timeseries: TimeseriesPoint[];
  onClose: () => void;
}

export default function ProvincePanel({ province, timeseries, onClose }: ProvincePanelProps) {
  const { t, locale } = useI18n();
  const series = useMemo(
    () =>
      timeseries
        .filter((t) => t.tis1099_code === province.tis1099_code)
        .slice()
        .sort((a, b) => a.period.localeCompare(b.period)),
    [timeseries, province.tis1099_code],
  );

  const cards = INDICATORS.filter((i) => i.axis !== "digital").map((ind) => ({
    ind,
    value: asNumber(province[ind.key]),
  }));

  return (
    <aside className="panel provpanel" aria-label={t("panel.aria", { name: province.name_en_canonical })}>
      <header className="provpanel__head">
        <div className="provpanel__title">
          <h2>{province.name_en_canonical}</h2>
          <p className="provpanel__th">{province.name_th}</p>
        </div>
        <button type="button" className="provpanel__close" onClick={onClose} aria-label={t("panel.close")}>
          ✕
        </button>
      </header>

      <dl className="provpanel__scores">
        <Score labelKey="panel.score.priority" value={province.priority} />
        <Score labelKey="panel.score.gap" value={province.gap} />
        <Score labelKey="panel.score.supply" value={province.supply} />
        <Score labelKey="panel.score.demand" value={province.demand} />
      </dl>

      <div className="provpanel__meta">
        <span className="chip">{province.region_nso}</span>
        <span className="chip num">TIS {province.tis1099_code}</span>
        {province.archetype ? (
          <span className="chip">{t(ARCHETYPES[province.archetype].labelKey)}</span>
        ) : (
          <span className="chip chip--muted" title={t("panel.archetypeUnavailableWhy")}>
            {t("panel.archetypeUnavailable")}
          </span>
        )}
      </div>

      {province.archetype ? (
        <p className="provpanel__action">{t(ARCHETYPES[province.archetype].actionKey)}</p>
      ) : null}

      <Sparkline series={series} />

      <section className="provpanel__section">
        <h3>{t("panel.position")}</h3>
        <p className="provpanel__hint">
          {t("panel.positionHint")}
        </p>
        <div className="provpanel__bars">
          {(Object.keys(SUPPLY_LABEL_KEY) as SupplyKey[]).map((k) => (
            <PctBar key={k} label={t(SUPPLY_LABEL_KEY[k])} value={province.pct_supply[k]} axis="supply" />
          ))}
          {(Object.keys(DEMAND_LABEL_KEY) as DemandKey[]).map((k) => (
            <PctBar key={k} label={t(DEMAND_LABEL_KEY[k])} value={province.pct_demand[k]} axis="demand" />
          ))}
        </div>
      </section>

      <section className="provpanel__section">
        <h3>{t("panel.raw")}</h3>
        <div className="provpanel__cards">
          {cards.map(({ ind, value }) => (
            <div key={ind.key} className="provpanel__card">
              <div className="provpanel__card-label">
                {t(ind.labelKey)}
                <GradeBadge grade={ind.grade} reason={ind.source} size="sm" />
              </div>
              <div className="provpanel__card-value num">{ind.format(value, locale)}</div>
              <div className="provpanel__card-unit">{t(ind.unitKey)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="provpanel__section">
        <h3>{t("panel.digital")}</h3>
        <div className="provpanel__digital">
          <GradeBadge
            grade={province.digital_confidence}
            reason={t("panel.digitalWhy")}
          />
          <span className="num">
            {province.digital_readiness == null ? "—" : province.digital_readiness.toFixed(1)}
          </span>
        </div>
        {province.digital_readiness == null ? (
          <p className="provpanel__hint">
            {t("panel.digitalMissing")}
          </p>
        ) : null}
      </section>
    </aside>
  );
}

function Score({ labelKey, value }: { labelKey: import("@/i18n/strings").Key; value: number }) {
  const { t } = useI18n();
  return (
    <div className="provpanel__score">
      <dt>{t(labelKey)}</dt>
      <dd className="num">{Number.isFinite(value) ? value.toFixed(1) : "—"}</dd>
    </div>
  );
}

function PctBar({
  label, value, axis,
}: { label: string; value: number | null; axis: "supply" | "demand" }) {
  const { t } = useI18n();
  const missing = value == null || !Number.isFinite(value);
  return (
    <div className="pctbar" data-axis={axis}>
      <span className="pctbar__label">{label}</span>
      <span className="pctbar__track" role="img"
            aria-label={t("panel.positionAria", {
              label,
              value: missing ? t("map.noData") : Math.round(value!),
            })}>
        {missing ? null : <span className="pctbar__fill" style={{ width: `${value}%` }} />}
      </span>
      <span className="pctbar__value num">{missing ? "—" : Math.round(value!)}</span>
    </div>
  );
}

/**
 * 12개월 지점 수 추이.
 *
 * 값이 2개 미만이면 그리지 않는다 — 점 하나짜리 스파크라인은 추세를 말하는 것처럼 보이지만
 * 아무것도 말하지 않는다.
 */
function Sparkline({ series }: { series: TimeseriesPoint[] }) {
  const { t } = useI18n();
  const points = series
    .map((s) => ({ period: s.period, v: s.branches }))
    .filter((p): p is { period: string; v: number } => p.v != null && Number.isFinite(p.v));

  if (points.length < 2) {
    return (
      <section className="provpanel__section">
        <h3>{t("panel.trend")}</h3>
        <p className="provpanel__hint">{t("panel.trendInsufficient")}</p>
      </section>
    );
  }

  const w = 260;
  const h = 44;
  const values = points.map((p) => p.v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const flat = hi === lo;

  const x = (i: number) => (i / (points.length - 1)) * w;
  // 값이 내내 같은 주가 77개 중 28개다 (지점 수는 원래 잘 안 변한다).
  // 그때 (v-lo)/span은 0이 되어 선이 상자 **바닥**에 붙는데, 그건 '변화 없음'이 아니라
  // '0으로 떨어졌다'로 읽힌다. 불변이면 가운데에 그린다.
  const y = (v: number) => (flat ? h / 2 : h - ((v - lo) / (hi - lo)) * h);

  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const delta = last.v - first.v;

  return (
    <section className="provpanel__section">
      <h3>{t("panel.trend")}</h3>
      <div className="sparkline">
        <svg viewBox={`0 0 ${w} ${h}`} className="sparkline__svg" role="img"
             aria-label={t("panel.trendAria", {
               from: first.period, to: last.period, first: first.v, last: last.v,
             })}>
          <path d={d} className="sparkline__line" />
          <circle cx={x(points.length - 1)} cy={y(last.v)} r="2.5" className="sparkline__dot" />
        </svg>
        <div className="sparkline__side">
          <span className="num">{last.v}</span>
          <span className="sparkline__delta num" data-dir={delta === 0 ? "flat" : delta > 0 ? "up" : "down"}>
            {delta > 0 ? "+" : ""}{delta}
          </span>
        </div>
      </div>
      <p className="provpanel__hint num">{first.period} — {last.period}</p>
    </section>
  );
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
