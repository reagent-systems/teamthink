/**
 * TeamThink TypeScript SDK — script the local OpenAI-compatible gateway.
 *
 * @example
 * ```ts
 * import { TeamThinkClient } from "@/lib/sdk/client";
 * const tt = new TeamThinkClient("http://127.0.0.1:11434");
 * const models = await tt.listModels();
 * const reply = await tt.chat("llama-3.2-1b", [{ role: "user", content: "hi" }]);
 * ```
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TeamThinkClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export class TeamThinkClient {
  private base: string;
  private fetchFn: typeof fetch;

  constructor(baseUrl = "http://127.0.0.1:11434", opts?: TeamThinkClientOptions) {
    this.base = baseUrl.replace(/\/+$/, "");
    this.fetchFn = opts?.fetch ?? fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await this.fetchFn(`${this.base}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) {
      throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    }
    return json;
  }

  async listModels(): Promise<string[]> {
    const data = await this.request<{ data: { id: string }[] }>(
      "GET",
      "/v1/models",
    );
    return (data.data ?? []).map((m) => m.id);
  }

  async chat(
    model: string,
    messages: ChatMessage[],
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const data = await this.request<{
      choices: { message: { content: string } }[];
    }>("POST", "/v1/chat/completions", {
      model,
      messages,
      max_tokens: opts?.maxTokens,
      temperature: opts?.temperature,
    });
    return data.choices[0]?.message?.content ?? "";
  }

  async embed(model: string, input: string | string[]): Promise<number[][]> {
    const data = await this.request<{
      data: { embedding: number[] }[];
    }>("POST", "/v1/embeddings", { model, input });
    return (data.data ?? []).map((d) => d.embedding);
  }

  /** Anthropic-shaped Messages API (desktop gateway). */
  async messages(
    model: string,
    messages: { role: "user" | "assistant"; content: string }[],
    opts?: { maxTokens?: number; system?: string; temperature?: number },
  ): Promise<string> {
    const data = await this.request<{
      content: { type: string; text: string }[];
    }>("POST", "/v1/messages", {
      model,
      messages,
      max_tokens: opts?.maxTokens ?? 512,
      system: opts?.system,
      temperature: opts?.temperature,
    });
    return data.content.find((c) => c.type === "text")?.text ?? "";
  }

  /** Generate a random room id for mesh sessions. */
  static newRoomId(length = 8): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < length; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }
}

export { TeamThinkClient as TeamThink };
