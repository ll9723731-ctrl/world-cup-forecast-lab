# 世界杯预测实验室

一个无需第三方依赖的足球比赛预测网页，包含 Polymarket 实时盘口与近期新闻索引。

球队名单按 2026 世界杯 A-L 组收录全部 48 支正式参赛队。

## 启动

```powershell
node server.js
```

浏览器打开 `http://127.0.0.1:4173`。实时功能必须通过本地服务访问，不能直接双击 `public/index.html`。

## 部署到 Render

项目已经包含 `render.yaml`。将仓库推送到 GitHub 后，在 Render 选择 **New Blueprint Instance** 并连接仓库即可。服务会使用平台提供的 `PORT`，并监听 `0.0.0.0`。

## 部署到 Cloudflare

项目包含 `worker.mjs` 与 `wrangler.jsonc`，静态页面和两个实时 API 可以作为一个 Cloudflare Worker 部署。

```powershell
npm install
npx wrangler login
npm run deploy:cloudflare
```

Cloudflare Workers 免费计划适合个人访问量，不需要常驻服务器。

## 模型

- 基础球队强度：国家队 Elo 初始值
- 修正项：比赛场地、近期状态、阵容完整度
- 进球模型：将修正后的 Elo 差映射为双方预期进球
- 赛果模型：Dixon-Coles 风格的低比分相关性修正，生成 0-9 球比分矩阵
- 市场融合：读取 Polymarket 精确对阵的主胜、平局、客胜价格，归一化后按流动性进行对数概率融合
- 盘口中心：展示胜平负十进制赔率，并由比分矩阵实时计算亚洲让球、走盘与大小球公平赔率
- 最新信息：读取 Google News RSS 的近 7 日球队新闻标题

当前 Dixon-Coles 相关参数 `rho=-0.075` 是保守默认值，并非通过完整历史国家队数据重新估计。下一阶段应使用历史比赛训练进攻/防守强度和时间衰减参数，并以 Brier Score、Log Loss 与 Ranked Probability Score 做滚动回测。

## 方法依据

- Dixon, M. J. & Coles, S. G. (1997), *Modelling Association Football Scores and Inefficiencies in the Football Betting Market*
- FIFA 男足世界排名采用基于 Elo 思路的 SUM 更新方法
- 概率模型应使用 proper scoring rules 检查校准度，而不只比较猜中率

## 使用限制

内置 Elo 仍是初始样本，临场伤停需人工核实并调整。市场价格是交易者共识，可能受低流动性、价差和情绪影响。模型输出是概率，不是确定结果或投注建议。
