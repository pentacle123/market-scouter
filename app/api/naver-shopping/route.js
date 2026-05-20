import { D } from "@/lib/data";
import { scanShoppingInsight } from "@/lib/api/naver-shopping";
import { calcMoM, avgRatio } from "@/lib/api/naver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json(
      {
        error: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.",
        hint:
          "검색어 트렌드와 동일한 자격증명을 사용합니다. 발급: https://developers.naver.com/apps → 데이터랩 사용 API 추가.",
      },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  let scan;
  try {
    scan = await scanShoppingInsight(
      { clientId, clientSecret },
      D.map((c) => ({
        id: c.id,
        n: c.n,
        e: c.e,
        type: c.type,
        mk: c.mk,
        naverCid: c.naverCid || null,
      }))
    );
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 502 });
  }

  const results = scan.perCategory.map((c) => {
    const data = c.timeseries?.data || [];
    const mom = calcMoM(data);
    const avg = avgRatio(data);
    const peak = data.reduce((max, d) => (d.ratio > max ? d.ratio : max), 0);
    return {
      id: c.id,
      n: c.n,
      e: c.e,
      type: c.type,
      mk: c.mk,
      naverCid: c.naverCid,
      hasCid: c.hasCid,
      data,
      mom,
      avgRatio: avg,
      peakRatio: peak,
      breakdown: c.breakdown,
      hasData: data.length > 0,
      isRising: mom.deltaPct != null && mom.deltaPct >= 20,
      isFalling: mom.deltaPct != null && mom.deltaPct <= -20,
      // 핵심 인사이트: 쇼핑 카테고리 미형성 = 블루오션의 추가 증거
      isBlueOceanSignal: !c.hasCid,
    };
  });

  // 매핑된 카테고리(데이터 있음) → 미매핑(블루오션 신호) 순서로 정렬,
  // 그 안에서는 MoM 증감률 내림차순.
  results.sort((a, b) => {
    if (a.hasCid !== b.hasCid) return a.hasCid ? -1 : 1;
    const ax = a.mom.deltaPct == null ? -Infinity : a.mom.deltaPct;
    const bx = b.mom.deltaPct == null ? -Infinity : b.mom.deltaPct;
    return bx - ax;
  });

  return Response.json({
    scannedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    startDate: scan.startDate,
    endDate: scan.endDate,
    timeUnit: scan.timeUnit,
    tsBatches: scan.tsBatches,
    mappedCount: results.filter((r) => r.hasCid).length,
    blueOceanSignalCount: results.filter((r) => !r.hasCid).length,
    results,
    errors: scan.errors,
  });
}
