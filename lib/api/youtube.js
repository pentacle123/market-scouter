// YouTube Data API v3 클라이언트 (서버 전용).
//
// 최적화 4종:
//   1) 서버사이드 7일 메모리 캐시 (lib/server-cache.js)
//   2) 멀티 키 로테이션 (lib/api/youtube-keys.js)
//   3) fields 파라미터 최소화 — 응답 크기 ↓, 속도 ↑ (쿼터 자체는 동일)
//   4) PST 자정 기준 쿼터 카운터
//
// 호출 비용 (변동 없음): search.list = 100 units, videos.list = 1 unit,
// channels.list = 1 unit (batch up to 50 IDs).
// 한 카테고리당 (search + videos) = 101 units, US/KR 양쪽이면 ~202 units.

import { cacheGet, cacheSet } from "../server-cache";
import { callWithKeyRotation } from "./youtube-keys";

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";
const COMMENT_THREADS_URL = "https://www.googleapis.com/youtube/v3/commentThreads";

const DAYS_LOOKBACK = 30;
const MAX_RESULTS = 50;
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

function publishedAfterISO() {
  const ms = Date.now() - DAYS_LOOKBACK * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

// 카테고리 스캔 캐시 키
function scanCacheKey(query, regionCode) {
  return `yt_scan_${regionCode}_${encodeURIComponent(query)}`;
}

// 크리에이터 스캔 캐시 키
function creatorsCacheKey(query, regionCode) {
  return `yt_creators_${regionCode}_${encodeURIComponent(query)}`;
}

/**
 * 한 카테고리의 단일 국가 스캔.
 * @param {string} query 검색 키워드
 * @param {"US"|"KR"} regionCode
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<object>} totalResults, sampleCount, avgViews, topViews, quotaUsed,
 *                            cacheHit, keyIndex, keyHash
 */
export async function scanCategory(query, regionCode, opts = {}) {
  const key = scanCacheKey(query, regionCode);
  if (!opts.force) {
    const cached = cacheGet(key);
    if (cached) {
      return { ...cached, cacheHit: true, quotaUsed: 0 };
    }
  }

  // 키 로테이션 + 실제 호출
  const { data, quotaUsed, keyIndex, keyHash } = await callWithKeyRotation(async (apiKey) => {
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
      // 응답 크기 축소: 필요한 필드만 (쿼터에는 영향 없음)
      fields: "items(id/videoId,snippet/title),pageInfo/totalResults",
    });

    const searchRes = await fetch(`${SEARCH_URL}?${searchParams.toString()}`, {
      cache: "no-store",
    });
    if (!searchRes.ok) {
      const text = await searchRes.text();
      throw new Error(
        `YouTube search.list (${regionCode}, "${query}"): ${searchRes.status} ${text.slice(0, 200)}`
      );
    }
    const searchData = await searchRes.json();
    const totalResults = Number(searchData.pageInfo?.totalResults || 0);
    const videoIds = (searchData.items || [])
      .map((it) => it.id?.videoId)
      .filter(Boolean);

    let unitsUsed = 100;
    let avgViews = 0;
    let topViews = 0;
    const sampleCount = videoIds.length;

    if (videoIds.length > 0) {
      const videosParams = new URLSearchParams({
        key: apiKey,
        id: videoIds.join(","),
        part: "statistics",
        fields: "items(id,statistics/viewCount)",
      });
      const videosRes = await fetch(`${VIDEOS_URL}?${videosParams.toString()}`, {
        cache: "no-store",
      });
      unitsUsed += 1;
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
    }

    return {
      data: { totalResults, sampleCount, avgViews, topViews },
      quotaUsed: unitsUsed,
    };
  });

  const payload = { ...data, quotaUsed };
  cacheSet(key, payload, CACHE_TTL_MS);
  return { ...payload, cacheHit: false, keyIndex, keyHash };
}

/**
 * 블루오션 판정.
 */
export function isBlueOcean({ usCount, krCount, threshold = 3, minUs = 50 }) {
  if (usCount < minUs) return false;
  if (krCount <= 0) return true;
  return usCount / krCount >= threshold;
}

