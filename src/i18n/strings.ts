/**
 * 화면 문구의 단일 출처. 한국어·영어 두 벌.
 *
 * 왜 사전으로 모으는가 — 문구가 컴포넌트에 흩어져 있으면 언어를 하나 더 붙일 때마다
 * 11개 파일을 뒤져야 하고, 반드시 몇 개를 빠뜨린다. 여기 없는 문구는 화면에 없다.
 *
 * **번역이 아니라 같은 말의 두 판본이다.** 영어판은 한국어를 그대로 옮긴 것이 아니라
 * 영어로 읽었을 때 자연스러운 표현을 쓴다 (예: "갭 낮음" → "Lower gap").
 *
 * 코드 주석은 한국어로 둔다 — 개발자를 위한 것이고 화면에 나가지 않는다.
 */

export type Lang = "ko" | "en";

export const LANGS: { id: Lang; label: string }[] = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
];

/** ko를 기준 형태로 두고 en이 같은 키를 채우게 강제한다 — 키가 빠지면 타입 오류다. */
const ko = {
  // ── 헤더와 소개 ──────────────────────────────────────────────
  "app.title": "Blindspot TH",
  "app.tagline": "태국 77개 주 금융포용 갭",
  "app.docTitle": "Blindspot TH — 태국 77개 주 금융포용 갭 맵",
  "app.docDesc": "태국 77개 주의 금융 공급과 수요의 격차를 지수화하고, 에이전트·키오스크·지점 확장 우선순위를 보여주는 지도.",
  "app.intro.lead": "은행이 없는 곳은 어디이고, 그중 사람이 사는 곳은 어디인가.",
  "app.intro.body":
    "태국 77개 주의 금융 <b>공급</b>(은행 지점·예수신·ATM)과 <b>수요</b>(인구·소득·원격성·현금경제)를 " +
    "각각 백분위로 환산해 그 격차를 지수화한다. 갭이 큰 주는 필요에 비해 접점이 모자란 곳이고, " +
    "우선순위는 거기에 인구 규모를 곱해 <b>고칠 가치가 있는 갭</b>을 앞으로 보낸 값이다.",
  "app.intro.usage":
    "가중치는 화면에서 바꿀 수 있고 그 상태가 주소에 담긴다 — 조정한 화면을 링크로 그대로 주고받으면 된다.",
  "app.intro.sources": "출처는 전부 공개 데이터다. 모든 수치에 기준시점과 신뢰등급이 붙는다.",
  "app.layer": "레이어",
  "app.excludeBangkok": "방콕 제외",
  "app.language": "언어",

  "app.notice.digital.title": "디지털 준비도 축이 비어 있습니다.",
  "app.notice.digital.body":
    "권역별 ICT 이용률과 주별 도시화율을 공개 소스에서 확보하지 못해 v1에서는 계산하지 않습니다. " +
    "사분면과 아키타입 분류가 비활성 상태이며, 갭·우선순위·랭킹은 영향을 받지 않습니다.",
  "app.empty": "지도나 표에서 주를 선택하면 상세가 여기 표시됩니다.",
  "app.loading": "불러오는 중…",
  "app.error": "데이터 파일이 없습니다. etl/build.py를 실행하거나 npm run data:sync를 먼저 돌리세요.",

  // ── 지도 레이어 ──────────────────────────────────────────────
  "layer.gap": "갭 점수",
  "layer.priority": "우선순위",
  "layer.branch_density": "지점 밀도",
  "layer.deposit_per_capita": "1인당 예금",
  "layer.credit_deposit": "예대율",
  "layer.unit.perPop": "개/10만명",
  "layer.unit.times": "배",

  // ── 지도 ────────────────────────────────────────────────────
  "map.aria": "태국 77개 주 {layer} 지도. 각 주는 탭으로 이동할 수 있습니다.",
  "map.excluded": "현재 분석에서 제외됨",
  "map.noData": "데이터 없음",
  "map.provinceCode": "주 코드 {code}",

  // ── 범례 ────────────────────────────────────────────────────
  "legend.aria": "{layer} 색 범례: {min}부터 {max}까지",
  "legend.midpoint": "중간값",
  "legend.noData": "데이터 없음",

  // ── 신뢰등급 ─────────────────────────────────────────────────
  "grade.measured": "실측",
  "grade.derived": "가공",
  "grade.estimated": "추정",
  "grade.missing": "없음",

  // ── 랭킹 테이블 ──────────────────────────────────────────────
  "table.col.name": "주",
  "table.col.priority": "우선순위",
  "table.col.gap": "갭",
  "table.col.supply": "공급",
  "table.col.demand": "수요",
  "table.col.branches": "지점",
  "table.col.branch_density": "지점밀도",
  "table.col.credit_deposit": "예대율",
  "table.col.population": "인구",
  "table.col.archetype": "아키타입",
  "table.search": "주 이름 검색",
  "table.searchSr": "주 이름으로 검색",
  "table.export": "CSV 내보내기",
  "table.empty": "‘{query}’와 일치하는 주가 없습니다.",
  "table.caption": "주별 우선순위·갭·공급·수요. 열 제목을 눌러 정렬할 수 있습니다.",
  "table.aria": "주별 랭킹",

  // ── 주 상세 ──────────────────────────────────────────────────
  "panel.aria": "{name} 상세",
  "panel.close": "상세 닫기",
  "panel.score.priority": "우선순위",
  "panel.score.gap": "갭",
  "panel.score.supply": "공급",
  "panel.score.demand": "수요",
  "panel.archetypeUnavailable": "아키타입 분류 불가",
  "panel.archetypeUnavailableWhy": "디지털 축이 결측이라 분류하지 않는다",
  "panel.trend": "지점 수 추이",
  "panel.trendInsufficient": "시계열이 부족해 추이를 그리지 않는다.",
  "panel.trendAria": "{from}부터 {to}까지 지점 수 {first}개에서 {last}개로 변화",
  "panel.position": "전국 대비 위치",
  "panel.positionHint":
    "백분위 0–100. 공급은 높을수록 잘 갖춰진 것, 수요는 높을수록 필요가 큰 것이다.",
  "panel.positionAria": "{label} 백분위 {value}",
  "panel.raw": "원값",
  "panel.digital": "디지털 준비도",
  "panel.digitalWhy": "주 단위 원본 없음 — DATA_SOURCES.md의 '디지털 축' 절",
  "panel.digitalMissing":
    "v1에서는 이 축이 비어 있다. 권역별 ICT 이용률과 주별 도시화율을 모두 확보하지 못했고, " +
    "추정 위에 추정을 쌓지 않기로 했다.",

  // ── 가중치 ───────────────────────────────────────────────────
  "weights.title": "가중치",
  "weights.reset": "초기화",
  "weights.presets": "프리셋",
  "weights.custom": "사용자 조정",
  "weights.hint":
    "합이 100이 아니어도 됩니다. 계산 직전에 비율로 정규화하므로 상대 크기만 의미가 있습니다.",
  "weights.supplyAxis": "공급 축",
  "weights.demandAxis": "수요 축",
  "weights.sum": "합",
  "weights.share": "재정규화 후 실제 반영 비율",
  "weights.error":
    "한 축의 가중치를 전부 0으로 두면 점수를 계산할 수 없습니다. 하나 이상 올려 주세요.",

  "preset.balanced": "균형",
  "preset.balanced.note": "기본값",
  "preset.scale_first": "규모 우선",
  "preset.scale_first.note": "큰 시장부터",
  "preset.remote_first": "원격지 우선",
  "preset.remote_first.note": "이동거리 중심",
  "preset.credit_gap": "신용 갈증",
  "preset.credit_gap.note": "대출 상품 화이트스페이스",

  // ── Findex ──────────────────────────────────────────────────
  "findex.title": "전국 벤치마크",
  "findex.notByProvince": "주별 아님 · 전국 단위",
  "findex.note": "World Bank Global Findex {year}. {sample}",
  "findex.trend": "계좌 보유율 추이",
  "findex.trendInsufficient": "추이를 그릴 만큼의 조사 회차가 없다.",
  "findex.groups": "집단 간 차이 (최신)",
  "findex.diff": "차이",
  "findex.pair.urbanRural": "도농",
  "findex.pair.urban": "도시",
  "findex.pair.rural": "농촌",
  "findex.pair.gender": "성별",
  "findex.pair.male": "남성",
  "findex.pair.female": "여성",
  "findex.pair.income": "소득",
  "findex.pair.all": "전체",
  "findex.pair.poorest40": "하위 40%",
  "findex.hint":
    "최신 조사 기준 세 격차 모두 3%p 안팎이다. <b>계좌 보유로 재는 포용은 태국에서 이미 닫혔다</b> — " +
    "남은 문제는 전국 평균이 아니라 물리적 접점이 어디에 없는가이고, 그것이 이 도구가 재는 것이다.",
  "findex.borrow": "공식 차입 경험",
  "findex.mobile": "휴대전화 보유",
  "findex.link": "Global Findex 보고서",

  // ── 방법론 ───────────────────────────────────────────────────
  "method.title": "방법론과 데이터 계보",
  "method.aria": "방법론",
  "method.note":
    "아래는 문서가 아니라 <b>이번 빌드가 실제로 사용한 값</b>이다{when}. 문서와 어긋나면 이쪽이 사실이다.",
  "method.generated": " (생성 {at} UTC)",
  "method.sources": "소스별 기준시점",
  "method.col.source": "소스",
  "method.col.asOf": "기준시점",
  "method.col.grade": "등급",
  "method.col.license": "라이선스",
  "method.snapshot": "스냅샷",
  "method.snapshotWhy": "네트워크 대신 저장된 응답을 재사용했다",
  "method.cache": "캐시",
  "method.cacheWhy": "라이브 실패로 저장된 워크북을 재사용했다",
  "method.gradeOrigin": "원 등급 {grade}",
  "method.degraded": "이번 빌드에서 확보하지 못한 소스",
  "method.unavailable": "확보 실패 (자세한 사유는 항목 위에 마우스를 올리면 보인다)",
  "method.degradedBody":
    "해당 지표는 <b>결측으로</b> 남았다. 0으로 채우지 않으며, 가중합에서 빠지고 남은 지표끼리 재정규화된다.",
  "method.index": "지수 정의",
  "method.col.axis": "축",
  "method.col.item": "항목",
  "method.col.weight": "기본 가중치",
  "method.col.expr": "산식",
  "method.axis.supply": "공급",
  "method.axis.demand": "수요",
  "method.invert": "역방향",
  "method.indexHint":
    "가중치는 기본값이다. 화면의 슬라이더를 움직이면 브라우저가 같은 산식으로 다시 계산한다 " +
    "(ETL의 figi.py와 score.ts가 같은 결과를 내는지는 CI의 패리티 테스트가 지킨다).",
  "method.digital": "디지털 준비도",
  "method.digitalMismatch":
    "<b>계획({planned})과 실제(missing)가 다르다.</b> 권역별 ICT 이용률과 주별 도시화율을 " +
    "모두 확보하지 못해 이 축은 계산되지 않았다. 추정 위에 추정을 쌓지 않기로 한 결정이다.",
  "method.units":
    "금액 단위는 {unit}, 분석 단위는 주 {n}개다. {estimated} 등급 지표는 지도의 색 채널을 차지하지 않는다.",
  "method.baht": "바트",

  // ── 푸터 ─────────────────────────────────────────────────────
  "footer.title": "데이터 출처",
  "footer.repo": "저장소",
  "footer.code": "코드 {license}",
  "footer.generated": " · 데이터 생성 {date}",
  "footer.disclaimer":
    "데이터는 각 출처의 라이선스를 따른다. 지수와 순위는 이 도구의 해석이며 출처 기관의 견해가 아니다.",

  // ── 공유 ─────────────────────────────────────────────────────
  "share.copy": "링크 복사",
  "share.copied": "복사됨",
  "share.copiedSr": "현재 화면 링크를 클립보드에 복사했습니다.",
  "share.failedSr": "클립보드에 접근하지 못했습니다. 주소를 직접 복사하세요.",
  "share.fallback": "공유 링크 (직접 복사)",

  // ── 지표 ─────────────────────────────────────────────────────
  "ind.branches": "지점 수",
  "ind.branch_density": "지점 밀도",
  "ind.geographic_access": "지리적 접근성",
  "ind.deposit_per_capita": "1인당 예금",
  "ind.credit_per_capita": "1인당 여신",
  "ind.atm_density": "ATM 밀도",
  "ind.population": "인구",
  "ind.gpp_per_capita": "1인당 GPP",
  "ind.population_density": "인구밀도",
  "ind.gpp_agriculture_share": "농림어업 비중",
  "ind.credit_deposit": "예대율",
  "ind.digital_readiness": "디지털 준비도",

  "unit.count": "개",
  "unit.perPop": "개/10만명",
  "unit.perArea": "개/1,000km²",
  "unit.baht": "바트",
  "unit.people": "명",
  "unit.perKm2": "명/km²",
  "unit.percent": "%",
  "unit.times": "배",
  "unit.point": "점",

  // ── 가중치 항목 ──────────────────────────────────────────────
  "w.branch_density": "지점 밀도",
  "w.geographic_access": "지리적 접근성",
  "w.deposit_penetration": "예금 침투",
  "w.credit_penetration": "신용 침투",
  "w.atm_density": "ATM 밀도",
  "w.population_scale": "인구 규모",
  "w.income_downside": "소득 하방",
  "w.dispersion": "분산 거주",
  "w.cash_economy": "현금경제 비중",
  "w.credit_thirst": "신용 갈증",

  // ── 아키타입 ─────────────────────────────────────────────────
  "arch.agent_kiosk": "에이전트 · 키오스크",
  "arch.agent_kiosk.action": "에이전트 리크루팅, 키오스크 배치, 캐시인/아웃 유동성",
  "arch.digital_first": "디지털 우선",
  "arch.digital_first.action": "원격 KYC, 앱 획득 캠페인, 디지털 대출 파일럿",
  "arch.retain_crosssell": "유지 · 크로스셀",
  "arch.retain_crosssell.action": "상품 침투 확대, 저예대율이면 대출 푸시",
  "arch.watch": "관망",
  "arch.watch.action": "분기별 재평가, 인접 주 확장의 부수 효과",

  // ── 출처가 제공하는 것 (푸터) ────────────────────────────────
  "src.bot": "주별 지점 수 · 예금 · 여신 · 예대율",
  "src.nesdc": "주별 GPP · 인구 · 산업구성",
  "src.nso": "권역별 ICT 이용률 (디지털 준비도 추정의 원자료)",
  "src.findex": "전국 벤치마크 (주별 아님)",
  "src.osm": "ATM · 은행 POI",
  "src.crosswalk": "행정구역 크로스워크 · 경계 폴리곤 · 면적",

  "lic.bot": "귀속 표기 · 집계 형태 게시",
  "lic.attribution": "귀속 표기",
  "lic.findex": "집계 지표만 사용 · 마이크로데이터 미포함",
  "lic.odbl": "ODbL 1.0",
  "lic.crosswalk": "CC BY 4.0 · 폴리곤 CC BY 3.0 IGO",
};

