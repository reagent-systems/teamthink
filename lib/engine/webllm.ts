import type { ModelSpec } from "@/lib/config";
import type {
  ChatMessage,
  GenerateOptions,
  InferenceEngine,
  LoadProgress,
} from "@/lib/engine/types";

/**
 * WebLLM (MLC) engine — prebuilt quantized chat LLMs on WebGPU. Closest to an
 * Ollama-style local chat runtime.
 */
export class WebLLMEngine implements InferenceEngine {
  readonly kind = "webllm" as const;
  private engine: unknown = null;
  private loadedModelId: string | null = null;

  async load(
    model: ModelSpec,
    onProgress: (p: LoadProgress) => void,
  ): Promise<void> {
    if (this.loadedModelId === model.modelId && this.engine) return;
    const webllm = await import("@mlc-ai/web-llm");
    await this.unload();
    this.engine = await webllm.CreateMLCEngine(model.modelId, {
      initProgressCallback: (r: { progress: number; text: string }) =>
        onProgress({ progress: r.progress ?? 0, text: r.text ?? "" }),
    });
    this.loadedModelId = model.modelId;
  }

  async generate(
    model: ModelSpec,
    messages: ChatMessage[],
    opts: GenerateOptions,
    onToken: (token: string) => void,
  ): Promise<string> {
    if (!this.engine || this.loadedModelId !== model.modelId) {
      await this.load(model, () => {});
    }
    const engine = this.engine as {
      chat: {
        completions: {
          create: (args: unknown) => Promise<
            AsyncIterable<{
              choices: { delta: { content?: string } }[];
            }>
          >;
        };
      };
    };

    const chunks = await engine.chat.completions.create({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 512,
    });

    let full = "";
    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        onToken(delta);
      }
    }
    return full;
  }

  async unload(): Promise<void> {
    const engine = this.engine as { unload?: () => Promise<void> } | null;
    if (engine?.unload) {
      try {
        await engine.unload();
      } catch {
        // ignore
      }
    }
    this.engine = null;
    this.loadedModelId = null;
  }
}