// ─── 브랜드/셀러 단위 쇼츠 활동도 체크 (파트너 발견용) ──────────────────────────
//
// 단일 브랜드명으로 KR 쇼츠를 검색해 totalResults 와 샘플 제목 5개 반환.
// search.list 1회 = 100 units / 브랜드.
//
// level 분류:
//   - "absent"   shortsCount === 0    → 🔴 최고 파트너 후보 (숏폼 전무)
//   - "weak"     1 ≤ count ≤ 5         → 🟡 시작했지만 미약
//   - "moderate" 6 ≤ count ≤ 9         → 🟠 보통
//   - "active"   count ≥ 10            → 🟢 이미 활발 (우리 필요 없음)

export async function checkBrandShorts(brandName) {
  const cleanName = String(brandName || "").trim();
  if (!cleanName) {
    return { shortsCount: 0, level: "absent", sampleTitles: [], quotaUsed: 0 };
  }
  const cacheKey = `yt_brand_shorts_${cleanName}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, cacheHit: true, quotaUsed: 0 };

  const { data, quotaUsed } = await callWithKeyRotation(async (apiKey) => {
    const params = new URLSearchParams({
      key: apiKey,
      q: cleanName,
      type: "video",
      videoDuration: "short",
      regionCode: "KR",
      relevanceLanguage: "ko",
      maxResults: "5",
      part: "snippet",
      order: "relevance",
      fields: "items(id/videoId,snippet/title),pageInfo/totalResults",
    });
    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`brand shorts ("${cleanName}"): ${res.status} ${text.slice(0, 200)}`);
    }
    const j = await res.json();
    return {
      data: {
        shortsCount: Number(j.pageInfo?.totalResults || 0),
        sampleTitles: (j.items || []).map((it) => it.snippet?.title).filter(Boolean),
      },
      quotaUsed: 100,
    };
  });

  const total = data.shortsCount;
  let level;
  if (total === 0) level = "absent";
  else if (total <= 5) level = "weak";
  else if (total <= 9) level = "moderate";
  else level = "active";

  const payload = { shortsCount: total, level, sampleTitles: data.sampleTitles };
  cacheSet(cacheKey, payload, CACHE_TTL_MS);
  return { ...payload, quotaUsed, cacheHit: false };
}

// ─── US 리뷰 영상 + 댓글 수집 ─────────────────────────────────────────────────
//
// 블루오션 카테고리의 "실제 미국 소비자 목소리" 수집용.
// search.list (100u) 로 "X review honest" 검색 → 영상 5개 → 영상별 댓글 50개
// commentThreads.list 는 호출당 1u → 총 ~105 units / 카테고리.

const REVIEW_VIDEOS_COUNT = 5;
const REVIEW_COMMENTS_PER_VIDEO = 50;

/**
 * 키워드에 대해 미국 리뷰 영상 + 댓글 수집.
 * @returns {Promise<{
 *   videos: Array<{videoId, title}>,
 *   comments: Array<{videoId, videoTitle, text, author, likeCount}>,
 *   quotaUsed: number,
 * }>}
 */
export async function scanUSReviewsWithComments(query, opts = {}) {
  const maxVideos = opts.maxVideos ?? REVIEW_VIDEOS_COUNT;
  const maxCommentsPerVideo = opts.maxCommentsPerVideo ?? REVIEW_COMMENTS_PER_VIDEO;
  let totalQuota = 0;

  // STEP 1: search.list (US, "{kw} review honest")
  const cleanKw = String(query || "").split("|")[0].trim();
  const searchRes = await callWithKeyRotation(async (apiKey) => {
    const params = new URLSearchParams({
      key: apiKey,
      q: `${cleanKw} review honest`,
      type: "video",
      regionCode: "US",
      relevanceLanguage: "en",
      maxResults: String(maxVideos),
      part: "snippet",
      order: "relevance",
      fields: "items(id/videoId,snippet/title)",
    });
    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`US review search ("${cleanKw}"): ${res.status} ${text.slice(0, 200)}`);
    }
    const j = await res.json();
    const videos = (j.items || [])
      .map((it) => ({ videoId: it.id?.videoId, title: it.snippet?.title }))
      .filter((v) => v.videoId);
    return { data: { videos }, quotaUsed: 100 };
  });
  totalQuota += searchRes.quotaUsed;
  const videos = searchRes.data.videos;

  if (!videos.length) {
    return { videos: [], comments: [], quotaUsed: totalQuota };
  }

  // STEP 2: commentThreads.list 영상별 병렬 (한 호출 1 unit)
  const allComments = [];
  const settled = await Promise.allSettled(
    videos.map((v) =>
      callWithKeyRotation(async (apiKey) => {
        const params = new URLSearchParams({
          key: apiKey,
          videoId: v.videoId,
          part: "snippet",
          maxResults: String(maxCommentsPerVideo),
          order: "relevance",
          textFormat: "plainText",
          fields:
            "items(snippet/topLevelComment/snippet(textDisplay,authorDisplayName,likeCount))",
        });
        const res = await fetch(`${COMMENT_THREADS_URL}?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text();
          // 댓글 비공개/차단된 영상은 종종 403. 한 영상 실패는 전체 실패가 아님.
          const err = new Error(
            `commentThreads ${v.videoId}: ${res.status} ${text.slice(0, 150)}`
          );
          err.videoId = v.videoId;
          throw err;
        }
        const j = await res.json();
        const comments = (j.items || [])
          .map((it) => {
            const s = it.snippet?.topLevelComment?.snippet || {};
            return {
              videoId: v.videoId,
              videoTitle: v.title,
              text: s.textDisplay,
              author: s.authorDisplayName,
              likeCount: Number(s.likeCount) || 0,
            };
          })
          .filter((c) => c.text);
        return { data: comments, quotaUsed: 1 };
      })
    )
  );

  const commentErrors = [];
  settled.forEach((s, idx) => {
    if (s.status === "fulfilled") {
      allComments.push(...s.value.data);
      totalQuota += s.value.quotaUsed;
    } else {
      commentErrors.push({
        videoId: videos[idx]?.videoId,
        videoTitle: videos[idx]?.title,
        error: s.reason?.message || String(s.reason),
      });
    }
  });

  return {
    videos,
    comments: allComments,
    commentErrors,
    quotaUsed: totalQuota,
  };
}

