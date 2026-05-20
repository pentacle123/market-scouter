// 사업 심사 (Phase 3) 계산 라이브러리.
//
// 1) GO/NO-GO 12체크 자동 도출 (Claude 8축 + GUIDE 데이터 → ✅/⚠️/❌)
// 2) Unit Economics 계산 (CAC / LTV / 실질 마진 / BEP)
// 3) Bull/Base/Bear 시나리오 시뮬
// 4) 현금흐름 시뮬 (OEM 선입금 → 정산까지의 월별 현금 잔액)
// 5) GUIDE c.rev 텍스트 → 시드 숫자 추출

// ─── GO/NO-GO 12체크 자동 도출 ────────────────────────────────────────────────

const CHECK_ITEMS = [
  { key: "market", label: "시장 매력도", refs: "A-1,2,3" },
  { key: "duration", label: "트렌드 지속성", refs: "A-4" },
  { key: "tailwind", label: "구조적 순풍", refs: "A-5,6" },
  { key: "koreaFit", label: "한국 적합성", refs: "B-3,4" },
  { key: "competition", label: "경쟁 진입 가능", refs: "B-1" },
  { key: "differentiation", label: "제품 차별화", refs: "C-2,3" },
  { key: "partners", label: "파트너 확보", refs: "B-2" },
  { key: "unitEcon", label: "수익성", refs: "D-1,2" },
  { key: "cashflow", label: "현금흐름 감당", refs: "D-3" },
  { key: "ourFit", label: "우리 역량 적합", refs: "C-1,4" },
  { key: "noKillRisk", label: "킬 리스크 없음", refs: "E-1" },
  { key: "timing", label: "타이밍 적합", refs: "E-2" },
];

function judge(score, { good = 70, ok = 50 } = {}) {
  if (score == null) return { icon: "❓", color: "#9CA3AF" };
  if (score >= good) return { icon: "✅", color: "#059669" };
  if (score >= ok) return { icon: "⚠️", color: "#D97706" };
  return { icon: "❌", color: "#DC2626" };
}

/**
 * 12체크 자동 도출.
 * @param {object} cat — D 카테고리
 * @param {object|null} ai — Claude 8축 분석 (없으면 자동 도출 불완전)
 * @param {object} ue — Unit Economics 계산 결과 (선택)
 * @param {object} cf — 현금흐름 계산 결과 (선택)
 * @returns {{ items: Array, confidence: number, goLevel: "GO"|"CONDITIONAL GO"|"NO-GO" }}
 */
