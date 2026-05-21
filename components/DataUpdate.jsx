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

// 카테고리 타입별 카운트 (data.js 변경 시 자동 반영)
const TYPE_COUNT = D.reduce((acc, c) => {
  acc[c.type] = (acc[c.type] || 0) + 1;
  return acc;
}, {});

const YT_SCOPE_OPTIONS = [
  {
    id: "blue",
    label: "블루오션만",
    desc: `핵심 ${TYPE_COUNT.blue || 0}개 카테고리 · 매번 스캔 권장`,
    cats: TYPE_COUNT.blue || 0,
  },
  {
    id: "blue_gap",
    label: "블루오션 + 틈새",
    desc: `${(TYPE_COUNT.blue || 0) + (TYPE_COUNT.gap || 0)}개 카테고리`,
    cats: (TYPE_COUNT.blue || 0) + (TYPE_COUNT.gap || 0),
  },
  {
    id: "no_excluded",
    label: "전체 (비추천 제외)",
    desc: `${(TYPE_COUNT.blue || 0) + (TYPE_COUNT.gap || 0) + (TYPE_COUNT.cond || 0)}개 (비추천 ${TYPE_COUNT.no || 0}개 제외)`,
    cats:
      (TYPE_COUNT.blue || 0) +
      (TYPE_COUNT.gap || 0) +
      (TYPE_COUNT.cond || 0),
  },
  {
    id: "all",
    label: "전체 (비추천 포함)",
    desc: `${D.length}개 모두`,
    cats: D.length,
  },
];

// 카테고리당 YouTube 스캔 비용 (US + KR 양쪽 = 202 units)
const UNITS_PER_CATEGORY = 202;

