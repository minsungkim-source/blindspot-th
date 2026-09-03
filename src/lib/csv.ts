/**
 * CSV 내보내기.
 *
 * 이 도구의 결과는 대부분 슬라이드나 스프레드시트로 옮겨간다. 내보내기가 없으면
 * 사람들이 화면을 캡처해서 숫자를 손으로 옮기고, 그 과정에서 틀린다.
 *
 * Excel이 UTF-8을 자동 인식하지 못해 태국어·한국어가 깨지므로 BOM을 붙인다.
 */

const BOM = "﻿";

function cell(v: unknown): string {
  if (v == null || (typeof v === "number" && !Number.isFinite(v))) return "";
  const s = String(v);
  // 쉼표·따옴표·줄바꿈이 있으면 감싸고, 내부 따옴표는 두 번 쓴다 (RFC 4180)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return BOM + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
