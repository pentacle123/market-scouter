import { D } from "@/lib/data";
import { scanCategory, isBlueOcean } from "@/lib/api/youtube";
import { getKeysStatus, getConfiguredKeys } from "@/lib/api/youtube-keys";
import { getQuotaUsage } from "@/lib/server-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/youtube-scan
 *
 * 쿼리 파라미터:
 *   scope: "blue" (기본) | "blue_gap" | "no_excluded" | "all"
 *     · blue          = type=blue만 (7개)
 *     · blue_gap      = blue + gap (15개)
 *     · no_excluded   = blue + gap + cond (23개)
 *     · all           = 30개 모두
 *   ids:  쉼표 구분 카테고리 ID 목록 (scope 보다 우선)
 *   force: "true" 면 캐시 무시
 */
const SCOPE_FILTERS = {
  blue: (c) => c.type === "blue",
  blue_gap: (c) => c.type === "blue" || c.type === "gap",
  no_excluded: (c) => c.type !== "no",
  all: () => true,
};

export async function GET(req) {
  const keys = getConfiguredKeys();
  if (!keys.length) {
    return Response.json(
      {
        error: "YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.",
        hint:
          "YOUTUBE_API_KEY 외에 YOUTUBE_API_KEY_2, YOUTUBE_API_KEY_3 를 추가하면 자동 키 로테이션이 동작합니다.",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "blue";
  const idsParam = searchParams.get("ids");
  const force = searchParams.get("force") === "true";

  let targets;
  if (idsParam) {
    const set = new Set(idsParam.split(",").map((s) => Number(s.trim())).filter(Boolean));
    targets = D.filter((c) => set.has(c.id));
  } else {
    const filter = SCOPE_FILTERS[scope] || SCOPE_FILTERS.blue;
    targets = D.filter(filter);
  }

  const startedAt = Date.now();
  let cacheHits = 0;
  let actualQuotaCalls = 0;

  const settled = await Promise.allSettled(
    targets.map(async (cat) => {
      const [us, kr] = await Promise.all([
        scanCategory(cat.kw.US, "US", { force }),
        scanCategory(cat.kw.KR, "KR", { force }),
      ]);
      if (us.cacheHit) cacheHits++;
      else actualQuotaCalls++;
      if (kr.cacheHit) cacheHits++;
      else actualQuotaCalls++;
      const usCount = us.totalResults;
      const krCount = kr.totalResults;
      const ratio = krCount > 0 ? usCount / krCount : usCount > 0 ? usCount : 0;
      return {
        id: cat.id,
        n: cat.n,
        e: cat.e,
        type: cat.type,
        mk: cat.mk,
        kw: cat.kw,
        US: {
          videoCount: usCount,
          sampleCount: us.sampleCount,
          avgViews: us.avgViews,
          topViews: us.topViews,
        },
        KR: {
          videoCount: krCount,
          sampleCount: kr.sampleCount,
          avgViews: kr.avgViews,
          topViews: kr.topViews,
        },
        ratio: Math.round(ratio * 10) / 10,
        isBlueOcean: isBlueOcean({ usCount, krCount }),
        cacheHit: us.cacheHit && kr.cacheHit,
        quotaUsed: us.quotaUsed + kr.quotaUsed,
      };
    })
  );

  const results = [];
  const errors = [];
  let quotaUsed = 0;
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      results.push(r.value);
      quotaUsed += r.value.quotaUsed;
    } else {
      errors.push({
        id: targets[i].id,
        n: targets[i].n,
        error: r.reason?.message || String(r.reason),
      });
    }
  });

  results.sort((a, b) => b.ratio - a.ratio);

  return Response.json({
    scannedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    scope,
    force,
    scannedCount: targets.length,
    cacheHits,
    actualQuotaCalls,
    countries: ["US", "KR"],
    quotaUsed,
    quotaUsedToday: getQuotaUsage(),
    quotaDailyFree: 10000 * keys.length,
    keysStatus: getKeysStatus(),
    results,
    errors,
  });
}
