#!/usr/bin/env node
// Reusable Platinum UI quality & geometry gate suite:
//   1. W3C DTCG Token neutral-chassis & 4-quadrant WCAG AA contrast audit
//   2. Static CSS anti-trap audit (box-shadow occlusion, ::before border-box, :is() #id specificity leak,
//      20x20 ::before -3px hit-area math, hover pressed-state guard, optional Gray-mode purple ban)
//   3. Documentation & Agent Skill reference parity check
//   4. Optional live Chromium probe (--browser [--url <path-or-url>]): icon-only button centering (<=0.6px),
//      >=24px effective hit area (including ::before expansion), and zero horizontal overflow.
//
// Usage:
//   node bin/platinum-check.mjs
//   node bin/platinum-check.mjs --css <external.css> [--forbid-purple]
//   node bin/platinum-check.mjs --browser [--url <file-or-url>]

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---- WCAG 2.1 Relative Luminance & Contrast ----
export function hexToRgb(hex) {
  const clean = String(hex).trim();
  if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
    return [1, 2, 3].map((i) => parseInt(clean[i] + clean[i], 16));
  }
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
    return [1, 3, 5].map((i) => parseInt(clean.slice(i, i + 2), 16));
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

export function relativeLuminance([r, g, b]) {
  const chan = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexToRgb(hexA));
  const l2 = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function maxRgbChannelDiff(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

// ---- 1. Token Neutrality & 4-Quadrant WCAG AA Audit ----
const NEUTRAL_CHASSIS_ROLES = [
  "canvas", "window", "face", "face-hover", "pressed-bg", "pressed-fg",
  "paper", "code-bg", "ink", "ink-muted", "frame", "border-subtle",
  "groove-dark", "groove-light", "pinstripe-hi", "pinstripe-lo"
];

const GRAY_MONOCHROME_VARIANT_ROLES = [
  "selection-bg", "selection-fg", "menu-active-bg", "menu-active-fg",
  "scroll-track", "scroll-thumb", "scroll-thumb-hi", "scroll-thumb-lo"
];

export function auditTokensContrast(tokens) {
  const errors = [];
  let pairsChecked = 0;

  for (const mode of ["light", "dark"]) {
    const ch = tokens.chassis?.[mode];
    if (!ch) {
      errors.push(`Missing chassis.${mode}`);
      continue;
    }
    for (const role of NEUTRAL_CHASSIS_ROLES) {
      const val = ch[role]?.$value;
      if (!val) {
        errors.push(`Missing chassis.${mode}.${role}`);
        continue;
      }
      const [r, g, b] = hexToRgb(val);
      if (r !== g || g !== b) {
        errors.push(`chassis.${mode}.${role} (${val}) must be zero-cast neutral gray (R=G=B)`);
      }
    }

    for (const role of GRAY_MONOCHROME_VARIANT_ROLES) {
      const val = tokens.variants?.gray?.[mode]?.[role]?.$value;
      if (!val) {
        errors.push(`Missing variants.gray.${mode}.${role}`);
        continue;
      }
      const [r, g, b] = hexToRgb(val);
      if (r !== g || g !== b) {
        errors.push(`variants.gray.${mode}.${role} (${val}) must stay strictly monochrome (R=G=B) in Gray variant`);
      }
    }

    for (const variantName of ["gray", "lavender"]) {
      const vr = tokens.variants?.[variantName]?.[mode];
      if (!vr) {
        errors.push(`Missing variants.${variantName}.${mode}`);
        continue;
      }
      const surfaces = ["paper", "window", "face", "face-hover"];
      const textOnAllSurfaces = [
        ["ink", ch.ink.$value, 4.5],
        ["ink-muted", ch["ink-muted"].$value, 4.5],
        ["accent", vr.accent.$value, 4.5],
        ["danger", ch.danger.$value, 4.5],
        ["success", ch.success.$value, 4.5],
        ["warning", ch.warning.$value, 4.5]
      ];
      for (const [fgName, fgHex, minRatio] of textOnAllSurfaces) {
        for (const surfName of surfaces) {
          const bgHex = ch[surfName].$value;
          const ratio = contrastRatio(fgHex, bgHex);
          pairsChecked++;
          if (ratio < minRatio) {
            errors.push(`[${variantName}/${mode}] ${fgName} (${fgHex}) on ${surfName} (${bgHex}) = ${ratio.toFixed(2)}:1 < ${minRatio}:1`);
          }
        }
      }

      const directPairs = [
        ["pressed-fg/pressed-bg", ch["pressed-fg"].$value, ch["pressed-bg"].$value, 4.5],
        ["on-accent/accent", vr["on-accent"].$value, vr.accent.$value, 4.5],
        ["selection-fg/selection-bg", vr["selection-fg"].$value, vr["selection-bg"].$value, 4.5],
        ["menu-active-fg/menu-active-bg", vr["menu-active-fg"].$value, vr["menu-active-bg"].$value, 4.5],
        ["on-danger/danger", ch["on-danger"].$value, ch.danger.$value, 4.5],
        ["danger/danger-soft", ch.danger.$value, ch["danger-soft"].$value, 4.5],
        ["success/success-soft", ch.success.$value, ch["success-soft"].$value, 4.5],
        ["warning/warning-soft", ch.warning.$value, ch["warning-soft"].$value, 4.5]
      ];
      for (const [label, hexA, hexB, minRatio] of directPairs) {
        const ratio = contrastRatio(hexA, hexB);
        pairsChecked++;
        if (ratio < minRatio) {
          errors.push(`[${variantName}/${mode}] ${label} (${hexA} vs ${hexB}) = ${ratio.toFixed(2)}:1 < ${minRatio}:1`);
        }
      }

      const distinctPairs = [
        ["selection-bg distinct from paper", vr["selection-bg"].$value, ch.paper.$value],
        ["selection-bg distinct from window", vr["selection-bg"].$value, ch.window.$value]
      ];
      for (const [label, hexA, hexB] of distinctPairs) {
        const ratio = contrastRatio(hexA, hexB);
        const chanDiff = maxRgbChannelDiff(hexA, hexB);
        pairsChecked++;
        if (ratio < 1.15 && chanDiff < 40) {
          errors.push(
            `[${variantName}/${mode}] ${label} (${hexA} vs ${hexB}) = ${ratio.toFixed(2)}:1 luminance & ΔRGB=${chanDiff} (needs >= 1.15:1 or ΔRGB >= 40)`
          );
        }
      }
    }
  }

  return { errors, pairsChecked };
}

// ---- 2. Minimal Balanced CSS Rule Scanner & Static Anti-Trap Audit ----
export const FORBIDDEN_PURPLE_RE = /#(?:9999ff|ccccff|dcdcff|333399|3d3dad|4b4bb8|5c5c9e|9e9eff|9494ff|a9a9ff|b3b3ff|32325c|2b2b4e|6666aa|8585cc|b4b4ff|282831|353540|2b2b34|1f1f26|2a2a33)\b/i;

export function scanCssRules(cssText) {
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const rules = [];
  const walk = (src, baseOffset) => {
    let i = 0;
    while (i < src.length) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (i >= src.length) break;
      const headStart = i;
      let paren = 0;
      let inStr = null;
      while (i < src.length) {
        const ch = src[i];
        if (inStr) {
          if (ch === "\\") i++;
          else if (ch === inStr) inStr = null;
        } else if (ch === '"' || ch === "'") {
          inStr = ch;
        } else if (ch === "(") {
          paren++;
        } else if (ch === ")") {
          paren = Math.max(0, paren - 1);
        } else if (paren === 0 && (ch === "{" || ch === ";")) {
          break;
        }
        i++;
      }
      if (i >= src.length) break;
      const head = src.slice(headStart, i).trim();
      if (src[i] === ";") {
        i++;
        continue;
      }
      const bodyStart = i + 1;
      let depth = 1;
      i++;
      inStr = null;
      while (i < src.length && depth > 0) {
        const ch = src[i];
        if (inStr) {
          if (ch === "\\") i++;
          else if (ch === inStr) inStr = null;
        } else if (ch === '"' || ch === "'") {
          inStr = ch;
        } else if (ch === "{") {
          depth++;
        } else if (ch === "}") {
          depth--;
        }
        i++;
      }
      const body = src.slice(bodyStart, i - 1);
      const line = cssText.slice(0, baseOffset + headStart).split("\n").length;
      if (head.startsWith("@")) {
        if (!/^@(?:font-face|keyframes|property)\b/.test(head)) {
          walk(body, baseOffset + bodyStart);
        }
      } else {
        rules.push({ selector: head, body, line });
      }
    }
  };
  walk(stripped, 0);
  return rules;
}

