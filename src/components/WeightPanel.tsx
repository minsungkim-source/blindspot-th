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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DEMAND_DEFAULT, DEMAND_LABEL_KEY, PRESETS, SUPPLY_DEFAULT, SUPPLY_LABEL_KEY,
  WEIGHT_CALC_KEY, WEIGHT_DEF_KEY, WEIGHT_INDICATOR,
  type DemandKey, type SupplyKey,
} from "@/config/weights";
import { INDICATORS, type Grade } from "@/config/indicators";
import GradeBadge from "@/components/GradeBadge";
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

  /** 툴팁 내용. 출처·신뢰등급은 INDICATORS에서 끌어온다 (weights.ts의 WEIGHT_INDICATOR 참고). */
  const tipFor = (k: SupplyKey | DemandKey, label: string): SliderTip => {
    const ind = INDICATORS.find((i) => i.key === WEIGHT_INDICATOR[k]);
    return {
      title: label,
      def: t(WEIGHT_DEF_KEY[k]),
      calc: t(WEIGHT_CALC_KEY[k]),
      source: ind?.source ?? "—",
      grade: ind?.grade ?? "missing",
      calcLabel: t("weights.tip.calc"),
      sourceLabel: t("weights.tip.source"),
    };
  };
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
            tip={tipFor(k, t(SUPPLY_LABEL_KEY[k]))}
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
            tip={tipFor(k, t(DEMAND_LABEL_KEY[k]))}
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

/**
 * 이 요소가 실제로 보일 수 있는 세로 범위. 스크롤 컨테이너 조상이 있으면 그 경계로 좁힌다.
 *
 * 데스크톱에서는 오른쪽 열(`.app__side`)이 `overflow-y: auto`라서, 뷰포트 안이어도
 * 그 열의 바닥을 넘는 툴팁은 잘린다. 맨 아래 슬라이더가 정확히 그 경우였다.
 */
function visibleBand(el: HTMLElement): { top: number; bottom: number } {
  let top = 0;
  let bottom = window.innerHeight;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden") {
      const r = p.getBoundingClientRect();
      top = Math.max(top, r.top);
      bottom = Math.min(bottom, r.bottom);
    }
  }
  return { top, bottom };
}

interface SliderTip {
  title: string;
  def: string;
  calc: string;
  source: string;
  grade: Grade;
  calcLabel: string;
  sourceLabel: string;
}

/**
 * 슬라이더 한 줄 + 지표 정의 툴팁.
 *
 * 툴팁은 **마우스만을 위한 것이 아니다** (CLAUDE.md의 접근성 절).
 * - 마우스: 라벨 위에 올리면 뜬다. 행 전체가 아니라 라벨에만 거는 이유는, 슬라이더를
 *   잡으러 가는 길에 줄마다 툴팁이 튀어나오면 조작을 방해하기 때문이다.
 * - 키보드: 슬라이더에 Tab으로 들어오면 뜬다 (`:focus-visible`).
 * - 터치: 호버가 없으므로 라벨을 탭해 슬라이더에 포커스가 가면 뜬다.
 * - 스크린리더: 뜨든 말든 `aria-describedby`로 정의를 읽어 준다.
 *
 * WCAG 1.4.13(호버·포커스로 나타나는 내용)의 세 조건을 지킨다 — 포인터를 툴팁 위로
 * 옮겨도 사라지지 않고(숨김 지연), Esc로 닫을 수 있고, 스스로 사라지지 않는다.
 */
function Slider({
  id, label, tip, value, share, shareTitle, onChange,
}: {
  id: string;
  label: string;
  tip: SliderTip;
  value: number;
  /** 재정규화 후 실제 반영 비율. 슬라이더 값과 다를 수 있어 따로 보여준다. */
  share: number;
  shareTitle: string;
  onChange: (v: number) => void;
}) {
  const tipId = `${id}-tip`;
  const rowRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [above, setAbove] = useState(false);
  const active = hover || focus;

  // 아래에 자리가 없으면 위로 띄운다. 그리기 전에 재야 한 번 아래로 떴다가 튀어
  // 오르는 깜빡임이 없다 — 숨겨진 상태(visibility: hidden)에서도 크기는 잴 수 있다.
  useLayoutEffect(() => {
    if (!active) return;
    const row = rowRef.current;
    const tip = tipRef.current;
    if (!row || !tip) return;
    const band = visibleBand(row);
    const r = row.getBoundingClientRect();
    const h = tip.offsetHeight + 4;
    const fitsBelow = r.bottom + h <= band.bottom;
    const fitsAbove = r.top - h >= band.top;
    // 둘 다 안 맞으면 아래를 유지한다 — 스크롤하면 볼 수 있는 쪽이 아래다
    setAbove(!fitsBelow && fitsAbove);
  }, [active]);

  // Esc는 요소가 아니라 문서에서 듣는다 — 마우스로 띄운 툴팁은 포커스가 없어서
  // 요소의 keydown이 오지 않는다. 툴팁이 뜰 수 있는 동안에만 듣는다.
  useEffect(() => {
    if (!active) {
      setDismissed(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);

  const hoverProps = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };

  return (
    <div
      ref={rowRef}
      className="wslider"
      data-tip-dismissed={dismissed || undefined}
      data-tip-above={above || undefined}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
    >
      <label htmlFor={id} className="wslider__label" {...hoverProps}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={0.6}
        step={0.05}
        value={value}
        aria-describedby={tipId}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="wslider__value num" aria-hidden="true">
        {Math.round(value * 100)}
      </span>
      <span className="wslider__share num" title={shareTitle}>
        {Math.round(share * 100)}%
      </span>

      <div id={tipId} ref={tipRef} role="tooltip" className="wslider__tip" {...hoverProps}>
        <div className="wslider__tip-head">
          {/* 제목은 슬라이더의 이름과 같다 — 스크린리더가 두 번 읽지 않게 숨긴다 */}
          <span className="wslider__tip-title" aria-hidden="true">{tip.title}</span>
          <GradeBadge grade={tip.grade} reason={tip.source} size="sm" />
        </div>
        <p className="wslider__tip-def">{tip.def}</p>
        <dl className="wslider__tip-rows">
          <div>
            <dt>{tip.calcLabel}</dt>
            <dd className="num">{tip.calc}</dd>
          </div>
          <div>
            <dt>{tip.sourceLabel}</dt>
            <dd>{tip.source}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
