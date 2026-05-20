// localStorage 캐시 접근 헬퍼.
// 여러 컴포넌트(AIAnalysis/Matrix/Detail)가 동일한 키로 일관되게 접근하기 위해 한 곳에 모음.

export const CACHE_KEYS = {
  youtube: "market-scouter:youtube-scan:v1",
  naverTrend: "market-scouter:naver-trend:v1",
  naverShopping: "market-scouter:naver-shopping:v1",
  claude: "market-scouter:claude-analysis:v1",
};

export function loadJson(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded */
  }
}

// ── 카테고리 ID 로 해당 스캔 결과 한 건 꺼내기 ─────────────────────────────
export function getYoutubeForId(scan, id) {
  return scan?.results?.find((r) => r.id === id) || null;
}
export function getNaverTrendForId(scan, id) {
  return scan?.results?.find((r) => r.id === id) || null;
}
export function getNaverShoppingForId(scan, id) {
  return scan?.results?.find((r) => r.id === id) || null;
}

// ── Claude 분석 캐시는 categoryId → {analysis, usage, estCostUSD, scannedAt} 맵 ───
export function loadClaudeAnalysisMap() {
  const data = loadJson(CACHE_KEYS.claude);
  return data && typeof data === "object" ? data : {};
}
export function saveClaudeAnalysisMap(map) {
  saveJson(CACHE_KEYS.claude, map);
}
export function getClaudeAnalysisForId(map, id) {
  return (map && map[String(id)]) || null;
}
