import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolvePlaywright } from "../bin/platinum-check.mjs";

const playwright = resolvePlaywright();
const gallery = new URL("../gallery/index.html", import.meta.url);
const cssPath = name => fileURLToPath(new URL(`../dist/${name}.css`, import.meta.url));

describe("Platinum controls in Chromium", { skip: !playwright && "Playwright unavailable" }, () => {
  let browser;
  before(async () => { browser = await playwright.chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] }); });
  after(async () => { await browser?.close(); });

  it("draws the native mixed state independently of checked in the supported CSS entry points", async t => {
    const page = await browser.newPage();
    t.after(() => page.close());
    for (const bundle of ["platinum", "platinum-core", "platinum-scoped"]) {
      await page.setContent('<input type="checkbox" id="outside"><div data-platinum><input type="checkbox" class="pt-checkbox"><input type="checkbox" id="bare"></div>');
      await page.addStyleTag({ path: cssPath(bundle) });
      for (const selector of bundle === "platinum-core" ? [".pt-checkbox"] : [".pt-checkbox", "#bare"]) {
        const marks = await page.locator(selector).evaluate(input => {
          const mark = () => {
            const style = getComputedStyle(input, "::after");
            return [style.content, style.borderTopWidth, style.borderLeftWidth, style.transform];
          };
          const off = mark();
          input.indeterminate = true;
          const mixed = mark();
          input.checked = true;
          const checkedAndMixed = mark();
          input.indeterminate = false;
          return { off, mixed, checkedAndMixed, on: mark() };
        });
        assert.equal(marks.off[0], "none");
        assert.deepEqual(marks.mixed, ['""', "2px", "0px", "none"]);
        assert.deepEqual(marks.checkedAndMixed, marks.mixed);
        assert.equal(marks.on[2], "2px");
        assert.notEqual(marks.on[3], "none");
      }
      if (bundle === "platinum-scoped") {
        assert.equal(await page.locator("#outside").evaluate(input => {
          input.indeterminate = true;
          return getComputedStyle(input, "::after").content;
        }), "none");
      }
    }
  });

  it("keeps the master checkbox in sync and scrolls the wide table within its own region", async t => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    t.after(() => page.close());
    await page.goto(gallery.href);
    const master = page.getByRole("checkbox", { name: "All sync options" });
    const options = page.locator('input[name="sync-option"]');
    const mixed = () => master.evaluate(input => input.indeterminate);
    assert.equal(await mixed(), true);
    await master.press("Space");
    assert.deepEqual(await options.evaluateAll(inputs => inputs.map(input => input.checked)), [true, true]);
    await options.first().uncheck();
    assert.equal(await mixed(), true);
    await options.last().uncheck();
    assert.equal(await mixed(), false);
    assert.equal(await master.isChecked(), false);
    const scroll = await page.getByRole("region", { name: "CSS bundles and host markup" }).evaluate(region => {
      region.scrollLeft = region.scrollWidth;
      const viewport = document.documentElement;
      return [region.scrollLeft, viewport.scrollWidth - viewport.clientWidth];
    });
    assert.ok(scroll[0] > 0);
    assert.equal(scroll[1], 0);
  });

  it("paints four grip ridges across each scrollbar in all styled bundles", async t => {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    t.after(() => page.close());
    for (const bundle of ["platinum", "platinum-core", "platinum-scoped"]) {
      const scrollClass = bundle === "platinum-core" ? 'class="pt-scroll"' : "";
      await page.setContent(`<!doctype html><main data-platinum data-platinum-scheme="light">
        <div ${scrollClass} style="width:200px; height:140px; overflow:scroll">
          <div style="width:360px; height:330px"></div>
        </div>
      </main>`);
      await page.addStyleTag({ path: cssPath(bundle) });
      const png = await page.locator("main > div").screenshot();
      // CSSOM exposes the generic thumb style. Sample the painted centerline of
      // each 15px track to catch selectors that parse but never match :horizontal.
      const grips = await page.evaluate(async base64 => {
        const image = new Image();
        image.src = "data:image/png;base64," + base64;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        function hasFourRidges({ data }) {
          const red = data.filter((_, i) => i % 4 === 0);
          for (let i = 0; i + 7 < red.length; i++) {
            const highlight = Math.min(red[i], red[i + 2], red[i + 4], red[i + 6]);
            const shadow = Math.max(red[i + 1], red[i + 3], red[i + 5], red[i + 7]);
            if (highlight - shadow > 40) return true;
          }
          return false;
        }
        return {
          horizontal: hasFourRidges(ctx.getImageData(0, image.height - 8, image.width, 1)),
          vertical: hasFourRidges(ctx.getImageData(image.width - 8, 0, 1, image.height))
        };
      }, png.toString("base64"));
      assert.deepEqual(grips, { horizontal: true, vertical: true }, bundle);
    }
  });

  it("navigates, dismisses and copies the working localized menu", async t => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.goto(gallery.href);
    const trigger = page.getByRole("button", { name: "Workspace actions" });
    const menu = page.getByRole("menu");
    const items = menu.getByRole("menuitem");
    const hasFocus = locator => locator.evaluate(el => el === document.activeElement);
    await trigger.hover();
    await trigger.press("Enter");
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    assert.equal(await hasFocus(items.first()), true);
    await items.first().hover();
    await page.keyboard.press("ArrowDown");
    assert.equal(await hasFocus(items.nth(1)), true);
    assert.equal(await items.first().evaluate(el => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    await page.keyboard.press("Escape");
    assert.equal(await menu.isVisible(), false);
    assert.equal(await hasFocus(trigger), true);
    await trigger.press("ArrowUp");
    assert.equal(await hasFocus(items.last()), true);
    await page.keyboard.press("Home");
    await page.keyboard.press("Space");
    assert.equal(await page.locator("#workspace-command").innerText(), "New Workspace");
    await page.getByRole("button", { name: "中文" }).click();
    assert.equal(await page.locator("#workspace-command").innerText(), "新建工作区");

    await page.locator(".menu-source summary").click();
    const source = await page.locator("#menu-code").textContent();
    assert.doesNotMatch(source, /data-i18n/);
    // Exercise both clipboard outcomes without changing the system clipboard.
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", {
      configurable: true, value: { writeText: text => { window.copiedExample = text; } }
    }));
    await page.getByRole("button", { name: "复制示例" }).click();
    assert.equal(await page.evaluate(() => window.copiedExample), source);
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { value: undefined }));
    await page.getByRole("button", { name: "复制示例" }).click();
    assert.equal(await page.evaluate(() => getSelection().toString()), source);

    const host = await browser.newPage();
    t.after(() => host.close());
    await host.setContent('<!doctype html><html lang="zh-CN"><body>' + source + '<button>Next</button></body></html>');
    await host.addStyleTag({ path: cssPath("platinum-core") });
    const copiedTrigger = host.getByRole("button", { name: "工作区操作" });
    await copiedTrigger.click();
    await host.getByRole("menuitem", { name: "导出 Markdown" }).click();
    assert.equal(await host.locator("output").textContent(), "导出 Markdown");
    assert.equal(await hasFocus(copiedTrigger), true);
    await copiedTrigger.press("ArrowDown");
    await host.keyboard.press("Tab");
    assert.equal(await hasFocus(host.getByRole("button", { name: "Next" })), true);
    assert.equal(await copiedTrigger.getAttribute("aria-expanded"), "false");
  });

  it("styles customizable <select> picker, multi-row listbox, disabled marks, [hidden], nested @scope islands, strict scoped.css, and forced-colors radio", async t => {
    const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
    t.after(() => page.close());
    await page.goto(gallery.href);

    // 1. Window 2 customizable <select>: stable width, 4px-7px-4px arrow cap symmetry (closed & :open at DPR 2), + ::picker(select)
    const sel = page.locator("select.pt-select").first();
    const measureCapSymmetry = async (shot, capBgByte, arrowByte) => page.evaluate(async ({ b64, capBgByte, arrowByte }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height).data;
      const startX = img.width - 36;
      const arrowRows = [];
      for (let y = 8; y < img.height - 8; y++) {
        const capCols = [], arrCols = [];
        for (let x = startX; x < img.width; x++) {
          const v = d[(y * img.width + x) * 4];
          if (v === arrowByte) arrCols.push(x);
          if (v === capBgByte || v === arrowByte) capCols.push(x);
        }
        if (arrCols.length > 0) {
          arrowRows.push({
            w: arrCols.length,
            leftGap: arrCols[0] - capCols[0],
            rightGap: capCols.at(-1) - arrCols.at(-1)
          });
        }
      }
      return arrowRows;
    }, { b64: shot.toString("base64"), capBgByte, arrowByte });

    const closedArrowRows = await measureCapSymmetry(await sel.screenshot(), 0xdd, 0x22);
    assert.equal(closedArrowRows.length, 16);
    for (const r of closedArrowRows) assert.equal(r.leftGap, r.rightGap);
    assert.equal(closedArrowRows[6].w, 14);
    assert.equal(closedArrowRows[8].w, 14);

    const w0 = (await sel.boundingBox()).width;
    await sel.selectOption({ index: 1 });
    const w1 = (await sel.boundingBox()).width;
    await sel.selectOption({ index: 2 });
    const w2 = (await sel.boundingBox()).width;
    assert.equal(w0, w1);
    assert.equal(w1, w2);
    await sel.click();
    const openArrowRows = await measureCapSymmetry(await sel.screenshot(), 0x66, 0xff);
    assert.equal(openArrowRows.length, 16);
    for (const r of openArrowRows) assert.equal(r.leftGap, r.rightGap);
    assert.equal(openArrowRows[6].w, 14);
    assert.equal(openArrowRows[8].w, 14);
    const pickerStyle = await sel.evaluate(el => {
      const pcs = getComputedStyle(el, "::picker(select)");
      return {
        open: el.matches(":open"),
        pickerBg: pcs.backgroundColor,
        pickerBorder: pcs.borderTopColor,
        pickerRadius: pcs.borderTopLeftRadius
      };
    });
    assert.equal(pickerStyle.open, true);
    assert.equal(pickerStyle.pickerBg, "rgb(221, 221, 221)");
    assert.equal(pickerStyle.pickerBorder, "rgb(38, 38, 38)");
    assert.equal(pickerStyle.pickerRadius, "0px");
    await page.keyboard.press("Escape");

    // Fractional Windows DPI scaling (125%, 150%, 175%, 225%, 250%) must keep both arrows solid without horizontal seams
    for (const dpr of [1.25, 1.5, 1.75, 2.25, 2.5]) {
      const fp = await browser.newPage({ deviceScaleFactor: dpr });
      await fp.setContent(`<!doctype html><html><body><select id="s" class="pt-select" style="width:140px"><option>One</option></select></body></html>`);
      await fp.addStyleTag({ path: cssPath("platinum") });
      const shot = await fp.locator("#s").screenshot();
      const segs = await fp.evaluate(async b64 => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, img.width, img.height).data;
        const cx = img.width - Math.round(9.5 * window.devicePixelRatio);
        let count = 0, dark = false;
        for (let y = Math.round(4 * window.devicePixelRatio); y < img.height - Math.round(4 * window.devicePixelRatio); y++) {
          const isInk = d[(y * img.width + cx) * 4] < 150;
          if (isInk && !dark) count++;
          dark = isInk;
        }
        return count;
      }, shot.toString("base64"));
      await fp.close();
      assert.equal(segs, 2, `Expected 2 solid triangles without seam at DPR ${dpr}, got ${segs}`);
    }

    // 2. Window 3 interactive listbox (click + keyboard ArrowDown/End) & user input preserved across language switch
    const searchInput = page.locator('[data-i18n-value="searchVal"]');
    await searchInput.fill("custom user query");
    await page.locator('[data-set-lang="zh-CN"]').click();
    assert.equal(await searchInput.inputValue(), "custom user query");
    assert.equal(await sel.getAttribute("aria-label"), "模型提供方");

    const listbox = page.locator("#demo-listbox");
    await listbox.locator("#demo-opt-3").click();
    assert.equal(await listbox.locator("#demo-opt-3").getAttribute("aria-selected"), "true");
    assert.equal(await listbox.locator("#demo-opt-1").getAttribute("aria-selected"), "false");
    const opt3Colors = await listbox.locator("#demo-opt-3").evaluate(el => ({
      rowFg: getComputedStyle(el).color,
      metaFg: getComputedStyle(el.querySelector(".demo-list-meta")).color
    }));
    assert.equal(opt3Colors.metaFg, opt3Colors.rowFg);
    await page.keyboard.press("End");
    assert.equal(await listbox.locator("#demo-opt-7").getAttribute("aria-selected"), "true");

    // 3. Direct .check() on .pt-switch-input (#toggle-inactive) & narrow 320px swatch non-overflow
    await page.locator("#toggle-inactive").check();
    assert.equal(await page.locator("#demo-windows > .pt-window").first().getAttribute("data-inactive"), "true");
    await page.locator("#toggle-inactive").uncheck();
    await page.setViewportSize({ width: 320, height: 700 });
    const swatchOverflow = await page.evaluate(() =>
      [...document.querySelectorAll(".swatch-card")].some(c => c.scrollWidth > c.clientWidth + 1)
    );
    assert.equal(swatchOverflow, false);

    // 4. Strict platinum-scoped.css isolation + nested dark->light+lavender @scope + [hidden] + prose pressed link + disabled marks
    const p2 = await browser.newPage();
    t.after(() => p2.close());
    await p2.setContent(`<!doctype html>
      <html data-platinum-scheme="dark" data-platinum-controls="win">
      <body>
        <div id="out-win" class="pt-window"><button id="out-tbox" class="pt-tbox pt-tbox-close"></button></div>
        <section id="mount-root" class="pt-window" data-platinum data-platinum-scheme="dark" data-platinum-accent="lavender" data-platinum-density="comfortable">
          <section id="nested-bare-mount" data-platinum><button class="pt-btn">Sub</button></section>
          <div id="inner-light" data-platinum-scheme="light">
            <div class="pt-prose">
              <a id="prose-btn" href="#x" class="pt-btn" aria-pressed="true">Act</a>
              <div id="hid-code-head" class="pt-code-window-head" hidden>sh</div>
            </div>
            <input id="dis-chk" type="checkbox" class="pt-checkbox" checked disabled />
            <input id="hid-chk" type="checkbox" class="pt-checkbox" hidden />
            <button id="hid-mi" class="pt-menu-item" hidden>Hidden Item</button>
            <button id="btn-hid-kbd" class="pt-btn">Save<kbd id="hid-kbd" hidden>Esc</kbd></button>
            <label id="rtl-sw" class="pt-switch" dir="rtl" style="width:160px;justify-content:space-between">
              <input id="rtl-sw-in" type="checkbox" class="pt-switch-input" />
              <span id="rtl-sw-tr" class="pt-switch-track"></span>
              <span>RTL</span>
            </label>
            <span id="hid-sw-tr" class="pt-switch-track" hidden></span>
            <input id="aria-dis-field" class="pt-field" aria-disabled="true" value="Readonly" />
            <select id="dis-sel" class="pt-select" disabled><option>Disabled</option></select>
            <select id="aria-dis-sel" class="pt-select" aria-disabled="true"><option>Aria Disabled</option></select>
            <select id="dis-multi" class="pt-select" multiple disabled><option>A</option><option>B</option></select>
            <select id="sel-01" class="pt-select" size="01"><option>One</option><option>Two</option></select>
            <select id="sel-oops" class="pt-select" size="oops"><option>One</option><option>Two</option></select>
            <select id="sel-m1" class="pt-select" multiple size="1"><option>One</option><option>Two</option></select>
            <select id="multi-sel" class="pt-select" multiple><option>A</option><option>B</option><option>C</option></select>
            <select id="listbox-3" class="pt-select" size="3"><option selected>Alpha</option><option>Beta</option><option>Gamma</option></select>
            <button id="after-lb" class="pt-btn">After</button>
          </div>
        </section>
        <select id="self-mount-sel" data-platinum><option>Self</option></select>
        <input id="self-mount-rng" type="range" data-platinum value="40" />
      </body></html>`);
    await p2.addStyleTag({ path: cssPath("platinum-scoped") });

    // Unfocused listbox selection must produce a visible pixel change when moving from row 0 to row 1
    await p2.locator("#after-lb").focus();
    const lbBefore = await p2.locator("#listbox-3").screenshot();
    await p2.locator("#listbox-3").selectOption({ index: 1 });
    await p2.locator("#after-lb").focus();
    const lbAfter = await p2.locator("#listbox-3").screenshot();
    assert.notDeepEqual(lbBefore, lbAfter);

    // Focusable aria-disabled field must show a keyboard focus outline
    await p2.locator("#aria-dis-field").focus();
    await p2.keyboard.press("Shift+Tab");
    await p2.keyboard.press("Tab");

    const audit = await p2.evaluate(() => {
      const cs = id => getComputedStyle(document.getElementById(id));
      const rect = id => document.getElementById(id).getBoundingClientRect();
      const swIn = rect("rtl-sw-in"), swTr = rect("rtl-sw-tr");
      return {
        htmlOrder: getComputedStyle(document.documentElement).getPropertyValue("--pt-tb-order-close").trim(),
        outWinBg: cs("out-win").backgroundColor,
        mountWinBg: cs("mount-root").backgroundColor,
        mountAccent: cs("mount-root").getPropertyValue("--pt-accent").trim(),
        nestedBareWin: cs("nested-bare-mount").getPropertyValue("--pt-window").trim(),
        nestedBareAccent: cs("nested-bare-mount").getPropertyValue("--pt-accent").trim(),
        nestedBareCtrlH: cs("nested-bare-mount").getPropertyValue("--pt-control-h").trim(),
        innerLightWin: cs("inner-light").getPropertyValue("--pt-window").trim(),
        innerLightAccent: cs("inner-light").getPropertyValue("--pt-accent").trim(),
        proseBtnFg: cs("prose-btn").color,
        proseBtnBg: cs("prose-btn").backgroundColor,
        disChkMark: getComputedStyle(document.getElementById("dis-chk"), "::after").borderLeftColor,
        disChkBg: cs("dis-chk").backgroundColor,
        disSel: [cs("dis-sel").backgroundColor, cs("dis-sel").boxShadow, cs("dis-sel").cursor],
        ariaDisSel: [cs("aria-dis-sel").backgroundColor, cs("aria-dis-sel").boxShadow, cs("aria-dis-sel").cursor],
        disMulti: [cs("dis-multi").backgroundColor, cs("dis-multi").boxShadow, cs("dis-multi").cursor],
        ariaFieldOutline: cs("aria-dis-field").outlineStyle,
        sel01H: rect("sel-01").height,
        selOopsH: rect("sel-oops").height,
        selM1H: rect("sel-m1").height,
        rtlOverlap: Math.max(0, Math.min(swIn.right, swTr.right) - Math.max(swIn.left, swTr.left)),
        hidChkH: rect("hid-chk").height,
        hidMiH: rect("hid-mi").height,
        hidKbdW: rect("hid-kbd").width,
        hidCodeH: rect("hid-code-head").height,
        hidSwTrH: rect("hid-sw-tr").height,
        selfSelApp: cs("self-mount-sel").appearance,
        selfRngApp: cs("self-mount-rng").appearance,
        multiSelH: rect("multi-sel").height
      };
    });
    assert.equal(audit.htmlOrder, "");
    assert.equal(audit.outWinBg, "rgba(0, 0, 0, 0)");
    assert.equal(audit.mountWinBg, "rgb(44, 44, 44)");
    assert.equal(audit.mountAccent, "#b3b3ff");
    assert.equal(audit.nestedBareWin, "#2c2c2c");
    assert.equal(audit.nestedBareAccent, "#b3b3ff");
    assert.equal(audit.nestedBareCtrlH, "32px");
    assert.equal(audit.innerLightWin, "#cccccc");
    assert.equal(audit.innerLightAccent, "#333399");
    assert.equal(audit.proseBtnFg, "rgb(255, 255, 255)");
    assert.equal(audit.proseBtnBg, "rgb(102, 102, 102)");
    assert.equal(audit.disChkMark, "rgb(77, 77, 77)");
    assert.equal(audit.disChkBg, "rgb(204, 204, 204)");
    assert.deepEqual(audit.disSel, ["rgb(204, 204, 204)", "none", "not-allowed"]);
    assert.deepEqual(audit.ariaDisSel, ["rgb(204, 204, 204)", "none", "not-allowed"]);
    assert.deepEqual(audit.disMulti, ["rgb(204, 204, 204)", "none", "not-allowed"]);
    assert.equal(audit.ariaFieldOutline, "solid");
    assert.ok(audit.sel01H <= 34);
    assert.ok(audit.selOopsH <= 34);
    assert.ok(audit.selM1H <= 34);
    assert.ok(audit.rtlOverlap >= 24);
    assert.equal(audit.hidChkH, 0);
    assert.equal(audit.hidMiH, 0);
    assert.equal(audit.hidKbdW, 0);
    assert.equal(audit.hidCodeH, 0);
    assert.equal(audit.hidSwTrH, 0);
    assert.equal(audit.selfSelApp, "base-select");
    assert.equal(audit.selfRngApp, "none");
    assert.ok(audit.multiSelH >= 60);

    // 5. Electron <main data-window-focused="false">, nested active child .pt-window, and pre-@scope single-layer fallback
    const pFocus = await browser.newPage();
    t.after(() => pFocus.close());
    await pFocus.setContent(`<!doctype html><html data-platinum><body>
      <main id="elec-shell" data-window-focused="false">
        <header id="elec-tb" class="pt-titlebar pt-titlebar--draggable">
          <button id="elec-close" class="pt-tbox pt-tbox-close"></button>
          <span class="pt-titlebar-label">Electron Shell</span>
        </header>
      </main>
      <div id="outer-inact" class="pt-window" data-window-focused="false">
        <header id="outer-tb" class="pt-titlebar"><span class="pt-titlebar-label">Outer</span></header>
        <div class="pt-window-body">
          <div id="inner-act" class="pt-window">
            <header id="inner-tb" class="pt-titlebar"><span class="pt-titlebar-label">Inner Active</span></header>
          </div>
        </div>
      </div>
      <div id="dark-island" data-platinum-scheme="dark"></div>
    </body></html>`);
    await pFocus.addStyleTag({ path: cssPath("platinum") });
    const focusAudit = await pFocus.evaluate(() => ({
      elecStripes: getComputedStyle(document.getElementById("elec-tb")).backgroundImage,
      elecCloseVis: getComputedStyle(document.getElementById("elec-close")).visibility,
      outerStripes: getComputedStyle(document.getElementById("outer-tb")).backgroundImage,
      innerStripes: getComputedStyle(document.getElementById("inner-tb")).backgroundImage
    }));
    assert.equal(focusAudit.elecStripes, "none");
    assert.equal(focusAudit.elecCloseVis, "hidden");
    assert.equal(focusAudit.outerStripes, "none");
    assert.notEqual(focusAudit.innerStripes, "none");

    // Simulate pre-@scope engine by stripping CSSScopeRule instances from CSSOM
    const fallbackAudit = await pFocus.evaluate(() => {
      const purgeScopes = list => {
        for (let i = list.length - 1; i >= 0; i--) {
          const r = list[i];
          if (r.constructor.name === "CSSScopeRule") list.deleteRule(i);
          else if (r.cssRules) purgeScopes(r.cssRules);
        }
      };
      for (const sheet of document.styleSheets) purgeScopes(sheet);
      return {
        darkWin: getComputedStyle(document.getElementById("dark-island")).getPropertyValue("--pt-window").trim(),
        outerStripes: getComputedStyle(document.getElementById("outer-tb")).backgroundImage
      };
    });
    assert.equal(fallbackAudit.darkWin, "#2c2c2c");
    assert.equal(fallbackAudit.outerStripes, "none");

    // 6. Forced-colors radio dot stays distinguishable between unchecked and checked
    const p3 = await browser.newPage();
    t.after(() => p3.close());
    await p3.emulateMedia({ forcedColors: "active" });
    await p3.setContent(`<!doctype html><div data-platinum><input id="r" type="radio" class="pt-radio"></div>`);
    await p3.addStyleTag({ path: cssPath("platinum") });
    const offPng = await p3.locator("#r").screenshot();
    await p3.locator("#r").check();
    const onPng = await p3.locator("#r").screenshot();
    assert.notDeepEqual(offPng, onPng);
  });
});