export function computeChecklist(cat, ai, ue, cf) {
  const items = CHECK_ITEMS.map((it) => {
    let score = null;
    let note = "";
    switch (it.key) {
      case "market": {
        score = ai?.verdict?.score ?? null;
        note = ai?.verdict?.oneLine || cat?.verdict || "";
        break;
      }
      case "duration": {
        score = ai?.trendDuration?.score ?? null;
        const v = ai?.trendDuration?.verdict;
        note = v ? `${v} 트렌드` : "";
        if (v === "반짝") {
          // 반짝 트렌드는 자동 ❌ (점수 무관)
          return { ...it, icon: "❌", color: "#DC2626", score, note };
        }
        break;
      }
      case "tailwind": {
        score = ai?.megatrendTailwind?.score ?? null;
        note = ai?.megatrendTailwind?.keyTailwind || "";
        break;
      }
      case "koreaFit": {
        const fit = ai?.koreaCulturalFit?.score ?? null;
        const adopt = ai?.adoptionSpeed?.score ?? null;
        if (fit != null && adopt != null) score = Math.round((fit + adopt) / 2);
        const a = ai?.adoptionSpeed?.verdict;
        const f = ai?.koreaCulturalFit?.verdict;
        note = [f, a].filter(Boolean).join(" · ");
        break;
      }
      case "competition": {
        // 경쟁 강도는 낮을수록 좋음 — 반전
        const comp = ai?.competition?.score;
        if (comp != null) score = 100 - comp;
        note = ai?.competition?.entryBarrier || "";
        break;
      }
      case "differentiation": {
        const aiPainCount = (ai?.pains || []).length;
        const guidePainCount = (cat?.pains || []).length;
        const total = aiPainCount + guidePainCount;
        if (total >= 4) score = 85;
        else if (total >= 2) score = 65;
        else if (total >= 1) score = 45;
        else score = 25;
        note = `소비자 불만 ${total}건 식별`;
        break;
      }
      case "partners": {
        const n = (cat?.partners || []).length;
        if (n >= 3) score = 80;
        else if (n >= 2) score = 60;
        else if (n >= 1) score = 40;
        else score = 20;
        note = `${n}개 파트너 후보`;
        break;
      }
      case "unitEcon": {
        if (ue?.ltvCacRatio != null) {
          if (ue.ltvCacRatio >= 3) score = 85;
          else if (ue.ltvCacRatio >= 2) score = 65;
          else if (ue.ltvCacRatio >= 1) score = 45;
          else score = 25;
          note = `LTV/CAC ${ue.ltvCacRatio.toFixed(1)}x · 실질마진 ${ue.realMarginPct.toFixed(0)}%`;
        } else if (cat?.rev?.margin && cat.rev.margin !== "-") {
          // GUIDE c.rev.margin 텍스트에서 % 파싱 시도
          const m = parseMarginPct(cat.rev.margin);
          if (m != null) {
            score = m >= 65 ? 75 : m >= 50 ? 55 : m >= 30 ? 40 : 25;
            note = `표면 마진 ${m}% (실측 입력 필요)`;
          } else {
            score = 50;
            note = "Unit Economics 입력 필요";
          }
        } else {
          score = 30;
          note = "GUIDE 수익성 데이터 없음";
        }
        break;
      }
      case "cashflow": {
        if (cf?.maxDeficit != null && cf?.runwayMonths != null) {
          // 최대 자금 부족 시점 + 회수 기간으로 평가
          if (cf.runwayMonths <= 4 && cf.maxDeficit <= cf.initialBudget * 1.1) score = 80;
          else if (cf.runwayMonths <= 6) score = 60;
          else if (cf.runwayMonths <= 9) score = 45;
          else score = 25;
          note = `${cf.runwayMonths}개월 회수 · 최대 부족 ${formatKRW(cf.maxDeficit)}`;
        } else {
          score = 50;
          note = "현금흐름 입력 필요";
        }
        break;
      }
      case "ourFit": {
        score = ai?.viral?.score ?? null;
        note = ai?.viral?.creatorFit || "";
        break;
      }
      case "noKillRisk": {
        // c.risks 분석 + Claude entryBarrier
        const risks = cat?.risks || [];
        // 킬 키워드: "의료기기", "인허가", "특허", "대기업", "독과점", "규제"
        const killKeywords = ["의료기기", "인허가", "특허", "대기업", "독과점", "규제", "식약처"];
        const killHits = risks.filter((r) =>
          killKeywords.some((k) => r.includes(k))
        ).length;
        if (killHits >= 2) score = 30;
        else if (killHits === 1) score = 55;
        else if (risks.length >= 2) score = 70;
        else score = 80;
        note =
          killHits > 0
            ? `킬 리스크 ${killHits}건 (${risks.filter((r) => killKeywords.some((k) => r.includes(k))).join(", ")})`
            : risks.length
              ? `일반 리스크 ${risks.length}건`
              : "특이 리스크 없음";
        break;
      }
      case "timing": {
        // Claude verdict.score 와 trendDuration 조합으로 판정
        const v = ai?.verdict?.score ?? null;
        const dur = ai?.trendDuration?.verdict;
        if (dur === "반짝") {
          score = Math.min(v ?? 40, 50);
          note = "반짝 트렌드 — 지금 안 들어가면 끝";
        } else if (dur === "장기" && v != null && v >= 70) {
          score = 80;
          note = "장기 트렌드 + 검증 단계 — 지금이 골든타임";
        } else {
          score = v;
          note = ai?.verdict?.nextAction || "";
        }
        break;
      }
      default:
        score = null;
    }
    const j = judge(score);
    return { ...it, score, note, icon: j.icon, color: j.color };
  });

  // 확신도 = (✅ 점수 1.0 + ⚠️ 점수 0.5 + ❌ 점수 0) 평균
  const weight = { "✅": 1.0, "⚠️": 0.5, "❌": 0.0, "❓": 0.5 };
  const confidence = Math.round(
    (items.reduce((s, it) => s + weight[it.icon], 0) / items.length) * 100
  );

  // 종합 판정 — ❌ 가 4개 이상이거나 킬 리스크 ❌ 면 NO-GO
  const failedCount = items.filter((x) => x.icon === "❌").length;
  const okCount = items.filter((x) => x.icon === "✅").length;
  const killRiskFailed = items.find((x) => x.key === "noKillRisk")?.icon === "❌";
  let goLevel;
  if (killRiskFailed || failedCount >= 5) goLevel = "NO-GO";
  else if (okCount >= 8 && failedCount <= 1) goLevel = "GO";
  else goLevel = "CONDITIONAL GO";

  return { items, confidence, goLevel, okCount, warnCount: items.filter((x) => x.icon === "⚠️").length, failedCount };
}

