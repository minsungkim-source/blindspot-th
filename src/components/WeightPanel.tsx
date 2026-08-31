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
  DEMAND_DEFAULT, DEMAND_LABEL, PRESETS, SUPPLY_DEFAULT, SUPPLY_LABEL,
  type DemandKey, type SupplyKey,
} from "@/config/weights";

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

const SUPPLY_KEYS = Object.keys(SUPPLY_LABEL) as SupplyKey[];
const DEMAND_KEYS = Object.keys(DEMAND_LABEL) as DemandKey[];

export default function WeightPanel({ supply, demand, presetId, onChange }: WeightPanelProps) {
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
    <section className="panel weights" aria-label="가중치 조정">
      <header className="weights__head">
        <h2>가중치</h2>
        <button
          type="button"
          className="weights__reset"
          onClick={() => onChange({ supply: SUPPLY_DEFAULT, demand: DEMAND_DEFAULT, presetId: "balanced" })}
        >
          초기화
        </button>
      </header>

      <div className="weights__presets" role="group" aria-label="프리셋">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="weights__preset"
            aria-pressed={presetId === p.id}
            title={p.note}
            onClick={() => applyPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
        {presetId === "custom" ? <span className="chip chip--muted">사용자 조정</span> : null}
      </div>

      <p className="weights__hint">
        합이 100이 아니어도 됩니다. 계산 직전에 비율로 정규화하므로 상대 크기만 의미가 있습니다.
      </p>

      <fieldset className="weights__group">
        <legend>
          공급 축 <span className="num">합 {Math.round(supplyTotal * 100)}</span>
        </legend>
        {SUPPLY_KEYS.map((k) => (
          <Slider
            key={k}
            id={`w-supply-${k}`}
            label={SUPPLY_LABEL[k]}
            value={supply[k]}
            share={supplyTotal > 0 ? supply[k] / supplyTotal : 0}
            onChange={(v) => setSupply(k, v)}
          />
        ))}
      </fieldset>

      <fieldset className="weights__group">
        <legend>
          수요 축 <span className="num">합 {Math.round(demandTotal * 100)}</span>
        </legend>
        {DEMAND_KEYS.map((k) => (
          <Slider
            key={k}
            id={`w-demand-${k}`}
            label={DEMAND_LABEL[k]}
            value={demand[k]}
            share={demandTotal > 0 ? demand[k] / demandTotal : 0}
            onChange={(v) => setDemand(k, v)}
          />
        ))}
      </fieldset>

      {supplyTotal <= 0 || demandTotal <= 0 ? (
        <p className="weights__error" role="alert">
          한 축의 가중치를 전부 0으로 두면 점수를 계산할 수 없습니다. 하나 이상 올려 주세요.
        </p>
      ) : null}
    </section>
  );
}

function Slider({
  id, label, value, share, onChange,
}: {
  id: string;
  label: string;
  value: number;
  /** 재정규화 후 실제 반영 비율. 슬라이더 값과 다를 수 있어 따로 보여준다. */
  share: number;
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
      <span className="wslider__share num" title="재정규화 후 실제 반영 비율">
        {Math.round(share * 100)}%
      </span>
    </div>
  );
}
