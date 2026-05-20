"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { TC, TB, TBR, TL } from "@/lib/data";

const CACHE_KEY = "market-scouter:naver-shopping:v1";

function loadCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveCache(d) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtPct(n) {
  if (n == null) return "—";
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}
function fmtPeriod(p) {
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

// 네이버 데이터랩 분포값의 group 코드 → 한국어 라벨/색상
const GENDER_LABEL = { f: "여성", m: "남성" };
const GENDER_COLOR = { f: "#EC4899", m: "#3B82F6" };
const DEVICE_LABEL = { mo: "모바일", pc: "PC" };
const DEVICE_COLOR = { mo: "#10B981", pc: "#6366F1" };
const AGE_ORDER = ["10", "20", "30", "40", "50", "60"];
const AGE_LABEL = {
  10: "10대",
  20: "20대",
  30: "30대",
  40: "40대",
  50: "50대",
  60: "60대+",
};

function normalizeBreakdown(items, labelMap, colorMap, order) {
  if (!Array.isArray(items) || !items.length) return [];
  // group 코드 정규화
  const map = new Map();
  items.forEach((it) => {
    const key = String(it.group || "").toLowerCase();
    map.set(key, (map.get(key) || 0) + (Number(it.ratio) || 0));
  });
  // 합산이 ~100 이 안 되면 정규화
  const sum = Array.from(map.values()).reduce((a, b) => a + b, 0);
  const scale = sum > 0 ? 100 / sum : 1;
  const keys = order ? order.filter((k) => map.has(k)) : Array.from(map.keys());
  return keys.map((k) => ({
    key: k,
    label: labelMap?.[k] || k,
    color: colorMap?.[k] || "#6366F1",
    ratio: Math.round(map.get(k) * scale * 10) / 10,
  }));
}

export default function KoreaShoppingInsight() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("mapped"); // mapped | bluesignal | all

  useEffect(() => {
    setData(loadCache());
  }, []);

  async function runScan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/naver-shopping", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
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
    if (filter === "mapped") return data.results.filter((r) => r.hasCid);
    if (filter === "bluesignal") return data.results.filter((r) => !r.hasCid);
    return data.results;
  }, [data, filter]);

  return (
    <div>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        쇼핑 클릭량 추이 + 성별/연령/기기 분포 · 매핑이 없는 카테고리는
        "네이버 쇼핑에 전용 카테고리 미형성 = 블루오션 추가 증거"로 해석
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
                <span style={{ color: "#999" }}>매핑</span> {data.mappedCount}개{" · "}
                <span style={{ color: "#999" }}>블루오션 신호</span>{" "}
                <span style={{ fontWeight: 700, color: "#3B82F6" }}>{data.blueOceanSignalCount}개</span>
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
                매핑된 11개 카테고리에 대해 시계열 + 성별/연령/기기 분포를 가져옵니다.
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
              : "linear-gradient(135deg,#3B82F6,#6366F1)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            minWidth: 130,
          }}
        >
          {loading ? "스캔 중…" : data ? "다시 스캔" : "쇼핑 인사이트 스캔"}
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
        </div>
      )}

      {data && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { id: "mapped", l: `🛒 매핑됨 (${data.mappedCount})`, c: "#3B82F6" },
              { id: "bluesignal", l: `🌊 블루오션 신호 (${data.blueOceanSignalCount})`, c: "#0EA5E9" },
              { id: "all", l: `전체 (${data.results.length})`, c: "#4338CA" },
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

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((r) =>
              r.hasCid ? (
                <MappedCard key={r.id} r={r} />
              ) : (
                <BlueOceanSignalCard key={r.id} r={r} />
              )
            )}
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
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
                일부 호출 실패 ({data.errors.length}건)
              </div>
              {data.errors.map((er, i) => (
                <div key={i} style={{ fontSize: 10.5, color: "#78350F" }}>
                  · {er.scope}{er.id ? ` (id ${er.id})` : ""}: {String(er.error).slice(0, 140)}
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: 10, color: "#AAA", marginTop: 14, lineHeight: 1.6 }}>
            ※ 현재 매핑은 안정적인 네이버 쇼핑 최상위 10대 카테고리(50000000~50000009)만 사용합니다.
            특정 제품 단위 sub-cid는 datalab.naver.com/shoppingInsight 에서 직접 확인 후 정제 권장.
            <br />
            ※ 전월 대비 계산은 부분월 제외(검색 트렌드와 동일).
          </p>
        </>
      )}
    </div>
  );
}