function splitTopLevelCommas(value) {
  const parts = [];
  let start = 0;
  let paren = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") paren++;
    else if (value[i] === ")") paren = Math.max(0, paren - 1);
    else if (value[i] === "," && paren === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function parseDecls(body) {
  const map = new Map();
  for (const raw of body.split(";")) {
    const idx = raw.indexOf(":");
    if (idx <= 0) continue;
    const prop = raw.slice(0, idx).trim().toLowerCase();
    const val = raw.slice(idx + 1).trim();
    if (prop) map.set(prop, val);
  }
  return map;
}

function stripWhereBlocks(selector) {
  let out = "";
  let i = 0;
  while (i < selector.length) {
    if (selector.startsWith(":where(", i)) {
      let depth = 1;
      i += 7;
      while (i < selector.length && depth > 0) {
        if (selector[i] === "(") depth++;
        else if (selector[i] === ")") depth--;
        i++;
      }
    } else {
      out += selector[i++];
    }
  }
  return out;
}

export function auditStaticCssContracts(cssText, { label = "css", forbidPurple = false } = {}) {
  const errors = [];
  const rules = scanCssRules(cssText);

  if (forbidPurple) {
    const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
    const m = FORBIDDEN_PURPLE_RE.exec(stripped);
    if (m) {
      errors.push(`${label}: forbidden purple/lavender color ${m[0]} found under --forbid-purple policy`);
    }
  }

  for (const rule of rules) {
    const decls = parseDecls(rule.body);

    // 1. Box-shadow bevel occlusion: `inset 0 0 0 <N>px` before `inset ±1/2px` occludes inner bevels
    const boxShadow = decls.get("box-shadow");
    if (boxShadow && boxShadow.includes("inset")) {
      const layers = splitTopLevelCommas(boxShadow);
      const ringIdx = layers.findIndex((l) => /^inset\s+0(?:px)?\s+0(?:px)?\s+0(?:px)?\s+[1-9]/.test(l));
      const bevelIdx = layers.findIndex((l) => /^inset\s+-?[12]px\s+-?[12]px\b/.test(l));
      if (ringIdx >= 0 && bevelIdx > ringIdx) {
        errors.push(`${label}:${rule.line}: box-shadow "${boxShadow}" places solid inset ring before inner bevel (occludes bevel)`);
      }
    }

    // 2. Pseudo-element border-box guard
    if (/::(?:before|after)\b/.test(rule.selector)) {
      const sizes = decls.has("width") || decls.has("height") || decls.has("inset");
      if (sizes && decls.get("box-sizing") !== "border-box") {
        errors.push(`${label}:${rule.line}: "${rule.selector}" sets geometry on ::before/::after without box-sizing: border-box`);
      }
    }

    // 3. :is() / :not() un-:where()'d #id specificity inflation on shared control rules
    const withoutWhere = stripWhereBlocks(rule.selector);
    if (/:(?:is|not)\([^)]*#[A-Za-z_]/.test(withoutWhere)) {
      errors.push(`${label}:${rule.line}: "${rule.selector}" has an un-:where()'d #id inside :is()/:not(), inflating selector specificity`);
    }

    // 4. 20x20 (.pt-btn-sm.pt-btn-icon::before) padding-box hit-area math (must be <= -3px, never -2px)
    if (rule.selector.includes(".pt-btn-sm.pt-btn-icon::before") && decls.has("inset")) {
      const insetPx = parseFloat(decls.get("inset"));
      if (!(insetPx <= -3)) {
        errors.push(`${label}:${rule.line}: .pt-btn-sm.pt-btn-icon::before inset must be <= -3px to reach 24x24px hit area from 18x18px padding-box (got ${decls.get("inset")})`);
      }
    }

    // 5. Button :hover must not override depressed (:active / [aria-pressed="true"]) state
    if (/^\.pt-btn:hover\b/.test(rule.selector)) {
      if (!rule.selector.includes(":active") || !rule.selector.includes('aria-pressed="true"')) {
        errors.push(`${label}:${rule.line}: "${rule.selector}" must exclude :active and [aria-pressed="true"] so hover never wipes depressed state`);
      }
    }
  }

  return { errors, rulesChecked: rules.length };
}

// ---- 3. Documentation & Skill Reference Parity ----
export function auditDocsAndSkillParity(root = ROOT) {
  const errors = [];
  const fullCss = readFileSync(join(root, "dist/platinum.css"), "utf8");
  const scopedCss = readFileSync(join(root, "dist/platinum-scoped.css"), "utf8");
  const combinedCss = fullCss + "\n" + scopedCss;

  const refDir = join(root, "skills/platinum-ui/references");
  const refFiles = existsSync(refDir)
    ? readdirSync(refDir).filter((f) => f.endsWith(".md")).sort().map((f) => `skills/platinum-ui/references/${f}`)
    : [];
  const docPaths = [
    "README.md",
    "DESIGN.md",
    "CLAUDE.md",
    "skills/platinum-ui/SKILL.md",
    ...refFiles
  ].filter((p) => existsSync(join(root, p)));

  for (const rel of docPaths) {
    const content = readFileSync(join(root, rel), "utf8");
    // Enforce public-ready hygiene: zero machine-local paths
    if (/\/home\/|\/mnt\/|\/Users\/|[A-Za-z]:\\/i.test(content)) {
      errors.push(`${rel}: contains machine-local path or personal identifier`);
    }
    let fenced = false;
    content.split("\n").forEach((line, idx) => {
      if (/^\s*(?:```|~~~)/.test(line)) {
        fenced = !fenced;
        return;
      }
      if (fenced) return;
      for (const m of line.matchAll(/`([^`\n]+)`/g)) {
        const span = m[1].trim();
        if (/^--pt-[a-z0-9-]+$/.test(span) && !combinedCss.includes(span)) {
          errors.push(`${rel}:${idx + 1}: references unknown token \`${span}\``);
        }
        if (/^\.pt-[a-z0-9-]+$/.test(span) && span !== ".pt-unstyled" && !combinedCss.includes(span)) {
          errors.push(`${rel}:${idx + 1}: references unknown CSS class \`${span}\``);
        }
      }
      for (const imgMatch of line.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const ref = imgMatch[1].trim();
        if (/^(?:https?:|data:)/i.test(ref)) continue;
        const imgAbs = resolve(dirname(join(root, rel)), ref);
        if (!existsSync(imgAbs) || statSync(imgAbs).size === 0) {
          errors.push(`${rel}:${idx + 1}: missing or empty image asset "${ref}"`);
        }
      }
    });
  }
  return { errors, docsChecked: docPaths.length };
}

// ---- 4. Live Chromium Geometry & Icon Centering Probes ----
export const ICON_BUTTON_PROBE_SOURCE = `(() => {
  const items = [];
  const parsePx = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  for (const el of document.querySelectorAll('button, summary')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    // Effective hit box including ::before absolute expansion
    let hitW = rect.width;
    let hitH = rect.height;
    const before = getComputedStyle(el, '::before');
    if (before && before.content && before.content !== 'none' && before.position === 'absolute') {
      const bwL = parsePx(cs.borderLeftWidth), bwR = parsePx(cs.borderRightWidth);
      const bwT = parsePx(cs.borderTopWidth), bwB = parsePx(cs.borderBottomWidth);
      const padW = rect.width - bwL - bwR;
      const padH = rect.height - bwT - bwB;
      const top = parsePx(before.top), right = parsePx(before.right), bottom = parsePx(before.bottom), left = parsePx(before.left);
      hitW = Math.max(hitW, padW - left - right);
      hitH = Math.max(hitH, padH - top - bottom);
    }

    const svgs = [...el.querySelectorAll('svg')].filter((s) => {
      const scs = getComputedStyle(s);
      return scs.display !== 'none' && scs.visibility !== 'hidden' && s.getBoundingClientRect().width > 0;
    });
    let visibleText = '';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const p = node.parentElement;
      if (!p || p.closest('svg, .sr-only')) continue;
      if (getComputedStyle(p).display !== 'none') visibleText += node.textContent;
    }
    const iconOnly = svgs.length === 1 && visibleText.trim() === '';
    let dx = 0, dy = 0, svgW = 0, svgH = 0;
    if (iconOnly) {
      const sRect = svgs[0].getBoundingClientRect();
      dx = +(((sRect.left + sRect.right) / 2) - ((rect.left + rect.right) / 2)).toFixed(2);
      dy = +(((sRect.top + sRect.bottom) / 2) - ((rect.top + rect.bottom) / 2)).toFixed(2);
      svgW = +sRect.width.toFixed(2);
      svgH = +sRect.height.toFixed(2);
    }
    items.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || ''),
      label: el.getAttribute('aria-label') || el.getAttribute('title') || visibleText.trim().slice(0, 24),
      btnW: +rect.width.toFixed(2),
      btnH: +rect.height.toFixed(2),
      hitW: +hitW.toFixed(2),
      hitH: +hitH.toFixed(2),
      iconOnly,
      svgW,
      svgH,
      dx,
      dy,
      segmented: !!el.closest('.pt-segmented')
    });
  }
  const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return { items, overflowX };
})()`;

export function findIconButtonIssues(probeData, contextLabel = "page") {
  const issues = [];
  if (probeData.overflowX > 1) {
    issues.push(`${contextLabel}: horizontal overflow detected (+${probeData.overflowX}px)`);
  }
  for (const b of probeData.items) {
    const id = `${contextLabel} <${b.tag}.${b.cls}> (${b.label})`;
    if (b.hitW < 24 || b.hitH < 24) {
      issues.push(`${id}: effective hit area ${b.hitW}x${b.hitH}px < 24x24px minimum`);
    }
    if (!b.iconOnly) continue;
    if (Math.abs(b.dx) > 0.6 || Math.abs(b.dy) > 0.6) {
      issues.push(`${id}: icon off-center dx=${b.dx}px dy=${b.dy}px in ${b.btnW}x${b.btnH}`);
    }
    if (b.svgW < 8 || b.svgH < 8 || Math.abs(b.svgW - b.svgH) > 1.5) {
      issues.push(`${id}: icon SVG deformed ${b.svgW}x${b.svgH}`);
    }
    if (!b.segmented && Math.abs(b.btnW - b.btnH) > 4) {
      issues.push(`${id}: standalone icon button non-square ${b.btnW}x${b.btnH}`);
    }
  }
  return issues;
}

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
  return null;
}

export async function runBrowserAudit({ url, root = ROOT } = {}) {
  const pw = resolvePlaywright();
  if (!pw) {
    return { skipped: true, errors: [], statesChecked: 0 };
  }
  const targetUrl = url
    ? (/^https?:|^file:/.test(url) ? url : pathToFileURL(resolve(url)).href)
    : pathToFileURL(join(root, "gallery/index.html")).href;

  const browser = await pw.chromium.launch({
    headless: true,
    ignoreDefaultArgs: ["--hide-scrollbars"]
  });
  const errors = [];
  let statesChecked = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
    await page.goto(targetUrl, { waitUntil: "load" });

    for (const scheme of ["light", "dark"]) {
      for (const accent of ["gray", "lavender"]) {
        for (const density of ["compact", "comfortable"]) {
          await page.evaluate(({ s, a, d }) => {
            const rootEl = document.documentElement;
            rootEl.setAttribute("data-platinum-scheme", s);
            rootEl.setAttribute("data-platinum-accent", a);
            rootEl.setAttribute("data-platinum-density", d);
          }, { s: scheme, a: accent, d: density });
          const data = await page.evaluate(ICON_BUTTON_PROBE_SOURCE);
          errors.push(...findIconButtonIssues(data, `${scheme}/${accent}/${density}`));
          statesChecked++;
        }
      }
    }
  } finally {
    await browser.close();
  }
  return { skipped: false, errors, statesChecked };
}

async function main() {
  const argv = process.argv.slice(2);
  const getOpt = (flag) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const externalCss = getOpt("--css");
  const forbidPurple = argv.includes("--forbid-purple");
  const withBrowser = argv.includes("--browser");
  const browserUrl = getOpt("--url");

  if (externalCss) {
    const text = readFileSync(resolve(externalCss), "utf8");
    const res = auditStaticCssContracts(text, { label: externalCss, forbidPurple });
    if (res.errors.length > 0) {
      for (const e of res.errors) console.error(`  FAIL  ${e}`);
      process.exit(1);
    }
    console.log(`[platinum-check] OK — ${externalCss} (${res.rulesChecked} rules passed${forbidPurple ? ", purple-free" : ""})`);
    return;
  }

  const allErrors = [];
  const tokens = JSON.parse(readFileSync(join(ROOT, "tokens/platinum.tokens.json"), "utf8"));
  const contrastRes = auditTokensContrast(tokens);
  allErrors.push(...contrastRes.errors);

  const distDir = join(ROOT, "dist");
  let rulesTotal = 0;
  for (const name of readdirSync(distDir).filter((f) => f.endsWith(".css")).sort()) {
    const cssText = readFileSync(join(distDir, name), "utf8");
    const res = auditStaticCssContracts(cssText, { label: `dist/${name}`, forbidPurple: false });
    rulesTotal += res.rulesChecked;
    allErrors.push(...res.errors);
  }

  // Also ensure src/core.css, src/elements.css, and src/prose.css themselves contain zero hardcoded purple hexes
  for (const srcName of ["src/core.css", "src/elements.css", "src/prose.css"]) {
    const res = auditStaticCssContracts(readFileSync(join(ROOT, srcName), "utf8"), {
      label: srcName,
      forbidPurple: true
    });
    allErrors.push(...res.errors);
  }

  const docRes = auditDocsAndSkillParity(ROOT);
  allErrors.push(...docRes.errors);

  let browserSummary = "";
  if (withBrowser) {
    const bRes = await runBrowserAudit({ url: browserUrl, root: ROOT });
    if (bRes.skipped) {
      browserSummary = " | browser: skipped (Playwright not found)";
    } else {
      allErrors.push(...bRes.errors);
      browserSummary = ` | browser: ${bRes.statesChecked} states verified`;
    }
  }

  if (allErrors.length > 0) {
    console.error(`[platinum-check] FAILED with ${allErrors.length} violation(s):`);
    for (const e of allErrors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(
    `[platinum-check] PASS — ${contrastRes.pairsChecked} WCAG AA pairs, ${rulesTotal} CSS rules, ${docRes.docsChecked} docs/skills synced${browserSummary}`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
