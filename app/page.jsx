"use client";

import { useState } from "react";
import StepProgress from "@/components/StepProgress";
import OpportunityExplore from "@/components/OpportunityExplore";
import OpportunityVerify from "@/components/OpportunityVerify";
import BusinessReview from "@/components/BusinessReview";
import ExecutionPlan from "@/components/ExecutionPlan";
import PartnerDiscovery from "@/components/PartnerDiscovery";
import PartnerVerify from "@/components/PartnerVerify";
import PartnerExecution from "@/components/PartnerExecution";

export default function App() {
  // 메인 모드: product (제품 기회) | partner (파트너 기회)
  const [mode, setMode] = useState("product");

  // 제품 모드 상태
  const [productStep, setProductStep] = useState("explore");
  const [cat, setCat] = useState(null);

  // 파트너 모드 상태
  const [partnerStep, setPartnerStep] = useState("discover");
  const [selectedPartner, setSelectedPartner] = useState(null);

  // 제품 모드 — 카테고리 클릭 시 검증 화면 진입
  function pickAndVerify(c) {
    setCat(c);
    setProductStep("verify");
  }
  function goProductStep(s) {
    if (s !== "explore" && !cat) return;
    setProductStep(s);
  }

  // 파트너 모드 — 발굴 카드 클릭 시 검증 진입
  function pickPartner(p) {
    setSelectedPartner(p);
    setPartnerStep("verify");
  }
  function goPartnerStep(s) {
    if (s !== "discover" && !selectedPartner) return;
    setPartnerStep(s);
  }

  // 모드 전환 시 단계는 처음으로
  function switchMode(m) {
    setMode(m);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8F9FB",
        color: "#333",
        fontFamily: "'Pretendard',-apple-system,sans-serif",
      }}
    >
      {/* 상단 브랜드 바 */}
      <div
        style={{
          borderBottom: "1px solid #E5E7EB",
          padding: "10px 16px",
          background: "#fff",
        }}
      >
        <div
          style={{
            maxWidth: 740,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, background: "#10B981" }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>MARKET SCOUTER</span>
            <span
              style={{
                fontSize: 9,
                color: "#AAA",
                border: "1px solid #E5E7EB",
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              v2.0
            </span>
          </div>

          {/* 메인 모드 탭 */}
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: 2,
              background: "#F3F4F6",
              borderRadius: 8,
            }}
          >
            {[
              { id: "product", l: "📦 제품 기회", desc: "30 카테고리 매트릭스" },
              { id: "partner", l: "🤝 파트너 기회", desc: "RS 협업 발굴" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => switchMode(m.id)}
                style={{
                  padding: "5px 12px",
                  background: mode === m.id ? "#fff" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  color: mode === m.id ? "#111" : "#888",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: mode === m.id ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                }}
                title={m.desc}
              >
                {m.l}
              </button>
            ))}
          </div>

          {/* 우측: 선택 카테고리/파트너 표시 */}
          {mode === "product" && cat && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#999" }}>선택:</span>
              <span style={{ fontSize: 14 }}>{cat.e}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#222" }}>{cat.n}</span>
              <button
                onClick={() => {
                  setCat(null);
                  setProductStep("explore");
                }}
                style={{
                  background: "none",
                  border: "1px solid #E5E7EB",
                  borderRadius: 4,
                  fontSize: 10,
                  color: "#999",
                  padding: "1px 6px",
                  cursor: "pointer",
                }}
                title="선택 해제"
              >
                ✕
              </button>
            </div>
          )}
          {mode === "partner" && selectedPartner && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#999" }}>파트너:</span>
              <span style={{ fontSize: 14 }}>🏬</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#222" }}>
                {(selectedPartner.brandName || selectedPartner.mallName || "").slice(0, 14)}
              </span>
              <button
                onClick={() => {
                  setSelectedPartner(null);
                  setPartnerStep("discover");
                }}
                style={{
                  background: "none",
                  border: "1px solid #E5E7EB",
                  borderRadius: 4,
                  fontSize: 10,
                  color: "#999",
                  padding: "1px 6px",
                  cursor: "pointer",
                }}
                title="선택 해제"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 740, margin: "0 auto", padding: "14px 16px 50px" }}>
        {mode === "product" ? (
          <>
            {/* 제품 기회 퍼널 — 4단계 */}
            <StepProgress
              current={productStep}
              hasCategory={!!cat}
              onChange={goProductStep}
              mode="product"
            />
            {productStep === "explore" && <OpportunityExplore onPick={pickAndVerify} />}
            {productStep === "verify" && (
              <OpportunityVerify
                cat={cat}
                onNext={() => setProductStep("review")}
                onBack={() => setProductStep("explore")}
              />
            )}
            {productStep === "review" && (
              <BusinessReview
                cat={cat}
                onNext={() => setProductStep("plan")}
                onBack={() => setProductStep("verify")}
              />
            )}
            {productStep === "plan" && (
              <ExecutionPlan cat={cat} onBack={() => setProductStep("review")} />
            )}
          </>
        ) : (
          <>
            {/* 파트너 기회 흐름 — 3단계 */}
            <StepProgress
              current={partnerStep}
              hasCategory={!!selectedPartner}
              onChange={goPartnerStep}
              mode="partner"
            />
            {partnerStep === "discover" && (
              <PartnerDiscovery onVerify={pickPartner} />
            )}
            {partnerStep === "verify" && (
              <PartnerVerify
                partner={selectedPartner}
                onNext={() => setPartnerStep("execute")}
                onBack={() => setPartnerStep("discover")}
              />
            )}
            {partnerStep === "execute" && (
              <PartnerExecution
                partner={selectedPartner}
                onBack={() => setPartnerStep("verify")}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
