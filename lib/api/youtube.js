// YouTube Data API v3 클라이언트 (서버 전용).
// 호출 비용: search.list = 100 units, videos.list = 1 unit. 일일 무료 쿼터 10,000 units.
// 한 카테고리당 (search 1회 + videos 1회) = 101 units, US/KR 양쪽이면 ~202 units.

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";

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

// ─── 크리에이터 자동 매칭 ─────────────────────────────────────────────────────
//
// 2단계 호출:
//   1) search.list  (100 units) — 카테고리 키워드 영상 30개, viewCount 정렬
//   2) channels.list (1 unit, batch up to 50) — 채널 상세 정보
// 카테고리당 약 101 units. 일일 무료 한도 10,000 / 101 ≈ 99회 스캔.

const CREATORS_MAX_VIDEOS = 30;

function classifyTier(subs) {
  if (subs >= 1_000_000) return "mega";
  if (subs >= 100_000) return "macro";
  if (subs >= 10_000) return "micro";
  return "nano";
}

function recentnessScore(uploadedAt) {
  if (!uploadedAt) return 10;
  const days = (Date.now() - new Date(uploadedAt).getTime()) / 86_400_000;
  if (days <= 30) return 100;
  if (days <= 90) return 80;
  if (days <= 180) return 50;
  if (days <= 365) return 25;
  return 10;
}

function fitScore({ relevantVideos, avgViews, recentUpload, subscribers, maxRel }) {
  // 정규화 (각 0~100)
  const relScore = (relevantVideos / Math.max(1, maxRel)) * 100;
  const avgScore = Math.min(100, (Math.log10(avgViews + 1) / 7) * 100);  // log scale
  const recScore = recentnessScore(recentUpload);
  const subsScore = Math.min(100, (Math.log10(subscribers + 1) / 6) * 100);
  return Math.round(relScore * 0.4 + avgScore * 0.3 + recScore * 0.2 + subsScore * 0.1);
}

/**
 * 카테고리 KR 키워드로 크리에이터 자동 발굴.
 * @param {string} apiKey
 * @param {string} query  검색 키워드 (보통 cat.kw.KR)
 * @param {string} regionCode  "KR" | "US"
 * @returns {Promise<{creators: Array, quotaUsed: number, summary: object}>}
 */
export async function scanCreators(apiKey, query, regionCode = "KR") {
  // STEP 1: 영상 검색 (요청 영상 데이터로부터 channelId 추출)
  const searchParams = new URLSearchParams({
    key: apiKey,
    q: query,
    type: "video",
    regionCode,
    relevanceLanguage: regionCode === "KR" ? "ko" : "en",
    maxResults: String(CREATORS_MAX_VIDEOS),
    part: "snippet",
    order: "viewCount",
  });

  const searchRes = await fetch(`${SEARCH_URL}?${searchParams.toString()}`, {
    cache: "no-store",
  });
  if (!searchRes.ok) {
    const text = await searchRes.text();
    throw new Error(
      `YouTube search.list (creators, ${regionCode}, "${query}"): ${searchRes.status} ${text.slice(0, 200)}`
    );
  }
  const searchData = await searchRes.json();
  const items = searchData.items || [];

  // channelId → { videos: [], firstSnippet }
  const channelMap = new Map();
  items.forEach((it) => {
    const cid = it.snippet?.channelId;
    if (!cid) return;
    if (!channelMap.has(cid)) {
      channelMap.set(cid, {
        videos: [],
        firstSnippet: it.snippet,
        channelTitle: it.snippet?.channelTitle,
      });
    }
    channelMap.get(cid).videos.push({
      videoId: it.id?.videoId,
      title: it.snippet?.title,
      publishedAt: it.snippet?.publishedAt,
      thumbnails: it.snippet?.thumbnails,
    });
  });

  const channelIds = Array.from(channelMap.keys());
  let quotaUsed = 100; // search.list

  if (!channelIds.length) {
    return {
      creators: [],
      quotaUsed,
      summary: { totalVideos: 0, uniqueChannels: 0, byTier: {} },
    };
  }

  // STEP 2: channels.list (한 번 호출로 최대 50개 ID 묶음 처리)
  const channelsParams = new URLSearchParams({
    key: apiKey,
    id: channelIds.slice(0, 50).join(","),
    part: "snippet,statistics",
    maxResults: "50",
  });
  const channelsRes = await fetch(`${CHANNELS_URL}?${channelsParams.toString()}`, {
    cache: "no-store",
  });
  quotaUsed += 1;
  if (!channelsRes.ok) {
    const text = await channelsRes.text();
    throw new Error(
      `YouTube channels.list: ${channelsRes.status} ${text.slice(0, 200)}`
    );
  }
  const channelsData = await channelsRes.json();
  const channelStats = new Map();
  (channelsData.items || []).forEach((ch) => channelStats.set(ch.id, ch));

  // 크리에이터 객체 생성
  const draft = channelIds
    .map((cid) => {
      const ch = channelStats.get(cid);
      if (!ch) return null;
      const mapEntry = channelMap.get(cid);
      const subs = Number(ch.statistics?.subscriberCount || 0);
      const totalViews = Number(ch.statistics?.viewCount || 0);
      const videoCount = Number(ch.statistics?.videoCount || 0);
      const avgViews = videoCount > 0 ? Math.round(totalViews / videoCount) : 0;
      const sortedByDate = [...mapEntry.videos].sort((a, b) =>
        String(b.publishedAt).localeCompare(String(a.publishedAt))
      );
      const recentUpload = sortedByDate[0]?.publishedAt || null;
      const sample = sortedByDate[0] || mapEntry.videos[0];
      return {
        channelId: cid,
        name: ch.snippet?.title || mapEntry.channelTitle || "Unknown",
        description: ch.snippet?.description || "",
        thumbnail:
          ch.snippet?.thumbnails?.default?.url ||
          mapEntry.firstSnippet?.thumbnails?.default?.url ||
          null,
        subscribers: subs,
        totalViews,
        videoCount,
        avgViews,
        tier: classifyTier(subs),
        recentUpload,
        relevantVideos: mapEntry.videos.length,
        sampleVideoTitle: sample?.title || "",
        sampleVideoId: sample?.videoId || null,
        sampleVideoViews: 0, // search.list 는 viewCount 미제공
      };
    })
    .filter(Boolean);

  const maxRel = Math.max(1, ...draft.map((c) => c.relevantVideos));

  const creators = draft
    .map((c) => ({
      ...c,
      fitScore: fitScore({
        relevantVideos: c.relevantVideos,
        avgViews: c.avgViews,
        recentUpload: c.recentUpload,
        subscribers: c.subscribers,
        maxRel,
      }),
    }))
    .sort((a, b) => b.fitScore - a.fitScore);

  const byTier = creators.reduce((acc, c) => {
    acc[c.tier] = (acc[c.tier] || 0) + 1;
    return acc;
  }, {});

  return {
    creators,
    quotaUsed,
    summary: {
      totalVideos: items.length,
      uniqueChannels: channelIds.length,
      byTier,
    },
  };
}
