"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  loadPartnerVerifyMap,
  getPartnerVerifyForBrand,
  setPartnerVerifyForBrand,
} from "@/lib/ai-cache";

function scoreColor(s) {
  if (s == null) return "#9CA3AF";
  if (s >= 80) return "#059669";
  if (s >= 60) return "#2563EB";
  if (s >= 40) return "#D97706";
  return "#DC2626";
}

function gateColor(level) {
  if (level === "GO") return { bg: "#10B981", fg: "#fff", border: "#10B981" };
  if (level === "CONDITIONAL GO") return { bg: "#F59E0B", fg: "#fff", border: "#F59E0B" };
  if (level === "NO-GO") return { bg: "#EF4444", fg: "#fff", border: "#EF4444" };
  return { bg: "#9CA3AF", fg: "#fff", border: "#9CA3AF" };
}

function fmtKRW(n) {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return (abs / 100_000_000).toFixed(1) + "억";
  if (abs >= 10_000) return Math.round(abs / 10_000).toLocaleString() + "만";
  return abs.toLocaleString();
}

export default function PartnerVerify({ partner, onNext, onBack }) {
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [creatorCount, setCreatorCount] = useState(5);

  useEffect(() => {
    if (!partner) return;
    const cached = getPartnerVerifyForBrand(
      loadPartnerVerifyMap(),
      partner.brandName,
      partner.mallName
    );
    setEntry(cached);
    setError(null);
  }, [partner?.brandName, partner?.mallName]);

  async function runVerify() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/partner-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partner,
          categoryName: partner.category,
        }),
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setPartnerVerifyForBrand(partner.brandName, partner.mallName, json);
      setEntry({ ...json, cachedAt: new Date().toISOString() });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!partner) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#AAA" }}>
        먼저 P1(파트너 발굴) 에서 파트너 후보를 선택하세요.
      </div>
    );
  }

  const a = entry?.analysis;

  // 성장 시뮬레이션 차트 데이터
  const simulation = a?.growthPotential?.simulation;
  const simChartData = useMemo(() => {
    if (!simulation) return [];
    const baseRevenue = simulation.baseMonthlyRevenue || 3_000_000;
    const view = simulation.avgViewsPerCreator || 100_000;
    const conv = simulation.conversionRate || 0.003;
    const aov = simulation.avgOrderValue || 39_000;
    const incrementalPerCreator = view * conv * aov;
    return [
      { label: "현재", value: baseRevenue, fill: "#9CA3AF" },
      { label: "+5명", value: baseRevenue + 5 * incrementalPerCreator, fill: "#3B82F6" },
      { label: "+10명", value: baseRevenue + 10 * incrementalPerCreator, fill: "#2563EB" },
      { label: "+20명", value: baseRevenue + 20 * incrementalPerCreator, fill: "#7C3AED" },
    ];
  }, [simulation]);

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        P2 · 파트너 검증
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        선택한 파트너의 제품 품질·마케팅 공백·성장 잠재력·리스크를 종합 검증
      </p>

      {/* 파트너 프로필 헤더 */}
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
        <span style={{ fontSize: 28 }}>🏬</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111", margin: 0 }}>
            {partner.brandName || partner.mallName}
          </h3>
          <p style={{ fontSize: 11, color: "#999", margin: "2px 0 0" }}>
            {partner.category} · {partner.priceRange || "가격 미상"}
            {partner.productSample && (
              <>
                {" · "}
                <span style={{ color: "#666" }}>{partner.productSample.slice(0, 40)}</span>
              </>
            )}
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
          ← 발굴로
        </button>
      </div>

      {/* 검증 트리거 */}
      <div
        style={{
          padding: "10px 12px",
          background: entry ? "#fff" : "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, fontSize: 11, color: "#555", lineHeight: 1.6 }}>
          {entry ? (
            <>
              마지막 검증 ·{" "}
              <b style={{ color: "#222" }}>
                {entry.cachedAt?.slice(0, 16).replace("T", " ")}
              </b>{" "}
              · Claude ${(entry.estCostUSD || 0).toFixed(4)}
            </>
          ) : (
            <>
              Claude 가 파트너 데이터를 깊이 분석해 5섹션 + GO/NO-GO 판정을 만듭니다 ·
              <b> ~$0.04</b>
            </>
          )}
        </div>
        <button
          onClick={runVerify}
          disabled={loading}
          style={{
            padding: "7px 14px",
            background: loading ? "#C7D2FE" : "linear-gradient(135deg,#4F46E5,#6366F1)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 11.5,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "검증 중…" : entry ? "🔄 재검증" : "🔬 검증 실행"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "8px 10px",
            marginBottom: 12,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            fontSize: 11,
            color: "#B91C1C",
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      )}

      {!a && !error && !loading && (
        <div
          style={{
            padding: "20px 12px",
            background: "#F9FAFB",
            border: "1px dashed #E5E7EB",
            borderRadius: 8,
            textAlign: "center",
            fontSize: 12,
            color: "#888",
          }}
        >
          "🔬 검증 실행" 을 누르면 5섹션 분석이 자동 생성됩니다.
        </div>
      )}

      {a && (
        <>
          {/* 판정 카드 — 최상단 */}
          {a.verdict && (
            <VerdictCard verdict={a.verdict} onNext={onNext} />
          )}

          {/* 섹션 1: 제품 품질 */}
          {a.productQuality && (
            <Section title="📦 섹션 1 · 제품 품질 검증">
              <ProductQualityCard data={a.productQuality} partner={partner} />
            </Section>
          )}

          {/* 섹션 2: 마케팅 공백 */}
          {a.marketingGap && (
            <Section title="📉 섹션 2 · 마케팅 공백 분석">
              <MarketingGapCard data={a.marketingGap} partner={partner} />
            </Section>
          )}

          {/* 섹션 3: 성장 잠재력 + 시뮬 차트 */}
          {a.growthPotential && (
            <Section title="📈 섹션 3 · 성장 잠재력">
              <GrowthCard data={a.growthPotential} simChartData={simChartData} />
            </Section>
          )}

          {/* 섹션 4: 숏폼 전략 */}
          {a.viralStrategy && (
            <Section title="🎬 섹션 4 · 숏폼 전략">
              <ViralCard data={a.viralStrategy} />
            </Section>
          )}

          {/* 섹션 5: 리스크 */}
          {a.risks?.length > 0 && (
            <Section title="⚠️ 섹션 5 · 리스크 체크">
              <RisksCard risks={a.risks} />
            </Section>
          )}

          {/* 다음 단계 버튼 */}
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
              협업 실행 계획 →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>{title}</h3>
      {children}
    </div>
  );
}

function VerdictCard({ verdict, onNext }) {
  const g = gateColor(verdict.level);
  return (
    <div
      style={{
        padding: "14px 16px",
        marginBottom: 14,
        background: "#fff",
        border: `2px solid ${g.border}`,
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: g.fg,
            background: g.bg,
            padding: "8px 16px",
            borderRadius: 8,
            letterSpacing: "0.05em",
          }}
        >
          {verdict.level}
        </div>
        {verdict.score != null && (
          <div>
            <div style={{ fontSize: 10, color: "#888" }}>적합도</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor(verdict.score), lineHeight: 1 }}>
              {verdict.score}
            </div>
          </div>
        )}
        {verdict.confidence != null && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#888" }}>확신도</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#4338CA", lineHeight: 1 }}>
              {verdict.confidence}%
            </div>
          </div>
        )}
      </div>
      {verdict.summary && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#222", marginBottom: 4, lineHeight: 1.5 }}>
          {verdict.summary}
        </div>
      )}
      {verdict.reasoning && (
        <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.7, marginBottom: 8 }}>
          {verdict.reasoning}
        </div>
      )}
      {verdict.checklist?.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
          }}
        >
          {verdict.checklist.map((row, i) => (
            <div
              key={i}
              style={{
                fontSize: 10.5,
                padding: "6px 9px",
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                borderRadius: 5,
                display: "flex",
                gap: 5,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12 }}>{row.icon}</span>
              <span style={{ fontWeight: 700, color: "#222" }}>{row.label}</span>
              {row.note && <span style={{ fontSize: 9.5, color: "#888" }}>{row.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductQualityCard({ data, partner }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "#666" }}>품질 점수</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#fff",
            background: scoreColor(data.score),
            borderRadius: 99,
            padding: "1px 8px",
          }}
        >
          {data.score ?? "—"}
        </span>
        <span style={{ fontSize: 10, color: "#999", marginLeft: "auto" }}>
          블로그 리뷰 {partner.blogReviewCount ?? 0}건 ({partner.blogSentiment || ""})
        </span>
      </div>
      {data.summary && (
        <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.65, marginBottom: 6 }}>
          {data.summary}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <KeywordList title="🟢 긍정 TOP" color="#059669" bg="#ECFDF5" border="#A7F3D0" items={data.positiveKeywords} />
        <KeywordList title="🔴 부정 TOP" color="#DC2626" bg="#FEF2F2" border="#FECACA" items={data.negativeKeywords} />
      </div>
      {data.claudeOpinion && (
        <div
          style={{
            marginTop: 6,
            padding: "5px 9px",
            background: "#EEF2FF",
            border: "1px solid #C7D2FE",
            borderRadius: 5,
            fontSize: 11,
            color: "#3730A3",
            lineHeight: 1.6,
          }}
        >
          <b>🤖 Claude:</b> {data.claudeOpinion}
        </div>
      )}
    </div>
  );
}

