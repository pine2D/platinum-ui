import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildAllBundles } from "../bin/build.mjs";
import {
  ICON_BUTTON_PROBE_SOURCE,
  auditDocsAndSkillParity,
  auditStaticCssContracts,
  auditTokensContrast,
  findIconButtonIssues,
  runBrowserAudit
} from "../bin/platinum-check.mjs";
import { syncVendor } from "../bin/sync-vendor.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("dist/*.css bundles match tokens + src byte-for-byte without drift", () => {
  const expected = buildAllBundles(ROOT);
  for (const [relPath, content] of Object.entries(expected)) {
    const actual = readFileSync(join(ROOT, relPath), "utf8");
    assert.equal(actual, content, `${relPath} drifted from source; run npm run build`);
  }
});

test("platinum-scoped.css never leaks global :root or bare body rules", () => {
  const scoped = readFileSync(join(ROOT, "dist/platinum-scoped.css"), "utf8");
  assert.doesNotMatch(scoped, /:root\b/);
  assert.doesNotMatch(scoped, /:is\(:root,\s*body\)/);
  assert.match(scoped, /\[data-platinum\]/);
});

test("tokens pass zero-cast R=G=B neutrality and 4-quadrant WCAG AA contrast with negative controls", () => {
  const tokens = JSON.parse(readFileSync(join(ROOT, "tokens/platinum.tokens.json"), "utf8"));
  const clean = auditTokensContrast(tokens);
  assert.deepEqual(clean.errors, []);
  assert.ok(clean.pairsChecked >= 120);

  // Negative control 1: tinted dark gray must fail zero-cast check
  const tinted = structuredClone(tokens);
  tinted.chassis.dark.window.$value = "#282831";
  assert.ok(auditTokensContrast(tinted).errors.some((e) => e.includes("zero-cast neutral gray")));

  // Negative control 2: sub-AA text must fail contrast check
  const lowContrast = structuredClone(tokens);
  lowContrast.chassis.dark["ink-muted"].$value = "#686868";
  assert.ok(auditTokensContrast(lowContrast).errors.some((e) => e.includes("ink-muted")));

  // Negative control 3: indistinct monochrome selection-bg (#d4d4d4 vs #cccccc) must fail distinctness check
  const indistinctSel = structuredClone(tokens);
  indistinctSel.variants.gray.light["selection-bg"].$value = "#d4d4d4";
  assert.ok(auditTokensContrast(indistinctSel).errors.some((e) => e.includes("selection-bg distinct from window")));
});

test("static CSS anti-trap audit catches bevel occlusion, missing border-box, :is(#id) leak, -2px hit box, and purple leak", () => {
  // 1. Occluded bevel
  const occluded = `.bad { box-shadow: inset 0 0 0 1px #000, inset 1px 1px 0 #fff; }`;
  assert.ok(auditStaticCssContracts(occluded).errors.some((e) => e.includes("occludes bevel")));

  // 2. Pseudo-element missing box-sizing: border-box (including CSS & nested blocks and inner @media)
  const badPseudo = `.bad::before { content: ""; inset: -3px; }`;
  assert.ok(auditStaticCssContracts(badPseudo).errors.some((e) => e.includes("box-sizing: border-box")));
  const badNestedPseudo = `@layer pt.core { .pt-range { &::before { content: ""; @media (min-width: 0px) { width: 4px; } } } }`;
  assert.ok(auditStaticCssContracts(badNestedPseudo).errors.some((e) => e.includes("box-sizing: border-box")));
  const safeQuotedCss = `.note::before { content: "a{box-shadow: inset 0 0 0 3px red, inset 1px 1px blue;}; box-shadow: inset 0 0 0 3px red, inset 1px 1px blue;"; }`;
  assert.deepEqual(auditStaticCssContracts(safeQuotedCss).errors, []);

  // 3. Un-:where()'d #id inside :is() / :not()
  const badSpec = `:is(.pt-btn, .act:not(#submit-btn)) { background: #ddd; }`;
  assert.ok(auditStaticCssContracts(badSpec).errors.some((e) => e.includes("un-:where()'d #id")));
  const safeSpec = `:is(.pt-btn, .act:not(:where(#submit-btn))) { background: #ddd; }`;
  assert.deepEqual(auditStaticCssContracts(safeSpec).errors, []);

  // 4. 20x20 padding-box hit-area math (-2px -> 22px < 24px)
  const badHit = `.pt-btn-sm.pt-btn-icon::before { content: ""; box-sizing: border-box; inset: -2px; }`;
  assert.ok(auditStaticCssContracts(badHit).errors.some((e) => e.includes("<= -3px")));

  // 5. Purple leak under --forbid-purple & unbalanced CSS braces
  const purpleCss = `.chip { background: #ccccff; }`;
  assert.ok(auditStaticCssContracts(purpleCss, { forbidPurple: true }).errors.some((e) => e.includes("forbidden purple")));
  assert.ok(auditStaticCssContracts(`@layer pt.tokens { .a { color: #222; }`).errors.some((e) => e.includes("unbalanced CSS braces")));
});

test("sync-vendor writes stamped bundle, passes --check, and detects hand-edits", () => {
  const tmp = mkdtempSync(join(tmpdir(), "pt-sync-"));
  try {
    const syncRes = syncVendor({ target: tmp, bundle: "scoped", root: ROOT });
    assert.equal(syncRes.ok, true);

    const checkOk = syncVendor({ target: tmp, bundle: "scoped", check: true, root: ROOT });
    assert.equal(checkOk.ok, true);

    // Tamper with synced file body -> must fail --check
    const destFile = syncRes.destPath;
    writeFileSync(destFile, readFileSync(destFile, "utf8") + "\n/* tampered */\n", "utf8");
    const checkTampered = syncVendor({ target: tmp, bundle: "scoped", check: true, root: ROOT });
    assert.equal(checkTampered.ok, false);
    assert.match(checkTampered.reason, /Hand-edit detected/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("docs and SKILL.md stay synced with tokens/classes and free of machine-local paths", () => {
  const res = auditDocsAndSkillParity(ROOT);
  assert.deepEqual(res.errors, []);
  assert.ok(res.docsChecked >= 6);
});

test("icon button geometry detector flags off-center, undersized hit area, non-square buttons, overlapping .pt-tbox, and residual modern UI leaks", () => {
  const bad = findIconButtonIssues({
    overflowX: 0,
    items: [
      { tag: "button", cls: "pt-btn pt-btn-icon", label: "off", btnW: 26, btnH: 26, hitW: 26, hitH: 26, iconOnly: true, svgW: 14, svgH: 14, dx: 1.4, dy: 0, segmented: false },
      { tag: "button", cls: "pt-btn pt-btn-sm pt-btn-icon", label: "small", btnW: 20, btnH: 20, hitW: 22, hitH: 22, iconOnly: true, svgW: 13, svgH: 13, dx: 0, dy: 0, segmented: false },
      { tag: "button", cls: "pt-tbox pt-tbox-minimize", label: "min", btnW: 13, btnH: 13, hitW: 18, hitH: 22, hitL: 100, hitR: 118, isTbox: true, titlebarIdx: 0, iconOnly: false },
      { tag: "button", cls: "pt-tbox pt-tbox-close", label: "close", btnW: 13, btnH: 13, hitW: 18, hitH: 22, hitL: 115, hitR: 133, isTbox: true, titlebarIdx: 0, iconOnly: false }
    ],
    pillLeaks: [{ tag: "button", cls: "send-fab", label: "Send", maxRadius: 18 }],
    crampedTableCells: [{ tag: "td", text: "AGENTS.md", paddingLeft: 0, paddingRight: 10 }],
    buttonChildIssues: [{ kind: "kbd-overlap", label: "New Chat", detail: "<kbd> overlaps button label text" }],
    groupboxIssues: [{ kind: "legend-groove-bleed", label: "Push Buttons", detail: "etched <fieldset> <legend> has transparent background (inset groove line cuts through title)" }],
    unstyledRanges: [{ cls: "", label: "opacity" }]
  }, "mock");
  assert.equal(bad.length, 8);
  assert.ok(bad.some((m) => m.includes("overlapping .pt-tbox hit boxes")));
  assert.ok(bad.some((m) => m.includes("residual pill/circle")));
  assert.ok(bad.some((m) => m.includes("flush cell padding")));
  assert.ok(bad.some((m) => m.includes("<kbd> overlaps button label text")));
  assert.ok(bad.some((m) => m.includes("inset groove line cuts through title")));
  assert.ok(bad.some((m) => m.includes("unstyled native range slider")));
});

test("live Chromium gallery passes all 8 (scheme x accent x density) states in EN and zh-CN plus mac9/macos/win window controls", async () => {
  const bEn = await runBrowserAudit({ root: ROOT });
  if (!bEn.skipped) {
    assert.equal(bEn.statesChecked, 8);
    assert.deepEqual(bEn.errors, []);

    const zhUrl = `${pathToFileURL(join(ROOT, "gallery/index.html")).href}?lang=zh-CN`;
    const bZh = await runBrowserAudit({ root: ROOT, url: zhUrl });
    assert.equal(bZh.statesChecked, 8);
    assert.deepEqual(bZh.errors, []);
  }
});

test("live Chromium probe detects circular FABs, flush table cells, and 3D/overlapping <kbd> inside buttons while platinum.css stays clean", async () => {
  const probeUrl = (html) => `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  const platinumCss = readFileSync(join(ROOT, "dist/platinum.css"), "utf8");

  // 1. Clean platinum.css page with <kbd> inside button & framed table inside .pt-prose -> 0 issues
  // Host reset lives in an earlier cascade layer (like Tailwind @layer base/components), proving
  // @layer pt.prose defeats layered :first-child resets while preserving unlayered author overrides.
  const cleanHtml = `<!doctype html><html data-platinum><head><style>
    @layer host;
    ${platinumCss}
    @layer host { .md td:first-child { padding-left: 0; } }
  </style></head><body style="padding:16px">
    <button style="display:inline-flex;gap:8px;align-items:center">New Chat <kbd><kbd>Ctrl</kbd><kbd>+</kbd><kbd>N</kbd></kbd></button>
    <input type="range" aria-label="Clean range" value="50" />
    <fieldset><legend>Bare Canvas Group</legend><button>Apply</button></fieldset>
    <div class="pt-well"><fieldset class="pt-groupbox"><legend>Well Nested Group</legend><button class="pt-btn">Save</button></fieldset></div>
    <div class="pt-prose md">
      <a href="#btn" class="pt-btn" aria-pressed="true">Pressed Link Button</a>
      <table><caption>Bundles</caption><thead><tr><th>File</th><th>Role</th></tr></thead><tbody><tr><td>AGENTS.md</td><td>Guide</td></tr></tbody></table>
    </div>
  </body></html>`;
  const cleanRes = await runBrowserAudit({ root: ROOT, url: probeUrl(cleanHtml) });
  if (cleanRes.skipped) return;
  assert.deepEqual(cleanRes.errors, []);

  // 2. Defective host overlay page -> must catch residual modern-UI traps, unstyled range & broken etched <fieldset> legends
  const badHtml = `<!doctype html><html><head><style>
    .fab { width: 32px; height: 32px; border-radius: 50%; }
    table { border-collapse: collapse; border: 1px solid #262626; }
    td { border: 1px solid #8c8c8c; padding: 6px 10px; }
    td:first-child { padding-left: 0; }
    .btn-hit { position: relative; width: 90px; height: 28px; display: inline-flex; align-items: center; }
    .btn-hit kbd { position: absolute; left: 8px; border: 1px solid #262626; box-shadow: inset 1px 1px 0 #fff; padding: 2px 5px; }
    .gb-bleed { border: 1px solid #888; box-shadow: inset 1px 1px 0 #fff; padding: 12px; }
    .gb-sag { border: 1px solid #888; box-shadow: inset 1px 1px 0 #fff; padding: 12px; }
    .gb-sag > legend { background: #ccc; padding: 0 6px; line-height: 1.5; }
  </style></head><body style="padding:16px; background:#ccc">
    <button class="fab" aria-label="Scroll down">↓</button>
    <button class="btn-hit">New Chat <kbd>Ctrl+Alt+N</kbd></button>
    <input type="range" aria-label="Raw slider" value="40" />
    <fieldset class="gb-bleed"><legend>Bleed Title</legend></fieldset>
    <fieldset class="gb-sag"><legend>Sagging Title</legend></fieldset>
    <table><tbody><tr><td>AGENTS.md</td><td>Guide</td></tr></tbody></table>
  </body></html>`;
  const badRes = await runBrowserAudit({ root: ROOT, url: probeUrl(badHtml) });
  assert.ok(badRes.errors.some((e) => e.includes("residual pill/circle")));
  assert.ok(badRes.errors.some((e) => e.includes("flush cell padding")));
  assert.ok(badRes.errors.some((e) => e.includes("3D bordered/beveled <kbd>")));
  assert.ok(badRes.errors.some((e) => e.includes("<kbd> overflows enclosing control bounds")));
  assert.ok(badRes.errors.some((e) => e.includes("<kbd> overlaps button label text")));
  assert.ok(badRes.errors.some((e) => e.includes("inset groove line cuts through title")));
  assert.ok(badRes.errors.some((e) => e.includes("baseline sags below etched top border")));
  assert.ok(badRes.errors.some((e) => e.includes("unstyled native range slider")));

  // 3. Partial [data-platinum] scoped mount ignores host controls outside mount while catching blank appearance:none sliders inside mount
  const scopedCss = readFileSync(join(ROOT, "dist/platinum-scoped.css"), "utf8");
  const partialCleanHtml = `<!doctype html><html><head><style>${scopedCss}</style></head><body style="padding:16px">
    <input type="range" aria-label="Host unmounted slider" value="30" />
    <section class="pt-window" data-platinum style="max-width:360px">
      <header class="pt-titlebar">
        <button class="pt-tbox pt-tbox-close" aria-label="Close"></button>
        <span class="pt-titlebar-label">Scoped Island</span>
        <button class="pt-tbox pt-tbox-zoom" aria-label="Zoom"></button>
        <button class="pt-tbox pt-tbox-minimize" aria-label="Collapse"></button>
      </header>
      <div class="pt-window-body"><input type="range" aria-label="Island slider" value="60" /></div>
    </section>
  </body></html>`;
  const partialCleanRes = await runBrowserAudit({ root: ROOT, url: probeUrl(partialCleanHtml) });
  assert.equal(partialCleanRes.statesChecked, 8);
  assert.deepEqual(partialCleanRes.errors, []);

  const blankRangeHtml = `<!doctype html><html><head><style>
    ${scopedCss}
    #blank-rng, #blank-rng::-webkit-slider-runnable-track, #blank-rng::-webkit-slider-thumb {
      appearance: none !important; -webkit-appearance: none !important;
      background: transparent !important; border: 0 !important; box-shadow: none !important;
    }
  </style></head><body style="padding:16px; background:#ccc">
    <div data-platinum><input id="blank-rng" type="range" aria-label="Blank slider" style="width:120px;height:24px" value="50" /></div>
  </body></html>`;
  const blankRangeRes = await runBrowserAudit({ root: ROOT, url: probeUrl(blankRangeHtml) });
  assert.ok(blankRangeRes.errors.some((e) => e.includes("blank range slider")));
});
