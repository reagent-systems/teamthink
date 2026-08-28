import type { ModelSpec } from "@/lib/config";
import type {
  ChatMessage,
  GenerateOptions,
  InferenceEngine,
  LoadProgress,
} from "@/lib/engine/types";

/**
 * Transformers.js engine — ONNX models on WebGPU. Broader modality coverage
 * than WebLLM.
 *
 * Text generation uses the `text-generation` pipeline. Vision-language models
 * (e.g. SmolVLM) are run through the model classes directly: as of
 * @huggingface/transformers v4 there is no `image-text-to-text` *pipeline*
 * task — VLMs go through AutoProcessor + AutoModelForImageTextToText.
 */

type ProgressEvent = { status?: string; progress?: number; file?: string };

type TextPipe = {
  tokenizer: unknown;
  (input: unknown, options: Record<string, unknown>): Promise<unknown>;
  dispose?: () => Promise<void>;
};

type Processor = {
  tokenizer: unknown;
  apply_chat_template: (messages: unknown, opts: Record<string, unknown>) => string;
  (text: string, images: unknown[], opts?: Record<string, unknown>): Promise<
    Record<string, unknown>
  >;
};

type VlmModel = {
  generate: (opts: Record<string, unknown>) => Promise<unknown>;
  dispose?: () => Promise<void>;
};

type TransformersModule = {
  pipeline: (
    task: string,
    model: string,
    opts: Record<string, unknown>,
  ) => Promise<TextPipe>;
  AutoProcessor: {
    from_pretrained: (
      model: string,
      opts: Record<string, unknown>,
    ) => Promise<Processor>;
  };
  AutoModelForImageTextToText: {
    from_pretrained: (
      model: string,
      opts: Record<string, unknown>,
    ) => Promise<VlmModel>;
  };
  load_image: (src: string) => Promise<unknown>;
  TextStreamer: new (
    tokenizer: unknown,
    opts: Record<string, unknown>,
  ) => unknown;
};

export class TransformersEngine implements InferenceEngine {
  readonly kind = "transformers" as const;
  private loadedModelId: string | null = null;
  private tf: TransformersModule | null = null;

  private textPipe: TextPipe | null = null;
  private embedPipe: TextPipe | null = null;
  private vlm: { processor: Processor; model: VlmModel } | null = null;

  private async module(): Promise<TransformersModule> {
    if (!this.tf) {
      this.tf = (await import(
        "@huggingface/transformers"
      )) as unknown as TransformersModule;
    }
    return this.tf;
  }

