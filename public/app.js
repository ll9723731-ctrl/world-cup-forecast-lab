const teams = [
  ["A","mex","墨西哥","Mexico","mx",1785],["A","rsa","南非","South Africa","za",1625],["A","kor","韩国","South Korea","kr",1760],["A","cze","捷克","Czechia","cz",1730],
  ["B","can","加拿大","Canada","ca",1765],["B","bih","波黑","Bosnia","ba",1685],["B","qat","卡塔尔","Qatar","qa",1640],["B","sui","瑞士","Switzerland","ch",1840],
  ["C","bra","巴西","Brazil","br",1990],["C","mar","摩洛哥","Morocco","ma",1860],["C","hai","海地","Haiti","ht",1510],["C","sco","苏格兰","Scotland","gb-sct",1745],
  ["D","usa","美国","USA","us",1805],["D","par","巴拉圭","Paraguay","py",1740],["D","aus","澳大利亚","Australia","au",1675],["D","tur","土耳其","Turkey","tr",1780],
  ["E","ger","德国","Germany","de",1935],["E","cur","库拉索","Curacao","cw",1530],["E","civ","科特迪瓦","Ivory Coast","ci",1710],["E","ecu","厄瓜多尔","Ecuador","ec",1795],
  ["F","ned","荷兰","Netherlands","nl",1950],["F","jpn","日本","Japan","jp",1830],["F","swe","瑞典","Sweden","se",1765],["F","tun","突尼斯","Tunisia","tn",1690],
  ["G","bel","比利时","Belgium","be",1910],["G","egy","埃及","Egypt","eg",1740],["G","irn","伊朗","Iran","ir",1755],["G","nzl","新西兰","New Zealand","nz",1480],
  ["H","esp","西班牙","Spain","es",2025],["H","cpv","佛得角","Cape Verde","cv",1600],["H","ksa","沙特阿拉伯","Saudi Arabia","sa",1600],["H","uru","乌拉圭","Uruguay","uy",1895],
  ["I","fra","法国","France","fr",2035],["I","sen","塞内加尔","Senegal","sn",1800],["I","irq","伊拉克","Iraq","iq",1625],["I","nor","挪威","Norway","no",1845],
  ["J","arg","阿根廷","Argentina","ar",2050],["J","alg","阿尔及利亚","Algeria","dz",1735],["J","aut","奥地利","Austria","at",1815],["J","jor","约旦","Jordan","jo",1585],
  ["K","por","葡萄牙","Portugal","pt",1965],["K","cod","民主刚果","DR Congo","cd",1660],["K","uzb","乌兹别克斯坦","Uzbekistan","uz",1650],["K","col","哥伦比亚","Colombia","co",1885],
  ["L","eng","英格兰","England","gb-eng",1985],["L","cro","克罗地亚","Croatia","hr",1870],["L","gha","加纳","Ghana","gh",1650],["L","pan","巴拿马","Panama","pa",1630]
].map(([group,id,name,en,flagCode,elo]) => ({ group,id,name,en,flagCode,elo }));

const previousMatches = [
  { date: "06-12", group: "B", home: "加拿大", away: "波黑", homeGoals: 1, awayGoals: 1, note: "东道主首战被逼平" },
  { date: "06-12", group: "D", home: "美国", away: "巴拉圭", homeGoals: 4, awayGoals: 1, note: "美国进攻效率高" },
  { date: "06-13", group: "C", home: "巴西", away: "摩洛哥", homeGoals: 1, awayGoals: 1, note: "强队失分样本" },
  { date: "06-14", group: "E", home: "德国", away: "库拉索", homeGoals: 7, awayGoals: 1, note: "大比分拉高进球环境" },
  { date: "06-16", group: "I", home: "法国", away: "塞内加尔", homeGoals: 3, awayGoals: 1, note: "热门队正常兑现" },
  { date: "06-16", group: "I", home: "挪威", away: "伊拉克", homeGoals: 4, awayGoals: 1, note: "热门锋线兑现" },
  { date: "06-16", group: "J", home: "阿根廷", away: "阿尔及利亚", homeGoals: 3, awayGoals: 0, note: "热门零封" },
  { date: "06-16", group: "J", home: "奥地利", away: "约旦", homeGoals: 3, awayGoals: 1, note: "热门胜出" }
];

