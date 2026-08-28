export type Locale = "en" | "es" | "de" | "ja";

export const messages: Record<Locale, Record<string, string>> = {
  en: {
    "app.title": "TeamThink",
    "app.tagline": "Shared WebGPU inference grid",
    "session.create": "Create session",
    "session.join": "Join",
    "chat.send": "Send",
  },
  es: {
    "app.title": "TeamThink",
    "app.tagline": "Red de inferencia WebGPU compartida",
    "session.create": "Crear sesión",
    "session.join": "Unirse",
    "chat.send": "Enviar",
  },
  de: {
    "app.title": "TeamThink",
    "app.tagline": "Geteiltes WebGPU-Inferenznetz",
    "session.create": "Sitzung erstellen",
    "session.join": "Beitreten",
    "chat.send": "Senden",
  },
  ja: {
    "app.title": "TeamThink",
    "app.tagline": "WebGPU推論メッシュ",
    "session.create": "セッション作成",
    "session.join": "参加",
    "chat.send": "送信",
  },
};

const LOCALE_KEY = "teamthink.locale.v1";

export function getLocale(): Locale {
  if (typeof localStorage === "undefined") return "en";
  const v = localStorage.getItem(LOCALE_KEY);
  if (v === "es" || v === "de" || v === "ja") return v;
  return "en";
}

export function setLocale(locale: Locale): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LOCALE_KEY, locale);
}

export function t(key: string, locale = getLocale()): string {
  return messages[locale][key] ?? messages.en[key] ?? key;
}
