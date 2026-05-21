import { D } from "@/lib/data";
import { discoverTrendingVideos } from "@/lib/api/youtube";
import { discoverNewCategories } from "@/lib/api/claude";
import { getKeysStatus, getConfiguredKeys } from "@/lib/api/youtube-keys";
import { getQuotaUsage } from "@/lib/server-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/discover-categories?force=false
 *
 * 2-step:
 *   1) YouTube US 9 키워드 × search.list = 900 units (캐시 시 0)
 *   2) Claude API 신규 카테고리 추출 (~$0.028)
 *
 * 응답:
 *   { scannedAt, discoveries, youtube: {...}, claude: {...} }
 */
export async function GET(req) {
  const ytKeys = getConfiguredKeys();
  if (!ytKeys.length) {
    return Response.json(
      { error: "YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";

  const startedAt = Date.now();
  let yt;
  try {
    yt = await discoverTrendingVideos({ force });
  } catch (e) {
    return Response.json(
      {
        error: e?.message || String(e),
        stage: "youtube",
        code: e?.code || null,
      },
      { status: 502 }
    );
  }

  if (!yt.videos.length) {
    return Response.json(
      {
        error: "YouTube 응답에서 영상을 수집하지 못했습니다.",
        stage: "youtube",
        failedKeywords: yt.failedKeywords,
      },
      { status: 502 }
    );
  }

  let claude;
  try {
    claude = await discoverNewCategories(
      claudeKey,
      D.map((c) => ({ n: c.n, kw: c.kw })),
      yt
    );
  } catch (e) {
    return Response.json(
      { error: e?.message || String(e), stage: "claude" },
      { status: 502 }
    );
  }

  return Response.json({
    scannedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    existingCount: D.length,
    youtube: {
      keywordsCovered: yt.keywordsCovered,
      failedKeywords: yt.failedKeywords,
      videoCount: yt.videos.length,
      publishedAfter: yt.publishedAfter,
      quotaUsed: yt.quotaUsed,
      cacheHit: !!yt.cacheHit,
      quotaUsedToday: getQuotaUsage(),
      quotaDailyTotal: 10000 * ytKeys.length,
      keysStatus: getKeysStatus(),
    },
    claude: {
      usage: claude.usage,
      estCostUSD: claude.estCostUSD,
      parseError: claude.parseError,
      raw: claude.parseError ? claude.raw : null,
    },
    discoveries: claude.discoveries,
  });
}
