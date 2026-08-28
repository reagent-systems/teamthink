"use client";

import { useEffect } from "react";
import {
  handleAnthropicMessages,
  handleChatCompletion,
  handleEmbeddings,
  handleModelsList,
} from "@/lib/gateway/handler";
import type {
  ChatCompletionRequest,
  EmbeddingsRequest,
} from "@/lib/gateway/openai-types";
import type { MessagesRequest } from "@/lib/gateway/anthropic-types";
import { validateGatewayKey } from "@/lib/platform/client";
import type { GridNode } from "@/lib/grid/scheduler";

declare global {
  interface Window {
    teamthinkDesktop?: {
      platform: string;
      isDesktop: boolean;
      gateway?: {
        onRequest: (
          cb: (
            id: string,
            method: string,
            path: string,
            body: unknown,
            apiKey?: string | null,
          ) => void,
        ) => (() => void) | void;
        respond: (id: string, status: number, body: unknown) => void;
        port?: number;
      };
    };
  }
}

/** Bridges desktop main-process OpenAI HTTP gateway to the in-tab GridNode. */
export function GatewayBridge({ node }: { node: GridNode }) {
  useEffect(() => {
    const gw = window.teamthinkDesktop?.gateway;
    if (!gw) return;

    const unsub = gw.onRequest(async (id, method, path, body, apiKey) => {
      try {
        if (!validateGatewayKey(apiKey ?? null)) {
          gw.respond(id, 401, {
            error: { message: "Invalid or missing API key" },
          });
          return;
        }
        if (method === "GET" && path === "/v1/models") {
          gw.respond(id, 200, handleModelsList());
          return;
        }
        if (method === "POST" && path === "/v1/chat/completions") {
          const res = await handleChatCompletion(
            node,
            body as ChatCompletionRequest,
          );
          gw.respond(id, 200, res);
          return;
        }
        if (method === "POST" && path === "/v1/embeddings") {
          const res = await handleEmbeddings(body as EmbeddingsRequest);
          gw.respond(id, 200, res);
          return;
        }
        if (method === "POST" && path === "/v1/messages") {
          const res = await handleAnthropicMessages(
            node,
            body as MessagesRequest,
          );
          gw.respond(id, 200, res);
          return;
        }
        gw.respond(id, 404, { error: { message: "not found" } });
      } catch (err) {
        gw.respond(id, 500, {
          error: { message: err instanceof Error ? err.message : "gateway error" },
        });
      }
    });

    return () => {
      unsub?.();
    };
  }, [node]);

  return null;
}