// ─── 자동 카테고리 발견 (Discovery) ───────────────────────────────────────────
//
// 미국 YouTube 에서 최근 3개월간 뜬 제품 영상을 9개 광범위 키워드로 검색해
// 영상 제목 풀을 수집. 그 후 Claude 가 기존 30 카테고리에 없는 신규 후보를 추출.
// 한 키워드당 search.list = 100 units → 9개 = 900 units. 일일 한도의 5% 수준.

const DISCOVERY_KEYWORDS = [
  "product review",
  "must have gadget",
  "tiktok made me buy",
  "home gadget",
  "kitchen gadget",
  "beauty hack",
  "pet gadget",
  "health gadget",
  "cleaning hack",
];

const DISCOVERY_LOOKBACK_DAYS = 90;
const DISCOVERY_MAX_PER_KEYWORD = 20;

function discoveryCacheKey() {
  return "yt_discovery_us_v1";
}

/**
 * US 트렌딩 제품 영상 수집 — 9 키워드 병렬 검색 + 중복 제거.
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<{
 *   videos: Array<{title, channelTitle, videoId, sourceKeyword}>,
 *   keywordsCovered: string[],
 *   failedKeywords: string[],
 *   publishedAfter: string,
 *   quotaUsed: number,
 *   cacheHit: boolean,
 * }>}
 */
export async function discoverTrendingVideos(opts = {}) {
  const cacheKey = discoveryCacheKey();
  if (!opts.force) {
    const cached = cacheGet(cacheKey);
    if (cached) return { ...cached, cacheHit: true, quotaUsed: 0 };
  }

  const publishedAfter = new Date(
    Date.now() - DISCOVERY_LOOKBACK_DAYS * 86400 * 1000
  ).toISOString();

  const settled = await Promise.allSettled(
    DISCOVERY_KEYWORDS.map(async (kw) => {
      const { data, quotaUsed } = await callWithKeyRotation(async (apiKey) => {
        const params = new URLSearchParams({
          key: apiKey,
          q: kw,
          type: "video",
          videoDuration: "short",
          regionCode: "US",
          relevanceLanguage: "en",
          publishedAfter,
          maxResults: String(DISCOVERY_MAX_PER_KEYWORD),
          part: "snippet",
          order: "viewCount",
          fields: "items(id/videoId,snippet(title,channelTitle))",
        });
        const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `Discovery search.list ("${kw}"): ${res.status} ${text.slice(0, 200)}`
          );
        }
        const j = await res.json();
        const videos = (j.items || [])
          .map((it) => ({
            title: it.snippet?.title,
            channelTitle: it.snippet?.channelTitle,
            videoId: it.id?.videoId,
          }))
          .filter((v) => v.title && v.videoId);
        return { data: { keyword: kw, videos }, quotaUsed: 100 };
      });
      return data;
    })
  );

  let totalQuota = 0;
  const successful = [];
  const failedKeywords = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      successful.push(s.value);
      totalQuota += 100;
    } else {
      failedKeywords.push(DISCOVERY_KEYWORDS[i]);
    }
  });

  // 영상 중복 제거 (같은 videoId 가 여러 키워드에 잡힐 수 있음)
  const seen = new Set();
  const videos = [];
  successful.forEach((r) => {
    r.videos.forEach((v) => {
      if (seen.has(v.videoId)) return;
      seen.add(v.videoId);
      videos.push({ ...v, sourceKeyword: r.keyword });
    });
  });

  const payload = {
    videos,
    keywordsCovered: successful.map((r) => r.keyword),
    failedKeywords,
    publishedAfter,
    quotaUsed: totalQuota,
  };

  cacheSet(cacheKey, payload, CACHE_TTL_MS);
  return { ...payload, cacheHit: false };
}

