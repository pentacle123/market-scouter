// Google Trends 비공식 클라이언트 (서버 전용).
// pytrends 가 호출하는 내부 엔드포인트 2단계를 그대로 사용:
//   1) /trends/api/explore — 토큰 + widget 정의 발급
//   2) /trends/api/widgetdata/multiline — 시계열 데이터
//
// 응답 앞에 XSSI 방어용 ")]}'," 5바이트 prefix 가 붙으므로 잘라내고 파싱.
// 라이브러리 의존성 없음. 단, Google 이 자주 차단하므로 캐싱 + 우아한 실패 필수.

const EXPLORE_URL = "https://trends.google.com/trends/api/explore";
const WIDGET_URL = "https://trends.google.com/trends/api/widgetdata/multiline";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

function stripXssi(text) {
  // ")]}',\n" 또는 ")]}'," 변종을 모두 제거
  let s = text;
  if (s.charCodeAt(0) === 0x29 /* ')' */) {
    // 첫 줄 단위로 prefix 잘라냄: 보통 5바이트 또는 6바이트
    const newline = s.indexOf("\n");
    if (newline >= 0 && newline < 10) s = s.slice(newline + 1);
    else if (s.startsWith(")]}',")) s = s.slice(5);
  }
  return s.trim();
}

async function fetchTrendsJson(url, paramsObj) {
  const params = new URLSearchParams(paramsObj);
  const res = await fetch(`${url}?${params.toString()}`, {
    headers: HEADERS,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google Trends HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const cleaned = stripXssi(text);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Google Trends parse failed: ${e.message} (head: ${cleaned.slice(0, 100)})`);
  }
}

/**
 * 단일 키워드 5년 추이.
 * @param {string} keyword
 * @param {string} geo  "US" | "KR" | "" (worldwide)
 * @param {string} timeframe  기본 "today 5-y"
 * @returns {Promise<{keyword, geo, timeframe, points: Array<{period:string, ratio:number}>}>}
 */
export async function fetchTrend(keyword, geo = "US", timeframe = "today 5-y") {
  // 키워드를 OR 로 결합한 경우 첫 단어만 사용 (Google Trends 는 한 키워드만 지원)
  const cleanKeyword = String(keyword).split("|")[0].trim();

  // 1단계: explore → 토큰 + widget 정의
  const exploreReq = {
    comparisonItem: [{ keyword: cleanKeyword, geo, time: timeframe }],
    category: 0,
    property: "",
  };
  const explore = await fetchTrendsJson(EXPLORE_URL, {
    hl: "en-US",
    tz: "360",
    req: JSON.stringify(exploreReq),
  });

  const widgets = explore.widgets || [];
  const tsWidget = widgets.find((w) => w.id === "TIMESERIES");
  if (!tsWidget) {
    throw new Error("Google Trends: no TIMESERIES widget in explore response");
  }

  // 2단계: widgetdata/multiline → 시계열
  const widget = await fetchTrendsJson(WIDGET_URL, {
    hl: "en-US",
    tz: "360",
    req: JSON.stringify(tsWidget.request),
    token: tsWidget.token,
  });

  const timeline = widget?.default?.timelineData;
  if (!Array.isArray(timeline)) {
    throw new Error("Google Trends: malformed timeline data");
  }

  const points = timeline.map((d) => ({
    period: d.formattedAxisTime || d.formattedTime || d.time,
    timestamp: Number(d.time) || 0,
    ratio: Array.isArray(d.value) ? d.value[0] : 0,
  }));

  return { keyword: cleanKeyword, geo, timeframe, points };
}

/**
 * 곡선 모양 분석 — 상승/정점/하락 + 평균/피크/최근 기울기.
 */
export function summarizeTrendShape(points) {
  if (!Array.isArray(points) || points.length < 4) {
    return { verdict: "데이터 부족", avg: 0, peak: 0, recentSlope: 0 };
  }
  const values = points.map((p) => p.ratio);
  const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  const peak = Math.max(...values);
  // 최근 6개월 기울기 vs 전체 평균
  const recent = values.slice(-6);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlier = values.slice(0, -6);
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / Math.max(1, earlier.length);
  const recentSlope = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;

  let verdict;
  if (recentSlope >= 15) verdict = "상승 중";
  else if (recentSlope >= -15) verdict = "정점·안정";
  else verdict = "하락 중";

  // 5년간 데이터가 꾸준히 50+ 이면 "장기 트렌드"
  const persistentHigh = values.filter((v) => v >= 50).length / values.length;
  const isLongTerm = persistentHigh >= 0.5;
  const isFlash = peak >= 60 && persistentHigh < 0.15;

  return {
    verdict,
    avg,
    peak,
    recentSlope: Math.round(recentSlope * 10) / 10,
    isLongTerm,
    isFlash,
    durationVerdict: isFlash ? "반짝" : isLongTerm ? "장기" : "중기",
  };
}
