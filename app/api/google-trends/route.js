import { D } from "@/lib/data";
import { fetchTrend, summarizeTrendShape } from "@/lib/api/google-trends";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/google-trends?categoryId=1&geo=US&timeframe=today%205-y
 * — 단일 카테고리의 5년 추이만 가져옵니다 (전체 일괄은 Google 차단 위험).
 * 클라이언트는 검증 화면에서 해당 카테고리 진입 시 1회만 호출하고 localStorage 캐싱.
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const categoryId = Number(searchParams.get("categoryId"));
  const geo = searchParams.get("geo") || "US";
  const timeframe = searchParams.get("timeframe") || "today 5-y";

  const cat = D.find((c) => c.id === categoryId);
  if (!cat) {
    return Response.json({ error: `category ${categoryId} not found` }, { status: 404 });
  }

  const keyword = geo === "KR" ? cat.kw?.KR : cat.kw?.US;
  if (!keyword) {
    return Response.json({ error: "keyword missing for this category/geo" }, { status: 400 });
  }

  const startedAt = Date.now();
  try {
    const data = await fetchTrend(keyword, geo, timeframe);
    const shape = summarizeTrendShape(data.points);
    return Response.json({
      id: cat.id,
      n: cat.n,
      keyword: data.keyword,
      geo: data.geo,
      timeframe: data.timeframe,
      elapsedMs: Date.now() - startedAt,
      points: data.points,
      shape,
    });
  } catch (e) {
    return Response.json(
      {
        id: cat.id,
        n: cat.n,
        error: e?.message || String(e),
        hint:
          "Google Trends 는 비공식 엔드포인트이므로 일시 차단/형식 변경에 따라 실패할 수 있습니다. 5~10분 후 재시도하거나 카테고리를 바꿔보세요.",
      },
      { status: 502 }
    );
  }
}
