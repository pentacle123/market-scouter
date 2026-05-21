import { D } from "@/lib/data";
import { scanCreators } from "@/lib/api/youtube";
import { getKeysStatus, getConfiguredKeys } from "@/lib/api/youtube-keys";
import { getQuotaUsage } from "@/lib/server-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/youtube-creators?categoryId=1&geo=KR&force=false
 * 7일 서버 캐시 + 멀티 키 로테이션 적용.
 */
export async function GET(req) {
  const keys = getConfiguredKeys();
  if (!keys.length) {
    return Response.json(
      { error: "YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const categoryId = Number(searchParams.get("categoryId"));
  const geo = searchParams.get("geo") || "KR";
  const force = searchParams.get("force") === "true";

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
    const result = await scanCreators(keyword, geo, { force });
    return Response.json({
      id: cat.id,
      n: cat.n,
      geo,
      keyword,
      scannedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      creators: result.creators,
      summary: result.summary,
      cacheHit: !!result.cacheHit,
      quotaUsed: result.quotaUsed,
      quotaDailyFree: 10000 * keys.length,
      quotaUsedToday: getQuotaUsage(),
      keysStatus: getKeysStatus(),
      keyIndex: result.keyIndex,
    });
  } catch (e) {
    return Response.json(
      {
        id: cat.id,
        error: e?.message || String(e),
        code: e?.code || null,
      },
      { status: 502 }
    );
  }
}
