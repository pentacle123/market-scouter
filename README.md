# MARKET SCOUTER

광고대행사(Pentacle)가 직접 제품을 소싱·마케팅하여 사업을 확장하기 위한 **AI 기반 제품 기회 발견 플랫폼**.

6개 데이터 레이어(글로벌 선행 / 한국 수요 / 경쟁 구조 / 소비자 불만 / Pentacle 적합 / 파트너 생태계)의 신호를 종합 분석하여 기회를 발견합니다.

## 기술 스택

- Next.js 14 (App Router)
- React 18 + Recharts
- YouTube Data API v3 (Phase 2)
- 네이버 데이터랩 통합검색어 트렌드 + 쇼핑 인사이트 API (Phase 2)
- Anthropic Claude Sonnet 4 — AI 분석 엔진 (Phase 3)
- Vercel 배포

## 환경 변수

```bash
cp .env.example .env.local
# .env.local 의 키들을 발급받은 실제 값으로 교체
```

- **YOUTUBE_API_KEY** — Google Cloud Console → APIs & Services → Library 에서 "YouTube Data API v3" 활성화 → Credentials → API Key 생성.
- **NAVER_CLIENT_ID / NAVER_CLIENT_SECRET** — https://developers.naver.com/apps → 애플리케이션 등록 → "데이터랩(검색어 트렌드)" 사용 API 추가 후 발급. (쇼핑 인사이트도 동일 자격증명 사용)
- **ANTHROPIC_API_KEY** — https://console.anthropic.com/settings/keys 에서 발급.
- 운영(Vercel)에서는 Project Settings → Environment Variables 에 동일한 키들로 추가하고 재배포.
- 모든 키는 **서버 사이드 Route Handler**에서만 사용되므로 브라우저로 노출되지 않습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인.

## 빌드

```bash
npm run build
npm run start
```

## 프로젝트 구조

```
app/
  layout.jsx                       # 메타데이터, HTML 셸, 폰트
  page.jsx                          # 메인 셸 + 뷰 라우팅
  globals.css
  api/
    youtube-scan/route.js           # YouTube 스캔 Route Handler (서버)
    naver-trend/route.js            # 네이버 검색어 트렌드 Route Handler
    naver-shopping/route.js         # 네이버 쇼핑 인사이트 Route Handler
    claude-analyze/route.js         # Claude AI 분석 Route Handler (POST)
lib/
  data.js                           # 카테고리 데이터 + 계산 유틸 (kw, naverCid 포함)
  ai-cache.js                       # localStorage 캐시 접근 헬퍼 (4개 캐시 통합)
  api/
    youtube.js                      # YouTube Data API v3 클라이언트
    naver.js                        # 네이버 검색어 트렌드 클라이언트
    naver-shopping.js               # 네이버 쇼핑 인사이트 클라이언트
    claude.js                       # Anthropic Claude Messages API 클라이언트
components/
  Framework.jsx                     # 프레임워크 뷰
  Matrix.jsx                        # 매트릭스 뷰 (ScatterChart + AI 점수 배지)
  Detail.jsx                        # 상세 분석 뷰 (RadarChart + 🤖 AI 분석 4섹션)
  GlobalScan.jsx                    # 글로벌 스캔 뷰 (US vs KR BarChart)
  KoreaScan.jsx                     # 한국 수요 탭 컨테이너
  KoreaSearchTrend.jsx              # ↳ 검색 트렌드 패널 (12M LineChart + MoM)
  KoreaShoppingInsight.jsx          # ↳ 쇼핑 인사이트 패널 (시계열 + 성별/연령/기기)
  AIAnalysis.jsx                    # 🤖 AI 분석 엔진 패널 (매트릭스 상단)
```

## 글로벌 스캔 (Phase 2)

`/api/youtube-scan` 은 카테고리(17개) × 국가(US/KR) 매트릭스로 `search.list`(쇼츠, 최근 30일) + `videos.list`(조회수)를 호출합니다.

- **쿼터**: 카테고리당 ~202 units, 전체 스캔 1회 ~3,400 units (무료 일일 한도 10,000 units의 약 34%).
- **호출 시점**: 사용자가 "글로벌 스캔" 탭에서 버튼을 누를 때만 (자동 호출 없음).
- **결과 캐싱**: 브라우저 `localStorage` 에 저장 — 페이지 재방문 시 마지막 결과를 즉시 표시, "다시 스캔" 클릭 시 재호출.
- **블루오션 판정**: `US 영상 ≥ 50` AND `US/KR 비율 ≥ 3x` 인 카테고리를 자동 하이라이트.

## 한국 수요 스캔 (Phase 2)

