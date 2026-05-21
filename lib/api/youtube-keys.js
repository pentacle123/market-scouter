// YouTube API 키 멀티 키 로테이션.
// env 변수 YOUTUBE_API_KEY / YOUTUBE_API_KEY_2 / YOUTUBE_API_KEY_3 자동 감지.
// 403 quota 발생 시 해당 키를 "오늘 소진"으로 마킹하고 다음 키로 폴백.

import { incrementQuota } from "../server-cache";

// 키별 "오늘 소진" 상태. 모듈 스코프이므로 같은 함수 인스턴스 내에서 유지.
// 다음 PST 자정에는 새 quotaState 와 함께 재평가가 필요하므로 timestamp 도 함께 저장.
const exhausted = new Map(); // keyHash → { since: ISOstring, pstDate: "YYYY-MM-DD" }

function currentPstDate() {
  const pstMs = Date.now() - 8 * 3600 * 1000;
  const d = new Date(pstMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function hashKey(k) {
  // 키 자체를 로그/UI 에 노출하지 않기 위한 단순 해시 (앞 6자만)
  if (!k) return "—";
  return k.slice(0, 6) + "…";
}

export function getConfiguredKeys() {
  const keys = [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEY_2,
    process.env.YOUTUBE_API_KEY_3,
  ].filter(Boolean);
  return keys.map((k, i) => ({ index: i + 1, hash: hashKey(k), value: k }));
}

function isExhaustedToday(keyHash) {
  const e = exhausted.get(keyHash);
  if (!e) return false;
  // PST 자정 지나면 자동 해제
  if (e.pstDate !== currentPstDate()) {
    exhausted.delete(keyHash);
    return false;
  }
  return true;
}

export function getKeysStatus() {
  const keys = getConfiguredKeys();
  return {
    total: keys.length,
    available: keys.filter((k) => !isExhaustedToday(k.hash)).length,
    keys: keys.map((k) => ({
      index: k.index,
      hash: k.hash,
      exhausted: isExhaustedToday(k.hash),
    })),
  };
}

/**
 * 키를 순회하며 fn(apiKey) 실행. 403 quota 에러 시 다음 키로 폴백.
 * @param {(apiKey: string) => Promise<{ data: any, quotaUsed: number }>} fn
 * @returns {Promise<{ data: any, quotaUsed: number, keyIndex: number, keyHash: string }>}
 */
export async function callWithKeyRotation(fn) {
  const keys = getConfiguredKeys();
  if (!keys.length) {
    const err = new Error("YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.");
    err.code = "NO_KEY";
    throw err;
  }
  const errors = [];
  for (const k of keys) {
    if (isExhaustedToday(k.hash)) {
      errors.push(`#${k.index} ${k.hash}: 오늘 쿼터 소진 (캐시)`);
      continue;
    }
    try {
      const out = await fn(k.value);
      incrementQuota(out.quotaUsed || 0, k.hash);
      return { ...out, keyIndex: k.index, keyHash: k.hash };
    } catch (e) {
      const msg = e?.message || String(e);
      if (/\b403\b/.test(msg) && /quota/i.test(msg)) {
        exhausted.set(k.hash, { since: new Date().toISOString(), pstDate: currentPstDate() });
        errors.push(`#${k.index} ${k.hash}: 쿼터 초과 — 다음 키로 폴백`);
        continue;
      }
      // 다른 에러는 즉시 throw (quota 무관 문제)
      throw e;
    }
  }
  const err = new Error(`모든 YouTube API 키가 쿼터 초과: ${errors.join(" / ")}`);
  err.code = "ALL_KEYS_EXHAUSTED";
  err.attempts = errors;
  throw err;
}
