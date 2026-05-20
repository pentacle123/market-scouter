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
import { loadClaudeAnalysisMap, getClaudeAnalysisForId } from "@/lib/ai-cache";

function aiScoreColor(score) {
  if (score == null) return "#9CA3AF";
  if (score >= 80) return "#059669";
  if (score >= 60) return "#2563EB";
  if (score >= 40) return "#D97706";
  return "#DC2626";
}

export default function Detail({ cat, onBack }) {
  const [aiEntry, setAiEntry] = useState(null);

  useEffect(() => {
    if (!cat) return;
    const map = loadClaudeAnalysisMap();
    setAiEntry(getClaudeAnalysisForId(map, cat.id));
  }, [cat?.id]);

  if (!cat) return <p style={{ color: "#AAA", textAlign: "center", padding: 40 }}>매트릭스에서 선택하세요</p>;
  const c = cat;
  const total = calcT(c);
  const radarData = LAYER_KEYS.map(function (k, i) {
    return { subject: LAYER_NAMES[i], value: c[k], fullMark: 100 };
  });
  const ai = aiEntry?.analysis || null;
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6366F1", fontSize: 11, cursor: "pointer", padding: 0, marginBottom: 10 }}>← 매트릭스로</button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 28 }}>{c.e}</span>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>{c.n}</h2>
            <span style={{ fontSize: 10, fontWeight: 700, color: TC[c.type], background: TB[c.type], padding: "2px 8px", borderRadius: 99, border: "1px solid " + TBR[c.type] }}>{TL[c.type]}</span>
          </div>
          <p style={{ fontSize: 11, color: "#999", margin: "2px 0 0" }}>{c.mk} · {c.lc} · 종합 {total}</p>
        </div>
      </div>
      <div style={{ padding: "10px 14px", margin: "8px 0 6px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8 }}>
        <div style={{ fontSize: 12, color: "#4338CA", fontWeight: 600 }}>{c.verdict}</div>
      </div>
      {c.why && (
        <div style={{ padding: "10px 14px", marginBottom: 14, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8 }}>
          <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.7 }}>{c.why}</div>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 10, padding: "4px 0", border: "1px solid #E5E7EB", marginBottom: 14 }}>
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#666", fontSize: 10 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#CCC", fontSize: 9 }} axisLine={false} />
            <Radar dataKey="value" stroke="#6366F1" fill="#6366F1" fillOpacity={0.15} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>📡 6개 레이어 신호</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
        {LAYER_KEYS.map(function (k, i) {
          const s = sig(c[k]);
          return (
            <div key={k} style={{ padding: "9px 12px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 12 }}>{s.l}</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: s.c }}>{c[k]}</span>
                <span style={{ fontSize: 10, color: LAYER_COLORS[i], fontWeight: 700 }}>L{i + 1}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#444" }}>{LAYER_NAMES[i]}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.6 }}>{c.layers[k]}</div>
            </div>
          );
        })}
      </div>
      {c.pains.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>🔧 소비자 불만 → 제품 개발</h3>
          {c.pains.map(function (p, i) {
            return (
              <div key={i} style={{ padding: "10px 12px", marginBottom: 4, background: i === 0 ? "#EEF2FF" : "#fff", border: i === 0 ? "1px solid #C7D2FE" : "1px solid #E5E7EB", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <span style={{ background: p.s >= 85 ? "#EF4444" : "#F59E0B", borderRadius: 99, padding: "1px 7px", fontSize: 10, color: "#fff", fontWeight: 700 }}>{p.s}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#222" }}>{p.i}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "#6366F1", marginBottom: 2 }}>🔍 {p.ev}</div>
                <div style={{ fontSize: 10.5, color: "#059669", marginBottom: 2 }}>💡 {p.dv}</div>
                {p.sp && <div style={{ fontSize: 10.5, color: "#2563EB" }}>📋 {p.sp}</div>}
              </div>
            );
          })}
        </div>
      )}
      {c.rev.cost !== "-" && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>💰 수익 · ⏱️ 속도 · ⚠️ 리스크</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
            {[["제조원가", c.rev.cost], ["판매가", c.rev.price], ["마진율", c.rev.margin], ["BEP", c.rev.bep]].map(function (r) {
              return (
                <div key={r[0]} style={{ padding: "7px 10px", background: "#fff", borderRadius: 6, border: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: 9, color: "#AAA" }}>{r[0]}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>{r[1]}</div>
                </div>
              );
            })}
          </div>
          {c.rev.note !== "-" && <div style={{ fontSize: 10.5, color: "#D97706", marginBottom: 8 }}>📌 {c.rev.note}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div style={{ padding: "9px 12px", background: "#ECFDF5", borderRadius: 8, border: "1px solid #A7F3D0" }}>
              <div style={{ fontSize: 10, color: "#059669", fontWeight: 600, marginBottom: 2 }}>⏱️ 진입 속도</div>
              <div style={{ fontSize: 11, color: "#333" }}>{c.ttm}</div>
            </div>
            <div style={{ padding: "9px 12px", background: "#FEF2F2", borderRadius: 8, border: "1px solid #FECACA" }}>
              <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 600, marginBottom: 2 }}>⚠️ 리스크</div>
              {c.risks.map(function (r, i) {
                return <div key={i} style={{ fontSize: 10, color: "#555" }}>· {r}</div>;
              })}
            </div>
          </div>
        </div>
      )}
      {c.partners.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>🤝 파트너 맵</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {c.partners.map(function (p, i) {
              return <span key={i} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, background: "#EEF2FF", color: "#4338CA", border: "1px solid #C7D2FE" }}>{p}</span>;
            })}
          </div>
        </div>
      )}
      {c.expand.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>🗺️ 인접 확장</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {c.expand.map(function (ex, i) {
              const last = ex.startsWith("→");
              return <span key={i} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, background: last ? "#ECFDF5" : "#F9FAFB", color: last ? "#059669" : "#666", border: last ? "1px solid #A7F3D0" : "1px solid #E5E7EB", fontWeight: last ? 700 : 400 }}>{ex}</span>;
            })}
          </div>
        </div>
      )}

      {/* ── 🤖 AI 분석 섹션 ───────────────────────────────────────────────── */}
      <AIAnalysisSection ai={ai} parseError={aiEntry?.parseError} />
    </div>
  );
}

