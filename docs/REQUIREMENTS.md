# Decision Journal — Requirements

## 技术栈

- **框架**: Electron (Main + Renderer 进程)
- **前端**: 原生 HTML5 / CSS3 / JavaScript (Vanilla JS)
- **图表**: Chart.js
- **解析器**: PapaParse (用于 CSV 解析)
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

## UI / 布局

- 现代毛玻璃（Glassmorphism）风格，Inter 字体，圆角卡片
- **设置**: 放在右上角齿轮图标，点击弹出 Modal（不再是 Streamlit 的 popover 或侧边栏）
- **窗口控制**:
  - 隐藏原生标题栏（`hiddenInset`），使用自定义拖拽区域。
  - 双击顶部空白区域可最大化/还原窗口（普通全屏逻辑）。
- **清理**: 已移除所有 Streamlit 和 Python 相关的冗余文件。
