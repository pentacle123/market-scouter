// localStorage 캐시 접근 헬퍼.
// 여러 컴포넌트(AIAnalysis/Matrix/Detail)가 동일한 키로 일관되게 접근하기 위해 한 곳에 모음.

export const CACHE_KEYS = {
  youtube: "market-scouter:youtube-scan:v1",
  naverTrend: "market-scouter:naver-trend:v1",
  naverShopping: "market-scouter:naver-shopping:v1",
  claude: "market-scouter:claude-analysis:v1",
  businessInput: "market-scouter:business-input:v1",
  googleTrends: "market-scouter:google-trends:v1",
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

// ── Google Trends 캐시: categoryId → { points, shape, scannedAt } ─────────────
export function loadGoogleTrendsMap() {
  const data = loadJson(CACHE_KEYS.googleTrends);
  return data && typeof data === "object" ? data : {};
}
export function saveGoogleTrendsMap(map) {
  saveJson(CACHE_KEYS.googleTrends, map);
}
export function getGoogleTrendsForId(map, id) {
  return (map && map[String(id)]) || null;
}
export function setGoogleTrendsForId(id, value) {
  const map = loadGoogleTrendsMap();
  map[String(id)] = { ...value, scannedAt: new Date().toISOString() };
  saveGoogleTrendsMap(map);
  return map;
}

// ── 사업 심사 입력값 캐시: categoryId → { unitEcon, exit, savedAt } ─────────────
export function loadBusinessInputMap() {
  const data = loadJson(CACHE_KEYS.businessInput);
  return data && typeof data === "object" ? data : {};
}
export function saveBusinessInputMap(map) {
  saveJson(CACHE_KEYS.businessInput, map);
}
export function getBusinessInputForId(map, id) {
  return (map && map[String(id)]) || null;
}
export function setBusinessInputForId(id, value) {
  const map = loadBusinessInputMap();
  map[String(id)] = { ...value, savedAt: new Date().toISOString() };
  saveBusinessInputMap(map);
  return map;
}