function AIAnalysisSection({ ai, parseError }) {
  if (!ai && !parseError) {
    return (
      <div
        style={{
          marginTop: 20,
          padding: "14px 16px",
          background: "linear-gradient(135deg,#FAF5FF,#EEF2FF)",
          border: "1px dashed #C7D2FE",
          borderRadius: 10,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#4338CA", marginBottom: 4 }}>
          🤖 AI 분석 미실행
        </div>
        <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.6 }}>
          매트릭스 뷰 상단의 <b>🤖 AI 분석 엔진</b> 패널에서 "전체 분석 시작" 또는
          "미분석만 분석"을 실행하면 이 자리에 경쟁 구조 · 소비자 불만 · 숏폼 전략 ·
          종합 판단 4섹션이 표시됩니다.
        </div>
      </div>
    );
  }

  if (parseError) {
    return (
      <div
        style={{
          marginTop: 20,
          padding: "12px 14px",
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#B91C1C", marginBottom: 3 }}>
          AI 응답 파싱 실패
        </div>
        <div style={{ fontSize: 11, color: "#7F1D1D", lineHeight: 1.6 }}>
          {parseError}. 매트릭스 뷰에서 해당 카테고리 재분석을 시도해주세요.
        </div>
      </div>
    );
  }

  const { competition, pains, viral, verdict } = ai;

  return (
    <div style={{ marginTop: 20 }}>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "#4338CA",
          margin: "0 0 8px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        🤖 AI 분석
        <span
          style={{
            fontSize: 9,
            color: "#6B7280",
            background: "#F3F4F6",
            border: "1px solid #E5E7EB",
            borderRadius: 4,
            padding: "1px 5px",
            fontWeight: 500,
          }}
        >
          Claude Sonnet 4
        </span>
      </h3>

      {/* 종합 판단 카드 (최상단) */}
      {verdict && (
        <div
          style={{
            padding: "12px 14px",
            marginBottom: 10,
            background: "linear-gradient(135deg,#FAF5FF,#EEF2FF)",
            border: "1px solid #C7D2FE",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: aiScoreColor(verdict.score),
                lineHeight: 1,
              }}
            >
              {verdict.score ?? "—"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#6B7280", marginBottom: 1 }}>
                🎯 종합 진입 점수
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1F2937", lineHeight: 1.4 }}>
                {verdict.oneLine || ""}
              </div>
            </div>
          </div>
          {verdict.reasoning && (
            <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.7, marginBottom: 6 }}>
              {verdict.reasoning}
            </div>
          )}
          {verdict.nextAction && (
            <div
              style={{
                fontSize: 11,
                color: "#1F2937",
                background: "#fff",
                border: "1px solid #C7D2FE",
                borderRadius: 6,
                padding: "6px 10px",
              }}
            >
              <b style={{ color: "#4338CA" }}>다음 액션 ▸</b> {verdict.nextAction}
            </div>
          )}
        </div>
      )}

      {/* 경쟁 구조 */}
      {competition && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 6,
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 12 }}>🛡️</span>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#222", flex: 1 }}>
              경쟁 구조 (Layer 3 보강)
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#fff",
                background: aiScoreColor(100 - (competition.score ?? 50)), // 낮을수록 좋음 (역색)
                borderRadius: 99,
                padding: "2px 8px",
              }}
              title="경쟁 강도. 100=레드오션"
            >
              경쟁 강도 {competition.score ?? "—"}
            </span>
          </div>
          <FieldRow label="주요 플레이어" value={competition.players} />
          <FieldRow label="가격대 분포" value={competition.priceRange} />
          <FieldRow label="진입 장벽" value={competition.entryBarrier} />
        </div>
      )}

      {/* 소비자 불만 */}
      {Array.isArray(pains) && pains.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#222",
              margin: "6px 0 4px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            😤 소비자 불만 (Layer 4 자동화) <span style={{ color: "#999", fontWeight: 500 }}>{pains.length}건</span>
          </div>
          {pains.map((p, i) => (
            <div
              key={i}
              style={{
                padding: "9px 11px",
                marginBottom: 4,
                background: i === 0 ? "#EEF2FF" : "#fff",
                border: i === 0 ? "1px solid #C7D2FE" : "1px solid #E5E7EB",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <span
                  style={{
                    background: p.severity >= 85 ? "#EF4444" : p.severity >= 60 ? "#F59E0B" : "#9CA3AF",
                    borderRadius: 99,
                    padding: "1px 7px",
                    fontSize: 10,
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  {p.severity ?? "—"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#222" }}>{p.issue}</span>
              </div>
              {p.devDirection && (
                <div style={{ fontSize: 10.5, color: "#059669", marginBottom: 2 }}>
                  💡 {p.devDirection}
                </div>
              )}
              {p.spec && (
                <div style={{ fontSize: 10.5, color: "#2563EB" }}>📋 {p.spec}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 숏폼 바이럴 */}
      {viral && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 6,
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 12 }}>🎬</span>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#222", flex: 1 }}>
              숏폼 바이럴 전략 (Layer 5 보강)
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#fff",
                background: aiScoreColor(viral.score),
                borderRadius: 99,
                padding: "2px 8px",
              }}
              title="숏폼 발견 커머스 적합도. 100=최적"
            >
              적합도 {viral.score ?? "—"}
            </span>
          </div>
          <FieldRow label="3초 데모" value={viral.demoFeasibility} />
          <FieldRow label="크리에이터 적합" value={viral.creatorFit} />
          <FieldRow label="적정 가격대" value={viral.priceSweet} />
          {Array.isArray(viral.concepts) && viral.concepts.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, marginBottom: 3 }}>
                추천 숏폼 컨셉
              </div>
              {viral.concepts.map((cn, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    color: "#374151",
                    background: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    borderRadius: 6,
                    padding: "5px 8px",
                    marginBottom: 3,
                    lineHeight: 1.5,
                  }}
                >
                  <b style={{ color: "#7C3AED" }}>#{i + 1}.</b> {cn}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: 10.5, color: "#444", lineHeight: 1.7, marginBottom: 2 }}>
      <span style={{ color: "#6B7280", fontWeight: 600 }}>{label} </span>
      {value}
    </div>
  );
}
