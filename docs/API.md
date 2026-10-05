# TOP8 导出 API

在本地开发服务器（`npm run dev`）或预览服务器（`npm run preview`）上提供 HTTP 接口：传入选手数据或**赛事链接**，返回 1920×1080 的 TOP8 PNG。

## 前置条件

```bash
npm install
npm run setup:api   # 安装 Playwright Chromium（仅 API 渲染需要）
npm run dev         # 默认 http://localhost:5173
```

可选环境变量：

| 变量 | 说明 |
|------|------|
| `TOP8_API_KEY` | 若设置，所有写接口需 `Authorization: Bearer <key>` 或 `X-Api-Key: <key>` |
| `STARTGG_TOKEN` | start.gg 导入默认 Token（也可在请求体传 `startggToken`） |
| `CHALLONGE_API_KEY` | Challonge 导入默认 Key（也可在请求体传 `challongeApiKey`） |

检查服务是否就绪：

```bash
curl http://localhost:5173/api/v1/top8/health
```

应返回 JSON，且 `playwright: true`。

---

## 推荐：赛事链接直接出图

`POST /api/v1/top8/render-from-url`

根据 start.gg / Challonge / parry.gg 链接拉取前八名，匹配游戏与角色立绘，渲染 PNG。

### 请求示例

```bash
curl -X POST http://localhost:5173/api/v1/top8/render-from-url ^
  -H "Content-Type: application/json" ^
  -o top8.png ^
  -d "{\"url\":\"https://www.start.gg/tournament/YOUR_TOURNAMENT/event/YOUR_EVENT\"}"
```

PowerShell：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:5173/api/v1/top8/render-from-url `
  -ContentType 'application/json' `
  -Body (@{ url = 'https://www.start.gg/tournament/.../event/...' } | ConvertTo-Json) `
  -OutFile top8.png
```

### 请求体字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `url` 或 `tournamentUrl` | 是 | 赛事链接 |
| `gameCode` | 建议 | 游戏码（如 `sf6`、`ssbm`、`gbvsr`）。不传则按赛事游戏名自动匹配；parry.gg 常匹配不准，建议显式传入 |
| `layoutId` | 否 | 布局 id，默认 `classic`。可选值见下方「layoutId 可选值」 |
| `packId` | 否 | 素材包，默认 `full` |
| `posterLocale` | 否 | `zh` 或 `en` |
| `startggToken` | 否* | start.gg Token（限流时建议提供） |
| `challongeApiKey` | Challonge 必填* | Challonge API Key |
| `tournamentName` / `subtitle` / `date` / `numEntrants` | 否 | 覆盖导入结果 |
| `teamMode` | 否 | `true` 时按组队赛出图。用赛事链接导入时，start.gg / parry.gg 组队赛会自动打开 |
| `backgroundImageUrl` / `logoUrl` / `accent` / `background` / `backgroundDim` | 否 | 海报外观 |
| `customLayout` | 否 | 自定义布局 JSON（配合 `layoutId: "custom"`） |

\* 也可改用环境变量 `STARTGG_TOKEN` / `CHALLONGE_API_KEY`。

#### layoutId 可选值

| 值 | 名称 | 说明 |
|------|------|------|
| `classic` | 经典 TOP8 | 冠军大图在左，2–4 名叠在右侧，5–8 名贴底（默认） |
| `podium` | 领奖台 | 2nd \| 1st \| 3rd 领奖台，下面一排放 4–8 名 |
| `squares` | 方格 TOP8 | 冠军大方块在左，2–4 名与 5–8 名在右侧两行正方形排列 |
| `tokon` | 斗魂 TOP8 | 左侧冠军，右上 2–4 名、右下 5–8 名，底栏标题 |
| `paragon` | 竞技方格（仿 Paragonline） | 全宽网格：左侧冠军、右上 2–4、右下 5–8，白底栏 + 红名条 |
| `animefgc` | AnimeFGC（仿 AnimeFGC） | 左侧冠军大图 + 右侧 2–8 名竖排列表，顶部赛事标题 |
| `ebifc` | 炸虾像素（EbifightClub） | 像素街机风方格 + 白边贴纸框 + 血条名牌 |
| `prism` | 棱镜 TOP8 | 冠军居中聚光，2–5 名环抱两侧，6–8 名底部横条，紫青棱镜切面名牌 |
| `custom` | 自定义 | 需同时传 `customLayout`（布局编辑器导出的 JSON） |

也可调用 `GET /api/v1/top8/layouts` 查看当前服务端内置列表。

### 支持的链接

- **start.gg**：`https://www.start.gg/tournament/.../event/...`（会猜测角色，请核对）
- **Challonge**：`https://challonge.com/...` 或社区子域；赛事需已完赛
- **parry.gg**：`https://parry.gg/tournament/event` 或 `/_standings`

