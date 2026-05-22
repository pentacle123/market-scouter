// Anthropic Claude Messages API 클라이언트 (서버 전용).
// 엔드포인트: POST https://api.anthropic.com/v1/messages
// 인증: x-api-key 헤더 + anthropic-version
// 모델: claude-sonnet-4-20250514
//
// 한 카테고리당 1회 호출로 8섹션 통합 JSON 응답을 받습니다.
//   기존 4축: competition / pains / viral / verdict
//   v2 신규 4축: trendDuration / koreaCulturalFit / megatrendTailwind / adoptionSpeed
// max_tokens=2000 으로 상향 (8섹션 응답 수용).

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS_DEFAULT = 3000;

// Sonnet 4 단가 (1M tokens 기준). UI 비용 추정 표시에 사용.
export const PRICE_PER_M = { input: 3, output: 15 }; // USD

const SYSTEM_PROMPT = `당신은 한국 시장 진출 전략을 분석하는 시니어 컨설턴트입니다.

# 사업 컨텍스트
- 광고대행사(Pentacle)가 마케팅 역량으로 제품을 소싱하여 숏폼 발견 커머스로 판매하는 사업입니다.
- 에코마케팅(오호라/안다르), 에이피알(메디큐브), 앳홈(미닉스) 같은 모델입니다.
- 첫 진입 방식은 크리에이터 어필리에이트(재고 리스크 0, 마케팅비만). 점진적으로 매출배분 → 독점 파트너 → 지분 투자/자체 브랜드로 확장합니다.

# 응답 규칙 (필수)
- 반드시 아래 JSON 스키마만 반환하세요. JSON 외 어떤 텍스트도, 코드 펜스(\`\`\`)도, 설명도 포함하지 마세요.
- 모든 점수는 0~100 정수.
- pains 배열은 최대 3개, viral.concepts 배열은 정확히 3개.

# 텍스트 길이 규칙
- 기본 텍스트 필드는 한국어 80자 이내, 짧고 구체적으로.
- **예외 — 아래 두 필드는 더 길게**:
  - verdict.reasoning: **150자 이상** (왜 이 점수가 나왔는지 구체적으로 3~5문장)
  - layerDetails.L1~L6 각각: **각 2~3문장 (100~200자)** — 해당 레이어의 구체적 데이터 포인트와 판단 근거

# JSON 스키마 (8축 + 추가 3 필드)
{
  "competition": {
    "score": 0,                  // 한국 경쟁 강도. 0=경쟁자 0개, 100=완전 레드오션
    "players": "",
    "priceRange": "",
    "entryBarrier": ""
  },
  "pains": [
    {"issue": "", "severity": 0, "devDirection": "", "spec": ""}
  ],
  "viral": {
    "score": 0,                  // 숏폼 발견 커머스 적합도. 100=3초 데모/Before-After/충동구매가 모두 충족
    "demoFeasibility": "",
    "creatorFit": "",
    "priceSweet": "",
    "concepts": ["", "", ""]
  },
  "trendDuration": {
    "verdict": "장기|중기|반짝",   // 트렌드 지속성 판정
    "score": 0,                  // 지속성 점수. 100=장기 메가트렌드
    "globalEmerged": "",         // 글로벌에서 처음 뜬 시점/맥락 (예: "2020년 미국, 2년+ 지속")
    "growthShape": "",           // 성장 곡선 (예: "상승 중", "정점 후 안정")
    "institutionalization": ""   // 제도화 여부 (전문 브랜드 수, 아마존 카테고리 등)
  },
  "koreaCulturalFit": {
    "verdict": "유리|중립|불리",
    "score": 0,                  // 한국 문화 적합도. 100=최적합
    "favorable": "",             // 유리한 요인 (1인가구·아파트·빠른배송·올리브영 등)
    "unfavorable": "",           // 불리한 요인 (작은 주방·가격 민감도·규제·식문화)
    "reasoning": ""
  },
  "megatrendTailwind": {
    "score": 0,                  // 순풍 점수. (순풍 개수)/(전체)*100
    "demographic": "순풍|중립|역풍",   // 인구 구조 (1인가구·고령화·출산율)
    "climate": "순풍|중립|역풍",       // 기후/환경 (아열대화·미세먼지·ESG)
    "technology": "순풍|중립|역풍",    // 기술 (AI·전기차·숏폼)
    "consumerBehavior": "순풍|중립|역풍", // 소비 행동 (가치소비·웰니스·구독)
    "keyTailwind": ""            // 가장 강한 순풍 요인 한 줄
  },
  "adoptionSpeed": {
    "verdict": "빠름|보통|느림",
    "score": 0,                  // 채택 속도. 100=빠름
    "mobilePurchase": true,      // 모바일 구매 가능
    "priceComparison": true,     // 가성비 비교 쉬움
    "snsCompatible": true,       // SNS 인증 적합
    "convenienceLift": "",       // 편의성 향상 정도 한 줄
    "habitChangeRequired": ""    // 습관 변화 필요도 한 줄
  },
  "verdict": {
    "score": 0,                  // 종합 진입 추천. 100=즉시 진입
    "oneLine": "",               // 한 줄 판단 (80자 이내)
    "reasoning": "",             // 150자 이상 — 왜 이 점수인지 구체적으로 (시장·경쟁·실행 측면 모두)
    "nextAction": ""
  },
  "layerDetails": {
    "L1": "",                    // 글로벌 선행: 구체 데이터 포인트(브랜드/조회수/등장 시점) + 판단 근거. 2~3문장.
    "L2": "",                    // 한국 수요: 검색량/순위/MoM + 판단. 2~3문장.
    "L3": "",                    // 경쟁 구조: 플레이어/가격대/공백/대기업 진출 + 판단. 2~3문장.
    "L4": "",                    // 소비자 불만: 가장 강한 불만 1~2개 + 그 근거. 2~3문장.
    "L5": "",                    // Pentacle 적합: 3초 데모/크리에이터/가격대 충동구매 가능성. 2~3문장.
    "L6": ""                     // 파트너 생태계: OEM·투자 후보·기술 파트너 + 진입 용이성. 2~3문장.
  },
  "partnerStrategy": {
    "recommendedModel": "어필리에이트|RS|CPS|투자|PB",  // 가장 적합한 협업 모델
    "firstTestPartner": "",      // 첫 테스트 단계에 추천하는 파트너 유형/예시 (60자)
    "scalePartner": "",          // 양산/확장 전환 시 추천 파트너 유형/예시 (60자)
    "reasoning": ""              // 왜 이 모델/순서인지 (100자 이내)
  }
}

# 점수/판정 기준
- competition.score: 한국 시장 경쟁 강도. 0=경쟁자 0개, 50=중간, 100=완전 레드오션.
- viral.score: 숏폼 발견 커머스 적합도. 100=3초 데모/Before-After/충동구매 가격 모두 충족.
- trendDuration.verdict: 글로벌 등장 후 4년+ 지속/제도화 = "장기", 1~3년 = "중기", 1년 미만 핫이슈 = "반짝".
- koreaCulturalFit.verdict: 한국 라이프스타일과의 적합도 종합 판정.
- megatrendTailwind: 인구·기후·기술·소비 4영역 각각 한국 메가트렌드에 순풍/중립/역풍. score 는 (순풍 영역 수 / 4) * 100.
- adoptionSpeed: mobilePurchase/priceComparison/snsCompatible 는 true/false. 4가지 모두 true 면 verdict "빠름".
- verdict.score: 위 7개 분석을 종합한 진입 추천. 100=즉시 진입, 50=조건부, 0=비추천.`;

