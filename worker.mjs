function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "public, max-age=60" }
  });
}

function clean(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function teamVariants(name) {
  const variants = [name];
  if (name === "USA") variants.push("United States", "US");
  if (name === "Bosnia") variants.push("Bosnia-Herzegovina", "Bosnia and Herzegovina");
  if (name === "South Korea") variants.push("Korea Republic");
  if (name === "Czechia") variants.push("Czech Republic");
  if (name === "Turkey") variants.push("Turkiye", "Türkiye");
  if (name === "Curacao") variants.push("Curaçao");
  if (name === "Ivory Coast") variants.push("Cote d'Ivoire", "Côte d’Ivoire");
  if (name === "Cape Verde") variants.push("Cabo Verde");
  if (name === "DR Congo") variants.push("Congo DR", "Democratic Republic of the Congo");
  return variants.map(clean);
}

function mentions(text, name) {
  const value = clean(text);
  return teamVariants(name).some((variant) => value.includes(variant));
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || "[]"); } catch { return []; }
}

function yesPrice(market) {
  const outcomes = parseArray(market?.outcomes);
  const prices = parseArray(market?.outcomePrices).map(Number);
  const index = outcomes.findIndex((outcome) => clean(outcome) === "yes");
  return index >= 0 && Number.isFinite(prices[index]) ? prices[index] : null;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "WorldCupForecastLab/0.4" }
  });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.json();
}

async function getPolymarket(home, away) {
  const params = new URLSearchParams({
    q: `${home} ${away}`,
    limit_per_type: "12",
    keep_closed_markets: "1",
    search_profiles: "false"
  });
  const data = await fetchJson(`https://gamma-api.polymarket.com/public-search?${params}`);
  const candidates = (data.events || []).filter((event) =>
    mentions(event.title, home) && mentions(event.title, away)
  );
  const event = candidates.find((item) => !item.closed) || candidates[0];
  if (!event) return { found: false, updatedAt: new Date().toISOString() };

  const moneylines = (event.markets || []).filter((market) => market.sportsMarketType === "moneyline");
  const drawMarket = moneylines.find((market) => clean(market.question).includes("draw"));
  const homeMarket = moneylines.find((market) => mentions(market.question, home) && !clean(market.question).includes("draw"));
  const awayMarket = moneylines.find((market) => mentions(market.question, away) && !clean(market.question).includes("draw"));
  const raw = [yesPrice(homeMarket), yesPrice(drawMarket), yesPrice(awayMarket)];
  if (raw.some((value) => value === null)) return { found: false, updatedAt: new Date().toISOString() };

  const total = raw.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { found: false, updatedAt: new Date().toISOString() };
  const closed = Boolean(event.closed || [homeMarket, drawMarket, awayMarket].some((market) => market?.closed));
  return {
    found: true,
    title: event.title,
    slug: event.slug,
    url: `https://polymarket.com/event/${event.slug}`,
    closed,
    probabilities: { home: raw[0] / total, draw: raw[1] / total, away: raw[2] / total },
    volume: [homeMarket, drawMarket, awayMarket].reduce((sum, market) => sum + Number(market?.volumeNum || 0), 0),
    updatedAt: new Date().toISOString()
  };
}

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

async function getNews(home, away) {
  const query = `"${home}" OR "${away}" World Cup football when:7d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 WorldCupForecastLab/0.4" }
  });
  if (!response.ok) throw new Error(`News HTTP ${response.status}`);
  const xml = await response.text();
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
  return { items, updatedAt: new Date().toISOString() };
}

async function handleApi(url) {
  const home = url.searchParams.get("home");
  const away = url.searchParams.get("away");
  if (!home || !away || home.length > 40 || away.length > 40) {
    return json({ error: "Invalid teams" }, 400);
  }
  try {
    if (url.pathname === "/api/polymarket") return json(await getPolymarket(home, away));
    if (url.pathname === "/api/news") return json(await getNews(home, away));
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: error.message }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(url);
    return env.ASSETS.fetch(request);
  }
};
