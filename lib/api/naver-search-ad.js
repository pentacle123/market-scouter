// 네이버 검색광고 API 스켈레톤 (Phase B).
//
// 데이터랩과 별개의 API 로, 카테고리·브랜드 키워드의 **절대 월간 검색량** 을 반환합니다.
// 현재는 env 미등록으로 자동 폴백. 나중에 자격증명 3종을 등록하면 즉시 활성.
//
// 활성화 방법 (사용자가 결정):
//   1. https://searchad.naver.com → 도구 → API 사용 관리 → 액세스 라이센스 발급
//   2. Vercel env 에 3개 추가:
//        NAVER_AD_API_KEY
//        NAVER_AD_SECRET_KEY
//        NAVER_AD_CUSTOMER_ID
//   3. 재배포 없이 즉시 활성 (isConfigured() → true)

import crypto from "node:crypto";

const AD_API_BASE = "https://api.searchad.naver.com";

/**
 * env 3종이 모두 등록되어 있는지 확인.
 * 브랜드 발굴 라우트가 이 함수를 먼저 호출해 절대량 필요 시 조건부로 사용.
 */
export function isConfigured() {
  return Boolean(
    process.env.NAVER_AD_API_KEY &&
      process.env.NAVER_AD_SECRET_KEY &&
      process.env.NAVER_AD_CUSTOMER_ID
  );
}

/**
 * 네이버 검색광고 API HMAC-SHA256 서명.
 * spec: https://naver.github.io/searchad-apidoc/#/tags/오퍼레이션-확장
 */
function makeSignature(timestamp, method, uri, secretKey) {
  const message = `${timestamp}.${method}.${uri}`;
  return crypto.createHmac("sha256", secretKey).update(message).digest("base64");
}

function buildAuthHeaders(method, uri) {
  const timestamp = String(Date.now());
  const apiKey = process.env.NAVER_AD_API_KEY;
  const secretKey = process.env.NAVER_AD_SECRET_KEY;
  const customerId = process.env.NAVER_AD_CUSTOMER_ID;
  const signature = makeSignature(timestamp, method, uri, secretKey);
  return {
    "X-Timestamp": timestamp,
    "X-API-KEY": apiKey,
    "X-Customer": customerId,
    "X-Signature": signature,
    "Content-Type": "application/json; charset=UTF-8",
  };
}

/**
 * 키워드 도구 — 월간 PC/모바일 검색량 절대값.
 * @param {string[]} keywords 최대 5개
 * @returns {Promise<{
 *   configured: boolean,
 *   results?: Array<{
 *     keyword: string,
 *     monthlyPcQcCnt: number,
 *     monthlyMobileQcCnt: number,
 *     monthlyTotal: number,
 *   }>,
 *   hint?: string,
 * }>}
 */
export async function getKeywordStats(keywords) {
  if (!isConfigured()) {
    return {
      configured: false,
      results: null,
      hint:
        "NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY / NAVER_AD_CUSTOMER_ID env 3종을 등록하면 자동 활성. " +
        "현재는 DataLab 상대비율로 대체 사용됩니다.",
    };
  }

  const uri = "/keywordstool";
  const method = "GET";
  const headers = buildAuthHeaders(method, uri);
  const params = new URLSearchParams({
    hintKeywords: keywords.slice(0, 5).join(","),
    showDetail: "1",
  });

  const res = await fetch(`${AD_API_BASE}${uri}?${params.toString()}`, {
    method,
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Naver Search Ad ${res.status}: ${text.slice(0, 200)}`);
  }
  const j = await res.json();
  const keywordList = j.keywordList || [];
  const results = keywordList.slice(0, keywords.length).map((k) => {
    const pc = Number(k.monthlyPcQcCnt) || 0;
    const mo = Number(k.monthlyMobileQcCnt) || 0;
    return {
      keyword: k.relKeyword,
      monthlyPcQcCnt: pc,
      monthlyMobileQcCnt: mo,
      monthlyTotal: pc + mo,
    };
  });
  return { configured: true, results };
}