function buildUserPrompt(cat, youtube, naver, naverShopping) {
  const lines = [];
  lines.push(`# 카테고리`);
  lines.push(`- 이름: ${cat.n}`);
  lines.push(`- 시장 규모: ${cat.mk}`);
  lines.push(`- 라이프사이클: ${cat.lc}`);
  lines.push(`- 기존 분류: ${cat.type}`);
  if (cat.kw) {
    lines.push(`- 키워드: US "${cat.kw.US}", KR "${cat.kw.KR}"`);
  }
  if (cat.verdict) lines.push(`- 기존 한줄 판단: "${cat.verdict}"`);

  if (youtube) {
    lines.push(``);
    lines.push(`# YouTube 신호 (최근 30일 쇼츠)`);
    lines.push(`- 🇺🇸 US 영상 ${(youtube.US?.videoCount ?? 0).toLocaleString()}건, 평균 조회 ${(youtube.US?.avgViews ?? 0).toLocaleString()}회, 최고 ${(youtube.US?.topViews ?? 0).toLocaleString()}회`);
    lines.push(`- 🇰🇷 KR 영상 ${(youtube.KR?.videoCount ?? 0).toLocaleString()}건, 평균 조회 ${(youtube.KR?.avgViews ?? 0).toLocaleString()}회, 최고 ${(youtube.KR?.topViews ?? 0).toLocaleString()}회`);
    lines.push(`- US/KR 영상 비율 ${youtube.ratio}x${youtube.isBlueOcean ? " · 시스템 자동 블루오션 표시" : ""}`);
  } else {
    lines.push(``);
    lines.push(`# YouTube 신호: 없음`);
  }

  if (naver) {
    lines.push(``);
    lines.push(`# 네이버 검색 트렌드 (12개월, 상대값 0~100)`);
    lines.push(`- 12개월 평균 ${naver.avgRatio}, 피크 ${naver.peakRatio}`);
    if (naver.mom?.deltaPct != null) {
      const sign = naver.mom.deltaPct > 0 ? "+" : "";
      lines.push(`- 전월 대비 ${sign}${naver.mom.deltaPct}% (${naver.mom.periodPrev} → ${naver.mom.periodLast}, 부분월 제외)`);
    } else if (naver.hasData === false) {
      lines.push(`- 검색량 거의 0 (네이버 검색 자체가 미형성)`);
    }
  }

  if (naverShopping) {
    lines.push(``);
    lines.push(`# 네이버 쇼핑 인사이트`);
    if (naverShopping.hasCid) {
      lines.push(`- 매핑된 부모 카테고리: cid ${naverShopping.naverCid} (광역 매핑이므로 인구통계는 부모 카테고리 평균)`);
      if (naverShopping.avgRatio != null) {
        lines.push(`- 클릭량 12M 평균 ${naverShopping.avgRatio}, 피크 ${naverShopping.peakRatio}`);
      }
      const fmt = (arr) => arr?.slice(0, 6).map((x) => `${x.group} ${Math.round(x.ratio)}%`).join(", ") || "—";
      if (naverShopping.breakdown) {
        lines.push(`- 성별 분포: ${fmt(naverShopping.breakdown.gender)}`);
        lines.push(`- 연령 분포: ${fmt(naverShopping.breakdown.age)}`);
        lines.push(`- 기기 분포: ${fmt(naverShopping.breakdown.device)}`);
      }
    } else {
      lines.push(`- 네이버 쇼핑에 전용 카테고리 미형성 → 블루오션 추가 증거`);
    }
  }

  if (cat.partners && cat.partners.length) {
    lines.push(``);
    lines.push(`# 파트너 후보 (GUIDE 등록)`);
    lines.push(cat.partners.map((p) => `- ${p}`).join("\n"));
  }
  if (cat.layers) {
    lines.push(``);
    lines.push(`# GUIDE 등록 6 레이어 근거 (참고용 시드)`);
    Object.entries(cat.layers).forEach(([k, v]) => lines.push(`- ${k}: ${v}`));
  }

  lines.push(``);
  lines.push(`위 데이터를 분석하여 JSON 스키마대로만 응답하세요. verdict.reasoning 은 반드시 150자 이상, layerDetails 각 항목은 2~3문장으로 작성하세요.`);
  return lines.join("\n");
}

