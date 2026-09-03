/**
 * 가중치 패널 — 슬라이더 10개 + 프리셋 4개 + 초기화.
 *
 * 이 도구의 실제 사용 방식은 "각자 가중치를 걸고 결과를 링크로 주고받는 것"이다.
 * 그래서 슬라이더를 움직이면 URL이 즉시 따라가고(App의 pushState), 재계산은 브라우저에서 한다.
 *
 * 가중치는 **정규화하지 않고 그대로 보여준다.** 합이 100이 아니어도 된다 —
 * score.ts가 계산 직전에 재정규화하므로 비율만 의미가 있다.
 * 합을 100으로 강제하면 슬라이더 하나를 올릴 때 나머지가 제멋대로 움직여서
 * "무엇을 바꿨는지" 알 수 없게 된다.
 */

import {
  DEMAND_DEFAULT, DEMAND_LABEL_KEY, PRESETS, SUPPLY_DEFAULT, SUPPLY_LABEL_KEY,
  type DemandKey, type SupplyKey,
} from "@/config/weights";
import { useI18n } from "@/i18n";

export interface WeightPanelProps {
  supply: Record<SupplyKey, number>;
  demand: Record<DemandKey, number>;
  presetId: string;
  onChange: (next: {
    supply: Record<SupplyKey, number>;
    demand: Record<DemandKey, number>;
    presetId: string;
  }) => void;
}

const SUPPLY_KEYS = Object.keys(SUPPLY_LABEL_KEY) as SupplyKey[];
const DEMAND_KEYS = Object.keys(DEMAND_LABEL_KEY) as DemandKey[];

export default function WeightPanel({ supply, demand, presetId, onChange }: WeightPanelProps) {
  const { t } = useI18n();
  const supplyTotal = SUPPLY_KEYS.reduce((a, k) => a + supply[k], 0);
  const demandTotal = DEMAND_KEYS.reduce((a, k) => a + demand[k], 0);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    onChange({ supply: p.supply, demand: p.demand, presetId: p.id });
  };

  const setSupply = (k: SupplyKey, v: number) =>
    onChange({ supply: { ...supply, [k]: v }, demand, presetId: "custom" });

  const setDemand = (k: DemandKey, v: number) =>
    onChange({ supply, demand: { ...demand, [k]: v }, presetId: "custom" });

  return (
    <section className="panel weights" aria-label={t("weights.title")}>
      <header className="weights__head">
        <h2>{t("weights.title")}</h2>
        <button
          type="button"
          className="weights__reset"
          onClick={() => onChange({ supply: SUPPLY_DEFAULT, demand: DEMAND_DEFAULT, presetId: "balanced" })}
        >
          {t("weights.reset")}
        </button>
      </header>

      <div className="weights__presets" role="group" aria-label={t("weights.presets")}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="weights__preset"
            aria-pressed={presetId === p.id}
            title={t(p.noteKey)}
            onClick={() => applyPreset(p.id)}
          >
            {t(p.labelKey)}
          </button>
        ))}
        {presetId === "custom" ? <span className="chip chip--muted">{t("weights.custom")}</span> : null}
      </div>

      <p className="weights__hint">
        {t("weights.hint")}
      </p>

      <fieldset className="weights__group">
        <legend>
          {t("weights.supplyAxis")} <span className="num">{t("weights.sum")} {Math.round(supplyTotal * 100)}</span>
        </legend>
        {SUPPLY_KEYS.map((k) => (
          <Slider
            key={k}
            id={`w-supply-${k}`}
            label={t(SUPPLY_LABEL_KEY[k])}
            value={supply[k]}
            share={supplyTotal > 0 ? supply[k] / supplyTotal : 0}
            shareTitle={t("weights.share")}
            onChange={(v) => setSupply(k, v)}
          />
        ))}
      </fieldset>

      <fieldset className="weights__group">
        <legend>
          {t("weights.demandAxis")} <span className="num">{t("weights.sum")} {Math.round(demandTotal * 100)}</span>
        </legend>
        {DEMAND_KEYS.map((k) => (
          <Slider
            key={k}
            id={`w-demand-${k}`}
            label={t(DEMAND_LABEL_KEY[k])}
            value={demand[k]}
            share={demandTotal > 0 ? demand[k] / demandTotal : 0}
            shareTitle={t("weights.share")}
            onChange={(v) => setDemand(k, v)}
          />
        ))}
      </fieldset>

      {supplyTotal <= 0 || demandTotal <= 0 ? (
        <p className="weights__error" role="alert">
          {t("weights.error")}
        </p>
      ) : null}
    </section>
  );
}

function Slider({
  id, label, value, share, shareTitle, onChange,
}: {
  id: string;
  label: string;
  value: number;
  /** 재정규화 후 실제 반영 비율. 슬라이더 값과 다를 수 있어 따로 보여준다. */
  share: number;
  shareTitle: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="wslider">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={0.6}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="wslider__value num" aria-hidden="true">
        {Math.round(value * 100)}
      </span>
      <span className="wslider__share num" title={shareTitle}>
        {Math.round(share * 100)}%
      </span>
    </div>
  );
}