/**
 * 확신도 계산 근거 추출 — 12체크 결과에서 주요 감점 사유 식별.
 * @param {object} checklist — computeChecklist 결과
 * @returns {{
 *   okCount, warnCount, failedCount,
 *   topDeductions: Array<{label, icon, note}>,  // 가장 영향 큰 감점 항목 (최대 3건)
 *   summary: string  // "12개 중 N 긍정, N 주의, N 부정 · 주요 감점: [A], [B]"
 * }}
 */
export function explainConfidence(checklist) {
  if (!checklist) return null;
  const { okCount, warnCount, failedCount, items } = checklist;
  // ❌ 우선, 그 다음 ⚠️ 점수 낮은 순으로 정렬
  const deductions = items
    .filter((x) => x.icon === "❌" || x.icon === "⚠️")
    .sort((a, b) => {
      const rank = { "❌": 0, "⚠️": 1, "✅": 2, "❓": 3 };
      if (rank[a.icon] !== rank[b.icon]) return rank[a.icon] - rank[b.icon];
      return (a.score ?? 0) - (b.score ?? 0);
    });
  const topDeductions = deductions.slice(0, 3).map((x) => ({
    label: x.label,
    icon: x.icon,
    note: x.note || "",
  }));

  const summaryParts = [`12개 중 ✅${okCount} ⚠️${warnCount} ❌${failedCount}`];
  if (topDeductions.length) {
    summaryParts.push(`주요 감점: ${topDeductions.map((d) => `[${d.label}]`).join(" ")}`);
  }
  return {
    okCount,
    warnCount,
    failedCount,
    topDeductions,
    summary: summaryParts.join(" · "),
  };
}

// ─── 리스크 분류 (킬 / 최대 / 일반) ──────────────────────────────────────────

const KILL_RISK_KEYWORDS = ["의료기기", "인허가", "특허", "대기업", "독과점", "규제", "식약처"];

/**
 * cat.risks 배열을 분석해서 킬 리스크와 일반 리스크로 분류.
 * 최대 리스크는 킬 리스크가 있으면 그 중 첫 번째, 없으면 일반 리스크 첫 번째.
 * @param {object} cat
 * @returns {{
 *   killRisks: Array<{text, matchedKeyword}>,
 *   normalRisks: string[],
 *   topRisk: {text, isKill, matchedKeyword?}|null
 * }}
 */
