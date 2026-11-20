#!/usr/bin/env node
// Generates deterministic 2x Retina real-CSS screenshots for README.md
// directly from dist/platinum.css using headless Chromium (zero moire resampling,
// lossless WebP encoding for razor-sharp 1px bevels and 2px pinstripes).
//
// Usage:
//   node scripts/readme-shots.mjs

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "docs/screenshots");
const PLATINUM_CSS = readFileSync(join(ROOT, "dist/platinum.css"), "utf8");

function resolvePlaywright() {
  const candidates = [
    join(ROOT, "node_modules/playwright"),
    process.env.PLAYWRIGHT_MODULE_PATH
  ].filter(Boolean);

  try {
    const parentDir = resolve(ROOT, "..");
    for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const sib = join(parentDir, entry.name);
      candidates.push(
        join(sib, "package.json"),
        join(sib, ".qa-scan/package.json"),
        join(sib, "desktop/package.json")
      );
    }
  } catch (_) {}

  for (const cand of candidates) {
    try {
      if (cand.endsWith("package.json") && existsSync(cand)) {
        return createRequire(cand)("playwright");
      }
      if (existsSync(cand)) {
        return createRequire(join(ROOT, "package.json"))(cand);
      }
    } catch (_) {}
  }
  throw new Error("Playwright not found. Install playwright or set PLAYWRIGHT_MODULE_PATH.");
}

const CLOSE_BOX_SVG = `<svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2l6 6M8 2L2 8"/></svg>`;
const SHADE_BOX_SVG = `<svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 4h7M1.5 6.5h7"/></svg>`;
const ZOOM_BOX_SVG = `<svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="1.5" width="7" height="7"/><path d="M1.5 5.5h4v-4"/></svg>`;

