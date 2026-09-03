/**
 * 신뢰등급 배지 — 실측 / 가공 / 추정 / 없음.
 *
 * **색 단독으로 의미를 전달하지 않는다** (DESIGN.md §7). 항상 텍스트가 함께 간다.
 * 색은 보조 신호일 뿐이고, 색을 못 보는 사람도 라벨만으로 등급을 안다.
 */

import { GRADE_COLOR, GRADE_LABEL, type Grade } from "@/config/indicators";

export interface GradeBadgeProps {
  grade: Grade;
  /** 등급이 왜 그런지. 툴팁으로 붙는다 (예: "권역값 하향 추정"). */
  reason?: string;
  size?: "sm" | "md";
}

export default function GradeBadge({ grade, reason, size = "md" }: GradeBadgeProps) {
  const label = GRADE_LABEL[grade];
  // md는 기본값이라 수식자를 붙이지 않는다 — 정의 없는 클래스를 남기지 않는다
  const className = size === "md" ? "grade" : `grade grade--${size}`;

  return (
    <span
      className={className}
      title={reason ? `${label} — ${reason}` : label}
      data-grade={grade}
    >
      <span className="grade__dot" style={{ background: GRADE_COLOR[grade] }} aria-hidden="true" />
      {label}
    </span>
  );
}