// ─── 크리에이터 자동 매칭 ─────────────────────────────────────────────────────

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
  const relScore = (relevantVideos / Math.max(1, maxRel)) * 100;
  const avgScore = Math.min(100, (Math.log10(avgViews + 1) / 7) * 100);
  const recScore = recentnessScore(recentUpload);
  const subsScore = Math.min(100, (Math.log10(subscribers + 1) / 6) * 100);
  return Math.round(relScore * 0.4 + avgScore * 0.3 + recScore * 0.2 + subsScore * 0.1);
}

/**
 * 카테고리 KR/US 키워드로 크리에이터 자동 발굴.
 * @param {string} query
 * @param {string} regionCode
 * @param {{ force?: boolean }} [opts]
 */
export async function scanCreators(query, regionCode = "KR", opts = {}) {
  const key = creatorsCacheKey(query, regionCode);
  if (!opts.force) {
    const cached = cacheGet(key);
    if (cached) {
      return { ...cached, cacheHit: true, quotaUsed: 0 };
    }
  }

  const { data, quotaUsed, keyIndex, keyHash } = await callWithKeyRotation(async (apiKey) => {
    // STEP 1: 영상 검색
    const searchParams = new URLSearchParams({
      key: apiKey,
      q: query,
      type: "video",
      regionCode,
      relevanceLanguage: regionCode === "KR" ? "ko" : "en",
      maxResults: String(CREATORS_MAX_VIDEOS),
      part: "snippet",
      order: "viewCount",
      fields:
        "items(id/videoId,snippet(channelId,channelTitle,title,publishedAt))",
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
      });
    });

    const channelIds = Array.from(channelMap.keys());
    let unitsUsed = 100;

    if (!channelIds.length) {
      return {
        data: {
          creators: [],
          summary: { totalVideos: 0, uniqueChannels: 0, byTier: {} },
        },
        quotaUsed: unitsUsed,
      };
    }

    // STEP 2: channels.list (1 unit, batch)
    const channelsParams = new URLSearchParams({
      key: apiKey,
      id: channelIds.slice(0, 50).join(","),
      part: "snippet,statistics",
      maxResults: "50",
      fields:
        "items(id,snippet(title,description,thumbnails/default),statistics(subscriberCount,viewCount,videoCount))",
    });
    const channelsRes = await fetch(`${CHANNELS_URL}?${channelsParams.toString()}`, {
      cache: "no-store",
    });
    unitsUsed += 1;
    if (!channelsRes.ok) {
      const text = await channelsRes.text();
      throw new Error(
        `YouTube channels.list: ${channelsRes.status} ${text.slice(0, 200)}`
      );
    }
    const channelsData = await channelsRes.json();
    const channelStats = new Map();
    (channelsData.items || []).forEach((ch) => channelStats.set(ch.id, ch));

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
          thumbnail: ch.snippet?.thumbnails?.default?.url || null,
          subscribers: subs,
          totalViews,
          videoCount,
          avgViews,
          tier: classifyTier(subs),
          recentUpload,
          relevantVideos: mapEntry.videos.length,
          sampleVideoTitle: sample?.title || "",
          sampleVideoId: sample?.videoId || null,
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
      data: {
        creators,
        summary: {
          totalVideos: items.length,
          uniqueChannels: channelIds.length,
          byTier,
        },
      },
      quotaUsed: unitsUsed,
    };
  });

  const payload = { ...data, quotaUsed };
  cacheSet(key, payload, CACHE_TTL_MS);
  return { ...payload, cacheHit: false, keyIndex, keyHash };
}
