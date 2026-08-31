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

import { GRADE_LABEL, type Grade } from "@/config/indicators";
import GradeBadge from "@/components/GradeBadge";

export interface MetaSource {
  as_of?: string | null;
  as_of_label?: string;
  grade?: string;
  url?: string | null;
  license?: string | null;
  from_snapshot?: boolean;
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
  const sources = Object.entries(meta.sources ?? {});
  const degraded = meta.degraded_sources ?? {};
  const index = meta.index ?? {};

  return (
    <section className="panel methodology" aria-label="방법론">
      <header className="methodology__head">
        <h2>방법론과 데이터 계보</h2>
        <a href={docUrl} target="_blank" rel="noreferrer noopener">METHODOLOGY.md</a>
      </header>

      <p className="methodology__note">
        아래는 문서가 아니라 <strong>이번 빌드가 실제로 사용한 값</strong>이다
        {meta.generated_at ? <> (생성 <span className="num">{meta.generated_at.slice(0, 16).replace("T", " ")}</span> UTC)</> : null}.
        문서와 어긋나면 이쪽이 사실이다.
      </p>

      <section className="methodology__block">
        <h3>소스별 기준시점</h3>
        <div className="methodology__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">소스</th>
                <th scope="col">기준시점</th>
                <th scope="col">등급</th>
                <th scope="col">라이선스</th>
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
                      <span className="chip chip--warn" title="네트워크 대신 저장된 응답을 재사용했다">
                        스냅샷
                      </span>
                    ) : null}
                  </th>
                  <td className="num">{s.as_of_label ?? s.as_of ?? "—"}</td>
                  <td>
                    {s.grade ? (
                      <GradeBadge grade={GRADE_MAP[s.grade] ?? "missing"} reason={`원 등급 ${s.grade}`} size="sm" />
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
            <strong>이번 빌드에서 확보하지 못한 소스</strong>
            <ul>
              {Object.entries(degraded).map(([name, reason]) => (
                <li key={name}>
                  <span className="num">{name}</span> — {reason}
                </li>
              ))}
            </ul>
            <p>
              해당 지표는 <strong>결측으로</strong> 남았다. 0으로 채우지 않으며, 가중합에서 빠지고
              남은 지표끼리 재정규화된다.
            </p>
          </div>
        ) : null}
      </section>

      <section className="methodology__block">
        <h3>
          지수 정의
          {index.normalization ? <span className="chip num">{index.normalization}</span> : null}
        </h3>
        <div className="methodology__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">축</th>
                <th scope="col">항목</th>
                <th scope="col">기본 가중치</th>
                <th scope="col">산식</th>
              </tr>
            </thead>
            <tbody>
              {(["supply", "demand"] as const).flatMap((axis) =>
                Object.entries(index[axis] ?? {}).map(([key, term]) => (
                  <tr key={`${axis}-${key}`}>
                    <td>{axis === "supply" ? "공급" : "수요"}</td>
                    <th scope="row">{key}</th>
                    <td className="num">{term.weight != null ? term.weight.toFixed(2) : "—"}</td>
                    <td className="methodology__expr num">
                      {term.expr ?? "—"}
                      {term.invert ? <span className="chip">역방향</span> : null}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="methodology__hint">
          가중치는 기본값이다. 화면의 슬라이더를 움직이면 브라우저가 같은 산식으로 다시 계산한다
          (ETL의 <span className="num">figi.py</span>와 <span className="num">score.ts</span>가
          같은 결과를 내는지는 CI의 패리티 테스트가 지킨다).
        </p>
      </section>

      {index.digital ? (
        <section className="methodology__block">
          <h3>디지털 준비도</h3>
          <dl className="methodology__kv">
            {Object.entries(index.digital).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd className="num">{String(v)}</dd>
              </div>
            ))}
          </dl>
          {index.digital.confidence === "missing" ? (
            <p className="methodology__hint">
              <strong>계획({String(index.digital.confidence_planned ?? "estimated")})과 실제(missing)가 다르다.</strong>{" "}
              권역별 ICT 이용률과 주별 도시화율을 모두 확보하지 못해 이 축은 계산되지 않았다.
              추정 위에 추정을 쌓지 않기로 한 결정이다.
            </p>
          ) : null}
        </section>
      ) : null}

      <p className="methodology__hint">
        금액 단위는 {meta.money_unit === "baht" ? "바트" : (meta.money_unit ?? "—")},
        분석 단위는 주 <span className="num">{meta.n_units ?? "—"}</span>개다.
        {GRADE_LABEL.estimated} 등급 지표는 지도의 색 채널을 차지하지 않는다.
      </p>
    </section>
  );
}
