"use client";

import { useEffect } from "react";
import {
  handleChatCompletion,
  handleEmbeddings,
  handleModelsList,
} from "@/lib/gateway/handler";
import type {
  ChatCompletionRequest,
  EmbeddingsRequest,
} from "@/lib/gateway/openai-types";
import type { GridNode } from "@/lib/grid/scheduler";

declare global {
  interface Window {
    teamthinkDesktop?: {
      platform: string;
      isDesktop: boolean;
      gateway?: {
        onRequest: (
          cb: (id: string, method: string, path: string, body: unknown) => void,
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

    const unsub = gw.onRequest(async (id, method, path, body) => {
      try {
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
