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
 * 전월 대비 증감률(%) 계산.
 * 마지막 데이터 포인트가 "현재 진행중인 월"(부분 월)이면 한 칸 거슬러 올라가
 * 직전 완료월을 기준점으로 사용한다 — 19일치 vs 30일치를 비교해 모든 카테고리가
 * 인위적으로 -30~50% 처럼 보이는 측정 편향을 제거하기 위함.
 *
 * @param {Array<{period:string, ratio:number}>} data 시간 오름차순
 * @returns {{prev:number, last:number, deltaPct:number|null,
 *           periodLast:string|null, periodPrev:string|null,
 *           excludedPartial:boolean}}
 */
export function calcMoM(data) {
  const empty = {
    prev: 0,
    last: 0,
    deltaPct: null,
    periodLast: null,
    periodPrev: null,
    excludedPartial: false,
  };
  if (!Array.isArray(data) || data.length === 0) return empty;

  // "YYYY-MM-DD" → "YYYY-MM"
  const ym = (p) => (typeof p === "string" ? p.slice(0, 7) : null);
  const now = new Date();
  const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let endIdx = data.length - 1;
  let excludedPartial = false;
  if (ym(data[endIdx].period) === nowYm && endIdx >= 1) {
    endIdx -= 1;
    excludedPartial = true;
  }

  if (endIdx < 1) {
    return {
      ...empty,
      last: data[endIdx]?.ratio ?? 0,
      periodLast: data[endIdx]?.period ?? null,
      excludedPartial,
    };
  }

  const last = data[endIdx].ratio;
  const prev = data[endIdx - 1].ratio;
  const periodLast = data[endIdx].period;
  const periodPrev = data[endIdx - 1].period;

  if (!prev) {
    return {
      prev,
      last,
      deltaPct: last > 0 ? null : 0,
      periodLast,
      periodPrev,
      excludedPartial,
    };
  }

  const deltaPct = ((last - prev) / prev) * 100;
  return {
    prev,
    last,
    deltaPct: Math.round(deltaPct * 10) / 10,
    periodLast,
    periodPrev,
    excludedPartial,
  };
}

/**
 * 데이터의 산술평균. 카테고리 간 "활성도" 가늠용 (요청 내 상대값이므로 같은 배치 내에서만 비교 의미).
 */
export function avgRatio(data) {
  if (!data?.length) return 0;
  const sum = data.reduce((a, b) => a + (b.ratio || 0), 0);
  return Math.round((sum / data.length) * 10) / 10;
}

// ─── 네이버 블로그 검색 (리뷰 수집용) ─────────────────────────────────────────
//
// 엔드포인트: GET https://openapi.naver.com/v1/search/blog.json
// 같은 NAVER_CLIENT_ID/SECRET 사용. 무료. 일일 호출 한도 25,000건 (앱 단위).

const BLOG_SEARCH_URL = "https://openapi.naver.com/v1/search/blog.json";

function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 단일 쿼리 블로그 검색.
 * @param {{clientId, clientSecret}} auth
 * @param {string} query
 * @param {{display?:number, sort?:"sim"|"date"}} [opts]
 */
export async function searchBlogs(auth, query, opts = {}) {
  const params = new URLSearchParams({
    query,
    display: String(opts.display ?? 10),
    sort: opts.sort || "sim",
  });
  const res = await fetch(`${BLOG_SEARCH_URL}?${params.toString()}`, {
    headers: {
      "X-Naver-Client-Id": auth.clientId,
      "X-Naver-Client-Secret": auth.clientSecret,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Naver blog search ("${query}"): ${res.status} ${text.slice(0, 200)}`);
  }
  const j = await res.json();
  return (j.items || []).map((it) => ({
    title: stripHtml(it.title),
    description: stripHtml(it.description),
    link: it.link,
    bloggerName: it.bloggername,
    postdate: it.postdate,
  }));
}

/**
 * 동일 제품에 대해 여러 쿼리(후기/단점/솔직 리뷰)를 병렬 검색하고 중복 제거.
 * @returns {Promise<Array<{title, description, link, bloggerName, postdate, sourceQuery}>>}
 */
export async function searchReviewQueries(auth, queries, opts = {}) {
  const display = opts.displayPerQuery ?? 10;
  const settled = await Promise.allSettled(
    queries.map((q) => searchBlogs(auth, q, { display }))
  );
  const seen = new Set();
  const all = [];
  const failed = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      r.value.forEach((b) => {
        if (b.link && seen.has(b.link)) return;
        if (b.link) seen.add(b.link);
        all.push({ ...b, sourceQuery: queries[i] });
      });
    } else {
      failed.push({ query: queries[i], error: r.reason?.message || String(r.reason) });
    }
  });
  return { blogs: all, failed };
}
