# Decision Journal — Requirements

## 技术栈

- **框架**: Electron (Main + Renderer 进程)
- **前端**: 原生 HTML5 / CSS3 / JavaScript (Vanilla JS)
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

- 顶部有两个 Tab：**📓 Decision Journal** 和 **📊 打分表**
- 点击 Tab 切换内容区域，带淡入动画
- 两个 Tab 各自独立的数据源（不同 CSV 文件）

### 打分表

- 与 Decision Journal 平级的第二个 Tab
- 包含列：**代码**, **总分**, **Time**, **Follow**, **RS**, **Z rank**, **Z hold**, **Chaikin**, **Call**, **Setup**, **Vol**, **题材**, **坏消息**, **好消息**, **情绪**
- **总分** 自动计算（Follow + RS + Z rank + Z hold + Chaikin + Call + Setup + Vol + 题材 + 坏消息 + 好消息 + 情绪 之和）
- **不需要** 右侧的统计和趋势图（与 Decision Journal 不同）
- 所有功能与 Decision Journal 表格一致：
  - 单元格内联编辑（contentEditable）
  - 列标题点击排序
  - 添加 / 删除行
  - 自动保存到 CSV
  - 文件监听外部同步
- **分数颜色分级**（5 档）：
  - `+1`, `+1.5`：绿色 (`#059669`)
  - `+0.5`：橘黄色 (`#d97706`)
  - `0`：淡灰色（半透明）
  - `-0.5`：较淡红色 (`#f87171`)
  - `-1`（及更低）：深红色 (`#dc2626`)
- **总分颜色**：≥6 绿色背景，≥4 橙色背景，<4 红色背景
- **表头**：加粗（700），深色文字，0.9rem 字号
- 数据存储在独立 CSV 文件（默认与 Decision Journal 同目录下 `scoring_table.csv`）
- CSV 路径同样在 Settings Modal 中配置，持久化到 `config.json`

### 打分表 — 自动刷新分数

- 每行有一个 **↻ 刷新按钮**，点击后自动从外部数据源获取最新分数
- 通过 **WebDataWizard Chrome 扩展** 获取数据（见下方章节）
- 获取的字段：**Z rank**、**Chaikin**
- 获取过程中按钮变为 ⌛ 状态，完成后恢复
- **Zacks 和 Chaikin 并行获取**，减少等待时间
- 获取完成后自动重新计算总分、更新 Time 字段、保存 CSV 并刷新表格

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
│  IPC: update-scores       │            │  (标签页管理 + 内容脚本调度)      │
│  IPC: score-progress      │            │         ↕                      │
│                           │            │  content_zacks.js              │
│  update-score.js          │            │  content_chaikin.js            │
│  (Toast 通知 + UI 更新)    │            │  (DOM 数据提取)                 │
└───────────────────────────┘            └────────────────────────────────┘
```

### 工作流程

1. Electron 应用启动时，`ws_server.js` 在 `localhost:18234` 启动 WebSocket 服务器
2. Chrome 扩展的 offscreen document 自动连接到该服务器（持久连接，不受 Service Worker 生命周期影响）
3. 用户点击打分表中的 ↻ 刷新按钮
4. Electron 通过 WebSocket 发送 `{ action: "fetchScores", ticker: "ONDS" }` 请求
5. 扩展在后台同时打开 Zacks 和 Chaikin 页面，通过内容脚本提取数据
6. 结果通过 WebSocket 返回给 Electron，更新表格并显示 Toast 通知

### 前置条件

- Chrome 浏览器已安装并加载 WebDataWizard 扩展
- 浏览器已登录 Zacks 和 Chaikin Analytics 账户

## UI / 布局

- 现代毛玻璃（Glassmorphism）风格，Inter 字体，圆角卡片
- **设置**: 放在右上角齿轮图标，点击弹出 Modal（不再是 Streamlit 的 popover 或侧边栏）
- **窗口控制**:
  - 隐藏原生标题栏（`hiddenInset`），使用自定义拖拽区域。
  - 双击顶部空白区域可最大化/还原窗口（普通全屏逻辑）。
- **清理**: 已移除所有 Streamlit 和 Python 相关的冗余文件。