/**
 * 단일 카테고리 분석.
 * @returns {{
 *   analysis: object,             // 파싱된 JSON (8축)
 *   raw: string,                  // 모델 원문 (디버그용)
 *   usage: {input_tokens:number, output_tokens:number},
 *   estCostUSD: number,
 *   parseError?: string,
 * }}
 */
export async function analyzeCategory(apiKey, cat, youtube, naver, naverShopping, opts = {}) {
  const maxTokens = opts.maxTokens ?? MAX_TOKENS_DEFAULT;
  const userPrompt = buildUserPrompt(cat, youtube, naver, naverShopping);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API failed: ${res.status} ${text.slice(0, 300)}`);
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
  const estCostUSD =
    (usage.input_tokens * PRICE_PER_M.input + usage.output_tokens * PRICE_PER_M.output) / 1_000_000;

  // JSON 파싱: 코드 펜스 또는 앞뒤 텍스트가 섞여 있어도 추출 시도
  const { analysis, parseError } = safeParseJson(raw);

  return { analysis, raw, usage, estCostUSD, parseError };
}

function safeParseJson(text) {
  if (!text) return { analysis: null, parseError: "empty response" };
  let s = text.trim();
  // 코드 펜스 제거
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // 첫 { 부터 마지막 } 까지 추출 (모델이 앞뒤 설명을 붙였을 경우)
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) {
    s = s.slice(first, last + 1);
  }
  try {
    return { analysis: JSON.parse(s), parseError: null };
  } catch (e) {
    return { analysis: null, parseError: e.message };
  }
}

/**
 * 비용 추정 (UI 표시용).
 * 확장된 스키마 + max_tokens 3000 → 카테고리당 평균 input ~ 2200 tokens, output ~ 2200 tokens 가정.
 */
export function estimateBatchCost(categoryCount) {
  const inTok = categoryCount * 2200;
  const outTok = categoryCount * 2200;
  const usd = (inTok * PRICE_PER_M.input + outTok * PRICE_PER_M.output) / 1_000_000;
  return { inTok, outTok, usd, krw: Math.round(usd * 1380) }; // 환율 근사
}

// ─── 자동 카테고리 발견 ──────────────────────────────────────────────────────
//
// US YouTube 트렌딩 영상 제목 리스트 + 기존 30 카테고리를 Claude 에 보내
// 신규 카테고리 후보를 최대 10개 추출. 약 1,800 input + 1,500 output 토큰 가정 = $0.028.

const DISCOVERY_SYSTEM_PROMPT = `당신은 광고대행사 Pentacle 의 신규 카테고리 발굴 큐레이터입니다.

# 사업 컨텍스트
- 제품을 소싱하여 숏폼 발견 커머스로 판매하는 모델 (에코마케팅·에이피알·앳홈 참조).
- 첫 진입은 크리에이터 어필리에이트(재고 0). 가격대 5만~50만원 충동구매 영역이 최적.

# 임무
미국 YouTube 트렌딩 영상 제목 리스트를 분석해서, 우리 기존 30 카테고리 목록에 없는 신규 제품 기회를 식별합니다.

# 응답 규칙 (필수)
- JSON 만 반환, 코드 펜스 금지.
- discoveries 배열에 최대 10개. 영상 풀에서 강한 시그널이 안 보이면 더 적게도 OK.
- 기존 카테고리 30개 중 어느 하나와라도 컨셉이 겹치면 반드시 제외 (이름이 달라도 같은 제품군이면 제외).
- estimatedType 은 "blue" | "gap" | "cond" 중. "no"(레드오션·대기업) 추정은 발견 가치가 없으므로 제외.
- 한국어 이름은 한국 소비자에게 익숙한 표현. 너무 영어 직역은 피함.

# JSON 스키마
{
  "discoveries": [
    {
      "name": "한국어 카테고리명 (20자 이내)",
      "nameEn": "English Category Name",
      "keyword": "youtube US search keyword (영문 검색용)",
      "videoCount": 0,                       // 영상 풀에서 추정한 관련 영상 수
      "avgViews": 0,                         // 영상 풀에서 본 평균 조회수 추정
      "reasoning": "왜 이 카테고리가 한국 진입 기회인지 2~3줄. 미국에서 검증된 점·한국 부재·Pentacle 적합성 측면 모두 언급.",
      "estimatedType": "blue|gap|cond",
      "sampleTitles": ["대표 영상 제목 1", "제목 2", "제목 3"]  // 풀에서 본 실제 제목 3개
    }
  ]
}`;

function buildDiscoveryUserPrompt(existingCategories, videoData) {
  const lines = [];
  lines.push(`# 기존 카테고리 ${existingCategories.length}개 (절대 중복 — 이름·컨셉 비슷해도 제외)`);
  existingCategories.forEach((c) => {
    lines.push(`- ${c.n} (US kw "${c.kw?.US}", KR kw "${c.kw?.KR}")`);
  });

  lines.push(``);
  lines.push(
    `# YouTube US 최근 3개월 인기 영상 제목 ${videoData.videos.length}개 (sourceKeyword 는 발견 키워드)`
  );
  videoData.videos.slice(0, 180).forEach((v, i) => {
    lines.push(`${i + 1}. [${v.sourceKeyword}] ${v.title}`);
  });

  lines.push(``);
  lines.push(
    `위 영상 풀에서 반복적으로 등장하는 제품 카테고리를 식별하고, 기존 ${existingCategories.length}개 목록에 없는 신규 기회만 추출하세요. JSON 스키마대로만 응답.`
  );
  return lines.join("\n");
}

