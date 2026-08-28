export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface MessagesRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
}

export interface MessagesResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: { type: "text"; text: string }[];
  model: string;
  stop_reason: "end_turn";
  usage: { input_tokens: number; output_tokens: number };
}

/** Rough token estimate for usage fields (gateway has no tokenizer). */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function anthropicToChatMessages(req: MessagesRequest): {
  role: string;
  content: string;
}[] {
  const out: { role: string; content: string }[] = [];
  if (req.system?.trim()) {
    out.push({ role: "system", content: req.system.trim() });
  }
  for (const m of req.messages) {
    out.push({ role: m.role, content: m.content });
  }
  return out;
}

export function chatToAnthropicResponse(
  model: string,
  inputMessages: MessagesRequest["messages"],
  system: string | undefined,
  assistantText: string,
): MessagesResponse {
  const inputChars =
    (system?.length ?? 0) +
    inputMessages.reduce((s, m) => s + m.content.length, 0);
  return {
    id: `msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
    type: "message",
    role: "assistant",
    model,
    stop_reason: "end_turn",
    content: [{ type: "text", text: assistantText }],
    usage: {
      input_tokens: estimateTokens(" ".repeat(inputChars)),
      output_tokens: estimateTokens(assistantText),
    },
  };
}