### 响应

- **200**：`Content-Type: image/png` 二进制图
- 响应头：`X-Top8-Job-Id`、`X-Top8-Game-Code`、`X-Top8-Import-Source`
- **400**：链接/参数错误（纯文本）
- **401**：API Key 不匹配
- **502**：渲染失败（常见：未装 Playwright、素材下载超时）

首次某游戏可能较慢（下载立绘缓存到 `.sha-cache/`），之后会快很多。

---

## 只导入、不渲染

`POST /api/v1/top8/import`

请求体与 `render-from-url` 相同，返回 JSON（含 `players`、匹配到的 `gameCode`、合成后的 `doc`），便于调试或自行改数据后再调 `render`。

```bash
curl -X POST http://localhost:5173/api/v1/top8/import ^
  -H "Content-Type: application/json" ^
  -d "{\"url\":\"https://parry.gg/your-tournament/event/_standings\"}"
```

---

## 手动选手数据出图

`POST /api/v1/top8/render`

不经过赛事平台，直接提交选手与角色。

```json
{
  "gameCode": "sf6",
  "layoutId": "classic",
  "tournamentName": "EbifightClub",
  "subtitle": "Weekly TOP 8",
  "date": "2026-08-26",
  "numEntrants": 32,
  "posterLocale": "zh",
  "players": [
    {
      "placement": 1,
      "tag": "Player1",
      "prefix": "TEAM",
      "characters": [{ "codename": "Ryu", "skin": 0 }]
    },
    {
      "placement": 2,
      "tag": "Player2",
      "characters": [{ "codename": "Ken" }, { "codename": "Luke" }]
    }
  ]
}
```

`players` 最多 8 名；不足会补空位。`codename` 须与 StreamHelperAssets 中该游戏的角色码一致。

组队赛在请求里加 `teamMode: true`，每个名次用 `tag` 当队名，并用 `members` 列出队员（每人一张主立绘，最多 5 人）。所有内置布局都会把队员立绘并排画进该名次框：

```json
{
  "gameCode": "sf6",
  "layoutId": "classic",
  "teamMode": true,
  "tournamentName": "Crews Weekly",
  "players": [
    {
      "placement": 1,
      "tag": "Team Liquid",
      "members": [
        { "tag": "Daigo", "characters": [{ "codename": "Ryu" }] },
        { "tag": "Tokido", "characters": [{ "codename": "Ken" }] },
        { "tag": "Fuudo", "characters": [{ "codename": "Luke" }] }
      ]
    }
  ]
}
```

start.gg 组队赛（`teamRosterSize.maxPlayers > 1`，或前八名参赛者有多名队员）和 parry.gg 多人报名会自动打开组队赛模式，并把近期对局里的角色归到对应队员。Challonge 不提供队员名单，导入后仍是单人赛，可在页面上手动打开组队赛模式再填队员。

也可用 `doc` 传入接近完整的海报文档（与页面存档结构相同），字段优先级见 `src/lib/top8Api.ts`。

---

## 其它接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/top8/health` | 健康检查 / Playwright 是否可用 |
| GET | `/api/v1/top8/layouts` | 内置布局列表 |
| POST | `/api/v1/top8/prepare` | 只创建任务，返回 `exportUrl`（可用浏览器打开调试）；支持 `url` 或选手 JSON |
| GET | `/api/v1/top8/jobs/:id` | 查看任务文档（调试） |

无头渲染页：`/export-api.html?job=<id>`（一般无需手动打开）。

---

## 外部程序集成建议

1. 启动本仓库的 `npm run dev`（或部署到可访问的 preview 环境）。
2. 调用 `POST /api/v1/top8/render-from-url`，body 只传 `url`（及必要的 Key）。
3. 将响应体保存为 `.png`。
4. 若角色猜测不准：先 `import` → 修正 `doc.players` → 再 `render`。

超时建议 ≥ 3 分钟（冷启动下载素材时更久）。

作业临时文件在 `.api-jobs/`（已 gitignore），约 1 分钟后自动清理。

---

## 故障排查

| 现象 | 处理 |
|------|------|
| `playwright: false` | 执行 `npm run setup:api` |
| start.gg 找不到赛事 / 400 / 限流 | 在 body 或环境变量提供 `STARTGG_TOKEN` |
| Challonge 401 | 检查 `challongeApiKey` |
| 未知游戏码 / 立绘不对 | 显式传 `gameCode`（如 `sf6`、`gbvsr`、`ssbm`） |
| 角色空白 | Challonge/parry 不带角色，需手动 `import` 后补 `codename`，或改用 start.gg |
| 502 图片加载失败 | 确认能访问 jsDelivr/GitHub；查看 `.sha-cache/` 是否写入 |