const SHARED_STAGE_CSS = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: var(--stage-w);
    height: var(--stage-h);
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .stage {
    position: relative;
    width: var(--stage-w);
    height: var(--stage-h);
    overflow: hidden;
  }
  .stage-light-stipple {
    background-color: #b8b8b8;
    background-image: radial-gradient(#9e9e9e 1px, transparent 1px);
    background-size: 4px 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    font-size: 12px;
  }
  .list-item[aria-selected="true"] {
    background: var(--pt-selection-bg);
    color: var(--pt-selection-fg);
    border-inline-start: 3px solid var(--pt-frame);
    padding-inline-start: 5px;
    font-weight: 700;
  }
  .sel-mark {
    background: var(--pt-selection-bg);
    color: var(--pt-selection-fg);
    padding: 1px 3px;
  }
  .focus-demo {
    outline: none;
    border-color: var(--pt-accent) !important;
    box-shadow: 0 0 0 1px var(--pt-accent), var(--pt-bevel-sunken) !important;
  }
`;

function heroHtml() {
  return `
  <div class="stage" style="background: linear-gradient(136deg, #171717 0%, #171717 48.5%, #262626 48.5%, #262626 48.8%, #b8b8b8 48.8%, #b8b8b8 100%);">
    <!-- Subtle retro stipple overlay on both desktop halves -->
    <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px);background-size:4px 4px;clip-path:polygon(0 0, 100% 0, 0 97%);pointer-events:none;"></div>
    <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(0,0,0,0.10) 1px, transparent 1px);background-size:4px 4px;clip-path:polygon(100% 0, 100% 100%, 0 100%);pointer-events:none;"></div>

    <!-- Back Window: Dark · Gray Zero-Cast Metallic -->
    <section class="pt-window" data-platinum data-platinum-scheme="dark" data-platinum-accent="gray" data-platinum-density="compact"
      style="position:absolute; left:36px; top:32px; width:720px; z-index:1; box-shadow: var(--pt-bevel-window), 4px 4px 0 #050505;">
      <header class="pt-titlebar">
        <button type="button" class="pt-tbox" aria-label="Close">${CLOSE_BOX_SVG}</button>
        <span class="pt-titlebar-label">Appearance — Dark Metallic (R = G = B)</span>
        <button type="button" class="pt-tbox" aria-label="Collapse">${SHADE_BOX_SVG}</button>
      </header>
      <div class="pt-toolbar" style="justify-content: space-between;">
        <div class="row">
          <div class="pt-segmented">
            <button type="button" class="pt-btn pt-btn-sm" aria-pressed="false">Light</button>
            <button type="button" class="pt-btn pt-btn-sm" aria-pressed="true">Dark 深碳金属</button>
          </div>
          <span class="pt-chip">#2c2c2c window</span>
          <span class="pt-chip">#3b3b3b face</span>
          <span class="pt-badge pt-badge-success">Zero Blue Cast</span>
        </div>
        <div class="pt-icon-cluster">
          <button type="button" class="pt-btn pt-btn-sm pt-btn-icon" aria-pressed="true" aria-label="Terminal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg>
          </button>
          <button type="button" class="pt-btn pt-btn-sm pt-btn-icon" aria-label="Check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
          </button>
        </div>
      </div>
      <div class="pt-window-body" style="display:grid; grid-template-columns: 310px 1fr; gap:12px;">
        <div class="stack">
          <fieldset class="pt-groupbox">
            <legend>Dark Chassis Controls</legend>
            <div class="stack">
              <div class="pt-actions">
                <button type="button" class="pt-btn pt-btn-primary">Build Tokens</button>
                <button type="button" class="pt-btn">Inspect</button>
                <button type="button" class="pt-btn pt-btn-danger">Reset</button>
              </div>
              <input type="text" class="pt-field focus-demo" value="零偏色深碳灰 · AA >= 4.5:1" readonly />
              <label class="pt-switch">
                <input type="checkbox" class="pt-switch-input" checked readonly />
                <span class="pt-switch-track"></span>
                <span>锁定纯中性灰阶底盘</span>
              </label>
            </div>
          </fieldset>
        </div>
        <div class="pt-well" style="font-family:var(--pt-font-mono); font-size:11.5px; line-height:1.55;">
          <div style="color:var(--pt-ink-muted);">/* tokens/platinum.tokens.json */</div>
          <div>--pt-window: <span style="color:var(--pt-accent);">#2c2c2c</span>;</div>
          <div>--pt-face:   <span style="color:var(--pt-accent);">#3b3b3b</span>;</div>
          <div>--pt-paper:  <span style="color:var(--pt-accent);">#1c1c1c</span>;</div>
          <div>--pt-ink:    <span style="color:var(--pt-success);">#eeeeee</span>;</div>
        </div>
      </div>
    </section>

    <!-- Front Hero Window: Light · Gray Mac OS 9 Platinum Workbench -->
    <section class="pt-window" data-platinum data-platinum-scheme="light" data-platinum-accent="gray" data-platinum-density="compact"
      style="position:absolute; left:284px; top:166px; width:800px; z-index:5; box-shadow: var(--pt-bevel-window), 3px 3px 0 #262626, -1px -1px 0 #262626;">
      <header class="pt-titlebar">
        <button type="button" class="pt-tbox" aria-label="Close">${CLOSE_BOX_SVG}</button>
        <span class="pt-titlebar-label">Platinum Workbench — Finder</span>
        <div class="row" style="gap:4px;">
          <button type="button" class="pt-tbox" aria-label="Zoom">${ZOOM_BOX_SVG}</button>
          <button type="button" class="pt-tbox" aria-label="Collapse">${SHADE_BOX_SVG}</button>
        </div>
      </header>
      <div class="pt-toolbar" style="justify-content: space-between;">
        <div class="row">
          <div class="pt-segmented" role="group">
            <button type="button" class="pt-btn" aria-pressed="true">Controls</button>
            <button type="button" class="pt-btn" aria-pressed="false">Tokens</button>
            <button type="button" class="pt-btn" aria-pressed="false">Audit</button>
          </div>
          <div class="pt-icon-cluster">
            <button type="button" class="pt-btn pt-btn-icon" aria-label="Search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            </button>
            <button type="button" class="pt-btn pt-btn-icon" aria-pressed="true" aria-label="Pin">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4H7v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z"/></svg>
            </button>
            <button type="button" class="pt-btn pt-btn-icon" aria-label="Sync">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/></svg>
            </button>
          </div>
        </div>
        <div class="row" style="gap:6px;">
          <span class="pt-badge pt-badge-success">136 AA Pairs Pass</span>
          <kbd class="pt-kbd">⌘</kbd><kbd class="pt-kbd">K</kbd>
        </div>
      </div>

      <div class="pt-window-body" style="display:grid; grid-template-columns: 432px 1fr; gap:14px; align-items:start;">
        <!-- Left Column: Buttons, Fields, Select, Choices -->
        <div class="stack">
          <fieldset class="pt-groupbox">
            <legend>Buttons &amp; Compact Mini-Bevel Cluster</legend>
            <div class="stack">
              <div class="pt-actions">
                <button type="button" class="pt-btn pt-btn-primary">Save Default</button>
                <button type="button" class="pt-btn">常规按钮</button>
                <button type="button" class="pt-btn" aria-pressed="true">Pressed</button>
                <button type="button" class="pt-btn pt-btn-danger">删除</button>
              </div>
              <div class="row" style="justify-content:space-between;">
                <span style="font-size:11px; color:var(--pt-ink-muted);">20×20px 迷你斜面簇（24×24 热区）：</span>
                <div class="pt-icon-cluster">
                  <button type="button" class="pt-btn pt-btn-sm pt-btn-icon" aria-label="Copy">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="1"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>
                  </button>
                  <button type="button" class="pt-btn pt-btn-sm pt-btn-icon" aria-label="History">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                  </button>
                  <button type="button" class="pt-btn pt-btn-sm pt-btn-icon" aria-label="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset class="pt-groupbox">
            <legend>Sunken Field, Pop-Up Select &amp; Choices</legend>
            <div class="stack">
              <div class="row" style="flex-wrap:nowrap;">
                <input type="text" class="pt-field" style="flex:1;" value="下凹白底输入井 · CJK 与西文混排" readonly />
                <select class="pt-select" style="width:148px;">
                  <option>Gray · 纯银灰</option>
                </select>
              </div>
              <div class="row" style="justify-content:space-between;">
                <div class="row" style="gap:12px;">
                  <label class="row" style="gap:5px;"><input type="checkbox" class="pt-checkbox" checked readonly /><span>离线快照</span></label>
                  <label class="row" style="gap:5px;"><input type="radio" class="pt-radio" checked readonly /><span>Scoped</span></label>
                </div>
                <label class="pt-switch">
                  <input type="checkbox" class="pt-switch-input" checked readonly />
                  <span class="pt-switch-track"></span>
                  <span>0ms 瞬切</span>
                </label>
              </div>
            </div>
          </fieldset>

          <div class="row" style="gap:6px;">
            <span class="pt-chip">zero-dependency</span>
            <span class="pt-chip">w3c-dtcg</span>
            <span class="pt-badge pt-badge-warning">SHA-256 Locked</span>
          </div>
        </div>

        <!-- Right Column: Popup Menu + 15px 3-Ridge Scrollbar Well -->
        <div class="stack">
          <nav class="pt-menu">
            <button type="button" class="pt-menu-item"><span>New Workspace</span><span class="pt-menu-shortcut">⌘N</span></button>
            <button type="button" class="pt-menu-item" aria-selected="true"><span>Export Markdown…</span><span class="pt-menu-shortcut">⌘E</span></button>
            <button type="button" class="pt-menu-item"><span>Sync Vendor CSS</span><span class="pt-menu-shortcut">⇧⌘S</span></button>
            <hr class="pt-menu-sep" />
            <button type="button" class="pt-menu-item"><span>Run Geometry Audit</span><span class="pt-menu-shortcut">⌘T</span></button>
          </nav>

          <div class="pt-well pt-scroll" style="height: 158px; overflow-y: scroll; padding: 4px;">
            <div class="list-item" aria-selected="true"><span>01 · platinum.css</span><span class="pt-badge">Full</span></div>
            <div class="list-item"><span>02 · platinum-scoped.css</span><span style="color:var(--pt-ink-muted);font-size:11px;">[data-platinum]</span></div>
            <div class="list-item"><span>03 · platinum-core.css</span><span style="color:var(--pt-ink-muted);font-size:11px;">.pt-* only</span></div>
            <div class="list-item"><span>04 · platinum-tokens.css</span><span style="color:var(--pt-ink-muted);font-size:11px;">--pt-* vars</span></div>
            <div class="list-item"><span>05 · bin/sync-vendor.mjs</span><span style="color:var(--pt-ink-muted);font-size:11px;">zero-build</span></div>
            <div class="list-item"><span>06 · bin/platinum-check.mjs</span><span style="color:var(--pt-ink-muted);font-size:11px;">CI gate</span></div>
            <div class="list-item"><span>07 · skills/platinum-ui</span><span style="color:var(--pt-ink-muted);font-size:11px;">SKILL.md</span></div>
          </div>
        </div>
      </div>

      <footer class="pt-statusbar">
        <span>Mac OS 9 Platinum HIG · 1px Crisp Frame · 4-Layer Bevel</span>
        <span style="margin-inline-start:auto;">Compact 26px / 20px</span>
      </footer>
    </section>
  </div>`;
}

function variantCard({ accent, title, badgeText, desc, selSample, scrollNote }) {
  return `
    <section class="pt-window" data-platinum data-platinum-scheme="light" data-platinum-accent="${accent}" data-platinum-density="compact" style="flex:1; min-width:0;">
      <header class="pt-titlebar">
        <button type="button" class="pt-tbox" aria-label="Close">${CLOSE_BOX_SVG}</button>
        <span class="pt-titlebar-label">${title}</span>
        <button type="button" class="pt-tbox" aria-label="Collapse">${SHADE_BOX_SVG}</button>
      </header>
      <div class="pt-toolbar" style="justify-content:space-between;">
        <span style="font-size:11.5px; font-weight:700;">${desc}</span>
        <span class="pt-badge">${badgeText}</span>
      </div>
      <div class="pt-window-body stack">
        <div style="display:grid; grid-template-columns: 186px 1fr; gap:10px; align-items:start;">
          <nav class="pt-menu">
            <button type="button" class="pt-menu-item"><span>Open Gallery</span><span class="pt-menu-shortcut">⌘O</span></button>
            <button type="button" class="pt-menu-item" aria-selected="true"><span>Active Highlight</span><span class="pt-menu-shortcut">⌘H</span></button>
            <hr class="pt-menu-sep" />
            <button type="button" class="pt-menu-item"><span>Preferences…</span><span class="pt-menu-shortcut">⌘,</span></button>
          </nav>

          <div class="pt-well pt-scroll" style="height: 126px; overflow-y: scroll; padding: 8px 10px; font-size:12.5px; line-height:1.55;">
            <div style="margin-bottom:6px;">
              文本选区：<span class="sel-mark">${selSample}</span>，支持高对比 <a href="#v" class="pt-link">语义强调链接</a>。
            </div>
            <div style="color:var(--pt-ink-muted); font-size:11.5px; margin-bottom:5px;">${scrollNote}</div>
            <div style="color:var(--pt-ink-muted); font-size:11.5px; margin-bottom:4px;">03 · R=G=B neutral metallic chassis</div>
            <div style="color:var(--pt-ink-muted); font-size:11.5px; margin-bottom:8px;">04 · Buttons &amp; chips never turn purple</div>
            <div style="color:var(--pt-ink-muted); font-size:11.5px; margin-bottom:4px;">05 · 15px 3-ridge scrollbar thumb</div>
            <div style="color:var(--pt-ink-muted); font-size:11.5px; margin-bottom:4px;">06 · Sunken content well (--pt-paper)</div>
            <div style="color:var(--pt-ink-muted); font-size:11.5px;">07 · WCAG AA verified across 4 quadrants</div>
          </div>
        </div>

        <fieldset class="pt-groupbox">
          <legend>Focus Ring vs Neutral Buttons (Zero Purple Bleed)</legend>
          <div class="stack" style="gap:8px;">
            <input type="text" class="pt-field focus-demo" value="聚焦边框跟随 --pt-accent，按钮与芯片始终保持纯粹中性铂金灰" readonly />
            <div class="row" style="justify-content:space-between;">
              <div class="pt-actions">
                <button type="button" class="pt-btn pt-btn-primary">Confirm</button>
                <button type="button" class="pt-btn">常规按钮</button>
              </div>
              <div class="row" style="gap:5px;">
                <span class="pt-chip">neutral-chip</span>
                <span class="pt-chip">no-tint</span>
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </section>`;
}

function variantsHtml() {
  return `
  <div class="stage stage-light-stipple" style="padding: 24px; display:flex; gap:20px; align-items:stretch;">
    ${variantCard({
      accent: "gray",
      title: "Appearance — Gray (Default)",
      badgeText: "默认 · 零紫色",
      desc: "纯银灰滚动条 + 深炭反白菜单 + 深石板蓝焦点",
      selSample: "#b8b8b8 中性银灰高亮",
      scrollNote: "右侧滑块：纯正银灰三横脊（#cccccc）"
    })}
    ${variantCard({
      accent: "lavender",
      title: "Appearance — Lavender (Opt-in)",
      badgeText: 'data-platinum-accent="lavender"',
      desc: "经典薰衣草选区/滚动条 + 深靛蓝菜单/焦点",
      selSample: "#ccccff 经典薰衣草高亮",
      scrollNote: "右侧滑块：Mac OS 9 薰衣草三横脊（#9999ff）"
    })}
  </div>`;
}

function densityWindow({ density, title, meta }) {
  return `
    <section class="pt-window" data-platinum data-platinum-scheme="light" data-platinum-accent="gray" data-platinum-density="${density}">
      <header class="pt-titlebar">
        <button type="button" class="pt-tbox" aria-label="Close">${CLOSE_BOX_SVG}</button>
        <span class="pt-titlebar-label">${title}</span>
        <span style="width:13px;"></span>
      </header>
      <div class="pt-window-body stack" style="gap:10px;">
        <div class="row" style="justify-content:space-between;">
          <div class="pt-actions">
            <button type="button" class="pt-btn pt-btn-primary">Apply</button>
            <div class="pt-segmented">
              <button type="button" class="pt-btn" aria-pressed="true">Edit</button>
              <button type="button" class="pt-btn" aria-pressed="false">Preview</button>
            </div>
          </div>
          <div class="row" style="gap:6px;">
            <button type="button" class="pt-btn pt-btn-icon" aria-label="Search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            </button>
            <div class="pt-icon-cluster">
              <button type="button" class="pt-btn pt-btn-sm pt-btn-icon" aria-label="Copy">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="1"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>
              </button>
              <button type="button" class="pt-btn pt-btn-sm pt-btn-icon" aria-label="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div class="row" style="flex-wrap:nowrap;">
          <input type="text" class="pt-field" style="flex:1;" value="${meta}" readonly />
          <select class="pt-select" style="width:88px;"><option>UTF-8</option></select>
        </div>
      </div>
    </section>`;
}

function proseAndDensityHtml() {
  return `
  <div class="stage stage-light-stipple" style="padding: 24px; display:grid; grid-template-columns: 644px 1fr; gap:20px; align-items:start;">
    <!-- Left: SimpleText Prose, Code Window & Hard-Bordered Table -->
    <section class="pt-window" data-platinum data-platinum-scheme="light" data-platinum-accent="gray" data-platinum-density="compact">
      <header class="pt-titlebar">
        <button type="button" class="pt-tbox" aria-label="Close">${CLOSE_BOX_SVG}</button>
        <span class="pt-titlebar-label">SimpleText — Technical Prose &amp; Code (.pt-prose)</span>
        <button type="button" class="pt-tbox" aria-label="Zoom">${ZOOM_BOX_SVG}</button>
      </header>
      <div class="pt-window-body">
        <article class="pt-well pt-prose" style="padding: 12px 14px;">
          <h2 style="margin-top:0;">跨项目双通道接入规范</h2>
          <p>阅读视图采用 <code>13.5px / 1.56</code> 高密度排版，在下凹白底井（<code>.pt-well</code>）内嵌代码窗与实框表：</p>
          <div class="pt-code-window">
            <div class="pt-code-window-head">
              <span>shell — sync single-file CSS with SHA-256 lock</span>
              <button type="button" class="pt-btn pt-btn-sm pt-btn-icon" aria-label="Copy code">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="1"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>
              </button>
            </div>
            <pre><code>npx platinum-sync --target ./vendor --bundle scoped
