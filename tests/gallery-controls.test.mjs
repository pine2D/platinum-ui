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
});
