// 네이버 데이터랩 통합검색어 트렌드 API 클라이언트 (서버 전용).
// 엔드포인트: POST https://openapi.naver.com/v1/datalab/search
// 인증: X-Naver-Client-Id / X-Naver-Client-Secret 헤더
// 제약: 1요청당 keywordGroups 최대 5개 → 17 카테고리는 4배치(5+5+5+2)로 분할 호출.
// 응답 ratio 는 "요청 내 최대값을 100으로 둔 상대값"이므로 배치 간 절대 비교는 의미 없음.
// 단, 동일 카테고리 내 시계열 추이와 전월 대비 증감률은 정확히 비교 가능.

const ENDPOINT = "https://openapi.naver.com/v1/datalab/search";
const LOOKBACK_MONTHS = 12;
const MAX_GROUPS_PER_REQUEST = 5;

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * 오늘로부터 N개월 전 1일 ~ 어제까지의 [start, end] ISO 날짜 문자열.
 * 네이버 데이터랩은 endDate 가 미래면 거절하므로 항상 어제 이전으로 마감.
 */
export function defaultDateRange(monthsBack = LOOKBACK_MONTHS) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const start = new Date(end.getFullYear(), end.getMonth() - (monthsBack - 1), 1);
  const fmt = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

/**
 * 네이버 데이터랩 호출 (1배치).
 * @param {{clientId:string, clientSecret:string}} auth
 * @param {Array<{groupName:string, keywords:string[]}>} keywordGroups 최대 5개
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 * @param {"date"|"week"|"month"} timeUnit
 * @returns {Promise<{results: Array<{title:string, data:Array<{period:string, ratio:number}>}>}>}
 */
export async function fetchTrendBatch(auth, keywordGroups, startDate, endDate, timeUnit = "month") {
  if (!keywordGroups.length) return { results: [] };
  if (keywordGroups.length > MAX_GROUPS_PER_REQUEST) {
    throw new Error(`네이버 데이터랩은 1요청당 최대 ${MAX_GROUPS_PER_REQUEST}개 그룹입니다.`);
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "X-Naver-Client-Id": auth.clientId,
      "X-Naver-Client-Secret": auth.clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ startDate, endDate, timeUnit, keywordGroups }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Naver DataLab failed: ${res.status} ${text.slice(0, 200)}`
    );
  }
  return res.json();
}

/**
 * 카테고리 배열을 5개씩 묶어 전체 트렌드를 수집.
 * @param {{clientId:string, clientSecret:string}} auth
 * @param {Array<{id:number, n:string, kw:{KR:string}}>} categories
 * @param {object} [opts]
 * @param {number} [opts.monthsBack=12]
 * @returns {Promise<{startDate:string, endDate:string, timeUnit:"month",
 *   perCategory: Array<{id:number, title:string, data:Array<{period:string, ratio:number}>}>,
 *   errors: Array<{ids:number[], error:string}>, batches:number}>}
 */
export async function scanKoreaSearchTrend(auth, categories, opts = {}) {
  const monthsBack = opts.monthsBack ?? LOOKBACK_MONTHS;
  const { startDate, endDate } = defaultDateRange(monthsBack);

  // ID 충돌을 피하기 위해 groupName = "id::n" 로 인코딩, keywords 는 KR 키워드 1개.
  const groups = categories.map((c) => ({
    groupName: `${c.id}::${c.n}`.slice(0, 250),
    keywords: [c.kw.KR],
  }));

  const batches = [];
  for (let i = 0; i < groups.length; i += MAX_GROUPS_PER_REQUEST) {
    batches.push(groups.slice(i, i + MAX_GROUPS_PER_REQUEST));
  }

  const settled = await Promise.allSettled(
    batches.map((b) => fetchTrendBatch(auth, b, startDate, endDate, "month"))
  );

  const perCategory = [];
  const errors = [];

  settled.forEach((r, batchIdx) => {
    const batchGroups = batches[batchIdx];
    if (r.status === "fulfilled") {
      (r.value.results || []).forEach((row, gi) => {
        const decoded = row.title || batchGroups[gi].groupName;
        const idMatch = /^(\d+)::/.exec(decoded);
        const id = idMatch ? Number(idMatch[1]) : null;
        perCategory.push({
          id,
          title: decoded.replace(/^\d+::/, ""),
          data: (row.data || []).map((d) => ({
            period: d.period,
            ratio: typeof d.ratio === "number" ? d.ratio : Number(d.ratio) || 0,
          })),
        });
      });
    } else {
      const ids = batchGroups
        .map((g) => Number((g.groupName.match(/^(\d+)::/) || [])[1]))
        .filter(Boolean);
      errors.push({
        ids,
        error: r.reason?.message || String(r.reason),
      });
    }
  });

  return {
    startDate,
    endDate,
    timeUnit: "month",
    perCategory,
    errors,
    batches: batches.length,
  };
}

/**
 * 전월 대비 증감률(%) 계산. 데이터가 2개월 미만이거나 직전월이 0이면 null.
 * @param {Array<{period:string, ratio:number}>} data 시간 오름차순
 * @returns {{prev:number, last:number, deltaPct:number|null}}
 */
export function calcMoM(data) {
  if (!Array.isArray(data) || data.length < 2) {
    return { prev: 0, last: data?.[0]?.ratio ?? 0, deltaPct: null };
  }
  const last = data[data.length - 1].ratio;
  const prev = data[data.length - 2].ratio;
  if (!prev) {
    return { prev, last, deltaPct: last > 0 ? null : 0 };
  }
  const deltaPct = ((last - prev) / prev) * 100;
  return { prev, last, deltaPct: Math.round(deltaPct * 10) / 10 };
}

/**
 * 데이터의 산술평균. 카테고리 간 "활성도" 가늠용 (요청 내 상대값이므로 같은 배치 내에서만 비교 의미).
 */
export function avgRatio(data) {
  if (!data?.length) return 0;
  const sum = data.reduce((a, b) => a + (b.ratio || 0), 0);
  return Math.round((sum / data.length) * 10) / 10;
}
