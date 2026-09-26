import { NextResponse } from "next/server";
import { isLocale, localeCookieName } from "@/lib/i18n";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    locale?: string;
  } | null;

  if (!isLocale(body?.locale)) {
    return NextResponse.json({ error: "INVALID_LOCALE" }, { status: 400 });
  }

  const response = NextResponse.json({ locale: body.locale });
  response.cookies.set(localeCookieName, body.locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
