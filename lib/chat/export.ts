import type { ChatThread } from "@/lib/chat/types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportThreadJson(thread: ChatThread): string {
  return JSON.stringify(thread, null, 2);
}

export function exportThreadMarkdown(thread: ChatThread): string {
  const lines = [`# ${thread.title}`, "", `_Exported ${new Date().toISOString()}_`, ""];
  for (const m of thread.messages) {
    const role = m.role.charAt(0).toUpperCase() + m.role.slice(1);
    lines.push(`## ${role}`, "", m.content, "");
  }
  return lines.join("\n");
}

export function exportThreadHtml(thread: ChatThread): string {
  const body = thread.messages
    .map(
      (m) =>
        `<section class="msg ${escapeHtml(m.role)}"><h2>${escapeHtml(m.role)}</h2><pre>${escapeHtml(m.content)}</pre></section>`,
    )
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(thread.title)}</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#1f1e1c;background:#faf9f5}
h1{font-family:ui-serif,Georgia,serif}
.msg{border:1px solid #e7e1d5;border-radius:12px;padding:1rem;margin:1rem 0;background:#fff}
.msg h2{margin:0 0 .5rem;font-size:.85rem;text-transform:uppercase;color:#6b6760}
pre{white-space:pre-wrap;font:inherit;margin:0}
</style>
</head>
<body>
<h1>${escapeHtml(thread.title)}</h1>
<p><small>Exported ${escapeHtml(new Date().toISOString())}</small></p>
${body}
</body>
</html>`;
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