export default function DataUpdate({ onComplete }) {
  // 캐시된 데이터 상태
  const [caches, setCaches] = useState({ yt: null, nv: null, ns: null, ai: {} });
  const [opts, setOpts] = useState({
    youtube: true,
    youtubeScope: "blue", // blue | blue_gap | no_excluded | all
    youtubeForce: false,
    naverTrend: true,
    naverShopping: true,
    claude: "missing",
  });
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [progress, setProgress] = useState(null);
  const [quotaStatus, setQuotaStatus] = useState(null);

  function reloadCaches() {
    setCaches({
      yt: loadJson(CACHE_KEYS.youtube),
      nv: loadJson(CACHE_KEYS.naverTrend),
      ns: loadJson(CACHE_KEYS.naverShopping),
      ai: loadClaudeAnalysisMap(),
    });
  }
  async function reloadQuotaStatus() {
    try {
      const res = await fetch("/api/youtube-quota", { cache: "no-store" });
      if (res.ok) setQuotaStatus(await res.json());
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    reloadCaches();
    reloadQuotaStatus();
  }, []);

  const analyzedCount = Object.keys(caches.ai || {}).length;
  const missingCount = D.length - analyzedCount;

  // Claude 비용 추정
  const claudeTargets =
    opts.claude === "all" ? D.length : opts.claude === "missing" ? missingCount : 0;
  const estCostUSD = (claudeTargets * 2200 * 3 + claudeTargets * 2200 * 15) / 1_000_000;

  // YouTube 예상 쿼터 (선택 scope 기준)
  const ytScope = YT_SCOPE_OPTIONS.find((o) => o.id === opts.youtubeScope) || YT_SCOPE_OPTIONS[0];
  const ytCalls = ytScope.cats * 2; // US + KR
  const ytEstUnits = opts.youtube ? ytCalls * 101 : 0; // 카테고리당 101 units (search 100 + videos 1)

  async function run() {
    setRunning(true);
    setLog([]);
    setProgress(null);
    const summary = await runScanPipeline({
      youtube: opts.youtube,
      youtubeScope: opts.youtubeScope,
      youtubeForce: opts.youtubeForce,
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
    reloadQuotaStatus();
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>📡</span>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#4338CA" }}>데이터 업데이트</div>
        <span style={{ fontSize: 10, color: "#6B7280" }}>의사결정 전 1회 실행</span>
      </div>

      {/* 쿼터 대시보드 */}
      <QuotaDashboard status={quotaStatus} estUnits={ytEstUnits} />

      {/* 캐시 상태 + 선택 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <YoutubeSource
          opts={opts}
          setOpts={setOpts}
          lastScan={lastScans.youtube}
          summary={caches.yt ? `${caches.yt.results?.length || 0}개 (${caches.yt.scope || "all"})` : null}
          ytEstUnits={ytEstUnits}
          ytScope={ytScope}
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

// ─── YouTube 소스 — 4단계 스코프 + 강제 갱신 ─────────────────────────────────
function YoutubeSource({ opts, setOpts, lastScan, summary, ytEstUnits, ytScope }) {
  const active = opts.youtube;
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
          onChange={(e) => setOpts({ ...opts, youtube: e.target.checked })}
          style={{ marginTop: 2 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#222" }}>
            🌍 YouTube (글로벌 쇼츠)
          </div>
          <div style={{ fontSize: 9.5, color: "#888", marginTop: 1, lineHeight: 1.5 }}>
            {summary ? `${summary} · 갱신 ${fmtDateTime(lastScan).slice(5, 16)}` : "캐시 없음"}
            {active && (
              <>
                {" · "}
                <span style={{ color: "#4338CA", fontWeight: 700 }}>~{ytEstUnits.toLocaleString()} units</span>
                {" "}
                <span style={{ color: "#666" }}>({ytScope.cats}개 × 2국)</span>
              </>
            )}
          </div>
        </div>
      </div>
      {active && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6, marginLeft: 22 }}>
            {YT_SCOPE_OPTIONS.map((sc) => (
              <button
                key={sc.id}
                onClick={() => setOpts({ ...opts, youtubeScope: sc.id })}
                title={sc.desc}
                style={{
                  padding: "3px 7px",
                  fontSize: 9.5,
                  fontWeight: 600,
                  border: "1px solid",
                  borderColor: opts.youtubeScope === sc.id ? "#6366F1" : "#E5E7EB",
                  background: opts.youtubeScope === sc.id ? "#EEF2FF" : "#fff",
                  color: opts.youtubeScope === sc.id ? "#4338CA" : "#666",
                  borderRadius: 99,
                  cursor: "pointer",
                }}
              >
                {sc.label} ({sc.cats})
              </button>
            ))}
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 9.5,
              color: "#666",
              marginTop: 5,
              marginLeft: 22,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={opts.youtubeForce}
              onChange={(e) => setOpts({ ...opts, youtubeForce: e.target.checked })}
              style={{ margin: 0 }}
            />
            7일 서버 캐시 무시하고 재호출 (불필요 시 OFF)
          </label>
        </>
      )}
    </div>
  );
}

// ─── 쿼터 대시보드 ────────────────────────────────────────────────────────────
export function QuotaDashboard({ status, estUnits }) {
  if (!status) return null;
  const used = status.quotaUsedToday?.totalUsed || 0;
  const cap = status.quotaDailyTotal || 10000;
  const projected = used + (estUnits || 0);
  const usedPct = Math.min(100, (used / cap) * 100);
  const projectedPct = Math.min(100, (projected / cap) * 100);
  const projectedColor =
    projected >= cap ? "#DC2626" : projected >= cap * 0.8 ? "#F59E0B" : "#10B981";
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: 6,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: "#444",
          marginBottom: 5,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700 }}>📊 YouTube 쿼터</span>
        <span style={{ color: "#666" }}>
          오늘 사용 <b style={{ color: "#4338CA" }}>{used.toLocaleString()}</b> /{" "}
          {cap.toLocaleString()} ({Math.round(usedPct)}%)
        </span>
        {estUnits > 0 && (
          <span style={{ color: projectedColor, marginLeft: "auto" }}>
            +{estUnits.toLocaleString()} (예상 후 {Math.round(projectedPct)}%)
          </span>
        )}
      </div>
      <div
        style={{
          position: "relative",
          height: 8,
          background: "#E5E7EB",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        {/* 현재 사용 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${usedPct}%`,
            background: "#4338CA",
          }}
        />
        {/* 예상 증가분 (반투명) */}
        {estUnits > 0 && (
          <div
            style={{
              position: "absolute",
              left: `${usedPct}%`,
              top: 0,
              height: "100%",
              width: `${Math.max(0, projectedPct - usedPct)}%`,
              background: projectedColor,
              opacity: 0.5,
            }}
          />
        )}
      </div>
      {/* 키 상태 */}
      <div
        style={{
          marginTop: 5,
          fontSize: 9.5,
          color: "#666",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <span>
          🔑 API 키{" "}
          <b style={{ color: status.keys.available > 0 ? "#059669" : "#DC2626" }}>
            {status.keys.available}/{status.keys.total}
          </b>{" "}
          사용 가능
        </span>
        {status.keys.list?.map((k) => (
          <span
            key={k.index}
            style={{
              padding: "1px 6px",
              fontSize: 9,
              borderRadius: 99,
              background: k.exhausted ? "#FEF2F2" : "#ECFDF5",
              color: k.exhausted ? "#B91C1C" : "#059669",
              border: k.exhausted ? "1px solid #FECACA" : "1px solid #A7F3D0",
            }}
            title={k.exhausted ? "오늘 쿼터 소진 — PST 자정 리셋" : "활성"}
          >
            #{k.index} {k.exhausted ? "❌" : "✓"}
          </span>
        ))}
      </div>
    </div>
  );
}
