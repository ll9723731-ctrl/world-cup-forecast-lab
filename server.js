const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const CACHE_TTL = 3 * 60 * 1000;
const cache = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(value));
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
  const outcomes = parseArray(market.outcomes);
  const prices = parseArray(market.outcomePrices).map(Number);
  const index = outcomes.findIndex((outcome) => clean(outcome) === "yes");
  return index >= 0 && Number.isFinite(prices[index]) ? prices[index] : null;
}

function cacheGet(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.time < CACHE_TTL) return item.value;
  return null;
}

function cacheSet(key, value) {
  cache.set(key, { time: Date.now(), value });
  return value;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "WorldCupForecastLab/0.2" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.json();
}

async function getPolymarket(home, away) {
  const key = `market:${home}:${away}`;
  const cached = cacheGet(key);
  if (cached) return cached;

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
  if (!event) return cacheSet(key, { found: false, updatedAt: new Date().toISOString() });

  const moneylines = (event.markets || []).filter((market) => market.sportsMarketType === "moneyline");
  const drawMarket = moneylines.find((market) => clean(market.question).includes("draw"));
  const homeMarket = moneylines.find((market) => mentions(market.question, home) && !clean(market.question).includes("draw"));
  const awayMarket = moneylines.find((market) => mentions(market.question, away) && !clean(market.question).includes("draw"));
  const raw = [yesPrice(homeMarket || {}), yesPrice(drawMarket || {}), yesPrice(awayMarket || {})];
  if (raw.some((value) => value === null)) {
    return cacheSet(key, { found: false, updatedAt: new Date().toISOString() });
  }

  const total = raw.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return cacheSet(key, { found: false, updatedAt: new Date().toISOString() });
  const closed = Boolean(event.closed || [homeMarket, drawMarket, awayMarket].some((market) => market?.closed));
  const result = {
    found: true,
    title: event.title,
    slug: event.slug,
    url: `https://polymarket.com/event/${event.slug}`,
    closed,
    probabilities: {
      home: raw[0] / total,
      draw: raw[1] / total,
      away: raw[2] / total
    },
    volume: [homeMarket, drawMarket, awayMarket].reduce((sum, market) => sum + Number(market?.volumeNum || 0), 0),
    updatedAt: new Date().toISOString()
  };
  return cacheSet(key, result);
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
  const key = `news:${home}:${away}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const query = `"${home}" OR "${away}" World Cup football when:7d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 WorldCupForecastLab/0.2" },
    signal: AbortSignal.timeout(12000)
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
  return cacheSet(key, { items, updatedAt: new Date().toISOString() });
}

async function handleApi(req, res, url) {
  const home = url.searchParams.get("home");
  const away = url.searchParams.get("away");
  if (!home || !away || home.length > 40 || away.length > 40) {
    return json(res, 400, { error: "Invalid teams" });
  }
  try {
    if (url.pathname === "/api/polymarket") return json(res, 200, await getPolymarket(home, away));
    if (url.pathname === "/api/news") return json(res, 200, await getNews(home, away));
    return json(res, 404, { error: "Not found" });
  } catch (error) {
    return json(res, 502, { error: error.message });
  }
}

function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(ROOT, `.${decodeURIComponent(requested)}`);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
  return serveStatic(req, res, url);
});

const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`World Cup Forecast Lab listening on ${HOST}:${PORT}`);
});
