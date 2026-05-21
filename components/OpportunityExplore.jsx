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
import {
  D,
  LAYER_KEYS,
  calcXY,
  calcT,
  sig,
  TL,
  TC,
  TB,
  TBR,
  getAllCategories,
  removeCustomCategory,
} from "@/lib/data";
import { loadClaudeAnalysisMap, getClaudeAnalysisForId } from "@/lib/ai-cache";
import DataUpdate from "./DataUpdate";
import CategoryDiscovery from "./CategoryDiscovery";

function aiScoreColor(score) {
  if (score == null) return "#9CA3AF";
  if (score >= 80) return "#059669";
  if (score >= 60) return "#2563EB";
  if (score >= 40) return "#D97706";
  return "#DC2626";
}

export default function OpportunityExplore({ onPick }) {
  const [aiMap, setAiMap] = useState({});
  const [allCategories, setAllCategories] = useState(D);

  function reloadAll() {
    setAllCategories(getAllCategories());
  }

  useEffect(() => {
    setAiMap(loadClaudeAnalysisMap());
    reloadAll();
    // customs 변경 이벤트 구독
    const handler = () => reloadAll();
    if (typeof window !== "undefined") {
      window.addEventListener("market-scouter:customs-changed", handler);
      return () => window.removeEventListener("market-scouter:customs-changed", handler);
    }
  }, []);

  function handleRemoveCustom(id, name) {
    if (!confirm(`"${name}" 을 사용자 목록에서 제거할까요?`)) return;
    removeCustomCategory(id);
    reloadAll();
  }

  const items = useMemo(() => {
    return allCategories
      .map((c) => {
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
      })
      .sort((a, b) => b.total - a.total);
  }, [aiMap, allCategories]);

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
                onClick={() => onPick(allCategories.find((x) => x.id === c.id))}
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

      {/* 신규 카테고리 자동 발견 */}
      <CategoryDiscovery />

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
                const f = allCategories.find((c) => c.id === d.id);
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

      {/* 분류별 카테고리 리스트 — 데스크톱 4컬럼 / 태블릿 2컬럼 / 모바일 1컬럼 */}
      <FourColumnGroups items={items} onPick={onPick} onRemoveCustom={handleRemoveCustom} />
    </div>
  );
}

function FourColumnGroups({ items, onPick, onRemoveCustom }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 8,
        alignItems: "start",
      }}
    >
      {["blue", "gap", "cond", "no"].map((type) => (
        <GroupColumn
          key={type}
          items={items}
          onPick={onPick}
          onRemoveCustom={onRemoveCustom}
          type={type}
        />
      ))}
    </div>
  );
}

function GroupColumn({ items, onPick, onRemoveCustom, type }) {
  const list = items.filter((c) => c.type === type);
  const customCount = list.filter((c) => c.isCustom).length;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid " + TBR[type],
        borderRadius: 10,
        padding: "8px 8px 10px",
      }}
    >
      {/* 컬럼 헤더 */}
      <div
        style={{
          padding: "6px 8px 8px",
          marginBottom: 6,
          borderBottom: "1px solid " + TBR[type],
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: TC[type], flex: 1, lineHeight: 1.2 }}>
          {TL[type]}
        </span>
        {customCount > 0 && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#9A3412",
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: 99,
              padding: "1px 5px",
            }}
            title={`사용자 추가 ${customCount}개 포함`}
          >
            🆕{customCount}
          </span>
        )}
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#fff",
            background: TC[type],
            borderRadius: 99,
            padding: "1px 8px",
            minWidth: 22,
            textAlign: "center",
          }}
        >
          {list.length}
        </span>
      </div>
      {list.length === 0 ? (
        <div style={{ fontSize: 10.5, color: "#AAA", padding: "6px 4px" }}>—</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {list.map((c) => (
            <CompactCategoryCard key={c.id} c={c} onPick={onPick} onRemoveCustom={onRemoveCustom} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompactCategoryCard({ c, onPick, onRemoveCustom }) {
  const sigs = LAYER_KEYS.map((k) => sig(c[k]));
  const isCustom = !!c.isCustom;
  return (
    <div
      onClick={() => onPick(c)}
      style={{
        padding: "6px 8px",
        background: isCustom ? "#FFFBEB" : TB[c.type],
        border: isCustom ? "1px dashed #F59E0B" : "1px solid " + TBR[c.type],
        borderRadius: 6,
        cursor: "pointer",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
        <span style={{ fontWeight: 900, color: TC[c.type], fontSize: 11, minWidth: 18 }}>
          {c.total}
        </span>
        <span style={{ fontSize: 13 }}>{c.e}</span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: "#222",
            lineHeight: 1.25,
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={c.n}
        >
          {c.n}
        </span>
        {isCustom && (
          <span
            style={{
              fontSize: 8.5,
              fontWeight: 800,
              color: "#9A3412",
              background: "#fff",
              border: "1px solid #FDE68A",
              borderRadius: 99,
              padding: "1px 5px",
              whiteSpace: "nowrap",
            }}
            title={`사용자 추가 카테고리 · 추가 시각 ${c.addedAt?.slice(0, 16) || ""}`}
          >
            🆕
          </span>
        )}
        {c.aiVerdict != null && (
          <span
            title={c.aiOneLine || ""}
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: "#fff",
              background: aiScoreColor(c.aiVerdict),
              borderRadius: 99,
              padding: "1px 5px",
              whiteSpace: "nowrap",
            }}
          >
            🤖{c.aiVerdict}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            fontSize: 8.5,
            color: "#999",
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {c.mk}
        </span>
        <span style={{ fontSize: 8, letterSpacing: 0.5 }}>{sigs.map((s) => s.l).join("")}</span>
        {isCustom && onRemoveCustom && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveCustom(c.id, c.n);
            }}
            title="사용자 목록에서 제거"
            style={{
              background: "transparent",
              border: "none",
              color: "#999",
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
              marginLeft: 2,
            }}
          >
            🗑️
          </button>
        )}
      </div>
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

// (GroupList / CategoryCard 는 가로 4컬럼으로 대체되어 제거됨)
