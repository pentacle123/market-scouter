"use client";

import { useEffect, useMemo, useState } from "react";
import {
  D,
  TL,
  TC,
  TB,
  TBR,
  buildCustomFromDiscovery,
  addCustomCategory,
  loadCustomCategories,
  exportCustomsAsCode,
  removeCustomCategory,
} from "@/lib/data";
import { CACHE_KEYS, loadJson, saveJson } from "@/lib/ai-cache";

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const TYPE_BADGE = {
  blue: { bg: "#EFF6FF", border: "#BFDBFE", color: "#3B82F6", label: "🔵 블루오션 후보" },
  gap: { bg: "#FFFBEB", border: "#FDE68A", color: "#F59E0B", label: "🟡 틈새 기회 후보" },
  cond: { bg: "#FFF7ED", border: "#FDBA74", color: "#F97316", label: "⚠️ 조건부 후보" },
};

export default function CategoryDiscovery() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customs, setCustoms] = useState([]);
  const [showExport, setShowExport] = useState(false);

  function reloadCustoms() {
    setCustoms(loadCustomCategories());
  }

  useEffect(() => {
    setData(loadJson(CACHE_KEYS.discoveries));
    reloadCustoms();
    const handler = () => reloadCustoms();
    if (typeof window !== "undefined") {
      window.addEventListener("market-scouter:customs-changed", handler);
      return () => window.removeEventListener("market-scouter:customs-changed", handler);
    }
  }, []);

  async function run(force = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/discover-categories${force ? "?force=true" : ""}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      saveJson(CACHE_KEYS.discoveries, json);
      setData(json);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const ytQuotaTotal = data?.youtube?.quotaDailyTotal || 10000;
  const ytQuotaToday = data?.youtube?.quotaUsedToday?.totalUsed ?? null;
  const discoveriesCount = data?.discoveries?.length || 0;

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "linear-gradient(135deg,#FFF7ED 0%,#FEF2F2 100%)",
        border: "1px solid #FDBA74",
        borderRadius: 10,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#9A3412" }}>
          신규 카테고리 자동 발견
        </div>
        <span
          style={{
            fontSize: 9,
            color: "#9A3412",
            background: "#fff",
            border: "1px solid #FED7AA",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          YouTube US + Claude
        </span>
      </div>
      <div style={{ fontSize: 11, color: "#7C2D12", lineHeight: 1.6, marginBottom: 8 }}>
        미국 YouTube 에서 뜨는 제품 영상을 9개 광범위 키워드로 수집한 뒤, Claude 가
        현재 {D.length}개 목록에 없는 신규 기회를 자동 식별합니다.
        <br />
        예상 비용: <b>~900 YouTube units</b> + <b>~$0.028 Claude</b> (캐시 hit 시 0)
      </div>

      {/* 상태 / 실행 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: data ? 10 : 0,
        }}
      >
        {data && (
          <div style={{ fontSize: 11, color: "#7C2D12", lineHeight: 1.5 }}>
            <div>
              <span style={{ color: "#9A3412" }}>마지막 발견:</span>{" "}
              <b>{fmtDateTime(data.scannedAt)}</b> ·{" "}
              <span style={{ color: "#9A3412" }}>신규 후보</span>{" "}
              <b style={{ color: "#DC2626" }}>{discoveriesCount}개</b>
            </div>
            <div style={{ color: "#9A3412", fontSize: 10, marginTop: 1 }}>
              영상 {data.youtube?.videoCount}개 분석 · 키워드{" "}
              {data.youtube?.keywordsCovered?.length}/9{" "}
              {data.youtube?.cacheHit ? "· 💾 YouTube 캐시 적중" : `· +${data.youtube?.quotaUsed} units`}
              {data.claude?.estCostUSD != null && (
                <> · Claude ${data.claude.estCostUSD.toFixed(4)}</>
              )}
            </div>
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {data && (
            <button
              onClick={() => run(true)}
              disabled={loading}
              style={{
                padding: "7px 12px",
                background: "#fff",
                border: "1px solid #FDBA74",
                color: "#9A3412",
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              🔄 재발견 (캐시 무시)
            </button>
          )}
          <button
            onClick={() => run(false)}
            disabled={loading}
            style={{
              padding: "8px 14px",
              background: loading ? "#FED7AA" : "linear-gradient(135deg,#F97316,#DC2626)",
              border: "none",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "발견 중…" : data ? "🔍 다시 발견" : "🔍 신규 카테고리 발견"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 8,
            padding: "7px 10px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            fontSize: 11,
            color: "#B91C1C",
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      )}

      {/* 결과 — 발견 후보 카드들 */}
      {discoveriesCount > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {data.discoveries.map((d, i) => (
            <DiscoveryCard key={i} discovery={d} customs={customs} />
          ))}
        </div>
      )}

      {/* 정식 등록용 코드 내보내기 */}
      {customs.length > 0 && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 10px",
            background: "#fff",
            border: "1px solid #FED7AA",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 11, color: "#9A3412" }}>
            🆕 사용자 추가 카테고리{" "}
            <b>{customs.length}개</b> · localStorage 보관 중
          </span>
          <button
            onClick={() => setShowExport((v) => !v)}
            style={{
              padding: "4px 10px",
              fontSize: 10.5,
              fontWeight: 700,
              background: showExport ? "#9A3412" : "#fff",
              color: showExport ? "#fff" : "#9A3412",
              border: "1px solid #9A3412",
              borderRadius: 4,
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            {showExport ? "▲ 닫기" : "📋 정식 등록용 코드 내보내기"}
          </button>
        </div>
      )}
      {showExport && (
        <ExportPanel customs={customs} onChange={reloadCustoms} />
      )}

      {data && discoveriesCount === 0 && !error && (
        <div
          style={{
            padding: "10px 12px",
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 6,
            fontSize: 11,
            color: "#666",
          }}
        >
          Claude 가 신규 카테고리를 식별하지 못했습니다. 기존 30개 목록이 이미 미국 트렌딩
          영역을 잘 커버하고 있다는 신호입니다 (긍정적 결과).
        </div>
      )}

      <p style={{ fontSize: 9.5, color: "#9A3412", opacity: 0.7, marginTop: 8, lineHeight: 1.5 }}>
        ※ "data.js 형식 복사" 는 카테고리 객체를 클립보드에 넣어 줍니다. 실제 추가는 개발자가
        lib/data.js 마지막 `];` 직전에 붙여넣고 빌드/배포해야 반영됩니다.
      </p>
    </div>
  );
}

