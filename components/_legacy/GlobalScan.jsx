"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TC, TB, TBR, TL } from "@/lib/data";

const CACHE_KEY = "market-scouter:youtube-scan:v1";

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
    /* quota exceeded — silently ignore */
  }
}

function fmtNum(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function GlobalScan() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [onlyBlue, setOnlyBlue] = useState(false);

  useEffect(() => {
    setData(loadCache());
  }, []);

  async function runScan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube-scan", { cache: "no-store" });
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
    return onlyBlue ? data.results.filter((r) => r.isBlueOcean) : data.results;
  }, [data, onlyBlue]);

  const chartData = useMemo(
    () =>
      filtered.slice(0, 12).map((r) => ({
        name: `${r.e} ${r.n.length > 10 ? r.n.slice(0, 10) + "…" : r.n}`,
        US: r.US.videoCount,
        KR: r.KR.videoCount,
        id: r.id,
        blue: r.isBlueOcean,
      })),
    [filtered]
  );

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        🌍 글로벌 스캔 (US vs KR)
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        YouTube Data API v3 · 최근 30일 쇼츠 검색량/조회수 비교 · 미국 ≫ 한국 = 블루오션 자동 표시
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
                <span style={{ color: "#999" }}>카테고리</span> {data.results.length}개 ·{" "}
                <span style={{ color: "#999" }}>사용 쿼터</span>{" "}
                <span style={{ fontWeight: 700, color: "#4338CA" }}>
                  {data.quotaUsed}
                </span>
                /{data.quotaDailyFree} units
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
                1회 스캔당 ~3,400 units 소모 (무료 한도의 약 34%).
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
              : "linear-gradient(135deg,#4F46E5,#6366F1)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            minWidth: 130,
          }}
        >
          {loading ? "스캔 중…" : data ? "다시 스캔" : "글로벌 스캔 시작"}
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
          {error.includes("YOUTUBE_API_KEY") && (
            <div style={{ marginTop: 6, color: "#7F1D1D" }}>
              로컬: 프로젝트 루트에 <code>.env.local</code> 생성 후{" "}
              <code>YOUTUBE_API_KEY=...</code> 추가, <code>npm run dev</code> 재시작.
              <br />
              운영: Vercel Project Settings → Environment Variables 에 추가 후
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
              gap: 8,
              alignItems: "center",
              marginBottom: 10,
              fontSize: 11.5,
              color: "#555",
            }}
          >
            <label
              style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={onlyBlue}
                onChange={(e) => setOnlyBlue(e.target.checked)}
              />
              블루오션만 보기 (
              {data.results.filter((r) => r.isBlueOcean).length}개)
            </label>
          </div>

          {chartData.length > 0 && (
            <div
              style={{
                background: "#fff",
                borderRadius: 10,
                padding: "12px 8px 4px 0",
                border: "1px solid #E5E7EB",
                marginBottom: 14,
              }}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 16, bottom: 60, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#666", fontSize: 9 }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fill: "#AAA", fontSize: 10 }} />
                  <Tooltip
                    formatter={(v) => fmtNum(v)}
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="US" fill="#3B82F6" name="🇺🇸 US 쇼츠" />
                  <Bar dataKey="KR" fill="#EF4444" name="🇰🇷 KR 쇼츠" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: "10px 12px",
                  background: r.isBlueOcean ? "#EFF6FF" : "#fff",
                  border: r.isBlueOcean ? "1px solid #BFDBFE" : "1px solid #E5E7EB",
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
                      🇺🇸 "{r.kw.US}" · 🇰🇷 "{r.kw.KR}"
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
                  {r.isBlueOcean && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#fff",
                        background: "#3B82F6",
                        borderRadius: 99,
                        padding: "2px 8px",
                      }}
                    >
                      🌊 블루오션
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 6,
                    fontSize: 11,
                  }}
                >
                  <Metric
                    label="🇺🇸 영상 수"
                    value={fmtNum(r.US.videoCount)}
                    sub={`평균 ${fmtNum(r.US.avgViews)}회`}
                    color="#3B82F6"
                  />
                  <Metric
                    label="🇰🇷 영상 수"
                    value={fmtNum(r.KR.videoCount)}
                    sub={`평균 ${fmtNum(r.KR.avgViews)}회`}
                    color="#EF4444"
                  />
                  <Metric
                    label="US/KR 비율"
                    value={r.ratio >= 100 ? "100+" : r.ratio.toFixed(1) + "x"}
                    sub={
                      r.isBlueOcean
                        ? "선행 신호 강함"
                        : r.US.videoCount < 50
                          ? "US 표본 부족"
                          : "한국도 활성"
                    }
                    color={r.isBlueOcean ? "#3B82F6" : "#888"}
                  />
                </div>
              </div>
            ))}
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
                일부 카테고리 스캔 실패 ({data.errors.length}건)
              </div>
              {data.errors.map((er, i) => (
                <div key={i} style={{ fontSize: 10.5, color: "#78350F" }}>
                  · {er.n}: {er.error.slice(0, 120)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ label, value, sub, color }) {
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
      <div style={{ fontSize: 13, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 9, color: "#888", marginTop: 1 }}>{sub}</div>
    </div>
  );
}
