"use client";

import { useEffect, useState } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import {
  LAYER_NAMES,
  LAYER_KEYS,
  LAYER_COLORS,
  calcXY,
  calcT,
  sig,
  TL,
  TC,
  TB,
  TBR,
} from "@/lib/data";
import {
  CACHE_KEYS,
  loadJson,
  loadClaudeAnalysisMap,
  getClaudeAnalysisForId,
  getYoutubeForId,
  getNaverTrendForId,
  getNaverShoppingForId,
} from "@/lib/ai-cache";

function aiScoreColor(score) {
  if (score == null) return "#9CA3AF";
  if (score >= 80) return "#059669";
  if (score >= 60) return "#2563EB";
  if (score >= 40) return "#D97706";
  return "#DC2626";
}

function fmtNum(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export default function OpportunityVerify({ cat, onNext, onBack }) {
  const [ai, setAi] = useState(null);
  const [yt, setYt] = useState(null);
  const [nv, setNv] = useState(null);
  const [ns, setNs] = useState(null);

  useEffect(() => {
    if (!cat) return;
    setAi(getClaudeAnalysisForId(loadClaudeAnalysisMap(), cat.id)?.analysis || null);
    setYt(getYoutubeForId(loadJson(CACHE_KEYS.youtube), cat.id));
    setNv(getNaverTrendForId(loadJson(CACHE_KEYS.naverTrend), cat.id));
    setNs(getNaverShoppingForId(loadJson(CACHE_KEYS.naverShopping), cat.id));
  }, [cat?.id]);

  if (!cat) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#AAA" }}>
        먼저 화면 1에서 검증할 카테고리를 선택하세요
      </div>
    );
  }

  const c = cat;
  const total = calcT(c);
  const radarData = LAYER_KEYS.map((k, i) => ({ subject: LAYER_NAMES[i], value: c[k], fullMark: 100 }));

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        화면 2 · 기회 검증
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        선택한 카테고리의 기회가 진짜인지 다각도 데이터로 확인합니다
      </p>

      {/* 카테고리 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 10,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 32 }}>{c.e}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>{c.n}</h3>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: TC[c.type],
                background: TB[c.type],
                padding: "2px 8px",
                borderRadius: 99,
                border: "1px solid " + TBR[c.type],
              }}
            >
              {TL[c.type]}
            </span>
          </div>
          <p style={{ fontSize: 11, color: "#999", margin: 0 }}>
            {c.mk} · {c.lc} · 종합 {total}
          </p>
        </div>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "#6366F1",
            fontSize: 11,
            cursor: "pointer",
            padding: 0,
          }}
        >
          ← 탐색으로
        </button>
      </div>

      {/* AI verdict 요약 */}
      {ai?.verdict && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 12,
            background: "#EEF2FF",
            border: "1px solid #C7D2FE",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: aiScoreColor(ai.verdict.score),
              lineHeight: 1,
              minWidth: 40,
              textAlign: "center",
            }}
          >
            {ai.verdict.score}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#4338CA", marginBottom: 1 }}>
              🤖 Claude 검증 결론
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#222", lineHeight: 1.4 }}>
              {ai.verdict.oneLine}
            </div>
            {ai.verdict.reasoning && (
              <div style={{ fontSize: 10.5, color: "#555", marginTop: 3, lineHeight: 1.6 }}>
                {ai.verdict.reasoning}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: "#4338CA", fontWeight: 700, padding: "6px 0 4px" }}>
        한 줄 판단
      </div>
      <div
        style={{
          padding: "10px 14px",
          marginBottom: 14,
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          fontSize: 12,
          color: "#444",
          lineHeight: 1.6,
        }}
      >
        {c.verdict}
        {c.why && (
          <div style={{ fontSize: 11, color: "#666", marginTop: 6, lineHeight: 1.7 }}>{c.why}</div>
        )}
      </div>

      {/* 레이더 차트 */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>
        📡 6-Layer 신호 (GUIDE 6축 점수)
      </h3>
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "4px 0",
          border: "1px solid #E5E7EB",
          marginBottom: 12,
        }}
      >
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#666", fontSize: 10 }} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "#CCC", fontSize: 9 }}
              axisLine={false}
            />
            <Radar
              dataKey="value"
              stroke="#6366F1"
              fill="#6366F1"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 6 레이어 상세 + 실시간 데이터 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
        {LAYER_KEYS.map((k, i) => {
          const s = sig(c[k]);
          return (
            <div
              key={k}
              style={{
                padding: "9px 12px",
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 12 }}>{s.l}</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: s.c }}>{c[k]}</span>
                <span style={{ fontSize: 10, color: LAYER_COLORS[i], fontWeight: 700 }}>
                  L{i + 1}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#444" }}>
                  {LAYER_NAMES[i]}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.6 }}>{c.layers[k]}</div>
              {/* 실시간 데이터 보강 */}
              {i === 0 && yt && (
                <LayerLiveData
                  items={[
                    { label: "US 쇼츠", value: fmtNum(yt.US?.videoCount) },
                    { label: "KR 쇼츠", value: fmtNum(yt.KR?.videoCount) },
                    { label: "US/KR 비율", value: yt.ratio + "x", highlight: yt.isBlueOcean },
                  ]}
                />
              )}
              {i === 1 && nv && (
                <LayerLiveData
                  items={[
                    { label: "12M 평균", value: nv.avgRatio ?? "—" },
                    { label: "피크", value: nv.peakRatio ?? "—" },
                    {
                      label: "MoM",
                      value:
                        nv.mom?.deltaPct != null
                          ? (nv.mom.deltaPct > 0 ? "+" : "") + nv.mom.deltaPct + "%"
                          : "—",
                      highlight: nv.isRising || nv.isFalling,
                    },
                  ]}
                />
              )}
              {i === 1 && ns && (
                <LayerLiveData
                  items={
                    ns.hasCid
                      ? [
                          { label: "쇼핑 cid", value: ns.naverCid },
                          { label: "쇼핑 12M 평균", value: ns.avgRatio ?? "—" },
                        ]
                      : [
                          {
                            label: "쇼핑 카테고리",
                            value: "미형성 🌊",
                            highlight: true,
                          },
                        ]
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 검증 결론 + 다음 화면 */}
      <div
        style={{
          padding: "14px 16px",
          background: "linear-gradient(135deg,#ECFDF5,#F0FDF4)",
          border: "1px solid #A7F3D0",
          borderRadius: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 6 }}>
          ✅ 검증 결론
        </div>
        <div style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.7 }}>
          {ai?.verdict
            ? ai.verdict.reasoning
            : "AI 분석을 먼저 실행하면 이 자리에 검증 결론이 자동 생성됩니다."}
        </div>
        {ai?.verdict?.nextAction && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 10px",
              background: "#fff",
              border: "1px solid #A7F3D0",
              borderRadius: 6,
              fontSize: 11,
              color: "#065F46",
            }}
          >
            <b>다음 액션 ▸</b> {ai.verdict.nextAction}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onNext}
          style={{
            padding: "11px 24px",
            background: "linear-gradient(135deg,#4F46E5,#6366F1)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          심사 단계로 →
        </button>
      </div>

      <p style={{ fontSize: 10, color: "#AAA", marginTop: 10, lineHeight: 1.6 }}>
        Phase 2 예정: 트렌드 지속성 분석, 한국 문화 적합성, 구조적 순풍 분석, 채택 속도 예측이 이
        화면에 추가됩니다.
      </p>
    </div>
  );
}

function LayerLiveData({ items }) {
  return (
    <div
      style={{
        marginTop: 6,
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        paddingTop: 6,
        borderTop: "1px dashed #F3F4F6",
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            fontSize: 10,
            color: it.highlight ? "#fff" : "#444",
            background: it.highlight ? "#3B82F6" : "#F9FAFB",
            border: it.highlight ? "1px solid #3B82F6" : "1px solid #E5E7EB",
            padding: "2px 7px",
            borderRadius: 99,
            fontWeight: it.highlight ? 700 : 500,
          }}
        >
          <span style={{ opacity: 0.7 }}>{it.label}</span>{" "}
          <b>{it.value}</b>
        </div>
      ))}
    </div>
  );
}
