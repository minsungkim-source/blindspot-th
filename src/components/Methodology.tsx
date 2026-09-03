/**
 * 방법론 패널 — 소스별 기준시점 표 + 이 빌드가 실제로 쓴 지수 정의.
 *
 * METHODOLOGY.md를 렌더하는 대신 **meta.json을 렌더한다.** 이유가 있다.
 * 문서는 '이렇게 만들 계획'이고 meta.json은 '이번 빌드가 실제로 만든 것'이다.
 * 둘이 어긋날 때 화면이 문서를 보여주면 거짓말이 된다 —
 * 지금이 정확히 그 상황이다 (디지털 축: 계획 estimated / 실제 missing).
 *
 * 산식의 서술과 근거는 METHODOLOGY.md에 있고 여기서 링크한다.
 */

import { GRADE_KEY, type Grade } from "@/config/indicators";
import GradeBadge from "@/components/GradeBadge";
import { useI18n } from "@/i18n";

export interface MetaSource {
  as_of?: string | null;
  as_of_label?: string;
  grade?: string;
  url?: string | null;
  license?: string | null;
  from_snapshot?: boolean;
  from_cache?: boolean;
  fingerprint?: { header_hash?: string; province_rows?: number };
}

export interface IndexTerm {
  weight?: number;
  expr?: string;
  invert?: boolean;
  grade?: string;
}

export interface MetaShape {
  generated_at?: string;
  n_units?: number;
  money_unit?: string;
  degraded_sources?: Record<string, string>;
  sources?: Record<string, MetaSource>;
  index?: {
    normalization?: string;
    supply?: Record<string, IndexTerm>;
    demand?: Record<string, IndexTerm>;
    digital?: Record<string, unknown>;
  };
}

export interface MethodologyProps {
  meta: MetaShape;
  docUrl: string;
}

/** ETL의 A·B·C 등급을 화면의 신뢰등급 어휘로 옮긴다. */
const GRADE_MAP: Record<string, Grade> = {
  A: "measured",
  B: "derived",
  C: "estimated",
};

export default function Methodology({ meta, docUrl }: MethodologyProps) {
  const { t } = useI18n();
  const sources = Object.entries(meta.sources ?? {});
  const degraded = meta.degraded_sources ?? {};
  const index = meta.index ?? {};

  return (
    <section className="panel methodology" aria-label={t("method.aria")}>
      <header className="methodology__head">
        <h2>{t("method.title")}</h2>
        <a href={docUrl} target="_blank" rel="noreferrer noopener">METHODOLOGY.md</a>
      </header>

      <p
        className="methodology__note"
        dangerouslySetInnerHTML={{
          __html: t("method.note", {
            when: meta.generated_at
              ? t("method.generated", { at: meta.generated_at.slice(0, 16).replace("T", " ") })
              : "",
          }),
        }}
      />

      <section className="methodology__block">
        <h3>{t("method.sources")}</h3>
        <div className="methodology__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{t("method.col.source")}</th>
                <th scope="col">{t("method.col.asOf")}</th>
                <th scope="col">{t("method.col.grade")}</th>
                <th scope="col">{t("method.col.license")}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(([name, s]) => (
                <tr key={name} data-degraded={name in degraded || undefined}>
                  <th scope="row">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer noopener">{name}</a>
                    ) : name}
                    {s.from_snapshot ? (
                      <span className="chip chip--warn" title={t("method.snapshotWhy")}>
                        {t("method.snapshot")}
                      </span>
                    ) : null}
                    {s.from_cache ? (
                      <span className="chip chip--warn" title={t("method.cacheWhy")}>
                        {t("method.cache")}
                      </span>
                    ) : null}
                  </th>
                  <td className="num">{s.as_of_label ?? s.as_of ?? "—"}</td>
                  <td>
                    {s.grade ? (
                      <GradeBadge grade={GRADE_MAP[s.grade] ?? "missing"} reason={t("method.gradeOrigin", { grade: s.grade })} size="sm" />
                    ) : "—"}
                  </td>
                  <td className="methodology__license">{s.license ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {Object.keys(degraded).length ? (
          <div className="methodology__degraded" role="status">
            <strong>{t("method.degraded")}</strong>
            <ul>
              {Object.entries(degraded).map(([name, reason]) => (
                // 예외 메시지 원문은 진단용이라 번역하지 않는다. 화면에는 번역된 요약만
                // 내보내고 원문은 title로 남긴다 — 영어 화면에 한국어 스택 메시지가
                // 그대로 찍히는 것보다 낫고, 필요한 사람은 여전히 볼 수 있다.
                <li key={name} title={reason}>
                  <span className="num">{name}</span> — {t("method.unavailable")}
                </li>
              ))}
            </ul>
            <p dangerouslySetInnerHTML={{ __html: t("method.degradedBody") }} />
          </div>
        ) : null}
      </section>

      <section className="methodology__block">
        <h3>
          {t("method.index")}
          {index.normalization ? <span className="chip num">{index.normalization}</span> : null}
        </h3>
        <div className="methodology__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{t("method.col.axis")}</th>
                <th scope="col">{t("method.col.item")}</th>
                <th scope="col">{t("method.col.weight")}</th>
                <th scope="col">{t("method.col.expr")}</th>
              </tr>
            </thead>
            <tbody>
              {(["supply", "demand"] as const).flatMap((axis) =>
                Object.entries(index[axis] ?? {}).map(([key, term]) => (
                  <tr key={`${axis}-${key}`}>
                    <td>{t(axis === "supply" ? "method.axis.supply" : "method.axis.demand")}</td>
                    <th scope="row">{key}</th>
                    <td className="num">{term.weight != null ? term.weight.toFixed(2) : "—"}</td>
                    <td className="methodology__expr num">
                      {term.expr ?? "—"}
                      {term.invert ? <span className="chip">{t("method.invert")}</span> : null}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="methodology__hint">
          {t("method.indexHint")}
        </p>
      </section>

      {index.digital ? (
        <section className="methodology__block">
          <h3>{t("method.digital")}</h3>
          <dl className="methodology__kv">
            {Object.entries(index.digital).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd className="num">{String(v)}</dd>
              </div>
            ))}
          </dl>
          {index.digital.confidence === "missing" ? (
            <p
              className="methodology__hint"
              dangerouslySetInnerHTML={{
                __html: t("method.digitalMismatch", {
                  planned: String(index.digital.confidence_planned ?? "estimated"),
                }),
              }}
            />
          ) : null}
        </section>
      ) : null}

      <p className="methodology__hint">
        {t("method.units", {
          unit: meta.money_unit === "baht" ? t("method.baht") : (meta.money_unit ?? "—"),
          n: meta.n_units ?? "—",
          estimated: t(GRADE_KEY.estimated),
        })}
      </p>
    </section>
  );
}
