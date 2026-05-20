import { D } from "@/lib/data";
import { scanKoreaSearchTrend, calcMoM, avgRatio } from "@/lib/api/naver";

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
          "발급: https://developers.naver.com/apps → 애플리케이션 등록 → 데이터랩(검색어 트렌드) 사용 API 선택. 로컬: .env.local 에 추가 후 dev 재시작. 운영: Vercel Project → Settings → Environment Variables.",
      },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  let scan;
  try {
    scan = await scanKoreaSearchTrend(
      { clientId, clientSecret },
      D.map((c) => ({ id: c.id, n: c.n, kw: c.kw })),
      { monthsBack: 12 }
    );
  } catch (e) {
    return Response.json(
      { error: e?.message || String(e) },
      { status: 502 }
    );
  }

  const byId = new Map(scan.perCategory.map((r) => [r.id, r]));

  const results = D.map((cat) => {
    const trend = byId.get(cat.id);
    const data = trend?.data || [];
    const mom = calcMoM(data);
    const avg = avgRatio(data);
    const peak = data.reduce((max, d) => (d.ratio > max ? d.ratio : max), 0);
    return {
      id: cat.id,
      n: cat.n,
      e: cat.e,
      type: cat.type,
      mk: cat.mk,
      kw: cat.kw,
      keyword: cat.kw.KR,
      data,
      mom,
      avgRatio: avg,
      peakRatio: peak,
      isRising: mom.deltaPct != null && mom.deltaPct >= 20,
      isFalling: mom.deltaPct != null && mom.deltaPct <= -20,
      hasData: data.length > 0,
    };
  });

  // 증감률 내림차순(상승 카테고리가 위로). null 은 뒤로.
  results.sort((a, b) => {
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
    batches: scan.batches,
    results,
    errors: scan.errors,
  });
}
