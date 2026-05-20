"use client";

import { useEffect, useState } from "react";
import { TL, TC, TB, TBR } from "@/lib/data";
import { loadClaudeAnalysisMap, getClaudeAnalysisForId } from "@/lib/ai-cache";

function aiScoreColor(score) {
  if (score == null) return "#9CA3AF";
  if (score >= 80) return "#059669";
  if (score >= 60) return "#2563EB";
  if (score >= 40) return "#D97706";
  return "#DC2626";
}

// 단순화된 v1 GO/NO-GO 12체크 (Phase 3에서 진짜 12체크로 확장). 현재는 verdict.score 기반 자동 분류.
function buildChecklist(c, ai) {
  if (!ai) return null;
  const v = ai.verdict?.score ?? 0;
  const comp = ai.competition?.score ?? 50;
  const viral = ai.viral?.score ?? 50;
  const pains = (ai.pains || []).length;
  const high = (s) => (s >= 70 ? "✅" : s >= 40 ? "⚠️" : "❌");
  const lowComp = (s) => (s <= 30 ? "✅" : s <= 60 ? "⚠️" : "❌");
  return [
    { key: "시장 매력도", icon: high(v) },
    { key: "경쟁 진입 가능", icon: lowComp(comp) },
    { key: "제품 차별화 (불만→스펙)", icon: pains >= 2 ? "✅" : pains >= 1 ? "⚠️" : "❌" },
    { key: "우리 역량 적합 (숏폼/크리에이터)", icon: high(viral) },
    { key: "수익성 (Unit Economics)", icon: c.rev?.cost && c.rev.cost !== "-" ? "⚠️" : "❌", note: "Phase 3 확장 예정" },
    { key: "킬 리스크 없음", icon: (c.risks || []).length <= 1 ? "✅" : "⚠️" },
    { key: "파트너 확보", icon: (c.partners || []).length >= 2 ? "✅" : "⚠️" },
    { key: "타이밍 적합 (Why Now)", icon: high(v) },
  ];
}

function decideGoLevel(score) {
  if (score == null) return { level: "—", color: "#9CA3AF", bg: "#F9FAFB", border: "#E5E7EB" };
  if (score >= 80) return { level: "GO", color: "#fff", bg: "#10B981", border: "#10B981" };
  if (score >= 60) return { level: "CONDITIONAL GO", color: "#fff", bg: "#F59E0B", border: "#F59E0B" };
  return { level: "NO-GO", color: "#fff", bg: "#EF4444", border: "#EF4444" };
}