export function classifyRisks(cat) {
  const risks = cat?.risks || [];
  const killRisks = [];
  const normalRisks = [];
  risks.forEach((r) => {
    const matched = KILL_RISK_KEYWORDS.find((k) => r.includes(k));
    if (matched) killRisks.push({ text: r, matchedKeyword: matched });
    else normalRisks.push(r);
  });
  const topRisk = killRisks.length
    ? { text: killRisks[0].text, isKill: true, matchedKeyword: killRisks[0].matchedKeyword }
    : normalRisks.length
      ? { text: normalRisks[0], isKill: false }
      : null;
  return { killRisks, normalRisks, topRisk, total: risks.length };
}

// ─── Unit Economics ───────────────────────────────────────────────────────────

/**
 * @param {object} input
 * @param {number} input.adSpend            월 마케팅비 (원)
 * @param {number} input.conversions         월 전환 수 (개)
 * @param {number} input.avgOrderValue      평균 주문 금액 (원)
 * @param {number} input.repeatRate          재구매율 (0~1)
 * @param {number} input.purchasesPerYear    연 평균 구매 횟수
 * @param {number} input.cogs                제조원가 (원)
 * @param {number} input.packaging           포장비 (원)
 * @param {number} input.shipping            택배비 (원, 기본 3000)
 * @param {number} input.platformFeePct      플랫폼 수수료 % (0~100)
 * @param {number} input.cardFeePct          카드 수수료 % (기본 2.5)
 * @param {number} input.returnRatePct       반품률 % (기본 5)
 */
export function calcUnitEconomics(input) {
  const i = {
    adSpend: 0,
    conversions: 1,
    avgOrderValue: 0,
    repeatRate: 0,
    purchasesPerYear: 1,
    cogs: 0,
    packaging: 500,
    shipping: 3000,
    platformFeePct: 10,
    cardFeePct: 2.5,
    returnRatePct: 5,
    ...input,
  };

  const cac = i.conversions > 0 ? i.adSpend / i.conversions : Infinity;

  // 실질 마진 (단위당)
  const platformFee = i.avgOrderValue * (i.platformFeePct / 100);
  const cardFee = i.avgOrderValue * (i.cardFeePct / 100);
  const returnCost = i.avgOrderValue * (i.returnRatePct / 100) * 0.5; // 반품 시 손실
  const realCostPerUnit = i.cogs + i.packaging + i.shipping + platformFee + cardFee + returnCost;
  const realMarginPerUnit = i.avgOrderValue - realCostPerUnit;
  const realMarginPct = i.avgOrderValue > 0 ? (realMarginPerUnit / i.avgOrderValue) * 100 : 0;

  // LTV (단순 모델: 첫 주문 + 재구매)
  const totalPurchasesPerCustomer = 1 + i.repeatRate * (i.purchasesPerYear - 1);
  const ltv = realMarginPerUnit * totalPurchasesPerCustomer;
  const ltvCacRatio = cac > 0 && isFinite(cac) ? ltv / cac : null;

  // BEP (월 몇 개 팔면 광고비 회수)
  const bepUnits = realMarginPerUnit > 0 ? Math.ceil(i.adSpend / realMarginPerUnit) : Infinity;

  return {
    input: i,
    cac,
    realCostPerUnit,
    realMarginPerUnit,
    realMarginPct,
    surfaceMarginPct: i.avgOrderValue > 0 ? ((i.avgOrderValue - i.cogs) / i.avgOrderValue) * 100 : 0,
    ltv,
    ltvCacRatio,
    bepUnits,
    monthlyRevenue: i.avgOrderValue * i.conversions,
    monthlyMargin: realMarginPerUnit * i.conversions,
    monthlyNetProfit: realMarginPerUnit * i.conversions - i.adSpend,
  };
}

// ─── 시나리오 (Bull / Base / Bear) ────────────────────────────────────────────

