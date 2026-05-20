"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TL, TC, TB, TBR } from "@/lib/data";
import {
  loadClaudeAnalysisMap,
  getClaudeAnalysisForId,
  getBusinessInputForId,
  setBusinessInputForId,
} from "@/lib/ai-cache";
import {
  computeChecklist,
  calcUnitEconomics,
  buildScenarios,
  simulateCashflow,
  deriveSeedUnitEconomics,
  formatKRW,
  formatKRWFull,
  recommendEntryMode,
} from "@/lib/business";

function aiScoreColor(score) {
  if (score == null) return "#9CA3AF";
  if (score >= 80) return "#059669";
  if (score >= 60) return "#2563EB";
  if (score >= 40) return "#D97706";
  return "#DC2626";
}

function gateInfo(level) {
  if (level === "GO")
    return { color: "#fff", bg: "#10B981", border: "#10B981", emoji: "✅" };
  if (level === "CONDITIONAL GO")
    return { color: "#fff", bg: "#F59E0B", border: "#F59E0B", emoji: "⚠️" };
  return { color: "#fff", bg: "#EF4444", border: "#EF4444", emoji: "❌" };
}

export default function BusinessReview({ cat, onNext, onBack }) {
  const [ai, setAi] = useState(null);
  const [ue, setUe] = useState(null); // 사용자 입력 Unit Economics
  const [exit, setExit] = useState({ initialBudget: 5000000, exitMonths: 6, exitMinUnits: 100, maxLoss: 5000000 });

  // 카테고리 변경 시: AI 캐시 로드 + 입력값 시드/복원
  useEffect(() => {
    if (!cat) return;
    setAi(getClaudeAnalysisForId(loadClaudeAnalysisMap(), cat.id)?.analysis || null);

    const map = JSON.parse(typeof window !== "undefined" ? window.localStorage.getItem("market-scouter:business-input:v1") || "{}" : "{}");
    const saved = map[String(cat.id)];
    if (saved) {
      setUe(saved.unitEcon);
      if (saved.exit) setExit(saved.exit);
    } else {
      // GUIDE c.rev 에서 시드값 자동 추출
      setUe(deriveSeedUnitEconomics(cat));
    }
  }, [cat?.id]);

  // 사용자 입력 변경 시 자동 저장
  useEffect(() => {
    if (!cat || !ue) return;
    setBusinessInputForId(cat.id, { unitEcon: ue, exit });
  }, [cat?.id, ue, exit]);

  // 계산 — useMemo 로 매번 다시
  const economics = useMemo(() => (ue ? calcUnitEconomics(ue) : null), [ue]);
  const scenarios = useMemo(() => (ue ? buildScenarios(ue) : null), [ue]);
  const cashflow = useMemo(() => {
    if (!economics) return null;
    return simulateCashflow({
      initialBudget: exit.initialBudget,
      ue: economics,
      months: 12,
    });
  }, [economics, exit.initialBudget]);
  const checklist = useMemo(
    () => (cat ? computeChecklist(cat, ai, economics, cashflow) : null),
    [cat, ai, economics, cashflow]
  );
  const entry = useMemo(() => recommendEntryMode(ai, economics), [ai, economics]);

  if (!cat) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#AAA" }}>
        먼저 화면 1에서 카테고리를 선택하세요
      </div>
    );
  }

  const gate = checklist ? gateInfo(checklist.goLevel) : gateInfo("NO-GO");

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        화면 3 · 사업 심사
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        GO/NO-GO 결정 + 12체크 + Unit Economics + 시나리오 + 현금흐름 + Exit 기준
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

      {/* GO/NO-GO 결정 카드 */}
      {checklist && (
        <div
          style={{
            padding: "14px 16px",
            marginBottom: 14,
            background: "#fff",
            border: `2px solid ${gate.border}`,
            borderRadius: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
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
              {checklist.goLevel}
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#888" }}>확신도</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: aiScoreColor(checklist.confidence),
                  lineHeight: 1,
                }}
              >
                {checklist.confidence}%
              </div>
            </div>
            <div style={{ flex: 1, fontSize: 11, color: "#666" }}>
              <div>
                ✅ <b>{checklist.okCount}</b> · ⚠️ <b>{checklist.warnCount}</b> · ❌{" "}
                <b>{checklist.failedCount}</b> (총 12체크)
              </div>
              <div style={{ marginTop: 3 }}>
                <span style={{ color: "#4338CA", fontWeight: 700 }}>추천 진입 방식:</span>{" "}
                {entry.mode} <span style={{ color: "#999" }}>· {entry.desc}</span>
              </div>
            </div>
          </div>
          {ai?.verdict?.nextAction && (
            <div
              style={{
                fontSize: 11,
                color: "#374151",
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                padding: "6px 10px",
              }}
            >
              <b style={{ color: "#4338CA" }}>다음 액션 ▸</b> {ai.verdict.nextAction}
            </div>
          )}
        </div>
      )}

      {/* 12 체크리스트 */}
      {checklist && (
        <Section title="✅ GO/NO-GO 12 체크리스트">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {checklist.items.map((row) => (
              <div
                key={row.key}
                style={{
                  padding: "7px 10px",
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 13 }}>{row.icon}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#222", flex: 1 }}>
                    {row.label}
                  </span>
                  {row.score != null && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: row.color }}>
                      {row.score}
                    </span>
                  )}
                </div>
                {row.note && (
                  <div style={{ fontSize: 9.5, color: "#888", marginTop: 2, lineHeight: 1.4 }}>
                    {row.note}
                  </div>
                )}
                <div style={{ fontSize: 8, color: "#AAA", marginTop: 1 }}>{row.refs}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Unit Economics 폼 + 결과 */}
      {ue && economics && (
        <Section title="💰 Unit Economics (실측 입력하면 12체크에 자동 반영)">
          <UnitEconomicsForm value={ue} onChange={setUe} economics={economics} />
        </Section>
      )}

      {/* Bull/Base/Bear 시나리오 */}
      {scenarios && (
        <Section title="🎲 시나리오 플래닝 (Bull / Base / Bear)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[
              { key: "bull", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
              { key: "base", color: "#4338CA", bg: "#EEF2FF", border: "#C7D2FE" },
              { key: "bear", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
            ].map(({ key, color, bg, border }) => {
              const sc = scenarios[key];
              return (
                <ScenarioCard
                  key={key}
                  label={sc.label}
                  desc={sc.desc}
                  ue={sc.ue}
                  color={color}
                  bg={bg}
                  border={border}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* 현금흐름 시뮬 */}
      {cashflow && (
        <Section title="💸 현금흐름 시뮬 (OEM 선입금 → 정산까지)">
          <CashflowPanel cashflow={cashflow} />
        </Section>
      )}

      {/* Exit 기준 + 최대 손실 + 킬 리스크 */}
      <Section title="⚠️ Exit 기준 + 최대 손실 + 리스크">
        <ExitRiskForm cat={cat} value={exit} onChange={setExit} />
      </Section>

      {/* 제품 인텔리전스 / 파트너 / 마케팅 — Phase 1 BusinessReview 의 핵심부만 압축 보존 */}
      {ai?.viral && (
        <Section title="🎬 마케팅 전략 (Claude)">
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

      {(cat.partners || []).length > 0 && (
        <Section title="🤝 파트너 후보">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {cat.partners.map((p, i) => (
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
        ※ Unit Economics 와 Exit 기준 입력값은 카테고리별로 브라우저에 자동 저장됩니다.
      </p>
    </div>
  );
}

// ─── Unit Economics 입력 폼 + 결과 카드 ──────────────────────────────────────

function UnitEconomicsForm({ value, onChange, economics }) {
  const set = (key) => (v) => onChange({ ...value, [key]: v });

  const ratioColor =
    economics.ltvCacRatio == null
      ? "#9CA3AF"
      : economics.ltvCacRatio >= 3
        ? "#059669"
        : economics.ltvCacRatio >= 2
          ? "#D97706"
          : "#DC2626";

  return (
    <>
      {/* 입력 그리드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <FieldBlock title="마케팅">
          <NumField label="월 광고비" value={value.adSpend} onChange={set("adSpend")} unit="원" step={100000} />
          <NumField label="월 전환 수" value={value.conversions} onChange={set("conversions")} unit="개" step={10} />
        </FieldBlock>
        <FieldBlock title="고객 가치">
          <NumField label="평균 주문가" value={value.avgOrderValue} onChange={set("avgOrderValue")} unit="원" step={1000} />
          <NumField label="재구매율" value={value.repeatRate} onChange={set("repeatRate")} unit="0~1" step={0.05} decimals={2} />
          <NumField label="연 구매 횟수" value={value.purchasesPerYear} onChange={set("purchasesPerYear")} unit="회" step={0.5} decimals={1} />
        </FieldBlock>
        <FieldBlock title="원가/물류">
          <NumField label="제조원가" value={value.cogs} onChange={set("cogs")} unit="원" step={1000} />
          <NumField label="포장비" value={value.packaging} onChange={set("packaging")} unit="원" step={100} />
          <NumField label="택배비" value={value.shipping} onChange={set("shipping")} unit="원" step={100} />
        </FieldBlock>
        <FieldBlock title="수수료/반품">
          <NumField label="플랫폼 수수료" value={value.platformFeePct} onChange={set("platformFeePct")} unit="%" step={1} decimals={1} />
          <NumField label="카드 수수료" value={value.cardFeePct} onChange={set("cardFeePct")} unit="%" step={0.1} decimals={1} />
          <NumField label="반품률" value={value.returnRatePct} onChange={set("returnRatePct")} unit="%" step={1} decimals={1} />
        </FieldBlock>
      </div>

      {/* 핵심 결과 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
        <ResultCard
          label="LTV/CAC"
          value={economics.ltvCacRatio == null ? "—" : economics.ltvCacRatio.toFixed(2) + "x"}
          sub={economics.ltvCacRatio >= 3 ? "건강" : economics.ltvCacRatio >= 1 ? "위태" : "위험"}
          color={ratioColor}
          big
        />
        <ResultCard
          label="CAC"
          value={isFinite(economics.cac) ? formatKRW(economics.cac) : "—"}
          sub={`${value.adSpend.toLocaleString()}원 ÷ ${value.conversions}건`}
          color="#4338CA"
        />
        <ResultCard
          label="LTV"
          value={formatKRW(economics.ltv)}
          sub={`마진 ${formatKRW(economics.realMarginPerUnit)}/건`}
          color="#7C3AED"
        />
        <ResultCard
          label="실질 마진"
          value={economics.realMarginPct.toFixed(0) + "%"}
          sub={`표면 ${economics.surfaceMarginPct.toFixed(0)}%`}
          color={economics.realMarginPct >= 50 ? "#059669" : economics.realMarginPct >= 30 ? "#D97706" : "#DC2626"}
        />
      </div>
      <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
        <ResultCard
          label="월 매출"
          value={formatKRW(economics.monthlyRevenue)}
          color="#059669"
        />
        <ResultCard
          label="월 매출이익"
          value={formatKRW(economics.monthlyMargin)}
          color="#059669"
        />
        <ResultCard
          label="월 순이익 (광고비 차감)"
          value={formatKRW(economics.monthlyNetProfit)}
          color={economics.monthlyNetProfit > 0 ? "#059669" : "#DC2626"}
        />
      </div>
    </>
  );
}

function FieldBlock({ title, children }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function NumField({ label, value, onChange, unit, step = 1, decimals = 0 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        marginBottom: 3,
        fontSize: 11,
      }}
    >
      <label style={{ color: "#666", flex: 1 }}>{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(decimals === 0 ? Math.round(v) : v);
          else onChange(0);
        }}
        style={{
          width: 88,
          padding: "3px 6px",
          fontSize: 11,
          border: "1px solid #E5E7EB",
          borderRadius: 4,
          textAlign: "right",
          fontFamily: "inherit",
        }}
      />
      <span style={{ fontSize: 9.5, color: "#999", width: 18 }}>{unit}</span>
    </div>
  );
}

function ResultCard({ label, value, sub, color, big }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 9, color: "#888" }}>{label}</div>
      <div style={{ fontSize: big ? 18 : 14, fontWeight: 800, color, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 9, color: "#888", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ─── 시나리오 카드 ────────────────────────────────────────────────────────────

function ScenarioCard({ label, desc, ue, color, bg, border }) {
  const ratio = ue.ltvCacRatio == null ? "—" : ue.ltvCacRatio.toFixed(2) + "x";
  return (
    <div style={{ padding: "10px 12px", background: bg, border: `1px solid ${border}`, borderRadius: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 9.5, color: "#666", marginBottom: 6, lineHeight: 1.4 }}>{desc}</div>
      <div style={{ fontSize: 9.5, color: "#888", marginBottom: 1 }}>월 매출</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#222", marginBottom: 4 }}>
        {formatKRW(ue.monthlyRevenue)}
      </div>
      <div style={{ fontSize: 9.5, color: "#888", marginBottom: 1 }}>월 순이익</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: ue.monthlyNetProfit > 0 ? "#059669" : "#DC2626",
          marginBottom: 4,
        }}
      >
        {formatKRW(ue.monthlyNetProfit)}
      </div>
      <div style={{ fontSize: 9.5, color: "#888", marginBottom: 1 }}>LTV/CAC</div>
      <div style={{ fontSize: 13, fontWeight: 800, color }}>{ratio}</div>
    </div>
  );
}

// ─── 현금흐름 패널 + 차트 ────────────────────────────────────────────────────

function CashflowPanel({ cashflow }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginBottom: 8 }}>
        <ResultCard label="초기 투자금" value={formatKRW(cashflow.initialBudget)} color="#4338CA" />
        <ResultCard
          label="최대 자금 부족"
          value={formatKRW(cashflow.maxDeficit)}
          sub={cashflow.maxDeficit < 0 ? "추가 자금 필요" : "투자금 내"}
          color={cashflow.maxDeficit < 0 ? "#DC2626" : "#059669"}
        />
        <ResultCard
          label="회수 시점"
          value={cashflow.runwayMonths + "개월"}
          sub={`입고 M${cashflow.inboundMonth}`}
          color="#7C3AED"
        />
        <ResultCard
          label="12개월 후 현금"
          value={formatKRW(cashflow.finalCash)}
          color={cashflow.finalCash >= cashflow.initialBudget ? "#059669" : "#D97706"}
        />
      </div>
      <div
        style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          padding: "4px 4px 0 0",
        }}
      >
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={cashflow.months} margin={{ top: 10, right: 16, bottom: 24, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="month"
              tick={{ fill: "#AAA", fontSize: 10 }}
              label={{ value: "개월", position: "bottom", fill: "#999", fontSize: 9, offset: -5 }}
            />
            <YAxis tick={{ fill: "#AAA", fontSize: 10 }} tickFormatter={(v) => formatKRW(v)} />
            <Tooltip
              labelFormatter={(m) => `M${m}`}
              formatter={(v) => [formatKRWFull(v), "현금 잔액"]}
              contentStyle={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                fontSize: 11,
              }}
            />
            <ReferenceLine y={0} stroke="#DC2626" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="cash" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Exit 기준 + 킬 리스크 폼 ────────────────────────────────────────────────

function ExitRiskForm({ cat, value, onChange }) {
  const set = (key) => (v) => onChange({ ...value, [key]: v });
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
        <FieldBlock title="투자 한도">
          <NumField label="초기 투자금" value={value.initialBudget} onChange={set("initialBudget")} unit="원" step={500000} />
          <NumField label="최대 손실 한도" value={value.maxLoss} onChange={set("maxLoss")} unit="원" step={500000} />
        </FieldBlock>
        <FieldBlock title="Exit 기준">
          <NumField label="Exit 판단 시점" value={value.exitMonths} onChange={set("exitMonths")} unit="개월" step={1} />
          <NumField label="최소 판매량 (월)" value={value.exitMinUnits} onChange={set("exitMinUnits")} unit="개" step={10} />
        </FieldBlock>
      </div>
      <div
        style={{
          padding: "8px 10px",
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: 6,
          fontSize: 11,
          color: "#78350F",
          lineHeight: 1.6,
        }}
      >
        <b style={{ color: "#92400E" }}>Exit 룰</b> ▸ 진입 후{" "}
        <b>{value.exitMonths}개월</b> 시점에 월 판매가 <b>{value.exitMinUnits}개</b> 미만이거나,
        누적 손실이 <b>{formatKRW(value.maxLoss)}</b>를 초과하면 사업 중단.
      </div>

      {(cat.risks || []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 4 }}>
            GUIDE 식별 리스크
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {cat.risks.map((r, i) => {
              const killKeywords = ["의료기기", "인허가", "특허", "대기업", "독과점", "규제", "식약처"];
              const isKill = killKeywords.some((k) => r.includes(k));
              return (
                <span
                  key={i}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 6,
                    fontSize: 11,
                    background: isKill ? "#FEF2F2" : "#F9FAFB",
                    color: isKill ? "#DC2626" : "#444",
                    border: isKill ? "1px solid #FECACA" : "1px solid #E5E7EB",
                    fontWeight: isKill ? 700 : 400,
                  }}
                >
                  {isKill ? "🔴 " : ""}
                  {r}
                </span>
              );
            })}
          </div>
        </div>
      )}
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

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: 10.5, color: "#444", lineHeight: 1.7, marginBottom: 2 }}>
      <span style={{ color: "#6B7280", fontWeight: 600 }}>{label} </span>
      {value}
    </div>
  );
}
