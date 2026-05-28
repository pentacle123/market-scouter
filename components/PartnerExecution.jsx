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
  loadPartnerMessagesMap,
  getPartnerMessage,
  setPartnerMessage,
} from "@/lib/ai-cache";

function fmtKRW(n) {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return (abs / 100_000_000).toFixed(1) + "억";
  if (abs >= 10_000) return Math.round(abs / 10_000).toLocaleString() + "만";
  return abs.toLocaleString();
}

const CHANNELS = [
  { id: "email", l: "✉️ 이메일", desc: "공식·길이 길게" },
  { id: "dm", l: "📱 인스타 DM", desc: "친근·짧게" },
  { id: "kakao", l: "💬 카톡/네이버톡톡", desc: "친근·구어체" },
];

export default function PartnerExecution({ partner, onBack }) {
  const [verifyEntry, setVerifyEntry] = useState(null);
  const [channel, setChannel] = useState("email");
  const [messageEntry, setMessageEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!partner) return;
    setVerifyEntry(
      getPartnerVerifyForBrand(
        loadPartnerVerifyMap(),
        partner.brandName,
        partner.mallName
      )
    );
  }, [partner?.brandName, partner?.mallName]);

  useEffect(() => {
    if (!partner) return;
    const cid = 0;
    const msgMap = loadPartnerMessagesMap();
    setMessageEntry(
      getPartnerMessage(msgMap, cid, partner.mallName || partner.brandName, channel)
    );
    setError(null);
  }, [partner?.mallName, partner?.brandName, channel]);

  async function generateMessage() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/partner-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partner, channel }),
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const cid = 0;
      setPartnerMessage(cid, partner.mallName || partner.brandName, channel, json);
      setMessageEntry({ ...json, savedAt: new Date().toISOString() });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function copyMessage() {
    const msg = messageEntry?.message;
    if (!msg) return;
    const text = [msg.subject ? `[제목] ${msg.subject}\n\n` : "", msg.body || ""].join("");
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => window.prompt("클립보드 복사 실패. Ctrl+C 로 복사하세요:", text));
  }

  // 수익 타임라인 (검증 시뮬레이션 기반, 없으면 보수적 기본값)
  const sim = verifyEntry?.analysis?.growthPotential?.simulation;
  const revenueTimeline = useMemo(() => {
    // RS 가정: M1 어필리에이트 10%, M2~3 RS 20%, M6+ RS 25% + 확장
    const baseRevenue = sim?.baseMonthlyRevenue || 3_000_000;
    const view = sim?.avgViewsPerCreator || 100_000;
    const conv = sim?.conversionRate || 0.003;
    const aov = sim?.avgOrderValue || 39_000;
    const perCreator = view * conv * aov;

    // Pentacle 수익 추정
    const m1 = Math.round(5 * perCreator * 0.1); // 어필 5명 × 10%
    const m2 = Math.round(((baseRevenue + 10 * perCreator) - baseRevenue) * 0.2); // 증분만 RS 20%
    const m3 = Math.round(((baseRevenue + 15 * perCreator) - baseRevenue) * 0.2);
    const m6 = Math.round(((baseRevenue + 25 * perCreator) - baseRevenue) * 0.25);
    const m12 = Math.round((((baseRevenue + 25 * perCreator) - baseRevenue) * 0.25) * 3); // 파트너 3개

    return [
      { label: "M1\n어필", value: m1, fill: "#9CA3AF" },
      { label: "M2\nRS 20%", value: m2, fill: "#6366F1" },
      { label: "M3\nRS 20%", value: m3, fill: "#7C3AED" },
      { label: "M6\nRS 25%", value: m6, fill: "#3B82F6" },
      { label: "M12\n3파트너", value: m12, fill: "#10B981" },
    ];
  }, [sim]);

  if (!partner) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#AAA" }}>
        먼저 P1·P2 에서 파트너를 선택하고 검증하세요.
      </div>
    );
  }

  const a = verifyEntry?.analysis;
  const verdictLevel = a?.verdict?.level || "—";

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        P3 · 협업 실행 계획
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        GO 판정 후 주차별 액션플랜 + 첫 접근 메시지 + 수익 타임라인
      </p>

      {/* 파트너 프로필 */}
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
        <span style={{ fontSize: 24 }}>🏬</span>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111", margin: 0 }}>
            {partner.brandName || partner.mallName}
          </h3>
          <p style={{ fontSize: 11, color: "#999", margin: "2px 0 0" }}>
            {partner.category} · {partner.priceRange || "가격 미상"} ·{" "}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#fff",
                background:
                  verdictLevel === "GO" ? "#10B981" :
                  verdictLevel === "CONDITIONAL GO" ? "#F59E0B" :
                  verdictLevel === "NO-GO" ? "#EF4444" : "#9CA3AF",
                borderRadius: 99,
                padding: "1px 7px",
              }}
            >
              {verdictLevel}
            </span>
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

      {/* Step 1: 첫 접근 메시지 */}
      <Section title="📨 Step 1 · 첫 접근 (Week 1)">
        <div
          style={{
            padding: "10px 12px",
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4338CA" }}>채널:</span>
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                style={{
                  padding: "4px 10px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: channel === c.id ? "#7C3AED" : "#fff",
                  color: channel === c.id ? "#fff" : "#666",
                  border: "1px solid",
                  borderColor: channel === c.id ? "#7C3AED" : "#E5E7EB",
                  borderRadius: 99,
                  cursor: "pointer",
                }}
                title={c.desc}
              >
                {c.l}
              </button>
            ))}
            <button
              onClick={generateMessage}
              disabled={loading}
              style={{
                marginLeft: "auto",
                padding: "4px 12px",
                fontSize: 10.5,
                fontWeight: 700,
                background: loading ? "#DDD6FE" : "linear-gradient(135deg,#7C3AED,#4338CA)",
                color: "#fff",
                border: "none",
                borderRadius: 99,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "생성 중…" : messageEntry?.message ? "🔄 재생성" : "🤖 메시지 생성"}
            </button>
            {messageEntry?.message && (
              <button
                onClick={copyMessage}
                style={{
                  padding: "4px 12px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: copied ? "#10B981" : "#fff",
                  color: copied ? "#fff" : "#666",
                  border: "1px solid #E5E7EB",
                  borderRadius: 99,
                  cursor: "pointer",
                }}
              >
                {copied ? "✓ 복사됨" : "📋 복사"}
              </button>
            )}
          </div>
          {error && (
            <div style={{ fontSize: 11, color: "#B91C1C", marginBottom: 6, lineHeight: 1.6 }}>
              {error}
            </div>
          )}
          {!messageEntry?.message && !loading && (
            <div style={{ fontSize: 11, color: "#888", padding: "12px 8px", textAlign: "center" }}>
              위 "🤖 메시지 생성" 을 누르면 파트너 데이터·검증 결과를 반영한 첫 연락 메시지를 자동
              생성합니다. (~$0.005)
            </div>
          )}
          {messageEntry?.message && (
            <div
              style={{
                background: "linear-gradient(135deg,#FAF5FF,#EEF2FF)",
                border: "1px solid #C7D2FE",
                borderRadius: 6,
                padding: "10px 12px",
              }}
            >
              {messageEntry.message.subject && (
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#222", marginBottom: 4 }}>
                  [제목] {messageEntry.message.subject}
                </div>
              )}
              <div
                style={{
                  fontSize: 11.5,
                  color: "#333",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                }}
              >
                {messageEntry.message.body}
              </div>
              <div style={{ fontSize: 9.5, color: "#888", marginTop: 6, display: "flex", gap: 8 }}>
                {messageEntry.message.tone && <span>톤: {messageEntry.message.tone}</span>}
                {messageEntry.message.estimatedResponseRate != null && (
                  <span>예상 응답률: {messageEntry.message.estimatedResponseRate}%</span>
                )}
                {messageEntry.estCostUSD != null && (
                  <span style={{ marginLeft: "auto" }}>
                    ${messageEntry.estCostUSD.toFixed(5)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Step 2: 테스트 */}
      <Section title="🧪 Step 2 · 테스트 (Week 2~4)">
        <ActionChecklist
          color="#3B82F6"
          ourSide={[
            "크리에이터 5명 섭외 (검증 결과의 추천 유형 기반)",
            "숏폼 콘셉트 3개 기획 + 크리에이터 브리프 작성",
            "유튜브 쇼핑 제휴 or 스마트스토어 링크 세팅",
            "4주간 판매 데이터 트래킹 시트 준비",
          ]}
          partnerSide={[
            "크리에이터에게 제품 5개 발송",
            "상품 상세 자료 공유 (사진·스펙·USP)",
            "어필리에이트 수수료 비율 합의 (10~15%)",
          ]}
          successCriteria={[
            "크리에이터 콘텐츠당 평균 조회수 5만+ 도달",
            "숏폼 → 구매 전환율 0.2%+ 달성",
            "4주간 추가 판매 50건+ (성공 기준)",
          ]}
          failCriteria={[
            "4주간 추가 판매 10건 미만 → 중단",
            "콘텐츠 평균 조회수 1만 미만 → 콘셉트 재기획",
          ]}
        />
      </Section>

      {/* Step 3: 확장 */}
      <Section title="🚀 Step 3 · 확장 (Month 2~3)">
        <ActionChecklist
          color="#7C3AED"
          ourSide={[
            "RS(수익쉐어) 계약 체결: 매출의 15~20%",
            "크리에이터 10명 → 20명 확대",
            "네이버 쇼핑 라이브 도입 검토",
            "쿠팡 로켓그로스 입점 지원",
            "D2C 자사몰 UX 개선 제안",
          ]}
          partnerSide={[
            "재고 확장 발주 (월 판매량 × 1.5)",
            "패키징 통일 + 브랜드 가이드 정리",
            "CS 응대 체계 확장",
          ]}
          revenue="Pentacle 월 수익 200~400만원 (RS 20%)"
        />
      </Section>

      {/* Step 4: 심화 */}
      <Section title="💎 Step 4 · 심화 (Month 4~6+)">
        <ActionChecklist
          color="#10B981"
          ourSide={[
            "마케팅 투자 모델 전환 (광고비 선투자 + 성과 연동)",
            "제품 라인 확장 공동 기획",
            "지분 투자 검토 (Level 4 진입)",
            "동일 모델로 새 파트너 2~3곳 추가 발굴",
          ]}
          partnerSide={[
            "제품 라인업 2~3 SKU 추가",
            "월 매출 안정화 (변동성 < 20%)",
          ]}
          revenue="Pentacle 월 수익 500~1,000만원 (파트너 1개) / 3,000만원+ (3~5 파트너)"
        />
      </Section>

      {/* 수익 타임라인 차트 */}
      <Section title="📊 12개월 수익 타임라인 (Pentacle 측 추정)">
        <div
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: "10px 8px 4px 0",
          }}
        >
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueTimeline} margin={{ top: 6, right: 14, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#666", fontSize: 9 }}
                interval={0}
              />
              <YAxis tick={{ fill: "#AAA", fontSize: 9 }} tickFormatter={(v) => fmtKRW(v)} />
              <Tooltip
                formatter={(v) => [fmtKRW(v) + "원", "Pentacle 월 수익"]}
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 6,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {revenueTimeline.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p style={{ fontSize: 9.5, color: "#AAA", marginTop: 6, lineHeight: 1.6 }}>
          ※ 검증 시뮬레이션 파라미터(baseMonthlyRevenue / 크리에이터별 조회수 /
          전환율 / 객단가) 기반 추정. 실제 성과는 크리에이터 매칭·콘텐츠 품질에 따라 변동.
        </p>
      </Section>
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

function ActionChecklist({ color, ourSide, partnerSide, successCriteria, failCriteria, revenue }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 4 }}>
            🤝 우리가 할 것
          </div>
          {ourSide.map((item, i) => (
            <ChecklistItem key={i} text={item} />
          ))}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
            🏬 파트너가 할 것
          </div>
          {partnerSide.map((item, i) => (
            <ChecklistItem key={i} text={item} />
          ))}
        </div>
      </div>

      {successCriteria && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", marginBottom: 3 }}>
            ✅ 성공 기준
          </div>
          {successCriteria.map((item, i) => (
            <div key={i} style={{ fontSize: 10.5, color: "#065F46", lineHeight: 1.6 }}>
              · {item}
            </div>
          ))}
        </div>
      )}
      {failCriteria && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", marginBottom: 3 }}>
            ❌ 실패 기준
          </div>
          {failCriteria.map((item, i) => (
            <div key={i} style={{ fontSize: 10.5, color: "#7F1D1D", lineHeight: 1.6 }}>
              · {item}
            </div>
          ))}
        </div>
      )}
      {revenue && (
        <div
          style={{
            marginTop: 8,
            padding: "5px 10px",
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            borderRadius: 5,
            fontSize: 11,
            fontWeight: 700,
            color: "#065F46",
            lineHeight: 1.6,
          }}
        >
          💰 {revenue}
        </div>
      )}
    </div>
  );
}

function ChecklistItem({ text }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        color: "#444",
        lineHeight: 1.7,
        display: "flex",
        gap: 4,
        alignItems: "flex-start",
      }}
    >
      <span style={{ color: "#9CA3AF" }}>☐</span>
      <span style={{ flex: 1 }}>{text}</span>
    </div>
  );
}
