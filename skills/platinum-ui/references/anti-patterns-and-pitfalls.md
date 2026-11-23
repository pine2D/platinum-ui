# Platinum 高频反模式与根因对照表

汇总自多项目落地 Mac OS 9 Platinum 过程中真实踩过的返工点，改动业务样式前逐条对照。

| # | 反模式现象 | 错误写法示例 | 正确解法（本库已内置） |
|---|---|---|---|
| 1 | 按钮、标签或暗色背景泛蓝紫不和谐 | 把 `#ccccff` / `#282831` 用在普通悬停、芯片或暗色面板底色上 | 底盘严守 `R=G=B` 零偏色中性灰；默认用 `gray` 变体，即使用 `lavender` 也只允许 5 个点缀槽位带色 |
| 2 | 斜面被实心内环完全盖死退化为平框 | `box-shadow: inset 0 0 0 1px #000, inset 1px 1px 0 #fff` | 外框一律用真实 `border: 1px solid var(--pt-frame)`，`box-shadow` 只放内层凹凸斜面 |
| 3 | 伪元素滑块或命中区尺寸多出 2px 溢出 | `* { box-sizing: border-box }`（漏掉伪元素） | 所有设尺寸的 `::before` / `::after` 显式写 `box-sizing: border-box` |
| 4 | `20×20px` 小图标按钮点击热区只有 `22×22px` | `.pt-btn-sm.pt-btn-icon::before { inset: -2px; }` | `20px` border-box 扣掉 `1px` 边框后 padding-box 为 `18px`，必须写 `inset: -3px`（`18 + 6 = 24px`） |
| 5 | `:is()` 里混入 `#id` 吞掉保存成功/展开态 | `:is(.btn, .action:not(#del-btn))`（整条升至 `(1,x,x)`） | 排他 ID 必须包入 `:where(#del-btn)` 清零 ID 特异性，并排除状态反馈类 |
| 6 | 纯图标按钮规则把 `[hidden]` 或窄屏隐藏元素重新显示出来 | `:is(#root, body) button.icon { display: inline-grid }` | 将 `display: inline-grid` 单独放进 `:where(...):where(:not([hidden]))`（零特异性），`padding: 0` 与居中单列 |
| 7 | 鼠标移到已按下/已激活分段按钮上时深灰底色闪回浅灰 | `.btn:hover { background: var(--pt-face-hover); }` | `:hover` 必须排除 `:active`、`[aria-pressed="true"]`、`[aria-expanded="true"]`、`[aria-selected="true"]` 与 `.is-active` |
| 8 | 键盘聚焦时按钮或输入框立体斜面消失 | `:focus-visible { box-shadow: 0 0 0 2px var(--pt-accent); }` | 按钮用 `outline` 画焦点环；输入框用 `box-shadow: 0 0 0 1px var(--pt-accent), var(--pt-bevel-sunken)` 叠加保留内凹层 |
| 9 | 粘性横纹标题栏遮挡滚动定位或 Tab 聚焦的首个输入框 | 仅给窗口顶部加 `position: sticky; top: 0` 标题条 | 给滚动窗格加 `.pt-scroll-pane`（或设 `scroll-padding-top: calc(var(--pt-titlebar-h) + 6px)`） |
| 10 | 平铺主题遗留的负外边距导致立体按钮边框撞穿窗体边线 | 保留无框幽灵按钮的 `margin-inline: -6px` 光学悬挂 | 切换到有框立体控件时显式归零 `margin: 0`，并为链接型动作按钮补齐左右内距、去掉静息下划线 |
| 11 | 按钮、菜单或气泡内的 `<kbd>` 快捷键被套上 3D 键帽，宽度暴涨并撞穿按钮文字（连 `+` 号都变成方块） | 全局 `kbd { min-width: 20px; border: 1px solid; box-shadow: ... }` | 独立文档/帮助页才用立体键帽并排除 `:has(kbd)` 嵌套外框；按钮、`[role="menuitem"]` 与 `[role="tooltip"]` 内的 `<kbd>` 必须回退为无框等宽平字并 `color: inherit` |
| 12 | 无框现代表格切为有框 Platinum 表后，首尾列文字紧贴边框（`padding-left: 0`） | 仅给 `table` 和 `th, td` 补 `border` 与表头底色，漏覆写现代 Markdown 的首尾列零内距 | 凡开启有框表格或表头填充色，必须以覆盖 `:first-child` / `:last-child` 的特异性同步补齐对称内距（`padding: 6px 10px`）与完整四边边框；因 `dist/platinum.css` 位于 `@layer pt.prose`，覆盖**未分层**宿主 Markdown 样式时须把该条写在层外（unlayered） |
| 13 | 第三方宿主换肤仅覆写 `--radius-*` 变量，遗漏 `border-radius: 50%/9999px` 圆形动作钮（如回底 `↓`、发送 `↑`）且整页仍为扁平 SaaS 骨架 | 只给少量明显槽位按钮加斜面，放任主框架、圆形 FAB 与下划线 Tab 保持原样 | 除 `input[type="radio"]` 外全界面禁用正圆/胶囊钮；按宏观四层窗口骨架改造顶栏、页签、内容井与输入坞，并用真机页面探针扫清圆角与扁平残余 |
| 14 | 蚀刻分组框 `<fieldset>` 的 `1px` 白色高光内阴影横穿 `<legend>` 标题，且标题腰部卡在边框上 | 仅给 `<fieldset>` 写 `border` + `inset 1px 1px 0` 高光，漏设 `<legend>` 背景与基线偏移 | 浏览器只截断 `<fieldset>` 的 `border-top` 不截断 `box-shadow`；`<legend>` 须设跟随容器表面的实底（`--pt-groupbox-bg` / `--pt-surface-bg`）并配 `position: relative; top: -3px; padding: 0 5px 3px; line-height: 1.15` 使基线对齐凹槽顶线 |
| 15 | `<select>` 点开掉回操作系统亮蓝原生菜单、按下松手闪烁跳变，或并排 `<select>` 切换选项时宽度跳动 | 仅对 `<select>` 写 `appearance: none` 而不管展开态与多选列表框 | 单选下拉在 `@supports (appearance: base-select)` 下定制 `::picker(select)`、`option::checkmark`，并令 `:open` 与 `:active` 同步整颗下凹变深灰反白（并排场景给 `<select>` 设 `min-width` / `width` 定宽），多行 `multiple`/`size>=2` 独立走下凹列表井 |
| 16 | 禁用控件靠 `opacity: 0.5` 导致对比度跌破 AA，或禁用已勾选复选框出现“浅灰底配白勾（1.6:1）”看不见 | `.btn:disabled { opacity: 0.5 }` 且 `::after` 写死 `#ffffff` | 统一用 `opacity: 1` 实色无斜面（`box-shadow: none; border-color: var(--pt-border-subtle); color: var(--pt-ink-muted)`），勾号、半选横线与单选圆点一律取 `currentColor` |
| 17 | 正文容器链接色反杀内部 `a.pt-btn` / `a.pt-badge` 语义前景色，或显式 `display` 吞掉 `[hidden]` | `.prose a { color: var(--pt-accent) }`；`.checkbox { display: inline-grid }` | 链接规则排除 `:not(.pt-btn, .pt-menu-item, .pt-chip, .pt-badge, .pt-unstyled)`；所有非默认 `display` 声明包入 `:where(...):where(:not([hidden]))` |
