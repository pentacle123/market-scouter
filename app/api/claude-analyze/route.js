import { D } from "@/lib/data";
import { analyzeCategory } from "@/lib/api/claude";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/claude-analyze
 * body: {
 *   categoryId: number,
 *   youtube: ScanResult|null,        // 클라이언트가 캐시에서 가져온 해당 카테고리의 YouTube 결과
 *   naver: TrendResult|null,
 *   naverShopping: ShoppingResult|null,
 * }
 *
 * 응답: { id, analysis, usage, estCostUSD, raw, parseError? }
 *
 * 클라이언트가 17개 카테고리를 순차적으로 호출해야 합니다 (UI 진행률 표시).
 * 서버에서 일괄 처리하지 않는 이유:
 *   - Vercel maxDuration 60초 제약 (전체 ~30초씩 17개 = 8분, 시간 초과)
 *   - 사용자가 도중에 멈출 수 있어야 함
 *   - 점진적 UI 업데이트 가능
 */
export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.",
        hint:
          "발급: https://console.anthropic.com/settings/keys. 운영(Vercel): Project → Settings → Environment Variables 에 ANTHROPIC_API_KEY 추가 후 재배포.",
      },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { categoryId, category: customCat, youtube, naver, naverShopping } = body || {};
  // categoryId 가 1000+ 면 클라이언트가 보낸 category payload 사용 (커스텀 카테고리)
  let cat;
  if (categoryId >= 1000 && customCat && customCat.id === categoryId) {
    cat = customCat;
  } else {
    cat = D.find((c) => c.id === categoryId);
  }
  if (!cat) {
    return Response.json(
      {
        error: `category ${categoryId} not found`,
        hint: categoryId >= 1000 ? "커스텀 카테고리는 body 에 category 객체를 함께 보내세요." : null,
      },
      { status: 404 }
    );
  }

  const startedAt = Date.now();
  try {
    const result = await analyzeCategory(apiKey, cat, youtube, naver, naverShopping);
    return Response.json({
      id: cat.id,
      n: cat.n,
      elapsedMs: Date.now() - startedAt,
      analysis: result.analysis,
      usage: result.usage,
      estCostUSD: result.estCostUSD,
      parseError: result.parseError || null,
      raw: result.parseError ? result.raw : null, // 파싱 실패 시에만 raw 노출
    });
  } catch (e) {
    return Response.json(
      { id: cat.id, error: e?.message || String(e) },
      { status: 502 }
    );
  }
}
