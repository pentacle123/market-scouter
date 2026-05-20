"use client";

import { useState } from "react";
import KoreaSearchTrend from "./KoreaSearchTrend";
import KoreaShoppingInsight from "./KoreaShoppingInsight";

const TABS = [
  { id: "search", l: "🔍 검색 트렌드", desc: "통합검색어 트렌드 API" },
  { id: "shopping", l: "🛒 쇼핑 인사이트", desc: "쇼핑 인사이트 4종 API" },
];

export default function KoreaScan() {
  const [tab, setTab] = useState("search");
  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        🇰🇷 한국 수요 스캔 (네이버 데이터랩)
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 10 }}>
        검색 트렌드와 쇼핑 인사이트 두 측면에서 한국 시장 수요를 분석합니다
      </p>

      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 12,
          padding: 3,
          background: "#F3F4F6",
          borderRadius: 8,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 6,
              border: "none",
              background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? "#111" : "#888",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s",
            }}
          >
            <div>{t.l}</div>
            <div style={{ fontSize: 9, fontWeight: 500, color: tab === t.id ? "#888" : "#AAA", marginTop: 1 }}>
              {t.desc}
            </div>
          </button>
        ))}
      </div>

      {tab === "search" && <KoreaSearchTrend />}
      {tab === "shopping" && <KoreaShoppingInsight />}
    </div>
  );
}
