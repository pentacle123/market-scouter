"use client";

import { useState } from "react";

// 브랜드 발굴 5단계 파이프라인 — Phase A 껍데기.
// 각 Step 실제 구현은 Phase C 에서 진행. 지금은 헤더 + placeholder 만.

const STEPS = [
  { id: 1, l: "카테고리 유니버스", desc: "15개에서 선택" },
  { id: 2, l: "후보 수집", desc: "쇼핑검색 + 필터" },
  { id: 3, l: "병목 정량 검증", desc: "YT · 블로그 · 쇼츠" },
  { id: 4, l: "검색 갭 (인지)", desc: "DataLab 상대비율" },
  { id: 5, l: "스코어링 · 브리프", desc: "4축 + 컨택" },
];

export default function BrandFinder() {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        🏷️ 브랜드 발굴 — 5단계 파이프라인
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        스코어링된 15개 카테고리에서 좋은 제품 + 마케팅 병목 브랜드를 수치 3종으로 검증하고
        4축 점수 + 컨택 브리프까지 자동화
      </p>

      {/* 5단계 진행 헤더 */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: "10px 12px",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          {STEPS.map((s, i) => {
            const isCurrent = s.id === currentStep;
            const isDone = s.id < currentStep;
            const isLast = i === STEPS.length - 1;
            const color = isCurrent
              ? "#6366F1"
              : isDone
                ? "#10B981"
                : "#D1D5DB";
            const bg = isCurrent
              ? "#EEF2FF"
              : isDone
                ? "#F0FDF4"
                : "#fff";
            return (
              <StepChip
                key={s.id}
                num={s.id}
                label={s.l}
                desc={s.desc}
                color={color}
                bg={bg}
                isDone={isDone}
                isLast={isLast}
                onClick={() => setCurrentStep(s.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Placeholder — Phase C 에서 실제 컴포넌트로 교체 */}
      <div
        style={{
          padding: "24px 20px",
          background: "linear-gradient(135deg,#FAFBFF,#F0F4FF)",
          border: "1px dashed #C7D2FE",
          borderRadius: 10,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>🚧</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#4338CA", marginBottom: 4 }}>
          Step {currentStep} · {STEPS.find((s) => s.id === currentStep)?.l}
        </div>
        <div style={{ fontSize: 11, color: "#6366F1", lineHeight: 1.6 }}>
          Phase A 껍데기 — 각 Step 실제 UI 는 Phase C 에서 구현.
          <br />
          현재 배관(API 라우트 · lib · Vercel 프리뷰) 검증 단계입니다.
        </div>
        <div style={{ fontSize: 10, color: "#888", marginTop: 8, lineHeight: 1.6 }}>
          Phase B 완료 항목: <b>/api/brand-candidates</b> 라우트 · <b>lib/api/naver-brand-gap.js</b> ·{" "}
          <b>lib/api/naver-search-ad.js</b> (스켈레톤) · <b>lib/api/claude-brand.js</b>
        </div>
      </div>

      <p style={{ fontSize: 9.5, color: "#AAA", marginTop: 12, lineHeight: 1.6 }}>
        ※ 기존 [📦 제품 기회] · [🤝 파트너 기회] 탭은 완전 그대로 유지됩니다. 이 탭은 병렬 신규
        메뉴이며, 검증 완료 후 main 머지 여부는 사용자가 결정합니다.
      </p>
    </div>
  );
}

function StepChip({ num, label, desc, color, bg, isDone, isLast, onClick }) {
  return (
    <>
      <div
        onClick={onClick}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 7px",
          background: bg,
          border: `1px solid ${color}`,
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 99,
            background: color,
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isDone ? "✓" : num}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: color,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 8.5,
              color: "#999",
              lineHeight: 1.2,
              marginTop: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {desc}
          </div>
        </div>
      </div>
      {!isLast && (
        <div style={{ color: "#D1D5DB", fontSize: 12, margin: "0 -1px", userSelect: "none" }}>
          ›
        </div>
      )}
    </>
  );
}
