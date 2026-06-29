import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "커뮤니티 리빙랩 대시보드",
  description: "2026 커뮤니티 리빙랩 프로젝트 운영 대시보드"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
