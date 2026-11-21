// CI smoke test for the staged site's links, assets, and project-relative URLs.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { resolvePlaywright } from "../bin/platinum-check.mjs";

const root = resolve(process.argv[2] || "_site");
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname.replace(/^\/platinum-ui(?=\/)/, "");
  const file = resolve(root, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
  try {
    assert.ok(file.startsWith(`${root}${sep}`));
    const content = readFileSync(file);
    const mime = file.endsWith(".css") ? "text/css" : file.endsWith(".js") || file.endsWith(".mjs") ? "text/javascript" : file.endsWith(".html") ? "text/html" : file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "application/octet-stream";
    response.writeHead(200, { "Content-Type": mime });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  const playwright = resolvePlaywright();
  assert.ok(playwright, "Staged site checks require Playwright");
  browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", request => errors.push(`${request.failure()?.errorText} ${request.url()}`));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const prefix of ["", "/platinum-ui"]) {
    for (const gallery of ["/", "/gallery/"]) {
      for (const query of ["", "?lang=zh-CN"]) {
        await page.goto(`${origin}${prefix}${gallery}${query}`);
        assert.ok(await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.length > 0 && links.every(link => link.sheet)), "Gallery CSS must load");
        const reference = page.locator("#reference-link");
        assert.equal(await reference.count(), 1);
        const href = await reference.evaluate(link => link.href);
        assert.equal(new URL(href).pathname, `${prefix}/gallery/reference/index.html`);
        if (query) assert.equal(new URL(href).searchParams.get("lang"), "zh-CN");
        const response = await page.goto(href);
        assert.equal(response.status(), 200);
        assert.ok(await page.locator("#samples article").count() > 0, "Reference samples must be present");
        for (const mode of ["original", "actual", "overlay", "difference"]) {
          await page.locator(`[data-mode="${mode}"]`).click();
          await page.waitForFunction(() => {
            const items = [...document.querySelectorAll(".stage img, .stage iframe")];
            return items.length > 0 && items.every(item => item.tagName === "IMG"
              ? item.complete && item.naturalWidth > 0
              : item.contentDocument?.querySelector("#specimen[data-ready]"));
          });
        }
        for (const preview of await page.locator('#samples a[href*="rendered/"]').evaluateAll(links => links.map(link => link.href))) {
          assert.equal((await page.request.get(preview)).status(), 200, `Committed preview missing: ${preview}`);
        }
      }
    }
  }
  assert.deepEqual(errors, [], "Staged pages must load without missing assets or script errors");
  console.log("Staged root/gallery links and reference pages passed at root and /platinum-ui/");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
