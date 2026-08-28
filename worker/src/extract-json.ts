/** Worker copy of structured HTML extraction (mirrors lib/scrape/extract-json.ts). */
export function extractStructuredFromHtml(
  html: string,
  schemaHint?: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const ldBlocks: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      ldBlocks.push(JSON.parse(m[1]!));
    } catch {
      // skip
    }
  }
  if (ldBlocks.length) out.jsonLd = ldBlocks;
  if (schemaHint?.trim()) out.schemaHint = schemaHint.trim();
  return out;
}
