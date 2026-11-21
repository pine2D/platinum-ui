import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolvePlaywright } from "../bin/platinum-check.mjs";

const playwright = resolvePlaywright();
const gallery = new URL("../gallery/index.html", import.meta.url);
const focused = locator => locator.evaluate(el => el === document.activeElement);

describe("Gallery window actions in Chromium", { skip: !playwright && "Playwright unavailable" }, () => {
  let browser;
  before(async () => { browser = await playwright.chromium.launch(); });
  after(async () => { await browser?.close(); });

  async function open(t, lang = "en") {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.goto(gallery.href + `?lang=${lang}`);
    return page;
  }

  it("closes every panel including appearance, and recovers all windows by keyboard", async t => {
    const page = await open(t);
    const windows = page.locator(".gallery-shell .pt-window");
    const restore = page.locator("#restore-windows-btn");
    const reset = page.locator("#reset-layout-btn");
    assert.equal(await restore.isVisible(), false);
    assert.equal(await reset.locator("xpath=ancestor::*[contains(@class, 'pt-window')]").count(), 0);
    for (let i = 0; i < await windows.count(); i++) {
      const win = windows.nth(i);
      await win.locator('[data-win-action="close"]').press("Enter");
      assert.equal(await win.isVisible(), false);
      assert.equal(await focused(restore), true);
    }
    assert.equal(await page.locator(".gallery-shell .pt-window:visible").count(), 0);
    await page.keyboard.press("Tab");
    assert.equal(await focused(reset), true);
    await page.keyboard.press("Shift+Tab");
    assert.equal(await focused(restore), true);
    await page.keyboard.press("Space");
    assert.equal(await page.locator(".gallery-shell .pt-window:visible").count(), await windows.count());
    assert.equal(await restore.isVisible(), false);
    assert.equal(await focused(windows.first().locator('[data-win-action="close"]')), true);
  });

  for (const preset of ["macos", "win"]) {
    it(`restores keyboard focus into an inactive window after ${preset} changes to mac9`, async t => {
      const page = await open(t);
      await page.locator(`[data-set-controls="${preset}"]`).click();
      await page.locator("#toggle-inactive").press("Space");
      const win = page.locator("#demo-windows > .pt-window").first();
      await win.locator('[data-win-action="close"]').press("Enter");
      await page.locator('[data-set-controls="mac9"]').click();
      await page.locator("#restore-windows-btn").press("Enter");
      assert.equal(await win.isVisible(), true);
      assert.equal(await win.locator('[data-win-action="close"]').isVisible(), false);
      const titlebar = win.locator(".pt-titlebar");
      assert.equal(await focused(titlebar), true);
      assert.equal(await titlebar.isVisible(), true);
      assert.equal(await titlebar.getAttribute("tabindex"), "-1");
      await page.keyboard.press("Tab");
      assert.equal(await focused(win.getByRole("button", { name: "Save Default", exact: true })), true);
    });
  }

  it("restores only closed windows while retaining independent shade and zoom states", async t => {
    const page = await open(t);
    const windows = page.locator("#demo-windows > .pt-window");
    const shaded = windows.nth(0);
    const zoomed = windows.nth(1);
    await shaded.locator('[data-win-action="collapse"]').click();
    await shaded.locator('[data-win-action="close"]').click();
    await zoomed.locator('[data-win-action="zoom"]').click();
    await windows.nth(2).locator('[data-win-action="close"]').click();
    await page.locator("#restore-windows-btn").press("Enter");
    assert.equal(await shaded.getAttribute("data-collapsed"), "true");
    assert.equal(await zoomed.getAttribute("data-maximized"), "true");
    assert.equal(await zoomed.locator('[data-win-action="zoom"]').getAttribute("aria-pressed"), "true");
    await zoomed.locator('[data-win-action="close"]').click();
    await page.locator("#restore-windows-btn").click();
    assert.equal(await zoomed.getAttribute("data-maximized"), "true");
    await zoomed.locator('[data-win-action="zoom"]').click();
    assert.equal(await zoomed.getAttribute("data-maximized"), null);
  });

  it("resets the complete layout without changing chosen appearance settings", async t => {
    const page = await open(t);
    await page.locator('[data-set-scheme="dark"]').click();
    const windows = page.locator(".gallery-shell .pt-window");
    await windows.nth(1).locator('[data-win-action="collapse"]').click();
    await windows.nth(2).locator('[data-win-action="zoom"]').click();
    await windows.first().locator('[data-win-action="close"]').click();
    const reset = page.locator("#reset-layout-btn");
    await reset.press("Enter");
    assert.equal(await focused(reset), true);
    assert.deepEqual(await windows.evaluateAll(items => items.map(win => [win.hidden, win.dataset.collapsed, win.dataset.maximized, win.dataset.closed, win.dataset.minimized])), Array(await windows.count()).fill([false, undefined, undefined, undefined, undefined]));
    assert.equal(await page.locator("html").getAttribute("data-platinum-scheme"), "dark");
    assert.equal(await page.locator("#restore-windows-btn").isVisible(), false);
  });

  it("shades in place with localized expanded state and a language-aware reference link", async t => {
    const page = await open(t);
    const win = page.locator("#demo-windows > .pt-window").first();
    const shade = win.locator('[data-win-action="collapse"]');
    assert.match(await shade.getAttribute("aria-label"), /^Shade window:/);
    assert.equal(await shade.getAttribute("aria-expanded"), "true");
    await shade.press("Enter");
    assert.equal(await win.isVisible(), true);
    assert.equal(await win.locator(".pt-window-body").isVisible(), false);
    assert.equal(await shade.getAttribute("aria-expanded"), "false");
    assert.match(await shade.getAttribute("aria-label"), /^Unshade window:/);
    await page.locator('[data-set-lang="zh-CN"]').click();
    assert.match(await shade.getAttribute("aria-label"), /^展开窗口：|^展开窗口:/);
    assert.equal(await page.locator("#reference-link").getAttribute("href"), "./reference/index.html?lang=zh-CN");
    assert.equal(await page.locator("#reference-link").textContent(), "Mac OS 9 参考资料");
    await shade.press("Space");
    assert.equal(await win.locator(".pt-window-body").isVisible(), true);
    await page.locator('[data-set-lang="en"]').click();
    assert.equal(await page.locator("#reference-link").getAttribute("href"), "./reference/index.html");
  });

  it("keeps DPR 2 narrow Chinese titles clear of controls and shows dark keyboard focus through recovery", async t => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    t.after(() => page.close());
    await page.goto(gallery.href + "?lang=zh-CN");
    await page.locator('[data-set-scheme="dark"]').click();
    const win = page.locator("#demo-windows > .pt-window").last();
    await win.scrollIntoViewIfNeeded();
    const layout = await win.locator(".pt-titlebar").evaluate(bar => {
      const title = bar.querySelector(".pt-titlebar-label");
      const label = title.getBoundingClientRect();
      const controls = [...bar.querySelectorAll(".pt-tbox")].map(button => button.getBoundingClientRect());
      const style = getComputedStyle(title);
      return { dpr: devicePixelRatio, scroll: document.documentElement.scrollWidth, width: innerWidth,
        title: [label.left, label.right], controls: controls.map(box => [box.left, box.right]),
        overflow: style.overflow, ellipsis: style.textOverflow };
    });
    assert.equal(layout.dpr, 2);
    assert.equal(layout.scroll, layout.width);
    assert.equal(layout.overflow, "hidden");
    assert.equal(layout.ellipsis, "ellipsis");
    for (const [left, right] of layout.controls) assert.ok(right <= layout.title[0] || left >= layout.title[1], "Long title must not overlap a window control");
    const close = win.locator('[data-win-action="close"]');
    await close.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    const focusPaint = locator => locator.evaluate(button => {
      const style = getComputedStyle(button);
      return { visible: button.matches(":focus-visible"), width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
    });
    assert.deepEqual(await focusPaint(close), { visible: true, width: "2px", style: "solid", color: "rgb(142, 192, 255)" });
    await close.press("Enter");
    const restore = page.locator("#restore-windows-btn");
    assert.equal(await focused(restore), true);
    assert.equal((await focusPaint(restore)).visible, true);
    assert.equal((await focusPaint(restore)).width, "2px");
    await restore.press("Space");
    assert.equal(await focused(close), true);
    assert.equal((await focusPaint(close)).visible, true);
    assert.equal(await win.isVisible(), true);
  });

  it("routes real pointer clicks on both sides of adjacent 13px control boundaries", async t => {
    const page = await open(t);
    for (const preset of ["mac9", "macos", "win"]) {
      await page.locator(`[data-set-controls="${preset}"]`).click();
      const header = page.locator("#demo-windows > .pt-window").first().locator(".pt-titlebar");
      await header.scrollIntoViewIfNeeded();
      const boxes = await header.locator(".pt-tbox").evaluateAll(buttons => buttons.map(button => {
        const box = button.getBoundingClientRect();
        return { action: button.dataset.winAction, x: box.x, y: box.y, width: box.width, height: box.height };
      }).sort((a, b) => a.x - b.x));
      await page.evaluate(() => {
        window.boundaryHits = [];
        window.captureBoundary = event => {
          const button = event.target.closest("#demo-windows .pt-tbox");
          if (!button) return;
          window.boundaryHits.push(button.dataset.winAction);
          event.preventDefault();
          event.stopImmediatePropagation();
        };
        document.addEventListener("click", window.captureBoundary, true);
      });
      const expected = [];
      for (let index = 1; index < boxes.length; index++) {
        const left = boxes[index - 1], right = boxes[index];
        assert.equal(left.width, 13);
        if (right.x - left.x > 20) continue;
        assert.equal(right.x - left.x, 18, "Product keeps 18px centers for non-overlapping 18px hit regions");
        const boundary = (left.x + left.width / 2 + right.x + right.width / 2) / 2;
        // Sample one CSS pixel to either side: Chromium rounds fractional pointer
        // coordinates at DPR 1, so half-pixel samples may hit the boundary itself.
        await page.mouse.click(boundary - 1, left.y + left.height / 2);
        await page.mouse.click(boundary + 1, left.y + left.height / 2);
        expected.push(left.action, right.action);
      }
      assert.ok(expected.length >= 2);
      assert.deepEqual(await page.evaluate(() => window.boundaryHits), expected, preset);
      await page.evaluate(() => document.removeEventListener("click", window.captureBoundary, true));
    }
  });

  it("matches the active sample alias to a real held mac9 close and keeps modern close glyphs", async t => {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    t.after(() => page.close());
    await page.goto(gallery.href + "?lang=en");
    const close = page.locator("#demo-windows > .pt-window").first().locator('[data-win-action="close"]');
    const paint = locator => locator.evaluate(button => {
      const style = getComputedStyle(button);
      return { background: style.backgroundImage, color: style.color, glyph: getComputedStyle(button, "::after").content };
    });
    assert.equal((await paint(close)).glyph, "none");
    let sharedDownFace;
    for (const action of ["close", "zoom", "collapse"]) {
      const control = page.locator("#demo-windows > .pt-window").first().locator(`[data-win-action="${action}"]`);
      const raised = await paint(control);
      await control.hover();
      await page.mouse.down();
      const down = await paint(control);
      if (action === "close") assert.equal(down.glyph, "none");
      assert.notEqual(down.background, raised.background);
      assert.equal(down.color, "rgb(255, 255, 255)");
      if (sharedDownFace === undefined) sharedDownFace = down.background;
      else assert.equal(down.background, sharedDownFace, "All mac9 controls share the held surface");
      const real = await control.screenshot();
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await control.evaluate(button => button.classList.add("is-active"));
      assert.deepEqual(await control.screenshot(), real, `${action}: DPR2 active alias must paint exactly the real held control pixels`);
      await control.hover();
      assert.deepEqual(await control.screenshot(), real, `${action}: hover must not alter the active alias`);
      await control.evaluate(button => button.classList.remove("is-active"));
    }
    for (const preset of ["macos", "win"]) {
      await page.locator(`[data-set-controls="${preset}"]`).click();
      assert.equal((await paint(close)).glyph, '\"\"');
    }
  });

  it("uses the nearest explicit nested controls preset and the dark window palette", async t => {
    const page = await browser.newPage();
    t.after(() => page.close());
    const chrome = id => `<section class="pt-window" id="${id}"><header class="pt-titlebar"><button class="pt-tbox pt-tbox-close"></button><button class="pt-tbox pt-tbox-minimize"></button><button class="pt-tbox pt-tbox-zoom"></button><span class="pt-titlebar-label">Nested</span></header></section>`;
    await page.setContent(`<html data-platinum data-platinum-scheme="light" data-platinum-controls="macos"><body>
      ${chrome("outer")}
      <div data-platinum-controls="mac9">${chrome("classic")}<div data-platinum-controls="win" data-platinum-scheme="dark">${chrome("dark-win")}</div></div>
      <div data-platinum-controls="win"><div data-platinum-controls="macos">${chrome("inner-macos")}</div></div>
    </body></html>`);
    await page.addStyleTag({ path: fileURLToPath(new URL("../dist/platinum.css", import.meta.url)) });
    const state = id => page.locator(`#${id} .pt-tbox-close`).evaluate(button => ({
      glyph: getComputedStyle(button, "::after").content,
      order: getComputedStyle(button).order,
      surface: getComputedStyle(button).backgroundColor,
      window: getComputedStyle(button.closest(".pt-window")).backgroundColor
    }));
    assert.equal((await state("outer")).glyph, '\"\"');
    assert.equal((await state("classic")).glyph, "none");
    assert.equal((await state("classic")).order, "1");
    assert.equal((await state("dark-win")).glyph, '\"\"');
    assert.equal((await state("dark-win")).order, "8");
    assert.equal((await state("inner-macos")).order, "1");
    assert.equal((await state("inner-macos")).glyph, '\"\"');
    assert.equal((await state("dark-win")).window, "rgb(44, 44, 44)");
    assert.equal((await state("dark-win")).surface, "rgb(59, 59, 59)");
  });

  for (const preset of ["macos", "win"]) {
    it(`${preset} minimizes out of the workspace and recovers through the real restore action`, async t => {
      const page = await open(t, "zh-CN");
      const windows = page.locator("#demo-windows > .pt-window");
      const win = windows.first();
      await win.locator('[data-win-action="collapse"]').click();
      await page.locator(`[data-set-controls="${preset}"]`).click();
      assert.equal(await win.getAttribute("data-collapsed"), null);
      const minimize = win.locator('[data-win-action="collapse"]');
      assert.equal(await minimize.getAttribute("aria-expanded"), null);
      assert.match(await minimize.getAttribute("aria-label"), /^最小化窗口.*恢复窗口/);
      await win.locator('[data-win-action="zoom"]').click();
      await minimize.press("Enter");
      assert.equal(await win.isVisible(), false);
      assert.equal(await win.getAttribute("data-minimized"), "true");
      const restore = page.getByRole("button", { name: "恢复窗口", exact: true });
      assert.equal(await focused(restore), true);
      for (const nextPreset of [preset, preset === "macos" ? "win" : "macos"]) {
        await page.locator(`[data-set-controls="${nextPreset}"]`).click();
        assert.equal(await win.isVisible(), false, "Modern preset selection must retain minimized windows");
        assert.equal(await win.getAttribute("data-minimized"), "true");
        assert.equal(await restore.isVisible(), true);
      }
      await restore.press("Space");
      assert.equal(await win.isVisible(), true);
      assert.equal(await win.getAttribute("data-maximized"), "true");
      await minimize.click();
      await windows.nth(1).locator('[data-win-action="close"]').click();
      await page.locator('[data-set-controls="mac9"]').click();
      assert.equal(await win.isVisible(), true);
      assert.equal(await windows.nth(1).isVisible(), false);
      assert.equal(await minimize.getAttribute("aria-expanded"), "true");
      // The appearance panel uses the same minimize and recovery behavior.
      await page.locator(`[data-set-controls="${preset}"]`).click();
      const panel = page.locator(".control-banner");
      await panel.locator('[data-win-action="collapse"]').click();
      assert.equal(await panel.isVisible(), false);
      await restore.press("Enter");
      assert.equal(await panel.isVisible(), true);
    });
  }
});
