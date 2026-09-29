/**
 * 랭킹 테이블 — 정렬 · 검색 · CSV 내보내기.
 *
 * 이것은 지도의 보조가 아니라 **지도의 테이블 뷰 대안**이다 (DESIGN.md §7).
 * 색을 못 보거나 스크린리더를 쓰는 사람에게는 이쪽이 주 화면이다.
 * 지도에서 되는 것(주 선택, 값 비교)이 여기서도 전부 돼야 한다.
 *
 * 기본 정렬은 `priority`다. 갭만 보면 인구 20만 주가 위로 오는데,
 * 그건 "고칠 가치가 있는 갭"이 아니다 (METHODOLOGY §6).
 */

import { useMemo, useState, type ReactNode } from "react";
import { ARCHETYPES, PRIORITY_FLOOR } from "@/config/indicators";
import { useI18n, type I18n } from "@/i18n";
import { downloadCsv, toCsv } from "@/lib/csv";
import { isFloor } from "@/lib/scale";
import type { ProvinceRecord, Scored } from "@/lib/score";

type SortKey =
  | "priority" | "gap" | "supply" | "demand"
  | "branches" | "branch_density" | "population" | "credit_deposit";

interface Column {
  key: SortKey | "name" | "archetype";
  labelKey: import("@/i18n/strings").Key;
  numeric: boolean;
  /** 좁은 화면에서 접는다 — 우선순위·갭·이름은 절대 접지 않는다 */
  secondary?: boolean;
  value?: (r: Scored<ProvinceRecord>) => number;
  render: (r: Scored<ProvinceRecord>, i18n: I18n) => ReactNode;
}

const n1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "—");
const n2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "—");

/**
 * 표 정렬 비교 함수. 컴포넌트 밖에 두어 테스트할 수 있게 했다.
 *
 * - 결측은 정렬 방향과 무관하게 항상 아래로 — 위로 올라오면 '값이 낮다'로 오독된다.
 * - **둘 다 결측이면 0.** 예전엔 둘 다 1을 돌려서 비교가 앞뒤가 안 맞았다
 *   (a > b이면서 b > a). 그러면 정렬 결과가 브라우저 구현에 좌우된다.
 * - 동점은 갭으로 가른다. 우선순위는 40개 주가 정확히 0(확장 대상 아님)이라,
 *   가르지 않으면 그 절반이 주 코드 순으로 늘어선다 — 의미 없는 순서다.
 */
export function compareRows(
  get: (r: Scored<ProvinceRecord>) => number | null | undefined,
  asc: boolean,
) {
  const byDir = (x: number, y: number) => (asc ? x - y : y - x);
  const fin = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
  return (a: Scored<ProvinceRecord>, b: Scored<ProvinceRecord>) => {
    const av = get(a);
    const bv = get(b);
    const aOk = fin(av);
    const bOk = fin(bv);
    if (aOk !== bOk) return aOk ? -1 : 1;
    const primary = aOk && bOk ? byDir(av, bv) : 0;
    if (primary !== 0) return primary;
    const ag = fin(a.gap) ? a.gap : -Infinity;
    const bg = fin(b.gap) ? b.gap : -Infinity;
    if (ag === bg) return 0;
    return byDir(ag, bg);
  };
}

const COLUMNS: Column[] = [
  { key: "name", labelKey: "table.col.name", numeric: false,
    render: (r) => (
      <span className="ranktable__name">
        {r.name_en_canonical}
        <span className="ranktable__name-th">{r.name_th}</span>
      </span>
    ) },
  { key: "priority", labelKey: "table.col.priority", numeric: true,
    value: (r) => r.priority,
    // 지도가 "확장 대상 아님"이라고 말하는 주를 표가 "0.0"이라고 말하면 안 된다.
    // 표는 지도의 접근성 대안이다 — 같은 사실을 같은 말로 전해야 한다.
    // "—"도 안 된다. 그건 이 표에서 '결측'의 표시다.
    render: (r, { t }) =>
      isFloor(r.priority, PRIORITY_FLOOR) ? (
        <span className="ranktable__floor" title={t("legend.notTarget")}>{t("notTarget.short")}</span>
      ) : n1(r.priority) },
  { key: "gap", labelKey: "table.col.gap", numeric: true,
    value: (r) => r.gap, render: (r) => n1(r.gap) },
  { key: "supply", labelKey: "table.col.supply", numeric: true, secondary: true,
    value: (r) => r.supply, render: (r) => n1(r.supply) },
  { key: "demand", labelKey: "table.col.demand", numeric: true, secondary: true,
    value: (r) => r.demand, render: (r) => n1(r.demand) },
  { key: "branches", labelKey: "table.col.branches", numeric: true,
    value: (r) => r.branches, render: (r, { n }) => n(r.branches) },
  { key: "branch_density", labelKey: "table.col.branch_density", numeric: true, secondary: true,
    value: (r) => r.branch_density, render: (r) => n1(r.branch_density) },
  { key: "credit_deposit", labelKey: "table.col.credit_deposit", numeric: true, secondary: true,
    value: (r) => r.credit_deposit, render: (r) => n2(r.credit_deposit) },
  { key: "population", labelKey: "table.col.population", numeric: true, secondary: true,
    value: (r) => r.population, render: (r, { n }) => n(r.population) },
  { key: "archetype", labelKey: "table.col.archetype", numeric: false, secondary: true,
    render: (r, { t }) => (r.archetype ? t(ARCHETYPES[r.archetype].labelKey) : "—") },
];

