/**
 * Findex 전국 벤치마크.
 *
 * **주별 데이터가 아니다.** 태국 표본 n=1,000에 지역 식별자가 없어서 쪼갤 수 없다.
 * 이 사실을 패널 제목 옆에 상시 노출한다 — 지도 옆에 붙은 숫자는 주별 값으로 읽히기 쉽다.
 *
 * 왜 그래도 보여주는가: 이 지표들이 **이 도구가 필요한 이유**를 설명하기 때문이다.
 * 전국 계좌보유율이 90%를 넘고 도농·성별·소득 격차가 사실상 닫힌 나라에서
 * "금융포용"을 계좌 수로 측정하면 할 일이 없어 보인다. 남은 격차는 전국 평균이 아니라
 * **어디에 공급이 없는가**에 있고, 그것이 이 지도가 재는 것이다.
 */

import { useMemo } from "react";
import { useI18n } from "@/i18n";
import type { Key } from "@/i18n/strings";

export interface FindexData {
  scope: string;
  not_by_province: boolean;
  as_of: string | null;
  source_url?: string;
  /** ETL이 언어별로 구운 캡션. 옛 산출물은 문자열일 수 있다. */
  sample_note?: string | Record<string, string>;
  series: Record<string, { year: number; value: number }[]>;
}

export interface FindexPanelProps {
  data: FindexData;
}

/** 최신 연도 두 값을 나란히 놓는 비교쌍. 3개 이상 넣지 않는다 — 범주형 3슬롯 규칙. */
const PAIRS: { labelKey: Key; a: [string, Key]; b: [string, Key] }[] = [
  { labelKey: "findex.pair.urbanRural", a: ["account_urban", "findex.pair.urban"], b: ["account_rural", "findex.pair.rural"] },
  { labelKey: "findex.pair.gender",     a: ["account_male", "findex.pair.male"],   b: ["account_female", "findex.pair.female"] },
  { labelKey: "findex.pair.income",     a: ["account_all", "findex.pair.all"],     b: ["account_poorest40", "findex.pair.poorest40"] },
];

export default function FindexPanel({ data }: FindexPanelProps) {
  const { t, lang } = useI18n();
  const trend = data.series.account_all ?? [];
  const sorted = useMemo(
    () => trend.slice().sort((a, b) => a.year - b.year),
    [trend],
  );

  const latestOf = (key: string): { year: number; value: number } | null => {
    const s = data.series[key];
    if (!s?.length) return null;
    return s.slice().sort((a, b) => b.year - a.year)[0]!;
  };

  const borrow = latestOf("borrow_any");
  const mobile = latestOf("mobile_phone");

  return (
    <section className="panel findex" aria-label={t("findex.title")}>
      <header className="findex__head">
        <h2>{t("findex.title")}</h2>
        {/* 이 배지는 장식이 아니다. 지우면 옆의 지도 때문에 주별 값으로 읽힌다. */}
        <span className="chip chip--warn">{t("findex.notByProvince")}</span>
      </header>

      <p className="findex__note">
        {t("findex.note", { year: data.as_of ?? "", sample: pickText(data.sample_note, lang) })}
      </p>

      <section className="findex__block">
        <h3>{t("findex.trend")}</h3>
        <TrendBars points={sorted} />
      </section>

      <section className="findex__block">
        <h3>{t("findex.groups")}</h3>
        <div className="findex__pairs">
          {PAIRS.map((p) => {
            const a = latestOf(p.a[0]);
            const b = latestOf(p.b[0]);
            if (!a || !b) return null;
            const diff = a.value - b.value;
            return (
              <div key={p.labelKey} className="findex__pair">
                <span className="findex__pair-label">{t(p.labelKey)}</span>
                <span className="findex__pair-row">
                  <span>{t(p.a[1])}</span>
                  <span className="num">{a.value.toFixed(1)}%</span>
                </span>
                <span className="findex__pair-row">
                  <span>{t(p.b[1])}</span>
                  <span className="num">{b.value.toFixed(1)}%</span>
                </span>
                <span className="findex__pair-diff num" data-negligible={Math.abs(diff) < 3 || undefined}>
                  {t("findex.diff")} {diff > 0 ? "+" : ""}{diff.toFixed(1)}p
                </span>
              </div>
            );
          })}
        </div>
        <p className="findex__hint">
          <span dangerouslySetInnerHTML={{ __html: t("findex.hint") }} />
        </p>
      </section>

      <div className="findex__stats">
        {borrow ? (
          <Stat label={t("findex.borrow")} value={`${borrow.value.toFixed(1)}%`} year={borrow.year} />
        ) : null}
        {mobile ? (
          <Stat label={t("findex.mobile")} value={`${mobile.value.toFixed(1)}%`} year={mobile.year} />
        ) : null}
      </div>

      {data.source_url ? (
        <a className="findex__link" href={data.source_url} target="_blank" rel="noreferrer noopener">
          {t("findex.link")}
        </a>
      ) : null}
    </section>
  );
}

/** 문자열이면 그대로, 언어별 객체면 골라 쓴다 — 옛 산출물과도 호환된다. */
export function pickText(v: string | Record<string, string> | undefined, lang: string): string {
  if (!v) return "";
  return typeof v === "string" ? v : (v[lang] ?? v.en ?? Object.values(v)[0] ?? "");
}

function Stat({ label, value, year }: { label: string; value: string; year: number }) {
  return (
    <div className="findex__stat">
      <span className="findex__stat-label">{label}</span>
      <span className="findex__stat-value num">{value}</span>
      <span className="findex__stat-year num">{year}</span>
    </div>
  );
}

/**
 * 연도별 막대. 축 없이 값 라벨을 직접 붙인다 —
 * 점 5개짜리 계열에 축을 그리면 잉크가 데이터보다 많아진다.
 */
function TrendBars({ points }: { points: { year: number; value: number }[] }) {
  const { t } = useI18n();
  if (points.length < 2) return <p className="findex__hint">{t("findex.trendInsufficient")}</p>;

  const max = Math.max(...points.map((p) => p.value));
  return (
    <div className="trendbars">
      {points.map((p, i) => {
        const prev = i > 0 ? points[i - 1]!.value : null;
        const down = prev != null && p.value < prev;
        return (
          <div key={p.year} className="trendbars__col">
            <span className="trendbars__value num">{p.value.toFixed(1)}</span>
            <span className="trendbars__bar" style={{ height: `${(p.value / max) * 100}%` }}
                  data-down={down || undefined} />
            <span className="trendbars__year num">{p.year}</span>
          </div>
        );
      })}
    </div>
  );
}
