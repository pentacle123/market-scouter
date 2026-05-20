// YouTube Data API v3 클라이언트 (서버 전용).
// 호출 비용: search.list = 100 units, videos.list = 1 unit. 일일 무료 쿼터 10,000 units.
// 한 카테고리당 (search 1회 + videos 1회) = 101 units, US/KR 양쪽이면 ~202 units.

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

const DAYS_LOOKBACK = 30;
const MAX_RESULTS = 50;

function publishedAfterISO() {
  const ms = Date.now() - DAYS_LOOKBACK * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

/**
 * 한 카테고리의 단일 국가 스캔.
 * @param {string} apiKey
 * @param {string} query 검색 키워드
 * @param {"US"|"KR"} regionCode
 * @returns {Promise<{totalResults:number, sampleCount:number, avgViews:number, topViews:number, quotaUsed:number}>}
 */
export async function scanCategory(apiKey, query, regionCode) {
  const searchParams = new URLSearchParams({
    key: apiKey,
    q: query,
    type: "video",
    videoDuration: "short",
    regionCode,
    relevanceLanguage: regionCode === "KR" ? "ko" : "en",
    publishedAfter: publishedAfterISO(),
    maxResults: String(MAX_RESULTS),
    part: "snippet",
    order: "viewCount",
  });

  const searchRes = await fetch(`${SEARCH_URL}?${searchParams.toString()}`, {
    cache: "no-store",
  });
  if (!searchRes.ok) {
    const text = await searchRes.text();
    throw new Error(
      `YouTube search.list failed (${regionCode}, "${query}"): ${searchRes.status} ${text.slice(0, 200)}`
    );
  }
  const searchData = await searchRes.json();
  const totalResults = Number(searchData.pageInfo?.totalResults || 0);
  const videoIds = (searchData.items || [])
    .map((it) => it.id?.videoId)
    .filter(Boolean);

  let quotaUsed = 100;
  let avgViews = 0;
  let topViews = 0;
  const sampleCount = videoIds.length;

  if (videoIds.length > 0) {
    const videosParams = new URLSearchParams({
      key: apiKey,
      id: videoIds.join(","),
      part: "statistics",
    });
    const videosRes = await fetch(`${VIDEOS_URL}?${videosParams.toString()}`, {
      cache: "no-store",
    });
    quotaUsed += 1;
    if (videosRes.ok) {
      const videosData = await videosRes.json();
      const views = (videosData.items || [])
        .map((v) => Number(v.statistics?.viewCount || 0))
        .filter((n) => Number.isFinite(n));
      if (views.length > 0) {
        const sum = views.reduce((a, b) => a + b, 0);
        avgViews = Math.round(sum / views.length);
        topViews = Math.max(...views);
      }
    }
    // videos.list 실패는 치명적이지 않으므로 viewCount만 0으로 둔다.
  }

  return { totalResults, sampleCount, avgViews, topViews, quotaUsed };
}

/**
 * 블루오션 판정: US에서 일정 규모 이상 바이럴 중이고, KR 대비 N배 이상인 카테고리.
 */
export function isBlueOcean({ usCount, krCount, threshold = 3, minUs = 50 }) {
  if (usCount < minUs) return false;
  if (krCount <= 0) return true;
  return usCount / krCount >= threshold;
}
