"use client";

import { useState } from "react";
import Framework from "@/components/Framework";
import Matrix from "@/components/Matrix";
import Detail from "@/components/Detail";
import GlobalScan from "@/components/GlobalScan";
import KoreaScan from "@/components/KoreaScan";

const NAV = [
  { id: "fw", l: "프레임워크" },
  { id: "mx", l: "매트릭스" },
  { id: "dt", l: "상세 분석" },
  { id: "gs", l: "글로벌 스캔" },
  { id: "kr", l: "한국 수요" },
];

export default function App() {
  const [view, setView] = useState("fw");
  const [cat, setCat] = useState(null);

  function pick(c) {
    setCat(c);
    setView("dt");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", color: "#333", fontFamily: "'Pretendard',-apple-system,sans-serif" }}>
      <div style={{ borderBottom: "1px solid #E5E7EB", padding: "10px 16px", background: "#fff" }}>
        <div style={{ maxWidth: 740, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, background: "#10B981" }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>MARKET SCOUTER</span>
            <span style={{ fontSize: 9, color: "#AAA", border: "1px solid #E5E7EB", borderRadius: 4, padding: "1px 5px" }}>v1.2</span>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {NAV.map(function (n) {
              return (
                <button key={n.id} onClick={function () { setView(n.id); }} style={{ padding: "5px 10px", borderRadius: 6, border: view === n.id ? "1px solid #C7D2FE" : "1px solid transparent", background: view === n.id ? "#EEF2FF" : "transparent", color: view === n.id ? "#4338CA" : "#AAA", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{n.l}</button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "18px 16px 50px" }}>
        {view === "fw" && <Framework onNext={function () { setView("mx"); }} />}
        {view === "mx" && <Matrix onPick={pick} />}
        {view === "dt" && <Detail cat={cat} onBack={function () { setView("mx"); }} />}
        {view === "gs" && <GlobalScan />}
        {view === "kr" && <KoreaScan />}
      </div>
    </div>
  );
}
