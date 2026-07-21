"use client";

import { useMemo, useState } from "react";
import { D } from "@/lib/data";

// 브랜드 발굴 5단계 파이프라인.
// Phase A: 껍데기 · Phase B: /api/brand-candidates 실호출 + 시그널 UI.
// Phase C 에서 Step 3~5 실제 UI 추가 예정.

const STEPS = [
  { id: 1, l: "카테고리 유니버스", desc: "15개에서 선택" },
  { id: 2, l: "후보 수집", desc: "쇼핑검색 + 시그널" },
  { id: 3, l: "병목 정량 검증", desc: "YT · 블로그 · 쇼츠" },
  { id: 4, l: "검색 갭 (인지)", desc: "DataLab 상대비율" },
  { id: 5, l: "스코어링 · 브리프", desc: "4축 + 컨택" },
];

// blogSignal → 배지 색상/라벨
const SIGNAL_UI = {
  silent: { color: "#059669", bg: "#D1FAE5", label: "개입 여지 큼", desc: "수요 검증 필요" },
  weak: { color: "#059669", bg: "#D1FAE5", label: "개입 여지 큼", desc: "수요 검증 필요" },
  sweetspot: { color: "#B45309", bg: "#FEF3C7", label: "수요 검증 + 저활성", desc: "균형" },
  saturated: { color: "#B91C1C", bg: "#FEE2E2", label: "개입 여지 작음", desc: "이미 활발" },
};

