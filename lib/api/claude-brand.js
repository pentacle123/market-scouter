// 브랜드 발굴 전용 Claude 함수 — Phase B.
//
// Phase B: judgeLargeBrands — 대기업/유명 브랜드 자동 판별 (Step 2 후보 수집 필터).
// Phase B.1: spotCheckBrand — 최종 후보 웹검색 스팟 확인
//   (제품 리뷰수·평점 + 마케팅 조용함 + 마케터 채용공고).
// Phase C 에서 추가 예정: scoreBrand4Axis (4축 스코어링), generateContactBrief (Step 5).

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
export const PRICE_PER_M_BRAND = { input: 3, output: 15 };

function safeParseJson(text) {
  if (!text) return { data: null, parseError: "empty" };
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  try {
    return { data: JSON.parse(s), parseError: null };
  } catch (e) {
    return { data: null, parseError: e.message };
  }
}

// ─── Step 2: 대기업/유명 브랜드 판별 ──────────────────────────────────────────
//
// naver-shop-search.js 의 하드코딩 LARGE_PLATFORMS/LARGE_BRANDS 필터 통과 후,
// 여전히 애매한 브랜드들(리뷰 규모가 200+ 등 큰 규모) 을 Claude 로 재검증.

const LARGE_BRAND_JUDGE_PROMPT = `당신은 광고대행사 Pentacle 의 브랜드 심사관입니다.
후보 브랜드/셀러가 "이미 충분히 큰 대기업/유명 브랜드/종합 유통사" 인지 판별합니다.
Pentacle 은 "제품력은 있는데 숏폼 마케팅이 부족한 회사" 를 찾으므로, 이미 크거나 유명한
회사는 후보에서 제외해야 합니다.

# 판별 기준
- 대기업 지배 브랜드 (예: 삼성·LG·필립스·다이슨·브라운·파나소닉·애플·소니)
- 이미 대형 마케팅 예산·유통망을 가진 유명 브랜드
  (예: 오호라·안다르·메디큐브·미닉스·에이피알·에코마케팅·헬로마시멜로)
- 종합 유통사·플랫폼 (쿠팡·11번가·마켓컬리·SSG·G마켓·오늘의집)
- 이미 유명한 스타트업/D2C 브랜드 (100만+ 팔로워, 대형 크리에이터 컬래버 활발)

# 판별 원칙
- 확실히 소규모/무명 스타트업 셀러 → isLarge: false
- 이름을 아는 대기업/유명 브랜드 → isLarge: true, confidence 높게
- 애매한 경우 → 보수적으로 isLarge: false + confidence 낮게 (기회 놓치지 않기)
- reason 은 판별 근거 1문장

# 응답 규칙
- JSON 만 반환, 코드 펜스 금지.
- brands 배열의 순서와 개수는 입력과 동일하게 유지.

# JSON 스키마
{
  "brands": [
    {
      "brandName": "입력받은 그대로",
      "isLarge": true,
      "confidence": 0,
      "reason": "판별 근거 (60자)"
    }
  ]
}`;

/**
 * 브랜드 목록에서 대기업/유명 브랜드를 Claude 로 판별.
 *
 * @param {string} apiKey — ANTHROPIC_API_KEY
 * @param {Array<{brandName:string, sampleProduct?:string, productCount?:number, blogReviewCount?:number}>} brands
 * @returns {Promise<{
 *   brands: Array<{brandName, isLarge, confidence, reason}>,
 *   usage: {input_tokens:number, output_tokens:number},
 *   estCostUSD: number,
 *   parseError: string|null,
 *   raw: string|null,
 * }>}
 */
