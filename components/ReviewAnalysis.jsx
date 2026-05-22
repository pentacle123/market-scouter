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

  const isBlueOcean = cat?.type === "blue";
  const isDisabled = cat?.type === "no";

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

  // 비추천 카테고리는 분석 비활성
  if (isDisabled) {
    return (
      <div
        style={{
          padding: "8px 10px",
          background: "#F9FAFB",
          border: "1px dashed #E5E7EB",
          borderRadius: 6,
          fontSize: 11,
          color: "#888",
          lineHeight: 1.6,
        }}
      >
        ❌ 비추천 카테고리는 리뷰 분석 대상이 아닙니다 (사업적으로 분석 가치 없음).
      </div>
    );
  }

  // 로딩 메시지: blue 면 US+KR, 아니면 KR 만
  const loadingMessage = isBlueOcean
    ? "🇺🇸 미국 YouTube 댓글 ~250개 + 🇰🇷 한국 대체재 리뷰 30개 분석 중…"
    : includeUS
      ? "🇺🇸 미국 YouTube 댓글 + 🇰🇷 한국 네이버 리뷰 분석 중…"
      : "🇰🇷 한국 네이버 리뷰 30개 분석 중…";

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
          {loading ? (
            <div style={{ color: "#9A3412", fontWeight: 700 }}>{loadingMessage}</div>
          ) : entry ? (
            <>
              <div>
                <span style={{ color: "#999" }}>마지막 분석</span>{" "}
                <b style={{ color: "#222" }}>{fmtDateTime(entry.cachedAt || entry.scannedAt)}</b>
              </div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                {entry.youtube?.commentCount > 0 && (
                  <>
                    🇺🇸 YouTube 댓글 <b style={{ color: "#444" }}>{entry.youtube.commentCount}</b>개 ·
                  </>
                )}{" "}
                🇰🇷 블로그 <b style={{ color: "#444" }}>{entry.blogCount}</b>건
                {entry.isSubstitute && (
                  <span style={{ color: "#9A3412" }}> · 대체재 "{entry.substituteName}"</span>
                )}
                <> · Claude ${(entry.claude?.estCostUSD || 0).toFixed(4)}</>
                {entry.youtube?.quotaUsed > 0 && (
                  <> · YT +{entry.youtube.quotaUsed} units</>
                )}
              </div>
            </>
          ) : (
            <div>
              <span style={{ color: "#9A3412", fontWeight: 700 }}>📝 리뷰 분석</span>{" "}
              {isBlueOcean ? (
                <span style={{ color: "#666" }}>
                  🇺🇸 YouTube 댓글(1차) + 🇰🇷 대체재 블로그(2차) ={" "}
                  <b>~105 YT units + ~$0.03 Claude</b>
                </span>
              ) : (
                <span style={{ color: "#666" }}>
                  🇰🇷 네이버 블로그 30건 + Claude = <b>네이버 무료 + ~$0.01 Claude</b>
                </span>
              )}
              {isBlueOcean && (
                <div style={{ fontSize: 10, color: "#9A3412", marginTop: 2 }}>
                  💡 블루오션은 미국 댓글이 1차 신호, 한국 대체재는 2차 보강 — 자동 통합
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {!isBlueOcean && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 9.5,
                color: "#666",
                cursor: "pointer",
              }}
              title="추가 ~105 YouTube units 사용"
            >
              <input
                type="checkbox"
                checked={includeUS}
                onChange={(e) => setIncludeUS(e.target.checked)}
                style={{ margin: 0 }}
              />
              US YouTube 댓글도 추가
            </label>
          )}
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
  const source = a.source || (entry.youtube?.commentCount > 0 && entry.blogCount > 0
    ? "both"
    : entry.youtube?.commentCount > 0
      ? "youtube_us"
      : "naver_kr");

  return (
    <div>
      {/* 데이터 소스 뱃지 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
        {(source === "youtube_us" || source === "both") && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              background: "#DC2626",
              borderRadius: 99,
              padding: "2px 9px",
            }}
          >
            🇺🇸 YouTube 댓글 {entry.youtube?.commentCount || 0}개 (1차)
          </span>
        )}
        {(source === "naver_kr" || source === "both") && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              background: "#059669",
              borderRadius: 99,
              padding: "2px 9px",
            }}
          >
            🇰🇷 네이버 블로그 {entry.blogCount}개 {source === "both" ? "(2차)" : ""}
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
              padding: "2px 9px",
            }}
            title={`한국 대체재 "${entry.substituteName}" 분석`}
          >
            대체재 "{entry.substituteName}"
          </span>
        )}
        {a.negativeRatio != null && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              background: severityColor(a.negativeRatio),
              borderRadius: 99,
              padding: "2px 9px",
              marginLeft: "auto",
            }}
          >
            부정 {a.negativeRatio}%
          </span>
        )}
      </div>

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
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9A3412", marginBottom: 4 }}>
            💡 종합 인사이트
          </div>
          <div style={{ fontSize: 11.5, color: "#7C2D12", lineHeight: 1.7 }}>{a.insight}</div>
        </div>
      )}

      {/* 한국 진입 시사점 (별도 카드) */}
      {a.koreaImplication && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 6,
            background: "linear-gradient(135deg,#EEF2FF,#FAF5FF)",
            border: "1px solid #C7D2FE",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: "#4338CA", marginBottom: 4 }}>
            🇰🇷 한국 진입 시 특별히 주의할 점
          </div>
          <div style={{ fontSize: 11.5, color: "#3730A3", lineHeight: 1.7 }}>{a.koreaImplication}</div>
        </div>
      )}

      {/* 불만 TOP 5 */}
      {Array.isArray(a.complaints) && a.complaints.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9A3412", marginBottom: 4 }}>
            🔴 소비자 불만 TOP {a.complaints.length}{" "}
            <span style={{ color: "#888", fontWeight: 500 }}>
              {source === "both" && "(미국 본질 + 한국 시장 종합)"}
              {source === "youtube_us" && "(미국 본질 — 한국 적용 추론)"}
              {source === "naver_kr" && "(한국 실측)"}
            </span>
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
  const hasUs = Array.isArray(complaint.quotes) && complaint.quotes.length > 0;
  const hasKr = Array.isArray(complaint.quotesKr) && complaint.quotesKr.length > 0;
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
      {layout === "full" && hasUs && (
        <div style={{ marginTop: 3, marginBottom: 3 }}>
          {complaint.quotes.slice(0, 2).map((q, i) => (
            <div
              key={"us" + i}
              style={{
                fontSize: 10,
                color: "#666",
                lineHeight: 1.5,
                fontStyle: "italic",
                paddingLeft: 8,
                borderLeft: "2px solid #DC2626",
                marginBottom: 2,
                background: "#FEF2F2",
                borderRadius: 3,
                padding: "3px 8px",
              }}
              title="🇺🇸 US YouTube 댓글 원문"
            >
              <span style={{ fontSize: 8.5, color: "#DC2626", fontWeight: 700, marginRight: 4 }}>🇺🇸</span>
              "{q}"
            </div>
          ))}
        </div>
      )}
      {layout === "full" && hasKr && (
        <div style={{ marginTop: 3, marginBottom: 3 }}>
          {complaint.quotesKr.slice(0, 2).map((q, i) => (
            <div
              key={"kr" + i}
              style={{
                fontSize: 10,
                color: "#374151",
                lineHeight: 1.5,
                fontStyle: "italic",
                paddingLeft: 8,
                borderLeft: "2px solid #059669",
                marginBottom: 2,
                background: "#ECFDF5",
                borderRadius: 3,
                padding: "3px 8px",
              }}
              title="🇰🇷 한국 네이버 블로그 인용"
            >
              <span style={{ fontSize: 8.5, color: "#059669", fontWeight: 700, marginRight: 4 }}>🇰🇷</span>
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
