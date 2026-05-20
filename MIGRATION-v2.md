# MIGRATION v1 → v2

GUIDE-v2.md 기준 마이그레이션 계획. 본 문서는 사용자 검토 후 단계별로 실행한다.

---

## 0. 본질 변화

| 측면 | v1 | v2 |
|---|---|---|
| 정체성 | 트렌드 모니터링 대시보드 | **투자 심사 도구** |
| 사용 빈도 | 수시 조회 | 1년에 1-2번 중대 결정 |
| UX 패턴 | 평행 탐색 (3-탭) | **선형 퍼널** (4-화면) |
| 분석 깊이 | 6-Layer 신호등 | **A/B/C/D/E/F · 28 sub항목 + GO/NO-GO 12체크** |

---

## 1. 화면 구조 매핑

### v1 (현재)
```
[프레임워크] [매트릭스] [상세 분석] [글로벌 스캔] [한국 수요]
            └ AI 분석 패널 (매트릭스 상단)
            └ 카테고리 카드 → 상세 분석 진입
            └ 한국 수요 = [검색 트렌드 | 쇼핑 인사이트] 서브탭
```

### v2 (목표)
```
[1. 기회 탐색] → [2. 기회 검증] → [3. 사업 심사] → [4. 실행 계획]
    ↑                ↑                  ↑                ↑
선택 가능        한 카테고리 선택    검증 통과 후       GO 결정 후
30 카테고리         심층 점검         최종 의사결정     액션플랜
```

### 화면별 기능 매핑

#### 화면 1: 기회 탐색 (`OpportunityExplore.jsx`)
- 상단: **핵심 요약 카드** (블루오션 N · 틈새 N · 조건부 N · 비추천 N · Claude 추천 TOP3 미리보기)
- **"데이터 업데이트" 버튼** 1개 (YouTube → 네이버 검색 → 네이버 쇼핑 → Claude 순차 일괄 실행)
- **기회 매트릭스** (ScatterChart, 기존 그대로)
- **카테고리 랭킹 리스트** (유형별 그룹, AI 점수 배지 포함)
- 각 카드 우측에 **[검증 시작 →]** 버튼

흡수되는 v1 컴포넌트: `Framework.jsx`(요약 카드로 축소) + `Matrix.jsx`(차트+리스트) + `AIAnalysis.jsx`(데이터 업데이트 버튼으로 흡수) + `GlobalScan.jsx`+`KoreaScan.jsx`(데이터 업데이트 실행 시 백그라운드 호출, 별도 탭 제거)

#### 화면 2: 기회 검증 (`OpportunityVerify.jsx`)
- 카테고리 헤더 (이름·이모지·시장규모·유형·종합 점수)
- **레이더 차트** (현재 6축, v2에서 확장 가능)
- 6개 데이터 레이어 (실시간 데이터 + AI 분석 요약)
- **신규**: 트렌드 지속성 (A-4) · 한국 문화 적합성 (B-3) · 구조적 순풍 (A-5) — Phase 2 에서 추가
- **검증 결론 + [심사 단계로 →]** 버튼

흡수되는 v1 컴포넌트: `Detail.jsx`의 RadarChart + 6 레이어 + 일부 AI 섹션

#### 화면 3: 사업 심사 (`BusinessReview.jsx`)
- 제품 인텔리전스 (소비자 불만 → 스펙) — v1의 pains + Claude pains
- 파트너 & 협업 — v1의 partners
- 마케팅 전략 (숏폼 콘셉트, 크리에이터 매칭) — v1의 Claude viral
- 수익성 (Unit Economics, 현금흐름, 시나리오) — Phase 3 에서 신설
- 리스크 (킬 리스크, Exit) — Phase 3 에서 신설
- **GO/NO-GO 12체크 + 확신도% + 진입 방식**
- **[실행 계획 보기 →]** 버튼

흡수되는 v1 컴포넌트: `Detail.jsx`의 pains/rev/risks/partners + Claude verdict

#### 화면 4: 실행 계획 (`ExecutionPlan.jsx`)
- 타임라인 (월별 마일스톤) — Phase 4
- 예산 상세 — Phase 4
- 성공 기준 — Phase 4
- 인접 확장 비전 — v1의 expand

흡수되는 v1 컴포넌트: `Detail.jsx`의 expand

---

## 2. Phase 1 — 퍼널 구조 개편 (이번 작업)

### 작업 항목

**A. 새 컨테이너 + 4-화면 컴포넌트 신설**

