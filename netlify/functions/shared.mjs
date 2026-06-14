export function response(value, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    },
    body: JSON.stringify(value)
  };
}

export function validateTeams(event) {
  const home = event.queryStringParameters?.home;
  const away = event.queryStringParameters?.away;
  if (!home || !away || home.length > 40 || away.length > 40) return null;
  return { home, away };
}

export function clean(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function teamVariants(name) {
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

export function mentions(text, name) {
  const value = clean(text);
  return teamVariants(name).some((variant) => value.includes(variant));
}

export function parseArray(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || "[]"); } catch { return []; }
}

export function yesPrice(market) {
  const outcomes = parseArray(market?.outcomes);
  const prices = parseArray(market?.outcomePrices).map(Number);
  const index = outcomes.findIndex((outcome) => clean(outcome) === "yes");
  return index >= 0 && Number.isFinite(prices[index]) ? prices[index] : null;
}

export function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function tag(block, name) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}
