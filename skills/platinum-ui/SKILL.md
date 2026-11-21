---
name: platinum-ui
description: 跨项目 Mac OS 9 Platinum 立体桌面设计系统接入、界面改版与质量验收技能（基于 platinum-ui 规范仓库：零偏色铂金灰底盘、默认 Gray 纯银灰与可选 Lavender 变体、26/20px 紧凑阶梯、双通道分发与自动几何/对比度门禁）。当用户要求「使用 Platinum 风格/主题/规范」「做 Mac OS 9 / 复古铂金立体 UI」「接入 platinum-ui」「把界面改成铂金机械工作台」或在已有 Platinum 界面中排查泛紫、按钮偏心、斜面失效、对比度与特异性问题时使用。
---

# Platinum UI 跨项目接入与精修工作流

本技能将 **Mac OS 9 Platinum** 设计规范落地到任意技术栈（Vite / React / Electron 桌面端、零构建 Chrome 扩展、纯静态 HTML 或第三方站点注入），并内置防回归体检闭环。

## 1. 定位本地 `platinum-ui` 规范源

1. 先查找同级工作区或父级项目目录中的 `platinum-ui` 仓库（包含 `tokens/platinum.tokens.json`、`dist/platinum.css`、`bin/sync-vendor.mjs` 与 `bin/platinum-check.mjs`）；阅读其根目录 `DESIGN.md` 掌握完整令牌与原语契约。
2. 按任务场景按需阅读本技能自带参考手册：
   - 给既有现代 Web / SaaS 应用或第三方宿主插件做换肤改造（宏观窗口化骨架、圆形钮清理、宿主零哈希类名边界与真机验收）：**必读** `$SKILL_DIR/references/host-overlay-and-migration.md`
   - 遇到样式冲突、泛紫、按钮偏心、斜面丢失、键帽碰撞或表格贴边：读 `$SKILL_DIR/references/anti-patterns-and-pitfalls.md`
   - 目标是 Electron 桌面应用（无边框横纹窗口、跨 `WebContentsView` 顶层菜单、React Portal）：读 `$SKILL_DIR/references/electron-frameless-and-menus.md`
   - 需要设计配套复古像素应用图标（`16×16` 整数像素清晰度、`.ico`/`.icns`）：读 `$SKILL_DIR/references/pixel-app-icons.md`

## 2. 四步选型决策（开工前必定，不猜默认值）

接入任何目标项目前，按以下默认规范直接对齐（用户另有指定除外）：

1. **接入通道与宿主形态**：
   - **自有 DOM · 打包器项目（Vite / Webpack / Electron / Next）**：在 `package.json` 锁定 Tag（如 `github:pine2D/platinum-ui#v0.1.0`），按需 `import "platinum-ui/platinum.css"`（全站独占）或 `import "platinum-ui/scoped.css"`（多主题隔离）。
   - **自有 DOM · 零构建项目（原生 Chrome MV3 扩展 / 纯 HTML）**：运行 `node <platinum-ui>/bin/sync-vendor.mjs --target <目标目录> --bundle <full|scoped|core>` 同步带版本与 SHA-256 锁头的单文件 CSS，切勿手改同步产物。
   - **第三方宿主 / 存量现代 SaaS 换肤（无法改动宿主 HTML/JSX，如插件主题覆盖层）**：先读 `$SKILL_DIR/references/host-overlay-and-migration.md`，同步 `--bundle tokens`（或 `scoped`）并编写宿主适配 CSS；开工前明确与用户确认「全桌面留白窗口化」还是「贴边机械工作台」，并按四层宏观骨架完成顶栏、页签、内容井、输入坞与全部圆形动作钮改造，**严禁仅给少数按钮加斜面就交付**。
2. **挂载范围**：
   - 全新独立应用或单一 Platinum 主题应用 → 选 `full`（`dist/platinum.css`），裸写 `<button>`、`<input>`、`<select>`、`<fieldset>`、`<details>` 即自动成型，复杂容器配 `.pt-window`、`.pt-titlebar`、`.pt-well`。
   - 与其他平铺主题并存或嵌入宿主网页 → 选 `scoped`（`dist/platinum-scoped.css`）或 `core`（`dist/platinum-core.css`），在容器挂 `data-platinum` 属性开启，外部 `:root` 零污染。
3. **色板变体**：
   - **默认启用 `gray`（纯银灰 + 深石板蓝焦点，零紫色）**；仅当用户明确要求经典 Mac OS 9 薰衣草紫选区/滚动条时，在根节点挂 `data-platinum-accent="lavender"`。无论哪种变体，底盘明暗灰阶必须保持 `R=G=B`，**严禁按钮、芯片、代码块或普通悬停染紫**。
