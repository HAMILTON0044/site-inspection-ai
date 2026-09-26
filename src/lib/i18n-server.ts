import { cookies } from "next/headers";
import {
  isLocale,
  localeCookieName,
  translate,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(localeCookieName)?.value;
  return isLocale(value) ? value : "en";
}

export async function getTranslator() {
  const locale = await getLocale();
  return {
    locale,
    t: (key: MessageKey) => translate(locale, key),
  };
}
