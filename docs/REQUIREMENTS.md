# Decision Journal — Requirements

## 技术栈

- **框架**: Electron (Main + Renderer 进程)
- **前端**: 原生 HTML5 / CSS3 / JavaScript (Vanilla JS)
- **模块化**: 每张表格的渲染逻辑独立在单独的 JS 文件中（`journal_table.js`、`scoring_table.js`、`holdings_table.js`），`renderer.js` 负责共享状态、初始化、Tab 切换、文件监听和搜索功能
- **图表**: Chart.js
- **解析器**: PapaParse (用于 CSV 解析)
- **通信**: ws (WebSocket，用于与 Chrome 扩展通信)
- **依赖管理**: npm
- **数据存储**: 本地 CSV 文件，支持双向实时同步

## 核心功能

### 表格（主体）

- 主体是一个类似 Excel / Google Sheets 的可编辑表格
- 包含列：**Date**, **Ticker**, **Action**, **Rules**, **后续走势**, **Rules Followed**
- `Rules Followed` 的值只能是 **Yes** 或 **No**，下拉选择带 emoji (✅ Yes / ❌ No)
- 支持点击列标题进行排序，默认按 **Date** 从新到旧排序（初始不显示箭头）
- `Date` 列直接输入或编辑（当前版本为文本编辑）
- 表格需要能够很容易地添加行（点击加号按钮）
- 所有列应在页面内直接可见，不需要横向滚动
- 单元格失去焦点（blur）时自动保存
- 表格上方显示加粗座右铭 **"先记录，再操作"**，与表格内侧左边缘对齐

### 持仓表（Decision Journal 右侧）

- 位于 Decision Journal Tab 右侧统计区域的上方
- 包含列：**Ticker**, **状态**, **均价 * 股数**, **是否有警报**, **是否有自动止损**
- `状态` 为下拉选择：🔻 / 💹
- `是否有警报` 和 `是否有自动止损` 为下拉选择：✅ / ❌
- 数据存储在独立 CSV 文件中

### 统计（表格右侧）

- 统计 Yes 和 No 的数量
- 趋势图：画 Yes 比例的 trend（基于时间排序的累计合规率）

### CSV 存储与同步

- 数据存在本地 CSV 文件
- 用户可自行指定 CSV 文件路径（默认 `~/decision_journal.csv`）
- **自动创建**：如果用户选择了一个文件夹而不是文件，应用会自动在该文件夹下创建 `decision_journal.csv`
- **双向同步**：
  - 应用内修改会自动保存到 CSV。
  - 外部修改 CSV 文件时，应用会自动检测并重新加载数据（防死循环）。
- **配置持久化**：上一次使用的 CSV 文件路径会保存在应用数据目录的 `config.json` 中，下次打开时自动加载。

### Tab 导航

- 顶部有三个 Tab：**📓 Decision Journal**、**📊 打分表** 和 **🌐 社交媒体**
- 点击 Tab 切换内容区域，带淡入动画
- 前两个 Tab 各自独立的数据源（不同 CSV 文件），第三个 Tab 加载外部网页

### 社交媒体 Tab

- 与 Decision Journal 和打分表平级的第三个 Tab
- 采用双列布局（Dual-column layout）
- 左侧加载 **x.com** (Twitter)，右侧加载 **xhslink.com** (小红书)
- 使用 Electron 的 `<webview>` 标签实现
- 支持 Session 持久化 (`partition="persist:social"`)，保留用户的登录 Cookie 状态


### 打分表

- 与 Decision Journal 平级的第二个 Tab
- 包含列：**代码**, **总分**, **Time**, **Follow**, **Z rank**, **Z hold**, **CK**, **Call**, **Setup**, **机构筹码**, **过往信号**, **Vol**, **题材**, **消息**, **情绪**
- **总分** 自动计算（除"代码"、"总分"、"Time"以外所有数字列之和）
- **不需要** 右侧的统计和趋势图（与 Decision Journal 不同）
- 所有功能与 Decision Journal 表格一致：
  - 单元格内联编辑（contentEditable）
  - 列标题点击排序（默认按总分从高到低）
  - 添加 / 删除行
  - 自动保存到 CSV
  - 文件监听外部同步
- **分数颜色分级**（5 档）：
  - `+1`, `+1.5`：绿色 (`#059669`)
  - `+0.5`：橘黄色 (`#d97706`)
  - `0`：淡灰色（半透明）
  - `-0.5`：较淡红色 (`#f87171`)
  - `-1`（及更低）：深红色 (`#dc2626`)
- **Setup=0 特殊处理**：Setup 值为 0 时显示 ❌ 图标，对应行的总分强制使用红色样式
- **总分颜色**：≥6 绿色背景，≥4 橙色背景，<4 红色背景
- **表头**：加粗（700），深色文字，0.9rem 字号
- 数据存储在独立 CSV 文件（默认与 Decision Journal 同目录下 `scoring_table.csv`）
- CSV 路径同样在 Settings Modal 中配置，持久化到 `config.json`

### 打分表 — 自动刷新分数

