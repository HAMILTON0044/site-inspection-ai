import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthStatus } from "@/components/auth-status";
import { LanguageProvider } from "@/components/language-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { getTranslator } from "@/lib/i18n-server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return {
    title: "Site Inspection AI",
    description: t("meta.description"),
  };
}

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function RootLayout({
  children,
}: RootLayoutProps) {
  const { locale } = await getTranslator();

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
      <body>
        <LanguageProvider initialLocale={locale}>
          <LanguageToggle />
          <AuthStatus />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
