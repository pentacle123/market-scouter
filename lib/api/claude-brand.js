// 브랜드 발굴 전용 Claude 함수 — Phase B.
//
// Phase B: judgeLargeBrands — 대기업/유명 브랜드 자동 판별 (Step 2 후보 수집 필터).
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
