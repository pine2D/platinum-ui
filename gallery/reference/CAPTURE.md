# Mac OS 9.0 窗口样张

本组原图采自运行中的 Mac OS 9.0。打开[窗口对照](index.html?lang=zh-CN)，可以在同一位置查看客体原图、浏览器中的 HTML/CSS 实现、两者叠加和完整像素差分。

## 采集环境

| 项目 | 本次取值 |
|---|---|
| 系统 | Mac OS 9.0，US English，启动盘 `Mac OS 9.0 HD` |
| 机器 | Infinite Mac 的 Power Macintosh G3 (Blue & White) 配置，SheepShaver / New World ROM |
| 显示 | 客体帧缓冲 640 × 480，Monitors 显示 Millions of Colors |
| 外观 | Apple platinum；高亮色 Purple，Variation 为 Lavender。实测选中文字色样底色为 `#ccccff`，Variation 示意色块为 `#6666cc`，启用滑块的底色为 `#9999ff` |
| 字体 | 大系统字体 Charcoal，小系统字体 Geneva，列表字体 Geneva 10；12 点及以上启用字体平滑 |
| 浏览器 | Chromium 147.0.7727.15，DPR 1。直接导出客体 canvas，而非截取经过缩放的模拟器外壳 |
| 采集日期 | 2026-11-21 |

[运行同一客体](https://infinitemac.org/1999/Mac%20OS%209.0) · [模拟器的系统与机型定义](https://github.com/mihaip/infinite-mac/blob/main/src/defs/disks.ts) · [本次字体设置](capture/fonts.png) · [本次显示设置](capture/depth.png) · [Appearance 设置原帧](capture/appearance-active.png) · [Date & Time 原帧](capture/date-time-active.png) · [General Controls 对照原帧](capture/general-controls.png)

## 复现步骤

1. 在新的模拟器会话启动系统，等待 Finder 完成启动。在桌面用 File → New Folder 新建名为 `platinum` 的空文件夹并打开。参考原帧将窗口置于左上角 (7, 25)。未折叠样张连同投影为 417 × 247。可用磁盘空间取决于客体内容。
2. 前台样张将指针停在窗口外。点裸露桌面取失焦态，再点标题栏激活。移至关闭框内 (21, 38)，保持鼠标按下取 pressed，移出按钮再松开即可取消关闭。点右端 WindowShade (412, 35)，停在窗口外取 collapsed，再点原处取 restored。
3. 在空文件夹内新建名为 `sample` 的子文件夹，将图标从约 (46, 87) 拖至 (352, 219)，点击空白区域取消选中。用右下角手柄从 (410, 258) 拖至 (288, 171)，使子项位于视口外。两根滑块均启用，窗口连同投影为 295 × 160。点击缩放框还可观察 Finder 按内容调整窗口大小，缩放框保留原来的角线图形。[启用双轴滚动的原帧](capture/finder-scrollbars.png) · [同次会话的缩放结果](capture/zoom.png)
4. 从苹果菜单选择 Control Panels → Appearance，选中 Appearance 页签。将窗口定位在 (161, 68)。完整样张含投影为 477 × 339。按同一方式采集 active、pressed（174, 81）、collapsed 和 restored（折叠框 626, 78）。采集 inactive 前先收起或关掉会遮挡面板的 Finder 窗口，再点桌面。按住 Appearance 弹出选择器箭头 (455, 153)，菜单展开时取 menu。
5. 从苹果菜单选择 Control Panels → Date & Time，将窗口移至左上角 (12, 28)。完整样张含投影为 377 × 370（折叠态为 377 × 23），一次覆盖四个蚀刻分组框（`Current Date`、`Current Time`、`Time Zone` 及带标题复选框的 `Use a Network Time Server`）、凹陷输入框、微调箭头、四枚启用四层斜面按钮、实色无斜面禁用按钮（`Server Options...`）、选中/未选中/禁用复选框与单选框，依次采集 active、inactive 与 collapsed；另存档同环境的 Control Panels → General Controls 原帧备查。
6. 各状态从客体 canvas 导出无损 PNG。完整 640 × 480 原帧保存在 `capture/`，未缩放的窗口裁片保存在 `original/`。`samples.json` 记录每次裁剪的左、上、宽、高及检验区域。按下态保留客体指针，曝光的关闭面与被指针遮挡的像素分别标注。active 和 restored 独立采集，窗口复原后两者对应裁片相同。

## 阅读差分

历史参照窗口使用原图测得的边距和色板，标题栏和窗控使用库里的共享 CSS。Finder 以 DOM 绘制内容井及尾部成对滚动箭头，两轴共用库提供的刻纹。Appearance 的标签、选择器和文字均为可检查的 HTML。物理窗口的黑边、六道横纹、关闭框的阶梯灰面以及整枚启用滑块都直接和客体像素比较。

黑色差分像素表示一致，其余像素将各颜色通道的绝对差放大四倍。完整差分保留字体、代理图标、指针和抗锯齿的差异。菜单原图中，指针遮住了以窗口左上角为原点的 (293, 84) 至 (304, 100) 区域，右、下边界不计入。可见的箭头和边线仍逐像素检查。

文字抽检外观窗口标题和 Finder 信息行。深色墨迹高度和中心位置允许 3px 偏差，整行宽度允许 12% 偏差，以容纳替代字体的字宽。标签、说明与选项值另外检查文字边界和裁剪。将关闭框向右移动 1px、将标题下移 6px 的反例分别验证几何和文字检查。更新浏览器截图会重新生成 `rendered/`、`difference/`、清单镜像和比较报告。离线对照测试还会验证每张历史裁片逐像素来自对应原帧。

Mac OS 图像显示的是 Apple 的系统界面，采集自 Infinite Mac。方法参考 [V2EX 作者的原系统核对说明](https://v2ex.com/t/1246152)；自创控件的尺寸和间距可查阅 [Apple 的 Mac OS 8 Human Interface Guidelines](https://dev.os9.ca/techpubs/mac/pdf/HIGOS8Guidelines.pdf)。
