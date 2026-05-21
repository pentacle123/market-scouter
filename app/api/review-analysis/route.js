import { D, SUBSTITUTE_KEYWORDS } from "@/lib/data";
import { searchReviewQueries } from "@/lib/api/naver";
import { analyzeReviews } from "@/lib/api/claude";
import { callWithKeyRotation, getKeysStatus } from "@/lib/api/youtube-keys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/review-analysis?categoryId=1&includeUS=false
 *
 * 단계:
 *   1) 네이버 블로그 검색 — 3개 쿼리 × 10건 = 30 블로그 (무료)
 *      · 블루오션/대체재 매핑된 카테고리는 대체재 키워드 사용
 *   2) (선택) YouTube US "[product] review honest" 1 검색 = 100 units
 *   3) Claude API 분석 (~$0.01~0.02)
 */

const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

async function fetchUSReviewVideos(query) {
  const { data, quotaUsed, keyIndex, keyHash } = await callWithKeyRotation(async (apiKey) => {
    const params = new URLSearchParams({
      key: apiKey,
      q: `${query} review honest`,
      type: "video",
      regionCode: "US",
      relevanceLanguage: "en",
      maxResults: "10",
      part: "snippet",
      order: "viewCount",
      fields: "items(id/videoId,snippet/title)",
    });
    const res = await fetch(`${YT_SEARCH_URL}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YouTube US review search: ${res.status} ${text.slice(0, 200)}`);
    }
    const j = await res.json();
    const videos = (j.items || [])
      .map((it) => ({ title: it.snippet?.title, videoId: it.id?.videoId }))
      .filter((v) => v.title);
    return { data: { videos }, quotaUsed: 100 };
  });
  return { videos: data.videos, quotaUsed, keyIndex, keyHash };
}

export async function GET(req) {
  const naverId = process.env.NAVER_CLIENT_ID;
  const naverSecret = process.env.NAVER_CLIENT_SECRET;
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!naverId || !naverSecret) {
    return Response.json(
      { error: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }
  if (!claudeKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const categoryId = Number(searchParams.get("categoryId"));
  const includeUS = searchParams.get("includeUS") === "true";

  const cat = D.find((c) => c.id === categoryId);
  if (!cat) {
    return Response.json({ error: `category ${categoryId} not found` }, { status: 404 });
  }

  // 검색 키워드 결정 — 블루오션이면 대체재, 아니면 카테고리 KR 키워드
  const subs = SUBSTITUTE_KEYWORDS[cat.id];
  // 우선순위: blue 면 무조건 대체재 (매핑 없으면 한국 키워드라도)
  //          gap/cond/no 면 카테고리 KR 키워드. 단, 매핑이 있고 한국 검색 0 추정이면 대체재 (간단화: blue 만 대체재)
  const isSubstitute = cat.type === "blue" && Array.isArray(subs) && subs.length > 0;
  const baseTerm = isSubstitute ? subs[0] : cat.kw?.KR || cat.n;
  const substituteName = isSubstitute ? subs[0] : null;

  const queries = [
    `${baseTerm} 후기`,
    `${baseTerm} 단점`,
    `${baseTerm} 솔직 리뷰`,
  ];

  const startedAt = Date.now();

  // Step 1: 네이버 블로그 검색
  let blogResult;
  try {
    blogResult = await searchReviewQueries(
      { clientId: naverId, clientSecret: naverSecret },
      queries,
      { displayPerQuery: 10 }
    );
  } catch (e) {
    return Response.json(
      { error: e?.message || String(e), stage: "naver" },
      { status: 502 }
    );
  }

  if (!blogResult.blogs.length) {
    return Response.json(
      {
        error: "네이버 블로그 결과가 0건입니다. 권한 또는 키워드 문제일 수 있습니다.",
        stage: "naver",
        queries,
        baseTerm,
        blogFailed: blogResult.failed,
        hint:
          "네이버 개발자센터 → 애플리케이션 상세 → 'API 설정' 에서 '검색' API 를 추가해야 합니다. 데이터랩(검색어 트렌드)·쇼핑인사이트와 별개 권한입니다.",
      },
      { status: 502 }
    );
  }

  // Step 2: (선택) YouTube US 리뷰 영상
  let ytVideos = [];
  let ytQuotaUsed = 0;
  let ytError = null;
  if (includeUS) {
    try {
      const yt = await fetchUSReviewVideos(cat.kw?.US || cat.n);
      ytVideos = yt.videos;
      ytQuotaUsed = yt.quotaUsed;
    } catch (e) {
      ytError = e?.message || String(e);
    }
  }

  // Step 3: Claude 분석
  let analysis;
  try {
    analysis = await analyzeReviews(claudeKey, {
      categoryName: cat.n,
      isSubstitute,
      substituteName,
      blogs: blogResult.blogs,
      ytVideos,
    });
  } catch (e) {
    return Response.json(
      { error: e?.message || String(e), stage: "claude" },
      { status: 502 }
    );
  }

  return Response.json({
    id: cat.id,
    n: cat.n,
    type: cat.type,
    isSubstitute,
    substituteName,
    baseTerm,
    queries,
    blogCount: blogResult.blogs.length,
    blogFailed: blogResult.failed,
    sampleBlogTitles: blogResult.blogs.slice(0, 5).map((b) => b.title),
    youtube: {
      enabled: includeUS,
      videoCount: ytVideos.length,
      quotaUsed: ytQuotaUsed,
      error: ytError,
      keysStatus: includeUS ? getKeysStatus() : undefined,
    },
    claude: {
      usage: analysis.usage,
      estCostUSD: analysis.estCostUSD,
      parseError: analysis.parseError,
      raw: analysis.parseError ? analysis.raw : null,
    },
    analysis: analysis.result,
    scannedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
  });
}