export async function judgeLargeBrands(apiKey, brands) {
  if (!Array.isArray(brands) || !brands.length) {
    return {
      brands: [],
      usage: { input_tokens: 0, output_tokens: 0 },
      estCostUSD: 0,
      parseError: null,
      raw: null,
    };
  }

  const lines = [];
  lines.push(`# 판별 대상 ${brands.length}개`);
  brands.forEach((b, i) => {
    const bits = [];
    if (b.productCount != null) bits.push(`상품 ${b.productCount}개`);
    if (b.blogReviewCount != null) bits.push(`블로그 ${b.blogReviewCount}건`);
    const meta = bits.length ? ` (${bits.join(", ")})` : "";
    const sample = b.sampleProduct ? ` — "${String(b.sampleProduct).slice(0, 60)}"` : "";
    lines.push(`${i + 1}. ${b.brandName}${meta}${sample}`);
  });
  lines.push("");
  lines.push(
    `위 리스트에서 대기업/유명 브랜드/종합 유통사를 판별하여 JSON 스키마대로 응답하세요. 순서와 개수 유지.`
  );

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: LARGE_BRAND_JUDGE_PROMPT,
      messages: [{ role: "user", content: lines.join("\n") }],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`judgeLargeBrands API ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  const raw = (body.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  const usage = {
    input_tokens: body.usage?.input_tokens ?? 0,
    output_tokens: body.usage?.output_tokens ?? 0,
  };
  const cost =
    (usage.input_tokens * PRICE_PER_M_BRAND.input +
      usage.output_tokens * PRICE_PER_M_BRAND.output) /
    1_000_000;
  const { data, parseError } = safeParseJson(raw);

  return {
    brands: Array.isArray(data?.brands) ? data.brands : [],
    usage,
    estCostUSD: cost,
    parseError,
    raw: parseError ? raw : null,
  };
}

// ─── Step 2 최종 후보: 웹검색 스팟 확인 ───────────────────────────────────────
//
// 최종 후보 2~3개 한정으로 호출.
// 제품력 축(35%) 핵심 근거: 스마트스토어/쿠팡 실 구매자 리뷰수·평점.
// 마케팅 조용함 검증: SNS 팔로워 + 언론 노출.
// 마케터/콘텐츠 마케터 채용공고 여부 (있음 = 이미 마케팅 인력 강화 중 → 우리 개입 여지 축소).

const SPOT_CHECK_PROMPT = `당신은 브랜드 조사관입니다. Pentacle 이 이 브랜드/셀러를 마케팅 파트너
후보로 검토 중이며, 제품력과 마케팅 조용함을 웹검색으로 스팟 확인합니다.

# 확인 항목
1. 제품력 정량 (핵심 · 4축 스코어링에 사용)
   - 스마트스토어·쿠팡·자사몰 대표 제품의 실 구매자 리뷰 수
   - 평점 (5점 만점)
2. 마케팅 조용함 (우리 개입 여지 검증)
   - 브랜드 공식 인스타그램 팔로워 수
   - 브랜드 공식 유튜브 채널 구독자 수
   - 최근 12개월 언론 노출/보도자료 대략 건수
3. 마케팅 인력 채용 여부 (개입 여지 축소 시그널)
   - 원티드·사람인·잡코리아·자사 채용페이지에 "마케터", "콘텐츠 마케터",
     "퍼포먼스 마케터", "브랜드 마케터" 채용공고 존재 여부
   - 있음 = 이미 자체 마케팅 인력 강화 중, 우리 개입 여지 축소

# 원칙
- 웹검색 도구를 상황에 맞게 사용 (여러 번 가능).
- 정보를 찾지 못하면 해당 필드는 null. 절대 추측 금지.
- 브랜드명이 흔한 단어면 카테고리 키워드를 함께 검색해 정확도 향상.
- reason 은 결정적 근거 2~3문장 (근거 URL 언급 권장).
- spotConfidence: 웹검색으로 실제 확인한 지표 개수 기반 0~100
  (예: 6개 필드 중 3개 확인 = 50).

# 응답 규칙
- JSON 만 반환, 코드 펜스/설명문 금지.
- 스키마 필드 순서는 자유. 필드는 모두 포함 (없으면 null).

# JSON 스키마
{
  "brandName": "입력받은 그대로",
  "productReviewCount": 350,
  "productRating": 4.6,
  "instagramFollowers": 2400,
  "youtubeSubscribers": 800,
  "recentPressCount": 0,
  "marketingHiring": {
    "found": false,
    "positions": [],
    "source": null
  },
  "marketingSilent": true,
  "spotConfidence": 55,
  "webSources": ["https://...", "https://..."],
  "reason": "핵심 소견 2~3문장"
}`;

/**
 * 최종 후보 웹검색 스팟 확인.
 *
 * @param {string} apiKey — ANTHROPIC_API_KEY
 * @param {string} brandName
 * @param {string} categoryKeyword — 브랜드명 흔할 때 정확도 향상용
 * @param {object} [opts]
 * @param {number} [opts.maxUses=6] — web_search 도구 최대 호출 횟수
 * @returns {Promise<{
 *   brandName, productReviewCount, productRating,
 *   instagramFollowers, youtubeSubscribers, recentPressCount,
 *   marketingHiring: {found, positions, source},
 *   marketingSilent, spotConfidence, webSources, reason,
 *   usage, estCostUSD, parseError, raw,
 * }>}
 */
export async function spotCheckBrand(apiKey, brandName, categoryKeyword, opts = {}) {
  const maxUses = opts.maxUses ?? 6;
  const userMsg =
    `브랜드/셀러명: "${brandName}"\n` +
    `카테고리: ${categoryKeyword || "(미지정)"}\n\n` +
    `위 브랜드에 대해 웹검색으로 스팟 확인하고 JSON 스키마대로 반환하세요.`;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system: SPOT_CHECK_PROMPT,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: maxUses,
        },
      ],
      messages: [{ role: "user", content: userMsg }],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`spotCheckBrand API ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  const raw = (body.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  const usage = {
    input_tokens: body.usage?.input_tokens ?? 0,
    output_tokens: body.usage?.output_tokens ?? 0,
    server_tool_use: body.usage?.server_tool_use ?? null,
  };
  // 웹검색은 별도 과금 ($10/1K 검색). 정확 산정 어려우므로 대략치 표시.
  const searchCalls = usage.server_tool_use?.web_search_requests ?? 0;
  const tokenCost =
    (usage.input_tokens * PRICE_PER_M_BRAND.input +
      usage.output_tokens * PRICE_PER_M_BRAND.output) /
    1_000_000;
  const searchCost = searchCalls * 0.01; // $10/1K = $0.01/call
  const cost = tokenCost + searchCost;
  const { data, parseError } = safeParseJson(raw);

  return {
    brandName: data?.brandName ?? brandName,
    productReviewCount: data?.productReviewCount ?? null,
    productRating: data?.productRating ?? null,
    instagramFollowers: data?.instagramFollowers ?? null,
    youtubeSubscribers: data?.youtubeSubscribers ?? null,
    recentPressCount: data?.recentPressCount ?? null,
    marketingHiring: data?.marketingHiring ?? { found: null, positions: [], source: null },
    marketingSilent: data?.marketingSilent ?? null,
    spotConfidence: data?.spotConfidence ?? null,
    webSources: Array.isArray(data?.webSources) ? data.webSources : [],
    reason: data?.reason ?? null,
    usage,
    estCostUSD: cost,
    parseError,
    raw: parseError ? raw : null,
  };
}
