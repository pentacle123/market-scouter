"use client";

import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { D, LAYER_KEYS, calcXY, calcT, sig, TL, TC, TB, TBR } from "@/lib/data";

export default function Matrix({ onPick }) {
  const items = useMemo(function () {
    return D.map(function (c) {
      const p = calcXY(c);
      return Object.assign({}, c, p, { total: calcT(c) });
    }).sort(function (a, b) {
      return b.total - a.total;
    });
  }, []);
  const chartData = items.map(function (c) {
    return { x: c.x, y: c.y, name: c.n, emoji: c.e, total: c.total, id: c.id, type: c.type };
  });

  function renderGroup(type) {
    const list = items.filter(function (c) {
      return c.type === type;
    });
    if (!list.length) return null;
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: TC[type], margin: "14px 0 6px" }}>{TL[type]} ({list.length})</div>
        {list.map(function (c) {
          const sigs = LAYER_KEYS.map(function (k) {
            return sig(c[k]);
          });
          return (
            <div key={c.id} onClick={function () { onPick(c); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", marginBottom: 4, background: TB[c.type], border: "1px solid " + TBR[c.type], borderRadius: 8, cursor: "pointer" }}>
              <span style={{ fontWeight: 900, color: TC[c.type], width: 26, fontSize: 13 }}>{c.total}</span>
              <span style={{ fontSize: 16 }}>{c.e}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#222" }}>{c.n}</div>
                <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>{c.mk}</div>
              </div>
              <span style={{ fontSize: 9.5, letterSpacing: 1 }}>{sigs.map(function (s) { return s.l; }).join("")}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>기회 매트릭스</h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>X: 시장 매력도 · Y: 실행 가능성 · 클릭 시 상세 분석</p>
      <div style={{ background: "#fff", borderRadius: 10, padding: "12px 4px 0 0", border: "1px solid #E5E7EB", marginBottom: 14 }}>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 16, bottom: 12, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis type="number" dataKey="x" domain={[50, 100]} tick={{ fill: "#AAA", fontSize: 10 }} label={{ value: "시장 매력도 →", position: "bottom", fill: "#999", fontSize: 10, offset: -2 }} />
            <YAxis type="number" dataKey="y" domain={[40, 100]} tick={{ fill: "#AAA", fontSize: 10 }} label={{ value: "실행 가능성 →", angle: -90, position: "left", fill: "#999", fontSize: 10 }} />
            <Tooltip content={function (props) {
              const p = props.payload && props.payload[0] && props.payload[0].payload;
              if (!p) return null;
              return (
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 11, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                  <div style={{ fontWeight: 700, color: "#222" }}>{p.emoji} {p.name}</div>
                  <div style={{ color: "#999", marginTop: 3 }}>매력도 {p.x} · 실행 {p.y} · {TL[p.type]}</div>
                </div>
              );
            }} />
            <Scatter data={chartData} onClick={function (data) {
              const f = D.find(function (c) { return c.id === data.id; });
              if (f) onPick(f);
            }}>
              {chartData.map(function (en) {
                return <Cell key={en.id} fill={TC[en.type]} fillOpacity={0.8} stroke={TC[en.type]} r={7} style={{ cursor: "pointer" }} />;
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {renderGroup("blue")}
      {renderGroup("gap")}
      {renderGroup("cond")}
      {renderGroup("no")}
    </div>
  );
}
