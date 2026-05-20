import { D } from "@/lib/data";
import { scanCategory, isBlueOcean } from "@/lib/api/youtube";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: "YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.",
        hint: "로컬: .env.local 에 YOUTUBE_API_KEY=... 추가 후 dev 재시작. 운영: Vercel Project → Settings → Environment Variables.",
      },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  const settled = await Promise.allSettled(
    D.map(async (cat) => {
      const [us, kr] = await Promise.all([
        scanCategory(apiKey, cat.kw.US, "US"),
        scanCategory(apiKey, cat.kw.KR, "KR"),
      ]);
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
        id: D[i].id,
        n: D[i].n,
        error: r.reason?.message || String(r.reason),
      });
    }
  });

  // 비율 내림차순(블루오션 후보가 위로)
  results.sort((a, b) => b.ratio - a.ratio);

  return Response.json({
    scannedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    lookbackDays: 30,
    countries: ["US", "KR"],
    quotaUsed,
    quotaDailyFree: 10000,
    results,
    errors,
  });
}