export type Key = keyof typeof ko;

const en: Record<Key, string> = {
  "app.title": "Blindspot TH",
  "app.tagline": "Financial inclusion gap across Thailand's 77 provinces",
  "app.docTitle": "Blindspot TH — Thailand financial inclusion gap map",
  "app.docDesc": "Maps the gap between financial supply and demand across Thailand's 77 provinces, to prioritise agent, kiosk and branch expansion.",
  "app.intro.lead": "Where are the banks missing — and of those places, where do people actually live?",
  "app.intro.body":
    "This maps financial <b>supply</b> (bank branches, deposits, credit, ATMs) against " +
    "<b>demand</b> (population, income, remoteness, cash economy) for each of Thailand's 77 provinces, " +
    "converts both to percentiles, and indexes the distance between them. A high gap means a province " +
    "has less access than its need implies. Priority weights that gap by population, pushing " +
    "<b>the gaps worth fixing</b> to the top.",
  "app.intro.usage":
    "The weights are yours to change, and the state travels in the URL — adjust the view, then share the link as-is.",
  "app.intro.sources":
    "Every source is public data. Each figure carries its as-of date and a confidence grade.",
  "app.layer": "Layer",
  "app.excludeBangkok": "Exclude Bangkok",
  "app.language": "Language",

  "app.notice.digital.title": "The digital-readiness axis is empty.",
  "app.notice.digital.body":
    "Neither regional ICT usage nor province-level urbanisation was obtainable from a public source, " +
    "so v1 does not compute it. The quadrant and archetype classification are disabled; " +
    "gap, priority and the ranking are unaffected.",
  "app.empty": "Select a province on the map or in the table to see its detail here.",
  "app.loading": "Loading…",
  "app.error": "Data files are missing. Run etl/build.py, or npm run data:sync, first.",

  "layer.gap": "Gap score",
  "layer.priority": "Priority",
  "layer.branch_density": "Branch density",
  "layer.deposit_per_capita": "Deposits per capita",
  "layer.credit_deposit": "Credit-to-deposit",
  "layer.unit.perPop": " per 100k people",
  "layer.unit.times": "×",

  "map.aria": "Map of Thailand's 77 provinces showing {layer}. Each province is reachable by Tab.",
  "map.excluded": "excluded from the current analysis",
  "map.noData": "no data",
  "map.provinceCode": "Province code {code}",

  "legend.aria": "{layer} colour legend, from {min} to {max}",
  "legend.midpoint": "Midpoint",
  "legend.noData": "No data",

  "grade.measured": "Measured",
  "grade.derived": "Derived",
  "grade.estimated": "Estimated",
  "grade.missing": "None",

  "table.col.name": "Province",
  "table.col.priority": "Priority",
  "table.col.gap": "Gap",
  "table.col.supply": "Supply",
  "table.col.demand": "Demand",
  "table.col.branches": "Branches",
  "table.col.branch_density": "Br. density",
  "table.col.credit_deposit": "C/D ratio",
  "table.col.population": "Population",
  "table.col.archetype": "Archetype",
  "table.search": "Search provinces",
  "table.searchSr": "Search by province name",
  "table.export": "Export CSV",
  "table.empty": "No province matches “{query}”.",
  "table.caption":
    "Priority, gap, supply and demand by province. Select a column header to sort.",
  "table.aria": "Province ranking",

  "panel.aria": "{name} detail",
  "panel.close": "Close detail",
  "panel.score.priority": "Priority",
  "panel.score.gap": "Gap",
  "panel.score.supply": "Supply",
  "panel.score.demand": "Demand",
  "panel.archetypeUnavailable": "Archetype unavailable",
  "panel.archetypeUnavailableWhy": "Not classified — the digital axis is missing",
  "panel.trend": "Branch count trend",
  "panel.trendInsufficient": "Too few periods to draw a trend.",
  "panel.trendAria": "From {from} to {to}, branch count moved from {first} to {last}",
  "panel.position": "Position against the national distribution",
  "panel.positionHint":
    "Percentile 0–100. Higher supply means better served; higher demand means greater need.",
  "panel.positionAria": "{label} percentile {value}",
  "panel.raw": "Raw values",
  "panel.digital": "Digital readiness",
  "panel.digitalWhy": "No province-level source — see the “digital axis” section of DATA_SOURCES.md",
  "panel.digitalMissing":
    "This axis is empty in v1. Neither regional ICT usage nor province-level urbanisation " +
    "was obtainable, and we chose not to stack an estimate on an estimate.",

  "weights.title": "Weights",
  "weights.reset": "Reset",
  "weights.presets": "Presets",
  "weights.custom": "Custom",
  "weights.hint":
    "These need not sum to 100. They are normalised to proportions before scoring, so only relative size matters.",
  "weights.supplyAxis": "Supply axis",
  "weights.demandAxis": "Demand axis",
  "weights.sum": "sum",
  "weights.share": "Actual share after normalisation",
  "weights.error":
    "An axis with every weight at zero cannot be scored. Raise at least one.",

  "preset.balanced": "Balanced",
  "preset.balanced.note": "Default",
  "preset.scale_first": "Scale first",
  "preset.scale_first.note": "Biggest markets first",
  "preset.remote_first": "Remote first",
  "preset.remote_first.note": "Weighted toward travel distance",
  "preset.credit_gap": "Credit thirst",
  "preset.credit_gap.note": "Whitespace for lending products",

  "findex.title": "National benchmark",
  "findex.notByProvince": "Not by province · national figures",
  "findex.note": "World Bank Global Findex {year}. {sample}",
  "findex.trend": "Account ownership over time",
  "findex.trendInsufficient": "Too few survey rounds to draw a trend.",
  "findex.groups": "Differences between groups (latest)",
  "findex.diff": "Difference",
  "findex.pair.urbanRural": "Urban / rural",
  "findex.pair.urban": "Urban",
  "findex.pair.rural": "Rural",
  "findex.pair.gender": "Gender",
  "findex.pair.male": "Men",
  "findex.pair.female": "Women",
  "findex.pair.income": "Income",
  "findex.pair.all": "All",
  "findex.pair.poorest40": "Poorest 40%",
  "findex.hint":
    "At the latest survey all three gaps sit within about 3 points. <b>Inclusion measured by " +
    "account ownership is already closed in Thailand</b> — what remains is not the national average " +
    "but where the physical access isn't, and that is what this tool measures.",
  "findex.borrow": "Borrowed formally",
  "findex.mobile": "Owns a mobile phone",
  "findex.link": "Global Findex report",

  "method.title": "Methodology and data lineage",
  "method.aria": "Methodology",
  "method.note":
    "What follows is not the documentation but <b>the values this build actually used</b>{when}. " +
    "Where the docs disagree, this is what happened.",
  "method.generated": " (generated {at} UTC)",
  "method.sources": "Source as-of dates",
  "method.col.source": "Source",
  "method.col.asOf": "As of",
  "method.col.grade": "Grade",
  "method.col.license": "Licence",
  "method.snapshot": "snapshot",
  "method.snapshotWhy": "Reused a stored response instead of the network",
  "method.cache": "cache",
  "method.cacheWhy": "Live fetch failed; reused the stored workbook",
  "method.gradeOrigin": "Source grade {grade}",
  "method.degraded": "Sources this build could not obtain",
  "method.unavailable": "could not be obtained (hover for the technical reason)",
  "method.degradedBody":
    "Those indicators are left <b>missing</b>. They are not filled with zero — they drop out of the " +
    "weighted sum and the remaining weights are renormalised.",
  "method.index": "Index definition",
  "method.col.axis": "Axis",
  "method.col.item": "Term",
  "method.col.weight": "Default weight",
  "method.col.expr": "Expression",
  "method.axis.supply": "Supply",
  "method.axis.demand": "Demand",
  "method.invert": "inverted",
  "method.indexHint":
    "These are the default weights. Moving the sliders recomputes in the browser with the same formula " +
    "(a parity test in CI keeps the ETL's figi.py and score.ts in agreement).",
  "method.digital": "Digital readiness",
  "method.digitalMismatch":
    "<b>Planned ({planned}) and actual (missing) differ.</b> Neither regional ICT usage nor " +
    "province-level urbanisation was obtainable, so this axis was not computed — a deliberate choice " +
    "not to stack an estimate on an estimate.",
  "method.units":
    "Amounts are in {unit}; the unit of analysis is the province, {n} of them. " +
    "{estimated}-grade indicators never take the map's colour channel.",
  "method.baht": "baht",

  "footer.title": "Data sources",
  "footer.repo": "Repository",
  "footer.code": "Code {license}",
  "footer.generated": " · data generated {date}",
  "footer.disclaimer":
    "Each dataset is governed by its own licence. The index and ranking are this tool's interpretation, " +
    "not the view of the issuing institutions.",

  "share.copy": "Copy link",
  "share.copied": "Copied",
  "share.copiedSr": "Copied the current view's link to the clipboard.",
  "share.failedSr": "Could not reach the clipboard. Copy the address manually.",
  "share.fallback": "Share link (copy manually)",

  "ind.branches": "Branches",
  "ind.branch_density": "Branch density",
  "ind.geographic_access": "Geographic access",
  "ind.deposit_per_capita": "Deposits per capita",
  "ind.credit_per_capita": "Credit per capita",
  "ind.atm_density": "ATM density",
  "ind.population": "Population",
  "ind.gpp_per_capita": "GPP per capita",
  "ind.population_density": "Population density",
  "ind.gpp_agriculture_share": "Agriculture share of GPP",
  "ind.credit_deposit": "Credit-to-deposit",
  "ind.digital_readiness": "Digital readiness",

  "unit.count": "count",
  "unit.perPop": "per 100k people",
  "unit.perArea": "per 1,000 km²",
  "unit.baht": "baht",
  "unit.people": "people",
  "unit.perKm2": "per km²",
  "unit.percent": "%",
  "unit.times": "×",
  "unit.point": "points",

  "w.branch_density": "Branch density",
  "w.geographic_access": "Geographic access",
  "w.deposit_penetration": "Deposit penetration",
  "w.credit_penetration": "Credit penetration",
  "w.atm_density": "ATM density",
  "w.population_scale": "Population scale",
  "w.income_downside": "Income downside",
  "w.dispersion": "Dispersed settlement",
  "w.cash_economy": "Cash economy",
  "w.credit_thirst": "Credit thirst",

  "arch.agent_kiosk": "Agent · kiosk",
  "arch.agent_kiosk.action": "Recruit agents, place kiosks, fund cash-in/out liquidity",
  "arch.digital_first": "Digital first",
  "arch.digital_first.action": "Remote KYC, app acquisition, digital lending pilot",
  "arch.retain_crosssell": "Retain · cross-sell",
  "arch.retain_crosssell.action": "Deepen product penetration; push lending where C/D is low",
  "arch.watch": "Watch",
  "arch.watch.action": "Reassess quarterly; benefits from expansion in neighbouring provinces",

  "src.bot": "Branches, deposits, credit and C/D ratio by province",
  "src.nesdc": "Provincial GPP, population and sector mix",
  "src.nso": "Regional ICT usage (input to the digital-readiness estimate)",
  "src.findex": "National benchmark (not by province)",
  "src.osm": "ATM and bank POIs",
  "src.crosswalk": "Administrative crosswalk, boundary polygons and area",

  "lic.bot": "Attribution required · aggregate publication only",
  "lic.attribution": "Attribution required",
  "lic.findex": "Aggregate indicators only · microdata not redistributed",
  "lic.odbl": "ODbL 1.0",
  "lic.crosswalk": "CC BY 4.0 · polygons CC BY 3.0 IGO",
};

export const STRINGS: Record<Lang, Record<Key, string>> = { ko, en };

/** 화면 언어에 맞는 숫자 로케일. 자릿수 구분과 반올림 표기가 달라진다. */
export const LOCALE: Record<Lang, string> = { ko: "ko-KR", en: "en-US" };
