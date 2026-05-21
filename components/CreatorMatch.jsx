"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadYoutubeCreatorsMap,
  getYoutubeCreatorsForId,
  setYoutubeCreatorsForId,
  loadClaudeBriefsMap,
  getClaudeBrief,
  setClaudeBrief,
} from "@/lib/ai-cache";

const TIER_INFO = {
  mega: { label: "메가", desc: "100만+", color: "#7C3AED", bg: "#FAF5FF", border: "#DDD6FE" },
  macro: { label: "매크로", desc: "10~100만", color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE" },
  micro: { label: "마이크로", desc: "1~10만", color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0" },
  nano: { label: "나노", desc: "<1만", color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" },
};

function fmtNum(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function daysAgo(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// 네이버 쇼핑 인사이트 → 타겟 페르소나 한 문장
function buildPersona(naverShopping) {
  if (!naverShopping?.breakdown) return null;
  const gs = (naverShopping.breakdown.gender || []).slice();
  const ages = (naverShopping.breakdown.age || []).slice();
  if (!gs.length && !ages.length) return null;
  const sumG = gs.reduce((s, x) => s + x.ratio, 0) || 1;
  const dominantG = gs
    .map((x) => ({ ...x, pct: Math.round((x.ratio / sumG) * 100) }))
    .sort((a, b) => b.pct - a.pct)[0];
  const sumA = ages.reduce((s, x) => s + x.ratio, 0) || 1;
  const topAges = ages
    .map((x) => ({ ...x, pct: Math.round((x.ratio / sumA) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2);

  const genderText = dominantG
    ? `${dominantG.group === "f" ? "여성" : "남성"} ${dominantG.pct}%`
    : "";
  const ageText = topAges.length
    ? topAges.map((a) => `${a.group}대 ${a.pct}%`).join(" · ")
    : "";

  let strategy;
  if (dominantG?.group === "f" && dominantG.pct >= 55) {
    strategy = "뷰티/라이프스타일 여성 크리에이터 우선";
  } else if (dominantG?.group === "m" && dominantG.pct >= 55) {
    strategy = "테크/리뷰/스포츠 남성 크리에이터 우선";
  } else {
    strategy = "성별 균형, 콘텐츠 주제 적합도 우선";
  }
  return { genderText, ageText, strategy };
}

export default function CreatorMatch({ cat, ai, naverShopping }) {
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tierFilter, setTierFilter] = useState("recommended"); // recommended | all
  const [briefs, setBriefs] = useState({}); // channelId → brief entry

  // 카테고리 변경 시 캐시 로드
  useEffect(() => {
    if (!cat) return;
    setScan(getYoutubeCreatorsForId(loadYoutubeCreatorsMap(), cat.id));
    setBriefs(loadClaudeBriefsMap());
    setError(null);
  }, [cat?.id]);

  async function runScan() {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/youtube-creators?categoryId=${cat.id}&geo=KR`;
      if (cat.id >= 1000) {
        const params = new URLSearchParams({
          n: cat.n || "",
          kwKR: cat.kw?.KR || "",
          kwUS: cat.kw?.US || "",
        });
        url += `&${params.toString()}`;
      }
      const res = await fetch(url, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setYoutubeCreatorsForId(cat.id, json);
      setScan({ ...json, scannedAt: new Date().toISOString() });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const persona = useMemo(() => buildPersona(naverShopping), [naverShopping]);

  const filtered = useMemo(() => {
    if (!scan?.creators) return [];
    if (tierFilter === "recommended") {
      // 어필리에이트 최적 = micro + macro
      return scan.creators.filter((c) => c.tier === "micro" || c.tier === "macro");
    }
    return scan.creators;
  }, [scan, tierFilter]);

  const grouped = useMemo(() => {
    const g = { mega: [], macro: [], micro: [], nano: [] };
    filtered.forEach((c) => g[c.tier]?.push(c));
    return g;
  }, [filtered]);

  if (!cat) return null;

  return (
    <div>
      {/* 스캔 트리거 / 상태 */}
      <div
        style={{
          padding: "10px 12px",
          background: scan ? "#fff" : "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          marginBottom: 10,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, fontSize: 11, color: "#555", lineHeight: 1.6 }}>
          {scan ? (
            <>
              <div>
                <span style={{ color: "#999" }}>마지막 스캔:</span>{" "}
                <b style={{ color: "#222" }}>{fmtDate(scan.scannedAt)}</b> ·{" "}
                <span style={{ color: "#999" }}>크리에이터</span>{" "}
                <b style={{ color: "#3B82F6" }}>{scan.creators?.length || 0}명</b> 발견
              </div>
              <div style={{ marginTop: 2, color: "#888" }}>
                키워드 "{scan.keyword}" (KR) · 쿼터 {scan.quotaUsed}/{scan.quotaDailyFree} units
              </div>
            </>
          ) : (
            <div>
              YouTube Search + Channels API 2단계 호출 · 예상 쿼터{" "}
              <b style={{ color: "#4338CA" }}>~101 units</b> (일일 한도 10,000)
            </div>
          )}
        </div>
        <button
          onClick={runScan}
          disabled={loading}
          style={{
            padding: "8px 14px",
            background: loading
              ? "#C7D2FE"
              : "linear-gradient(135deg,#EF4444,#DC2626)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "스캔 중…" : scan ? "🔄 다시 스캔" : "🎬 크리에이터 스캔"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "8px 10px",
            marginBottom: 8,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            fontSize: 10.5,
            color: "#B91C1C",
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      )}

      {/* 결과 */}
      {scan && (
        <>
          {/* 요약 + 페르소나 추천 */}
          <div
            style={{
              padding: "10px 12px",
              marginBottom: 8,
              background: "linear-gradient(135deg,#FFF7ED,#FEF2F2)",
              border: "1px solid #FED7AA",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#9A3412", marginBottom: 4 }}>
              📋 매칭 요약
            </div>
            <div style={{ fontSize: 11, color: "#7C2D12", lineHeight: 1.7 }}>
              "{cat.n}"에 활동 중인 크리에이터 <b>{scan.creators?.length || 0}명</b> 발견. (메가{" "}
              {scan.summary?.byTier?.mega || 0} · 매크로{" "}
              {scan.summary?.byTier?.macro || 0} · 마이크로{" "}
              <b>{scan.summary?.byTier?.micro || 0}</b> · 나노{" "}
              {scan.summary?.byTier?.nano || 0})
              <br />
              <span style={{ color: "#9A3412", fontWeight: 700 }}>
                💡 마이크로 {scan.summary?.byTier?.micro || 0}명이 어필리에이트 최적.
              </span>{" "}
              {persona && (
                <>
                  <br />
                  네이버 쇼핑인사이트 · 구매자 {persona.genderText}
                  {persona.ageText && ` · ${persona.ageText}`} →{" "}
                  <b>{persona.strategy}</b>
                </>
              )}
            </div>
          </div>

          {/* 필터 */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {[
              { id: "recommended", l: "💡 어필리에이트 최적 (마이크로·매크로)" },
              { id: "all", l: `전체 (${scan.creators?.length || 0})` },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTierFilter(opt.id)}
                style={{
                  padding: "4px 12px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  border: "1px solid",
                  borderColor: tierFilter === opt.id ? "#EF4444" : "#E5E7EB",
                  background: tierFilter === opt.id ? "#FEF2F2" : "#fff",
                  color: tierFilter === opt.id ? "#B91C1C" : "#666",
                  borderRadius: 99,
                  cursor: "pointer",
                }}
              >
                {opt.l}
              </button>
            ))}
          </div>

          {/* 티어별 그룹 */}
          {["macro", "micro", "mega", "nano"].map((tier) => {
            const list = grouped[tier];
            if (!list?.length) return null;
            const info = TIER_INFO[tier];
            return (
              <div key={tier} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    margin: "6px 0 4px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: info.color,
                  }}
                >
                  <span>{info.label}</span>
                  <span style={{ fontSize: 9.5, color: "#888" }}>{info.desc}</span>
                  <span style={{ fontSize: 9.5, color: "#888" }}>· {list.length}명</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {list.map((c) => (
                    <CreatorCard
                      key={c.channelId}
                      creator={c}
                      cat={cat}
                      ai={ai}
                      naverShopping={naverShopping}
                      brief={getClaudeBrief(briefs, cat.id, c.channelId)}
                      onBriefSaved={() => setBriefs(loadClaudeBriefsMap())}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ fontSize: 11, color: "#999", padding: "8px 12px" }}>
              해당 티어 크리에이터가 없습니다. "전체" 필터로 다른 티어를 보세요.
            </div>
          )}

          <p style={{ fontSize: 9.5, color: "#AAA", marginTop: 10, lineHeight: 1.5 }}>
            ※ 적합도 점수 = relevantVideos(40%) + avgViews(30%) + 최근 활동(20%) + 구독자(10%).
            "브리프 생성" 은 Claude API 로 채널별 맞춤 협업 제안 메일을 만듭니다 (카테고리당 약
            $0.005).
          </p>
        </>
      )}
    </div>
  );
}

// ─── 크리에이터 카드 + 브리프 생성 ───────────────────────────────────────────

function CreatorCard({ creator, cat, ai, naverShopping, brief: initialBrief, onBriefSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [brief, setBrief] = useState(initialBrief);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const info = TIER_INFO[creator.tier];
  const days = daysAgo(creator.recentUpload);

  async function generateBrief() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/claude-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryId: cat.id,
          // 커스텀 카테고리는 객체 동봉
          category: cat.id >= 1000 ? cat : undefined,
          creator,
          ai,
          naverShopping,
        }),
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const entry = {
        brief: json.brief,
        usage: json.usage,
        estCostUSD: json.estCostUSD,
        parseError: json.parseError,
      };
      setClaudeBrief(cat.id, creator.channelId, entry);
      setBrief({ ...entry, savedAt: new Date().toISOString() });
      setExpanded(true);
      if (onBriefSaved) onBriefSaved();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const channelUrl = `https://www.youtube.com/channel/${creator.channelId}`;
  const videoUrl = creator.sampleVideoId
    ? `https://www.youtube.com/watch?v=${creator.sampleVideoId}`
    : null;

  return (
    <div
      style={{
        padding: "8px 10px",
        background: "#fff",
        border: `1px solid ${info.border}`,
        borderLeft: `3px solid ${info.color}`,
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {creator.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creator.thumbnail}
            alt={creator.name}
            width={36}
            height={36}
            style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#222",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <a
              href={channelUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#222", textDecoration: "none" }}
              title="채널 열기"
            >
              {creator.name}
            </a>
          </div>
          <div style={{ fontSize: 9.5, color: "#888", marginTop: 1 }}>
            구독 <b style={{ color: "#444" }}>{fmtNum(creator.subscribers)}</b> · 평균조회{" "}
            <b style={{ color: "#444" }}>{fmtNum(creator.avgViews)}</b> · 영상{" "}
            <b style={{ color: "#444" }}>{fmtNum(creator.videoCount)}</b>
            {days != null && (
              <>
                {" "}
                · 최근 활동{" "}
                <b style={{ color: days <= 30 ? "#059669" : days <= 90 ? "#D97706" : "#DC2626" }}>
                  {days}일 전
                </b>
              </>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#fff",
            background: info.color,
            borderRadius: 99,
            padding: "2px 9px",
            whiteSpace: "nowrap",
          }}
          title="적합도 점수"
        >
          🎯 {creator.fitScore}
        </span>
      </div>

      {/* 대표 영상 */}
      {creator.sampleVideoTitle && (
        <div
          style={{
            marginTop: 5,
            padding: "4px 8px",
            background: "#F9FAFB",
            borderRadius: 4,
            fontSize: 10,
            color: "#555",
            lineHeight: 1.5,
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span style={{ color: "#888" }}>📺</span>
          <span
            style={{
              flex: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={creator.sampleVideoTitle}
          >
            {videoUrl ? (
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#444", textDecoration: "none" }}
              >
                {creator.sampleVideoTitle}
              </a>
            ) : (
              creator.sampleVideoTitle
            )}
          </span>
          <span style={{ color: "#999", fontSize: 9 }}>
            관련 영상 {creator.relevantVideos}건
          </span>
        </div>
      )}

      {/* 브리프 액션 */}
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        {brief?.brief ? (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: "4px 10px",
                background: expanded ? "#fff" : "#EEF2FF",
                color: "#4338CA",
                border: "1px solid #C7D2FE",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {expanded ? "▲ 브리프 닫기" : "▼ 브리프 열기"}
            </button>
            <button
              onClick={generateBrief}
              disabled={loading}
              style={{
                fontSize: 10,
                padding: "4px 8px",
                background: "transparent",
                color: "#888",
                border: "1px solid #E5E7EB",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              🔄 다시
            </button>
          </>
        ) : (
          <button
            onClick={generateBrief}
            disabled={loading}
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "4px 10px",
              background: loading ? "#C7D2FE" : "linear-gradient(135deg,#7C3AED,#4338CA)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "생성 중…" : "🤖 브리프 생성"}
          </button>
        )}
        {brief?.estCostUSD != null && (
          <span style={{ fontSize: 9.5, color: "#888", alignSelf: "center", marginLeft: "auto" }}>
            ${brief.estCostUSD.toFixed(5)}
          </span>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 10, color: "#DC2626", marginTop: 4, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {expanded && brief?.brief && <BriefView brief={brief.brief} />}
    </div>
  );
}

function BriefView({ brief }) {
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
      {brief.subject && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: "#6B7280", fontWeight: 700 }}>이메일 제목</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#222", lineHeight: 1.5 }}>
            {brief.subject}
          </div>
        </div>
      )}
      <BriefSection label="👋 인사" value={brief.greeting} />
      <BriefSection label="📦 제품 소개" value={brief.productPitch} />
      <BriefSection label="🎬 콘셉트 제안" value={brief.conceptProposal} />
      <BriefSection label="💰 수수료" value={brief.commission} />
      <BriefSection label="🎯 다음 액션" value={brief.cta} />
      {brief.tone && (
        <div style={{ marginTop: 6, fontSize: 9.5, color: "#6B7280" }}>
          톤: <b>{brief.tone}</b>
        </div>
      )}
    </div>
  );
}

function BriefSection({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ fontSize: 9, color: "#6B7280", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#222", lineHeight: 1.65 }}>{value}</div>
    </div>
  );
}
