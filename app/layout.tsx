import type { Metadata } from "next";
import { LangProvider } from "@/components/LangProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Terminal",
  description: "자연어로 시세 조회·스왑·포트폴리오를 처리하는 AI 에이전트 터미널",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body><LangProvider>{children}</LangProvider></body>
    </html>
  );
}
