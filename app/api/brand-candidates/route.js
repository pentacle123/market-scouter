import { D } from "@/lib/data";
import { findSellersForCategory } from "@/lib/api/naver-shop-search";
import { checkBrandReviews } from "@/lib/api/naver";
import { judgeLargeBrands } from "@/lib/api/claude-brand";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/brand-candidates?categoryId=13
 *
 * Step 2 후보 수집:
 *   1. lib/data.js 에서 카테고리 조회
 *   2. 네이버 쇼핑 검색 50개 → 대형 플랫폼/대기업 하드코딩 필터 → 셀러 mallName 그룹핑
 *      (기존 lib/api/naver-shop-search.js 재사용)
 *   3. 상위 셀러 15곳에 대해 병렬 checkBrandReviews (블로그 리뷰수·감성 스코어)
 *      (기존 lib/api/naver.js 재사용)
 *   4. 필터: blogReviewCount >= 20 AND sentimentScore >= 60
 *   5. Claude judgeLargeBrands 로 애매한 브랜드 재검증 (isLarge=true 제외)
 *   6. 카테고리당 상위 2~3 최종 후보
 *
 * 응답에 셀러별 필터 통과/탈락 사유를 모두 포함해 UI 전 임계값 조정을 지원.
 *
 * 필터 임계값 (파라미터로 조정 가능):
 *   - minBlogReviews  기본 20
 *   - minSentiment    기본 60
 *   - topSellersToCheck  기본 15 (블로그 조회 대상 셀러 수)
 *   - topFinalCandidates 기본 3 (최종 후보 개수)
 *   - includeClaudeJudge 기본 true
 */
