"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TC, TB, TBR, TL } from "@/lib/data";

const CACHE_KEY = "market-scouter:naver-trend:v1";

function loadCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCache(data) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtPct(n) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtPeriod(p) {
  // 데이터랩 month timeUnit 응답은 "YYYY-MM-01" 형태
  if (!p) return "";
  const [y, m] = p.split("-");
  return `${y.slice(2)}.${m}`;
}

function deltaColor(d, hasData) {
  if (!hasData) return "#AAA";
  if (d == null) return "#888";
  if (d >= 20) return "#059669";
  if (d <= -20) return "#DC2626";
  return "#6B7280";
}

export default function KoreaScan() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all | rising | falling

  useEffect(() => {
    setData(loadCache());
  }, []);

  async function runScan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/naver-trend", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setData(json);
      saveCache(json);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!data?.results) return [];
    if (filter === "rising") return data.results.filter((r) => r.isRising);
    if (filter === "falling") return data.results.filter((r) => r.isFalling);
    return data.results;
  }, [data, filter]);

  const risingCount = data?.results?.filter((r) => r.isRising).length || 0;
  const fallingCount = data?.results?.filter((r) => r.isFalling).length || 0;

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        🇰🇷 한국 수요 스캔 (네이버 데이터랩)
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        통합검색어 트렌드 · 최근 12개월 검색량 추이 · 전월 대비 ±20% 이상 자동
        하이라이트
      </p>

      <div
        style={{
          padding: "12px 14px",
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 10,
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>
          {data ? (
            <>
              <div>
                <span style={{ color: "#999" }}>마지막 스캔:</span>{" "}
                <span style={{ fontWeight: 700, color: "#222" }}>
                  {fmtDateTime(data.scannedAt)}
                </span>
              </div>
              <div style={{ marginTop: 2 }}>
                <span style={{ color: "#999" }}>기간</span> {data.startDate} ~ {data.endDate}
                {" · "}
                <span style={{ color: "#999" }}>배치</span> {data.batches}회 호출
                {data.errors?.length > 0 && (
                  <span style={{ color: "#EF4444", marginLeft: 6 }}>
                    · 실패 {data.errors.length}건
                  </span>
                )}
              </div>
            </>
          ) : (
            <div>
              아직 스캔하지 않았습니다. <br />
              <span style={{ color: "#999" }}>
                네이버 데이터랩은 1요청당 최대 5개 그룹 → 17 카테고리 = 4배치 호출.
              </span>
            </div>
          )}
        </div>
        <button
          onClick={runScan}
          disabled={loading}
          style={{
            padding: "9px 18px",
            background: loading
              ? "#C7D2FE"
              : "linear-gradient(135deg,#10B981,#059669)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            minWidth: 130,
          }}
        >
          {loading ? "스캔 중…" : data ? "다시 스캔" : "한국 수요 스캔 시작"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 12,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
            fontSize: 11.5,
            color: "#B91C1C",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 3 }}>스캔 실패</div>
          {error}
          {error.includes("NAVER_CLIENT") && (
            <div style={{ marginTop: 6, color: "#7F1D1D" }}>
              네이버 개발자센터(https://developers.naver.com/apps) 에서 애플리케이션
              등록 → "데이터랩(검색어 트렌드)" 사용 API 추가 → Client ID/Secret 발급.
              <br />
              운영: Vercel Project → Settings → Environment Variables 에{" "}
              <code>NAVER_CLIENT_ID</code>, <code>NAVER_CLIENT_SECRET</code> 추가 후
              재배포.
            </div>
          )}
        </div>
      )}

      {data && (
        <>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            {[
              { id: "all", l: `전체 (${data.results.length})`, c: "#4338CA" },
              { id: "rising", l: `📈 급상승 (${risingCount})`, c: "#059669" },
              { id: "falling", l: `📉 하락 (${fallingCount})`, c: "#DC2626" },
            ].map((b) => (
              <button
                key={b.id}
                onClick={() => setFilter(b.id)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 99,
                  border: filter === b.id ? "1px solid " + b.c : "1px solid #E5E7EB",
                  background: filter === b.id ? "#fff" : "#F9FAFB",
                  color: filter === b.id ? b.c : "#888",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {b.l}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((r) => {
              const hasData = r.hasData;
              const bg = !hasData
                ? "#F9FAFB"
                : r.isRising
                  ? "#ECFDF5"
                  : r.isFalling
                    ? "#FEF2F2"
                    : "#fff";
              const border = !hasData
                ? "1px solid #E5E7EB"
                : r.isRising
                  ? "1px solid #A7F3D0"
                  : r.isFalling
                    ? "1px solid #FECACA"
                    : "1px solid #E5E7EB";
              return (
                <div
                  key={r.id}
                  style={{
                    padding: "10px 12px",
                    background: bg,
                    border,
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{r.e}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#222" }}>
                        {r.n}
                      </div>
                      <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>
                        검색어 "{r.keyword}" · {r.mk}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: TC[r.type],
                        background: TB[r.type],
                        border: "1px solid " + TBR[r.type],
                        borderRadius: 99,
                        padding: "2px 7px",
                      }}
                    >
                      {TL[r.type]}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.6fr 1fr",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        background: "#fff",
                        borderRadius: 6,
                        border: "1px solid #E5E7EB",
                        padding: "4px 0 0",
                      }}
                    >
                      {hasData ? (
                        <ResponsiveContainer width="100%" height={70}>
                          <LineChart
                            data={r.data}
                            margin={{ top: 4, right: 6, bottom: 0, left: 0 }}
                          >
                            <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" />
                            <XAxis
                              dataKey="period"
                              tick={{ fill: "#AAA", fontSize: 8 }}
                              tickFormatter={fmtPeriod}
                              interval={1}
                            />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip
                              labelFormatter={(p) => fmtPeriod(p)}
                              formatter={(v) => [v + " (상대값)", "검색량"]}
                              contentStyle={{
                                background: "#fff",
                                border: "1px solid #E5E7EB",
                                borderRadius: 6,
                                fontSize: 11,
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="ratio"
                              stroke={
                                r.isRising
                                  ? "#059669"
                                  : r.isFalling
                                    ? "#DC2626"
                                    : "#6366F1"
                              }
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div
                          style={{
                            fontSize: 10,
                            color: "#AAA",
                            textAlign: "center",
                            padding: "20px 0",
                          }}
                        >
                          데이터 없음
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 4,
                      }}
                    >
                      <Metric
                        label="전월 대비"
                        value={fmtPct(r.mom.deltaPct)}
                        color={deltaColor(r.mom.deltaPct, hasData)}
                        sub={
                          r.mom.periodLast && r.mom.periodPrev
                            ? `${fmtPeriod(r.mom.periodPrev)} → ${fmtPeriod(r.mom.periodLast)}${r.mom.excludedPartial ? " · 부분월 제외" : ""}`
                            : ""
                        }
                        big
                      />
                      <Metric
                        label="12개월 평균"
                        value={hasData ? r.avgRatio.toFixed(1) : "—"}
                        sub={hasData ? `피크 ${r.peakRatio}` : ""}
                        color="#4338CA"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {data.errors?.length > 0 && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#92400E",
                  marginBottom: 4,
                }}
              >
                일부 배치 실패 ({data.errors.length}건)
              </div>
              {data.errors.map((er, i) => (
                <div key={i} style={{ fontSize: 10.5, color: "#78350F" }}>
                  · IDs [{er.ids.join(", ")}]: {er.error.slice(0, 140)}
                </div>
              ))}
            </div>
          )}

          <p
            style={{
              fontSize: 10,
              color: "#AAA",
              marginTop: 14,
              lineHeight: 1.6,
            }}
          >
            ※ 네이버 데이터랩의 ratio 는 요청 내 최대값을 100으로 환산한 상대값입니다.
            카테고리 간 직접 비교보다는 각 카테고리의 시간 추이와 전월 대비 증감률에
            의미를 두세요.
            <br />
            ※ 전월 대비 계산은 진행중인 부분 월을 제외하고 직전 완료월 기준으로 비교합니다
            (19일치 vs 30일치 같은 측정 편향 방지).
          </p>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, sub, color, big }) {
  return (
    <div
      style={{
        padding: "6px 9px",
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 9, color: "#AAA" }}>{label}</div>
      <div style={{ fontSize: big ? 14 : 13, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#888", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