  async load(
    model: ModelSpec,
    onProgress: (p: LoadProgress) => void,
  ): Promise<void> {
    if (
      this.loadedModelId === model.modelId &&
      (this.textPipe || this.vlm || this.embedPipe)
    )
      return;
    const tf = await this.module();
    await this.unload();

    const progress_callback = (p: ProgressEvent) =>
      onProgress({
        progress: typeof p.progress === "number" ? p.progress / 100 : 0,
        text: p.file ? `${p.status ?? "loading"} ${p.file}` : p.status ?? "",
      });

    try {
      if (model.modality === "embedding") {
        this.embedPipe = await tf.pipeline(
          "feature-extraction",
          model.modelId,
          {
            device: "webgpu",
            dtype: "fp32",
            progress_callback,
          },
        );
      } else if (model.modality === "vision") {
        const [processor, vlmModel] = await Promise.all([
          tf.AutoProcessor.from_pretrained(model.modelId, {
            progress_callback,
          }),
          tf.AutoModelForImageTextToText.from_pretrained(model.modelId, {
            device: "webgpu",
            dtype: "q4",
            progress_callback,
          }),
        ]);
        this.vlm = { processor, model: vlmModel };
      } else {
        this.textPipe = await tf.pipeline("text-generation", model.modelId, {
          device: "webgpu",
          dtype: "q4",
          progress_callback,
        });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      throw new Error(`${model.label} failed to load: ${raw}`);
    }
    this.loadedModelId = model.modelId;
  }

  async generate(
    model: ModelSpec,
    messages: ChatMessage[],
    opts: GenerateOptions,
    onToken: (token: string) => void,
  ): Promise<string> {
    if (this.loadedModelId !== model.modelId || (!this.textPipe && !this.vlm)) {
      await this.load(model, () => {});
    }
    return model.modality === "vision"
      ? this.generateVision(messages, opts, onToken)
      : this.generateText(messages, opts, onToken);
  }

  private makeStreamer(
    tokenizer: unknown,
    onToken: (token: string) => void,
    sink: { text: string },
  ): unknown {
    const tf = this.tf!;
    return new tf.TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        if (text) {
          sink.text += text;
          onToken(text);
        }
      },
    });
  }

  private async generateText(
    messages: ChatMessage[],
    opts: GenerateOptions,
    onToken: (token: string) => void,
  ): Promise<string> {
    const pipe = this.textPipe!;
    const sink = { text: "" };
    const streamer = this.makeStreamer(pipe.tokenizer, onToken, sink);
    await pipe(
      messages.map((m) => ({ role: m.role, content: m.content })),
      {
        max_new_tokens: opts.maxTokens ?? 512,
        do_sample: (opts.temperature ?? 0) > 0,
        temperature: opts.temperature ?? 0.7,
        streamer,
      },
    );
    return sink.text;
  }

  private async generateVision(
    messages: ChatMessage[],
    opts: GenerateOptions,
    onToken: (token: string) => void,
  ): Promise<string> {
    const tf = this.tf!;
    const { processor, model } = this.vlm!;

    // Collect any images referenced across the conversation and build the
    // multimodal message structure SmolVLM-style processors expect.
    const images: unknown[] = [];
    const chat = await Promise.all(
      messages.map(async (m) => {
        const content: Array<{ type: string; text?: string }> = [];
        if (m.image) {
          images.push(await tf.load_image(m.image));
          content.push({ type: "image" });
        }
        content.push({ type: "text", text: m.content });
        return { role: m.role, content };
      }),
    );

    const prompt = processor.apply_chat_template(chat, {
      add_generation_prompt: true,
    });
    const inputs = await processor(prompt, images);

    const sink = { text: "" };
    const streamer = this.makeStreamer(processor.tokenizer, onToken, sink);
    await model.generate({
      ...inputs,
      max_new_tokens: opts.maxTokens ?? 512,
      do_sample: (opts.temperature ?? 0) > 0,
      temperature: opts.temperature ?? 0.7,
      streamer,
    });
    return sink.text;
  }

  /** Mean-pooled, L2-normalized embedding vectors (OpenAI /v1/embeddings shape). */
  async embed(model: ModelSpec, texts: string[]): Promise<number[][]> {
    if (this.loadedModelId !== model.modelId || !this.embedPipe) {
      await this.load(model, () => {});
    }
    const pipe = this.embedPipe!;
    const raw = (await pipe(texts, {
      pooling: "mean",
      normalize: true,
    })) as { data?: Float32Array | number[]; dims?: number[] } | unknown;

    return tensorToVectors(raw, texts.length);
  }

  async unload(): Promise<void> {
    try {
      await this.textPipe?.dispose?.();
      await this.embedPipe?.dispose?.();
      await this.vlm?.model.dispose?.();
    } catch {
      // ignore
    }
    this.textPipe = null;
    this.embedPipe = null;
    this.vlm = null;
    this.loadedModelId = null;
  }
}

function tensorToVectors(
  raw: unknown,
  count: number,
): number[][] {
  if (Array.isArray(raw)) {
    if (raw.length > 0 && Array.isArray(raw[0])) {
      return (raw as number[][]).map((row) => [...row]);
    }
    if (typeof raw[0] === "number") {
      const flat = raw as number[];
      const dim = Math.floor(flat.length / count);
      const out: number[][] = [];
      for (let i = 0; i < count; i++) {
        out.push(flat.slice(i * dim, (i + 1) * dim));
      }
      return out;
    }
  }
  const t = raw as { data?: Float32Array | number[]; dims?: number[] };
  if (t?.data && t.dims) {
    const data = t.data instanceof Float32Array ? t.data : Float32Array.from(t.data);
    const dim = t.dims[t.dims.length - 1] ?? data.length / count;
    const out: number[][] = [];
    for (let i = 0; i < count; i++) {
      out.push(Array.from(data.slice(i * dim, (i + 1) * dim)));
    }
    return out;
  }
  throw new Error("unexpected embedding output shape");
}