export interface RankTableProps {
  rows: Scored<ProvinceRecord>[];
  selected: string | null;
  onSelect: (code: string | null) => void;
  onHover?: (code: string | null) => void;
  /** 아키타입 열은 디지털 축이 있을 때만 의미가 있다 */
  showArchetype: boolean;
}

export default function RankTable({
  rows, selected, onSelect, onHover, showArchetype,
}: RankTableProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const [sort, setSort] = useState<SortKey>("priority");
  const [asc, setAsc] = useState(false);
  const [query, setQuery] = useState("");

  const columns = useMemo(
    () => COLUMNS.filter((c) => c.key !== "archetype" || showArchetype),
    [showArchetype],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.name_en_canonical.toLowerCase().includes(q) ||
            r.name_th.includes(q) ||
            r.tis1099_code === q,
        )
      : rows;

    const col = COLUMNS.find((c) => c.key === sort);
    const get = col?.value ?? ((r: Scored<ProvinceRecord>) => r.priority);
    return filtered.slice().sort(compareRows(get, asc));
  }, [rows, query, sort, asc]);

  const onHeaderClick = (key: Column["key"]) => {
    if (key === "name" || key === "archetype") return;
    if (key === sort) setAsc((v) => !v);
    else {
      setSort(key);
      setAsc(false);          // 수치 열은 큰 값부터 보는 것이 기본이다
    }
  };

  const exportCsv = () => {
    const headers = [
      "tis1099_code", "name_en", "name_th", "region",
      "priority", "gap", "supply", "demand",
      "branches", "branch_density", "deposits_total", "credits_total",
      "credit_deposit", "population", "gpp_per_capita", "atm_count",
      "digital_readiness", "archetype",
    ];
    const body = visible.map((r) => [
      r.tis1099_code, r.name_en_canonical, r.name_th, r.region_nso,
      r.priority, r.gap, r.supply, r.demand,
      r.branches, r.branch_density, r.deposits_total, r.credits_total,
      r.credit_deposit, Math.round(r.population), r.gpp_per_capita, r.atm_count,
      r.digital_readiness, r.archetype,
    ]);
    downloadCsv("blindspot-th.csv", toCsv(headers, body));
  };

  return (
    <section className="ranktable" aria-label={t("table.aria")}>
      <div className="ranktable__bar">
        <label className="ranktable__search">
          <span className="sr-only">{t("table.searchSr")}</span>
          <input
            type="search"
            value={query}
            placeholder={t("table.search")}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="ranktable__count num">{visible.length} / {rows.length}</span>
        <button type="button" className="ranktable__export" onClick={exportCsv}>
          {t("table.export")}
        </button>
      </div>

      <div className="ranktable__scroll">
        <table>
          <caption className="sr-only">
            {t("table.caption")}
          </caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const sortable = c.key !== "name" && c.key !== "archetype";
                const active = c.key === sort;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    data-numeric={c.numeric || undefined}
                    data-secondary={c.secondary || undefined}
                    aria-sort={active ? (asc ? "ascending" : "descending") : undefined}
                  >
                    {sortable ? (
                      <button type="button" onClick={() => onHeaderClick(c.key)}>
                        {t(c.labelKey)}
                        <span aria-hidden="true" className="ranktable__caret">
                          {active ? (asc ? "▲" : "▼") : ""}
                        </span>
                      </button>
                    ) : (
                      t(c.labelKey)
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody onMouseLeave={() => onHover?.(null)}>
            {visible.map((r) => (
              <tr
                key={r.tis1099_code}
                data-selected={selected === r.tis1099_code || undefined}
                onMouseEnter={() => onHover?.(r.tis1099_code)}
              >
                {columns.map((c, i) => {
                  const content = c.render(r, i18n);
                  return i === 0 ? (
                    <th key={c.key} scope="row" data-secondary={c.secondary || undefined}>
                      <button
                        type="button"
                        className="ranktable__pick"
                        aria-pressed={selected === r.tis1099_code}
                        onClick={() =>
                          onSelect(selected === r.tis1099_code ? null : r.tis1099_code)
                        }
                      >
                        {content}
                      </button>
                    </th>
                  ) : (
                    <td
                      key={c.key}
                      className={c.numeric ? "num" : undefined}
                      data-numeric={c.numeric || undefined}
                      data-secondary={c.secondary || undefined}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {visible.length === 0 ? (
          <p className="ranktable__empty">{t("table.empty", { query })}</p>
        ) : null}
      </div>
    </section>
  );
}