"한국 수요" 탭은 네이버 데이터랩의 두 가지 API를 탭으로 묶어 제공합니다. 두 API 모두 동일한 `NAVER_CLIENT_ID/SECRET` 자격증명을 사용합니다.

### 🔍 검색 트렌드 (`/api/naver-trend`)

통합검색어 트렌드 API 로 각 카테고리 KR 키워드의 최근 12개월 검색량 추이.

- **호출 구조**: 1요청당 keywordGroups 최대 5개 → 17 카테고리 = 4배치(5+5+5+2).
- **응답 ratio**: 요청 내 최대값을 100으로 환산한 **상대값** (배치 간 절대 비교 불가). 동일 카테고리 내 시계열·MoM 만 의미 있음.
- **MoM**: 진행중인 부분월은 제외하고 직전 완료월 기준으로 비교 (19일치 vs 30일치 같은 측정 편향 방지).
- **자동 하이라이트**: 전월 대비 ±20% 이상이면 📈 급상승 / 📉 하락.

### 🛒 쇼핑 인사이트 (`/api/naver-shopping`)

쇼핑 인사이트 4종 API를 통합 호출 — 카테고리 클릭 추이, 성별·연령·기기 분포.

- **카테고리 매핑**: `data.js` 의 `naverCid` 필드. 안정적인 최상위 10대 카테고리(`50000000`~`50000009`)만 사용. 매칭이 없는 카테고리는 `null` → UI에서 "네이버 쇼핑 카테고리 미형성 = 🌊 블루오션 추가 증거" 카드로 표시.
- **호출 구조**:
  - `/v1/datalab/shopping/categories` — 1요청당 카테고리 최대 3개 → 매핑된 11개 = 4배치.
  - `/v1/datalab/shopping/category/{device,gender,age}` — 카테고리당 3 호출, 병렬.
  - 1회 전체 스캔 ≈ 4 (시계열) + 11×3 (분포) = **37 호출**.
- **분포 추출**: 부분월 제외, 가장 최근 완료월의 ratio 를 성별/연령/기기 바 차트로 시각화.
- **세부 매핑 정제**: 현재는 광역 매핑이라 특정 제품 단위 시그널은 노이즈가 큼. `datalab.naver.com/shoppingInsight/` 에서 sub-cid 확인 후 `data.js`의 `naverCid` 정제 권장.

## AI 분석 엔진 (Phase 3)

`/api/claude-analyze` (POST) 는 카테고리 한 개와 그에 매칭된 YouTube/네이버 스캔 결과를 받아 Claude Sonnet 4 로 4가지 분석을 한 번의 호출로 생성합니다.

- **사전 조건**: 글로벌 스캔(YouTube) + 검색 트렌드(네이버) 캐시가 localStorage 에 있어야 합니다. 쇼핑 인사이트는 선택.
- **모델/토큰**: `claude-sonnet-4-20250514`, `max_tokens=1000`. 단가 input $3 / output $15 per 1M tokens 기준 1 카테고리당 약 $0.019, 17개 전체 ≈ **$0.32 (약 ₩440)**.
- **시스템 프롬프트**: Pentacle 사업 컨텍스트(광고대행사 × 숏폼 발견 커머스 × 크리에이터 어필리에이트 첫 진입) 주입. JSON 스키마 강제, 코드 펜스 금지, 텍스트 필드 80자 이내 제약.
- **응답 4섹션** (단일 JSON으로):
  1. **competition** — 경쟁 강도 점수 + 주요 플레이어 + 가격대 + 진입 장벽 (Layer 3 보강).
  2. **pains** — 소비자 불만 최대 3건 + 심각도 + 제품 개발 방향 + 추천 스펙 (Layer 4 자동화).
  3. **viral** — 숏폼 적합도 점수 + 3초 데모 가능성 + 크리에이터 적합도 + 적정 가격 + 숏폼 컨셉 3개 (Layer 5 보강).
  4. **verdict** — 종합 진입 점수 + 한줄 판단 + 근거 + 다음 액션.
- **호출 패턴**: 매트릭스 뷰의 "🤖 AI 분석 엔진" 패널에서 "전체 분석" 또는 "미분석만"을 누르면 17개 카테고리를 **순차적으로** 호출합니다 (Vercel maxDuration 60s 제약 회피 + 진행률 표시 + 중간 실패 시 다음 카테고리로 진행).
- **캐싱**: localStorage `market-scouter:claude-analysis:v1` 에 categoryId → 분석 맵 저장. 각 카테고리 완료 즉시 저장하여 도중 중단되어도 결과 보존.
- **UI 통합**: 매트릭스 카테고리 카드 우측에 verdict.score 배지(🤖 87), 상세 분석 뷰 하단에 4섹션 풀 렌더링.

자세한 설계/로드맵은 [GUIDE.md](./GUIDE.md) 참고.
