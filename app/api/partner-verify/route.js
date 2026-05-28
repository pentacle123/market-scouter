import { verifyPartner } from "@/lib/api/claude";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/partner-verify
 * body: { partner, categoryGrowth?, categoryName? }
 * 응답: { analysis (5섹션+verdict), usage, estCostUSD }
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
  const { partner, categoryGrowth = null, categoryName = null } = body || {};
  if (!partner || (!partner.brandName && !partner.mallName)) {
    return Response.json(
      { error: "partner payload missing (brandName 또는 mallName 필요)" },
      { status: 400 }
    );
  }

  const startedAt = Date.now();
  try {
    const result = await verifyPartner(apiKey, { partner, categoryGrowth, categoryName });
    return Response.json({
      brand: partner.brandName || partner.mallName,
      elapsedMs: Date.now() - startedAt,
      analysis: result.analysis,
      parseError: result.parseError,
      raw: result.parseError ? result.raw : null,
      usage: result.usage,
      estCostUSD: result.estCostUSD,
    });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
