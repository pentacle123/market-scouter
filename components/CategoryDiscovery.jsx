"use client";

import { useEffect, useMemo, useState } from "react";
import { D, TL, TC, TB, TBR } from "@/lib/data";
import { CACHE_KEYS, loadJson, saveJson } from "@/lib/ai-cache";

const EXISTING_IDS = D.map((c) => c.id).sort((a, b) => a - b);

function nextAvailableId(type) {
  // type 별 ID 영역: blue 1-9, gap 10-19, cond 20-29, no 30-39
  const range = {
    blue: [1, 9],
    gap: [10, 19],
    cond: [20, 29],
    no: [30, 39],
  }[type] || [40, 99];
  const used = new Set(EXISTING_IDS);
  for (let i = range[0]; i <= range[1]; i++) {
    if (!used.has(i)) return i;
  }
  // 영역이 가득 찼으면 40+ 에서 빈 자리
  let i = 40;
  while (used.has(i)) i++;
  return i;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function buildDataJsTemplate(discovery) {
  // 기존 30개 ID 영역에 맞춰 ID 자동 부여
  const id = nextAvailableId(discovery.estimatedType);
  const baseScores =
    discovery.estimatedType === "blue"
      ? { L1: 80, L2: 55, L3: 85, L4: 75, L5: 75, L6: 70 }
      : discovery.estimatedType === "gap"
        ? { L1: 80, L2: 75, L3: 60, L4: 75, L5: 78, L6: 75 }
        : { L1: 75, L2: 75, L3: 65, L4: 72, L5: 75, L6: 72 };

  return {
    id,
    n: discovery.name,
    e: "🆕",
    mk: "추정",
    lc: "도입기",
    type: discovery.estimatedType,
    kw: { US: discovery.keyword, KR: discovery.name },
    naverCid: null,
    ...baseScores,
    verdict: discovery.reasoning?.slice(0, 80) || `${discovery.nameEn} 신규 발굴 카테고리`,
    why: discovery.reasoning || "",
    layers: {
      L1: `US YouTube 발견 · 평균 조회 ${(discovery.avgViews || 0).toLocaleString()}`,
      L2: "네이버 검색 트렌드 미수집 (Phase 2 스캔 필요)",
      L3: `${TL[discovery.estimatedType]} 추정`,
      L4: "소비자 불만 미수집",
      L5: "발견 영상 기반 — 추가 분석 필요",
      L6: "OEM/파트너 미조사",
    },
    pains: [],
    rev: { cost: "-", price: "-", margin: "-", bep: "-", note: "-" },
    ttm: "-",
    risks: ["신규 발굴 — 시장 검증 필요"],
    partners: [],
    expand: [],
  };
}

function formatAsJsObjectLiteral(obj) {
  // data.js 의 한 줄 객체 형식으로 변환 (eslint 친화 + 기존 데이터와 동일 형식)
  return JSON.stringify(obj, null, 2);
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

  useEffect(() => {
    setData(loadJson(CACHE_KEYS.discoveries));
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
            <DiscoveryCard key={i} discovery={d} />
          ))}
        </div>
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

function DiscoveryCard({ discovery }) {
  const [copied, setCopied] = useState(false);
  const badge = TYPE_BADGE[discovery.estimatedType] || TYPE_BADGE.cond;

  function copyTemplate() {
    const obj = buildDataJsTemplate(discovery);
    const text = formatAsJsObjectLiteral(obj);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        // fallback — alert with text
        window.prompt("클립보드 복사 실패. Ctrl+C 로 직접 복사하세요:", text);
      });
  }

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
          onClick={copyTemplate}
          style={{
            padding: "4px 10px",
            fontSize: 10.5,
            fontWeight: 700,
            background: copied ? "#10B981" : "#fff",
            color: copied ? "#fff" : badge.color,
            border: `1px solid ${badge.color}`,
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {copied ? "✓ 복사됨" : "📋 data.js 형식 복사"}
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
