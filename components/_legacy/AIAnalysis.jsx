"use client";

import { useEffect, useMemo, useState } from "react";
import { D } from "@/lib/data";
import {
  CACHE_KEYS,
  loadJson,
  getYoutubeForId,
  getNaverTrendForId,
  getNaverShoppingForId,
  loadClaudeAnalysisMap,
  saveClaudeAnalysisMap,
} from "@/lib/ai-cache";

const PRICE_PER_M_IN = 3;
const PRICE_PER_M_OUT = 15;
const EST_IN_PER_CAT = 1500;
const EST_OUT_PER_CAT = 800;
const KRW = 1380; // 환율 근사

function estCostUSD(n) {
  return (n * EST_IN_PER_CAT * PRICE_PER_M_IN + n * EST_OUT_PER_CAT * PRICE_PER_M_OUT) / 1_000_000;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AIAnalysis({ onAnalysisChange }) {
  const [yt, setYt] = useState(null);
  const [naver, setNaver] = useState(null);
  const [naverShopping, setNaverShopping] = useState(null);
  const [analyses, setAnalyses] = useState({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: null });
  const [error, setError] = useState(null);
  const [actualCost, setActualCost] = useState(0);

  useEffect(() => {
    setYt(loadJson(CACHE_KEYS.youtube));
    setNaver(loadJson(CACHE_KEYS.naverTrend));
    setNaverShopping(loadJson(CACHE_KEYS.naverShopping));
    setAnalyses(loadClaudeAnalysisMap());
  }, []);

  // 분석된 카테고리 수
  const analyzedCount = useMemo(() => Object.keys(analyses || {}).length, [analyses]);

  // 데이터 소스 준비 상태
  const sourceReady = {
    youtube: Boolean(yt),
    naverTrend: Boolean(naver),
    naverShopping: Boolean(naverShopping),
  };
  const allDataReady = sourceReady.youtube && sourceReady.naverTrend;
  // 쇼핑 인사이트는 선택 — 없어도 분석 가능

  const totalCostEst = estCostUSD(D.length);
  const totalCostKrwEst = Math.round(totalCostEst * KRW);

  async function runOne(catId) {
    const cat = D.find((c) => c.id === catId);
    if (!cat) return null;
    const payload = {
      categoryId: catId,
      youtube: getYoutubeForId(yt, catId),
      naver: getNaverTrendForId(naver, catId),
      naverShopping: getNaverShoppingForId(naverShopping, catId),
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
  }

  async function runAll(targetIds) {
    if (!allDataReady) {
      setError(
        "YouTube 글로벌 스캔과 한국 검색 트렌드 스캔이 먼저 캐시되어 있어야 합니다. 각 탭에서 한 번씩 스캔해주세요."
      );
      return;
    }
    setRunning(true);
    setError(null);
    setActualCost(0);
    const ids = targetIds || D.map((c) => c.id);
    setProgress({ done: 0, total: ids.length, current: null });

    const next = { ...analyses };
    let cost = 0;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const cat = D.find((c) => c.id === id);
      setProgress({ done: i, total: ids.length, current: cat?.n || null });
      try {
        const result = await runOne(id);
        next[String(id)] = {
          analysis: result.analysis,
          usage: result.usage,
          estCostUSD: result.estCostUSD,
          parseError: result.parseError || null,
          scannedAt: new Date().toISOString(),
        };
        cost += result.estCostUSD || 0;
        // 즉시 저장하여 도중 중단되어도 결과 보존
        saveClaudeAnalysisMap(next);
        setAnalyses({ ...next });
        setActualCost(cost);
        if (onAnalysisChange) onAnalysisChange(next);
      } catch (e) {
        setError(`카테고리 #${id} 분석 실패: ${e.message}. 나머지는 계속 진행합니다.`);
        // 실패해도 다음 카테고리로 진행
      }
    }
    setProgress({ done: ids.length, total: ids.length, current: null });
    setRunning(false);
  }

  function clearAnalyses() {
    if (!confirm("저장된 모든 AI 분석 결과를 삭제하시겠습니까?")) return;
    saveClaudeAnalysisMap({});
    setAnalyses({});
    if (onAnalysisChange) onAnalysisChange({});
  }

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "linear-gradient(135deg, #FAF5FF 0%, #EEF2FF 100%)",
        border: "1px solid #C7D2FE",
        borderRadius: 10,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>🤖</span>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#4338CA" }}>AI 분석 엔진</div>
        <span style={{ fontSize: 9, color: "#6B7280", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 4, padding: "1px 5px" }}>
          Claude Sonnet 4
        </span>
      </div>
      <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6, marginBottom: 10 }}>
        YouTube + 네이버 검색/쇼핑 데이터를 종합해 각 카테고리의 <b>경쟁 구조 · 소비자
        불만 · 숏폼 바이럴 적합도 · 종합 판단</b>을 자동 생성합니다.
      </div>

      {/* 데이터 소스 상태 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 4,
          marginBottom: 10,
        }}
      >
        <SourceBadge ok={sourceReady.youtube} required label="🌍 글로벌 스캔" />
        <SourceBadge ok={sourceReady.naverTrend} required label="🇰🇷 검색 트렌드" />
        <SourceBadge ok={sourceReady.naverShopping} required={false} label="🛒 쇼핑 인사이트" />
      </div>

      {!allDataReady && (
        <div
          style={{
            fontSize: 10.5,
            color: "#B45309",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 6,
            padding: "6px 9px",
            marginBottom: 10,
            lineHeight: 1.6,
          }}
        >
          AI 분석은 위 데이터 소스 중 <b>글로벌 스캔 · 검색 트렌드</b>가 캐시되어 있을 때
          시작할 수 있습니다. (쇼핑 인사이트는 선택)
        </div>
      )}

      {/* 분석 상태 / 진행률 */}
      {!running && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: "#555" }}>
            <span style={{ color: "#999" }}>분석 완료</span>{" "}
            <b style={{ color: "#4338CA" }}>{analyzedCount}</b>/{D.length}
          </div>
          <div style={{ fontSize: 11, color: "#999" }}>·</div>
          <div style={{ fontSize: 11, color: "#555" }}>
            <span style={{ color: "#999" }}>전체 예상 비용</span>{" "}
            <b style={{ color: "#059669" }}>~${totalCostEst.toFixed(2)}</b>{" "}
            <span style={{ color: "#AAA" }}>(약 ₩{totalCostKrwEst.toLocaleString()})</span>
          </div>
        </div>
      )}

      {running && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 4 }}>
            <div>
              <b style={{ color: "#4338CA" }}>분석 중…</b>{" "}
              <span style={{ color: "#666" }}>
                {progress.done}/{progress.total}{" "}
                {progress.current && `· ${progress.current}`}
              </span>
            </div>
            <div style={{ color: "#059669" }}>
              누적 ${actualCost.toFixed(4)}
            </div>
          </div>
          <div style={{ height: 6, background: "#E5E7EB", borderRadius: 99, overflow: "hidden" }}>
            <div
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                height: "100%",
                background: "linear-gradient(90deg, #4F46E5, #6366F1)",
                transition: "width 0.2s",
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "8px 10px",
            marginBottom: 10,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            fontSize: 10.5,
            color: "#B91C1C",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          onClick={() => runAll()}
          disabled={running || !allDataReady}
          style={{
            padding: "9px 16px",
            background: running || !allDataReady ? "#C7D2FE" : "linear-gradient(135deg, #7C3AED, #4338CA)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: running || !allDataReady ? "not-allowed" : "pointer",
          }}
        >
          {running ? "분석 중…" : analyzedCount > 0 ? "🤖 전체 재분석" : "🤖 전체 분석 시작"}
        </button>

        {analyzedCount > 0 && !running && (() => {
          const unanalyzed = D.filter((c) => !analyses[String(c.id)]).map((c) => c.id);
          if (!unanalyzed.length) return null;
          return (
            <button
              onClick={() => runAll(unanalyzed)}
              disabled={!allDataReady}
              style={{
                padding: "9px 16px",
                background: "#fff",
                border: "1px solid #C7D2FE",
                borderRadius: 8,
                color: "#4338CA",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              미분석 {unanalyzed.length}개만 분석
            </button>
          );
        })()}

        {analyzedCount > 0 && !running && (
          <button
            onClick={clearAnalyses}
            style={{
              padding: "9px 14px",
              background: "transparent",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              color: "#888",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            결과 초기화
          </button>
        )}
      </div>

      {analyzedCount > 0 && !running && (
        <div style={{ fontSize: 10, color: "#888", marginTop: 8 }}>
          마지막 분석 항목 시각:{" "}
          {fmtDateTime(
            Object.values(analyses)
              .map((a) => a.scannedAt)
              .sort()
              .reverse()[0]
          )}
        </div>
      )}
    </div>
  );
}

function SourceBadge({ ok, required, label }) {
  const color = ok ? "#059669" : required ? "#DC2626" : "#9CA3AF";
  const bg = ok ? "#ECFDF5" : required ? "#FEF2F2" : "#F9FAFB";
  const border = ok ? "#A7F3D0" : required ? "#FECACA" : "#E5E7EB";
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 6,
        padding: "5px 8px",
        fontSize: 10,
        color,
        fontWeight: 600,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span>{label}</span>
      <span>{ok ? "✓" : required ? "필요" : "선택"}</span>
    </div>
  );
}
