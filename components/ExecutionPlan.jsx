"use client";

import { useEffect, useState } from "react";
import { TL, TC, TB, TBR } from "@/lib/data";
import { loadClaudeAnalysisMap, getClaudeAnalysisForId } from "@/lib/ai-cache";

export default function ExecutionPlan({ cat, onBack }) {
  const [ai, setAi] = useState(null);
  useEffect(() => {
    if (!cat) return;
    setAi(getClaudeAnalysisForId(loadClaudeAnalysisMap(), cat.id)?.analysis || null);
  }, [cat?.id]);

  if (!cat) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#AAA" }}>
        먼저 화면 1에서 카테고리를 선택하세요
      </div>
    );
  }

  const c = cat;
  // GUIDE expand 의 마지막 "→ 브랜드 비전" 항목 분리
  const expand = c.expand || [];
  const visionItem = expand.find((x) => x.startsWith("→")) || null;
  const adjacents = expand.filter((x) => !x.startsWith("→"));

  // 진입 방식 추천: Claude verdict.nextAction + 기본 크리에이터 어필리에이트
  const recommendedEntry = ai?.verdict?.nextAction || "크리에이터 어필리에이트";

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        화면 4 · 실행 계획
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        GO 결정 후 구체적 액션플랜. 타임라인 · 예산 · 인접 확장 비전
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
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>{c.n}</h3>
          <p style={{ fontSize: 11, color: "#999", margin: "2px 0 0" }}>
            {c.mk} · {c.lc} ·{" "}
            <span style={{ color: TC[c.type], fontWeight: 700 }}>{TL[c.type]}</span>
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
          ← 심사로
        </button>
      </div>

      {/* 다음 액션 (Claude verdict.nextAction) */}
      <div
        style={{
          padding: "12px 14px",
          marginBottom: 14,
          background: "linear-gradient(135deg,#ECFDF5,#F0FDF4)",
          border: "1px solid #A7F3D0",
          borderRadius: 10,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", marginBottom: 4 }}>
          🎯 다음 첫 액션
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#065F46", lineHeight: 1.5 }}>
          {recommendedEntry}
        </div>
      </div>

      {/* 진입 단계 로드맵 (Pentacle 모델 — GUIDE 사업 컨텍스트) */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>
        🪜 사업 진입 단계 (Pentacle 모델)
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 4,
          marginBottom: 14,
        }}
      >
        <Step
          n={1}
          l="크리에이터 어필리에이트"
          desc="재고 리스크 0, 마케팅비만"
          accent="#3B82F6"
          current
        />
        <Step n={2} l="RS / CPS" desc="매출배분으로 신뢰 구축" accent="#8B5CF6" />
        <Step n={3} l="독점 파트너십" desc="조건 협상력 확보" accent="#EC4899" />
        <Step n={4} l="투자 / PB" desc="지분 투자 또는 자체브랜드" accent="#10B981" />
      </div>

      {/* TTM */}
      {c.ttm && c.ttm !== "-" && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 14,
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>⏱️</span>
          <div>
            <div style={{ fontSize: 10, color: "#888" }}>진입 속도 (Time to Market)</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{c.ttm}</div>
          </div>
        </div>
      )}

      {/* 인접 확장 비전 */}
      {expand.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>
            🗺️ 인접 확장 비전 (Year 1 → 2 → 3)
          </h3>
          <div style={{ marginBottom: 14 }}>
            {adjacents.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {adjacents.map((ex, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      background: "#F9FAFB",
                      color: "#444",
                      border: "1px solid #E5E7EB",
                    }}
                  >
                    {ex}
                  </span>
                ))}
              </div>
            )}
            {visionItem && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "linear-gradient(135deg,#ECFDF5,#F0FDF4)",
                  border: "1px solid #A7F3D0",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#059669",
                }}
              >
                {visionItem}
              </div>
            )}
          </div>
        </>
      )}

      {/* 데이터 플라이휠 (Claude C-8 placeholder) */}
      <div
        style={{
          padding: "12px 14px",
          marginBottom: 14,
          background: "#FFFBEB",
          border: "1px dashed #FDE68A",
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
          🔄 데이터 플라이휠 (구상)
        </div>
        <div style={{ fontSize: 11, color: "#78350F", lineHeight: 1.6 }}>
          이 카테고리에서 쌓이는 크리에이터 성과 · 소비자 행동 · 소싱 노하우 · 채널 데이터는 다음
          카테고리 선정에 그대로 재활용됩니다. 첫 카테고리가 브랜드 DNA를 결정하므로 인접
          확장성이 넓을수록 누적 효과가 큽니다.
        </div>
      </div>

      <p style={{ fontSize: 10, color: "#AAA", marginTop: 10, lineHeight: 1.6 }}>
        Phase 4 예정: 월별 타임라인(GANTT), 예산 상세, 성공 기준 KPI(몇 개월 후 어떤 숫자), Year
        1→2→3 비전이 이 화면에 추가됩니다.
      </p>
    </div>
  );
}

function Step({ n, l, desc, accent, current }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: current ? "#fff" : "#F9FAFB",
        border: `1px solid ${current ? accent : "#E5E7EB"}`,
        borderRadius: 8,
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: accent,
          marginBottom: 2,
        }}
      >
        STEP {n}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#222", lineHeight: 1.3 }}>{l}</div>
      <div style={{ fontSize: 9, color: "#888", marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
      {current && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            fontSize: 9,
            fontWeight: 700,
            color: accent,
          }}
        >
          ●
        </span>
      )}
    </div>
  );
}
