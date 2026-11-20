# DESIGN.md — Platinum UI Design System Specification

> **Creative North Star**: **Mac OS 9 Platinum 机械桌面工作台** —— 利落 `1px` 实框、`2px` 硬投影、四层高光/暗角金属斜面、`2px` 水平细横纹标题条与 `0ms` 干脆瞬切，兼顾现代高分屏、深色模式与严格 WCAG AA 无障碍标准。

---

## 1. 架构分层与双模式挂载

本系统遵循「W3C DTCG 令牌真源 → 零框架 JS 分层 CSS → 静态/实时自动体检门禁」三层解耦：

| 构建产物 | 包含层级 | 适用场景 |
|---|---|---|
| `dist/platinum.css` | `pt.tokens` + `pt.core` + `pt.elements` + `pt.prose` | **全应用独占 Platinum**（独立桌面应用、全新 Web 工具）：裸写 `<button>`、`<input>`、`<select>`、`<fieldset>` 即自动成型，也可混用 `.pt-*` 原语类 |
| `dist/platinum-scoped.css` | `[data-platinum]` 隔离版全套四层 | **多主题并存 / 浏览器扩展 / 宿主注入**：仅在挂载 `data-platinum` 的根节点或局部容器内生效，外部 `:root` 零污染 |
| `dist/platinum-core.css` | `pt.tokens` + `pt.core` + `pt.prose`（不含裸标签接管） | **存量复杂项目渐进接入**：只对显式声明 `.pt-window`、`.pt-btn`、`.pt-field` 的元素生效，零隐式副作用 |
| `dist/platinum-tokens.css` | 仅 `pt.tokens` | 仅消费 `--pt-*` 颜色、斜面与阶梯变量，自行编写业务组件 CSS |

### 根节点控制属性

- **明暗模式**：默认自动跟随系统 `prefers-color-scheme`；可通过 `data-platinum-scheme="light"` 或 `data-platinum-scheme="dark"`（兼容 `data-theme="platinum-light"` / `data-theme="platinum-dark"`）显式锁定。
- **官方点缀变体**：
  - 默认 **`gray`**（Mac OS 9 Appearance 控制面板正统纯银灰变体，**彻底去紫**）：银灰三横脊滚动条、中性银灰选区与选中行、深炭反白菜单、深石板蓝焦点与链接。
  - 可选 **`data-platinum-accent="lavender"`**（Mac OS 9 出厂经典薰衣草变体）：薰衣草淡紫文本选区（浅 `#ccccff` / 深 `#3d3dad`）、薰衣草三横脊滚动条（`#9999ff` / `#5c5c9e`）与深靛蓝菜单/焦点（`#333399` / `#b3b3ff`）。
- **尺寸密度阶梯**：
  - 默认 **`compact`**：标准控件 `26px`（`--pt-control-h`），次级紧凑图标钮 `20px`（`--pt-control-h-sm`，配双层轻斜面 `--pt-bevel-mini` 与 `::before` `24×24px` 隐形热区），标题栏 `22px`（`--pt-titlebar-h`）。
  - 可选 **`data-platinum-density="comfortable"`**：标准控件 `32px`，小号控件 `24px`，标题栏 `24px`。
- **跨平台窗口控制预设（`data-platinum-controls`）**：
  - 默认 **`mac9`**（1999 原生 Mac OS 9 HIG）：左上关闭（`.pt-tbox-close`），右上缩放（`.pt-tbox-zoom`）+ WindowShade 折叠双横线（`.pt-tbox-minimize` 呈 `═`）。
  - 可选 **`data-platinum-controls="macos"`**（现代 macOS 左置三连）：左上依次排列关闭、最小化（`−`）、缩放（`□↔▣`）。
  - 可选 **`data-platinum-controls="win"`**（Windows / Linux 右置三连）：右上依次排列最小化（`−`）、缩放（`□↔▣`）、关闭（`×`）。
  - 同一份零冗余 DOM（在 `.pt-titlebar` 内直写 3 个空 `.pt-tbox-*` 按钮 + `.pt-titlebar-label`）通过 CSS 变量与 Flex `order` 跨平台重排并自动绘制 `9×9px` `currentColor` 矢量遮罩字形（检测到内嵌 `<svg>` 时自动让位）；支持在单个页面内按窗口级嵌套混排不同系统预设。
  - 标题栏采用居中 `12px` 高（`2px` 周期 6 条）经典细横纹；窗口失焦（`data-inactive="true"` / `data-window-focused="false"`）时横纹隐去且 `.pt-tbox` 同步退平为柔和灰框；窗口设置 `data-collapsed="true"` 自动进入 Mac OS 9 WindowShade 卷起态；Electron 无边框主窗可叠加 `.pt-titlebar--draggable` 自动配置拖拽区与 `no-drag`。
  - **连排窗控无重叠热区**：`.pt-tbox` 为 `13×13px` 视觉盒配 `gap: 5px`，通过 `::before { inset: -5.5px -3.5px }` 形成 `18×22px` 边贴边无缝零重叠热区（纵向铺满 `22px` 标题栏、横向绝不侵入相邻按钮），由 `bin/platinum-check.mjs` 自动检测相邻窗控零重叠。

---

## 2. 色彩与对比度铁律