function KeywordList({ title, items, color, bg, border }) {
  return (
    <div style={{ padding: "6px 9px", background: bg, border: `1px solid ${border}`, borderRadius: 5 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color, marginBottom: 3 }}>{title}</div>
      {Array.isArray(items) && items.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {items.slice(0, 5).map((k, i) => (
            <span
              key={i}
              style={{
                padding: "1px 6px",
                fontSize: 10,
                background: "#fff",
                color,
                border: `1px solid ${border}`,
                borderRadius: 99,
              }}
            >
              {k}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: "#999" }}>—</div>
      )}
    </div>
  );
}

function MarketingGapCard({ data, partner }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "#666" }}>공백 점수</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#fff",
            background: scoreColor(data.score),
            borderRadius: 99,
            padding: "1px 8px",
          }}
        >
          {data.score ?? "—"}
        </span>
        <span style={{ fontSize: 10, color: "#999", marginLeft: "auto" }}>
          YouTube 쇼츠 {partner.youtubeShorts ?? "?"}개
        </span>
      </div>
      <FieldRow label="현재 방식" value={data.currentMethod} />
      <FieldRow label="쇼츠 현황" value={data.shortsStatus} />
      {data.benchmarkCompetitor && <FieldRow label="벤치마크" value={data.benchmarkCompetitor} />}
      {data.gapEstimate && (
        <div
          style={{
            marginTop: 6,
            padding: "5px 9px",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 5,
            fontSize: 11,
            fontWeight: 700,
            color: "#92400E",
            lineHeight: 1.6,
          }}
        >
          💡 {data.gapEstimate}
        </div>
      )}
    </div>
  );
}

