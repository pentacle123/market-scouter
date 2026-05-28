// localStorage 캐시 접근 헬퍼.
// 여러 컴포넌트(AIAnalysis/Matrix/Detail)가 동일한 키로 일관되게 접근하기 위해 한 곳에 모음.

export const CACHE_KEYS = {
  youtube: "market-scouter:youtube-scan:v1",
  naverTrend: "market-scouter:naver-trend:v1",
  naverShopping: "market-scouter:naver-shopping:v1",
  claude: "market-scouter:claude-analysis:v1",
  businessInput: "market-scouter:business-input:v1",
  googleTrends: "market-scouter:google-trends:v1",
  youtubeCreators: "market-scouter:youtube-creators:v1",
  claudeBriefs: "market-scouter:claude-briefs:v1",
  discoveries: "market-scouter:discoveries:v1",
  reviews: "market-scouter:reviews:v1",
  partners: "market-scouter:partners:v1",
  partnerVerify: "market-scouter:partner-verify:v1",
  partnerMessages: "market-scouter:partner-messages:v1",
};

// 파트너 발견 결과는 14일 TTL (네이버 데이터 변화 느림)
const PARTNER_TTL_MS = 14 * 24 * 3600 * 1000;

// 리뷰는 자주 안 바뀌므로 14일 TTL
const REVIEW_TTL_MS = 14 * 24 * 3600 * 1000;

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

// ── YouTube 크리에이터 캐시: categoryId → { creators, summary, quotaUsed, scannedAt } ──
export function loadYoutubeCreatorsMap() {
  const data = loadJson(CACHE_KEYS.youtubeCreators);
  return data && typeof data === "object" ? data : {};
}
export function saveYoutubeCreatorsMap(map) {
  saveJson(CACHE_KEYS.youtubeCreators, map);
}
export function getYoutubeCreatorsForId(map, id) {
  return (map && map[String(id)]) || null;
}
export function setYoutubeCreatorsForId(id, value) {
  const map = loadYoutubeCreatorsMap();
  map[String(id)] = { ...value, scannedAt: new Date().toISOString() };
  saveYoutubeCreatorsMap(map);
  return map;
}

// ── Claude 브리프 캐시: `${categoryId}:${channelId}` → { brief, usage, savedAt } ──
function briefKey(categoryId, channelId) {
  return `${categoryId}:${channelId}`;
}
export function loadClaudeBriefsMap() {
  const data = loadJson(CACHE_KEYS.claudeBriefs);
  return data && typeof data === "object" ? data : {};
}
export function saveClaudeBriefsMap(map) {
  saveJson(CACHE_KEYS.claudeBriefs, map);
}
export function getClaudeBrief(map, categoryId, channelId) {
  return (map && map[briefKey(categoryId, channelId)]) || null;
}
export function setClaudeBrief(categoryId, channelId, value) {
  const map = loadClaudeBriefsMap();
  map[briefKey(categoryId, channelId)] = { ...value, savedAt: new Date().toISOString() };
  saveClaudeBriefsMap(map);
  return map;
}

// ── 파트너 발견 캐시: categoryId(들) → { ...payload, cachedAt } (14일 TTL) ────
// 키: 카테고리 ID 정렬 후 콜론 join (예: "1,2,5" → "1:2:5")
function partnerKey(categoryIds) {
  return [...new Set(categoryIds.map(Number))].sort((a, b) => a - b).join(":");
}
export function loadPartnersMap() {
  const data = loadJson(CACHE_KEYS.partners);
  return data && typeof data === "object" ? data : {};
}
export function savePartnersMap(map) {
  saveJson(CACHE_KEYS.partners, map);
}
export function getPartnersForKey(map, categoryIds) {
  const key = partnerKey(categoryIds);
  const entry = map && map[key];
  if (!entry) return null;
  if (entry.cachedAt) {
    const age = Date.now() - new Date(entry.cachedAt).getTime();
    if (age > PARTNER_TTL_MS) return null;
  }
  return entry;
}
export function setPartnersForKey(categoryIds, value) {
  const map = loadPartnersMap();
  map[partnerKey(categoryIds)] = { ...value, cachedAt: new Date().toISOString() };
  savePartnersMap(map);
  return map;
}

// ── 파트너 검증 캐시: brandKey → { analysis, ... cachedAt } (14일) ─────────────
function brandKey(brandName, mallName) {
  return `${brandName || ""}:${mallName || ""}`.slice(0, 200);
}
export function loadPartnerVerifyMap() {
  const data = loadJson(CACHE_KEYS.partnerVerify);
  return data && typeof data === "object" ? data : {};
}
export function savePartnerVerifyMap(map) {
  saveJson(CACHE_KEYS.partnerVerify, map);
}
export function getPartnerVerifyForBrand(map, brandName, mallName) {
  const key = brandKey(brandName, mallName);
  const entry = map && map[key];
  if (!entry) return null;
  if (entry.cachedAt) {
    const age = Date.now() - new Date(entry.cachedAt).getTime();
    if (age > PARTNER_TTL_MS) return null;
  }
  return entry;
}
export function setPartnerVerifyForBrand(brandName, mallName, value) {
  const map = loadPartnerVerifyMap();
  map[brandKey(brandName, mallName)] = { ...value, cachedAt: new Date().toISOString() };
  savePartnerVerifyMap(map);
  return map;
}

// ── 파트너 메시지 캐시: `${categoryId}:${mallName}:${channel}` → message ─────
function messageKey(categoryId, mallName, channel) {
  return `${categoryId}:${mallName}:${channel}`;
}
export function loadPartnerMessagesMap() {
  const data = loadJson(CACHE_KEYS.partnerMessages);
  return data && typeof data === "object" ? data : {};
}
export function savePartnerMessagesMap(map) {
  saveJson(CACHE_KEYS.partnerMessages, map);
}
export function getPartnerMessage(map, categoryId, mallName, channel) {
  return (map && map[messageKey(categoryId, mallName, channel)]) || null;
}
export function setPartnerMessage(categoryId, mallName, channel, value) {
  const map = loadPartnerMessagesMap();
  map[messageKey(categoryId, mallName, channel)] = { ...value, savedAt: new Date().toISOString() };
  savePartnerMessagesMap(map);
  return map;
}

// ── 리뷰 분석 캐시: categoryId → { ...payload, cachedAt } (14일 TTL) ──────────
export function loadReviewsMap() {
  const data = loadJson(CACHE_KEYS.reviews);
  return data && typeof data === "object" ? data : {};
}
export function saveReviewsMap(map) {
  saveJson(CACHE_KEYS.reviews, map);
}
export function getReviewForId(map, id) {
  const entry = map && map[String(id)];
  if (!entry) return null;
  // TTL 체크
  if (entry.cachedAt) {
    const age = Date.now() - new Date(entry.cachedAt).getTime();
    if (age > REVIEW_TTL_MS) return null;
  }
  return entry;
}
export function setReviewForId(id, value) {
  const map = loadReviewsMap();
  map[String(id)] = { ...value, cachedAt: new Date().toISOString() };
  saveReviewsMap(map);
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
