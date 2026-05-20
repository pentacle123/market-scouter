// 네이버 데이터랩 쇼핑 인사이트 클라이언트 (서버 전용).
// 동일 자격증명(NAVER_CLIENT_ID/SECRET) 사용.
//
// 엔드포인트 4종:
//   POST /v1/datalab/shopping/categories          → 카테고리(최대 3개) 클릭량 추이
//   POST /v1/datalab/shopping/category/device     → 기기별(pc/mo) 비율
//   POST /v1/datalab/shopping/category/gender     → 성별(f/m) 비율
//   POST /v1/datalab/shopping/category/age        → 연령별(10~60+) 비율
//
// 응답 ratio 는 검색어 트렌드와 마찬가지로 요청 내 최대값 100 기준 상대값.
// 단, device/gender/age 는 동일 시점 내 합산이 ~100 이 되는 분포값.

import { defaultDateRange } from "./naver";

const BASE = "https://openapi.naver.com/v1/datalab/shopping";
const URLS = {
  categories: `${BASE}/categories`,
  device: `${BASE}/category/device`,
  gender: `${BASE}/category/gender`,
  age: `${BASE}/category/age`,
};
const MAX_GROUPS = 3; // /categories 는 1요청당 최대 3개 그룹

async function naverPost(url, auth, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Naver-Client-Id": auth.clientId,
      "X-Naver-Client-Secret": auth.clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Naver Shopping API failed (${url.split("/").pop()}): ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchShoppingCategories(auth, categoryGroups, startDate, endDate, timeUnit = "month") {
  if (!categoryGroups.length) return { results: [] };
  if (categoryGroups.length > MAX_GROUPS) throw new Error(`max ${MAX_GROUPS} groups per request`);
  return naverPost(URLS.categories, auth, { startDate, endDate, timeUnit, category: categoryGroups });
}

export async function fetchShoppingDevice(auth, cid, startDate, endDate, timeUnit = "month") {
  return naverPost(URLS.device, auth, { startDate, endDate, timeUnit, category: cid });
}

export async function fetchShoppingGender(auth, cid, startDate, endDate, timeUnit = "month") {
  return naverPost(URLS.gender, auth, { startDate, endDate, timeUnit, category: cid });
}

export async function fetchShoppingAge(auth, cid, startDate, endDate, timeUnit = "month") {
  return naverPost(URLS.age, auth, { startDate, endDate, timeUnit, category: cid });
}

/**
 * 네이버 쇼핑 인사이트의 device/gender/age 응답에서 latest-complete-month breakdown 추출.
 *
 * 응답 shape (Naver 표준):
 *   results: [{
 *     title: "카테고리명",
 *     category: ["cid"],
 *     data: [
 *       { period: "2025-06-01", group: "f", ratio: 35.5 },
 *       { period: "2025-06-01", group: "m", ratio: 14.5 },
 *       ...
 *     ]
 *   }]
 *
 * dimension 값은 results[].group 이 아니라 data[].group 에 들어있다는 점에 주의.
 * 방어적으로 두 shape 모두 처리.
 */
function latestCompleteBreakdown(results) {
  if (!Array.isArray(results) || !results.length) return [];

  const now = new Date();
  const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const firstResultData = Array.isArray(results[0]?.data) ? results[0].data : [];
  const hasInlineGroup =
    firstResultData.length > 0 && firstResultData[0].group !== undefined;

  if (hasInlineGroup) {
    // Shape B (Naver 표준): results 1개, data 안에 (period, group, ratio) 튜플들
    const flat = [];
    results.forEach((r) => {
      (r.data || []).forEach((d) => {
        flat.push({
          period: d.period,
          group: String(d.group ?? ""),
          ratio: Number(d.ratio) || 0,
        });
      });
    });
    if (!flat.length) return [];

    const periods = Array.from(new Set(flat.map((x) => x.period))).sort();
    let target = periods[periods.length - 1];
    if (target && typeof target === "string" && target.slice(0, 7) === nowYm && periods.length >= 2) {
      target = periods[periods.length - 2];
    }

    const map = new Map();
    flat
      .filter((x) => x.period === target)
      .forEach((x) => {
        if (!x.group) return;
        map.set(x.group, (map.get(x.group) || 0) + x.ratio);
      });

    return Array.from(map.entries()).map(([group, ratio]) => ({
      group,
      ratio,
      period: target,
    }));
  }

  // Shape A (fallback): results 여러개, 각각 1개 dimension 값
  return results
    .map((r) => {
      const data = Array.isArray(r.data) ? r.data : [];
      let idx = data.length - 1;
      if (idx >= 0 && typeof data[idx].period === "string" && data[idx].period.slice(0, 7) === nowYm && idx >= 1) {
        idx -= 1;
      }
      return {
        group: String(r.group ?? r.title ?? ""),
        title: r.title ?? null,
        ratio: idx >= 0 ? (Number(data[idx].ratio) || 0) : 0,
        period: idx >= 0 ? data[idx].period : null,
      };
    })
    .filter((x) => x.group);
}

/**
 * 17 카테고리 스캔.
 * - cid 가 있는 카테고리만 호출
 * - 시계열: 3개 단위 배치 (/categories)
 * - device/gender/age: 카테고리당 3 API call (parallel)
 */
export async function scanShoppingInsight(auth, categories, opts = {}) {
  const { startDate, endDate } = defaultDateRange(opts.monthsBack ?? 12);

  const withCid = categories.filter((c) => c.naverCid);

  // ── 시계열 (categories 엔드포인트) ────────────────────────────────────
  const tsGroups = withCid.map((c) => ({
    name: `${c.id}::${c.n}`.slice(0, 250),
    param: [String(c.naverCid)],
  }));
  const tsBatches = [];
  for (let i = 0; i < tsGroups.length; i += MAX_GROUPS) {
    tsBatches.push(tsGroups.slice(i, i + MAX_GROUPS));
  }

  const tsSettled = await Promise.allSettled(
    tsBatches.map((b) => fetchShoppingCategories(auth, b, startDate, endDate, "month"))
  );

  const tsById = new Map();
  const errors = [];
  tsSettled.forEach((r, bi) => {
    const batchGroups = tsBatches[bi];
    if (r.status === "fulfilled") {
      (r.value.results || []).forEach((row, gi) => {
        const nameTag = row.title || batchGroups[gi].name;
        const idMatch = /^(\d+)::/.exec(nameTag);
        const id = idMatch ? Number(idMatch[1]) : null;
        tsById.set(id, {
          title: nameTag.replace(/^\d+::/, ""),
          data: (row.data || []).map((d) => ({
            period: d.period,
            ratio: Number(d.ratio) || 0,
          })),
        });
      });
    } else {
      const ids = batchGroups
        .map((g) => Number((g.name.match(/^(\d+)::/) || [])[1]))
        .filter(Boolean);
      errors.push({ scope: "timeseries", ids, error: r.reason?.message || String(r.reason) });
    }
  });

  // ── 분포 (device/gender/age 엔드포인트) ─────────────────────────────────
  const breakdownSettled = await Promise.allSettled(
    withCid.map(async (c) => {
      const [dev, gen, age] = await Promise.allSettled([
        fetchShoppingDevice(auth, c.naverCid, startDate, endDate, "month"),
        fetchShoppingGender(auth, c.naverCid, startDate, endDate, "month"),
        fetchShoppingAge(auth, c.naverCid, startDate, endDate, "month"),
      ]);
      return { id: c.id, dev, gen, age };
    })
  );

  const breakdownById = new Map();
  breakdownSettled.forEach((r) => {
    if (r.status !== "fulfilled") return;
    const { id, dev, gen, age } = r.value;
    const subErrors = [];
    if (dev.status === "rejected") subErrors.push({ scope: "device", id, error: dev.reason?.message || String(dev.reason) });
    if (gen.status === "rejected") subErrors.push({ scope: "gender", id, error: gen.reason?.message || String(gen.reason) });
    if (age.status === "rejected") subErrors.push({ scope: "age", id, error: age.reason?.message || String(age.reason) });
    if (subErrors.length) errors.push(...subErrors);
    breakdownById.set(id, {
      device: dev.status === "fulfilled" ? latestCompleteBreakdown(dev.value.results) : [],
      gender: gen.status === "fulfilled" ? latestCompleteBreakdown(gen.value.results) : [],
      age: age.status === "fulfilled" ? latestCompleteBreakdown(age.value.results) : [],
    });
  });

  return {
    startDate,
    endDate,
    timeUnit: "month",
    tsBatches: tsBatches.length,
    perCategory: categories.map((c) => ({
      id: c.id,
      n: c.n,
      e: c.e,
      type: c.type,
      mk: c.mk,
      naverCid: c.naverCid || null,
      hasCid: Boolean(c.naverCid),
      timeseries: tsById.get(c.id) || null,
      breakdown: breakdownById.get(c.id) || null,
    })),
    errors,
  };
}
