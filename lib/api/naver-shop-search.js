// 네이버 쇼핑 검색 API 클라이언트 (서버 전용).
// 엔드포인트: GET https://openapi.naver.com/v1/search/shop.json
// 인증: 기존 NAVER_CLIENT_ID/SECRET 재활용. 무료 (앱당 일 25,000건).
//
// 파트너 발견용 — 카테고리 키워드로 상품 검색 → 대형 플랫폼/대기업 필터 →
// mallName 기준 셀러 그룹핑 → 전문 셀러(2개+ 상품) 식별.

const SHOP_SEARCH_URL = "https://openapi.naver.com/v1/search/shop.json";

// 대형 종합 플랫폼 — 자체 브랜드/제조사가 아니라 단순 유통이라 파트너 부적합
const LARGE_PLATFORMS = [
  "쿠팡",
  "11번가",
  "G마켓",
  "지마켓",
  "SSG",
  "신세계몰",
  "롯데ON",
  "롯데마트",
  "위메프",
  "티몬",
  "옥션",
  "오늘의집",
  "마켓컬리",
  "컬리",
  "네이버페이",
  "스마트스토어센터",
  "홈플러스",
  "이마트",
  "GS샵",
  "CJ온스타일",
  "현대H몰",
];

// 대기업/이미 충분히 큰 브랜드 — 마케팅 파트너십이 필요 없음
const LARGE_BRANDS = [
  "삼성",
  "엘지",
  "LG",
  "필립스",
  "다이슨",
  "브라운",
  "파나소닉",
  "보쉬",
  "애플",
  "휴롬",
  "쿠쿠",
  "코웨이",
  "청호나이스",
  "스타벅스",
  "제스프리",
  "닥터지",
  "에이피알",
  "오호라",
  "안다르",
  "메디큐브",
  "미닉스",
  "Apple",
  "Samsung",
  "Sony",
];

function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLargePlatform(mall) {
  if (!mall) return false;
  return LARGE_PLATFORMS.some((p) => mall.includes(p));
}
function isLargeBrand(brand) {
  if (!brand) return false;
  const lower = brand.toLowerCase();
  return LARGE_BRANDS.some((b) => brand.includes(b) || lower.includes(b.toLowerCase()));
}

/**
 * 단일 쿼리 상품 검색.
 */
export async function searchShop(auth, query, opts = {}) {
  const params = new URLSearchParams({
    query,
    display: String(opts.display ?? 50),
    sort: opts.sort || "sim",
  });
  const res = await fetch(`${SHOP_SEARCH_URL}?${params.toString()}`, {
    headers: {
      "X-Naver-Client-Id": auth.clientId,
      "X-Naver-Client-Secret": auth.clientSecret,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Naver shop search ("${query}"): ${res.status} ${text.slice(0, 200)}`);
  }
  const j = await res.json();
  return (j.items || []).map((it) => ({
    title: stripHtml(it.title),
    lprice: Number(it.lprice) || 0,
    hprice: Number(it.hprice) || null,
    mallName: it.mallName || "",
    brand: it.brand || "",
    maker: it.maker || "",
    productId: it.productId || "",
    productType: it.productType || "",
    category1: it.category1 || "",
    category2: it.category2 || "",
    category3: it.category3 || "",
    category4: it.category4 || "",
    link: it.link || "",
    image: it.image || "",
  }));
}

/**
 * 카테고리별 검색 → 대형 플랫폼/대기업 필터 → mallName 그룹핑.
 * @returns {Array<{mallName, productCount, brands[], makers[], sampleProducts[], avgPrice, minPrice, maxPrice, isProfessional}>}
 */
export async function findSellersForCategory(auth, query, opts = {}) {
  const products = await searchShop(auth, query, { display: opts.display ?? 50 });

  // 1차 필터 — 대형 플랫폼/대기업/제조사 제외
  const filtered = products.filter((p) => {
    if (isLargePlatform(p.mallName)) return false;
    if (isLargeBrand(p.brand) || isLargeBrand(p.maker)) return false;
    // 가격대 5천원~100만원 외는 제외 (충동구매·어필리에이트 영역에서 벗어남)
    if (p.lprice && (p.lprice < 5000 || p.lprice > 1_000_000)) return false;
    return true;
  });

  // mallName 그룹핑
  const groups = new Map();
  filtered.forEach((p) => {
    const key = p.mallName;
    if (!key) return;
    if (!groups.has(key)) {
      groups.set(key, {
        mallName: key,
        products: [],
        brands: new Set(),
        makers: new Set(),
      });
    }
    const g = groups.get(key);
    g.products.push(p);
    if (p.brand) g.brands.add(p.brand);
    if (p.maker) g.makers.add(p.maker);
  });

  const sellers = Array.from(groups.values()).map((g) => {
    const prices = g.products.map((p) => p.lprice).filter((n) => n > 0);
    const avgPrice =
      prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    return {
      mallName: g.mallName,
      productCount: g.products.length,
      brands: Array.from(g.brands),
      makers: Array.from(g.makers),
      sampleProducts: g.products.slice(0, 3),
      avgPrice,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      isProfessional: g.products.length >= 2,
      categories: Array.from(new Set(g.products.map((p) => p.category3 || p.category2).filter(Boolean))),
    };
  });

  // 정렬: 전문 셀러 우선, 상품 수 많은 순
  sellers.sort((a, b) => {
    if (a.isProfessional !== b.isProfessional) return a.isProfessional ? -1 : 1;
    return b.productCount - a.productCount;
  });

  return {
    rawCount: products.length,
    filteredCount: filtered.length,
    sellers,
  };
}

export { stripHtml };
