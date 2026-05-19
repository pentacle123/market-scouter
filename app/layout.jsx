import "./globals.css";

export const metadata = {
  title: "Market Scouter — 제품 기회 발견 엔진",
  description:
    "6개 데이터 레이어의 신호를 종합 분석하여 마케팅으로 승부할 수 있는 제품 기회를 발견하는 AI 기반 플랫폼",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