function GrowthCard({ data, simChartData }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "#666" }}>성장 점수</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#fff",
            background: scoreColor(data.score),
            borderRadius: 99,
            padding: "1px 8px",
          }}
        >
          {data.score ?? "—"}
        </span>
      </div>
      <FieldRow label="카테고리 추이" value={data.categoryTrend} />
      <FieldRow label="브랜드 현황" value={data.brandStatus} />

      {/* 시뮬레이션 차트 */}
      {simChartData.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>
            크리에이터 투입 시 월 매출 시뮬레이션
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={simChartData} margin={{ top: 4, right: 10, bottom: 16, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} />
              <YAxis tick={{ fill: "#AAA", fontSize: 9 }} tickFormatter={(v) => fmtKRW(v)} />
              <Tooltip
                formatter={(v) => [fmtKRW(v) + "원", "월 매출"]}
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 6,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {simChartData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 9, color: "#888", marginTop: 2, lineHeight: 1.5 }}>
            ※ 시뮬: 크리에이터 × {(data.simulation?.avgViewsPerCreator || 100000).toLocaleString()}회 ×
            전환율 {((data.simulation?.conversionRate || 0.003) * 100).toFixed(2)}% × 객단가{" "}
            {(data.simulation?.avgOrderValue || 39000).toLocaleString()}원
          </div>
        </div>
      )}
    </div>
  );
}

function ViralCard({ data }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "#666" }}>숏폼 적합도</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#fff",
            background: scoreColor(data.score),
            borderRadius: 99,
            padding: "1px 8px",
          }}
        >
          {data.score ?? "—"}
        </span>
      </div>
      {data.targetCreators && (
        <FieldRow label="추천 크리에이터" value={data.targetCreators} />
      )}
      {Array.isArray(data.concepts) && data.concepts.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 3 }}>
            추천 숏폼 컨셉
          </div>
          {data.concepts.map((c, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                color: "#374151",
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                borderRadius: 5,
                padding: "5px 8px",
                marginBottom: 3,
                lineHeight: 1.55,
              }}
            >
              <b style={{ color: "#7C3AED" }}>#{i + 1}.</b> {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RisksCard({ risks }) {
  const sorted = [...risks].sort((a, b) => {
    if (a.isKill !== b.isKill) return a.isKill ? -1 : 1;
    return (b.severity || 0) - (a.severity || 0);
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {sorted.map((r, i) => (
        <div
          key={i}
          style={{
            padding: "7px 10px",
            background: r.isKill ? "#FEE2E2" : "#FEF2F2",
            border: r.isKill ? "2px solid #DC2626" : "1px solid #FECACA",
            borderRadius: 6,
            fontSize: 11,
            color: "#7F1D1D",
            lineHeight: 1.6,
          }}
        >
          <span style={{ fontWeight: 700, marginRight: 4 }}>
            {r.isKill ? "☠️ 킬 리스크" : `⚠️ ${r.type}`}
          </span>
          <span
            style={{
              fontSize: 9.5,
              color: "#fff",
              background: r.isKill ? "#7F1D1D" : "#DC2626",
              borderRadius: 99,
              padding: "1px 6px",
              marginRight: 4,
            }}
          >
            {r.severity ?? "—"}
          </span>
          {r.issue}
        </div>
      ))}
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
