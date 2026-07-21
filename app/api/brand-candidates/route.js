import { D } from "@/lib/data";
import { findSellersForCategory } from "@/lib/api/naver-shop-search";
import { checkBrandReviews } from "@/lib/api/naver";
import { judgeLargeBrands, spotCheckBrand } from "@/lib/api/claude-brand";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/brand-candidates?categoryId=13
 *
 * Step 2 후보 수집 (v2 — 필터 방향 재정의):
 *   원칙: "제품 좋음 + 마케팅 조용함" 이 타깃. 블로그 후기 수는 마케팅 활동량
 *         프록시이므로 필터가 아니라 **시그널** 로 활용.
 *
 *   1. lib/data.js 에서 카테고리 조회
 *   2. 네이버 쇼핑 검색 50개 → 대형 플랫폼/대기업 하드코딩 필터 → 셀러 그룹핑
 *      (기존 lib/api/naver-shop-search.js 재사용)
 *   3. 셀러 상품수 필터: productCount >= 2 (스팸/1회성 미달 배제, ≥3 은 원프로덕트 D2C 배제 위험)
 *   4. 상위 15개 셀러에 대해 병렬 checkBrandReviews (블로그 리뷰수·감성)
 *   5. blogSignal 산출 (silent<5 / weak<10 / sweetspot<=200 / saturated>200)
 *      - saturated 만 필터 탈락 (이미 마케팅 활발)
 *      - 나머지는 시그널로 남기고 통과
 *   6. 감성 필터: 블로그 표본 >=20 일 때만 sentiment 검사 (표본 부족 시 판단 유보로 통과)
 *   7. Claude judgeLargeBrands 로 상위 통과 브랜드 재검증 (isLarge=true 제외)
 *   8. 카테고리당 상위 topFinalCandidates (기본 3) 최종 후보
 *   9. spotCheckFinal=true (기본) → 최종 후보에 Claude 웹검색 스팟 확인
 *      (제품 리뷰수·평점 + SNS·언론·마케터 채용공고)
 *
 * 응답에 셀러별 통과/탈락 사유·경고·blogSignal 을 모두 포함해 UI 전 임계값 조정 지원.
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
  const minProductCount = Number(searchParams.get("minProductCount") ?? 2);
  const minSentiment = Number(searchParams.get("minSentiment") ?? 60);
  const sentimentMinSample = Number(searchParams.get("sentimentMinSample") ?? 20);
  const topSellersToCheck = Number(searchParams.get("topSellersToCheck") ?? 15);
  const topFinalCandidates = Number(searchParams.get("topFinalCandidates") ?? 3);
  const includeClaudeJudge = searchParams.get("includeClaudeJudge") !== "false";
  const spotCheckFinal = searchParams.get("spotCheckFinal") !== "false";

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

  // Step 3: 셀러별 시그널/통과/탈락 계산
  const SIGNAL_LABELS = {
    silent: "개입 여지 큼 (수요 검증 필요)",
    weak: "개입 여지 큼 (수요 검증 필요)",
    sweetspot: "수요 검증 + 저활성 (균형)",
    saturated: "개입 여지 작음",
  };

  const sellersWithReview = topSellers.map((s, idx) => {
    const rr = reviewSettled[idx];
    const review = rr.status === "fulfilled" ? rr.value : null;
    const reviewError =
      rr.status === "rejected" ? rr.reason?.message || String(rr.reason) : null;

    const blogCount = review?.blogCount ?? null;
    const sentiment = review?.sentimentScore ?? null;
    const blogSignal = review?.scaleSignal ?? null;

    let passedFilter = true;
    let rejectReason = null;
    const warnings = [];

    // (a) 상품수 하한 — 스팸/1회성 셀러 배제
    if (s.productCount < minProductCount) {
      passedFilter = false;
      rejectReason = `상품수 ${s.productCount} < ${minProductCount} (스팸/1회성 미달)`;
    }
    // (b) 이미 마케팅 활발 (blog saturated)
    else if (blogSignal === "saturated") {
      passedFilter = false;
      rejectReason = `블로그 후기 ${blogCount}건 (200+) — 이미 마케팅 활발, 개입 여지 작음`;
    }
    // (c) 표본 충분 시에만 감성 필터
    else if (
      blogCount !== null &&
      blogCount >= sentimentMinSample &&
      sentiment !== null &&
      sentiment < minSentiment
    ) {
      passedFilter = false;
      rejectReason = `표본 ${blogCount}건 · 감성 ${sentiment}% < ${minSentiment}% (제품 불만 신호)`;
    }

    // 경고 (필터 탈락은 아니지만 UI 에서 유보 표시)
    if (reviewError) {
      warnings.push(`블로그 조회 실패 — 감성 판정 유보`);
    }
    if (
      passedFilter &&
      blogCount !== null &&
      blogCount < sentimentMinSample &&
      !reviewError
    ) {
      warnings.push(`블로그 표본 ${blogCount} < ${sentimentMinSample} · 감성 판정 유보`);
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
      blogReviewCount: blogCount,
      sentimentScore: sentiment,
      blogSignal,
      blogSignalLabel: blogSignal ? SIGNAL_LABELS[blogSignal] : null,
      reviewSampleTitles: review?.sampleTitles?.slice(0, 2) ?? [],
      passedFilter,
      rejectReason,
      warnings,
    };
  });

  const passed = sellersWithReview.filter((s) => s.passedFilter);

  // Step 4: (옵션) Claude 대기업 판별 — 통과한 상위 5명만
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

  // Step 5: 최종 후보 정렬 (전문셀러 > 침묵 시그널 > 감성)
  const SIGNAL_RANK = { silent: 4, weak: 3, sweetspot: 2, saturated: 1 };
  const finalCandidates = sellersWithReview
    .filter((s) => s.passedFilter)
    .sort((a, b) => {
      if (a.isProfessional !== b.isProfessional) return a.isProfessional ? -1 : 1;
      const ra = SIGNAL_RANK[a.blogSignal] ?? 0;
      const rb = SIGNAL_RANK[b.blogSignal] ?? 0;
      if (ra !== rb) return rb - ra;
      return (b.sentimentScore ?? 0) - (a.sentimentScore ?? 0);
    })
    .slice(0, topFinalCandidates);

  // Step 6: 최종 후보 웹검색 스팟 확인 (기본 on)
  let spotCheckMeta = null;
  if (spotCheckFinal && claudeKey && finalCandidates.length > 0) {
    const spotSettled = await Promise.allSettled(
      finalCandidates.map((s) =>
        spotCheckBrand(claudeKey, s.mallName, cat.kw?.KR || cat.n)
      )
    );
    let totalCost = 0;
    let ok = 0;
    let failed = 0;
    spotSettled.forEach((sr, idx) => {
      if (sr.status === "fulfilled") {
        finalCandidates[idx].spotCheck = sr.value;
        totalCost += sr.value.estCostUSD || 0;
        ok++;
      } else {
        finalCandidates[idx].spotCheck = {
          error: sr.reason?.message || String(sr.reason),
        };
        failed++;
      }
    });
    spotCheckMeta = { ok, failed, totalEstCostUSD: totalCost };
  }

  return Response.json({
    scannedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    category: { id: cat.id, n: cat.n, type: cat.type, kwKR: cat.kw?.KR },
    filters: {
      minProductCount,
      minSentiment,
      sentimentMinSample,
      topSellersToCheck,
      topFinalCandidates,
      includeClaudeJudge,
      spotCheckFinal,
      largeFilterApplied: true,
      note:
        "블로그 리뷰수는 '병목 시그널' 로만 사용 (필터 아님). " +
        "sentiment 는 표본 ≥ sentimentMinSample 인 경우에만 적용.",
    },
    stats: {
      rawProductCount: shopResult.rawCount,
      filteredProductCount: shopResult.filteredCount,
      sellerCandidates: allSellers.length,
      sellersChecked: topSellers.length,
      passedFilter: sellersWithReview.filter((s) => s.passedFilter).length,
      finalCandidates: finalCandidates.length,
    },
    sellers: sellersWithReview,
    finalCandidates,
    claudeJudgment,
    spotCheckMeta,
  });
}
