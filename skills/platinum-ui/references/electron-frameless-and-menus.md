# Electron 无边框主窗与顶层弹出菜单蓝图

提炼自跨平台桌面端 Mac OS 9 Platinum 实战，解决原生操作系统外壳、多 `WebContentsView` 层叠与 React Portal 作用域问题。

## 1. 无边框自绘横纹主窗（`frame: false`）

- **几何单一真源**：将主窗标题栏高度固定为常量 `WINDOW_TITLEBAR_HEIGHT = 22`（`px`），同步提供给主进程 `WebContentsView` 坐标计算与渲染层 `.pt-titlebar`，禁止双侧各写字面量。
- **跨平台窗口按钮（`.pt-tbox` `13×13px`）位置**：
  - macOS：关闭/最小化/缩放方块居左，文字标题居中；
  - Windows / Linux：控制方块居右，文字标题居中；
  - 拖拽区与交互区分离：`.pt-titlebar` 设 `-webkit-app-region: drag`，所有 `.pt-tbox` 及按钮显式设 `-webkit-app-region: no-drag`，避免点击被系统标题栏拖拽吞掉。
- **窗口焦点联动**：主进程监听 `BrowserWindow` 的 `focus` / `blur` 事件同步 `data-window-focused="true|false"`；失焦时 `.pt-titlebar` 自动隐去 `2px` 水平细横纹、标题降为 `--pt-ink-muted`（复刻经典 Mac OS 非活动窗口视觉反馈）。

## 2. 跨原生视图的顶层 Platinum 弹出菜单

在 Windows / Linux 上，`Menu.popup()` 弹出的是操作系统原生菜单，无法跟随 Platinum 斜面边框；而普通 DOM 浮层又会被内嵌的 `BrowserView` / `WebContentsView` 遮挡。标准解法：

1. **透明顶层菜单视图**：在 `window.contentView` 最顶层挂载一个按需显示的透明 `WebContentsView`（`focusable: false` 或受控焦点，使弹出菜单时不抢走主窗系统焦点导致标题栏横纹变灰）。
2. **共享菜单样式语义**：菜单面板直接使用 `.pt-menu`、`.pt-menu-item`、`.pt-menu-sep` 与 `--pt-menu-active-bg` / `--pt-menu-active-fg`（`gray` 变体为 `#333333` 深炭反白，避免紫色溢出；`lavender` 变体为 `#333399` 经典靛蓝反白），右侧快捷键使用 `--pt-font-mono` 等宽字体。

## 3. React Portal 与零裂帧布局同步

- **Portal 覆盖**：挂载到 `document.body` 的模态框、抽屉与命令面板（`createPortal(..., document.body)`）会脱离 `#root` 子树；全局接管层须使用 `:is(:root, body)`（或根节点 `[data-platinum]`），切勿把基础部件局限在 `#root` 内。
- **零裂帧高度同步**：涉及影响原生子视图（`WebContentsView`）边界的展开/收起栏时，退出过渡设为 `0ms`（机械瞬切），在渲染前通过 `useLayoutEffect` + `flushSync` 上报几何边界，避免 DOM 与原生子视图出现 1–2 帧错位缝隙。
