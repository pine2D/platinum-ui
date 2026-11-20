import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildAllBundles } from "../bin/build.mjs";
import {
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

  // 2. Pseudo-element missing box-sizing: border-box
  const badPseudo = `.bad::before { content: ""; inset: -3px; }`;
  assert.ok(auditStaticCssContracts(badPseudo).errors.some((e) => e.includes("box-sizing: border-box")));

  // 3. Un-:where()'d #id inside :is() / :not()
  const badSpec = `:is(.pt-btn, .act:not(#submit-btn)) { background: #ddd; }`;
  assert.ok(auditStaticCssContracts(badSpec).errors.some((e) => e.includes("un-:where()'d #id")));
  const safeSpec = `:is(.pt-btn, .act:not(:where(#submit-btn))) { background: #ddd; }`;
  assert.deepEqual(auditStaticCssContracts(safeSpec).errors, []);

  // 4. 20x20 padding-box hit-area math (-2px -> 22px < 24px)
  const badHit = `.pt-btn-sm.pt-btn-icon::before { content: ""; box-sizing: border-box; inset: -2px; }`;
  assert.ok(auditStaticCssContracts(badHit).errors.some((e) => e.includes("<= -3px")));

  // 5. Purple leak under --forbid-purple
  const purpleCss = `.chip { background: #ccccff; }`;
  assert.ok(auditStaticCssContracts(purpleCss, { forbidPurple: true }).errors.some((e) => e.includes("forbidden purple")));
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

test("icon button geometry detector flags off-center, undersized hit area, non-square buttons, and overlapping .pt-tbox", () => {
  const bad = findIconButtonIssues({
    overflowX: 0,
    items: [
      { tag: "button", cls: "pt-btn pt-btn-icon", label: "off", btnW: 26, btnH: 26, hitW: 26, hitH: 26, iconOnly: true, svgW: 14, svgH: 14, dx: 1.4, dy: 0, segmented: false },
      { tag: "button", cls: "pt-btn pt-btn-sm pt-btn-icon", label: "small", btnW: 20, btnH: 20, hitW: 22, hitH: 22, iconOnly: true, svgW: 13, svgH: 13, dx: 0, dy: 0, segmented: false },
      { tag: "button", cls: "pt-tbox pt-tbox-minimize", label: "min", btnW: 13, btnH: 13, hitW: 18, hitH: 22, hitL: 100, hitR: 118, isTbox: true, titlebarIdx: 0, iconOnly: false },
      { tag: "button", cls: "pt-tbox pt-tbox-close", label: "close", btnW: 13, btnH: 13, hitW: 18, hitH: 22, hitL: 115, hitR: 133, isTbox: true, titlebarIdx: 0, iconOnly: false }
    ]
  }, "mock");
  assert.equal(bad.length, 3);
  assert.ok(bad.some((m) => m.includes("overlapping .pt-tbox hit boxes")));
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
