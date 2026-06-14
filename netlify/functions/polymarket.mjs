import { clean, mentions, response, validateTeams, yesPrice } from "./shared.mjs";

export async function handler(event) {
  const teams = validateTeams(event);
  if (!teams) return response({ error: "Invalid teams" }, 400);
  const { home, away } = teams;

  try {
    const params = new URLSearchParams({
      q: `${home} ${away}`,
      limit_per_type: "12",
      keep_closed_markets: "1",
      search_profiles: "false"
    });
    const upstream = await fetch(`https://gamma-api.polymarket.com/public-search?${params}`, {
      headers: { "User-Agent": "WorldCupForecastLab/0.4" }
    });
    if (!upstream.ok) throw new Error(`Upstream HTTP ${upstream.status}`);
    const data = await upstream.json();
    const candidates = (data.events || []).filter((item) =>
      mentions(item.title, home) && mentions(item.title, away)
    );
    const eventMatch = candidates.find((item) => !item.closed) || candidates[0];
    if (!eventMatch) return response({ found: false, updatedAt: new Date().toISOString() });

    const moneylines = (eventMatch.markets || []).filter((market) => market.sportsMarketType === "moneyline");
    const drawMarket = moneylines.find((market) => clean(market.question).includes("draw"));
    const homeMarket = moneylines.find((market) => mentions(market.question, home) && !clean(market.question).includes("draw"));
    const awayMarket = moneylines.find((market) => mentions(market.question, away) && !clean(market.question).includes("draw"));
    const raw = [yesPrice(homeMarket), yesPrice(drawMarket), yesPrice(awayMarket)];
    const total = raw.reduce((sum, value) => sum + Number(value || 0), 0);
    if (raw.some((value) => value === null) || total <= 0) {
      return response({ found: false, updatedAt: new Date().toISOString() });
    }

    const closed = Boolean(eventMatch.closed || [homeMarket, drawMarket, awayMarket].some((market) => market?.closed));
    return response({
      found: true,
      title: eventMatch.title,
      slug: eventMatch.slug,
      url: `https://polymarket.com/event/${eventMatch.slug}`,
      closed,
      probabilities: { home: raw[0] / total, draw: raw[1] / total, away: raw[2] / total },
      volume: [homeMarket, drawMarket, awayMarket].reduce((sum, market) => sum + Number(market?.volumeNum || 0), 0),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return response({ error: error.message }, 502);
  }
}