/**
 * 신규 카테고리 후보 발견.
 * @param {string} apiKey
 * @param {Array<{n:string, kw:{US:string, KR:string}}>} existingCategories
 * @param {{videos:Array}} videoData
 * @returns {Promise<{
 *   discoveries: Array,
 *   raw: string,
 *   parseError: string|null,
 *   usage: {input_tokens:number, output_tokens:number},
 *   estCostUSD: number,
 * }>}
 */
// ─── 리뷰 분석 ────────────────────────────────────────────────────────────────
//
// 네이버 블로그 30개 + (선택) US YouTube 리뷰 영상 제목을 받아
// 소비자 불만/아쉬운 점/개선 요청을 추출. 블루오션 카테고리는 대체재 리뷰이므로
// "이 불만이 곧 신제품 기회" 관점으로 분석.

const REVIEW_SYSTEM_PROMPT = `당신은 광고대행사 Pentacle 의 소비자 리뷰 분석가입니다.
미국 YouTube 댓글 (1차, 실제 소비자 목소리) 과/또는 한국 네이버 블로그 후기 (2차, 한국 시장 특성)
를 받아서, 소비자 불만/아쉬운 점/개선 요청을 추출합니다.

# 데이터 소스별 해석
- **US YouTube 댓글**: 실제 사용자의 솔직한 의견. 미국 시장에서 검증된 제품의 본질적 문제.
- **한국 네이버 블로그**: 한국 시장 특성·문화적 맥락·라이프스타일 반영.
- **둘 다 있는 경우 (블루오션)**: 미국 불만은 글로벌 제품 본질의 문제, 한국 불만은 한국 시장의 추가 고려사항.
  한국 진입 시 "둘 다" 해결해야 함. 종합 인사이트와 koreaImplication 에 이 점을 명시.

# 분석 원칙
- 칭찬 일색의 협찬·홍보 리뷰는 무시. 부정 의견/단점/아쉬움/스팸 아닌 솔직한 우려에 집중.
- 실제 텍스트에서 인용 (영어는 quotes 에, 한국어는 quotesKr 에 각각).
- 인용에서 인명·블로거명·URL·이모지 과다 제거.
- 같은 불만이 여러 리뷰에 나오면 frequency 에 정확히 명시 (% 포함).
- 영어 댓글 인용은 원어 그대로 유지 (번역하지 않음).

# 응답 규칙 (필수)
- JSON 만 반환, 코드 펜스 금지.
- complaints 최대 5개, positives 최대 3개.
- complaints[].quotes 는 영어 인용, complaints[].quotesKr 는 한국어 인용. 데이터 소스 없으면 빈 배열.
- 텍스트 필드(issue / productDirection / recommendedSpec / insight / koreaImplication)는 한국어.

# JSON 스키마
{
  "source": "youtube_us|naver_kr|both",   // 어떤 소스를 분석했는지
  "totalReviews": 0,                       // 분석한 리뷰/댓글 총 개수
  "negativeRatio": 0,                      // 0-100, 부정 의견 비율 추정
  "complaints": [
    {
      "issue": "불만 한 줄 (50자)",
      "severity": 0,                       // 0-100, 빈도 × 강도
      "frequency": "총 N개 중 M개 언급 (X%)",
      "quotes": ["English quote 1 (80-120자)", "..."],   // 영어 인용, 없으면 []
      "quotesKr": ["한국어 인용 1 (80자)", "..."],         // 한국어 인용, 없으면 []
      "productDirection": "이 불만을 해결하는 제품 개발 방향 (80자)",
      "recommendedSpec": "추천 스펙 (50자)"
    }
  ],
  "positives": ["자주 언급되는 장점 1 (40자)", "장점 2", "장점 3"],
  "insight": "분석 종합 인사이트 — 미국 본질 문제 + 한국 시장 특성 결합 (250자 이내)",
  "koreaImplication": "한국 진입 시 특별히 주의할 점 (150자 이내). 미국 데이터만 있어도 한국 적용 시 무엇이 다를지 추론."
}`;