export default function BusinessReview({ cat, onNext, onBack }) {
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
  const checklist = buildChecklist(c, ai);
  const verdictScore = ai?.verdict?.score ?? null;
  const gate = decideGoLevel(verdictScore);
  const okCount = checklist ? checklist.filter((x) => x.icon === "✅").length : 0;
  const warnCount = checklist ? checklist.filter((x) => x.icon === "⚠️").length : 0;
  const noCount = checklist ? checklist.filter((x) => x.icon === "❌").length : 0;
  const confidence = checklist ? Math.round((okCount + warnCount * 0.5) / checklist.length * 100) : null;

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        화면 3 · 사업 심사
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        GO/NO-GO 결정에 필요한 모든 것. CEO 보고서 역할도 겸합니다
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
          ← 검증으로
        </button>
      </div>

      {/* GO/NO-GO 결정 카드 (최상단) */}
      <div
        style={{
          padding: "14px 16px",
          marginBottom: 14,
          background: "#fff",
          border: `2px solid ${gate.border}`,
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: gate.color,
              background: gate.bg,
              padding: "8px 16px",
              borderRadius: 8,
              letterSpacing: "0.05em",
            }}
          >
            {gate.level}
          </div>
          {verdictScore != null && (
            <div>
              <div style={{ fontSize: 10, color: "#888" }}>Claude 종합 점수</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: aiScoreColor(verdictScore),
                  lineHeight: 1,
                }}
              >
                {verdictScore}
              </div>
            </div>
          )}
          {confidence != null && (
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#888" }}>확신도</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#4338CA", lineHeight: 1 }}>
                {confidence}%
              </div>
            </div>
          )}
        </div>
        {ai?.verdict?.oneLine && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#222", marginBottom: 4 }}>
            {ai.verdict.oneLine}
          </div>
        )}
        {ai?.verdict?.nextAction && (
          <div
            style={{
              fontSize: 11,
              color: "#374151",
              background: "#F9FAFB",
              border: "1px solid #E5E7EB",
              borderRadius: 6,
              padding: "6px 10px",
              marginTop: 4,
            }}
          >
            <b style={{ color: "#4338CA" }}>다음 액션 ▸</b> {ai.verdict.nextAction}
          </div>
        )}
      </div>

      {/* GO/NO-GO 체크리스트 */}
      {checklist && (
        <Section title="✅ GO/NO-GO 체크리스트">
          <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>
            ✅ {okCount}건 · ⚠️ {warnCount}건 · ❌ {noCount}건 (Phase 3 에서 12체크 풀버전으로 확장)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {checklist.map((row, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  padding: "6px 10px",
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 13 }}>{row.icon}</span>
                <span style={{ color: "#444", flex: 1 }}>{row.key}</span>
                {row.note && (
                  <span style={{ fontSize: 9, color: "#AAA" }}>{row.note}</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 제품 인텔리전스 — 소비자 불만 → 스펙 */}
      <Section title="🔧 제품 인텔리전스 (소비자 불만 → 스펙)">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* GUIDE 하드코딩 pains */}
          {(c.pains || []).map((p, i) => (
            <div
              key={"gp" + i}
              style={{
                padding: "9px 11px",
                background: i === 0 ? "#EEF2FF" : "#fff",
                border: i === 0 ? "1px solid #C7D2FE" : "1px solid #E5E7EB",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 4 }}>
                <span
                  style={{
                    background: p.s >= 85 ? "#EF4444" : "#F59E0B",
                    borderRadius: 99,
                    padding: "1px 7px",
                    fontSize: 10,
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  {p.s}
                </span>
                <span style={{ fontSize: 11, color: "#888" }}>GUIDE</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#222" }}>{p.i}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "#6366F1", marginBottom: 2 }}>🔍 {p.ev}</div>
              <div style={{ fontSize: 10.5, color: "#059669", marginBottom: 2 }}>💡 {p.dv}</div>
              {p.sp && <div style={{ fontSize: 10.5, color: "#2563EB" }}>📋 {p.sp}</div>}
            </div>
          ))}
          {/* Claude pains */}
          {(ai?.pains || []).map((p, i) => (
            <div
              key={"ai" + i}
              style={{
                padding: "9px 11px",
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 4 }}>
                <span
                  style={{
                    background: p.severity >= 85 ? "#EF4444" : "#F59E0B",
                    borderRadius: 99,
                    padding: "1px 7px",
                    fontSize: 10,
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  {p.severity}
                </span>
                <span style={{ fontSize: 11, color: "#7C3AED" }}>🤖 AI</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#222" }}>{p.issue}</span>
              </div>
              {p.devDirection && (
                <div style={{ fontSize: 10.5, color: "#059669", marginBottom: 2 }}>
                  💡 {p.devDirection}
                </div>
              )}
              {p.spec && <div style={{ fontSize: 10.5, color: "#2563EB" }}>📋 {p.spec}</div>}
            </div>
          ))}
          {!(c.pains || []).length && !(ai?.pains || []).length && (
            <div style={{ fontSize: 11, color: "#AAA" }}>등록된 소비자 불만 데이터 없음</div>
          )}
        </div>
      </Section>

      {/* 파트너 & 협업 */}
      <Section title="🤝 파트너 & 협업">
        {(c.partners || []).length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {c.partners.map((p, i) => (
              <span
                key={i}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  background: "#EEF2FF",
                  color: "#4338CA",
                  border: "1px solid #C7D2FE",
                }}
              >
                {p}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#AAA" }}>등록된 파트너 없음</div>
        )}
      </Section>

      {/* 마케팅 전략 (Claude viral) */}
      {ai?.viral && (
        <Section title="🎬 마케팅 전략 (Claude)">
          <div
            style={{
              padding: "10px 12px",
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              marginBottom: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#fff",
                  background: aiScoreColor(ai.viral.score),
                  borderRadius: 99,
                  padding: "2px 9px",
                }}
              >
                숏폼 적합도 {ai.viral.score}
              </span>
              <span style={{ fontSize: 11, color: "#666" }}>{ai.viral.priceSweet}</span>
            </div>
            <Row label="3초 데모" value={ai.viral.demoFeasibility} />
            <Row label="크리에이터 적합" value={ai.viral.creatorFit} />
            {Array.isArray(ai.viral.concepts) && ai.viral.concepts.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, marginBottom: 3 }}>
                  추천 숏폼 컨셉
                </div>
                {ai.viral.concepts.map((cn, i) => (
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
        </Section>
      )}

      {/* 경쟁 구조 (Claude) */}
      {ai?.competition && (
        <Section title="🛡️ 경쟁 구조 (Claude)">
          <div
            style={{
              padding: "10px 12px",
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#fff",
                  background: aiScoreColor(100 - (ai.competition.score ?? 50)),
                  borderRadius: 99,
                  padding: "2px 9px",
                }}
                title="경쟁 강도. 낮을수록 진입 유리"
              >
                경쟁 강도 {ai.competition.score}
              </span>
            </div>
            <Row label="플레이어" value={ai.competition.players} />
            <Row label="가격대" value={ai.competition.priceRange} />
            <Row label="진입 장벽" value={ai.competition.entryBarrier} />
          </div>
        </Section>
      )}

      {/* 수익성 (GUIDE 하드코딩 rev) */}
      {c.rev && c.rev.cost && c.rev.cost !== "-" && (
        <Section title="💰 수익성 (개략) — Phase 3 에서 Unit Economics 풀버전">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
            {[
              ["제조원가", c.rev.cost],
              ["판매가", c.rev.price],
              ["마진율", c.rev.margin],
              ["BEP", c.rev.bep],
            ].map((r) => (
              <div
                key={r[0]}
                style={{
                  padding: "7px 10px",
                  background: "#fff",
                  borderRadius: 6,
                  border: "1px solid #E5E7EB",
                }}
              >
                <div style={{ fontSize: 9, color: "#AAA" }}>{r[0]}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>{r[1]}</div>
              </div>
            ))}
          </div>
          {c.rev.note && c.rev.note !== "-" && (
            <div style={{ fontSize: 10.5, color: "#D97706" }}>📌 {c.rev.note}</div>
          )}
        </Section>
      )}

      {/* 리스크 */}
      {c.risks && c.risks.length > 0 && (
        <Section title="⚠️ 리스크">
          <div
            style={{
              padding: "9px 12px",
              background: "#FEF2F2",
              borderRadius: 8,
              border: "1px solid #FECACA",
            }}
          >
            {c.risks.map((r, i) => (
              <div key={i} style={{ fontSize: 11, color: "#555", lineHeight: 1.7 }}>
                · {r}
              </div>
            ))}
          </div>
        </Section>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button
          onClick={onNext}
          style={{
            padding: "11px 24px",
            background: "linear-gradient(135deg,#10B981,#059669)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          실행 계획 보기 →
        </button>
      </div>

      <p style={{ fontSize: 10, color: "#AAA", marginTop: 10, lineHeight: 1.6 }}>
        Phase 3 예정: 12체크 풀 GO/NO-GO, Unit Economics, 현금흐름 시뮬레이션, Bull/Base/Bear
        시나리오, 킬 리스크/Exit 기준이 이 화면에 추가됩니다.
      </p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: 10.5, color: "#444", lineHeight: 1.7, marginBottom: 2 }}>
      <span style={{ color: "#6B7280", fontWeight: 600 }}>{label} </span>
      {value}
    </div>
  );
}