| 파일 | 역할 | 진입 조건 |
|---|---|---|
| `components/OpportunityExplore.jsx` | 30 카테고리 탐색, 데이터 업데이트, 매트릭스 | 항상 |
| `components/OpportunityVerify.jsx` | 단일 카테고리 검증 | 카테고리 1개 선택 시 |
| `components/BusinessReview.jsx` | 사업 심사, GO/NO-GO | 검증 완료 후 |
| `components/ExecutionPlan.jsx` | 실행 액션플랜 | GO 결정 후 |

**B. 라우팅/상태 관리 — `app/page.jsx` 재구성**

- 단계 상태: `step ∈ ["explore","verify","review","plan"]`
- 선택 카테고리: `selectedCat` (verify·review·plan 에서 공유)
- 단계 잠금 정책: 검증·심사·실행 화면은 카테고리 선택이 없으면 자동으로 탐색으로 리다이렉트
- 헤더 네비: 단계별 진행도(•—•—○—○) 형태로 표시. 클릭으로 이전 단계 자유 이동 가능.

**C. "데이터 업데이트" 버튼 — 일괄 스캔 헬퍼**

- `lib/scan-all.js` 신설. 순차 호출: YouTube → Naver Trend → Naver Shopping → Claude(분석).
- 진행률 + 누적 비용 표시. 각 단계 완료 시 localStorage 즉시 저장 (현 동작 유지).
- AI 분석은 "전체"가 기본, "미분석만" 옵션 유지.

**D. 기존 컴포넌트 운명**

| 기존 | 처리 |
|---|---|
| `Framework.jsx` | OpportunityExplore 상단 "프레임워크 요약 카드"로 축소 흡수 |
| `Matrix.jsx` | OpportunityExplore 의 차트+리스트 섹션으로 흡수 (별도 컴포넌트 유지 가능) |
| `Detail.jsx` | OpportunityVerify + BusinessReview + ExecutionPlan 3개로 분할 |
| `GlobalScan.jsx` | 제거 (탐색의 데이터 업데이트로 흡수). 단, 디버그용 직접 URL 접근은 가능하도록 별도 라우트 보존 검토 |
| `KoreaScan.jsx` + `KoreaSearchTrend.jsx` + `KoreaShoppingInsight.jsx` | 위와 동일 |
| `AIAnalysis.jsx` | 데이터 업데이트 버튼 + AI 분석 진행 패널로 흡수 |

**E. v1 컴포넌트 한시적 보존**

대규모 리팩토링 중 회귀 방지를 위해 v1 컴포넌트를 즉시 삭제하지 않고 `components/_legacy/` 아래로 이동 보존. Phase 2 완료 후 일괄 제거.

### Phase 1 범위 밖 (Phase 2~ 에서 처리)

- 화면 2/3/4 의 신규 분석 항목 (트렌드 지속성, 메가트렌드, 문화 적합성, JTBD, Moat, 곡괭이와 삽, 데이터 플라이휠, Unit Economics 등)
- 30 카테고리 확장
- Claude 호출 구조 분리 (현재 1콜 → 화면별 lazy 분할)

---

## 3. Phase 2~5 개요 (이후 작업)

### Phase 2 — 기회 검증 화면 강화
- Claude 분석 4종 신규 호출 추가 (트렌드 지속성 / 메가트렌드 / 문화 적합성 / 채택 속도)
- Google Trends 5년 데이터 (pytrends 또는 unofficial API)
- 검증 화면 레이아웃 확장

### Phase 3 — 사업 심사 화면 구축
- GO/NO-GO 12 체크리스트
- Unit Economics 입력/시뮬레이션 UI
- 현금흐름 시뮬레이션
- 시나리오(Bull/Base/Bear) 카드
- 킬 리스크 + Exit 기준 입력

### Phase 4 — 실행 계획 화면
- 타임라인/예산/마일스톤 (하드코딩 우선, 향후 자동 생성)
- 인접 확장 비전

### Phase 5 — 고도화
- Vercel Cron Job 자동 스캔
- 카테고리 자동 발견
- 크리에이터 자동 매칭

---

## 4. 카테고리 30개 확장 (별도 트랙)

현재 17 → 30. Phase 1 과 병행 또는 그 이후 진행. 신규 13개는 v2 GUIDE 본문에 명시된 예시(버섯커피·홈피트니스 등은 기존, 추가 후보는 토의 필요).

작업: 각 카테고리에 `id, n, e, mk, lc, type, kw, naverCid, L1~L6, verdict, why, layers, pains, rev, ttm, risks, partners, expand` 입력. 카테고리당 약 10-15분.

