"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter as RCScatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { D, LAYER_KEYS, calcXY, calcT, sig, TL, TC, TB, TBR } from "@/lib/data";
import { loadClaudeAnalysisMap, getClaudeAnalysisForId } from "@/lib/ai-cache";
import DataUpdate from "./DataUpdate";

function aiScoreColor(score) {
  if (score == null) return "#9CA3AF";
  if (score >= 80) return "#059669";
  if (score >= 60) return "#2563EB";
  if (score >= 40) return "#D97706";
  return "#DC2626";
}

export default function OpportunityExplore({ onPick }) {
  const [aiMap, setAiMap] = useState({});
  useEffect(() => {
    setAiMap(loadClaudeAnalysisMap());
  }, []);

  const items = useMemo(() => {
    return D.map((c) => {
      const p = calcXY(c);
      const total = calcT(c);
      const ai = getClaudeAnalysisForId(aiMap, c.id);
      return {
        ...c,
        ...p,
        total,
        aiVerdict: ai?.analysis?.verdict?.score ?? null,
        aiOneLine: ai?.analysis?.verdict?.oneLine || null,
      };
    }).sort((a, b) => b.total - a.total);
  }, [aiMap]);

  const counts = useMemo(() => {
    const c = { blue: 0, gap: 0, cond: 0, no: 0 };
    items.forEach((it) => c[it.type]++);
    return c;
  }, [items]);

  const aiTop3 = useMemo(() => {
    return items
      .filter((it) => it.aiVerdict != null)
      .sort((a, b) => (b.aiVerdict || 0) - (a.aiVerdict || 0))
      .slice(0, 3);
  }, [items]);

  const chartData = items.map((c) => ({
    x: c.x,
    y: c.y,
    name: c.n,
    emoji: c.e,
    total: c.total,
    id: c.id,
    type: c.type,
  }));

  return (
    <div>
      {/* 헤더: 핵심 요약 + AI TOP 3 */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
          화면 1 · 기회 탐색
        </h2>
        <p style={{ fontSize: 11, color: "#999", marginBottom: 10 }}>
          {D.length}개 카테고리를 조망하고 검증할 후보 5~7개를 걸러냅니다
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6,
            marginBottom: aiTop3.length ? 8 : 0,
          }}
        >
          <SummaryCard label="🔵 블루오션" value={counts.blue} color="#3B82F6" bg="#EFF6FF" border="#BFDBFE" />
          <SummaryCard label="🟡 틈새 기회" value={counts.gap} color="#F59E0B" bg="#FFFBEB" border="#FDE68A" />
          <SummaryCard label="⚠️ 조건부" value={counts.cond} color="#F97316" bg="#FFF7ED" border="#FDBA74" />
          <SummaryCard label="❌ 비추천" value={counts.no} color="#EF4444" bg="#FEF2F2" border="#FECACA" />
        </div>

        {aiTop3.length > 0 && (
          <div
            style={{
              padding: "10px 12px",
              background: "linear-gradient(135deg,#FAF5FF,#EEF2FF)",
              border: "1px solid #C7D2FE",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#4338CA", marginBottom: 4 }}>
              🤖 Claude 추천 TOP 3
            </div>
            {aiTop3.map((c) => (
              <div
                key={c.id}
                onClick={() => onPick(D.find((x) => x.id === c.id))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "#222",
                  padding: "4px 0",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    color: "#fff",
                    background: aiScoreColor(c.aiVerdict),
                    borderRadius: 99,
                    padding: "2px 7px",
                    minWidth: 32,
                    textAlign: "center",
                  }}
                >
                  {c.aiVerdict}
                </span>
                <span style={{ fontSize: 14 }}>{c.e}</span>
                <span style={{ fontWeight: 700, color: "#222" }}>{c.n}</span>
                {c.aiOneLine && (
                  <span style={{ fontSize: 10, color: "#666", marginLeft: 4, lineHeight: 1.4 }}>
                    · {c.aiOneLine}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 데이터 업데이트 패널 */}
      <DataUpdate onComplete={() => setAiMap(loadClaudeAnalysisMap())} />

      {/* 매트릭스 차트 */}
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "12px 4px 0 0",
          border: "1px solid #E5E7EB",
          marginBottom: 14,
        }}
      >
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 16, bottom: 12, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[50, 100]}
              tick={{ fill: "#AAA", fontSize: 10 }}
              label={{
                value: "시장 매력도 →",
                position: "bottom",
                fill: "#999",
                fontSize: 10,
                offset: -2,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[40, 100]}
              tick={{ fill: "#AAA", fontSize: 10 }}
              label={{ value: "실행 가능성 →", angle: -90, position: "left", fill: "#999", fontSize: 10 }}
            />
            <Tooltip
              content={(props) => {
                const p = props.payload && props.payload[0] && props.payload[0].payload;
                if (!p) return null;
                return (
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 11,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#222" }}>
                      {p.emoji} {p.name}
                    </div>
                    <div style={{ color: "#999", marginTop: 3 }}>
                      매력도 {p.x} · 실행 {p.y} · {TL[p.type]}
                    </div>
                  </div>
                );
              }}
            />
            <RCScatter
              data={chartData}
              onClick={(d) => {
                const f = D.find((c) => c.id === d.id);
                if (f) onPick(f);
              }}
            >
              {chartData.map((en) => (
                <Cell
                  key={en.id}
                  fill={TC[en.type]}
                  fillOpacity={0.8}
                  stroke={TC[en.type]}
                  r={7}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </RCScatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* 분류별 카테고리 리스트 */}
      <GroupList items={items} onPick={onPick} type="blue" />
      <GroupList items={items} onPick={onPick} type="gap" />
      <GroupList items={items} onPick={onPick} type="cond" />
      <GroupList items={items} onPick={onPick} type="no" />
    </div>
  );
}

function SummaryCard({ label, value, color, bg, border }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 10, color, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function GroupList({ items, onPick, type }) {
  const list = items.filter((c) => c.type === type);
  if (!list.length) return null;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: TC[type], margin: "14px 0 6px" }}>
        {TL[type]} ({list.length})
      </div>
      {list.map((c) => (
        <CategoryCard key={c.id} c={c} onPick={onPick} />
      ))}
    </div>
  );
}

function CategoryCard({ c, onPick }) {
  const sigs = LAYER_KEYS.map((k) => sig(c[k]));
  return (
    <div
      onClick={() => onPick(c)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 12px",
        marginBottom: 4,
        background: TB[c.type],
        border: "1px solid " + TBR[c.type],
        borderRadius: 8,
        cursor: "pointer",
      }}
    >
      <span style={{ fontWeight: 900, color: TC[c.type], width: 26, fontSize: 13 }}>{c.total}</span>
      <span style={{ fontSize: 16 }}>{c.e}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#222" }}>{c.n}</div>
        <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>{c.mk}</div>
      </div>
      {c.aiVerdict != null && (
        <span
          title={c.aiOneLine || ""}
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#fff",
            background: aiScoreColor(c.aiVerdict),
            borderRadius: 99,
            padding: "2px 7px",
            whiteSpace: "nowrap",
          }}
        >
          🤖 {c.aiVerdict}
        </span>
      )}
      <span style={{ fontSize: 9.5, letterSpacing: 1 }}>
        {sigs.map((s) => s.l).join("")}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#4338CA",
          background: "#fff",
          border: "1px solid #C7D2FE",
          borderRadius: 99,
          padding: "2px 9px",
          marginLeft: 2,
          whiteSpace: "nowrap",
        }}
      >
        검증 →
      </span>
    </div>
  );
}
