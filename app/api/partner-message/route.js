import { generatePartnerMessage } from "@/lib/api/claude";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/partner-message
 * body: { partner: {...}, channel: "email"|"dm"|"kakao" }
 * 응답: { message: {subject, body, tone, estimatedResponseRate}, usage, estCostUSD }
 */
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
  const { partner, channel = "email" } = body || {};
  if (!partner || (!partner.brandName && !partner.mallName)) {
    return Response.json(
      { error: "partner payload missing (brandName 또는 mallName 필요)" },
      { status: 400 }
    );
  }
  if (!["email", "dm", "kakao"].includes(channel)) {
    return Response.json(
      { error: "channel 은 email|dm|kakao 중 하나" },
      { status: 400 }
    );
  }

  const startedAt = Date.now();
  try {
    const result = await generatePartnerMessage(apiKey, { partner, channel });
    return Response.json({
      brand: partner.brandName || partner.mallName,
      channel,
      elapsedMs: Date.now() - startedAt,
      message: result.message,
      parseError: result.parseError,
      raw: result.parseError ? result.raw : null,
      usage: result.usage,
      estCostUSD: result.estCostUSD,
    });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