const $ = (selector) => document.querySelector(selector);
const homeSelect = $("#home-team");
const awaySelect = $("#away-team");
let marketData = null;
let liveRequestId = 0;

function initialBoardTheme() {
  try {
    const stored = localStorage.getItem("forecastx-theme");
    return stored === "light" ? "light" : "dark";
  } catch (_error) {
    return "dark";
  }
}

function applyBoardTheme(theme = initialBoardTheme()) {
  document.documentElement.dataset.boardTheme = theme;
  const switcher = $("#theme-switch");
  if (switcher) {
    switcher.querySelector("strong").textContent = theme === "dark" ? "深色赛场" : "浅色看板";
    switcher.querySelector("em").textContent = theme === "dark" ? "点击切换浅色" : "点击切换深色";
  }
  try { localStorage.setItem("forecastx-theme", theme); } catch (_error) {}
}

function flagUrl(team) {
  return `https://flagcdn.com/w160/${team.flagCode}.png`;
}

function flagFallback(team) {
  if (team.id === "eng") return "ENG";
  if (team.id === "sco") return "SCO";
  return team.flagCode.toUpperCase();
}

function addTeamOptions(select) {
  [...new Set(teams.map((team) => team.group))].forEach((group) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = `${group}组`;
    teams.filter((team) => team.group === group).forEach((team) => {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = `${team.name} · ${team.en}`;
      optgroup.append(option);
    });
    select.append(optgroup);
  });
}

addTeamOptions(homeSelect);
addTeamOptions(awaySelect);
homeSelect.value = "ger";
awaySelect.value = "bra";

