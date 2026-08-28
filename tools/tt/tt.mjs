#!/usr/bin/env node
/**
 * TeamThink CLI — talk to the local OpenAI-compatible gateway (desktop app).
 *
 * Usage:
 *   tt room                    # new room id + join URL
 *   tt models                  # list /v1/models
 *   tt chat -m <model> "hi"    # chat completion
 *   tt embed -m <model> "text" # embeddings
 *   tt serve                   # print gateway URL (desktop must be running)
 */

const BASE = process.env.TEAMTHINK_GATEWAY_URL || "http://127.0.0.1:11434";

function usage() {
  console.log(`TeamThink CLI (tt)

Commands:
  room                         Generate a new room id and session URL
  models [--base URL]          List models from the local gateway
  chat -m <model> <prompt>     Run a chat completion
  embed -m <model> <text>      Get embeddings for text
  serve                        Show the default gateway base URL

Environment:
  TEAMTHINK_GATEWAY_URL        Gateway base (default http://127.0.0.1:11434)
`);
}

function randomRoomId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

async function api(base, method, path, body) {
  const res = await fetch(`${base.replace(/\/+$/, "")}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(json?.error?.message || `HTTP ${res.status}`);
  }
  return json;
}

function parseArgs(argv) {
  const args = [...argv];
  let base = BASE;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base" && args[i + 1]) {
      base = args[++i];
    } else {
      positional.push(args[i]);
    }
  }
  return { base, positional };
}

function flag(args, name) {
  const i = args.indexOf(name);
  if (i < 0 || !args[i + 1]) return null;
  return args[i + 1];
}

async function cmdRoom() {
  const id = randomRoomId();
  console.log(JSON.stringify({ roomId: id, url: `/s?r=${id}` }, null, 2));
}

async function cmdModels(base) {
  const data = await api(base, "GET", "/v1/models");
  for (const m of data.data ?? []) {
    console.log(m.id);
  }
}

async function cmdChat(base, args) {
  const model = flag(args, "-m");
  const promptParts = args.filter((a) => a !== "-m" && a !== model);
  const prompt = promptParts.join(" ").trim();
  if (!model || !prompt) {
    console.error("Usage: tt chat -m <model> <prompt>");
    process.exit(1);
  }
  const data = await api(base, "POST", "/v1/chat/completions", {
    model,
    messages: [{ role: "user", content: prompt }],
  });
  const text = data.choices?.[0]?.message?.content ?? "";
  console.log(text);
}

async function cmdEmbed(base, args) {
  const model = flag(args, "-m");
  const textParts = args.filter((a) => a !== "-m" && a !== model);
  const input = textParts.join(" ").trim();
  if (!model || !input) {
    console.error("Usage: tt embed -m <model> <text>");
    process.exit(1);
  }
  const data = await api(base, "POST", "/v1/embeddings", { model, input });
  console.log(JSON.stringify(data, null, 2));
}

async function cmdServe(base) {
  console.log(`OpenAI-compatible gateway: ${base.replace(/\/+$/, "")}/v1`);
  console.log("Start the TeamThink desktop app with an open session to handle requests.");
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    usage();
    return;
  }

  const cmd = argv[0];
  const { base, positional } = parseArgs(argv.slice(1));

  switch (cmd) {
    case "room":
      await cmdRoom();
      break;
    case "models":
      await cmdModels(base);
      break;
    case "chat":
      await cmdChat(base, positional);
      break;
    case "embed":
    case "embeddings":
      await cmdEmbed(base, positional);
      break;
    case "serve":
      await cmdServe(base);
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      usage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
