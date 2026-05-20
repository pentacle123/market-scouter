import { D } from "@/lib/data";
import { scanCreators } from "@/lib/api/youtube";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/youtube-creators?categoryId=1&geo=KR
 * 단일 카테고리 단위로만 호출 (전체 일괄은 쿼터 부담 → UI에서 카테고리 선택 후 호출).
 * 카테고리당 쿼터 ≈ 101 units (search 100 + channels 1).
 */
export async function GET(req) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: "YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.",
        hint:
          "글로벌 스캔과 동일한 키를 사용합니다. Google Cloud Console → APIs & Services → Credentials.",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const categoryId = Number(searchParams.get("categoryId"));
  const geo = searchParams.get("geo") || "KR";
  const cat = D.find((c) => c.id === categoryId);
  if (!cat) {
    return Response.json({ error: `category ${categoryId} not found` }, { status: 404 });
  }
  const keyword = geo === "KR" ? cat.kw?.KR : cat.kw?.US;
  if (!keyword) {
    return Response.json({ error: "keyword missing for category/geo" }, { status: 400 });
  }

  const startedAt = Date.now();
  try {
    const result = await scanCreators(apiKey, keyword, geo);
    return Response.json({
      id: cat.id,
      n: cat.n,
      geo,
      keyword,
      scannedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      creators: result.creators,
      quotaUsed: result.quotaUsed,
      quotaDailyFree: 10000,
      summary: result.summary,
    });
  } catch (e) {
    return Response.json(
      {
        id: cat.id,
        error: e?.message || String(e),
      },
      { status: 502 }
    );
  }
}
