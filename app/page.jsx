"use client";

import { useState } from "react";
import StepProgress from "@/components/StepProgress";
import OpportunityExplore from "@/components/OpportunityExplore";
import OpportunityVerify from "@/components/OpportunityVerify";
import BusinessReview from "@/components/BusinessReview";
import ExecutionPlan from "@/components/ExecutionPlan";

export default function App() {
  // 의사결정 퍼널 단계: explore → verify → review → plan
  const [step, setStep] = useState("explore");
  const [cat, setCat] = useState(null);

  // 화면 1에서 카테고리 클릭 시: 카테고리 저장 + 검증 화면 진입
  function pickAndVerify(c) {
    setCat(c);
    setStep("verify");
  }

  // 헤더 네비 클릭: 카테고리 없으면 1단계만 허용 (StepProgress 가 잠금 처리)
  function goStep(s) {
    if (s !== "explore" && !cat) return;
    setStep(s);
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
          {cat && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#999" }}>선택:</span>
              <span style={{ fontSize: 14 }}>{cat.e}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#222" }}>{cat.n}</span>
              <button
                onClick={() => {
                  setCat(null);
                  setStep("explore");
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
        {/* 퍼널 진행 헤더 */}
        <StepProgress current={step} hasCategory={!!cat} onChange={goStep} />

        {/* 화면 렌더링 */}
        {step === "explore" && <OpportunityExplore onPick={pickAndVerify} />}
        {step === "verify" && (
          <OpportunityVerify
            cat={cat}
            onNext={() => setStep("review")}
            onBack={() => setStep("explore")}
          />
        )}
        {step === "review" && (
          <BusinessReview
            cat={cat}
            onNext={() => setStep("plan")}
            onBack={() => setStep("verify")}
          />
        )}
        {step === "plan" && (
          <ExecutionPlan cat={cat} onBack={() => setStep("review")} />
        )}
      </div>
    </div>
  );
}
