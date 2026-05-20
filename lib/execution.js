// 실행 계획 (Phase 4) 라이브러리.
// Phase 3 결과(Unit Economics + 현금흐름 + Exit) 를 입력으로 받아
// 월별 타임라인, 예산 분해, 성공 KPI, Year 1→2→3 비전을 자동 생성.

import { formatKRW, formatKRWFull } from "./business.js";

// ─── 월별 타임라인 ────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {object} opts.cat — D 카테고리
 * @param {object} opts.ue — calcUnitEconomics 결과
 * @param {object} opts.cashflow — simulateCashflow 결과
 * @param {object} opts.exit — { initialBudget, exitMonths, exitMinUnits, maxLoss }
 * @param {object} [opts.ai] — Claude 분석 (선택)
 * @returns {Array<Milestone>}
 */
export function buildTimeline({ cat, ue, cashflow, exit, ai }) {
  if (!ue || !cashflow) return [];

  const inboundM = cashflow.inboundMonth; // 보통 M2
  const runwayM = cashflow.runwayMonths;
  const exitM = exit?.exitMonths ?? 6;
  const oemDeposit = Math.round(cashflow.oemTotal * 0.3);
  const oemRemainder = cashflow.oemTotal - oemDeposit;
  const adMonthly = ue.input.adSpend;

  const milestones = [
    {
      month: -1,
      phase: "준비",
      label: "사전 준비",
      tasks: ["OEM 후보 3곳 샘플 비교", "디자인·패키지 확정", "필요 인증 사전 확인"],
      cost: 500_000,
      color: "#6B7280",
      kind: "prep",
    },
    {
      month: 0,
      phase: "발주",
      label: "OEM 발주 · 생산 시작",
      tasks: ["OEM 발주 (수량 3개월치)", `OEM 선입금 30% (${formatKRW(oemDeposit)})`, "크리에이터 매칭 협의"],
      cost: oemDeposit,
      color: "#F59E0B",
      kind: "order",
    },
  ];

  // 생산 기간 (입고 1개월 전 ~ 입고 직전)
  if (inboundM >= 2) {
    milestones.push({
      month: inboundM - 1,
      phase: "생산",
      label: "생산 중 · 사전 콘텐츠",
      tasks: ["크리에이터 콘텐츠 사전 제작", "랜딩페이지 · 상세페이지", "초도 100명 알파 테스터 모집"],
      cost: 300_000,
      color: "#8B5CF6",
      kind: "prep",
    });
  }

  // 입고 / 론칭
  milestones.push({
    month: inboundM,
    phase: "론칭",
    label: "입고 · 크리에이터 어필리에이트 시작",
    tasks: [
      `OEM 잔금 70% (${formatKRW(oemRemainder)})`,
      `광고 집행 시작 (월 ${formatKRW(adMonthly)})`,
      "크리에이터 5~10명 동시 송출",
      "발견 커머스 채널 노출",
    ],
    cost: oemRemainder + adMonthly,
    color: "#6366F1",
    kind: "launch",
  });

  // 첫 매출 (입고 + 1)
  milestones.push({
    month: inboundM + 1,
    phase: "초기",
    label: "초기 매출 분석",
    tasks: [
      `목표 월 판매 ${Math.round(ue.input.conversions * 0.5)}개 이상 (BEP 50%)`,
      "전환율 측정 → 광고 최적화",
      "리뷰 수집 · 부정 리뷰 즉시 대응",
    ],
    cost: adMonthly,
    color: "#3B82F6",
    kind: "operate",
  });

  // BEP 회수 (runwayM)
  if (runwayM > inboundM + 1) {
    milestones.push({
      month: runwayM,
      phase: "BEP",
      label: "BEP 달성 · 재발주 결정",
      tasks: [
        "초기 투자금 회수",
        "재발주 수량 산정 (3~6개월치)",
        "성공 시 RS 모델 협의 시작",
      ],
      cost: adMonthly,
      color: "#10B981",
      kind: "milestone",
    });
  }

  // Exit 판단
  milestones.push({
    month: exitM,
    phase: "판단",
    label: "Exit / 확장 판단",
    tasks: [
      `Exit 룰: 월 판매 ${exit?.exitMinUnits ?? 100}개 미만 시 중단`,
      `최대 손실 ${formatKRW(exit?.maxLoss ?? 5_000_000)} 초과 시 중단`,
      "계속 시: Y1 마무리 + 인접 확장 기획",
    ],
    cost: 0,
    color: "#F97316",
    kind: "decision",
  });

  // Y1 종료
  milestones.push({
    month: 12,
    phase: "Y1",
    label: "1년 종합 평가",
    tasks: [
      "연간 매출/마진 정산",
      "크리에이터 ROI · LTV/CAC 결산",
      "Year 2 인접 카테고리 선정",
    ],
    cost: 0,
    color: "#059669",
    kind: "review",
  });

  // 정렬 + 중복 제거
  return milestones.sort((a, b) => a.month - b.month);
}

// ─── 예산 분해 ────────────────────────────────────────────────────────────────

/**
 * 초기 투자금이 어디로 흘러가는지 분해.
 */