1. **零偏色金属底盘（`R = G = B`）**：无论浅色银灰（`#bfbfbf` → `#cccccc` → `#dddddd` → `#ffffff`）还是深色碳黑金属（`#181818` → `#2c2c2c` → `#3b3b3b` → `#1c1c1c`），所有结构灰阶严禁掺入蓝紫冷偏色。
2. **禁止泛紫令**：即便在 `lavender` 变体下，紫色也**严格限定**在焦点/链接、文本选区、菜单激活底与滚动条滑块 5 个语义槽位；所有按钮（含默认主按钮 `.pt-btn-primary`）、标签芯片（`.pt-chip`）、代码块和普通列表行悬停一律保持纯粹中性铂金灰。
3. **主按钮靠双环结构而非彩色填充表达主次**：默认主按钮 `.pt-btn-primary` 保持 `--pt-face` 银灰表面与高对比文字，通过外圈 `--pt-ring-default-btn`（自身 `1px` 黑框 + `2px` 灰槽 + `1px` 外黑环）复刻 Mac OS 9 HIG Default Push Button。
4. **全象限 WCAG AA 硬门**：`--pt-ink`、`--pt-ink-muted`、`--pt-accent`、`--pt-danger`、`--pt-success`、`--pt-warning` 在 `paper`、`window`、`face`、`face-hover` 四种底面上，以及 `pressed`、`selection`、`menu-active` 成对前背景在 `(light, dark) × (gray, lavender)` 全部组合下均须 `>= 4.5:1`。

---

## 3. 物理深度、圆角与动效规范

- **三级物理深度**：
  - **浮动窗口（`.pt-window` / `.pt-menu`）**：`1px solid var(--pt-frame)` + 内侧高光暗边 `--pt-bevel-window` + 右下硬边投影 `--pt-shadow-window`（`2px 2px 0`），**禁用高斯弥散阴影**。
  - **凸起控件（`.pt-btn` / `.pt-select`）**：常态 `--pt-bevel-btn`（小号 `20px` 用双层 `--pt-bevel-mini` 防内腔拥挤）；按下或激活（`:active`、`[aria-pressed="true"]`、`[aria-expanded="true"]`、`[aria-selected="true"]`、`.is-active`）切换为深炭底 `--pt-pressed-bg` + 内凹 `--pt-bevel-pressed`，且 `:hover` 绝不覆盖激活态。
  - **下凹内容井（`.pt-well` / `.pt-field`）**：白底/深碳内井 `--pt-paper` + 左上暗右下亮 `--pt-bevel-sunken`；在桌面灰窗口内部放置长列表或阅读区时，优先包入 `.pt-well` 以就地切换背景上下文。
- **圆角纪律**：窗口、面板、内容井、分组框、菜单、代码块、表格、输入框、芯片与状态方标一律 `0px` 直角（`--pt-radius-window`）；独立按钮与下拉触发器 `3px`（`--pt-radius-control`）；`20px` 迷你按钮与键帽 `2px`（`--pt-radius-sm`）；连体分段组 `.pt-segmented` 内部 `0px` 并以 `margin-inline-start: -1px` 共用分隔黑边。
- **机械瞬切**：按钮、分段组、菜单与开关全部 `0ms` 瞬时响应（`transition: none`），禁止添加按压缩放（`scale`）或悬停缓动。

---

## 4. 跨项目实战防坑铁律（由 `bin/platinum-check.mjs` 自动拦截）

1. **斜面遮挡陷阱**：禁止在 `box-shadow` 中把 `inset 0 0 0 1px` 写在 `inset 1px 1px 0` 斜面之前（外层实心内环会完全盖死斜面），外框一律使用真实 `border: 1px solid var(--pt-frame)`。
2. **伪元素 `border-box` 陷阱**：任何声明几何尺寸（`width` / `height` / `inset`）的 `::before` / `::after` 必须显式写 `box-sizing: border-box`。
3. **`:is()` 特异性污染陷阱**：Selectors Level 4 中 `:is(A, B)` 取参数最高特异性；严禁在共用控件规则的 `:is()` / `:not()` 内裸写 `#id`（须包进 `:where(#id)`），防止 `(1,x,x)` 吞掉按钮状态反馈类。
4. **纯图标按钮原子居中与隐藏安全**：回退 `display: inline-grid` 必须包裹在 `:where(...):where(:not([hidden]))`（特异性 `(0,0,0)`）内，保证 `[hidden]` 与响应式 `display: none` 永远生效；按钮自身设 `padding: 0; place-items: center; line-height: 0` 并隐藏空 `<span>`，确保 SVG 偏心误差 `<= 0.6px`。
5. **`20×20px` 命中区 padding-box 算术**：`box-sizing: border-box; width: 20px; border: 1px solid` 的 padding-box 只有 `18×18px`，绝对定位伪元素热区必须写 `inset: -3px`（`18 + 6 = 24px`），写 `-2px` 仅得 `22px`。
6. **聚焦环与内凹/凸起阴影合成**：`.pt-btn:focus-visible` 用 `outline` 绘制焦点环，`.pt-field:focus-visible` 用 `box-shadow: 0 0 0 1px var(--pt-accent), var(--pt-bevel-sunken)` 合成，绝不能用单层 `box-shadow` 抹掉立体斜面。
7. **粘性横纹标题栏滚动留白**：含 `.pt-titlebar--sticky`（或粘性 `::before` 标题条）的独立滚动容器必须使用 `.pt-scroll-pane`（或声明 `scroll-padding-top >= 28px`），防止键盘 Tab 与 `scrollIntoView()` 将首项控件藏入标题栏背面。
8. **平铺负边距归零**：从现代无框平铺主题迁移到 Platinum 时，原为无框幽灵按钮设置的光学负外边距（如 `margin-inline: -6px`）必须归零，防止实体黑框撞穿容器边线。
