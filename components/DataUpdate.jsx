"use client";

import { useEffect, useMemo, useState } from "react";
import { D } from "@/lib/data";
import {
  CACHE_KEYS,
  loadJson,
  loadClaudeAnalysisMap,
} from "@/lib/ai-cache";
import { runScanPipeline } from "@/lib/scan-all";

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const STAGE_LABEL = {
  youtube: "🌍 YouTube",
  "naver-trend": "🔍 검색 트렌드",
  "naver-shopping": "🛒 쇼핑 인사이트",
  claude: "🤖 AI 분석",
};

export default function DataUpdate({ onComplete }) {
  // 캐시된 데이터 상태
  const [caches, setCaches] = useState({ yt: null, nv: null, ns: null, ai: {} });
  const [opts, setOpts] = useState({
    youtube: true,
    naverTrend: true,
    naverShopping: true,
    claude: "missing", // none | missing | all
  });
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]); // [{stage, status, message, ts}]
  const [progress, setProgress] = useState(null);

  function reloadCaches() {
    setCaches({
      yt: loadJson(CACHE_KEYS.youtube),
      nv: loadJson(CACHE_KEYS.naverTrend),
      ns: loadJson(CACHE_KEYS.naverShopping),
      ai: loadClaudeAnalysisMap(),
    });
  }
  useEffect(() => {
    reloadCaches();
  }, []);

  const analyzedCount = Object.keys(caches.ai || {}).length;
  const missingCount = D.length - analyzedCount;

  // Claude 비용 추정 (선택된 scope 기준)
  const claudeTargets =
    opts.claude === "all" ? D.length : opts.claude === "missing" ? missingCount : 0;
  const estCostUSD = (claudeTargets * 1500 * 3 + claudeTargets * 800 * 15) / 1_000_000;

  async function run() {
    setRunning(true);
    setLog([]);
    setProgress(null);
    const summary = await runScanPipeline({
      youtube: opts.youtube,
      naverTrend: opts.naverTrend,
      naverShopping: opts.naverShopping,
      claude: opts.claude,
      onProgress: (p) => {
        setProgress(p);
        if (p.status === "done" || p.status === "error" || p.status === "start") {
          setLog((prev) => [...prev, { ...p, ts: Date.now() }]);
        }
      },
    });
    setRunning(false);
    setProgress(null);
    reloadCaches();
    if (onComplete) onComplete(summary);
  }

  const lastScans = useMemo(() => {
    return {
      youtube: caches.yt?.scannedAt,
      "naver-trend": caches.nv?.scannedAt,
      "naver-shopping": caches.ns?.scannedAt,
      claude: Object.values(caches.ai || {})
        .map((a) => a.scannedAt)
        .sort()
        .reverse()[0],
    };
  }, [caches]);

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "linear-gradient(135deg, #FAFBFF 0%, #F0F4FF 100%)",
        border: "1px solid #C7D2FE",
        borderRadius: 10,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>📡</span>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#4338CA" }}>데이터 업데이트</div>
        <span style={{ fontSize: 10, color: "#6B7280" }}>의사결정 전 1회 실행</span>
      </div>

      {/* 캐시 상태 + 선택 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <Source
          checked={opts.youtube}
          onChange={(v) => setOpts({ ...opts, youtube: v })}
          label="🌍 YouTube (글로벌 쇼츠)"
          lastScan={lastScans.youtube}
          summary={caches.yt ? `${caches.yt.results?.length || 0}개` : null}
          cost="쿼터 ~1,600"
        />
        <Source
          checked={opts.naverTrend}
          onChange={(v) => setOpts({ ...opts, naverTrend: v })}
          label="🔍 네이버 검색 트렌드"
          lastScan={lastScans["naver-trend"]}
          summary={caches.nv ? `${caches.nv.results?.length || 0}개` : null}
          cost="무료"
        />
        <Source
          checked={opts.naverShopping}
          onChange={(v) => setOpts({ ...opts, naverShopping: v })}
          label="🛒 네이버 쇼핑 인사이트"
          lastScan={lastScans["naver-shopping"]}
          summary={
            caches.ns
              ? `매핑 ${caches.ns.mappedCount} · 신호 ${caches.ns.blueOceanSignalCount}`
              : null
          }
          cost="무료"
        />
        <ClaudeSource
          opts={opts}
          setOpts={setOpts}
          lastScan={lastScans.claude}
          analyzedCount={analyzedCount}
          missingCount={missingCount}
          total={D.length}
          estCostUSD={estCostUSD}
        />
      </div>

      {/* 진행률 / 로그 */}
      {running && progress && (
        <ProgressBar progress={progress} />
      )}
      {log.length > 0 && !running && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 6,
            padding: "6px 10px",
            marginBottom: 10,
            fontSize: 10.5,
            color: "#444",
            lineHeight: 1.7,
            maxHeight: 100,
            overflowY: "auto",
          }}
        >
          {log.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <span style={{ color: l.status === "error" ? "#DC2626" : "#10B981" }}>
                {l.status === "error" ? "✗" : "✓"}
              </span>
              <span style={{ fontWeight: 700, color: "#444" }}>{STAGE_LABEL[l.stage] || l.stage}</span>
              <span style={{ color: "#666" }}>{l.message || ""}</span>
            </div>
          ))}
        </div>
      )}

      {/* 실행 버튼 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={run}
          disabled={running || (!opts.youtube && !opts.naverTrend && !opts.naverShopping && opts.claude === "none")}
          style={{
            padding: "9px 16px",
            background: running
              ? "#C7D2FE"
              : "linear-gradient(135deg, #4F46E5, #6366F1)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: running ? "wait" : "pointer",
          }}
        >
          {running ? "실행 중…" : "📡 선택한 데이터 업데이트"}
        </button>
        {estCostUSD > 0 && !running && (
          <div style={{ fontSize: 10.5, color: "#6B7280" }}>
            예상 Claude 비용{" "}
            <b style={{ color: "#059669" }}>~${estCostUSD.toFixed(3)}</b>{" "}
            <span style={{ color: "#AAA" }}>(₩{Math.round(estCostUSD * 1380).toLocaleString()})</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Source({ checked, onChange, label, lastScan, summary, cost }) {
  return (
    <label
      style={{
        display: "flex",
        gap: 7,
        alignItems: "flex-start",
        padding: "8px 10px",
        background: checked ? "#fff" : "#F9FAFB",
        border: checked ? "1px solid #6366F1" : "1px solid #E5E7EB",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2 }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#222" }}>{label}</div>
        <div style={{ fontSize: 9.5, color: "#888", marginTop: 1, lineHeight: 1.5 }}>
          {summary ? `${summary} · 갱신 ${fmtDateTime(lastScan).slice(5, 16)}` : "캐시 없음"}
          {" · "}
          <span style={{ color: "#666" }}>{cost}</span>
        </div>
      </div>
    </label>
  );
}

function ClaudeSource({ opts, setOpts, lastScan, analyzedCount, missingCount, total, estCostUSD }) {
  const active = opts.claude !== "none";
  return (
    <div
      style={{
        padding: "8px 10px",
        background: active ? "#fff" : "#F9FAFB",
        border: active ? "1px solid #6366F1" : "1px solid #E5E7EB",
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setOpts({ ...opts, claude: e.target.checked ? "missing" : "none" })}
          style={{ marginTop: 2 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#222" }}>🤖 Claude AI 분석</div>
          <div style={{ fontSize: 9.5, color: "#888", marginTop: 1, lineHeight: 1.5 }}>
            완료 {analyzedCount}/{total} · 갱신 {fmtDateTime(lastScan).slice(5, 16)}
          </div>
        </div>
      </div>
      {active && (
        <div style={{ display: "flex", gap: 4, marginTop: 6, marginLeft: 22 }}>
          {[
            { id: "missing", l: `미분석만 (${missingCount}개)` },
            { id: "all", l: `전체 재분석 (${total}개)` },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setOpts({ ...opts, claude: opt.id })}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 600,
                border: "1px solid",
                borderColor: opts.claude === opt.id ? "#6366F1" : "#E5E7EB",
                background: opts.claude === opt.id ? "#EEF2FF" : "#fff",
                color: opts.claude === opt.id ? "#4338CA" : "#666",
                borderRadius: 99,
                cursor: "pointer",
              }}
            >
              {opt.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ progress }) {
  const pct =
    progress.total && progress.current != null
      ? (progress.current / progress.total) * 100
      : null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 4 }}>
        <div>
          <b style={{ color: "#4338CA" }}>
            {STAGE_LABEL[progress.stage] || progress.stage}
          </b>
          {progress.message && (
            <span style={{ color: "#666", marginLeft: 6 }}>· {progress.message}</span>
          )}
        </div>
        {progress.cost != null && (
          <div style={{ color: "#059669" }}>${progress.cost.toFixed(4)}</div>
        )}
      </div>
      <div style={{ height: 6, background: "#E5E7EB", borderRadius: 99, overflow: "hidden" }}>
        <div
          style={{
            width: pct != null ? `${pct}%` : "100%",
            height: "100%",
            background: "linear-gradient(90deg, #4F46E5, #6366F1)",
            transition: "width 0.2s",
            animation: pct == null ? "shimmer 1.4s linear infinite" : "none",
          }}
        />
      </div>
    </div>
  );
}
