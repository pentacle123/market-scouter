"use client";

import { LAYER_NAMES, LAYER_DESC, LAYER_ICONS, LAYER_COLORS } from "@/lib/data";

export default function Framework({ onNext }) {
  return (
    <div>
      <div style={{ textAlign: "center", padding: "28px 0 20px" }}>
        <div style={{ fontSize: 11, color: "#6366F1", fontWeight: 700, letterSpacing: "0.15em", marginBottom: 6 }}>MARKET SCOUTER</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111", margin: "0 0 8px" }}>제품 기회 발견 엔진</h1>
        <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>6개 데이터 레이어의 신호를 종합 분석하여<br />마케팅으로 승부할 수 있는 제품 기회를 발견합니다</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {LAYER_NAMES.map(function (nm, i) {
          return (
            <div key={i} style={{ padding: "12px 14px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <span style={{ fontSize: 18 }}>{LAYER_ICONS[i]}</span>
                <div>
                  <div style={{ fontSize: 9, color: LAYER_COLORS[i], fontWeight: 700 }}>LAYER {i + 1}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#222" }}>{nm}</div>
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{LAYER_DESC[i]}</div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "14px 18px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#4338CA", marginBottom: 6 }}>기회 분류 기준</div>
        <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.8 }}>
          <span style={{ color: "#3B82F6", fontWeight: 700 }}>🔵 블루오션</span> — 한국 플레이어 0개. 우리가 첫 번째가 될 수 있는 시장<br />
          <span style={{ color: "#F59E0B", fontWeight: 700 }}>🟡 틈새 기회</span> — 시장은 있지만 빈 가격대/세그먼트 존재<br />
          <span style={{ color: "#F97316", fontWeight: 700 }}>⚠️ 조건부</span> — 기회는 있으나 경쟁/리스크 존재<br />
          <span style={{ color: "#EF4444", fontWeight: 700 }}>❌ 비추천</span> — 레드오션 · 대기업 장벽 · 시장 축소
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <button onClick={onNext} style={{ padding: "11px 28px", background: "linear-gradient(135deg,#4F46E5,#6366F1)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>기회 매트릭스 보기 →</button>
      </div>
    </div>
  );
}