export function buildScenarios(baseInput) {
  const scenarios = {
    bull: {
      label: "Bull (낙관)",
      adjustments: { conversions: 2.0, repeatRate: 1.5 },
      desc: "바이럴 성공, 재구매율 상승",
    },
    base: {
      label: "Base (기본)",
      adjustments: { conversions: 1.0, repeatRate: 1.0 },
      desc: "꾸준한 성장 (입력값 그대로)",
    },
    bear: {
      label: "Bear (비관)",
      adjustments: { conversions: 0.5, repeatRate: 0.6 },
      desc: "바이럴 실패, 재고 소진 지연",
    },
  };
  return Object.fromEntries(
    Object.entries(scenarios).map(([key, sc]) => {
      const adjusted = {
        ...baseInput,
        conversions: Math.round(baseInput.conversions * sc.adjustments.conversions),
        repeatRate: Math.min(1, baseInput.repeatRate * sc.adjustments.repeatRate),
      };
      const ue = calcUnitEconomics(adjusted);
      return [key, { ...sc, ue, adjusted }];
    })
  );
}

// ─── 현금흐름 시뮬 ────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {number} opts.initialBudget    초기 투자금 (원)
 * @param {number} opts.oemDeposit       OEM 선입금 비율 (0~1, 기본 0.3)
 * @param {number} opts.productionWeeks  생산 리드타임 (주, 기본 6)
 * @param {number} opts.settlementDays   정산 지연일 (기본 45)
 * @param {object} opts.ue               calcUnitEconomics 결과
 * @param {number} opts.months           시뮬 개월 수 (기본 9)
 */
export function simulateCashflow(opts) {
  const o = {
    initialBudget: 5000000, // 500만원
    oemDeposit: 0.3,
    productionWeeks: 6,
    settlementDays: 45,
    months: 9,
    ...opts,
  };
  const ue = o.ue;
  if (!ue) return null;

  // 초기 OEM 발주량: 첫 3개월치
  const oemUnits = ue.input.conversions * 3;
  const oemTotal = oemUnits * ue.input.cogs;
  const oemPaymentMonth0 = oemTotal * o.oemDeposit;
  const oemPaymentMonth2 = oemTotal * (1 - o.oemDeposit); // 입고 시 잔금
  const inboundMonth = Math.round(o.productionWeeks / 4); // 보통 1.5개월

  const months = [];
  let cash = o.initialBudget;
  let maxDeficit = o.initialBudget;
  let firstPositiveMonth = null;

  for (let m = 0; m <= o.months; m++) {
    // 광고비 매월 지출 (입고 후부터)
    if (m >= inboundMonth) cash -= ue.input.adSpend;
    // OEM 선입금 (M0) + 잔금 (입고 시)
    if (m === 0) cash -= oemPaymentMonth0;
    if (m === inboundMonth) cash -= oemPaymentMonth2;

    // 매출 정산 (입고 후 + 정산 지연)
    const settlementMonth = inboundMonth + Math.ceil(o.settlementDays / 30);
    if (m >= settlementMonth) {
      // 매월 매출 - 변동비 (광고비 제외 — 위에서 차감)
      const monthlyVarCost =
        ue.input.conversions *
        (ue.input.packaging +
          ue.input.shipping +
          ue.input.avgOrderValue * (ue.input.platformFeePct / 100) +
          ue.input.avgOrderValue * (ue.input.cardFeePct / 100));
      cash += ue.monthlyRevenue - monthlyVarCost;
    }

    months.push({ month: m, cash: Math.round(cash) });
    if (cash < maxDeficit) maxDeficit = cash;
    if (firstPositiveMonth === null && cash >= o.initialBudget * 0.5 && m >= inboundMonth + 2) {
      firstPositiveMonth = m;
    }
  }

  // runway = 첫 정산 후 회수까지 걸린 개월
  const runwayMonths = firstPositiveMonth ?? o.months;

  return {
    months,
    maxDeficit: Math.round(maxDeficit),
    finalCash: months[months.length - 1].cash,
    runwayMonths,
    initialBudget: o.initialBudget,
    inboundMonth,
    oemTotal: Math.round(oemTotal),
  };
}

// ─── GUIDE c.rev 텍스트 → 시드 숫자 ───────────────────────────────────────────

