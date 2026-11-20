# CLAUDE.md — platinum-ui

> 本仓库是跨项目 **Mac OS 9 Platinum** 设计系统唯一真源：包含 W3C DTCG 设计令牌（`tokens/platinum.tokens.json`）、零运行时依赖分层 CSS（`src/` → `dist/`）、静态对照画廊（`gallery/index.html`）、跨项目可复用自动体检门禁（`bin/platinum-check.mjs`）、零构建项目同步器（`bin/sync-vendor.mjs`）以及全局 Agent Skill（`skills/platinum-ui/SKILL.md`）。

## 核心铁律

1. **零运行时依赖、公开级脱敏**：运行时产物保持纯 CSS / JSON；工具链仅依赖 Node.js `>=22` 内置模块（Playwright 浏览器实测探针为可选增强）。全仓（含 `SKILL.md` 与 `references/`）**严禁硬编码任何个人主机路径、用户名或真实邮箱**；Skill 内引用自身目录一律使用 `$SKILL_DIR` 或相对路径。
2. **单一令牌真源，严禁手改 `dist/`**：修改颜色、阴影、字阶或尺寸阶梯只能在 `tokens/platinum.tokens.json` 与 `src/*.css` 进行，随后运行 `npm run build` 重新生成 `dist/*.css`，并由 `npm run verify`（含 `build.mjs --check` 逐字节漂移检查）把关。
3. **纯中性底盘 + 双官方变体隔离**：
   - 底盘（`chassis`）明暗灰阶必须保持 `R=G=B` 零偏色中性金属灰，按钮、标签芯片、普通悬停态严禁染紫；
   - 默认变体为 `gray`（Mac OS 9 Appearance 正统纯银灰 + 深石板蓝焦点），仅 `data-platinum-accent="lavender"` 切换 5 个受控点缀槽位（`accent`、`on-accent`、`selection-*`、`menu-active-*`、`scroll-*`）；
   - 所有前景/背景语义组合在 `(light, dark) × (gray, lavender)` 四个象限下均须满足 WCAG AA `>= 4.5:1`（零豁免）。
4. **CSS 特异性与几何硬门**：
   - 严禁在 `:is(...)` 中裸写 `#id` 抬高共用控件特异性（排他 ID 必须包入 `:where(...)`）；
   - 纯图标按钮回退 `display: inline-grid` 置于 `:where(...)` 零特异性层，保证宿主 `[hidden]` 与响应式 `display: none` 永远胜出；
   - `box-shadow` 严禁将 `inset 0 0 0 <N>px` 实心环写在凹凸斜面层之前；带边框的 `::before` / `::after` 必须显式 `box-sizing: border-box`；
   - `20×20px` 紧凑图标钮的 `::before` 命中区基于 `18×18px` padding-box 外扩，必须写 `inset: -3px` 以达标 `24×24px` 最小热区；
   - 粘性窗口横纹标题栏滚动容器必须声明匹配的 `scroll-padding-top`。
5. **Skill 同步生效**：修改 `skills/platinum-ui/` 后，除了通过 `npm run verify` 的文档/类名/命令一致性校验，在本机更新全局副本时执行 `npx skills add ./skills/platinum-ui -g -y`。
6. **Git 规范**：使用 `pine2D <569091+pine2D@users.noreply.github.com>`，遵循英文 Conventional Commits，**禁止添加任何 AI 署名或 `Co-Authored-By`**。

## 常用命令

```bash
npm run build        # 从 tokens/platinum.tokens.json + src/*.css 生成 dist/*.css
npm run verify       # 跑只读漂移检查 + AA 对比度/静态 CSS/Skill 校验 + 全部单元测试
node bin/platinum-check.mjs --browser   # 可选：启动 Chromium 对 gallery/index.html 跑 8 象限真实几何与居中探针
node bin/sync-vendor.mjs --target <dir> --bundle scoped   # 向零构建项目同步带版本与 SHA-256 锁头的单文件 CSS
```
