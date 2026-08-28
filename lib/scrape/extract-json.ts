/** Pull structured data from HTML: JSON-LD, Open Graph, and tables. */
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
      // skip invalid JSON-LD
    }
  }
  if (ldBlocks.length) out.jsonLd = ldBlocks;

  const og: Record<string, string> = {};
  const ogRe = /<meta[^>]+property=["']og:([^"']+)["'][^>]+content=["']([^"']+)["']/gi;
  while ((m = ogRe.exec(html))) og[m[1]!] = m[2]!;
  if (Object.keys(og).length) out.openGraph = og;

  const tables: string[][][] = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  while ((m = tableRe.exec(html))) {
    const rows: string[][] = [];
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    let row: RegExpExecArray | null;
    const block = m[0];
    while ((row = rowRe.exec(block))) {
      const cells =
        row[0].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)?.map((c) =>
          c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        ) ?? [];
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  if (tables.length) out.tables = tables.slice(0, 5);

  if (schemaHint?.trim()) out.schemaHint = schemaHint.trim();
  return out;
}
