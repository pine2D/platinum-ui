import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const referenceRoot = new URL('../gallery/reference/', import.meta.url);
export const readReference = name => readFileSync(new URL(name, referenceRoot));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function loadSamples() {
  const manifest = JSON.parse(readReference('samples.json'));
  if (!manifest.samples?.length) throw new Error('Reference manifest has no historical samples');
  const ids = new Set();
  for (const sample of manifest.samples) {
    if (ids.has(sample.id)) {
      throw new Error(`Duplicate reference sample: ${sample.id}`);
    }
    ids.add(sample.id);
    if (!/^[a-z0-9-]+$/.test(sample.id)
        || !Number.isInteger(sample.width) || sample.width < 1
        || !Number.isInteger(sample.height) || sample.height < 1) {
      throw new Error('Invalid sample identity or dimensions');
    }
    if (!Array.isArray(sample.crop) || sample.crop.length !== 4
        || !sample.crop.every(Number.isInteger)
        || sample.crop[0] < 0 || sample.crop[1] < 0
        || sample.crop[2] !== sample.width || sample.crop[3] !== sample.height) {
      throw new Error(`${sample.id}: invalid guest-frame crop`);
    }
    sample.regions = [
      ...(sample.regionSets ?? []).flatMap(name => {
        const regions = manifest.regionSets?.[name];
        if (!Array.isArray(regions)) {
          throw new Error(`${sample.id}: unknown region set ${name}`);
        }
        return regions;
      }),
      ...(sample.regions ?? [])
    ];
    for (const region of sample.regions) {
      if (!region.name
          || ![region.x, region.y, region.width, region.height].every(Number.isInteger)
          || region.x < 0 || region.y < 0 || region.width < 1 || region.height < 1
          || region.x + region.width > sample.width
          || region.y + region.height > sample.height) {
        throw new Error(`${sample.id}: invalid region ${region.name}`);
      }
    }
  }
  return manifest;
}
export function sourceDigest() {
  const hash = createHash('sha256');
  // Keep complete saved differences tied to the exact CSS and template they show.
  for (const path of [
    '../dist/platinum.css', '../gallery/reference/samples.json',
    '../gallery/reference/window.html', '../gallery/reference/window.css', '../gallery/reference/window.js',
    '../gallery/reference/content.css', '../gallery/reference/content.js',
    './reference-lib.mjs', './reference-shots.mjs'
  ]) {
    hash.update(path);
    hash.update(readFileSync(new URL(path, import.meta.url)));
  }
  return hash.digest('hex');
}
export async function captureSample(browser, sample, mutate) {
  const page = await browser.newPage({
    viewport: { width: sample.width, height: sample.height },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce'
  });
  try {
    await page.context().setOffline(true);
    const url = new URL('window.html', referenceRoot);
    url.searchParams.set('id', sample.id);
    await page.goto(url.href);
    await page.locator('#specimen[data-ready]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (mutate) await mutate(page);
    const box = await page.locator('#specimen').boundingBox();
    if (box.width !== sample.width || box.height !== sample.height) {
      throw new Error(`${sample.id}: specimen ${box.width}x${box.height}, expected ${sample.width}x${sample.height}`);
    }
    return await page.locator('#specimen').screenshot({ animations: 'disabled', type: 'png' });
  } finally {
    await page.close();
  }
}
// Decode with Chromium itself: no PNG codec or image dependency is required.
export async function compareImages(browser, original, actual, regions = [], originalCrop) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async ({ original, actual, regions, originalCrop }) => {
      async function decode(base64, crop) {
        const image = new Image();
        image.src = 'data:image/png;base64,' + base64;
        await image.decode();
        const [x, y, width, height] = crop ?? [0, 0, image.width, image.height];
        if (x < 0 || y < 0 || width < 1 || height < 1
            || x + width > image.width || y + height > image.height) {
          throw new Error('Guest crop exceeds captured frame');
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
        return { canvas, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height) };
      }
      const a = await decode(original, originalCrop), b = await decode(actual);
      if (a.canvas.width !== b.canvas.width || a.canvas.height !== b.canvas.height) {
        throw new Error('PNG dimensions differ');
      }
      const w = a.canvas.width, h = a.canvas.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d'), output = ctx.createImageData(w, h);
      let changed = 0, absoluteError = 0;
      const mismatch = new Uint8Array(w * h);
      for (let p = 0; p < w * h; p++) {
        let delta = 0;
        for (let c = 0; c < 4; c++) {
          const d = Math.abs(a.pixels.data[p * 4 + c] - b.pixels.data[p * 4 + c]);
          delta = Math.max(delta, d);
          absoluteError += d;
        }
        if (delta) {
          changed++;
          mismatch[p] = 1;
        }
        // Unmasked absolute RGB difference, amplified for one-level errors. Black = exact.
        for (let c = 0; c < 3; c++) {
          const rgb = Math.abs(a.pixels.data[p * 4 + c] - b.pixels.data[p * 4 + c]);
          const alpha = Math.abs(a.pixels.data[p * 4 + 3] - b.pixels.data[p * 4 + 3]);
          output.data[p * 4 + c] = Math.min(255, Math.max(rgb, alpha) * 4);
        }
        output.data[p * 4 + 3] = 255;
      }
      ctx.putImageData(output, 0, 0);
      const report = regions.map(r => {
        let changed = 0;
        for (let y = r.y; y < r.y + r.height; y++) {
          for (let x = r.x; x < r.x + r.width; x++) {
            changed += mismatch[y * w + x];
          }
        }
        return { name: r.name, changed, pixels: r.width * r.height, review: r.mode === 'review' || r.review === true };
      });
      return { changed, pixels: w * h, absoluteError, regions: report, png: canvas.toDataURL('image/png').split(',')[1] };
    }, { original: original.toString('base64'), actual: actual.toString('base64'), regions, originalCrop });
  } finally {
    await page.close();
  }
}
export function strictFailures(report) {
  return report.regions.filter(region => !region.review && region.changed > 0);
}