export async function GET(req) {
  const naverId = process.env.NAVER_CLIENT_ID;
  const naverSecret = process.env.NAVER_CLIENT_SECRET;
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!naverId || !naverSecret) {
    return Response.json(
      {
        error: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 필요합니다.",
        hint: "쇼핑 검색과 블로그 검색 모두 '검색' API 권한이 등록되어 있어야 합니다.",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const categoryId = Number(searchParams.get("categoryId"));
  const minBlogReviews = Number(searchParams.get("minBlogReviews") ?? 20);
  const minSentiment = Number(searchParams.get("minSentiment") ?? 60);
  const topSellersToCheck = Number(searchParams.get("topSellersToCheck") ?? 15);
  const topFinalCandidates = Number(searchParams.get("topFinalCandidates") ?? 3);
  const includeClaudeJudge = searchParams.get("includeClaudeJudge") !== "false";

  const cat = D.find((c) => c.id === categoryId);
  if (!cat) {
    return Response.json({ error: `category ${categoryId} not found` }, { status: 404 });
  }

  const startedAt = Date.now();
  const naverAuth = { clientId: naverId, clientSecret: naverSecret };

  // Step 1: 쇼핑 검색 + 하드코딩 필터 + 셀러 그룹핑
  let shopResult;
  try {
    shopResult = await findSellersForCategory(
      naverAuth,
      cat.kw?.KR || cat.n,
      { display: 50 }
    );
  } catch (e) {
    return Response.json(
      {
        error: e?.message || String(e),
        stage: "shop-search",
        hint: "네이버 '검색' API 권한이 등록되어 있는지 확인하세요.",
      },
      { status: 502 }
    );
  }

  const allSellers = shopResult.sellers || [];
  if (!allSellers.length) {
    return Response.json(
      {
        error: "필터 통과 셀러 0곳 — 카테고리 키워드/필터 임계값을 확인하세요.",
        stage: "seller-filter",
        stats: {
          rawProductCount: shopResult.rawCount,
          filteredProductCount: shopResult.filteredCount,
        },
      },
      { status: 502 }
    );
  }

  // Step 2: 상위 N 셀러의 블로그 리뷰 병렬 조회
  const topSellers = allSellers.slice(0, topSellersToCheck);
  const reviewSettled = await Promise.allSettled(
    topSellers.map((s) =>
      checkBrandReviews(naverAuth, s.mallName, { displayPerQuery: 10 })
    )
  );

  // Step 3: 셀러별 통과/탈락 사유 계산
  const sellersWithReview = topSellers.map((s, idx) => {
    const rr = reviewSettled[idx];
    const review = rr.status === "fulfilled" ? rr.value : null;
    const reviewError =
      rr.status === "rejected" ? rr.reason?.message || String(rr.reason) : null;

    let passedFilter = false;
    let rejectReason = null;

    if (reviewError) {
      rejectReason = `블로그 조회 실패: ${reviewError.slice(0, 100)}`;
    } else if (!review || review.blogCount < minBlogReviews) {
      rejectReason = `블로그 리뷰 ${review?.blogCount ?? 0} < ${minBlogReviews}`;
    } else if (review.sentimentScore < minSentiment) {
      rejectReason = `감성 스코어 ${review.sentimentScore}% < ${minSentiment}%`;
    } else {
      passedFilter = true;
    }

    return {
      mallName: s.mallName,
      productCount: s.productCount,
      brands: s.brands,
      makers: s.makers,
      isProfessional: s.isProfessional,
      avgPrice: s.avgPrice,
      priceRange:
        s.minPrice && s.maxPrice
          ? `${s.minPrice.toLocaleString()}~${s.maxPrice.toLocaleString()}원`
          : null,
      sampleProducts: s.sampleProducts?.slice(0, 2).map((p) => ({
        title: p.title,
        lprice: p.lprice,
        link: p.link,
      })),
      blogReviewCount: review?.blogCount ?? null,
      sentimentScore: review?.sentimentScore ?? null,
      scaleSignal: review?.scaleSignal ?? null,
      reviewSampleTitles: review?.sampleTitles?.slice(0, 2) ?? [],
      passedFilter,
      rejectReason,
    };
  });

  // Step 4: 필터 통과 셀러
  const passed = sellersWithReview.filter((s) => s.passedFilter);

  // Step 5: (옵션) Claude 대기업 판별 — 통과한 상위 5명만 (비용 절약)
  let claudeJudgment = null;
  const judgeTargets = passed.slice(0, 5);
  if (includeClaudeJudge && claudeKey && judgeTargets.length > 0) {
    try {
      const judgeInput = judgeTargets.map((s) => ({
        brandName: s.mallName,
        productCount: s.productCount,
        blogReviewCount: s.blogReviewCount,
        sampleProduct: s.sampleProducts?.[0]?.title,
      }));
      const judgeResult = await judgeLargeBrands(claudeKey, judgeInput);
      claudeJudgment = judgeResult;

      // 판별 결과 반영 — isLarge 인 셀러는 최종 후보에서 제외
      judgeResult.brands.forEach((jb) => {
        const target = passed.find((s) => s.mallName === jb.brandName);
        if (target) {
          target.claudeIsLarge = jb.isLarge;
          target.claudeConfidence = jb.confidence;
          target.claudeReason = jb.reason;
          if (jb.isLarge && jb.confidence >= 60) {
            target.passedFilter = false;
            target.rejectReason = `Claude: 대기업 판별 (${jb.reason})`;
          }
        }
      });
    } catch (e) {
      claudeJudgment = { error: e?.message || String(e) };
    }
  }

  // Step 6: 최종 통과 후보 정렬 (전문 셀러 우선 · 감성 스코어 우선)
  const finalCandidates = sellersWithReview
    .filter((s) => s.passedFilter)
    .sort((a, b) => {
      if (a.isProfessional !== b.isProfessional) return a.isProfessional ? -1 : 1;
      return (b.sentimentScore ?? 0) - (a.sentimentScore ?? 0);
    })
    .slice(0, topFinalCandidates);

  return Response.json({
    scannedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    category: { id: cat.id, n: cat.n, type: cat.type, kwKR: cat.kw?.KR },
    filters: {
      minBlogReviews,
      minSentiment,
      topSellersToCheck,
      topFinalCandidates,
      includeClaudeJudge,
      // 대형 플랫폼/대기업 필터는 lib/api/naver-shop-search.js 의 하드코딩 리스트 사용
      largeFilterApplied: true,
    },
    stats: {
      rawProductCount: shopResult.rawCount,
      filteredProductCount: shopResult.filteredCount,
      sellerCandidates: allSellers.length,
      sellersChecked: topSellers.length,
      passedFilter: passed.filter((s) => s.passedFilter).length,
      finalCandidates: finalCandidates.length,
    },
    sellers: sellersWithReview,
    finalCandidates,
    claudeJudgment,
  });
}
