/**
 * 선택된 주가 **지금 화면에 있는 주**인가.
 *
 * 두 가지로 어긋났었다.
 * - 방콕을 선택한 채 "방콕 제외"를 켜면 상세 패널은 사라지는데 주소에 `sel=10`이 남고,
 *   지도의 방콕은 여전히 "선택됨"이었다. 스크린리더는 "눌림, 현재 분석에서 제외됨"이라는
 *   모순된 문장을 읽었다
 * - 없는 주 코드(`sel=99`)가 들어오면 화면은 빈 상태로 잘 처리했지만 주소에 그대로 남아
 *   공유 링크로 퍼졌다
 *
 * 주소가 곧 상태이고 링크로 주고받는 도구라, 보이지 않는 선택이 주소에 남으면 안 된다.
 * 데이터가 있어야 판단할 수 있으므로 urlState가 아니라 데이터를 받은 쪽에서 정리한다.
 */
export function validSelection(
  selected: string | null,
  codes: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
): string | null {
  if (selected == null) return null;
  if (!codes.has(selected) || excluded.has(selected)) return null;
  return selected;
}
