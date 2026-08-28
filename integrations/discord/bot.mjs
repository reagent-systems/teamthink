#!/usr/bin/env node
/** Discord bot stub (ROADMAP #81) */
const GATEWAY = process.env.TEAMTHINK_GATEWAY ?? "http://127.0.0.1:11434";

async function chat(text) {
  const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "smollm2-360m",
      messages: [{ role: "user", content: text }],
    }),
  });
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "no reply";
}

console.log("TeamThink Discord bot stub — set DISCORD_TOKEN");
if (process.argv[2]) {
  chat(process.argv[2]).then(console.log).catch(console.error);
}
