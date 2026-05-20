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
const MAX_TOKENS_DEFAULT = 2000;

// Sonnet 4 단가 (1M tokens 기준). UI 비용 추정 표시에 사용.
export const PRICE_PER_M = { input: 3, output: 15 }; // USD

const SYSTEM_PROMPT = `당신은 한국 시장 진출 전략을 분석하는 시니어 컨설턴트입니다.

# 사업 컨텍스트
- 광고대행사(Pentacle)가 마케팅 역량으로 제품을 소싱하여 숏폼 발견 커머스로 판매하는 사업입니다.
- 에코마케팅(오호라/안다르), 에이피알(메디큐브), 앳홈(미닉스) 같은 모델입니다.
- 첫 진입 방식은 크리에이터 어필리에이트(재고 리스크 0, 마케팅비만). 점진적으로 매출배분 → 독점 파트너 → 지분 투자/자체 브랜드로 확장합니다.

# 응답 규칙 (필수)
- 반드시 아래 JSON 스키마만 반환하세요. JSON 외 어떤 텍스트도, 코드 펜스(\`\`\`)도, 설명도 포함하지 마세요.
- 각 텍스트 필드는 한국어로 80자 이내. 짧고 구체적으로.
- 모든 점수는 0~100 정수.
- pains 배열은 최대 3개, viral.concepts 배열은 정확히 3개.

# JSON 스키마 (8축)
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
    "oneLine": "",
    "reasoning": "",
    "nextAction": ""
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

  lines.push(``);
  lines.push(`위 데이터를 분석하여 8축 JSON 스키마대로만 응답하세요.`);
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
 * 8축 스키마 + max_tokens 2000 → 카테고리당 평균 input ~ 1800 tokens, output ~ 1400 tokens 가정.
 */
export function estimateBatchCost(categoryCount) {
  const inTok = categoryCount * 1800;
  const outTok = categoryCount * 1400;
  const usd = (inTok * PRICE_PER_M.input + outTok * PRICE_PER_M.output) / 1_000_000;
  return { inTok, outTok, usd, krw: Math.round(usd * 1380) }; // 환율 근사
}
