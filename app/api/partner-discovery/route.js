import { D } from "@/lib/data";
import { findSellersForCategory } from "@/lib/api/naver-shop-search";
import { checkBrandReviews } from "@/lib/api/naver";
import { checkBrandShorts } from "@/lib/api/youtube";
import { analyzePartners } from "@/lib/api/claude";
import { getKeysStatus } from "@/lib/api/youtube-keys";
import { getQuotaUsage } from "@/lib/server-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/partner-discovery
 * body: {
 *   categoryIds: [1,2,...],         // 카테고리 ID 배열 (no 타입은 자동 제외)
 *   includeYoutube: false,           // YT 쇼츠 체크 포함 여부
 *   naverTrendCache: [...],          // 클라이언트가 보낸 검색 트렌드 캐시 (성장률 산출용)
 *   topSellersPerCategory: 5,        // 카테고리당 분석할 셀러 수 (네이버 블로그)
 *   topYoutubePerCategory: 3,        // 카테고리당 YouTube 체크할 셀러 수
 * }
 *
 * 5단계:
 *   1) 네이버 쇼핑 검색 → 상품 50개 → 대형 필터 → 셀러 그룹핑 (카테고리당 무료)
 *   2) 네이버 블로그 → 상위 셀러 5곳 × 2쿼리 = 10건 (무료)
 *   3) YouTube 쇼츠 → 상위 셀러 3곳 × 100u = 300u/카테고리 (선택)
 *   4) 카테고리 성장률 (검색 트렌드 캐시에서)
 *   5) Claude 종합 분석 → 파트너 랭킹 (~$0.02)
 *
 * Vercel maxDuration 60s 제약 — 카테고리 1~3개 권장. 더 많으면 클라이언트가 분할 호출.
 */
export async function POST(req) {
  const naverId = process.env.NAVER_CLIENT_ID;
  const naverSecret = process.env.NAVER_CLIENT_SECRET;
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!naverId || !naverSecret) {
    return Response.json(
      { error: "NAVER_CLIENT_ID/SECRET 환경변수가 필요합니다. (검색 + 데이터랩 API 권한 모두)" },
      { status: 500 }
    );
  }
  if (!claudeKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY 환경변수가 필요합니다." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const {
    categoryIds = [],
    includeYoutube = false,
    naverTrendCache = null,
    topSellersPerCategory = 5,
    topYoutubePerCategory = 3,
  } = body;

  if (!Array.isArray(categoryIds) || !categoryIds.length) {
    return Response.json({ error: "categoryIds 가 비어있습니다." }, { status: 400 });
  }

  // type=no 자동 제외 (사업적으로 파트너 발견 가치 없음)
  const cats = D.filter((c) => categoryIds.includes(c.id) && c.type !== "no");
  if (!cats.length) {
    return Response.json(
      { error: "선택한 카테고리 중 분석 대상이 없습니다. (no 타입은 자동 제외)" },
      { status: 400 }
    );
  }
  if (cats.length > 4) {
    return Response.json(
      { error: "한 번에 최대 4개 카테고리까지 가능 (Vercel 60s 제약). 분할 호출 권장." },
      { status: 400 }
    );
  }

  const naverAuth = { clientId: naverId, clientSecret: naverSecret };
  const startedAt = Date.now();
  const scans = [];
  let ytQuotaUsed = 0;
  const errors = [];

  // 카테고리 루프
  for (const cat of cats) {
    try {
      // Step 1: 쇼핑 검색
      const { sellers, rawCount, filteredCount } = await findSellersForCategory(
        naverAuth,
        cat.kw?.KR || cat.n,
        { display: 50 }
      );
      const topSellers = sellers.slice(0, topSellersPerCategory);

      // Step 2: 블로그 리뷰 (병렬)
      const reviewSettled = await Promise.allSettled(
        topSellers.map((s) => checkBrandReviews(naverAuth, s.mallName, { displayPerQuery: 10 }))
      );
      const withReview = topSellers.map((s, idx) => {
        const r = reviewSettled[idx];
        return {
          ...s,
          review: r.status === "fulfilled" ? r.value : null,
          reviewError: r.status === "rejected" ? (r.reason?.message || "review failed") : null,
        };
      });

      // Step 3: YouTube 쇼츠 (선택, 상위 N 셀러만)
      let withYoutube = withReview;
      if (includeYoutube) {
        const targets = withReview.slice(0, topYoutubePerCategory);
        const ytSettled = await Promise.allSettled(
          targets.map((s) => checkBrandShorts(s.mallName))
        );
        const ytMap = new Map();
        ytSettled.forEach((r, idx) => {
          if (r.status === "fulfilled") {
            ytMap.set(targets[idx].mallName, r.value);
            ytQuotaUsed += r.value.quotaUsed || 0;
          } else {
            errors.push({
              categoryId: cat.id,
              mallName: targets[idx].mallName,
              stage: "youtube",
              error: r.reason?.message || "yt failed",
            });
          }
        });
        withYoutube = withReview.map((s) => ({
          ...s,
          youtube: ytMap.get(s.mallName) || null,
        }));
      }

      // Step 4: 카테고리 성장률 (캐시에서)
      const trendEntry = Array.isArray(naverTrendCache)
        ? naverTrendCache.find((t) => t.id === cat.id)
        : null;
      const growth = trendEntry?.mom?.deltaPct ?? null;

      scans.push({
        categoryId: cat.id,
        categoryName: cat.n,
        rawProductCount: rawCount,
        filteredProductCount: filteredCount,
        sellerCount: sellers.length,
        growth,
        sellers: withYoutube,
      });
    } catch (e) {
      errors.push({
        categoryId: cat.id,
        stage: "shop-search",
        error: e?.message || String(e),
      });
    }
  }

  if (!scans.length) {
    return Response.json(
      {
        error: "모든 카테고리 수집 실패 — 네이버 쇼핑/검색 API 권한 확인 필요.",
        errors,
        hint:
          "네이버 개발자센터에서 '검색' API 권한을 등록했는지 확인하세요. 쇼핑 검색과 블로그 검색 모두 '검색' API 권한이 필요합니다.",
      },
      { status: 502 }
    );
  }

  // Step 5: Claude 종합 분석
  let claudeResult;
  try {
    claudeResult = await analyzePartners(claudeKey, { scans });
  } catch (e) {
    return Response.json(
      { error: e?.message || String(e), stage: "claude", scans, errors },
      { status: 502 }
    );
  }

  return Response.json({
    scannedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    categories: cats.map((c) => ({ id: c.id, n: c.n, type: c.type })),
    youtube: {
      enabled: includeYoutube,
      quotaUsed: ytQuotaUsed,
      quotaUsedToday: getQuotaUsage(),
      keysStatus: includeYoutube ? getKeysStatus() : undefined,
    },
    claude: {
      usage: claudeResult.usage,
      estCostUSD: claudeResult.estCostUSD,
      parseError: claudeResult.parseError,
      raw: claudeResult.parseError ? claudeResult.raw : null,
    },
    partners: claudeResult.partners,
    summary: claudeResult.summary,
    scans, // 디버그용 — 원본 셀러/리뷰/쇼츠 데이터
    errors,
  });
}