const NUM_RE = /(\d+(?:[.,]\d+)?)\s*(원|만|천원|만원)?/g;

/**
 * "원가 5~7만" → 60000 (중간값, 만 단위 변환)
 * "스틱당 1,500~2,000원" → 1750
 * "19.9만" → 199000
 */
export function parseRevToNumber(text) {
  if (!text || typeof text !== "string" || text === "-") return null;
  const nums = [];
  const cleaned = text.replace(/,/g, "");
  let match;
  const re = /(\d+(?:\.\d+)?)(만원|만|천원|원)?/g;
  while ((match = re.exec(cleaned))) {
    let n = parseFloat(match[1]);
    const unit = match[2];
    if (unit === "만원" || unit === "만") n *= 10000;
    else if (unit === "천원") n *= 1000;
    nums.push(n);
  }
  if (!nums.length) return null;
  // 범위면 평균
  if (nums.length >= 2) return Math.round((nums[0] + nums[1]) / 2);
  return Math.round(nums[0]);
}

export function parseMarginPct(text) {
  if (!text || typeof text !== "string" || text === "-") return null;
  const m = text.match(/(\d+)\s*~?\s*(\d+)?\s*%/);
  if (!m) return null;
  if (m[2]) return Math.round((parseInt(m[1]) + parseInt(m[2])) / 2);
  return parseInt(m[1]);
}

/**
 * GUIDE c.rev 객체에서 Unit Economics 시드값 추출.
 */
export function deriveSeedUnitEconomics(cat) {
  const rev = cat?.rev || {};
  const cogs = parseRevToNumber(rev.cost) || 30000;
  const price = parseRevToNumber(rev.price) || 100000;
  const bepText = rev.bep || "";
  const bepMatch = bepText.match(/(\d+(?:,\d+)?)\s*(스틱|대|개|세트|구독자|명)?/);
  const bepNum = bepMatch ? parseInt(bepMatch[1].replace(/,/g, "")) : 300;

  return {
    adSpend: 3000000, // 월 300만원
    conversions: bepNum,
    avgOrderValue: price,
    repeatRate: 0.3,
    purchasesPerYear: 2.5,
    cogs,
    packaging: 500,
    shipping: 3000,
    platformFeePct: 10,
    cardFeePct: 2.5,
    returnRatePct: 5,
  };
}

// ─── 포맷터 ───────────────────────────────────────────────────────────────────

export function formatKRW(n) {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100000000) return sign + (abs / 100000000).toFixed(1) + "억";
  if (abs >= 10000) return sign + (abs / 10000).toFixed(0) + "만";
  if (abs >= 1000) return sign + (abs / 1000).toFixed(0) + "천";
  return sign + abs.toLocaleString();
}

export function formatKRWFull(n) {
  if (n == null || !isFinite(n)) return "—";
  return n.toLocaleString() + "원";
}

// ─── 진입 방식 추천 ───────────────────────────────────────────────────────────

export function recommendEntryMode(ai, ue) {
  // Claude verdict.score + LTV/CAC + 경쟁 강도로 진입 방식 결정
  const v = ai?.verdict?.score ?? 50;
  const comp = ai?.competition?.score ?? 50;
  const ratio = ue?.ltvCacRatio ?? 1;
  if (v >= 80 && comp <= 30 && ratio >= 2) {
    return { mode: "크리에이터 어필리에이트", desc: "재고 0, 가장 빠른 검증" };
  }
  if (v >= 70 && ratio >= 3) {
    return { mode: "RS (매출배분)", desc: "검증된 협업 모델" };
  }
  if (v >= 60 && comp <= 60) {
    return { mode: "CPS 또는 RS", desc: "조건부 진입, 단계적 확장" };
  }
  if (v >= 50) {
    return { mode: "테스트 어필리에이트", desc: "소규모 검증부터" };
  }
  return { mode: "진입 비추천", desc: "다른 카테고리 우선" };
}