function buildReviewUserPrompt({
  categoryName,
  isSubstitute,
  substituteName,
  blogs,
  ytComments,
  ytVideos,
}) {
  const lines = [];
  const hasYt = Array.isArray(ytComments) && ytComments.length > 0;
  const hasBlogs = Array.isArray(blogs) && blogs.length > 0;

  lines.push(`# 분석 대상`);
  lines.push(`- 제품 카테고리: ${categoryName}`);
  if (isSubstitute) {
    lines.push(`- 한국 분석 대체재: "${substituteName}" (한국에 직접 리뷰가 부족하여 대체재 활용)`);
  }
  lines.push(``);

  // ─── 1차: US YouTube 댓글 ──────────────────────────────────────────────────
  if (hasYt) {
    lines.push(`# 🇺🇸 US YouTube 댓글 ${ytComments.length}개 (영상 ${ytVideos?.length || 0}개에서 수집)`);
    lines.push(`(실제 미국 소비자 목소리 — 1차 데이터)`);
    // 댓글 풀이 너무 길면 좋아요 많은 순으로 자르기
    const sorted = [...ytComments].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    const sample = sorted.slice(0, 150);
    sample.forEach((c, i) => {
      const txt = String(c.text || "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 220);
      const likes = c.likeCount ? ` (♥${c.likeCount})` : "";
      lines.push(`${i + 1}. ${txt}${likes}`);
    });
    lines.push(``);
  }

  // ─── 2차: 한국 네이버 블로그 ─────────────────────────────────────────────
  if (hasBlogs) {
    lines.push(`# 🇰🇷 한국 네이버 블로그 리뷰 ${blogs.length}개${isSubstitute ? ` (대체재 "${substituteName}")` : ""}`);
    lines.push(`(한국 시장 특성·문화적 맥락 — 2차 데이터)`);
    blogs.forEach((b, i) => {
      lines.push(`${i + 1}. [${b.sourceQuery || "리뷰"}] ${b.title}`);
      if (b.description) lines.push(`   ${b.description.slice(0, 200)}`);
    });
    lines.push(``);
  }

  // ─── 분석 지시 ──────────────────────────────────────────────────────────
  if (hasYt && hasBlogs) {
    lines.push(
      `# 종합 분석 지시\n미국 YouTube 댓글(1차)에서 "${categoryName}" 의 본질적 불만을 식별하고,\n한국 네이버 블로그(2차, 대체재 "${substituteName}")에서 한국 시장의 추가 고려사항을 도출하세요.\n한국 진입 시 둘 다 해결해야 할 문제를 종합한 JSON 으로 응답하세요. source="both".`
    );
  } else if (hasYt) {
    lines.push(
      `# 분석 지시\n미국 YouTube 댓글에서 "${categoryName}" 본질 불만을 추출하고, 한국 진입 시 추가로 고려할 점을 koreaImplication 에 추론하여 JSON 으로 응답하세요. source="youtube_us".`
    );
  } else {
    lines.push(
      `# 분석 지시\n네이버 블로그 리뷰에서 "${categoryName}"${isSubstitute ? ` (대체재 "${substituteName}")` : ""} 에 대한 소비자 불만을 추출하여 JSON 으로 응답하세요. source="naver_kr".`
    );
  }
  return lines.join("\n");
}

/**
 * 리뷰 분석 호출.
 * @returns {Promise<{result, raw, parseError, usage, estCostUSD}>}
 */
export async function analyzeReviews(apiKey, opts) {
  const userPrompt = buildReviewUserPrompt(opts);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2400, // 영어 인용 + 한국어 인용 + insight + koreaImplication 수용
      system: REVIEW_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic review API ${res.status}: ${text.slice(0, 300)}`);
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
  const estCostUSD =
    (usage.input_tokens * PRICE_PER_M.input + usage.output_tokens * PRICE_PER_M.output) /
    1_000_000;

  const { analysis, parseError } = safeParseJson(raw);
  return { result: analysis, raw: parseError ? raw : null, parseError, usage, estCostUSD };
}

export async function discoverNewCategories(apiKey, existingCategories, videoData) {
  const userPrompt = buildDiscoveryUserPrompt(existingCategories, videoData);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2500,
      system: DISCOVERY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic discovery API ${res.status}: ${text.slice(0, 300)}`);
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
  const estCostUSD =
    (usage.input_tokens * PRICE_PER_M.input + usage.output_tokens * PRICE_PER_M.output) /
    1_000_000;

  const { analysis, parseError } = safeParseJson(raw);
  const discoveries = Array.isArray(analysis?.discoveries) ? analysis.discoveries : [];

  return { discoveries, raw: parseError ? raw : null, parseError, usage, estCostUSD };
}
