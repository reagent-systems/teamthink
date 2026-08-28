#!/usr/bin/env python3
"""TeamThink Python SDK — local OpenAI-compatible gateway client."""

from __future__ import annotations

import json
import os
import random
import string
import urllib.error
import urllib.request
from typing import Any


class TeamThinkClient:
    def __init__(self, base_url: str | None = None) -> None:
        self.base = (base_url or os.environ.get("TEAMTHINK_GATEWAY_URL") or "http://127.0.0.1:11434").rstrip("/")

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base}{path}",
            data=data,
            method=method,
            headers={"Content-Type": "application/json"} if body else {},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            payload = e.read().decode("utf-8")
            try:
                err = json.loads(payload).get("error", {}).get("message", payload)
            except json.JSONDecodeError:
                err = payload
            raise RuntimeError(err) from e

    def list_models(self) -> list[str]:
        data = self._request("GET", "/v1/models")
        return [m["id"] for m in data.get("data", [])]

    def chat(
        self,
        model: str,
        messages: list[dict[str, str]],
        *,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> str:
        body: dict[str, Any] = {"model": model, "messages": messages}
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if temperature is not None:
            body["temperature"] = temperature
        data = self._request("POST", "/v1/chat/completions", body)
        choices = data.get("choices") or []
        return (choices[0].get("message") or {}).get("content", "") if choices else ""

    def embed(self, model: str, input: str | list[str]) -> list[list[float]]:
        data = self._request("POST", "/v1/embeddings", {"model": model, "input": input})
        return [row["embedding"] for row in data.get("data", [])]

    def messages(
        self,
        model: str,
        messages: list[dict[str, str]],
        *,
        max_tokens: int = 512,
        system: str | None = None,
        temperature: float | None = None,
    ) -> str:
        body: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        if system:
            body["system"] = system
        if temperature is not None:
            body["temperature"] = temperature
        data = self._request("POST", "/v1/messages", body)
        for block in data.get("content", []):
            if block.get("type") == "text":
                return block.get("text", "")
        return ""

    @staticmethod
    def new_room_id(length: int = 8) -> str:
        chars = string.ascii_lowercase + string.digits
        return "".join(random.choice(chars) for _ in range(length))


if __name__ == "__main__":
    client = TeamThinkClient()
    print("Models:", client.list_models())