// ── 매핑된 카테고리 카드 ─────────────────────────────────────────────────────
function MappedCard({ r }) {
  const hasData = r.hasData;
  const gender = normalizeBreakdown(r.breakdown?.gender, GENDER_LABEL, GENDER_COLOR);
  const age = normalizeBreakdown(r.breakdown?.age, AGE_LABEL, null, AGE_ORDER);
  const device = normalizeBreakdown(r.breakdown?.device, DEVICE_LABEL, DEVICE_COLOR);

  const bg = !hasData ? "#F9FAFB" : r.isRising ? "#ECFDF5" : r.isFalling ? "#FEF2F2" : "#fff";
  const border = !hasData
    ? "1px solid #E5E7EB"
    : r.isRising
      ? "1px solid #A7F3D0"
      : r.isFalling
        ? "1px solid #FECACA"
        : "1px solid #E5E7EB";

  return (
    <div style={{ padding: "12px 14px", background: bg, border, borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{r.e}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{r.n}</div>
          <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>
            cid {r.naverCid} · {r.mk}
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
          marginBottom: 8,
        }}
      >
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 6, padding: "4px 0 0" }}>
          {hasData ? (
            <ResponsiveContainer width="100%" height={70}>
              <LineChart data={r.data} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" />
                <XAxis
                  dataKey="period"
                  tick={{ fill: "#AAA", fontSize: 8 }}
                  tickFormatter={fmtPeriod}
                  interval={1}
                />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  labelFormatter={(p) => fmtPeriod(p)}
                  formatter={(v) => [v + " (상대값)", "클릭량"]}
                  contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="ratio"
                  stroke={r.isRising ? "#059669" : r.isFalling ? "#DC2626" : "#3B82F6"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ fontSize: 10, color: "#AAA", textAlign: "center", padding: "20px 0" }}>
              시계열 데이터 없음
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
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
            color="#3B82F6"
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.4fr 1fr",
          gap: 6,
        }}
      >
        <BreakdownChart title="성별" rows={gender} />
        <BreakdownChart title="연령" rows={age} />
        <BreakdownChart title="기기" rows={device} />
      </div>
    </div>
  );
}

// ── 블루오션 신호 카드 (cid 매핑 없음) ───────────────────────────────────────
function BlueOceanSignalCard({ r }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "#EFF6FF",
        border: "1px dashed #93C5FD",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{r.e}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>{r.n}</div>
          <div style={{ fontSize: 10, color: "#3B82F6", marginTop: 1 }}>{r.mk}</div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#fff",
            background: "#3B82F6",
            borderRadius: 99,
            padding: "3px 10px",
          }}
        >
          🌊 블루오션 신호
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#1E3A8A",
          lineHeight: 1.6,
          background: "#fff",
          padding: "8px 10px",
          border: "1px solid #BFDBFE",
          borderRadius: 6,
        }}
      >
        <b>네이버 쇼핑에 전용 카테고리가 형성되지 않은 카테고리입니다.</b>{" "}
        쇼핑인사이트로 추적할 sub-cid 자체가 없다는 것은, 시장 자체가 아직 충분히
        성숙하지 않아 분류 체계 안에 자리잡지 못했다는 신호입니다. YouTube 글로벌
        스캔 + 검색 트렌드 결과와 교차 검증하면 블루오션 가설의 추가 근거가 됩니다.
      </div>
    </div>
  );
}

function BreakdownChart({ title, rows }) {
  if (!rows?.length) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          padding: "6px 8px",
        }}
      >
        <div style={{ fontSize: 9.5, color: "#AAA", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 10, color: "#BBB", textAlign: "center", padding: "6px 0" }}>
          데이터 없음
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 6,
        padding: "4px 6px 2px",
      }}
    >
      <div style={{ fontSize: 9.5, color: "#777", marginBottom: 2, fontWeight: 600 }}>{title}</div>
      <ResponsiveContainer width="100%" height={60}>
        <BarChart data={rows} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#666", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip
            formatter={(v) => [v + "%", "비율"]}
            contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 11 }}
          />
          <Bar dataKey="ratio" radius={[3, 3, 0, 0]}>
            {rows.map((row, i) => (
              <Cell key={i} fill={row.color || "#6366F1"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Metric({ label, value, sub, color, big }) {
  return (
    <div style={{ padding: "6px 9px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 6 }}>
      <div style={{ fontSize: 9, color: "#AAA" }}>{label}</div>
      <div style={{ fontSize: big ? 14 : 13, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#888", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
