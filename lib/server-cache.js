// 서버사이드 메모리 캐시 + 쿼터 카운터.
//
// 환경: Vercel 서버리스. 같은 함수 인스턴스가 hot 상태인 동안 모듈 스코프 변수가
// 유지되므로 같은 인스턴스 내 후속 요청은 캐시 적중. Cold start 시 비워짐 — 그래도
// 클라이언트 localStorage 캐시가 1차 방어막 역할을 하므로 실제 외부 API 호출은
// 크게 줄어듦.
//
// 더 강력한 영속성이 필요해지면 Vercel KV (Upstash Redis) 로 교체 가능 — 본 모듈의
// 인터페이스(cacheGet/cacheSet/incrementQuota)를 그대로 유지하면 됨.

const cache = new Map(); // key → { value, expiresAt }

// 쿼터는 "오늘"이라는 개념이 필요. YouTube Data API 는 PST 자정(UTC 08:00)에 리셋.
let quotaState = null;

function currentPstDateString() {
  // 현재 UTC 시각 → PST(UTC-8) 로 변환 후 YYYY-MM-DD 추출
  const now = new Date();
  const pstMs = now.getTime() - 8 * 3600 * 1000;
  const d = new Date(pstMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function ensureQuotaState() {
  const today = currentPstDateString();
  if (!quotaState || quotaState.date !== today) {
    quotaState = { date: today, usedByKey: {}, totalUsed: 0 };
  }
  return quotaState;
}

// ─── 캐시 ─────────────────────────────────────────────────────────────────────
const DEFAULT_TTL_MS = 7 * 24 * 3600 * 1000;

export function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key) {
  cache.delete(key);
}

export function cacheStats() {
  return {
    entries: cache.size,
    ttlDays: DEFAULT_TTL_MS / 86400000,
  };
}

// ─── 쿼터 카운터 ──────────────────────────────────────────────────────────────

export function incrementQuota(units, keyHash = "default") {
  const s = ensureQuotaState();
  s.usedByKey[keyHash] = (s.usedByKey[keyHash] || 0) + units;
  s.totalUsed += units;
  return s;
}

export function getQuotaUsage() {
  const s = ensureQuotaState();
  return {
    date: s.date,
    totalUsed: s.totalUsed,
    usedByKey: { ...s.usedByKey },
  };
}

export function resetQuota() {
  quotaState = null;
}