export default function BrandFinder() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [spotOn, setSpotOn] = useState(true);

  // 유니버스 = gap · cond · blue 카테고리 (마사지건 등 no 는 제외)
  const universe = useMemo(
    () => D.filter((c) => ["gap", "blue", "cond"].includes(c.type)),
    []
  );

  async function runStep2() {
    if (!selectedCatId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({
        categoryId: String(selectedCatId),
        spotCheckFinal: spotOn ? "true" : "false",
      });
      const res = await fetch(`/api/brand-candidates?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setResult(data);
        setCurrentStep(2);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedCat = universe.find((c) => c.id === selectedCatId);

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 3px" }}>
        🏷️ 브랜드 발굴 — 5단계 파이프라인
      </h2>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        "제품 좋음 + 마케팅 조용함" 브랜드를 시그널 3종·4축 스코어·컨택 브리프까지 자동화
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
            const color = isCurrent ? "#6366F1" : isDone ? "#10B981" : "#D1D5DB";
            const bg = isCurrent ? "#EEF2FF" : isDone ? "#F0FDF4" : "#fff";
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

      {/* Step 1 · 카테고리 유니버스 */}
      {currentStep === 1 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 6 }}>
            Step 1 · 카테고리 유니버스 ({universe.length}개)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
            {universe.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCatId(c.id)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  background: selectedCatId === c.id ? "#EEF2FF" : "#fff",
                  border: `1px solid ${selectedCatId === c.id ? "#6366F1" : "#E5E7EB"}`,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>
                  {c.e} {c.n}
                </div>
                <div style={{ fontSize: 9.5, color: "#888", marginTop: 2 }}>
                  #{c.id} · {c.type} · {c.mk}
                </div>
              </button>
            ))}
          </div>

          {selectedCat && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                border: "1px solid #C7D2FE",
                borderRadius: 8,
                background: "#F5F3FF",
              }}
            >
              <div style={{ fontSize: 11, color: "#4C1D95", marginBottom: 8 }}>
                선택: <b>{selectedCat.n}</b> · 키워드 <code>{selectedCat.kw?.KR}</code>
              </div>
              <label
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#4338CA", marginBottom: 8 }}
              >
                <input
                  type="checkbox"
                  checked={spotOn}
                  onChange={(e) => setSpotOn(e.target.checked)}
                />
                최종 후보 웹검색 스팟 확인 (Claude · ~$0.03/브랜드 · 채용공고 포함)
              </label>
              <button
                onClick={runStep2}
                disabled={loading}
                style={{
                  padding: "8px 14px",
                  background: loading ? "#9CA3AF" : "#6366F1",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "Step 2 후보 수집 중…" : "→ Step 2 후보 수집 실행"}
              </button>
              {error && (
                <div style={{ marginTop: 8, fontSize: 10.5, color: "#B91C1C" }}>
                  ⚠ {error}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2 · 후보 수집 결과 */}
      {currentStep === 2 && result && <Step2Result result={result} />}

      {/* Step 3~5 · 아직 껍데기 */}
      {currentStep >= 3 && (
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
            Phase C 에서 구현 예정 (병목 정량 · 검색 갭 · 스코어링/브리프)
          </div>
        </div>
      )}

      <p style={{ fontSize: 9.5, color: "#AAA", marginTop: 12, lineHeight: 1.6 }}>
        ※ 기존 [📦 제품 기회] · [🤝 파트너 기회] 탭은 완전 그대로 유지됩니다. 이 탭은 병렬 신규 메뉴.
      </p>
    </div>
  );
}

function Step2Result({ result }) {
  const { stats, sellers, finalCandidates, category, filters, spotCheckMeta } = result;
  return (
    <div>
      {/* 요약 */}
      <div
        style={{
          padding: 10,
          background: "#F0FDF4",
          border: "1px solid #86EFAC",
          borderRadius: 8,
          marginBottom: 10,
          fontSize: 11,
        }}
      >
        <b>{category?.n}</b> · 원시 {stats.rawProductCount} → 필터 {stats.filteredProductCount}
        → 셀러 {stats.sellerCandidates} → 조회 {stats.sellersChecked} → 통과{" "}
        <b>{stats.passedFilter}</b> → 최종 <b>{stats.finalCandidates}</b>
        {spotCheckMeta && (
          <span style={{ color: "#059669", marginLeft: 8 }}>
            · 웹검색 스팟 {spotCheckMeta.ok}건 (~${spotCheckMeta.totalEstCostUSD.toFixed(3)})
          </span>
        )}
      </div>

      {/* 최종 후보 */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 6 }}>
        🏆 최종 후보 ({finalCandidates.length})
      </div>
      {finalCandidates.length === 0 ? (
        <EmptyBox msg="필터 통과 후보가 없습니다. 하단 셀러 표에서 rejectReason 을 확인해 임계값 조정." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {finalCandidates.map((c) => (
            <FinalCandidateCard key={c.mallName} c={c} />
          ))}
        </div>
      )}

      {/* 셀러 전량 (감사용) */}
      <details>
        <summary style={{ fontSize: 11, color: "#666", cursor: "pointer", marginBottom: 6 }}>
          🔬 셀러 {sellers.length}곳 전체 (필터 통과/탈락 사유)
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sellers.map((s) => (
            <SellerRow key={s.mallName} s={s} />
          ))}
        </div>
      </details>

      <div style={{ fontSize: 9.5, color: "#AAA", marginTop: 10, lineHeight: 1.6 }}>
        필터: 상품수 ≥ {filters.minProductCount} · 감성 ≥ {filters.minSentiment}% (표본 ≥{" "}
        {filters.sentimentMinSample} 시) · 대기업 판별 {filters.includeClaudeJudge ? "on" : "off"} ·
        웹검색 스팟 {filters.spotCheckFinal ? "on" : "off"}
        <br />
        {filters.note}
      </div>
    </div>
  );
}

function FinalCandidateCard({ c }) {
  const sig = c.blogSignal ? SIGNAL_UI[c.blogSignal] : null;
  const spot = c.spotCheck;
  return (
    <div
      style={{
        border: "1px solid #A78BFA",
        background: "#FAF5FF",
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{c.mallName}</div>
        {c.isProfessional && <Chip color="#4338CA" bg="#E0E7FF">전문셀러</Chip>}
        {sig && <Chip color={sig.color} bg={sig.bg}>{sig.label}</Chip>}
        <span style={{ fontSize: 10, color: "#888" }}>상품 {c.productCount}개</span>
        <span style={{ fontSize: 10, color: "#888" }}>{c.priceRange}</span>
      </div>

      <div style={{ fontSize: 10.5, color: "#666", marginTop: 6 }}>
        블로그 {c.blogReviewCount ?? "?"}건 · 감성{" "}
        {c.sentimentScore == null ? "?" : `${c.sentimentScore}%`}
        {c.warnings?.length > 0 && (
          <span style={{ color: "#B45309" }}> · ⚠ {c.warnings.join(" / ")}</span>
        )}
      </div>

      {spot && !spot.error && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 6,
          }}
        >
          <div style={{ fontSize: 10, color: "#6366F1", fontWeight: 700, marginBottom: 4 }}>
            🔍 웹검색 스팟 (신뢰도 {spot.spotConfidence ?? "?"})
          </div>
          <div style={{ fontSize: 10.5, color: "#333", lineHeight: 1.55 }}>
            제품 리뷰 {spot.productReviewCount ?? "?"} · 평점 {spot.productRating ?? "?"} · IG{" "}
            {spot.instagramFollowers ?? "?"} · YT {spot.youtubeSubscribers ?? "?"} · 언론{" "}
            {spot.recentPressCount ?? "?"}
          </div>
          <div style={{ fontSize: 10.5, color: "#333", marginTop: 4 }}>
            채용공고:{" "}
            {spot.marketingHiring?.found === true ? (
              <span style={{ color: "#B91C1C" }}>
                있음 ({(spot.marketingHiring.positions || []).join(", ") || "마케터"}) · 개입 여지 축소
              </span>
            ) : spot.marketingHiring?.found === false ? (
              <span style={{ color: "#059669" }}>없음 · 마케팅 인력 부재</span>
            ) : (
              <span style={{ color: "#888" }}>확인 불가</span>
            )}
          </div>
          {spot.reason && (
            <div style={{ fontSize: 10, color: "#555", marginTop: 4, fontStyle: "italic" }}>
              {spot.reason}
            </div>
          )}
        </div>
      )}
      {spot?.error && (
        <div style={{ fontSize: 10, color: "#B91C1C", marginTop: 6 }}>
          웹검색 오류: {spot.error}
        </div>
      )}
    </div>
  );
}

function SellerRow({ s }) {
  const sig = s.blogSignal ? SIGNAL_UI[s.blogSignal] : null;
  return (
    <div
      style={{
        padding: 8,
        border: `1px solid ${s.passedFilter ? "#D1FAE5" : "#FEE2E2"}`,
        background: s.passedFilter ? "#F0FDF4" : "#FEF2F2",
        borderRadius: 6,
        fontSize: 10.5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700 }}>
          {s.passedFilter ? "✓" : "✗"} {s.mallName}
        </span>
        {sig && <Chip color={sig.color} bg={sig.bg} small>{sig.label}</Chip>}
        {s.isProfessional && <Chip color="#4338CA" bg="#E0E7FF" small>전문셀러</Chip>}
        <span style={{ color: "#888" }}>상품 {s.productCount}</span>
        <span style={{ color: "#888" }}>
          블로그 {s.blogReviewCount ?? "?"} · 감성{" "}
          {s.sentimentScore == null ? "?" : `${s.sentimentScore}%`}
        </span>
      </div>
      {s.rejectReason && (
        <div style={{ color: "#B91C1C", marginTop: 3 }}>탈락 사유: {s.rejectReason}</div>
      )}
      {s.warnings?.length > 0 && (
        <div style={{ color: "#B45309", marginTop: 3 }}>⚠ {s.warnings.join(" / ")}</div>
      )}
    </div>
  );
}

function Chip({ children, color, bg, small }) {
  return (
    <span
      style={{
        fontSize: small ? 9 : 9.5,
        fontWeight: 700,
        color,
        background: bg,
        padding: small ? "1px 5px" : "2px 6px",
        borderRadius: 4,
      }}
    >
      {children}
    </span>
  );
}

function EmptyBox({ msg }) {
  return (
    <div
      style={{
        padding: 16,
        background: "#FFFBEB",
        border: "1px dashed #FCD34D",
        borderRadius: 8,
        fontSize: 11,
        color: "#92400E",
        textAlign: "center",
        marginBottom: 12,
      }}
    >
      {msg}
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
