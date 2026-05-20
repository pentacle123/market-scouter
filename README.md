# MARKET SCOUTER

광고대행사(Pentacle)가 직접 제품을 소싱·마케팅하여 사업을 확장하기 위한 **AI 기반 제품 기회 발견 플랫폼**.

6개 데이터 레이어(글로벌 선행 / 한국 수요 / 경쟁 구조 / 소비자 불만 / Pentacle 적합 / 파트너 생태계)의 신호를 종합 분석하여 기회를 발견합니다.

## 기술 스택

- Next.js 14 (App Router)
- React 18 + Recharts
- YouTube Data API v3 (Phase 2)
- Vercel 배포

## 환경 변수

```bash
cp .env.example .env.local
# .env.local 의 YOUTUBE_API_KEY 값을 Google Cloud Console 발급 키로 교체
```

- **YOUTUBE_API_KEY** — Google Cloud Console → APIs & Services → Library 에서 "YouTube Data API v3" 활성화 → Credentials → API Key 생성. 운영(Vercel)에서는 Project Settings → Environment Variables 에 동일한 키로 추가하고 재배포.
- 키는 **서버 사이드 라우트**(`app/api/youtube-scan/route.js`)에서만 사용되므로 브라우저로 노출되지 않습니다.

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
lib/
  data.js                           # 카테고리 데이터 + 계산 유틸 (kw 포함)
  api/
    youtube.js                      # YouTube Data API v3 클라이언트
components/
  Framework.jsx                     # 프레임워크 뷰
  Matrix.jsx                        # 매트릭스 뷰 (ScatterChart)
  Detail.jsx                        # 상세 분석 뷰 (RadarChart)
  GlobalScan.jsx                    # 글로벌 스캔 뷰 (US vs KR BarChart)
```

## 글로벌 스캔 (Phase 2)

`/api/youtube-scan` 은 카테고리(17개) × 국가(US/KR) 매트릭스로 `search.list`(쇼츠, 최근 30일) + `videos.list`(조회수)를 호출합니다.

- **쿼터**: 카테고리당 ~202 units, 전체 스캔 1회 ~3,400 units (무료 일일 한도 10,000 units의 약 34%).
- **호출 시점**: 사용자가 "글로벌 스캔" 탭에서 버튼을 누를 때만 (자동 호출 없음).
- **결과 캐싱**: 브라우저 `localStorage` 에 저장 — 페이지 재방문 시 마지막 결과를 즉시 표시, "다시 스캔" 클릭 시 재호출.
- **블루오션 판정**: `US 영상 ≥ 50` AND `US/KR 비율 ≥ 3x` 인 카테고리를 자동 하이라이트.

자세한 설계/로드맵은 [GUIDE.md](./GUIDE.md) 참고.
