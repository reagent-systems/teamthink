/**
 * Hybrid on-device + cloud fallback when the mesh pool is cold or unavailable.
 */

export interface HybridSettings {
  enabled: boolean;
  provider: "openai" | "anthropic" | "custom";
  baseUrl: string;
  apiKey: string;
  model: string;
}

const SETTINGS_KEY = "teamthink.hybrid.v1";

export function getHybridSettings(): HybridSettings {
  if (typeof localStorage === "undefined") {
    return defaultSettings();
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings(), ...(JSON.parse(raw) as Partial<HybridSettings>) } : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function setHybridSettings(s: Partial<HybridSettings>): void {
  if (typeof localStorage === "undefined") return;
  const merged = { ...getHybridSettings(), ...s };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
}

function defaultSettings(): HybridSettings {
  return {
    enabled: false,
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
  };
}

export function meshIsCold(peerCount: number, modelLoaded: boolean): boolean {
  return peerCount <= 1 || !modelLoaded;
}

export async function hybridChatCompletion(
  messages: { role: string; content: string }[],
  settings: HybridSettings,
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error("Cloud API key required for hybrid fallback");
  }
  const url =
    settings.provider === "anthropic"
      ? `${settings.baseUrl.replace(/\/+$/, "")}/v1/messages`
      : `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  if (settings.provider === "anthropic") {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 1024,
        messages: messages.filter((m) => m.role !== "system").map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      }),
    });
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    return json.content?.find((c) => c.type === "text")?.text ?? "";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
    }),
  });
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json.choices?.[0]?.message?.content ?? "";
}
