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

      {/* AI 4축 분석 (v2 Phase 2) */}
      {ai && (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "16px 0 6px" }}>
            🤖 AI 4축 분석 (Phase 2)
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              marginBottom: 14,
            }}
          >
            <TrendDurationCard data={ai.trendDuration} />
            <KoreaCulturalFitCard data={ai.koreaCulturalFit} />
            <MegatrendTailwindCard data={ai.megatrendTailwind} />
            <AdoptionSpeedCard data={ai.adoptionSpeed} />
          </div>
        </>
      )}

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
        ※ AI 4축 분석은 매트릭스 뷰의 "데이터 업데이트"에서 Claude 분석을 실행하면 채워집니다.
      </p>
    </div>
  );
}

// ─── AI 4축 카드 ──────────────────────────────────────────────────────────────

function durationColor(verdict) {
  if (verdict === "장기") return { bg: "#ECFDF5", border: "#A7F3D0", text: "#059669" };
  if (verdict === "중기") return { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706" };
  if (verdict === "반짝") return { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" };
  return { bg: "#F9FAFB", border: "#E5E7EB", text: "#6B7280" };
}

function fitColor(verdict) {
  if (verdict === "유리") return { bg: "#ECFDF5", border: "#A7F3D0", text: "#059669" };
  if (verdict === "불리") return { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" };
  return { bg: "#F9FAFB", border: "#E5E7EB", text: "#6B7280" };
}

function tailwindColor(judgement) {
  if (judgement === "순풍") return { bg: "#ECFDF5", text: "#059669" };
  if (judgement === "역풍") return { bg: "#FEF2F2", text: "#DC2626" };
  return { bg: "#F9FAFB", text: "#6B7280" };
}

function speedColor(verdict) {
  if (verdict === "빠름") return { bg: "#ECFDF5", border: "#A7F3D0", text: "#059669" };
  if (verdict === "느림") return { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" };
  return { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706" };
}

function TrendDurationCard({ data }) {
  if (!data) return <EmptyAxisCard title="⏳ 트렌드 지속성" />;
  const c = durationColor(data.verdict);
  return (
    <div
      style={{
        padding: "10px 12px",
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#222" }}>⏳ 트렌드 지속성</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#fff",
            background: c.text,
            borderRadius: 99,
            padding: "1px 7px",
          }}
        >
          {data.verdict || "—"}
        </span>
        {data.score != null && (
          <span style={{ fontSize: 11, fontWeight: 800, color: c.text, marginLeft: "auto" }}>
            {data.score}
          </span>
        )}
      </div>
      {data.globalEmerged && (
        <FieldLine label="글로벌 등장" value={data.globalEmerged} />
      )}
      {data.growthShape && <FieldLine label="성장 곡선" value={data.growthShape} />}
      {data.institutionalization && (
        <FieldLine label="제도화" value={data.institutionalization} />
      )}
    </div>
  );
}

function KoreaCulturalFitCard({ data }) {
  if (!data) return <EmptyAxisCard title="🇰🇷 한국 문화 적합성" />;
  const c = fitColor(data.verdict);
  return (
    <div
      style={{
        padding: "10px 12px",
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#222" }}>🇰🇷 문화 적합성</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#fff",
            background: c.text,
            borderRadius: 99,
            padding: "1px 7px",
          }}
        >
          {data.verdict || "—"}
        </span>
        {data.score != null && (
          <span style={{ fontSize: 11, fontWeight: 800, color: c.text, marginLeft: "auto" }}>
            {data.score}
          </span>
        )}
      </div>
      {data.favorable && <FieldLine label="👍 유리" value={data.favorable} />}
      {data.unfavorable && <FieldLine label="👎 불리" value={data.unfavorable} />}
      {data.reasoning && (
        <div style={{ fontSize: 10, color: "#555", marginTop: 3, lineHeight: 1.5 }}>
          {data.reasoning}
        </div>
      )}
    </div>
  );
}

function MegatrendTailwindCard({ data }) {
  if (!data) return <EmptyAxisCard title="🌬️ 구조적 순풍" />;
  const axes = [
    { id: "demographic", l: "인구", v: data.demographic },
    { id: "climate", l: "기후", v: data.climate },
    { id: "technology", l: "기술", v: data.technology },
    { id: "consumerBehavior", l: "소비", v: data.consumerBehavior },
  ];
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#222" }}>🌬️ 구조적 순풍</span>
        {data.score != null && (
          <span style={{ fontSize: 11, fontWeight: 800, color: "#4338CA", marginLeft: "auto" }}>
            {data.score}
          </span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginBottom: 4 }}>
        {axes.map((a) => {
          const col = tailwindColor(a.v);
          return (
            <div
              key={a.id}
              style={{
                fontSize: 9.5,
                padding: "3px 7px",
                background: col.bg,
                color: col.text,
                borderRadius: 99,
                display: "flex",
                justifyContent: "space-between",
                gap: 4,
              }}
            >
              <span style={{ fontWeight: 600 }}>{a.l}</span>
              <span style={{ fontWeight: 700 }}>{a.v || "—"}</span>
            </div>
          );
        })}
      </div>
      {data.keyTailwind && <FieldLine label="핵심 순풍" value={data.keyTailwind} />}
    </div>
  );
}

function AdoptionSpeedCard({ data }) {
  if (!data) return <EmptyAxisCard title="🚀 한국 채택 속도" />;
  const c = speedColor(data.verdict);
  const flags = [
    { l: "모바일 구매", v: data.mobilePurchase },
    { l: "가성비 비교", v: data.priceComparison },
    { l: "SNS 인증", v: data.snsCompatible },
  ];
  return (
    <div
      style={{
        padding: "10px 12px",
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#222" }}>🚀 채택 속도</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#fff",
            background: c.text,
            borderRadius: 99,
            padding: "1px 7px",
          }}
        >
          {data.verdict || "—"}
        </span>
        {data.score != null && (
          <span style={{ fontSize: 11, fontWeight: 800, color: c.text, marginLeft: "auto" }}>
            {data.score}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
        {flags.map((f, i) => (
          <span
            key={i}
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 99,
              background: f.v ? "#ECFDF5" : "#F9FAFB",
              color: f.v ? "#059669" : "#9CA3AF",
              border: f.v ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
            }}
          >
            {f.v ? "✓" : "·"} {f.l}
          </span>
        ))}
      </div>
      {data.convenienceLift && <FieldLine label="편의성" value={data.convenienceLift} />}
      {data.habitChangeRequired && (
        <FieldLine label="습관 변화" value={data.habitChangeRequired} />
      )}
    </div>
  );
}

function EmptyAxisCard({ title }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "#F9FAFB",
        border: "1px dashed #E5E7EB",
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 9.5, color: "#AAA", lineHeight: 1.4 }}>
        AI 분석 결과 없음
      </div>
    </div>
  );
}

function FieldLine({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: 10, color: "#444", lineHeight: 1.5, marginTop: 2 }}>
      <span style={{ color: "#6B7280", fontWeight: 600 }}>{label} </span>
      {value}
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
