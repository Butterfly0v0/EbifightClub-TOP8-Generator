# EbifightClub TOP8 Generator

炸虾格斗会用的格斗游戏比赛 **TOP8 海报生成器**。角色立绘来自 [StreamHelperAssets](https://github.com/joaorb64/StreamHelperAssets)，可按游戏 / 素材包加载；支持从 start.gg、Challonge、parry.gg 导入名次，也可在布局编辑器中自定义模板。

## 快速开始

需要 [Node.js](https://nodejs.org/)（建议 LTS）。

```bash
npm install
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173`）。

Windows 也可双击 `启动.bat`：首次会自动 `npm install`，然后启动开发服务器并打开浏览器。

左侧编辑赛事信息、选手与角色，右侧实时预览；点 **导出 PNG**（1920×1080）或 **导出英文 PNG** / **导出推文**。

## 主要功能

- **游戏 / 素材包**：从 StreamHelperAssets 读取游戏列表；`full` 一般为全身立绘，适合 TOP8。
- **布局**：内置经典 TOP8、领奖台等；另有社区布局文件（`public/user-assets/*.layout.json`）。可在 **布局编辑器** 中拖拽槽位、框体、标题等，导出 / 导入布局 JSON。
- **背景与品牌**：上传背景图并调节暗化；可放 Logo；未上传时用纯色背景。
- **自定义立绘**：每位选手主选 / 副选可上传本地图（优先于素材包）；最多 3 个角色，副选以小图标显示。
- **字体与主题**：标题 / 选手名 / 名次字体可选；框体样式、强调色等可调。
- **赛事导入**
  - **start.gg**：粘贴 event 链接；角色按近期选用次数猜测，请核对。限流时可到 [start.gg Developer](https://www.start.gg/admin/profile/developer) 创建 token 填入页面。
  - **Challonge**：粘贴赛事链接（含社区子域），需 [API Key](https://challonge.com/settings/developer)；赛事需已完赛。
  - **parry.gg**：粘贴 standings 页链接，无需 Key。
- **素材源**：默认 jsDelivr；国内失败可改 GitHub Raw。
- **按游戏存档**：开发环境下海报数据可保存到本地 `saves/<gameCode>/`（该目录不进入仓库）。

使用立绘请遵守各素材包 README 中的 credits。导出图底部默认可带来源说明，可关闭。

首次选择游戏时会把素材下载到 `.sha-cache/`（不进入仓库），之后切换角色会更快。

## 导出 API（可选）

开发 / `vite preview` 下提供无头渲染接口，供外部程序生成 PNG（作业目录 `.api-jobs/`，不进入仓库）。

- 渲染页：`/export-api.html`
- 中间件：`server/top8ApiMiddleware.ts`
- 可选鉴权：环境变量 `TOP8_API_KEY`

请求体结构见 `src/lib/top8Api.ts` 中的 `Top8ApiRequest`。

## 技术栈

Vite + React + TypeScript。海报在 Canvas 上合成（eyesight 对齐角色）。本地代理 `/api/sha`、`/api/startgg`、`/api/challonge`、`/api/parry` 等，避免浏览器跨域。

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览构建结果 |
| `npm run lint` | oxlint |

## 仓库说明

本仓库只包含运行与备份所需的源码、配置与**布局模板资源**（`public/user-assets` 根目录下的框体 / 背景 / `*.layout.json`）。

以下内容为本地缓存或个人数据，**不会**上传：

| 路径 | 原因 |
|------|------|
| `node_modules/`、`dist/` | 依赖与构建产物 |
| `.sha-cache/` | StreamHelperAssets 下载缓存 |
| `.api-jobs/` | API 渲染作业缓存 |
| `saves/` | 本地按游戏保存的海报稿 |
| `public/user-assets/<游戏码>/` | 运行时上传的个人背景 / Logo 等 |
| `public/user-assets/preview-bg-*` | 预览用临时图 |
| `public/brand/` | 本地品牌覆盖图 |
| `api-smoke-top8.png` | 本地冒烟测试输出 |
| `.env*` | 密钥（API Token 等存在浏览器 localStorage，勿写入仓库） |

克隆后执行 `npm install` 即可使用；素材会在首次加载时自动缓存到本地。
