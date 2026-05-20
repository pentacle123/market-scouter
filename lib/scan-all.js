// "데이터 업데이트" 일괄 스캔 헬퍼.
// 사용자가 체크박스로 선택한 소스만 순차 실행.
// 각 단계 완료 즉시 localStorage 캐시에 저장 (도중 중단 시에도 결과 보존).
//
// 진행률 콜백: { stage, status, message?, current?, total? }
//   stage: "youtube" | "naver-trend" | "naver-shopping" | "claude"
//   status: "start" | "progress" | "done" | "error"

import { D } from "@/lib/data";
import {
  CACHE_KEYS,
  saveJson,
  loadJson,
  getYoutubeForId,
  getNaverTrendForId,
  getNaverShoppingForId,
  loadClaudeAnalysisMap,
  saveClaudeAnalysisMap,
} from "@/lib/ai-cache";

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function scanYoutube(onProgress) {
  onProgress?.({ stage: "youtube", status: "start", message: "YouTube US/KR 쇼츠 스캔 중…" });
  try {
    const data = await fetchJson("/api/youtube-scan");
    saveJson(CACHE_KEYS.youtube, data);
    onProgress?.({
      stage: "youtube",
      status: "done",
      message: `${data.results.length}개 카테고리 · 쿼터 ${data.quotaUsed}/${data.quotaDailyFree}`,
    });
    return data;
  } catch (e) {
    onProgress?.({ stage: "youtube", status: "error", message: e.message });
    throw e;
  }
}

export async function scanNaverTrend(onProgress) {
  onProgress?.({ stage: "naver-trend", status: "start", message: "네이버 검색 트렌드 스캔 중…" });
  try {
    const data = await fetchJson("/api/naver-trend");
    saveJson(CACHE_KEYS.naverTrend, data);
    onProgress?.({
      stage: "naver-trend",
      status: "done",
      message: `${data.results.length}개 카테고리 · ${data.batches}배치`,
    });
    return data;
  } catch (e) {
    onProgress?.({ stage: "naver-trend", status: "error", message: e.message });
    throw e;
  }
}

export async function scanNaverShopping(onProgress) {
  onProgress?.({ stage: "naver-shopping", status: "start", message: "네이버 쇼핑 인사이트 스캔 중…" });
  try {
    const data = await fetchJson("/api/naver-shopping");
    saveJson(CACHE_KEYS.naverShopping, data);
    onProgress?.({
      stage: "naver-shopping",
      status: "done",
      message: `매핑 ${data.mappedCount}개 · 블루오션 신호 ${data.blueOceanSignalCount}개`,
    });
    return data;
  } catch (e) {
    onProgress?.({ stage: "naver-shopping", status: "error", message: e.message });
    throw e;
  }
}

/**
 * Claude AI 분석.
 * @param {Object} opts
 * @param {"all"|"missing"} [opts.scope="all"]  "missing" = 미분석 카테고리만
 * @param {Function} [opts.onProgress]
 * @param {number} [opts.chunkSize=5]
 */
export async function scanClaudeAnalysis(opts = {}) {
  const { scope = "all", onProgress, chunkSize = 5 } = opts;
  const yt = loadJson(CACHE_KEYS.youtube);
  const nv = loadJson(CACHE_KEYS.naverTrend);
  const ns = loadJson(CACHE_KEYS.naverShopping);

  if (!nv) {
    const err = new Error("네이버 검색 트렌드 캐시가 없습니다. 먼저 검색 트렌드 스캔을 실행하세요.");
    onProgress?.({ stage: "claude", status: "error", message: err.message });
    throw err;
  }

  const existing = loadClaudeAnalysisMap();
  const targets =
    scope === "missing"
      ? D.filter((c) => !existing[String(c.id)])
      : D;

  if (!targets.length) {
    onProgress?.({ stage: "claude", status: "done", message: "분석할 카테고리 없음 (이미 모두 분석됨)" });
    return existing;
  }

  onProgress?.({
    stage: "claude",
    status: "start",
    total: targets.length,
    current: 0,
    message: `${targets.length}개 카테고리 분석 시작 (청크 ${chunkSize})`,
  });

  const next = { ...existing };
  let done = 0;
  let cost = 0;
  let errors = 0;

  for (let i = 0; i < targets.length; i += chunkSize) {
    const chunk = targets.slice(i, i + chunkSize);
    const settled = await Promise.allSettled(
      chunk.map(async (cat) => {
        const payload = {
          categoryId: cat.id,
          youtube: getYoutubeForId(yt, cat.id),
          naver: getNaverTrendForId(nv, cat.id),
          naverShopping: getNaverShoppingForId(ns, cat.id),
        };
        const res = await fetch("/api/claude-analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        return json;
      })
    );

    settled.forEach((s, idx) => {
      const cat = chunk[idx];
      done += 1;
      if (s.status === "fulfilled" && s.value.analysis) {
        next[String(cat.id)] = {
          analysis: s.value.analysis,
          usage: s.value.usage,
          estCostUSD: s.value.estCostUSD,
          parseError: s.value.parseError || null,
          scannedAt: new Date().toISOString(),
        };
        cost += s.value.estCostUSD || 0;
      } else {
        errors += 1;
      }
    });

    // 청크 단위로 캐시 즉시 저장 (중간 중단 시에도 결과 보존)
    saveClaudeAnalysisMap(next);
    onProgress?.({
      stage: "claude",
      status: "progress",
      total: targets.length,
      current: done,
      cost,
      errors,
      message: `${done}/${targets.length} · 누적 $${cost.toFixed(4)}`,
    });
  }

  onProgress?.({
    stage: "claude",
    status: "done",
    total: targets.length,
    current: done,
    cost,
    errors,
    message: `완료 · 총 $${cost.toFixed(4)}${errors ? ` · 실패 ${errors}건` : ""}`,
  });
  return next;
}

/**
 * 일괄 스캔 실행.
 * @param {Object} opts
 * @param {boolean} opts.youtube
 * @param {boolean} opts.naverTrend
 * @param {boolean} opts.naverShopping
 * @param {"none"|"missing"|"all"} opts.claude
 * @param {Function} opts.onProgress
 */
export async function runScanPipeline(opts) {
  const { onProgress } = opts;
  const summary = {};

  if (opts.youtube) {
    try {
      summary.youtube = await scanYoutube(onProgress);
    } catch (e) {
      summary.youtubeError = e.message;
    }
  }
  if (opts.naverTrend) {
    try {
      summary.naverTrend = await scanNaverTrend(onProgress);
    } catch (e) {
      summary.naverTrendError = e.message;
    }
  }
  if (opts.naverShopping) {
    try {
      summary.naverShopping = await scanNaverShopping(onProgress);
    } catch (e) {
      summary.naverShoppingError = e.message;
    }
  }
  if (opts.claude && opts.claude !== "none") {
    try {
      summary.claude = await scanClaudeAnalysis({ scope: opts.claude, onProgress });
    } catch (e) {
      summary.claudeError = e.message;
    }
  }

  return summary;
}
