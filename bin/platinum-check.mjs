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

export function stripCssComments(cssText) {
  let out = "";
  let i = 0;
  let inStr = null;
  while (i < cssText.length) {
    const ch = cssText[i];
    if (inStr) {
      out += ch;
      if (ch === "\\" && i + 1 < cssText.length) out += cssText[++i];
      else if (ch === inStr) inStr = null;
      i++;
    } else if (ch === '"' || ch === "'") {
      inStr = ch;
      out += ch;
      i++;
    } else if (ch === "/" && cssText[i + 1] === "*") {
      const end = cssText.indexOf("*/", i + 2);
      const slice = end >= 0 ? cssText.slice(i, end + 2) : cssText.slice(i);
      out += slice.replace(/[^\n]/g, " ");
      i = end >= 0 ? end + 2 : cssText.length;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function scanCssRules(cssText) {
  const stripped = stripCssComments(cssText);
  const rules = [];
  const walk = (src, baseOffset, parentSel = null) => {
    let i = 0;
    let declBuf = "";
    const firstLine = cssText.slice(0, baseOffset).split("\n").length;
    while (i < src.length) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (i >= src.length) break;
      const stmtStart = i;
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
      if (i >= src.length) {
        if (parentSel) declBuf += src.slice(stmtStart);
        break;
      }
      const head = src.slice(stmtStart, i).trim();
      if (src[i] === ";") {
        if (parentSel) declBuf += src.slice(stmtStart, i + 1);
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
      const line = cssText.slice(0, baseOffset + stmtStart).split("\n").length;
      if (head.startsWith("@")) {
        if (!/^@(?:font-face|keyframes|property)\b/.test(head)) {
          walk(body, baseOffset + bodyStart, parentSel);
        }
      } else {
        const resolvedSel = parentSel
          ? (head.includes("&") ? head.replace(/&/g, parentSel) : `${parentSel} ${head}`)
          : head;
        walk(body, baseOffset + bodyStart, resolvedSel);
      }
    }
    if (parentSel && declBuf.trim()) {
      rules.push({ selector: parentSel, body: declBuf, line: firstLine });
    }
  };
  walk(stripped, 0, null);
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
  let start = 0;
  let paren = 0;
  let inStr = null;
  const pushDecl = (raw) => {
    let s = null;
    let colonIdx = -1;
    for (let j = 0; j < raw.length; j++) {
      const c = raw[j];
      if (s) {
        if (c === "\\") j++;
        else if (c === s) s = null;
      } else if (c === '"' || c === "'") {
        s = c;
      } else if (c === ":") {
        colonIdx = j;
        break;
      }
    }
    if (colonIdx <= 0) return;
    const prop = raw.slice(0, colonIdx).trim().toLowerCase();
    const val = raw.slice(colonIdx + 1).trim();
    if (prop) map.set(prop, val);
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === inStr) inStr = null;
    } else if (ch === '"' || ch === "'") {
      inStr = ch;
    } else if (ch === "(") {
      paren++;
    } else if (ch === ")") {
      paren = Math.max(0, paren - 1);
    } else if (ch === ";" && paren === 0) {
      pushDecl(body.slice(start, i));
      start = i + 1;
    }
  }
  pushDecl(body.slice(start));
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
  const cleanForBalance = stripCssComments(cssText);
  let braceDepth = 0;
  let strCh = null;
  for (let i = 0; i < cleanForBalance.length; i++) {
    const ch = cleanForBalance[i];
    if (strCh) {
      if (ch === "\\") i++;
      else if (ch === strCh) strCh = null;
    } else if (ch === '"' || ch === "'") {
      strCh = ch;
    } else if (ch === "{") {
      braceDepth++;
    } else if (ch === "}") {
      braceDepth--;
      if (braceDepth < 0) {
        errors.push(`${label}: unexpected closing "}" (unbalanced CSS braces)`);
        break;
      }
    }
  }
  if (braceDepth > 0) {
    errors.push(`${label}: ${braceDepth} unclosed "{" block(s) (unbalanced CSS braces)`);
  }
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
    if (/\.pt-btn-sm\.pt-btn-icon(?::where\([^)]*\))?::before/.test(rule.selector) && decls.has("inset")) {
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
  const readmeFiles = readdirSync(root).filter((f) => /^README(?:\.[A-Za-z0-9-]+)?\.md$/.test(f)).sort();
  const docPaths = [
    ...readmeFiles,
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
  const customScope = typeof window.__PT_AUDIT_SCOPE === 'string' && window.__PT_AUDIT_SCOPE.trim()
    ? window.__PT_AUDIT_SCOPE.trim()
    : null;
  const hasScopedMounts = !customScope &&
    !document.documentElement.hasAttribute('data-platinum') &&
    !document.body?.hasAttribute('data-platinum') &&
    Boolean(document.querySelector('[data-platinum]'));
  const inAuditScope = (el) => {
    if (el.closest('.pt-unstyled')) return false;
    if (customScope) return Boolean(el.closest(customScope));
    return !hasScopedMounts || Boolean(el.closest('[data-platinum]'));
  };
  const titlebars = [...document.querySelectorAll('.pt-titlebar')].filter(inAuditScope);
  const parsePx = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  for (const el of document.querySelectorAll('button, summary')) {
    if (!inAuditScope(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    // Effective hit box including ::before absolute expansion
    let hitL = rect.left, hitR = rect.right, hitT = rect.top, hitB = rect.bottom;
    let hitW = rect.width;
    let hitH = rect.height;
    const before = getComputedStyle(el, '::before');
    if (before && before.content && before.content !== 'none' && before.position === 'absolute') {
      const bwL = parsePx(cs.borderLeftWidth), bwR = parsePx(cs.borderRightWidth);
      const bwT = parsePx(cs.borderTopWidth), bwB = parsePx(cs.borderBottomWidth);
      const padL = rect.left + bwL, padR = rect.right - bwR;
      const padT = rect.top + bwT, padB = rect.bottom - bwB;
      const top = parsePx(before.top), right = parsePx(before.right), bottom = parsePx(before.bottom), left = parsePx(before.left);
      hitL = Math.min(hitL, padL + left);
      hitR = Math.max(hitR, padR - right);
      hitT = Math.min(hitT, padT + top);
      hitB = Math.max(hitB, padB - bottom);
      hitW = hitR - hitL;
      hitH = hitB - hitT;
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
    const tb = el.closest('.pt-titlebar');
    items.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || ''),
      label: el.getAttribute('aria-label') || el.getAttribute('title') || visibleText.trim().slice(0, 24),
      btnW: +rect.width.toFixed(2),
      btnH: +rect.height.toFixed(2),
      hitW: +hitW.toFixed(2),
      hitH: +hitH.toFixed(2),
      hitL: +hitL.toFixed(2),
      hitR: +hitR.toFixed(2),
      isTbox: el.classList.contains('pt-tbox'),
      titlebarIdx: tb ? titlebars.indexOf(tb) : -1,
      iconOnly,
      svgW,
      svgH,
      dx,
      dy,
      segmented: !!el.closest('.pt-segmented')
    });
  }

  // Probe A: Residual circular / pill controls (border-radius >= 8px on non-radio controls)
  const pillLeaks = [];
  for (const el of document.querySelectorAll('button, [role="button"], [role="switch"], input:not([type="radio"], [type="checkbox"]), select, .pt-chip, .pt-badge')) {
    if (!inAuditScope(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const maxR = Math.max(
      parsePx(cs.borderTopLeftRadius),
      parsePx(cs.borderTopRightRadius),
      parsePx(cs.borderBottomRightRadius),
      parsePx(cs.borderBottomLeftRadius)
    );
    if (maxR >= 8) {
      pillLeaks.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || ''),
        label: el.getAttribute('aria-label') || el.getAttribute('title') || (el.textContent || '').trim().slice(0, 24),
        maxRadius: +maxR.toFixed(1)
      });
    }
  }

  // Probe B: Framed tables with cramped/flush cell padding (< 6px horizontal padding)
  const crampedTableCells = [];
  for (const tbl of document.querySelectorAll('table')) {
    if (!inAuditScope(tbl)) continue;
    const tcs = getComputedStyle(tbl);
    if (tcs.display === 'none' || tcs.visibility === 'hidden') continue;
    const tRect = tbl.getBoundingClientRect();
    if (tRect.width <= 0 || tRect.height <= 0) continue;
    const cells = [...tbl.querySelectorAll('th, td')].filter((c) => {
      const ccs = getComputedStyle(c);
      const cr = c.getBoundingClientRect();
      return ccs.display !== 'none' && ccs.visibility !== 'hidden' && cr.width > 0 && cr.height > 0;
    });
    const tblHasBorder = parsePx(tcs.borderTopWidth) > 0 || parsePx(tcs.borderLeftWidth) > 0;
    const framed = tblHasBorder || cells.some((c) => {
      const ccs = getComputedStyle(c);
      return parsePx(ccs.borderLeftWidth) > 0 || parsePx(ccs.borderRightWidth) > 0 ||
        (c.tagName === 'TH' && ccs.backgroundColor && ccs.backgroundColor !== 'rgba(0, 0, 0, 0)' && ccs.backgroundColor !== 'transparent');
    });
    if (!framed) continue;
    for (const c of cells) {
      if (!(c.textContent || '').trim()) continue;
      const ccs = getComputedStyle(c);
      const pl = parsePx(ccs.paddingLeft);
      const pr = parsePx(ccs.paddingRight);
      if (pl < 6 || pr < 6) {
        crampedTableCells.push({
          tag: c.tagName.toLowerCase(),
          text: (c.textContent || '').trim().slice(0, 24),
          paddingLeft: +pl.toFixed(1),
          paddingRight: +pr.toFixed(1)
        });
      }
    }
  }

  // Probe C: 3D <kbd> inside interactive buttons/menus or child <kbd> colliding with button label/bounds
  const buttonChildIssues = [];
  for (const el of document.querySelectorAll('button, [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')) {
    if (!inAuditScope(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const bRect = el.getBoundingClientRect();
    if (bRect.width <= 0 || bRect.height <= 0) continue;
    const kbds = [...el.querySelectorAll('kbd')].filter((k) => {
      if (k.classList.contains('pt-kbd') || k.closest('.pt-unstyled')) return false;
      const kcs = getComputedStyle(k);
      const kr = k.getBoundingClientRect();
      return kcs.display !== 'none' && kcs.visibility !== 'hidden' && kr.width > 0 && kr.height > 0;
    });
    if (kbds.length === 0) continue;
    const label = el.getAttribute('aria-label') || el.getAttribute('title') || (el.textContent || '').trim().slice(0, 24);
    for (const k of kbds) {
      const kcs = getComputedStyle(k);
      const has3dChrome = parsePx(kcs.borderTopWidth) > 0 || parsePx(kcs.borderLeftWidth) > 0 || (kcs.boxShadow && kcs.boxShadow !== 'none');
      if (has3dChrome) {
        buttonChildIssues.push({
          kind: '3d-kbd-in-control',
          label,
          detail: '3D bordered/beveled <kbd> inside interactive button/menuitem'
        });
        break;
      }
    }
    const textRects = [];
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let tn;
    while ((tn = tw.nextNode())) {
      if (!tn.textContent || !tn.textContent.trim()) continue;
      const p = tn.parentElement;
      if (!p || p.closest('svg, .sr-only, kbd')) continue;
      if (getComputedStyle(p).display === 'none') continue;
      const range = document.createRange();
      range.selectNodeContents(tn);
      const r = range.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) textRects.push(r);
    }
    let reportedOverflow = false;
    let reportedOverlap = false;
    for (const k of kbds) {
      const kr = k.getBoundingClientRect();
      if (!reportedOverflow && (kr.right > bRect.right + 1 || kr.left < bRect.left - 1)) {
        reportedOverflow = true;
        buttonChildIssues.push({
          kind: 'kbd-overflow',
          label,
          detail: '<kbd> overflows enclosing control bounds'
        });
      }
      const hitOverlap = !reportedOverlap && textRects.some((tr) =>
        Math.min(tr.right, kr.right) - Math.max(tr.left, kr.left) > 1 &&
        Math.min(tr.bottom, kr.bottom) - Math.max(tr.top, kr.top) > 1
      );
      if (hitOverlap) {
        reportedOverlap = true;
        buttonChildIssues.push({
          kind: 'kbd-overlap',
          label,
          detail: '<kbd> overlaps button label text'
        });
      }
      if (reportedOverflow && reportedOverlap) break;
    }
  }

  // Probe D: Etched <fieldset> + <legend> groove bleed & HIG baseline alignment
  const groupboxIssues = [];
  for (const fs of document.querySelectorAll('fieldset')) {
    if (!inAuditScope(fs)) continue;
    const fcs = getComputedStyle(fs);
    if (fcs.display === 'none' || fcs.visibility === 'hidden') continue;
    const fsRect = fs.getBoundingClientRect();
    if (fsRect.width <= 0 || fsRect.height <= 0) continue;
    const bwT = parsePx(fcs.borderTopWidth);
    if (bwT <= 0 || !fcs.boxShadow || !fcs.boxShadow.includes('inset')) continue;
    const lg = [...fs.children].find((c) => c.tagName === 'LEGEND');
    if (!lg) continue;
    const lcs = getComputedStyle(lg);
    if (lcs.display === 'none' || lcs.visibility === 'hidden') continue;
    const lgRect = lg.getBoundingClientRect();
    const label = (lg.textContent || '').trim().slice(0, 32);
    if (!label || lgRect.width <= 0 || lgRect.height <= 0) continue;

    if (!lcs.backgroundColor || lcs.backgroundColor === 'rgba(0, 0, 0, 0)' || lcs.backgroundColor === 'transparent') {
      groupboxIssues.push({
        kind: 'legend-groove-bleed',
        label,
        detail: 'etched <fieldset> <legend> has transparent background (inset groove line cuts through title)'
      });
      continue;
    }
    const borderTopY = fsRect.top + Math.max(0, (lgRect.height - bwT) / 2);
    const insetGrooveY = borderTopY + 1;
    if (lgRect.bottom < insetGrooveY + 1) {
      groupboxIssues.push({
        kind: 'legend-groove-uncovered',
        label,
        detail: '<legend> background stops above fieldset inset groove line'
      });
      continue;
    }
    if (lgRect.height <= 24 && !lg.querySelector('input, select, button')) {
      const probe = document.createElement('span');
      probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;padding:0;margin:0;border:0';
      lg.appendChild(probe);
      const baseY = probe.getBoundingClientRect().top;
      probe.remove();
      if (baseY > insetGrooveY + 1.5) {
        groupboxIssues.push({
          kind: 'legend-baseline-sag',
          label,
          detail: '<legend> baseline sags below etched top border instead of resting on groove line'
        });
      }
    }
  }

  // Probe E: Unstyled native <input type="range"> leaking browser-default pill/circle slider
  const unstyledRanges = [];
  if (!window.matchMedia('(forced-colors: active)').matches) {
    for (const rng of document.querySelectorAll('input[type="range"]')) {
      if (!inAuditScope(rng)) continue;
      const rcs = getComputedStyle(rng);
      if (rcs.display === 'none' || rcs.visibility === 'hidden') continue;
      const rRect = rng.getBoundingClientRect();
      if (rRect.width <= 0 || rRect.height <= 0) continue;
      if (rcs.appearance !== 'none' && rcs.webkitAppearance !== 'none') {
        unstyledRanges.push({
          cls: String(rng.className || ''),
          label: rng.getAttribute('aria-label') || rng.id || 'range'
        });
      }
    }
  }

  const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return { items, overflowX, pillLeaks, crampedTableCells, buttonChildIssues, groupboxIssues, unstyledRanges };
})()`;

export function findIconButtonIssues(probeData, contextLabel = "page") {
  const issues = [];
  if (probeData.overflowX > 1) {
    issues.push(`${contextLabel}: horizontal overflow detected (+${probeData.overflowX}px)`);
  }
  const tboxesByBar = new Map();
  for (const b of probeData.items) {
    const id = `${contextLabel} <${b.tag}.${b.cls}> (${b.label})`;
    if (b.isTbox) {
      if (b.hitW < 18 || b.hitH < 22) {
        issues.push(`${id}: window control hit area ${b.hitW}x${b.hitH}px < 18x22px minimum`);
      }
      if (typeof b.titlebarIdx === "number" && b.titlebarIdx >= 0 && typeof b.hitL === "number" && typeof b.hitR === "number") {
        if (!tboxesByBar.has(b.titlebarIdx)) tboxesByBar.set(b.titlebarIdx, []);
        tboxesByBar.get(b.titlebarIdx).push(b);
      }
    } else if (b.hitW < 24 || b.hitH < 24) {
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
  for (const [barIdx, list] of tboxesByBar.entries()) {
    const sorted = [...list].sort((a, b) => a.hitL - b.hitL);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const next = sorted[i];
      if (prev.hitR > next.hitL + 0.5) {
        issues.push(
          `${contextLabel} titlebar#${barIdx}: overlapping .pt-tbox hit boxes (${prev.label} right=${prev.hitR} > ${next.label} left=${next.hitL})`
        );
      }
    }
  }
  for (const p of probeData.pillLeaks || []) {
    issues.push(`${contextLabel} <${p.tag}.${p.cls}> (${p.label}): residual pill/circle border-radius=${p.maxRadius}px >= 8px`);
  }
  for (const c of probeData.crampedTableCells || []) {
    issues.push(`${contextLabel} framed table <${c.tag}> ("${c.text}"): flush cell padding ${c.paddingLeft}px/${c.paddingRight}px < 6px`);
  }
  for (const k of probeData.buttonChildIssues || []) {
    issues.push(`${contextLabel} control (${k.label}): ${k.detail}`);
  }
  for (const g of probeData.groupboxIssues || []) {
    issues.push(`${contextLabel} groupbox (${g.label}): ${g.detail}`);
  }
  for (const r of probeData.unstyledRanges || []) {
    issues.push(`${contextLabel} <input[type="range"].${r.cls}> (${r.label}): unstyled native range slider leaks modern pill/circle thumb`);
  }
  return issues;
}