4. **尺寸密度与跨平台窗口控制**：
   - **默认启用 `compact`**（标准控件 `26px`、次级紧凑图标钮 `20px` 配 `--pt-bevel-mini` 与 `::before` `inset: -3px` `24×24px` 隐形热区、标题栏 `22px`）；表单密集的独立设置页可按需挂 `data-platinum-density="comfortable"`（`32px` / `24px`）。
   - **跨平台窗口控制（`data-platinum-controls`）**：默认 `mac9`（左侧空白斜面框关闭，右侧缩放/双横线折叠 `═`）；桌面端应用按运行系统在根节点挂 `data-platinum-controls="macos"`（左置三连 `×`/`−`/`□↔▣`）或 `data-platinum-controls="win"`（Win/Linux 右置三连 `−`/`□↔▣`/`×`）。空按钮由当前预设绘制，经典关闭框中央留空；真正最小化到任务栏的动作应使用最小化符号与对应的无障碍名称；若自写内嵌 `<svg>` 则自动让位。

## 3. 核心组件结构速查

- **标准窗口**：`<section class="pt-window">`（支持 `data-collapsed="true"` WindowShade 卷起与 `data-maximized="true"` 同步缩放状态（经典预设保留角线，现代平台预设切换还原符号））→ `<header class="pt-titlebar">`（直写 `.pt-tbox.pt-tbox-close`、`.pt-tbox.pt-tbox-minimize`、`.pt-tbox.pt-tbox-zoom` 与 `.pt-titlebar-label`；粘性顶栏加 `.pt-titlebar--sticky` 并配 `.pt-scroll-pane`；Electron 无边框主窗加 `.pt-titlebar--draggable`）→ `<div class="pt-toolbar">` → `<div class="pt-window-body">`（内部白底列表/正文包入 `<div class="pt-well pt-scroll">`）→ `<footer class="pt-statusbar">`。
- **按钮与分段组**：常规 `.pt-btn`；对话框唯一主动作 `.pt-btn.pt-btn-primary`（银灰面 + HIG 双层外黑环，不用彩色实心底充当默认主按钮）；连体分段 `.pt-segmented > .pt-btn[aria-pressed="true|false"]`；纯图标按钮一律 `.pt-btn.pt-btn-icon`（次级小号叠加 `.pt-btn-sm`），内部单 `<svg>` 自动零内距居中。
- **表单与分组**：输入框 `.pt-field`（保留内凹阴影与聚焦环合成）；下拉框 `.pt-select`（HIG 右侧 `20px` 双箭头凹槽）；复选/单选 `.pt-checkbox` / `.pt-radio`；直角方滑块开关 `<label class="pt-switch"><input type="checkbox" class="pt-switch-input"><span class="pt-switch-track"></span><span>文案</span></label>`；蚀刻凹槽分组 `<fieldset class="pt-groupbox"><legend>标题</legend>...</fieldset>`。
- **菜单与长文**：弹出菜单 `.pt-menu` + `.pt-menu-item` + `.pt-menu-sep`；技术长文/Markdown 容器加 `.pt-prose`（代码块用 `.pt-code-window` + `.pt-code-window-head`）。

## 4. 交付前必跑验收闭环

1. **静态防坑与禁紫体检**：对项目新增的自定义 Platinum 业务 CSS 运行：
   ```bash
   node <platinum-ui>/bin/platinum-check.mjs --css <业务样式.css> --forbid-purple
   ```
   （若用户选用了 `lavender` 变体，去掉 `--forbid-purple`，其余斜面遮挡、`::before` `border-box`、`:is()` ID 特异性泄漏与 `20×20` 命中区检查照常执行。）
2. **零构建产物防漂移校验**（若使用了 `sync-vendor.mjs`）：
   ```bash
   node <platinum-ui>/bin/sync-vendor.mjs --target <目标目录> --bundle <full|scoped|core> --check
   ```
3. **真实浏览器几何、残余现代 UI 与目视双模自查**：在 Chromium / Playwright 下同时验证 `light` 与 `dark` 两态（复用 `<platinum-ui>/bin/platinum-check.mjs` 导出的 `ICON_BUTTON_PROBE_SOURCE` 与 `findIconButtonIssues`），确保：
   - 所有常规可见按钮有效热区 `>= 24×24px`（`.pt-tbox` 窗控 `>= 18×22px` 且相邻零重叠）、纯图标按钮居中偏差 `<= 0.6px`、零横向滚动溢出；
   - **零残余现代 UI 泄漏**：除 `radio` 外无 `border-radius >= 8px` 圆形/胶囊按钮、有框表格首尾列 `padding-inline >= 6px` 不贴边、按钮/菜单内无 3D `<kbd>` 键帽膨胀或子元素撞字；
   - **真机目视门（宿主换肤必做）**：不可只用合成 mock DOM 过测即宣告完工，须对真实运行页（默认态 + 按钮/菜单悬停态 + 含表格长文页）截屏核对宏观窗口化层级与观感。
