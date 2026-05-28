"use client";

import { useEffect, useMemo, useState } from "react";
import { D, getAllCategories, TL, TC } from "@/lib/data";
import {
  CACHE_KEYS,
  loadJson,
  loadPartnersMap,
  getPartnersForKey,
  setPartnersForKey,
  loadPartnerMessagesMap,
  getPartnerMessage,
  setPartnerMessage,
} from "@/lib/ai-cache";

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fitColor(score) {
  if (score == null) return "#9CA3AF";
  if (score >= 80) return "#059669";
  if (score >= 65) return "#2563EB";
  if (score >= 50) return "#D97706";
  return "#DC2626";
}

const YT_LEVEL = {
  absent: { color: "#DC2626", label: "🔴 전무", desc: "최고 파트너 후보" },
  weak: { color: "#F59E0B", label: "🟡 미약", desc: "시작 단계" },
  moderate: { color: "#F97316", label: "🟠 보통", desc: "조금 활성" },
  active: { color: "#10B981", label: "🟢 활발", desc: "이미 충분" },
};

export default function PartnerDiscovery({ onVerify } = {}) {
  const [allCats, setAllCats] = useState(D);
  // 기본 선택: blue + gap 만
  const [selectedIds, setSelectedIds] = useState([]);
  const [includeYoutube, setIncludeYoutube] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // 초기 카테고리·캐시 로드
  useEffect(() => {
    const cats = getAllCategories();
    setAllCats(cats);
    // 기본 선택: blue + gap
    setSelectedIds(cats.filter((c) => c.type === "blue" || c.type === "gap").map((c) => c.id));
  }, []);

  // 선택 카테고리에 캐시된 결과가 있으면 자동 로드
  useEffect(() => {
    if (!selectedIds.length) {
      setData(null);
      return;
    }
    const map = loadPartnersMap();
    const entry = getPartnersForKey(map, selectedIds);
    setData(entry);
  }, [selectedIds]);

  const eligible = allCats.filter((c) => c.type !== "no");
  const grouped = {
    blue: eligible.filter((c) => c.type === "blue"),
    gap: eligible.filter((c) => c.type === "gap"),
    cond: eligible.filter((c) => c.type === "cond"),
  };

  function toggle(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function selectAll(type) {
    const ids = grouped[type].map((c) => c.id);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
  }
  function clearAll() {
    setSelectedIds([]);
  }

  // 예상 비용
  const ytQuotaEst = includeYoutube ? selectedIds.length * 300 : 0;
  const claudeCostEst = 0.02;

  async function runScan() {
    if (!selectedIds.length) return;
    if (selectedIds.length > 4) {
      if (
        !confirm(
          `선택한 ${selectedIds.length}개 카테고리는 한 번에 처리하기에 많습니다 (Vercel 60s 제약). 처음 4개만 처리할까요?`
        )
      )
        return;
    }
    setRunning(true);
    setError(null);
    const targetIds = selectedIds.slice(0, 4);
    try {
      const naverTrendCache = loadJson(CACHE_KEYS.naverTrend);
      const trendArr = Array.isArray(naverTrendCache?.results) ? naverTrendCache.results : null;
      const res = await fetch("/api/partner-discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryIds: targetIds,
          includeYoutube,
          naverTrendCache: trendArr,
        }),
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setPartnersForKey(targetIds, json);
      setData({ ...json, cachedAt: new Date().toISOString() });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setRunning(false);
    }
  }

  const partners = data?.partners || [];

  return (
    <div>
      <p style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        제품력은 있는데 숏폼 마케팅이 부족한 회사를 찾아 RS·어필리에이트 파트너로 발굴
      </p>

      {/* 스캔 컨트롤 */}
      <div
        style={{
          padding: "12px 14px",
          background: "linear-gradient(135deg,#EEF2FF,#FAF5FF)",
          border: "1px solid #C7D2FE",
          borderRadius: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }}>🤝</span>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#4338CA", flex: 1 }}>
            파트너 후보 스캔 ({selectedIds.length}개 카테고리 선택됨)
          </div>
        </div>

        {/* 카테고리 선택 */}
        <CategorySelector
          grouped={grouped}
          selectedIds={selectedIds}
          onToggle={toggle}
          onSelectAll={selectAll}
          onClearAll={clearAll}
        />

        {/* 옵션 + 비용 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 10,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "#4338CA",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={includeYoutube}
              onChange={(e) => setIncludeYoutube(e.target.checked)}
            />
            🎬 YouTube 쇼츠 활동도 체크 포함 (+{ytQuotaEst} units)
          </label>
          <div style={{ fontSize: 11, color: "#666", marginLeft: "auto" }}>
            예상: <b style={{ color: "#059669" }}>네이버 무료</b>
            {includeYoutube && <> + YouTube <b style={{ color: "#4338CA" }}>{ytQuotaEst} units</b></>}
            {" + "}Claude <b style={{ color: "#059669" }}>~${claudeCostEst.toFixed(2)}</b>
          </div>
          <button
            onClick={runScan}
            disabled={running || !selectedIds.length}
            style={{
              padding: "9px 18px",
              background: running || !selectedIds.length
                ? "#C7D2FE"
                : "linear-gradient(135deg,#7C3AED,#4338CA)",
              border: "none",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              cursor: running || !selectedIds.length ? "not-allowed" : "pointer",
            }}
          >
            {running
              ? `스캔 중… (~30-60s)`
              : data
                ? "🔄 다시 스캔"
                : "🤝 파트너 스캔 시작"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "8px 10px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            fontSize: 11,
            color: "#B91C1C",
            marginBottom: 10,
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      )}

      {/* 결과 메타 + 요약 */}
      {data && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 10,
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div style={{ flex: 1, fontSize: 11, color: "#555", lineHeight: 1.7 }}>
            <div>
              <span style={{ color: "#999" }}>마지막 스캔:</span>{" "}
              <b style={{ color: "#222" }}>{fmtDateTime(data.cachedAt || data.scannedAt)}</b>
              {" · "}
              <span style={{ color: "#999" }}>카테고리</span>{" "}
              <b>{data.categories?.length || 0}</b>개
              {" · "}
              <span style={{ color: "#999" }}>파트너 후보</span>{" "}
              <b style={{ color: "#4338CA" }}>{partners.length}</b>명
            </div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
              {data.youtube?.enabled && (
                <>YT +{data.youtube.quotaUsed} units · </>
              )}
              Claude ${(data.claude?.estCostUSD || 0).toFixed(4)}
              {data.errors?.length > 0 && (
                <span style={{ color: "#DC2626", marginLeft: 6 }}>
                  · 일부 오류 {data.errors.length}건
                </span>
              )}
            </div>
            {data.summary && (
              <div
                style={{
                  marginTop: 6,
                  padding: "7px 10px",
                  background: "linear-gradient(135deg,#FAF5FF,#EEF2FF)",
                  border: "1px solid #C7D2FE",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "#3730A3",
                  lineHeight: 1.7,
                }}
              >
                <b>💡</b> {data.summary}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 파트너 카드 리스트 */}
      {partners.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {partners.map((p, i) => (
            <PartnerCard
              key={i}
              partner={p}
              categoryIds={selectedIds}
              onVerify={onVerify}
            />
          ))}
        </div>
      )}

      {data && partners.length === 0 && !error && (
        <div
          style={{
            padding: "10px 12px",
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 6,
            fontSize: 11,
            color: "#666",
            lineHeight: 1.6,
          }}
        >
          Claude 가 추천 기준을 만족하는 파트너 후보를 식별하지 못했습니다. 다른 카테고리 조합을
          시도하거나 YouTube 쇼츠 체크를 켜서 신호를 더 모아보세요.
        </div>
      )}

      <p style={{ fontSize: 9.5, color: "#AAA", marginTop: 12, lineHeight: 1.6 }}>
        ※ 데이터 소스: 네이버 쇼핑 검색(무료) + 블로그 검색(무료) + YouTube 쇼츠 카운트(선택) +
        Claude AI 종합 분석. 결과는 14일 캐싱.
      </p>
    </div>
  );
}

function CategorySelector({ grouped, selectedIds, onToggle, onSelectAll, onClearAll }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {["blue", "gap", "cond"].map((type) => (
        <div key={type} style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
          <div style={{ minWidth: 100 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: TC[type] }}>{TL[type]}</span>{" "}
            <button
              onClick={() => onSelectAll(type)}
              style={{
                fontSize: 9,
                color: "#666",
                background: "transparent",
                border: "1px solid #E5E7EB",
                borderRadius: 3,
                padding: "1px 6px",
                cursor: "pointer",
              }}
            >
              전체
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, flex: 1 }}>
            {grouped[type].map((c) => {
              const checked = selectedIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  style={{
                    fontSize: 10.5,
                    padding: "2px 7px",
                    borderRadius: 99,
                    background: checked ? "#fff" : "#F9FAFB",
                    border: checked ? `1px solid ${TC[type]}` : "1px solid #E5E7EB",
                    color: checked ? "#222" : "#666",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(c.id)}
                    style={{ margin: 0, width: 10, height: 10 }}
                  />
                  {c.e} {c.n}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 4 }}>
        <button
          onClick={onClearAll}
          style={{
            fontSize: 10,
            color: "#999",
            background: "transparent",
            border: "1px solid #E5E7EB",
            borderRadius: 3,
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          전체 해제
        </button>
      </div>
    </div>
  );
}

function PartnerCard({ partner, categoryIds, onVerify }) {
  const fc = fitColor(partner.fitScore);
  const ytInfo = YT_LEVEL[
    partner.youtubeShorts === 0
      ? "absent"
      : partner.youtubeShorts <= 5
        ? "weak"
        : partner.youtubeShorts <= 9
          ? "moderate"
          : "active"
  ] || YT_LEVEL.moderate;
  const [messageOpen, setMessageOpen] = useState(false);

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderLeft: `4px solid ${fc}`,
        borderRadius: 8,
      }}
    >
      {/* 헤더: 점수 + 브랜드 + 카테고리 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: "#fff",
            background: fc,
            borderRadius: 99,
            padding: "3px 11px",
            minWidth: 50,
            textAlign: "center",
          }}
          title="파트너 적합도 (5가지 기준 종합)"
        >
          ⭐ {partner.fitScore}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#222" }}>
            {partner.brandName || partner.mallName}
            {partner.brandName && partner.mallName !== partner.brandName && (
              <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>
                @ {partner.mallName}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>
            {partner.category} · {partner.priceRange}
          </div>
        </div>
      </div>

      {/* 신호 그리드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 4,
          marginBottom: 8,
          fontSize: 10,
        }}
      >
        <SignalCell label="📦 대표 상품" value={partner.productSample?.slice(0, 24) + (partner.productSample?.length > 24 ? "…" : "")} />
        <SignalCell label="📝 블로그 리뷰" value={`${partner.blogReviewCount}건`} sub={partner.blogSentiment} />
        <SignalCell
          label="📱 YouTube 쇼츠"
          value={`${partner.youtubeShorts}개`}
          sub={ytInfo.label}
          color={ytInfo.color}
        />
        <SignalCell label="💰 추정 수익" value={partner.estimatedRevenue?.slice(0, 24)} />
      </div>

      {/* 마케팅 공백 + 적합 이유 */}
      {partner.marketingGap && (
        <div style={{ fontSize: 11, color: "#9A3412", lineHeight: 1.6, marginBottom: 4 }}>
          📉 <b>마케팅 공백:</b> {partner.marketingGap}
        </div>
      )}
      {partner.fitReason && (
        <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.65, marginBottom: 6 }}>
          💡 {partner.fitReason}
        </div>
      )}

      {/* 추천 모델 + 액션 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {partner.recommendedModel && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "#4338CA",
              background: "#EEF2FF",
              border: "1px solid #C7D2FE",
              padding: "3px 9px",
              borderRadius: 99,
            }}
          >
            🤝 {partner.recommendedModel}
          </span>
        )}
        {partner.risk && (
          <span
            style={{
              fontSize: 10.5,
              color: "#B91C1C",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              padding: "3px 9px",
              borderRadius: 99,
            }}
          >
            ⚠️ {partner.risk}
          </span>
        )}
      </div>

      {partner.nextAction && (
        <div
          style={{
            fontSize: 10.5,
            color: "#065F46",
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            borderRadius: 6,
            padding: "5px 9px",
            marginBottom: 6,
          }}
        >
          🎯 <b>다음 액션:</b> {partner.nextAction}
        </div>
      )}

      {/* 액션 버튼들 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {onVerify && (
          <button
            onClick={() => onVerify(partner)}
            style={{
              padding: "6px 14px",
              fontSize: 11,
              fontWeight: 700,
              background: "linear-gradient(135deg,#4F46E5,#6366F1)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            🔬 검증 시작 →
          </button>
        )}
        <button
          onClick={() => setMessageOpen((v) => !v)}
          style={{
            padding: "5px 12px",
            fontSize: 10.5,
            fontWeight: 700,
            background: messageOpen ? "#fff" : "#7C3AED",
            color: messageOpen ? "#7C3AED" : "#fff",
            border: "1px solid #7C3AED",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {messageOpen ? "▲ 메시지 닫기" : "✉️ 빠른 메시지"}
        </button>
      </div>

      {messageOpen && <PartnerMessagePanel partner={partner} categoryIds={categoryIds} />}
    </div>
  );
}

function SignalCell({ label, value, sub, color }) {
  return (
    <div
      style={{
        padding: "5px 7px",
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: 4,
      }}
    >
      <div style={{ fontSize: 9, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: color || "#222", lineHeight: 1.3 }}>
        {value || "—"}
      </div>
      {sub && (
        <div style={{ fontSize: 9, color: "#666", marginTop: 1 }} title={sub}>
          {sub}
        </div>
      )}
    </div>
  );
}

function PartnerMessagePanel({ partner, categoryIds }) {
  const [channel, setChannel] = useState("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [copied, setCopied] = useState(false);

  // 캐시 로드
  useEffect(() => {
    const cid = categoryIds?.[0] || 0;
    const map = loadPartnerMessagesMap();
    const cached = getPartnerMessage(map, cid, partner.mallName || partner.brandName, channel);
    setMessage(cached?.message || null);
    setError(null);
  }, [channel, partner.mallName, partner.brandName, categoryIds]);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/partner-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partner, channel }),
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMessage(json.message);
      const cid = categoryIds?.[0] || 0;
      setPartnerMessage(cid, partner.mallName || partner.brandName, channel, json);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function copyMessage() {
    if (!message) return;
    const text = [message.subject ? `[제목] ${message.subject}\n\n` : "", message.body || ""].join("");
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => window.prompt("클립보드 복사 실패. Ctrl+C 로 복사하세요:", text));
  }

  return (
    <div
      style={{
        marginTop: 6,
        padding: "10px 12px",
        background: "linear-gradient(135deg,#FAF5FF,#EEF2FF)",
        border: "1px solid #C7D2FE",
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#4338CA" }}>채널:</span>
        {[
          { id: "email", l: "이메일" },
          { id: "dm", l: "인스타 DM" },
          { id: "kakao", l: "카톡/네이버톡톡" },
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => setChannel(c.id)}
            style={{
              padding: "3px 9px",
              fontSize: 10,
              fontWeight: 600,
              background: channel === c.id ? "#7C3AED" : "#fff",
              color: channel === c.id ? "#fff" : "#666",
              border: "1px solid",
              borderColor: channel === c.id ? "#7C3AED" : "#E5E7EB",
              borderRadius: 99,
              cursor: "pointer",
            }}
          >
            {c.l}
          </button>
        ))}
        <button
          onClick={generate}
          disabled={loading}
          style={{
            padding: "3px 10px",
            fontSize: 10,
            fontWeight: 700,
            background: loading ? "#DDD6FE" : "#4338CA",
            color: "#fff",
            border: "none",
            borderRadius: 99,
            cursor: loading ? "wait" : "pointer",
            marginLeft: "auto",
          }}
        >
          {loading ? "생성 중…" : message ? "🔄 재생성" : "🤖 생성"}
        </button>
        {message && (
          <button
            onClick={copyMessage}
            style={{
              padding: "3px 10px",
              fontSize: 10,
              fontWeight: 700,
              background: copied ? "#10B981" : "#fff",
              color: copied ? "#fff" : "#666",
              border: "1px solid #E5E7EB",
              borderRadius: 99,
              cursor: "pointer",
            }}
          >
            {copied ? "✓ 복사됨" : "📋 복사"}
          </button>
        )}
      </div>
      {error && (
        <div style={{ fontSize: 10, color: "#B91C1C", marginBottom: 4 }}>{error}</div>
      )}
      {!message && !loading && !error && (
        <div style={{ fontSize: 10, color: "#666" }}>
          "🤖 생성" 버튼을 누르면 채널별 맞춤 첫 연락 메시지를 자동 생성합니다 (~$0.005).
        </div>
      )}
      {message && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #C7D2FE",
            borderRadius: 4,
            padding: "8px 10px",
          }}
        >
          {message.subject && (
            <div style={{ fontSize: 11, fontWeight: 700, color: "#222", marginBottom: 4 }}>
              [제목] {message.subject}
            </div>
          )}
          <div
            style={{
              fontSize: 11,
              color: "#333",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {message.body}
          </div>
          {(message.tone || message.estimatedResponseRate != null) && (
            <div style={{ fontSize: 9, color: "#888", marginTop: 6, display: "flex", gap: 8 }}>
              {message.tone && <span>톤: {message.tone}</span>}
              {message.estimatedResponseRate != null && (
                <span>예상 응답률: {message.estimatedResponseRate}%</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