- 每行有一个 **↻ 刷新按钮**，点击后自动从外部数据源获取最新分数
- 通过 **WebDataWizard Chrome 扩展** 获取数据（见下方章节）
- 获取的字段：**Z rank**、**Z hold**、**CK**、**情绪**、**Call**
- 获取过程中按钮变为 ⌛ 状态，完成后恢复
- **并行获取**：Zacks Rank、Zacks Hold、Chaikin 评分、StockTwits 情绪和 Discord Call/Put 均并行获取，减少等待时间
- 获取完成后自动重新计算总分、更新 Time 字段、保存 CSV 并刷新表格
- **刷新后行移至顶部**：更新完成后，该行会自动移动到表格第一行
- **打开 TradingView**：点击刷新按钮时，会在默认浏览器中打开该 Ticker 对应的 TradingView 图表页（`https://cn.tradingview.com/chart/?symbol=TICKER`）
- **失败容错**：单个数据源获取失败时返回 `'failed'`，不覆盖已有分数；Toast 通知中以红色标注失败字段

### Toast 通知系统

- 固定在窗口右上角，堆叠显示（最多 8 条）
- 毛玻璃风格，带滑入/滑出动画
- 四种类型：`info`（紫色）、`success`（绿色）、`error`（红色）、`progress`（蓝色）
- 通过 IPC `score-progress` 通道接收来自主进程的实时进度消息
- 自动定时消失，成功消息保留较长时间

## WebDataWizard Chrome 扩展集成

Decision Journal 通过 **WebDataWizard** Chrome 扩展从已登录的浏览器会话中获取金融数据，无需在 Electron 中处理登录流程。

### 通信架构

```
Decision Journal (Electron)              WebDataWizard (Chrome Extension)
┌───────────────────────────┐            ┌────────────────────────────────┐
│  ws_server.js             │            │  offscreen.js                  │
│  WebSocket Server (:18234)│◄──────────►│  (持久 WebSocket 连接)          │
│                           │            │         ↕                      │
│  main.js                  │            │  background.js                 │
│  IPC: update-scores       │            │  (调度 + 引入数据源)             │
│  IPC: score-progress      │            │         ↕                      │
│  IPC: open-external       │            │  data_sources/*.js             │
│                           │            │  (Zacks, Chaikin, StockTwits,  │
│                           │            │   Discord)                     │
│  update-score.js          │            │  (数据提取)                     │
│  (Toast 通知 + UI 更新)    │            │                                │
└───────────────────────────┘            └────────────────────────────────┘
```

### 数据源

| 数据源 | 字段 | 评分逻辑 |
|--------|------|----------|
| Zacks Rank | Z rank | 1-Strong Buy → +1, 2-Buy → +0.5, 3-Hold → 0, 4-Sell → -0.5, 5-Strong Sell → -0.5 |
| Zacks Hold (All Trades) | Z hold | 在列表中 → +1，不在列表中 → 0（二元评分） |
| Chaikin Analytics | CK | Bullish/Very Bullish → +1, Neutral+ → +0.5, Neutral → 0, Neutral- → -0.5, Bearish/Very Bearish → -1 |
| StockTwits Sentiment | 情绪 | Extremely Bullish/Bullish → +1, Neutral → 0, Bearish/Extremely Bearish → -1 |
| Discord Unusual Options | Call | 异常期权权利金排行榜图片识别：Call Top 10 → +1, Put Top 10 → -1, Both/None → 0。通过 Discord API 获取频道最新图片，使用 Gemini Vision 提取 Ticker 列表，结果缓存 5 分钟 |

### 工作流程

1. Electron 应用启动时，`ws_server.js` 在 `localhost:18234` 启动 WebSocket 服务器
2. Chrome 扩展的 offscreen document 自动连接到该服务器（持久连接，不受 Service Worker 生命周期影响）
3. 用户点击打分表中的 ↻ 刷新按钮
4. 浏览器自动打开 TradingView 图表页
5. Electron 通过 WebSocket 发送 `{ action: "fetchScores", ticker: "ONDS" }` 请求
6. 扩展在后台同时打开 Zacks、Chaikin、StockTwits 页面并通过 Discord API + Gemini Vision 提取数据
7. 结果（含 Discord Call/Put）通过 WebSocket 返回给 Electron，更新表格并显示 Toast 通知
8. 更新后的行移至表格第一行

### 前置条件

- Chrome 浏览器已安装并加载 WebDataWizard 扩展
- 浏览器已登录 Zacks 和 Chaikin Analytics 账户
- WebDataWizard 的 `config.env.js` 中配置了 `ENV_DISCORD_TOKEN`、`ENV_DISCORD_CHANNEL_ID` 和 `ENV_GEMINI_API_KEY`

## UI / 布局

- 现代毛玻璃（Glassmorphism）风格，Inter 字体，圆角卡片
- **设置**: 放在右上角齿轮图标，点击弹出 Modal（不再是 Streamlit 的 popover 或侧边栏）
- **窗口控制**:
  - 隐藏原生标题栏（`hiddenInset`），使用自定义拖拽区域。
  - 双击顶部空白区域可最大化/还原窗口（普通全屏逻辑）。
  - 应用启动时默认最大化（非全屏），且使用 `ready-to-show` 事件避免白屏或闪烁。
- **搜索**: 支持 Cmd+F 页面内搜索（Electron `findInPage` API），显示匹配数和上下导航
- **快捷键**: Cmd+R 默认行为已禁用，防止应用意外重载
- **清理**: 已移除所有 Streamlit 和 Python 相关的冗余文件。
