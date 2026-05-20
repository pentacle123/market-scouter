import { D } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `당신은 광고대행사 Pentacle 의 크리에이터 협업 매니저입니다.

# 사업 컨텍스트
- 제품을 소싱하여 숏폼 발견 커머스로 판매하는 모델 (에코마케팅·에이피알·앳홈 참조).
- 크리에이터 어필리에이트(재고 0, 마케팅비만) 가 첫 진입 방식.
- 마이크로(1~10만 구독)·매크로(10~100만) 가 가장 효율적.

# 임무
주어진 카테고리·제품 정보와 후보 크리에이터 1명의 데이터를 받아
**그 크리에이터에게 보낼 어필리에이트 협업 제안 메일/DM 브리프**를 작성합니다.

# 응답 규칙 (필수)
- JSON 만 반환, 코드 펜스 금지.
- 한국어. 친근하지만 프로페셔널한 톤.
- 각 필드 길이 가이드를 지키되, 자연스러운 한국어 우선.

# JSON 스키마
{
  "subject": "",              // 이메일/DM 제목 (40자 이내)
  "greeting": "",             // 첫 인사 + 채널 칭찬 1~2문장 (60자 이내, 채널명·콘텐츠 특징 언급)
  "productPitch": "",         // 제품 소개 + 왜 이 크리에이터에게 적합한지 (150자, 채널 콘셉트와 제품을 연결)
  "conceptProposal": "",      // 제안하는 숏폼 콘셉트 1~2개 (120자, 구체적으로)
  "commission": "",           // 수수료 모델 제안 (60자, 예: 어필리에이트 10% + 영상당 보장비 X만원)
  "cta": "",                  // 다음 액션 제안 (50자, 예: 샘플 발송 요청·1:1 콜 제안)
  "tone": "친근|프로페셔널|캐주얼"  // 메시지 톤 자체 판정
}`;

function buildUserPrompt({ cat, creator, ai, naverShopping }) {
  const lines = [];
  lines.push(`# 제품 정보`);
  lines.push(`- 카테고리: ${cat.n} (${cat.mk}, ${cat.type})`);
  if (cat.verdict) lines.push(`- 한 줄 컨셉: ${cat.verdict}`);
  if (cat.rev?.price && cat.rev.price !== "-") lines.push(`- 예상 판매가: ${cat.rev.price}`);

  if (ai?.viral?.concepts?.length) {
    lines.push(``);
    lines.push(`# 숏폼 콘셉트 풀 (Claude 가 사전 생성)`);
    ai.viral.concepts.forEach((c, i) => lines.push(`${i + 1}) ${c}`));
  }
  if (ai?.viral?.priceSweet) lines.push(`- 적정 충동구매 가격대: ${ai.viral.priceSweet}`);

  lines.push(``);
  lines.push(`# 크리에이터 정보`);
  lines.push(`- 채널명: ${creator.name}`);
  lines.push(`- 구독자: ${creator.subscribers.toLocaleString()}명 (${creator.tier})`);
  lines.push(`- 평균 조회수: ${creator.avgViews.toLocaleString()}회`);
  lines.push(`- 총 영상 수: ${creator.videoCount.toLocaleString()}개`);
  lines.push(`- 카테고리 관련 영상 ${creator.relevantVideos}건 (적합도 ${creator.fitScore}점)`);
  if (creator.sampleVideoTitle) {
    lines.push(`- 대표 영상 제목: "${creator.sampleVideoTitle}"`);
  }
  if (creator.description) {
    lines.push(`- 채널 소개: ${creator.description.slice(0, 200)}`);
  }

  if (naverShopping?.breakdown) {
    const fmt = (arr) =>
      (arr || [])
        .slice(0, 3)
        .map((x) => `${x.group} ${Math.round(x.ratio)}%`)
        .join(", ");
    lines.push(``);
    lines.push(`# 타깃 인구통계 (네이버 쇼핑 인사이트, 부모 카테고리 기준)`);
    if (naverShopping.breakdown.gender?.length) lines.push(`- 성별: ${fmt(naverShopping.breakdown.gender)}`);
    if (naverShopping.breakdown.age?.length) lines.push(`- 연령: ${fmt(naverShopping.breakdown.age)}`);
  }

  lines.push(``);
  lines.push(
    `위 정보를 활용해 어필리에이트 협업 제안 브리프를 JSON 스키마대로 작성하세요. 채널의 콘텐츠 색깔과 제품을 연결하는 productPitch 가 핵심입니다.`
  );
  return lines.join("\n");
}

function safeParseJson(text) {
  if (!text) return { brief: null, parseError: "empty" };
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  try {
    return { brief: JSON.parse(s), parseError: null };
  } catch (e) {
    return { brief: null, parseError: e.message };
  }
}

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { categoryId, creator, ai, naverShopping } = body || {};
  const cat = D.find((c) => c.id === categoryId);
  if (!cat) return Response.json({ error: `category ${categoryId} not found` }, { status: 404 });
  if (!creator || !creator.channelId || !creator.name) {
    return Response.json({ error: "creator payload missing" }, { status: 400 });
  }

  const userPrompt = buildUserPrompt({ cat, creator, ai, naverShopping });
  const startedAt = Date.now();

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { error: `Anthropic API ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }
    const data = await res.json();
    const raw = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
    const { brief, parseError } = safeParseJson(raw);
    const usage = {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    };
    const estCostUSD =
      (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;

    return Response.json({
      categoryId: cat.id,
      channelId: creator.channelId,
      creatorName: creator.name,
      elapsedMs: Date.now() - startedAt,
      brief,
      parseError: parseError || null,
      raw: parseError ? raw : null,
      usage,
      estCostUSD,
    });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