npx platinum-check --css ./src/app.css --forbid-purple</code></pre>
          </div>
          <table style="margin-bottom:0;">
            <thead>
              <tr><th>Bundle</th><th>Scope</th><th>Typical Host</th></tr>
            </thead>
            <tbody>
              <tr><td><code>platinum.css</code></td><td>Global + bare tags</td><td>Electron / Standalone Web</td></tr>
              <tr><td><code>platinum-scoped.css</code></td><td><code>[data-platinum]</code></td><td>MV3 Extensions / Multi-theme</td></tr>
              <tr><td><code>platinum-core.css</code></td><td><code>.pt-*</code> classes only</td><td>Incremental Migration</td></tr>
            </tbody>
          </table>
        </article>
      </div>
    </section>

    <!-- Right: Compact vs Comfortable Density Stack -->
    <div class="stack" style="gap:16px;">
      ${densityWindow({
        density: "compact",
        title: "Density — Compact (Default · 26 / 20px)",
        meta: "26px 主钮 · 20px 迷你钮（24px 热区）"
      })}
      ${densityWindow({
        density: "comfortable",
        title: "Density — Comfortable (Opt-in · 32 / 24px)",
        meta: "32px 主钮 · 24px 小号钮（表单舒展态）"
      })}
      <section class="pt-window" data-platinum data-platinum-scheme="light" data-platinum-accent="gray" data-platinum-density="compact" data-inactive="true">
        <header class="pt-titlebar">
          <button type="button" class="pt-tbox" aria-label="Close">${CLOSE_BOX_SVG}</button>
          <span class="pt-titlebar-label">Background Window — Inactive State</span>
          <span style="width:13px;"></span>
        </header>
        <div class="pt-window-body" style="padding:8px 12px; font-size:12px; color:var(--pt-ink-muted);">
          窗口失焦（<code>data-inactive="true"</code>）自动收起标题栏细横纹并弱化标题文字。
        </div>
      </section>
    </div>
  </div>`;
}

const SHOTS = [
  { name: "hero", w: 1120, h: 660, render: heroHtml },
  { name: "variants", w: 1120, h: 428, render: variantsHtml },
  { name: "prose-and-density", w: 1120, h: 454, render: proseAndDensityHtml }
];

async function pngToLosslessWebp(browser, pngBuffer) {
  const page = await browser.newPage();
  try {
    const dataUrl = "data:image/png;base64," + pngBuffer.toString("base64");
    const webpB64 = await page.evaluate(async (src) => {
      const bmp = await createImageBitmap(await (await fetch(src)).blob());
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bmp, 0, 0);
      // quality: 1.0 triggers Blink's lossless WebP encoder so 1px pinstripes stay razor-sharp
      const blob = await canvas.convertToBlob({ type: "image/webp", quality: 1.0 });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(bin);
    }, dataUrl);
    return Buffer.from(webpB64, "base64");
  } finally {
    await page.close();
  }
}

async function main() {
  const pw = resolvePlaywright();
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await pw.chromium.launch({
    headless: true,
    ignoreDefaultArgs: ["--hide-scrollbars"]
  });
  try {
    for (const shot of SHOTS) {
      const page = await browser.newPage({
        viewport: { width: shot.w, height: shot.h },
        deviceScaleFactor: 2
      });
      const doc = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <style>${PLATINUM_CSS}</style>
  <style>:root { --stage-w: ${shot.w}px; --stage-h: ${shot.h}px; } ${SHARED_STAGE_CSS}</style>
</head>
<body>${shot.render()}</body>
</html>`;
      await page.setContent(doc, { waitUntil: "load" });
      await page.evaluate(() => document.fonts?.ready);
      const pngBuf = await page.screenshot({ type: "png" });
      await page.close();

      const webpBuf = await pngToLosslessWebp(browser, pngBuf);
      const outPath = join(OUT_DIR, `${shot.name}.webp`);
      writeFileSync(outPath, webpBuf);
      console.log(
        `[readme-shots] Wrote docs/screenshots/${shot.name}.webp (${shot.w * 2}x${shot.h * 2}px, ${(webpBuf.length / 1024).toFixed(1)} KiB)`
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
