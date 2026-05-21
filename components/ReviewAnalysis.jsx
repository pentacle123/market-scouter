"use client";

import { useEffect, useState } from "react";
import {
  loadReviewsMap,
  getReviewForId,
  setReviewForId,
} from "@/lib/ai-cache";

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function severityColor(s) {
  if (s == null) return "#9CA3AF";
  if (s >= 80) return "#DC2626";
  if (s >= 60) return "#F59E0B";
  if (s >= 40) return "#D97706";
  return "#6B7280";
}

/**
 * 리뷰 분석 패널.
 * @param {object} props
 * @param {object} props.cat — 카테고리
 * @param {function} [props.onChange] — 결과가 변할 때마다 호출 (BusinessReview 동기화용)
 * @param {"compact"|"full"} [props.layout="full"]
 */
export default function ReviewAnalysis({ cat, onChange, layout = "full" }) {
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [includeUS, setIncludeUS] = useState(false);

  useEffect(() => {
    if (!cat) return;
    const e = getReviewForId(loadReviewsMap(), cat.id);
    setEntry(e);
    setError(null);
  }, [cat?.id]);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      // 커스텀 카테고리(1000+)는 query 로 카테고리 정보 동봉
      let url = `/api/review-analysis?categoryId=${cat.id}${includeUS ? "&includeUS=true" : ""}`;
      if (cat.id >= 1000) {
        const params = new URLSearchParams({
          n: cat.n || "",
          kwKR: cat.kw?.KR || "",
          kwUS: cat.kw?.US || "",
          type: cat.type || "blue",
        });
        url += `&${params.toString()}`;
      }
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setReviewForId(cat.id, json);
      setEntry({ ...json, cachedAt: new Date().toISOString() });
      if (onChange) onChange(json);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!cat) return null;

  return (
    <div>
      {/* 트리거 / 메타 */}
      <div
        style={{
          padding: "8px 10px",
          background: entry ? "#fff" : "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, fontSize: 11, color: "#555", lineHeight: 1.5 }}>
          {entry ? (
            <>
              <div>
                <span style={{ color: "#999" }}>마지막 분석</span>{" "}
                <b style={{ color: "#222" }}>{fmtDateTime(entry.cachedAt || entry.scannedAt)}</b>
                {" · "}
                <span style={{ color: "#999" }}>리뷰</span>{" "}
                <b>{entry.blogCount}</b>건
                {entry.isSubstitute && (
                  <span style={{ color: "#9A3412", marginLeft: 4 }}>
                    · 대체재 "{entry.substituteName}"
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                Claude ${(entry.claude?.estCostUSD || 0).toFixed(4)}
                {entry.youtube?.enabled && (
                  <> · US YouTube {entry.youtube.videoCount}건 · +{entry.youtube.quotaUsed} units</>
                )}
              </div>
            </>
          ) : (
            <div>
              <span style={{ color: "#9A3412", fontWeight: 700 }}>📝 리뷰 분석</span>{" "}
              <span style={{ color: "#666" }}>
                네이버 블로그 30건 + Claude 분석 = <b>네이버 무료 + ~$0.01 Claude</b>
              </span>
              {cat.type === "blue" && (
                <div style={{ fontSize: 10, color: "#9A3412", marginTop: 2 }}>
                  ⚠️ 블루오션 — 대체재 리뷰로 분석 (한국에 신제품 직접 리뷰 부재)
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 9.5,
              color: "#666",
              cursor: "pointer",
            }}
            title="추가 ~100 YouTube units 사용"
          >
            <input
              type="checkbox"
              checked={includeUS}
              onChange={(e) => setIncludeUS(e.target.checked)}
              style={{ margin: 0 }}
            />
            US YouTube 추가
          </label>
          <button
            onClick={run}
            disabled={loading}
            style={{
              padding: "5px 12px",
              background: loading
                ? "#FED7AA"
                : "linear-gradient(135deg,#F97316,#DC2626)",
              border: "none",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 6,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "분석 중…" : entry ? "🔄 재분석" : "📝 리뷰 분석"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "7px 10px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            fontSize: 10.5,
            color: "#B91C1C",
            lineHeight: 1.6,
            marginBottom: 6,
          }}
        >
          {error}
        </div>
      )}

      {entry?.analysis && <ReviewResultPanel entry={entry} layout={layout} />}
    </div>
  );
}

function ReviewResultPanel({ entry, layout }) {
  const a = entry.analysis;
  if (!a) return null;

  return (
    <div>
      {/* 종합 인사이트 */}
      {a.insight && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 6,
            background: "linear-gradient(135deg,#FFF7ED,#FEF2F2)",
            border: "1px solid #FED7AA",
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: "#9A3412" }}>💡 종합 인사이트</span>
            {a.negativeRatio != null && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fff",
                  background: severityColor(a.negativeRatio),
                  borderRadius: 99,
                  padding: "1px 8px",
                }}
              >
                부정 의견 {a.negativeRatio}%
              </span>
            )}
            {entry.isSubstitute && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#7C2D12",
                  background: "#fff",
                  border: "1px solid #FDBA74",
                  borderRadius: 99,
                  padding: "1px 8px",
                }}
                title={`한국에 신제품 직접 리뷰가 없어 대체재 "${entry.substituteName}" 리뷰로 분석`}
              >
                대체재 분석
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: "#7C2D12", lineHeight: 1.7 }}>{a.insight}</div>
        </div>
      )}

      {/* 불만 TOP 5 */}
      {Array.isArray(a.complaints) && a.complaints.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9A3412", marginBottom: 4 }}>
            🔴 소비자 불만 TOP {a.complaints.length}
          </div>
          {a.complaints.map((c, i) => (
            <ComplaintCard key={i} complaint={c} layout={layout} />
          ))}
        </div>
      )}

      {/* 긍정 TOP 3 */}
      {Array.isArray(a.positives) && a.positives.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", marginBottom: 4 }}>
            🟢 긍정 의견 — 경쟁사가 잘하는 점 (우리도 유지해야 할 점)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {a.positives.map((p, i) => (
              <span
                key={i}
                style={{
                  padding: "3px 9px",
                  borderRadius: 6,
                  fontSize: 11,
                  background: "#ECFDF5",
                  color: "#065F46",
                  border: "1px solid #A7F3D0",
                }}
              >
                ✓ {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComplaintCard({ complaint, layout }) {
  const sev = complaint.severity ?? 0;
  const c = severityColor(sev);
  return (
    <div
      style={{
        padding: "8px 10px",
        marginBottom: 3,
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderLeft: `3px solid ${c}`,
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span
          style={{
            background: c,
            borderRadius: 99,
            padding: "1px 7px",
            fontSize: 10,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          {sev}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#222", flex: 1 }}>
          {complaint.issue}
        </span>
        {complaint.frequency && (
          <span style={{ fontSize: 9.5, color: "#888" }}>{complaint.frequency}</span>
        )}
      </div>
      {layout === "full" && Array.isArray(complaint.quotes) && complaint.quotes.length > 0 && (
        <div style={{ marginTop: 3, marginBottom: 3 }}>
          {complaint.quotes.slice(0, 2).map((q, i) => (
            <div
              key={i}
              style={{
                fontSize: 10,
                color: "#666",
                lineHeight: 1.5,
                fontStyle: "italic",
                paddingLeft: 8,
                borderLeft: "2px solid #E5E7EB",
                marginBottom: 2,
              }}
            >
              "{q}"
            </div>
          ))}
        </div>
      )}
      {complaint.productDirection && (
        <div style={{ fontSize: 10.5, color: "#059669", marginTop: 2 }}>
          💡 {complaint.productDirection}
        </div>
      )}
      {complaint.recommendedSpec && (
        <div style={{ fontSize: 10.5, color: "#2563EB", marginTop: 1 }}>
          📋 {complaint.recommendedSpec}
        </div>
      )}
    </div>
  );
}
