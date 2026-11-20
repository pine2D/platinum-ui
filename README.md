# Platinum UI

原汁原味的 **Mac OS 9 Platinum** 跨项目设计系统：包含 W3C DTCG 设计令牌、零框架 JS 的模块化纯 CSS 部件库、交互式静态预览画廊、可复用的静态/Chromium 几何与对比度体检门禁，以及配套的全局 AI Agent Skill。

## 特性概览

- **纯正 Platinum 机械质感**：`1px` 利落黑框、`2px` 硬边投影、四层金属凹凸斜面、`2px` 水平细横纹标题条、`15px` 三横脊滚动条、HIG 双箭头弹出选择框、蚀刻凹槽分组框与 `0ms` 机械瞬切。
- **零偏色双模底盘 + 双官方变体**：浅色铂金银（`#cccccc`/`#dddddd`）与深色零偏色碳黑金属（`R=G=B`），默认采用无紫耐看的 **`gray`** 变体（纯银灰 + 深石板蓝焦点），一行属性 `data-platinum-accent="lavender"` 即可切换经典 **`lavender`** 薰衣草变体；全象限通过 WCAG AA `>= 4.5:1` 校验。
- **紧凑/舒适双密度**：默认 `compact`（标准控件 `26px`、次级迷你斜面图标钮 `20px` + `::before` `24×24px` 隐形热区），可选 `data-platinum-density="comfortable"`（`32px` / `24px`）。
- **双通道零痛点接入**：打包器项目（Electron / Vite / React / TS）直接按包导出引入；零构建项目（原生 Chrome MV3 扩展 / 静态 HTML）通过 `platinum-sync` 一键同步单文件 CSS 并写入版本与 SHA-256 防漂移锁头。

## 快速开始

### 通道 A：带打包器项目（Vite / Webpack / Electron）

在 `package.json` 引用本仓库后按需引入对应入口：

```js
// 1. 全应用独占 Platinum（含裸 <button>/<input>/<select>/<fieldset> 自动样式 + .pt-* + .pt-prose）
import "platinum-ui/platinum.css";

// 2. 多主题并存或局部容器隔离（仅在 [data-platinum] 内生效，不污染全局 :root）
import "platinum-ui/scoped.css";

// 3. 仅使用显式 .pt-* 原语类（不动任何裸 HTML 标签）
import "platinum-ui/core.css";
```

### 通道 B：零构建项目（Chrome 扩展 / 纯静态 HTML）

```bash
# 同步单文件 CSS 到目标目录（自动附带版本与 SHA-256 锁头）
node bin/sync-vendor.mjs --target /path/to/your-app/vendor --bundle scoped

# 在目标项目的 CI / pre-commit 中校验未被手改且版本一致
node bin/sync-vendor.mjs --target /path/to/your-app/vendor --bundle scoped --check
```

## 本地预览与质量门禁

直接用浏览器打开 `gallery/index.html` 即可实时切换明暗模式、`Gray` / `Lavender` 变体、紧凑 / 舒适密度与窗口失焦状态。

```bash
npm run build                        # 从 tokens/platinum.tokens.json + src/*.css 编译 dist/*.css
npm run verify                       # 跑构建零漂移检查 + 全象限 AA 对比度 + CSS 静态防坑门 + 单元测试
node bin/platinum-check.mjs --browser               # 启动 Chromium 对画廊跑 8 象限真实图标居中与热区探针
node bin/platinum-check.mjs --css app.css --forbid-purple   # 对外部业务 CSS 跑 Platinum 静态防坑与禁紫体检
```

## 安装全局 AI Agent Skill

```bash
npx skills add ./skills/platinum-ui -g -y
```

安装后在任意新项目中对 Claude Code / Codex / Antigravity 说明「使用 `platinum-ui` 规范」，AI 将自动按目标项目技术栈接入对应 CSS 通道并执行几何与对比度验收。

## 目录结构

- `tokens/platinum.tokens.json` — W3C DTCG 令牌唯一真源
- `src/{core,elements,prose}.css` — 模块化源码层
- `dist/` — 零依赖编译产物（勿手改）
- `gallery/index.html` — 静态全组件对照画廊
- `bin/{build,sync-vendor,platinum-check}.mjs` — 构建、零构建同步与自动体检 CLI
- `skills/platinum-ui/SKILL.md` — 跨 Agent 通用技能定义
- `skills/platinum-ui/references/` — Electron 无边框窗口/顶层菜单、16px 像素应用图标与实战反模式参考手册
- `DESIGN.md` — 完整视觉与工程规范说明书
