import type { ModelSpec } from "@/lib/config";
import type {
  ChatMessage,
  GenerateOptions,
  InferenceEngine,
  LoadProgress,
} from "@/lib/engine/types";

/**
 * Transformers.js engine — ONNX models on WebGPU. Broader modality coverage
 * (text generation and vision/image-text-to-text) than WebLLM.
 */
export class TransformersEngine implements InferenceEngine {
  readonly kind = "transformers" as const;
  private pipe: unknown = null;
  private loadedModelId: string | null = null;
  private TextStreamer: unknown = null;

  async load(
    model: ModelSpec,
    onProgress: (p: LoadProgress) => void,
  ): Promise<void> {
    if (this.loadedModelId === model.modelId && this.pipe) return;
    const tf = (await import("@huggingface/transformers")) as unknown as {
      pipeline: (
        task: string,
        model: string,
        opts: Record<string, unknown>,
      ) => Promise<unknown>;
      TextStreamer: unknown;
    };
    this.TextStreamer = tf.TextStreamer;
    await this.unload();

    const task =
      model.modality === "vision" ? "image-text-to-text" : "text-generation";

    this.pipe = await tf.pipeline(task, model.modelId, {
      device: "webgpu",
      dtype: "q4",
      progress_callback: (p: {
        status?: string;
        progress?: number;
        file?: string;
      }) =>
        onProgress({
          progress: typeof p.progress === "number" ? p.progress / 100 : 0,
          text: p.file ? `${p.status ?? "loading"} ${p.file}` : p.status ?? "",
        }),
    });
    this.loadedModelId = model.modelId;
  }

  async generate(
    model: ModelSpec,
    messages: ChatMessage[],
    opts: GenerateOptions,
    onToken: (token: string) => void,
  ): Promise<string> {
    if (!this.pipe || this.loadedModelId !== model.modelId) {
      await this.load(model, () => {});
    }

    const pipe = this.pipe as {
      tokenizer: unknown;
      (input: unknown, options: Record<string, unknown>): Promise<unknown>;
    };

    const StreamerCtor = this.TextStreamer as new (
      tokenizer: unknown,
      opts: Record<string, unknown>,
    ) => unknown;

    let full = "";
    const streamer = new StreamerCtor(pipe.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        if (text) {
          full += text;
          onToken(text);
        }
      },
    });

    const input =
      model.modality === "vision"
        ? toVisionMessages(messages)
        : messages.map((m) => ({ role: m.role, content: m.content }));

    await pipe(input, {
      max_new_tokens: opts.maxTokens ?? 512,
      do_sample: (opts.temperature ?? 0) > 0,
      temperature: opts.temperature ?? 0.7,
      streamer,
    });

    return full;
  }

  async unload(): Promise<void> {
    const pipe = this.pipe as { dispose?: () => Promise<void> } | null;
    if (pipe?.dispose) {
      try {
        await pipe.dispose();
      } catch {
        // ignore
      }
    }
    this.pipe = null;
    this.loadedModelId = null;
  }
}

interface VisionContentPart {
  type: "image" | "text";
  image?: string;
  text?: string;
}

function toVisionMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    const parts: VisionContentPart[] = [];
    if (m.image) parts.push({ type: "image", image: m.image });
    parts.push({ type: "text", text: m.content });
    return { role: m.role, content: parts };
  });
}
