# MARKET SCOUTER

광고대행사(Pentacle)가 직접 제품을 소싱·마케팅하여 사업을 확장하기 위한 **AI 기반 제품 기회 발견 플랫폼**.

6개 데이터 레이어(글로벌 선행 / 한국 수요 / 경쟁 구조 / 소비자 불만 / Pentacle 적합 / 파트너 생태계)의 신호를 종합 분석하여 기회를 발견합니다.

## 기술 스택

- Next.js 14 (App Router)
- React 18 + Recharts
- Vercel 배포

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
  layout.jsx     # 메타데이터, HTML 셸, 폰트
  page.jsx       # 메인 셸 + 뷰 라우팅
  globals.css
lib/
  data.js        # 카테고리 하드코딩 데이터 + 계산 유틸 (추후 API 전환)
components/
  Framework.jsx  # 프레임워크 뷰
  Matrix.jsx     # 매트릭스 뷰 (ScatterChart)
  Detail.jsx     # 상세 분석 뷰 (RadarChart)
```

자세한 설계/로드맵은 [GUIDE.md](./GUIDE.md) 참고.
