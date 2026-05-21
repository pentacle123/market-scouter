import { getKeysStatus, getConfiguredKeys } from "@/lib/api/youtube-keys";
import { getQuotaUsage, cacheStats } from "@/lib/server-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/youtube-quota
 * 현재 인스턴스의 쿼터/캐시/키 상태를 조회. DataUpdate 패널이 주기적으로 호출.
 * 주의: Vercel 서버리스라 인스턴스마다 카운터가 다를 수 있음 — "현재 인스턴스의 추정치".
 */
export async function GET() {
  const keys = getConfiguredKeys();
  const usage = getQuotaUsage();
  const status = getKeysStatus();
  return Response.json({
    keys: {
      total: keys.length,
      available: status.available,
      list: status.keys,
    },
    quotaUsedToday: usage,
    quotaDailyFree: 10000,
    quotaDailyTotal: 10000 * keys.length,
    cache: cacheStats(),
  });
}