export function buildBudgetBreakdown({ ue, cashflow, exit }) {
  if (!ue || !cashflow) return null;
  const total = exit?.initialBudget ?? 5_000_000;
  const oemDeposit = Math.round(cashflow.oemTotal * 0.3);
  const oemRemainder = cashflow.oemTotal - oemDeposit;
  const ad3months = ue.input.adSpend * 3;
  const prepCosts = 800_000; // 준비비 (디자인·인증·콘텐츠)

  const fixed = oemDeposit + oemRemainder + ad3months + prepCosts;
  const balance = total - fixed; // 음수면 자금 부족
  const isShort = balance < 0;
  const reserve = Math.max(0, balance);
  const deficit = Math.max(0, -balance);

  // 마지막 항목은 예비비(흑자) 또는 자금 부족(적자)
  const items = [
    { key: "oem-deposit", label: "OEM 선입금 (30%)", amount: oemDeposit, color: "#F59E0B" },
    { key: "oem-remainder", label: "OEM 잔금 (70%)", amount: oemRemainder, color: "#FB923C" },
    { key: "ad-3m", label: "광고비 (3개월치)", amount: ad3months, color: "#6366F1" },
    { key: "prep", label: "사전 준비 (디자인·인증)", amount: prepCosts, color: "#8B5CF6" },
    isShort
      ? { key: "deficit", label: "🔴 자금 부족분 (추가 확보 필요)", amount: deficit, color: "#DC2626" }
      : { key: "reserve", label: "예비비", amount: reserve, color: "#10B981" },
  ];

  // 막대 비율은 "고정 사용분 + 흑자(예비비) 또는 부족분"의 합 기준으로 정규화
  // → 자금 부족 케이스에서도 막대가 100% 차지하고, 각 항목 pct 가 합리적으로 분할됨
  const denom = items.reduce((s, it) => s + Math.abs(it.amount), 0);

  return {
    total,
    fixed,
    reserve,
    isShort,
    deficit,
    items: items.map((it) => ({
      ...it,
      pct: denom > 0 ? (Math.abs(it.amount) / denom) * 100 : 0,
    })),
  };
}

// ─── 성공 KPI ─────────────────────────────────────────────────────────────────

export function buildSuccessKPIs({ ue, cashflow, exit }) {
  if (!ue || !cashflow) return [];
  const inboundM = cashflow.inboundMonth;
  const runwayM = cashflow.runwayMonths;
  const exitM = exit?.exitMonths ?? 6;
  const bep = ue.input.conversions;

  return [
    {
      month: inboundM + 1,
      label: "첫 매출 (M" + (inboundM + 1) + ")",
      kpi: "월 판매량",
      target: Math.round(bep * 0.5),
      unit: "개",
      desc: "BEP 50% — 초기 트랙션 검증",
      color: "#3B82F6",
    },
    {
      month: runwayM,
      label: "BEP 회수 (M" + runwayM + ")",
      kpi: "월 판매량",
      target: bep,
      unit: "개",
      desc: "광고비 + 마진 손익분기",
      color: "#10B981",
    },
    {
      month: exitM,
      label: "Exit 판단 (M" + exitM + ")",
      kpi: "월 판매량",
      target: exit?.exitMinUnits ?? bep,
      unit: "개",
      desc: "이 숫자 미만이면 중단",
      color: "#F97316",
    },
    {
      month: 12,
      label: "Y1 LTV/CAC",
      kpi: "LTV/CAC 비율",
      target: 3,
      unit: "x",
      desc: "유닛 이코노믹스 건강성",
      color: "#7C3AED",
    },
  ];
}

// ─── 인접 확장 비전 (Year 1 → 2 → 3) ──────────────────────────────────────────

export function buildExpansionVision(cat) {
  const expand = cat?.expand || [];
  const visionItem = expand.find((x) => x.startsWith("→"));
  const adjacents = expand.filter((x) => !x.startsWith("→"));

  return {
    year1: {
      label: "Year 1",
      title: cat?.n || "—",
      desc: "본 카테고리 검증 · 정착 · BEP 달성",
      color: "#3B82F6",
      kind: "current",
    },
    year2: {
      label: "Year 2",
      title: adjacents.length > 0 ? adjacents.slice(0, 2).join(" + ") : "인접 카테고리 확장",
      desc:
        adjacents.length > 0
          ? "검증된 크리에이터 네트워크 + 데이터로 확장"
          : "1년차 데이터로 인접 후보 발굴",
      color: "#7C3AED",
      kind: "adjacent",
    },
    year3: {
      label: "Year 3",
      title: visionItem ? visionItem.replace(/^→\s*/, "") : "통합 브랜드 구축",
      desc: "다 카테고리 통합 · 자체 브랜드(PB) 단계",
      color: "#059669",
      kind: "vision",
    },
    adjacentsAll: adjacents,
  };
}

// ─── 데이터 플라이휠 ──────────────────────────────────────────────────────────

export function buildDataFlywheel(cat) {
  return [
    {
      icon: "📈",
      label: "크리에이터 성과 DB",
      desc: "이 카테고리에서 ROI 높은 크리에이터 = 인접 카테고리에서도 가능성 높음",
    },
    {
      icon: "🎯",
      label: "전환 데이터",
      desc: "어떤 후킹 카피·썸네일·가격대가 한국에서 통하는지 학습",
    },
    {
      icon: "🏭",
      label: "OEM·물류 노하우",
      desc: "검증된 OEM 1곳은 인접 카테고리(예: 침구 → 수면 음료)에도 활용 가능",
    },
    {
      icon: "🛒",
      label: "채널 데이터",
      desc: "올리브영·쿠팡·자사몰 중 어느 채널이 효율 좋은지 카테고리별 비교",
    },
  ];
}