function teamById(id) {
  return teams.find((team) => team.id === id);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function poisson(k, lambda) {
  let factorial = 1;
  for (let i = 2; i <= k; i += 1) factorial *= i;
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial;
}

function dixonColesTau(homeGoals, awayGoals, homeLambda, awayLambda, rho) {
  if (homeGoals === 0 && awayGoals === 0) return 1 - homeLambda * awayLambda * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + homeLambda * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + awayLambda * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

function logarithmicPool(model, market, weight) {
  const keys = ["homeWin", "draw", "awayWin"];
  const marketKeys = { homeWin: "home", draw: "draw", awayWin: "away" };
  const values = keys.map((key) =>
    Math.pow(clamp(model[key], 0.001, 0.999), 1 - weight) *
    Math.pow(clamp(market[marketKeys[key]], 0.001, 0.999), weight)
  );
  const total = values.reduce((sum, value) => sum + value, 0);
  return { homeWin: values[0] / total, draw: values[1] / total, awayWin: values[2] / total };
}

function normalizeOutcome(homeWin, draw, awayWin) {
  const total = homeWin + draw + awayWin || 1;
  return { homeWin: homeWin / total, draw: draw / total, awayWin: awayWin / total };
}

function eloOutcome(difference) {
  const share = 1 / (1 + Math.pow(10, -difference / 410));
  const draw = clamp(0.30 - Math.abs(difference) / 2600, 0.18, 0.31);
  return normalizeOutcome((1 - draw) * share, draw, (1 - draw) * (1 - share));
}

function strengthProxyOutcome(result) {
  const tempo = clamp((result.homeLambda + result.awayLambda - 2.2) / 1.4, 0, 1);
  const draw = clamp(0.31 - tempo * 0.08 - Math.abs(result.difference) / 3200, 0.17, 0.32);
  const share = 1 / (1 + Math.exp(-result.difference / 185));
  return normalizeOutcome((1 - draw) * share, draw, (1 - draw) * (1 - share));
}

function calculateModel() {
  const home = teamById(homeSelect.value);
  const away = teamById(awaySelect.value);
  const venue = document.querySelector('input[name="venue"]:checked').value;
  const homeForm = Number($("#home-form").value);
  const awayForm = Number($("#away-form").value);
  const homeAvailability = Number($("#home-availability").value);
  const awayAvailability = Number($("#away-availability").value);

  let homeAdjusted = home.elo + homeForm - (100 - homeAvailability) * 3.2;
  let awayAdjusted = away.elo + awayForm - (100 - awayAvailability) * 3.2;
  if (venue === "home") homeAdjusted += 75;
  if (venue === "away") awayAdjusted += 75;

  const difference = homeAdjusted - awayAdjusted;
  const expectedTotal = clamp(2.65 + Math.abs(difference) / 1800, 2.35, 3.15);
  const share = 1 / (1 + Math.pow(10, -difference / 430));
  const homeLambda = clamp(expectedTotal * share, 0.2, 3.8);
  const awayLambda = clamp(expectedTotal * (1 - share), 0.2, 3.8);
  const rho = -0.075;

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let poissonHomeWin = 0;
  let poissonDraw = 0;
  let poissonAwayWin = 0;
  let poissonTotal = 0;
  let over25 = 0;
  let btts = 0;
  let matrixTotal = 0;
  const scores = [];

  for (let h = 0; h <= 9; h += 1) {
    for (let a = 0; a <= 9; a += 1) {
      const rawProbability = poisson(h, homeLambda) * poisson(a, awayLambda);
      const probability = rawProbability * dixonColesTau(h, a, homeLambda, awayLambda, rho);
      poissonTotal += rawProbability;
      if (h > a) poissonHomeWin += rawProbability;
      else if (h === a) poissonDraw += rawProbability;
      else poissonAwayWin += rawProbability;
      matrixTotal += probability;
      if (h > a) homeWin += probability;
      else if (h === a) draw += probability;
      else awayWin += probability;
      if (h + a >= 3) over25 += probability;
      if (h > 0 && a > 0) btts += probability;
      scores.push({ h, a, probability });
    }
  }

  scores.forEach((score) => { score.probability /= matrixTotal; });
  const base = {
    homeWin: homeWin / matrixTotal,
    draw: draw / matrixTotal,
    awayWin: awayWin / matrixTotal
  };
  const poissonBase = {
    homeWin: poissonHomeWin / poissonTotal,
    draw: poissonDraw / poissonTotal,
    awayWin: poissonAwayWin / poissonTotal
  };
  scores.sort((a, b) => b.probability - a.probability);

  let effectiveMarketWeight = 0;
  let blended = base;
  if ($("#market-blend").checked && marketData?.probabilities) {
    const requestedWeight = Number($("#market-weight").value) / 100;
    const liquidityFactor = clamp((Math.log10(Math.max(marketData.volume, 100)) - 3) / 3, 0.2, 1);
    effectiveMarketWeight = requestedWeight * liquidityFactor;
    blended = logarithmicPool(base, marketData.probabilities, effectiveMarketWeight);
  }

  return {
    home, away, venue, difference, homeAdjusted, awayAdjusted, homeLambda, awayLambda,
    homeWin: blended.homeWin, draw: blended.draw, awayWin: blended.awayWin,
    base, poissonBase, effectiveMarketWeight, over25: over25 / matrixTotal, btts: btts / matrixTotal,
    scores: scores.slice(0, 4), scoreMatrix: scores,
    homeForm, awayForm, homeAvailability, awayAvailability
  };
}

function outcomeLeader(model, home, away) {
  const values = [
    { key: "homeWin", label: home.name, value: model.homeWin },
    { key: "draw", label: "平局", value: model.draw },
    { key: "awayWin", label: away.name, value: model.awayWin }
  ];
  return values.sort((a, b) => b.value - a.value)[0];
}

function buildModelStack(result) {
  const elo = eloOutcome(result.difference);
  const strength = strengthProxyOutcome(result);
  const rows = [
    { name: "Dixon–Coles 比分", tag: "低比分修正", model: result.base },
    { name: "原始泊松进球", tag: "不修正相关性", model: result.poissonBase },
    { name: "纯 Elo 胜率", tag: "只看实力差", model: elo },
    { name: "强弱代理模型", tag: "状态 + 阵容", model: strength }
  ];
  if (marketData?.probabilities) {
    rows.push({
      name: "Polymarket 市场",
      tag: `成交量 ${formatMoney(marketData.volume)}`,
      model: {
        homeWin: marketData.probabilities.home,
        draw: marketData.probabilities.draw,
        awayWin: marketData.probabilities.away
      }
    });
  }
  rows.push({ name: "最终集成", tag: "页面主输出", model: { homeWin: result.homeWin, draw: result.draw, awayWin: result.awayWin }, final: true });
  return rows;
}

function calculateUpsetRadar(result, stack) {
  const favoriteIsHome = result.homeWin >= result.awayWin;
  const favorite = favoriteIsHome ? result.home : result.away;
  const underdog = favoriteIsHome ? result.away : result.home;
  const underdogWin = favoriteIsHome ? result.awayWin : result.homeWin;
  const favoriteWin = favoriteIsHome ? result.homeWin : result.awayWin;
  const market = marketData?.probabilities;
  const marketFavoriteWin = market ? (favoriteIsHome ? market.home : market.away) : null;
  const modelDisagreement = Math.max(...stack.slice(0, -1).map((row) => {
    const leader = outcomeLeader(row.model, result.home, result.away);
    return leader.label === favorite.name ? 0 : 1;
  }));
  const marketDivergence = marketFavoriteWin == null ? 0 : Math.abs(favoriteWin - marketFavoriteWin);
  const score = clamp(underdogWin + result.draw * 0.45 + modelDisagreement * 0.08 + marketDivergence * 0.5, 0, 0.72);
  const label = score >= 0.42 ? "高冷门窗口" : score >= 0.30 ? "中等冷门窗口" : "低冷门窗口";
  const text = `${favorite.name}仍是更可能方向，但${underdog.name}直接赢球概率为${percent(underdogWin)}，平局概率为${percent(result.draw)}。爆冷评分越高，越适合重点查看让球盘和临场阵容。`;
  return {
    label,
    text,
    score,
    factors: [
      `${underdog.name}赢球 ${percent(underdogWin)}`,
      `平局 ${percent(result.draw)}`,
      `热门胜率 ${percent(favoriteWin)}`,
      market ? `盘口分歧 ${Math.round(marketDivergence * 100)}%` : "暂无盘口分歧",
      modelDisagreement ? "存在模型反向" : "模型方向较一致"
    ]
  };
}

function percent(value) {
  return value == null ? "--" : `${Math.round(value * 100)}%`;
}

function signed(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function decimalOdds(probability) {
  if (!probability || probability <= 0) return "--";
  return (1 / probability).toFixed(2);
}

function asianFairOdds(win, push, lose) {
  if (win <= 0) return "--";
  return (1 + lose / win).toFixed(2);
}

function formatLine(value) {
  const number = Number(value);
  return number > 0 ? `+${number}` : `${number}`;
}

function calculateHandicap(matrix, line) {
  let homeWin = 0;
  let awayWin = 0;
  let push = 0;
  matrix.forEach((score) => {
    const adjusted = score.h + line - score.a;
    if (adjusted > 0) homeWin += score.probability;
    else if (adjusted < 0) awayWin += score.probability;
    else push += score.probability;
  });
  return { homeWin, awayWin, push };
}

function calculateTotal(matrix, line) {
  let over = 0;
  let under = 0;
  matrix.forEach((score) => {
    if (score.h + score.a > line) over += score.probability;
    else under += score.probability;
  });
  return { over, under };
}

function pickMainHandicap(result) {
  const lines = [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5];
  return lines.reduce((best, line) => {
    const outcome = calculateHandicap(result.scoreMatrix, line);
    const settled = outcome.homeWin + outcome.awayWin;
    const homeShare = settled ? outcome.homeWin / settled : 0.5;
    return Math.abs(homeShare - 0.5) < best.distance
      ? { line, distance: Math.abs(homeShare - 0.5) }
      : best;
  }, { line: 0, distance: Infinity }).line;
}

function renderOdds(result) {
  const { home, away } = result;
  $("#odds-home-name").textContent = home.name;
  $("#odds-away-name").textContent = away.name;
  $("#odds-home-price").textContent = decimalOdds(result.homeWin);
  $("#odds-draw-price").textContent = decimalOdds(result.draw);
  $("#odds-away-price").textContent = decimalOdds(result.awayWin);
  $("#odds-home-prob").textContent = percent(result.homeWin);
  $("#odds-draw-prob").textContent = percent(result.draw);
  $("#odds-away-prob").textContent = percent(result.awayWin);
  $("#one-x-two-source").textContent = marketData?.probabilities && $("#market-blend").checked
    ? "模型 + Polymarket"
    : "Dixon–Coles 模型";

  const handicapLine = Number($("#handicap-line").value);
  const handicap = calculateHandicap(result.scoreMatrix, handicapLine);
  $("#handicap-home-label").textContent = `${home.name} ${formatLine(handicapLine)}`;
  $("#handicap-away-label").textContent = `${away.name} ${formatLine(-handicapLine)}`;
  $("#handicap-home-price").textContent = asianFairOdds(handicap.homeWin, handicap.push, handicap.awayWin);
  $("#handicap-away-price").textContent = asianFairOdds(handicap.awayWin, handicap.push, handicap.homeWin);
  $("#handicap-home-prob").textContent = `${percent(handicap.homeWin)} 赢盘`;
  $("#handicap-away-prob").textContent = `${percent(handicap.awayWin)} 赢盘`;
  $("#handicap-push").textContent = handicap.push > 0.001 ? `走盘概率 ${percent(handicap.push)}` : "半球盘无走盘";

  const totalLine = Number($("#total-line").value);
  const total = calculateTotal(result.scoreMatrix, totalLine);
  $("#over-label").textContent = `大 ${totalLine}`;
  $("#under-label").textContent = `小 ${totalLine}`;
  $("#over-price").textContent = decimalOdds(total.over);
  $("#under-price").textContent = decimalOdds(total.under);
  $("#over-prob").textContent = percent(total.over);
  $("#under-prob").textContent = percent(total.under);
}

function renderModelLab(result) {
  const stack = buildModelStack(result);
  const leaders = stack.slice(0, -1).map((row) => outcomeLeader(row.model, result.home, result.away).label);
  const topLeader = outcomeLeader({ homeWin: result.homeWin, draw: result.draw, awayWin: result.awayWin }, result.home, result.away);
  const agreement = leaders.filter((label) => label === topLeader.label).length;
  $("#consensus-label").textContent = `${agreement}/${leaders.length} 模型支持 ${topLeader.label}`;
  $("#model-stack").replaceChildren(...stack.map((row) => {
    const leader = outcomeLeader(row.model, result.home, result.away);
    const item = document.createElement("div");
    item.className = row.final ? "model-row model-row-final" : "model-row";
    item.innerHTML = `
      <div><strong>${row.name}</strong><small>${row.tag}</small></div>
      <span>${percent(row.model.homeWin)}</span>
      <span>${percent(row.model.draw)}</span>
      <span>${percent(row.model.awayWin)}</span>
      <em>${leader.label}</em>
    `;
    return item;
  }));

  const upset = calculateUpsetRadar(result, stack);
  $("#upset-score").textContent = `${Math.round(upset.score * 100)}%`;
  $("#upset-text").textContent = `${upset.label}：${upset.text}`;
  $("#upset-factors").replaceChildren(...upset.factors.map((text) => {
    const tag = document.createElement("span");
    tag.textContent = text;
    return tag;
  }));
}

function renderPastMatches() {
  const games = previousMatches.length;
  const goals = previousMatches.reduce((sum, match) => sum + match.homeGoals + match.awayGoals, 0);
  const favoritesDropped = previousMatches.filter((match) => /失分|逼平/.test(match.note)).length;
  $("#past-games").textContent = games;
  $("#past-goals").textContent = goals;
  $("#past-avg-goals").textContent = (goals / games).toFixed(2);
  $("#past-upsets").textContent = favoritesDropped;
  $("#past-updated").textContent = `更新至 ${previousMatches.at(-1).date}`;
  $("#past-match-list").replaceChildren(...previousMatches.map((match) => {
    const row = document.createElement("div");
    row.className = "past-match";
    row.innerHTML = `
      <span>${match.date} · ${match.group}组</span>
      <strong>${match.home} ${match.homeGoals}-${match.awayGoals} ${match.away}</strong>
      <small>${match.note}</small>
    `;
    return row;
  }));
}

function setTeamVisuals(prefix, team) {
  const flag = $(`#${prefix}-flag`);
  flag.src = flagUrl(team);
  flag.alt = `${team.name}国旗`;
  flag.onerror = () => {
    flag.hidden = true;
    flag.parentElement.dataset.flagFallback = flagFallback(team);
  };
  flag.onload = () => {
    flag.hidden = false;
    delete flag.parentElement.dataset.flagFallback;
  };
  $(`#${prefix}-display-name`).textContent = team.name;
  $(`#${prefix}-group`).textContent = `${team.group}组 · ${team.en}`;
  $(`#${prefix}-elo`).textContent = team.elo;
}

function render() {
  const result = calculateModel();
  const { home, away } = result;
  setTeamVisuals("home", home);
  setTeamVisuals("away", away);

  $("#home-result-name").textContent = home.name;
  $("#away-result-name").textContent = away.name;
  $("#home-xg-name").textContent = home.name;
  $("#away-xg-name").textContent = away.name;
  $("#home-probability").textContent = percent(result.homeWin);
  $("#draw-probability").textContent = percent(result.draw);
  $("#away-probability").textContent = percent(result.awayWin);
  $("#home-bar").style.width = percent(result.homeWin);
  $("#draw-bar").style.width = percent(result.draw);
  $("#away-bar").style.width = percent(result.awayWin);
  $("#home-xg").textContent = result.homeLambda.toFixed(2);
  $("#away-xg").textContent = result.awayLambda.toFixed(2);
  $("#btts").textContent = percent(result.btts);
  $("#over25").textContent = percent(result.over25);

  $("#base-home").textContent = percent(result.base.homeWin);
  $("#base-draw").textContent = percent(result.base.draw);
  $("#base-away").textContent = percent(result.base.awayWin);
  $("#compare-market-home").textContent = percent(marketData?.probabilities?.home);
  $("#compare-market-draw").textContent = percent(marketData?.probabilities?.draw);
  $("#compare-market-away").textContent = percent(marketData?.probabilities?.away);
  $("#blend-home").textContent = percent(result.homeWin);
  $("#blend-draw").textContent = percent(result.draw);
  $("#blend-away").textContent = percent(result.awayWin);
  renderOdds(result);
  renderModelLab(result);

  const highest = Math.max(result.homeWin, result.draw, result.awayWin);
  $("#confidence-label").textContent = highest >= 0.66 ? "较高置信度" : highest >= 0.48 ? "中等置信度" : "低置信度";
  $("#score-list").replaceChildren(...result.scores.map((score) => {
    const row = document.createElement("div");
    row.className = "score-item";
    row.innerHTML = `<span class="scoreline">${score.h} : ${score.a}</span><small>${percent(score.probability)}</small>`;
    return row;
  }));

  let verdict = "双方实力接近，比赛不确定性较高";
  if (result.homeWin > result.awayWin + 0.12) verdict = `${home.name}是更可能获胜的一方`;
  if (result.awayWin > result.homeWin + 0.12) verdict = `${away.name}是更可能获胜的一方`;
  const marketText = result.effectiveMarketWeight > 0
    ? `市场实际贡献权重为 ${Math.round(result.effectiveMarketWeight * 100)}%`
    : "当前未使用有效市场盘口";
  $("#explanation").textContent =
    `${verdict}。修正后 Elo 差为 ${Math.abs(Math.round(result.difference))} 分，预期总进球 ${(result.homeLambda + result.awayLambda).toFixed(2)}。` +
    `Dixon–Coles 已修正低比分相关性，${marketText}。`;

  const venueText = result.venue === "neutral" ? "中立场" : result.venue === "home" ? `${home.name}主场 +75` : `${away.name}主场 +75`;
  const factors = [
    venueText, `${home.name}状态 ${signed(result.homeForm)}`, `${away.name}状态 ${signed(result.awayForm)}`,
    `${home.name}阵容 ${result.homeAvailability}%`, `${away.name}阵容 ${result.awayAvailability}%`,
    "低比分修正 ρ=-0.075"
  ];
  $("#factor-list").replaceChildren(...factors.map((text) => {
    const tag = document.createElement("span");
    tag.textContent = text;
    return tag;
  }));
}

function formatMoney(value) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function refreshLiveData() {
  const requestId = ++liveRequestId;
  const home = teamById(homeSelect.value);
  const away = teamById(awaySelect.value);
  marketData = null;
  $("#market-status").hidden = false;
  $("#market-status").textContent = "正在查找精确对阵市场...";
  $("#market-odds").hidden = true;
  $("#market-meta").textContent = "";
  $("#news-status").hidden = false;
  $("#news-status").textContent = "正在收集近期消息...";
  $("#news-list").replaceChildren();
  render();

  const query = new URLSearchParams({ home: home.en, away: away.en });
  const [marketResult, newsResult] = await Promise.allSettled([
    fetchJson(`/api/polymarket?${query}`),
    fetchJson(`/api/news?${query}`)
  ]);
  if (requestId !== liveRequestId) return;

  if (marketResult.status === "fulfilled" && marketResult.value.found) {
    const received = marketResult.value;
    $("#market-status").hidden = true;
    $("#market-odds").hidden = false;
    $("#market-home-name").textContent = home.name;
    $("#market-away-name").textContent = away.name;
    $("#market-home").textContent = `${percent(received.probabilities.home)} · ${decimalOdds(received.probabilities.home)}`;
    $("#market-draw").textContent = `${percent(received.probabilities.draw)} · ${decimalOdds(received.probabilities.draw)}`;
    $("#market-away").textContent = `${percent(received.probabilities.away)} · ${decimalOdds(received.probabilities.away)}`;
    $("#market-meta").textContent = `${received.title} · 总成交量 ${formatMoney(received.volume)}${received.closed ? " · 市场已关闭，仅展示" : ""}`;
    $("#market-updated").textContent = `更新 ${formatTime(received.updatedAt)}`;
    $("#market-link").href = received.url;
    marketData = received.closed ? null : received;
  } else {
    $("#market-status").textContent = "暂未找到这两队的活跃胜平负盘口，使用纯数据模型。";
    $("#market-updated").textContent = "无可用精确盘口";
    $("#market-link").href = `https://polymarket.com/search?_q=${encodeURIComponent(`${home.en} ${away.en}`)}`;
  }

  if (newsResult.status === "fulfilled" && newsResult.value.items?.length) {
    $("#news-status").hidden = true;
    $("#news-updated").textContent = `更新 ${formatTime(newsResult.value.updatedAt)}`;
    $("#news-list").replaceChildren(...newsResult.value.items.map((item) => {
      const row = document.createElement("div");
      row.className = "news-item";
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = item.title;
      const meta = document.createElement("small");
      meta.textContent = `${item.source} · ${formatTime(item.publishedAt)}`;
      row.append(link, meta);
      return row;
    }));
  } else {
    $("#news-status").textContent = "暂时没有取得近期新闻，伤停和状态请手动调整。";
    $("#news-updated").textContent = "获取失败";
  }
  render();
}

function updateOutputs() {
  $("#home-form-value").textContent = signed(Number($("#home-form").value));
  $("#away-form-value").textContent = signed(Number($("#away-form").value));
  $("#home-availability-value").textContent = `${$("#home-availability").value}%`;
  $("#away-availability-value").textContent = `${$("#away-availability").value}%`;
}

[homeSelect, awaySelect].forEach((select) => select.addEventListener("change", () => {
  $("#handicap-line").value = String(pickMainHandicap(calculateModel()));
  render();
  refreshLiveData();
}));
document.querySelectorAll('input[name="venue"]').forEach((input) => input.addEventListener("change", render));
document.querySelectorAll('input[type="range"]').forEach((input) => input.addEventListener("input", () => { updateOutputs(); render(); }));
$("#market-blend").addEventListener("change", render);
$("#market-weight").addEventListener("input", () => { $("#market-weight-value").textContent = `${$("#market-weight").value}%`; render(); });
$("#handicap-line").addEventListener("change", render);
$("#total-line").addEventListener("change", render);
$("#predict-button").addEventListener("click", refreshLiveData);
$("#theme-switch").addEventListener("click", () => {
  const next = document.documentElement.dataset.boardTheme === "dark" ? "light" : "dark";
  applyBoardTheme(next);
});

applyBoardTheme();
updateOutputs();
renderPastMatches();
render();
$("#handicap-line").value = String(pickMainHandicap(calculateModel()));
render();
refreshLiveData();
setInterval(refreshLiveData, 3 * 60 * 1000);
