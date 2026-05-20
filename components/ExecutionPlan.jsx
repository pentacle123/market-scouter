"use client";

import { useEffect, useMemo, useState } from "react";
import { TL, TC, TB, TBR } from "@/lib/data";
import {
  loadClaudeAnalysisMap,
  getClaudeAnalysisForId,
  getBusinessInputForId,
  loadBusinessInputMap,
} from "@/lib/ai-cache";
import {
  calcUnitEconomics,
  simulateCashflow,
  deriveSeedUnitEconomics,
  formatKRW,
  formatKRWFull,
  recommendEntryMode,
} from "@/lib/business";
import {
  buildTimeline,
  buildBudgetBreakdown,
  buildSuccessKPIs,
  buildExpansionVision,
  buildDataFlywheel,
} from "@/lib/execution";

export default function ExecutionPlan({ cat, onBack }) {
  const [ai, setAi] = useState(null);
  const [ue, setUe] = useState(null);
  const [exit, setExit] = useState({
    initialBudget: 5_000_000,
    exitMonths: 6,
    exitMinUnits: 100,
    maxLoss: 5_000_000,
  });

  useEffect(() => {
    if (!cat) return;
    setAi(getClaudeAnalysisForId(loadClaudeAnalysisMap(), cat.id)?.analysis || null);
    const map = loadBusinessInputMap();
    const saved = getBusinessInputForId(map, cat.id);
    if (saved) {
      setUe(saved.unitEcon);
      if (saved.exit) setExit(saved.exit);
    } else {
      setUe(deriveSeedUnitEconomics(cat));
    }
  }, [cat?.id]);

  const economics = useMemo(() => (ue ? calcUnitEconomics(ue) : null), [ue]);
  const cashflow = useMemo(() => {
    if (!economics) return null;
    return simulateCashflow({ initialBudget: exit.initialBudget, ue: economics, months: 12 });
  }, [economics, exit.initialBudget]);

  const timeline = useMemo(
    () => (cat && economics && cashflow ? buildTimeline({ cat, ue: economics, cashflow, exit, ai }) : []),
    [cat, economics, cashflow, exit, ai]
  );
  const budget = useMemo(
    () => (economics && cashflow ? buildBudgetBreakdown({ ue: economics, cashflow, exit }) : null),
    [economics, cashflow, exit]
  );
  const kpis = useMemo(
    () => (economics && cashflow ? buildSuccessKPIs({ ue: economics, cashflow, exit }) : []),
    [economics, cashflow, exit]
  );
  const vision = useMemo(() => (cat ? buildExpansionVision(cat) : null), [cat]);
  const flywheel = useMemo(() => buildDataFlywheel(cat), [cat]);
  const entry = useMemo(() => recommendEntryMode(ai, economics), [ai, economics]);

  if (!cat) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#AAA" }}>
        먼저 화면 1에서 카테고리를 선택하세요
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        화면 4 · 실행 계획
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        타임라인 · 예산 분해 · 성공 KPI · Year 1→2→3 비전
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
        <span style={{ fontSize: 32 }}>{cat.e}</span>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>{cat.n}</h3>
          <p style={{ fontSize: 11, color: "#999", margin: "2px 0 0" }}>
            {cat.mk} · {cat.lc} ·{" "}
            <span style={{ color: TC[cat.type], fontWeight: 700 }}>{TL[cat.type]}</span>
          </p>
        </div>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", color: "#6366F1", fontSize: 11, cursor: "pointer", padding: 0 }}
        >
          ← 심사로
        </button>
      </div>

      {/* 다음 첫 액션 + 추천 진입 방식 */}
      <div
        style={{
          padding: "12px 14px",
          marginBottom: 14,
          background: "linear-gradient(135deg,#ECFDF5,#F0FDF4)",
          border: "1px solid #A7F3D0",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#059669" }}>🎯 다음 첫 액션</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              background: "#059669",
              padding: "2px 10px",
              borderRadius: 99,
            }}
          >
            {entry.mode}
          </span>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#065F46", lineHeight: 1.5 }}>
          {ai?.verdict?.nextAction || entry.desc}
        </div>
        {cat.ttm && cat.ttm !== "-" && (
          <div style={{ fontSize: 11, color: "#065F46", marginTop: 4 }}>
            <b>⏱️ 진입 속도(TTM):</b> {cat.ttm}
          </div>
        )}
      </div>

      {/* Pentacle 4단계 로드맵 */}
      <Section title="🪜 사업 진입 단계 (Pentacle 모델)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
          {[
            { n: 1, l: "크리에이터 어필리에이트", desc: "재고 0, 마케팅비만", accent: "#3B82F6" },
            { n: 2, l: "RS / CPS", desc: "매출배분 신뢰 구축", accent: "#8B5CF6" },
            { n: 3, l: "독점 파트너십", desc: "조건 협상력 확보", accent: "#EC4899" },
            { n: 4, l: "투자 / PB", desc: "지분 또는 자체 브랜드", accent: "#10B981" },
          ].map((s, i) => (
            <PentacleStep key={s.n} {...s} current={i === 0} />
          ))}
        </div>
      </Section>

      {/* 월별 타임라인 */}
      {timeline.length > 0 && (
        <Section title="🗓️ 월별 타임라인">
          <TimelineView milestones={timeline} />
        </Section>
      )}

      {/* 예산 분해 */}
      {budget && (
        <Section title="💼 예산 분해 (초기 투자금 사용처)">
          <BudgetView budget={budget} />
        </Section>
      )}

      {/* 성공 KPI */}
      {kpis.length > 0 && (
        <Section title="📊 성공 기준 KPI">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {kpis.map((k, i) => (
              <KpiCard key={i} kpi={k} />
            ))}
          </div>
        </Section>
      )}

      {/* Year 1→2→3 비전 */}
      {vision && (
        <Section title="🗺️ Year 1 → 2 → 3 확장 비전">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            <VisionCard data={vision.year1} />
            <VisionCard data={vision.year2} />
            <VisionCard data={vision.year3} />
          </div>
          {vision.adjacentsAll.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, marginBottom: 3 }}>
                인접 카테고리 후보
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {vision.adjacentsAll.map((a, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 6,
                      fontSize: 10.5,
                      background: "#F9FAFB",
                      color: "#444",
                      border: "1px solid #E5E7EB",
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* 데이터 플라이휠 */}
      <Section title="🔄 데이터 플라이휠 — 다음 카테고리로 누적">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {flywheel.map((f, i) => (
            <div
              key={i}
              style={{
                padding: "8px 10px",
                background: "#FFFBEB",
                border: "1px dashed #FDE68A",
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#92400E", marginBottom: 2 }}>
                {f.icon} {f.label}
              </div>
              <div style={{ fontSize: 10, color: "#78350F", lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <p style={{ fontSize: 10, color: "#AAA", marginTop: 10, lineHeight: 1.6 }}>
        ※ 타임라인·예산·KPI 는 화면 3 에서 입력한 Unit Economics 와 Exit 기준에서 자동 도출됩니다.
        값을 바꾸면 이 화면도 즉시 갱신됩니다.
      </p>
    </div>
  );
}

// ─── 타임라인 뷰 ──────────────────────────────────────────────────────────────

function TimelineView({ milestones }) {
  return (
    <div style={{ position: "relative", paddingLeft: 22 }}>
      {/* 세로 라인 */}
      <div
        style={{
          position: "absolute",
          left: 9,
          top: 8,
          bottom: 8,
          width: 2,
          background: "#E5E7EB",
        }}
      />
      {milestones.map((m, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            marginBottom: 8,
            paddingLeft: 8,
          }}
        >
          {/* 노드 */}
          <div
            style={{
              position: "absolute",
              left: -22,
              top: 4,
              width: 20,
              height: 20,
              borderRadius: 99,
              background: m.color,
              color: "#fff",
              fontSize: 9.5,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 3px #fff, 0 0 0 4px " + m.color + "33",
            }}
          >
            {m.month >= 0 ? "M" + m.month : "M" + m.month}
          </div>
          <div
            style={{
              padding: "8px 12px",
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderLeft: "3px solid " + m.color,
              borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: m.color,
                  background: m.color + "1A",
                  padding: "1px 7px",
                  borderRadius: 99,
                }}
              >
                {m.phase}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#222" }}>{m.label}</span>
              {m.cost > 0 && (
                <span style={{ fontSize: 10.5, color: "#059669", marginLeft: "auto", fontWeight: 700 }}>
                  {formatKRW(m.cost)}
                </span>
              )}
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {m.tasks.map((t, j) => (
                <li
                  key={j}
                  style={{
                    fontSize: 10.5,
                    color: "#555",
                    lineHeight: 1.5,
                    paddingLeft: 10,
                    position: "relative",
                  }}
                >
                  <span style={{ position: "absolute", left: 0, color: "#9CA3AF" }}>·</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 예산 뷰 ──────────────────────────────────────────────────────────────────

function BudgetView({ budget }) {
  // 자금 부족 시점 강조
  return (
    <div>
      {/* 합계 / 자금 부족 알림 */}
      <div
        style={{
          padding: "8px 12px",
          background: budget.isShort ? "#FEF2F2" : "#fff",
          border: budget.isShort ? "1px solid #FECACA" : "1px solid #E5E7EB",
          borderRadius: 8,
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: "#888" }}>초기 투자금</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>{formatKRW(budget.total)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#888" }}>고정 사용분</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#4338CA" }}>{formatKRW(budget.fixed)}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#888" }}>{budget.isShort ? "자금 부족분" : "예비비"}</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: budget.isShort ? "#DC2626" : "#059669",
            }}
          >
            {budget.isShort ? "🔴 " : ""}
            {formatKRW(budget.isShort ? budget.deficit : budget.reserve)}
          </div>
        </div>
      </div>

      {/* 가로 비율 막대 (예비비는 분리해서 표시) */}
      <div
        style={{
          display: "flex",
          height: 28,
          borderRadius: 6,
          overflow: "hidden",
          marginBottom: 8,
          border: "1px solid #E5E7EB",
        }}
      >
        {budget.items
          .filter((it) => it.amount > 0)
          .map((it) => (
            <div
              key={it.key}
              title={`${it.label} · ${formatKRWFull(it.amount)} · ${it.pct.toFixed(1)}%`}
              style={{
                width: it.pct + "%",
                background: it.color,
                minWidth: 8,
              }}
            />
          ))}
      </div>

      {/* 항목별 리스트 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {budget.items.map((it) => (
          <div
            key={it.key}
            style={{
              padding: "6px 9px",
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: it.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, color: "#444", flex: 1 }}>{it.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#222" }}>
              {formatKRW(it.amount)}
            </span>
            <span style={{ fontSize: 9.5, color: "#888", minWidth: 32, textAlign: "right" }}>
              {it.pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI 카드 ────────────────────────────────────────────────────────────────

function KpiCard({ kpi }) {
  return (
    <div
      style={{
        padding: "9px 12px",
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderLeft: "3px solid " + kpi.color,
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: kpi.color }}>{kpi.label}</span>
      </div>
      <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>{kpi.kpi}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#222" }}>
          {typeof kpi.target === "number" ? kpi.target.toLocaleString() : kpi.target}
        </span>
        <span style={{ fontSize: 11, color: "#666" }}>{kpi.unit}</span>
      </div>
      <div style={{ fontSize: 9.5, color: "#888", marginTop: 2, lineHeight: 1.4 }}>{kpi.desc}</div>
    </div>
  );
}

// ─── Vision 카드 ────────────────────────────────────────────────────────────

function VisionCard({ data }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background:
          data.kind === "current"
            ? "#EFF6FF"
            : data.kind === "vision"
              ? "#ECFDF5"
              : "#FAF5FF",
        border:
          data.kind === "current"
            ? "1px solid #BFDBFE"
            : data.kind === "vision"
              ? "1px solid #A7F3D0"
              : "1px solid #DDD6FE",
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 800, color: data.color, marginBottom: 3 }}>
        {data.label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#222", lineHeight: 1.3, marginBottom: 3 }}>
        {data.title}
      </div>
      <div style={{ fontSize: 10, color: "#555", lineHeight: 1.5 }}>{data.desc}</div>
    </div>
  );
}

// ─── 공통 ────────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>{title}</h3>
      {children}
    </div>
  );
}

function PentacleStep({ n, l, desc, accent, current }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: current ? "#fff" : "#F9FAFB",
        border: "1px solid " + (current ? accent : "#E5E7EB"),
        borderRadius: 8,
        position: "relative",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 800, color: accent, marginBottom: 2 }}>STEP {n}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#222", lineHeight: 1.3 }}>{l}</div>
      <div style={{ fontSize: 9, color: "#888", marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
      {current && (
        <span
          style={{ position: "absolute", top: 6, right: 8, fontSize: 9, fontWeight: 700, color: accent }}
        >
          ●
        </span>
      )}
    </div>
  );
}
