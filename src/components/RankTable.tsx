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
import { ARCHETYPES } from "@/config/indicators";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { ProvinceRecord, Scored } from "@/lib/score";

type SortKey =
  | "priority" | "gap" | "supply" | "demand"
  | "branches" | "branch_density" | "population" | "credit_deposit";

interface Column {
  key: SortKey | "name" | "archetype";
  label: string;
  numeric: boolean;
  /** 좁은 화면에서 접는다 — 우선순위·갭·이름은 절대 접지 않는다 */
  secondary?: boolean;
  value?: (r: Scored<ProvinceRecord>) => number;
  render: (r: Scored<ProvinceRecord>) => ReactNode;
}

const n0 = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString("ko-KR") : "—");
const n1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "—");
const n2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "—");

const COLUMNS: Column[] = [
  { key: "name", label: "주", numeric: false,
    render: (r) => (
      <span className="ranktable__name">
        {r.name_en_canonical}
        <span className="ranktable__name-th">{r.name_th}</span>
      </span>
    ) },
  { key: "priority", label: "우선순위", numeric: true,
    value: (r) => r.priority, render: (r) => n1(r.priority) },
  { key: "gap", label: "갭", numeric: true,
    value: (r) => r.gap, render: (r) => n1(r.gap) },
  { key: "supply", label: "공급", numeric: true, secondary: true,
    value: (r) => r.supply, render: (r) => n1(r.supply) },
  { key: "demand", label: "수요", numeric: true, secondary: true,
    value: (r) => r.demand, render: (r) => n1(r.demand) },
  { key: "branches", label: "지점", numeric: true,
    value: (r) => r.branches, render: (r) => n0(r.branches) },
  { key: "branch_density", label: "지점밀도", numeric: true, secondary: true,
    value: (r) => r.branch_density, render: (r) => n1(r.branch_density) },
  { key: "credit_deposit", label: "예대율", numeric: true, secondary: true,
    value: (r) => r.credit_deposit, render: (r) => n2(r.credit_deposit) },
  { key: "population", label: "인구", numeric: true, secondary: true,
    value: (r) => r.population, render: (r) => n0(r.population) },
  { key: "archetype", label: "아키타입", numeric: false, secondary: true,
    render: (r) => (r.archetype ? ARCHETYPES[r.archetype].label : "—") },
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
    return filtered.slice().sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      // 결측은 정렬 방향과 무관하게 항상 아래로 — 위로 올라오면 '값이 낮다'로 오독된다
      if (!Number.isFinite(av)) return 1;
      if (!Number.isFinite(bv)) return -1;
      return asc ? av - bv : bv - av;
    });
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
    <section className="ranktable" aria-label="주별 랭킹">
      <div className="ranktable__bar">
        <label className="ranktable__search">
          <span className="sr-only">주 이름으로 검색</span>
          <input
            type="search"
            value={query}
            placeholder="주 이름 검색"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="ranktable__count num">{visible.length} / {rows.length}</span>
        <button type="button" className="ranktable__export" onClick={exportCsv}>
          CSV 내보내기
        </button>
      </div>

      <div className="ranktable__scroll">
        <table>
          <caption className="sr-only">
            주별 우선순위·갭·공급·수요. 열 제목을 눌러 정렬할 수 있습니다.
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
                        {c.label}
                        <span aria-hidden="true" className="ranktable__caret">
                          {active ? (asc ? "▲" : "▼") : ""}
                        </span>
                      </button>
                    ) : (
                      c.label
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
                  const content = c.render(r);
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
          <p className="ranktable__empty">‘{query}’와 일치하는 주가 없습니다.</p>
        ) : null}
      </div>
    </section>
  );
}
