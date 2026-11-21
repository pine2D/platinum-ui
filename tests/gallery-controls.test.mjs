import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolvePlaywright } from "../bin/platinum-check.mjs";

const playwright = resolvePlaywright();
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

  it("paints three grip ridges across each scrollbar in all styled bundles", async t => {
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
        function hasThreeRidges({ data }) {
          const red = data.filter((_, i) => i % 4 === 0);
          for (let i = 0; i + 5 < red.length; i++) {
            const highlight = Math.min(red[i], red[i + 2], red[i + 4]);
            const shadow = Math.max(red[i + 1], red[i + 3], red[i + 5]);
            if (highlight - shadow > 40) return true;
          }
          return false;
        }
        return {
          horizontal: hasThreeRidges(ctx.getImageData(0, image.height - 8, image.width, 1)),
          vertical: hasThreeRidges(ctx.getImageData(image.width - 8, 0, 1, image.height))
        };
      }, png.toString("base64"));
      assert.deepEqual(grips, { horizontal: true, vertical: true }, bundle);
    }
  });
});
