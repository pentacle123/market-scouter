"use client";

// 4단계 의사결정 퍼널의 진행 헤더. "하이브리드 잠금" 정책:
// - 처음에는 순차 진행 권장(잠긴 단계는 disabled로 표시)
// - 카테고리가 한 번 선택되면 verify/review/plan 자유 이동 가능

const STEPS = [
  { id: "explore", num: 1, l: "기회 탐색", desc: "어디에 기회가 있는가" },
  { id: "verify", num: 2, l: "기회 검증", desc: "이 기회가 진짜인가" },
  { id: "review", num: 3, l: "사업 심사", desc: "실행 가능하고 돈 되는가" },
  { id: "plan", num: 4, l: "실행 계획", desc: "어떻게 들어가는가" },
];

export default function StepProgress({ current, hasCategory, onChange }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: "10px 12px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {STEPS.map((s, i) => {
          const isCurrent = s.id === current;
          // 1단계는 항상 가능. 2-4단계는 카테고리 선택 시에만 활성화.
          const locked = i > 0 && !hasCategory;
          const isDone =
            !locked &&
            STEPS.findIndex((x) => x.id === current) > i;
          const clickable = !locked;
          return (
            <Step
              key={s.id}
              num={s.num}
              label={s.l}
              desc={s.desc}
              state={
                locked
                  ? "locked"
                  : isCurrent
                    ? "current"
                    : isDone
                      ? "done"
                      : "upcoming"
              }
              onClick={clickable ? () => onChange(s.id) : null}
              isLast={i === STEPS.length - 1}
            />
          );
        })}
      </div>
    </div>
  );
}

function Step({ num, label, desc, state, onClick, isLast }) {
  const COLORS = {
    current: { bg: "#EEF2FF", border: "#6366F1", text: "#4338CA", num: "#6366F1", numText: "#fff" },
    done: { bg: "#fff", border: "#10B981", text: "#059669", num: "#10B981", numText: "#fff" },
    upcoming: { bg: "#fff", border: "#E5E7EB", text: "#666", num: "#F3F4F6", numText: "#9CA3AF" },
    locked: { bg: "#F9FAFB", border: "#E5E7EB", text: "#BBB", num: "#F3F4F6", numText: "#BBB" },
  };
  const c = COLORS[state];

  return (
    <>
      <div
        onClick={onClick || undefined}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 8px",
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: 8,
          cursor: onClick ? "pointer" : "default",
          opacity: state === "locked" ? 0.7 : 1,
          transition: "all 0.15s",
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 99,
            background: c.num,
            color: c.numText,
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {state === "done" ? "✓" : num}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: c.text,
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
              fontSize: 9,
              color: state === "current" ? "#6366F1" : "#999",
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
        <div
          style={{
            color: "#D1D5DB",
            fontSize: 14,
            margin: "0 -2px",
            userSelect: "none",
          }}
        >
          ›
        </div>
      )}
    </>
  );
}