→ **별도 작업으로 빼겠음**. Phase 1 끝난 뒤 사용자가 카테고리 후보 13개를 알려주면 일괄 입력.

---

## 5. 결정이 필요한 사항

검토 시 답변 부탁드립니다.

### 결정 #1: 단계 잠금 정책
- (A) **엄격**: 검증은 카테고리 선택 후, 심사는 검증 화면을 거친 후, 실행은 심사에서 GO 누른 후
- (B) **느슨**: 카테고리만 선택되면 어느 단계든 직접 이동 가능 (헤더 네비로)
- (C) **하이브리드**: 첫 진입은 순차, 이후 자유 이동 (추천)

### 결정 #2: 매트릭스에서 카테고리 선택 후 진입
- (A) **검증 화면으로 직접 진입** — v2 GUIDE의 퍼널 순서 충실
- (B) **카테고리 클릭 = 카테고리 미리보기 모달, 그 안에서 [검증 시작 →]** — 두 단계
- (C) v1 처럼 카드 클릭 시 곧장 다음 화면 (추천)

### 결정 #3: GUIDE.md 처리
- (A) **GUIDE.md 를 v2 내용으로 교체** (v1은 git history 에 남음, 권장)
- (B) GUIDE.md(v1) 보존 + GUIDE-v2.md 를 프로젝트 루트로 복사 둘 다 유지
- (C) v2 만 GUIDE.md 로 두고 v1 은 GUIDE-v1.md 로 백업

### 결정 #4: v1 컴포넌트 보존
- (A) `components/_legacy/` 로 이동 보존 후 Phase 2 완료 시 일괄 삭제 (권장)
- (B) 즉시 삭제 (롤백 불가)

### 결정 #5: "데이터 업데이트" 버튼의 기본 동작
- (A) **YouTube + 네이버×2 + Claude 모두 일괄 실행** (~4-5분, ~$0.22)
- (B) 사용자가 어떤 단계까지 돌릴지 체크박스로 선택 (추천 — 비용 가시화)
- (C) YouTube/네이버만 자동, Claude 는 별도 버튼 (Phase 1 안전 옵션)

### 결정 #6: 30 카테고리 확장 타이밍
- (A) Phase 1 직후 (구조 안정화 후)
- (B) Phase 2 와 병행
- (C) Phase 2 마치고 Phase 3 시작 전

---

## 6. Phase 1 작업 단계 (사용자 결정 이후 실행)

1. 결정사항 1-6 확정
2. `components/_legacy/` 폴더 생성 + v1 컴포넌트 백업
3. `lib/scan-all.js` 일괄 스캔 헬퍼 작성
4. 4-화면 컴포넌트 신설 (Explore → Verify → Review → Plan 순)
5. `app/page.jsx` 라우팅/상태 관리 재구성
6. 단계 진행 헤더 (•—•—○—○ progress) 작성
7. 빌드 검증
8. 운영 배포 + 시연

---

## 7. 예상 영향 파일

신규:
- `components/OpportunityExplore.jsx`
- `components/OpportunityVerify.jsx`
- `components/BusinessReview.jsx`
- `components/ExecutionPlan.jsx`
- `components/StepProgress.jsx` (퍼널 진행 헤더)
- `lib/scan-all.js`
- `components/_legacy/` (v1 보존)

수정:
- `app/page.jsx` (완전 재작성)
- `app/layout.jsx` (제목 등 미세 수정 가능)
- `README.md` (구조 변경 반영)
- `GUIDE.md` (v2 적용 — 결정 #3 에 따라)

이동/제거 검토:
- `components/Framework.jsx` `Matrix.jsx` `Detail.jsx` `GlobalScan.jsx` `KoreaScan.jsx` `KoreaSearchTrend.jsx` `KoreaShoppingInsight.jsx` `AIAnalysis.jsx`

유지:
- `lib/data.js`, `lib/ai-cache.js`, `lib/api/*` (모든 API 클라이언트 그대로 재사용)
- `app/api/*` (모든 Route Handler 그대로 재사용)

---

## 8. 리스크

- **회귀**: 4-화면 재구성 중 기존 데이터/캐시 호환성 깨질 위험 → 캐시 키 동일 유지로 완화
- **사용자 혼란**: 익숙해진 v1 UX 변경 → 첫 화면에 v2 안내 카드 노출 검토
- **Claude 호출 분할 미완**: Phase 1 시점에는 4섹션 통합 응답 그대로 사용. 화면 2/3/4 가 각각의 섹션을 골라 보여주는 식 → Phase 2 에서 호출 분리 필요
