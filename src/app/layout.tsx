import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthStatus } from "@/components/auth-status";
import "./globals.css";

export const metadata: Metadata = {
  title: "Site Inspection AI",
  description: "AI 辅助施工现场巡检分析工具",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthStatus />
        {children}
      </body>
    </html>
  );
}
