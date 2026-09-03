/**
 * 지도 범례.
 *
 * 순차 램프는 색 띠 + 양끝 값. 발산형은 중간값 눈금을 반드시 표시한다 —
 * 중간값이 어디인지 모르면 두 색이 무엇을 가르는지 알 수 없다 (DESIGN.md §5).
 *
 * 계열이 2개 이상이면 범례는 항상 존재한다. 여기에는 "데이터 없음" 칸도 포함된다 —
 * 회색 폴리곤을 보고 '값이 낮은 것'으로 오해하는 것을 막는 것이 이 칸의 목적이다.
 */

import { DIVERGING, NO_DATA, SEQUENTIAL } from "@/lib/scale";
import { useI18n } from "@/i18n";

export interface LegendProps {
  label: string;
  scale: "sequential" | "diverging";
  /** 램프 양끝에 적을 값. 이미 포맷된 문자열. */
  min: string;
  max: string;
  /** 발산형에서만. 중간값 라벨 (보통 전국 평균). */
  midpoint?: string;
  /** 데이터 없는 주가 실제로 있을 때만 칸을 낸다. */
  hasMissing?: boolean;
}

export default function Legend({
  label, scale, min, max, midpoint, hasMissing,
}: LegendProps) {
  const { t } = useI18n();
  const ramp = scale === "diverging" ? DIVERGING : SEQUENTIAL;

  return (
    <div className="legend">
      <div className="legend__label">{label}</div>

      <div className="legend__ramp-row">
        <span className="legend__end num">{min}</span>
        <div className="legend__ramp" role="img" aria-label={t("legend.aria", { layer: label, min, max })}>
          {ramp.map((c) => (
            <span key={c} className="legend__step" style={{ background: c }} />
          ))}
          {scale === "diverging" && midpoint ? (
            <span className="legend__tick" aria-hidden="true" />
          ) : null}
        </div>
        <span className="legend__end num">{max}</span>
      </div>

      {scale === "diverging" && midpoint ? (
        <div className="legend__mid">
          {t("legend.midpoint")} <span className="num">{midpoint}</span>
        </div>
      ) : null}

      {hasMissing ? (
        <div className="legend__missing">
          <span className="legend__swatch" style={{ background: NO_DATA }} aria-hidden="true" />
          {t("legend.noData")}
        </div>
      ) : null}
    </div>
  );
}
