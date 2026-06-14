import { decodeXml, response, tag, validateTeams } from "./shared.mjs";

export async function handler(event) {
  const teams = validateTeams(event);
  if (!teams) return response({ error: "Invalid teams" }, 400);
  const { home, away } = teams;

  try {
    const query = `"${home}" OR "${away}" World Cup football when:7d`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 WorldCupForecastLab/0.4" }
    });
    if (!upstream.ok) throw new Error(`News HTTP ${upstream.status}`);
    const xml = await upstream.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 6).map((match) => {
      const block = match[1];
      const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      return {
        title: tag(block, "title").replace(/\s+-\s+[^-]+$/, ""),
        url: tag(block, "link"),
        source: sourceMatch ? decodeXml(sourceMatch[1].trim()) : "Google News",
        publishedAt: new Date(tag(block, "pubDate")).toISOString()
      };
    });
    return response({ items, updatedAt: new Date().toISOString() });
  } catch (error) {
    return response({ error: error.message }, 502);
  }
}