function DiscoveryCard({ discovery, customs }) {
  const badge = TYPE_BADGE[discovery.estimatedType] || TYPE_BADGE.cond;
  // 이름 기준 이미 추가됐는지 검사
  const isAlreadyAdded = customs.some(
    (c) => c.n === discovery.name || c.kw?.US === discovery.keyword
  );
  const [justAdded, setJustAdded] = useState(false);

  function addToOpportunities() {
    const newCat = buildCustomFromDiscovery(discovery);
    const result = addCustomCategory(newCat);
    if (result.added) {
      setJustAdded(true);
    } else {
      // 이미 있다는 안내 — 토스트 대신 간단히 alert
      alert(result.reason || "이미 추가된 카테고리입니다.");
    }
  }

  const added = isAlreadyAdded || justAdded;

  return (
    <div
      style={{
        padding: "10px 12px",
        background: badge.bg,
        border: `1px solid ${badge.border}`,
        borderLeft: `3px solid ${badge.color}`,
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14 }}>🆕</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#222" }}>{discovery.name}</span>
        <span style={{ fontSize: 10, color: "#666" }}>· {discovery.nameEn}</span>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: "#fff",
            background: badge.color,
            borderRadius: 99,
            padding: "1px 7px",
            marginLeft: "auto",
          }}
        >
          {badge.label}
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#666",
          marginBottom: 5,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span>키워드 "{discovery.keyword}"</span>
        {discovery.videoCount != null && (
          <span>· 관련 영상 {discovery.videoCount}건</span>
        )}
        {discovery.avgViews != null && discovery.avgViews > 0 && (
          <span>· 평균 조회 {discovery.avgViews.toLocaleString()}</span>
        )}
      </div>
      {discovery.reasoning && (
        <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.65, marginBottom: 5 }}>
          {discovery.reasoning}
        </div>
      )}
      {Array.isArray(discovery.sampleTitles) && discovery.sampleTitles.length > 0 && (
        <div
          style={{
            fontSize: 10,
            color: "#555",
            background: "#fff",
            border: "1px solid " + badge.border,
            borderRadius: 4,
            padding: "4px 8px",
            lineHeight: 1.65,
            marginBottom: 5,
          }}
        >
          <div style={{ fontSize: 9, color: "#888", fontWeight: 700, marginBottom: 2 }}>
            대표 영상 제목
          </div>
          {discovery.sampleTitles.slice(0, 3).map((t, i) => (
            <div
              key={i}
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={t}
            >
              · {t}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={addToOpportunities}
          disabled={added}
          title={added ? "이미 매트릭스 목록에 있습니다" : "사용자 추가 카테고리로 즉시 매트릭스에 등장"}
          style={{
            padding: "4px 10px",
            fontSize: 10.5,
            fontWeight: 700,
            background: added ? "#10B981" : badge.color,
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: added ? "default" : "pointer",
          }}
        >
          {added ? "✅ 추가됨" : "✅ 기회 목록에 추가"}
        </button>
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(discovery.keyword)}&sp=EgIYAg%253D%253D`}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "4px 10px",
            fontSize: 10.5,
            fontWeight: 700,
            background: "#fff",
            color: "#666",
            border: "1px solid #E5E7EB",
            borderRadius: 4,
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          🔗 YouTube 검색 결과 보기
        </a>
      </div>
    </div>
  );
}

// ─── 정식 등록용 코드 내보내기 패널 ──────────────────────────────────────────
function ExportPanel({ customs, onChange }) {
  const code = exportCustomsAsCode();
  const [copied, setCopied] = useState(false);
  function copyAll() {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => window.prompt("클립보드 복사 실패. Ctrl+C 로 복사하세요:", code));
  }
  return (
    <div
      style={{
        marginTop: 6,
        padding: "10px 12px",
        background: "#fff",
        border: "1px solid #FED7AA",
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 11, color: "#7C2D12", marginBottom: 6, lineHeight: 1.6 }}>
        아래 코드를 <code>lib/data.js</code> 의 D 배열 마지막 <code>];</code> 직전에 붙여넣고
        커밋·배포하면, 모든 사용자에게 동일 카테고리가 노출됩니다 (localStorage 의존 해소).
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
        <button
          onClick={copyAll}
          style={{
            padding: "4px 10px",
            fontSize: 10.5,
            fontWeight: 700,
            background: copied ? "#10B981" : "#9A3412",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {copied ? "✓ 복사됨" : "📋 전체 코드 클립보드 복사"}
        </button>
        {customs.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              if (confirm(`"${c.n}" 을 사용자 목록에서 제거할까요?`)) {
                removeCustomCategory(c.id);
                if (onChange) onChange();
              }
            }}
            title={`#${c.id} ${c.n} 제거`}
            style={{
              padding: "3px 9px",
              fontSize: 10,
              background: "#FFFBEB",
              color: "#92400E",
              border: "1px solid #FDE68A",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            🗑️ #{c.id} {c.n.length > 10 ? c.n.slice(0, 10) + "…" : c.n}
          </button>
        ))}
      </div>
      <pre
        style={{
          fontSize: 9.5,
          background: "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: 4,
          padding: 8,
          maxHeight: 240,
          overflow: "auto",
          margin: 0,
          color: "#374151",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {code}
      </pre>
    </div>
  );
}