export function resolvePlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE_PATH,
    join(ROOT, "node_modules/playwright")
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

export async function runBrowserAudit({ url, scopeSelector, root = ROOT } = {}) {
  const pw = resolvePlaywright();
  if (!pw) {
    return { skipped: true, errors: [], statesChecked: 0 };
  }
  const targetUrl = url
    ? (/^https?:|^file:|^data:/.test(url) ? url : pathToFileURL(resolve(url)).href)
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
    if (scopeSelector) {
      await page.evaluate((sel) => { window.__PT_AUDIT_SCOPE = sel; }, scopeSelector);
    }

    for (const scheme of ["light", "dark"]) {
      for (const accent of ["gray", "lavender"]) {
        for (const density of ["compact", "comfortable"]) {
          await page.evaluate(({ s, a, d, sel }) => {
            const custom = sel ? [...document.querySelectorAll(sel)] : [];
            const mounts = !sel &&
              !document.documentElement.hasAttribute("data-platinum") &&
              !document.body?.hasAttribute("data-platinum")
              ? [...document.querySelectorAll("[data-platinum]")]
              : [];
            const targets = custom.length > 0 ? custom : (mounts.length > 0 ? mounts : [document.documentElement]);
            for (const el of targets) {
              el.setAttribute("data-platinum-scheme", s);
              el.setAttribute("data-platinum-accent", a);
              el.setAttribute("data-platinum-density", d);
            }
          }, { s: scheme, a: accent, d: density, sel: scopeSelector || null });
          const data = await page.evaluate(ICON_BUTTON_PROBE_SOURCE);
          errors.push(...findIconButtonIssues(data, `${scheme}/${accent}/${density}`));
          statesChecked++;
        }
      }
    }

    // Verify visible range sliders actually paint a distinguishable track/thumb (catches blank appearance:none)
    const rangeHandles = await page.locator('input[type="range"]:visible').all();
    for (const rng of rangeHandles) {
      const inScope = await rng.evaluate((el, sel) => {
        if (el.closest(".pt-unstyled")) return false;
        if (sel) return Boolean(el.closest(sel));
        const hasScoped = !document.documentElement.hasAttribute("data-platinum") &&
          !document.body?.hasAttribute("data-platinum") &&
          Boolean(document.querySelector("[data-platinum]"));
        return !hasScoped || Boolean(el.closest("[data-platinum]"));
      }, scopeSelector || null);
      if (!inScope) continue;
      const shot = await rng.screenshot();
      const hasContrast = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, img.width, img.height).data;
        let minL = 255, maxL = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 32) continue;
          const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (lum < minL) minL = lum;
          if (lum > maxL) maxL = lum;
        }
        return maxL - minL >= 20;
      }, shot.toString("base64"));
      if (!hasContrast) {
        const label = await rng.evaluate((el) => el.getAttribute("aria-label") || el.id || "range");
        errors.push(`range-paint <input[type="range"]> (${label}): blank range slider has no visible track/thumb contrast`);
      }
    }

    // Verify all 3 OS window-control presets (mac9, macos, win): order, dead-centering, and zero hit overlap
    for (const preset of ["mac9", "macos", "win"]) {
      await page.evaluate(({ p, sel }) => {
        const custom = sel ? [...document.querySelectorAll(sel)] : [];
        const mounts = !sel &&
          !document.documentElement.hasAttribute("data-platinum") &&
          !document.body?.hasAttribute("data-platinum")
          ? [...document.querySelectorAll("[data-platinum]")]
          : [];
        const targets = custom.length > 0 ? custom : (mounts.length > 0 ? mounts : [document.documentElement]);
        for (const el of targets) {
          el.setAttribute("data-platinum-controls", p);
        }
      }, { p: preset, sel: scopeSelector || null });
      const data = await page.evaluate(ICON_BUTTON_PROBE_SOURCE);
      errors.push(...findIconButtonIssues(data, `controls=${preset}`));
      const layoutIssues = await page.evaluate(({ p, sel }) => {
        const errs = [];
        const hasScoped = !sel &&
          !document.documentElement.hasAttribute("data-platinum") &&
          !document.body?.hasAttribute("data-platinum") &&
          Boolean(document.querySelector("[data-platinum]"));
        for (const bar of document.querySelectorAll(".pt-titlebar")) {
          if (bar.closest(".pt-unstyled") || (sel ? !bar.closest(sel) : (hasScoped && !bar.closest("[data-platinum]")))) continue;
          const close = bar.querySelector(".pt-tbox-close");
          const min = bar.querySelector(".pt-tbox-minimize");
          const zoom = bar.querySelector(".pt-tbox-zoom");
          const label = bar.querySelector(".pt-titlebar-label");
          if (!close || !min || !zoom || !label) continue;
          const rb = bar.getBoundingClientRect();
          const rc = close.getBoundingClientRect();
          const rm = min.getBoundingClientRect();
          const rz = zoom.getBoundingClientRect();
          const rl = label.getBoundingClientRect();
          const labelCx = (rl.left + rl.right) / 2;
          const barCx = (rb.left + rb.right) / 2;
          if (Math.abs(labelCx - barCx) > 2) {
            errs.push(`controls=${p}: title "${label.textContent.trim()}" off-center by ${(labelCx - barCx).toFixed(1)}px`);
          }
          if (p === "mac9" && !(rc.right < rl.left && rl.right < rz.left && rz.right < rm.left)) {
            errs.push(`controls=mac9: expected [close] < [title] < [zoom] < [collapse]`);
          }
          if (p === "macos" && !(rc.right < rm.left && rm.right < rz.left && rz.right < rl.left)) {
            errs.push(`controls=macos: expected [close] < [min] < [zoom] < [title]`);
          }
          if (p === "win" && !(rl.right < rm.left && rm.right < rz.left && rz.right < rc.left)) {
            errs.push(`controls=win: expected [title] < [min] < [zoom] < [close]`);
          }
        }
        return errs;
      }, { p: preset, sel: scopeSelector || null });
      errors.push(...layoutIssues);
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
  const scopeSelector = getOpt("--scope");

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
    const bRes = await runBrowserAudit({ url: browserUrl, scopeSelector, root: ROOT });
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
