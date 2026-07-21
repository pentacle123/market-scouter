// 검색 갭 (인지 격차) 계산기 — Phase B.
//
// 카테고리 키워드와 후보 브랜드 키워드들의 최근 12개월 상대 검색량 비율로
// 인지 격차 산출. 절대량은 검색광고 API 가 필요하지만 여기서는 상대비율만.
//
// DataLab 는 1요청당 최대 5개 그룹 → 카테고리 1 + 브랜드 4개씩 배치.
// 기존 lib/api/naver.js 의 fetchTrendBatch / defaultDateRange 재사용.

import { fetchTrendBatch, defaultDateRange } from "./naver.js";

function avgRatio(data) {
  if (!Array.isArray(data) || !data.length) return 0;
  return data.reduce((s, d) => s + (Number(d.ratio) || 0), 0) / data.length;
}

/**
 * 카테고리 + 브랜드들 검색 갭 계산.
 *
 * @param {{clientId:string, clientSecret:string}} auth
 * @param {string} categoryKeyword — 카테고리 대표 키워드
 * @param {string[]} brandKeywords — 후보 브랜드/스토어 이름 리스트
 * @param {object} [opts]
 * @param {number} [opts.monthsBack=12]
 * @returns {Promise<{
 *   startDate: string,
 *   endDate: string,
 *   categoryKeyword: string,
 *   categoryAvg: number,
 *   results: Array<{
 *     brand: string,
 *     brandAvg: number,
 *     brandToCatRatio: number,   // brand / category (상대 인지도)
 *     gapScore: number|null,      // 0~100, 100=완전 무명(카테고리 대비 언급 없음), 0=카테고리와 동일
 *     error?: string,
 *   }>,
 *   batches: number,
 *   errors: Array,
 * }>}
 */
export async function computeSearchGap(auth, categoryKeyword, brandKeywords, opts = {}) {
  const monthsBack = opts.monthsBack ?? 12;
  const { startDate, endDate } = defaultDateRange(monthsBack);

  const categoryGroup = {
    groupName: "__category__",
    keywords: [categoryKeyword],
  };

  const results = [];
  const errors = [];
  let categoryAvg = 0;
  let categoryAvgObserved = false;
  let batches = 0;

  // 브랜드가 없으면 카테고리만 조회 (baseline)
  const brands = Array.isArray(brandKeywords) ? brandKeywords : [];
  if (!brands.length) {
    try {
      const res = await fetchTrendBatch(
        auth,
        [categoryGroup],
        startDate,
        endDate,
        "month"
      );
      const catRow = (res.results || []).find((r) => r.title === "__category__");
      categoryAvg = catRow ? avgRatio(catRow.data) : 0;
      categoryAvgObserved = true;
      batches++;
    } catch (e) {
      errors.push({ scope: "category-only", error: e?.message || String(e) });
    }
    return {
      startDate,
      endDate,
      categoryKeyword,
      categoryAvg,
      results,
      batches,
      errors,
    };
  }

  // 브랜드 4개씩 배치 (+ 카테고리 1 = 총 5 그룹)
  for (let i = 0; i < brands.length; i += 4) {
    const brandsBatch = brands.slice(i, i + 4);
    const groups = [
      categoryGroup,
      ...brandsBatch.map((b, idx) => ({
        groupName: `brand_${i + idx}::${b}`.slice(0, 250),
        keywords: [b],
      })),
    ];

    try {
      const res = await fetchTrendBatch(auth, groups, startDate, endDate, "month");
      const rows = res.results || [];
      const catRow = rows.find((r) => r.title === "__category__");
      const catAvgBatch = catRow ? avgRatio(catRow.data) : 0;
      if (!categoryAvgObserved && catAvgBatch > 0) {
        categoryAvg = catAvgBatch;
        categoryAvgObserved = true;
      }

      brandsBatch.forEach((brand, idx) => {
        const brandRow = rows.find(
          (r) => r.title && r.title.startsWith(`brand_${i + idx}::`)
        );
        const brandAvg = brandRow ? avgRatio(brandRow.data) : 0;
        // 갭 정의: 카테고리 대비 얼마나 무명인가.
        //  - brand/cat = 1.0  → 카테고리 만큼 검색 = gap 0
        //  - brand/cat = 0    → 완전 무명 = gap 100
        //  - brand/cat > 1.0  → 카테고리보다 유명 → gap 0 (음수 clamp)
        let ratio = null;
        let gap = null;
        if (catAvgBatch > 0) {
          ratio = brandAvg / catAvgBatch;
          gap = Math.max(0, Math.min(100, 100 * (1 - ratio)));
        }
        results.push({
          brand,
          brandAvg,
          brandToCatRatio: ratio,
          gapScore: gap,
        });
      });
      batches++;
    } catch (e) {
      brandsBatch.forEach((brand) => {
        results.push({
          brand,
          brandAvg: 0,
          brandToCatRatio: null,
          gapScore: null,
          error: e?.message || String(e),
        });
      });
      errors.push({
        scope: `batch-${Math.floor(i / 4)}`,
        error: e?.message || String(e),
      });
    }
  }

  return {
    startDate,
    endDate,
    categoryKeyword,
    categoryAvg,
    results,
    batches,
    errors,
  };
}
