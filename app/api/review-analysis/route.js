import { D, SUBSTITUTE_KEYWORDS } from "@/lib/data";
import { searchReviewQueries } from "@/lib/api/naver";
import { analyzeReviews } from "@/lib/api/claude";
import { scanUSReviewsWithComments } from "@/lib/api/youtube";
import { getKeysStatus } from "@/lib/api/youtube-keys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/review-analysis?categoryId=1&includeUS=false
 *
 * type 분기 (자동):
 *   - "no" (비추천)       → 거부 (분석 가치 없음)
 *   - "blue" (블루오션)    → US YouTube 댓글 + 한국 네이버 블로그(대체재) 자동 통합
 *   - "gap" / "cond"      → 한국 네이버 블로그만 기본, includeUS=true 시 YouTube 댓글 추가
 *
 * 단계:
 *   1) 네이버 블로그 — 3쿼리 × 10건 = 30 (무료)
 *   2) (블루오션 자동 또는 includeUS=true) US YouTube 영상 5개 + 댓글 ~250개 = ~105 units
 *   3) Claude 종합 분석 — ~$0.02 (블루오션 종합 시 ~$0.03)
 */
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
  const overrideKwKR = searchParams.get("kwKR");
  const overrideKwUS = searchParams.get("kwUS");
  const overrideName = searchParams.get("n");
  const overrideType = searchParams.get("type");

  // 카테고리 — 커스텀(1000+)이면 query 로 받기, 아니면 D 에서
  let cat;
  if (categoryId >= 1000) {
    cat = {
      id: categoryId,
      n: overrideName || `custom-${categoryId}`,
      type: overrideType || "blue",
      kw: { KR: overrideKwKR || "", US: overrideKwUS || "" },
    };
  } else {
    cat = D.find((c) => c.id === categoryId);
  }
  if (!cat) {
    return Response.json({ error: `category ${categoryId} not found` }, { status: 404 });
  }

  // type=no 거부 (사업적으로 분석 가치 없음)
  if (cat.type === "no") {
    return Response.json(
      {
        error: "비추천(❌) 카테고리는 리뷰 분석 대상이 아닙니다. 다른 카테고리를 선택하세요.",
        type: cat.type,
      },
      { status: 400 }
    );
  }

  const isBlueOcean = cat.type === "blue";
  const needYoutube = isBlueOcean || includeUS;
  const subs = SUBSTITUTE_KEYWORDS[cat.id];
  const isSubstitute = isBlueOcean && Array.isArray(subs) && subs.length > 0;
  const baseTerm = isSubstitute ? subs[0] : cat.kw?.KR || cat.n;
  const substituteName = isSubstitute ? subs[0] : null;

  const queries = [
    `${baseTerm} 후기`,
    `${baseTerm} 단점`,
    `${baseTerm} 솔직 리뷰`,
  ];

  const startedAt = Date.now();

  // Step 1: 네이버 블로그 검색 (병렬 처리 가능 — YouTube 와 동시 실행)
  const blogPromise = searchReviewQueries(
    { clientId: naverId, clientSecret: naverSecret },
    queries,
    { displayPerQuery: 10 }
  ).catch((e) => ({ blogs: [], failed: [{ error: e?.message || String(e) }] }));

  // Step 2: YouTube 댓글 (블루오션 자동 OR includeUS=true)
  const ytPromise = needYoutube
    ? scanUSReviewsWithComments(cat.kw?.US || cat.n).catch((e) => ({
        videos: [],
        comments: [],
        commentErrors: [],
        quotaUsed: 0,
        error: e?.message || String(e),
      }))
    : Promise.resolve(null);

  const [blogResult, ytResult] = await Promise.all([blogPromise, ytPromise]);

  // 데이터 소스 검증 — 최소 한 쪽은 의미 있는 양이어야
  const blogCount = blogResult.blogs?.length || 0;
  const ytCommentCount = ytResult?.comments?.length || 0;
  if (blogCount === 0 && ytCommentCount === 0) {
    return Response.json(
      {
        error: "양쪽 소스 모두 0건 — 네이버 권한 또는 YouTube 쿼터 확인 필요",
        stage: "collect",
        baseTerm,
        blogFailed: blogResult.failed,
        ytError: ytResult?.error,
        hint:
          "네이버 '검색' API 권한이 등록됐는지, YouTube 일일 쿼터가 남았는지 확인. 둘 중 하나만 살아있어도 분석 가능합니다.",
      },
      { status: 502 }
    );
  }

  // Step 3: Claude 종합 분석
  let analysis;
  try {
    analysis = await analyzeReviews(claudeKey, {
      categoryName: cat.n,
      isSubstitute,
      substituteName,
      blogs: blogResult.blogs,
      ytComments: ytResult?.comments || [],
      ytVideos: ytResult?.videos || [],
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
    blogCount,
    ytCommentCount,
    blogFailed: blogResult.failed,
    sampleBlogTitles: blogResult.blogs.slice(0, 5).map((b) => b.title),
    youtube: {
      enabled: needYoutube,
      auto: isBlueOcean,
      videoCount: ytResult?.videos?.length || 0,
      commentCount: ytCommentCount,
      commentErrors: ytResult?.commentErrors || [],
      quotaUsed: ytResult?.quotaUsed || 0,
      error: ytResult?.error || null,
      keysStatus: needYoutube ? getKeysStatus() : undefined,
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
