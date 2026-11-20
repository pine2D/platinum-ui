#!/usr/bin/env node
// Syncs a zero-dependency standalone CSS bundle into a zero-build project (MV3 extension, static HTML)
// with a deterministic version + SHA-256 provenance header for drift verification.
//
// Usage:
//   node bin/sync-vendor.mjs --target <dir-or-css-file> [--bundle full|scoped|core|tokens] [--check]

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const BUNDLE_FILES = Object.freeze({
  full: "platinum.css",
  scoped: "platinum-scoped.css",
  core: "platinum-core.css",
  tokens: "platinum-tokens.css"
});

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function stampBundleContent(body, { version, bundle }) {
  const normalized = body.replace(/\r\n/g, "\n");
  const digest = sha256(normalized);
  const header = `/* @platinum-ui v${version} | bundle:${bundle} | sha256:${digest} — DO NOT HAND-EDIT; sync via platinum-sync */\n`;
  return { stamped: header + normalized, digest };
}

export function parseStampedBundle(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const firstNewline = normalized.indexOf("\n");
  if (firstNewline < 0) return null;
  const header = normalized.slice(0, firstNewline);
  const match = /^\/\* @platinum-ui v([0-9]+\.[0-9]+\.[0-9]+) \| bundle:(full|scoped|core|tokens) \| sha256:([0-9a-f]{64}) /.exec(header);
  if (!match) return null;
  const body = normalized.slice(firstNewline + 1);
  return {
    version: match[1],
    bundle: match[2],
    declaredSha256: match[3],
    actualSha256: sha256(body),
    body
  };
}

export function syncVendor({ target, bundle = "scoped", check = false, root = ROOT }) {
  if (!Object.prototype.hasOwnProperty.call(BUNDLE_FILES, bundle)) {
    throw new Error(`Unknown --bundle "${bundle}" (expected one of: ${Object.keys(BUNDLE_FILES).join(", ")})`);
  }
  if (!target) {
    throw new Error("Missing required --target <dir-or-css-file>");
  }
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const fileName = BUNDLE_FILES[bundle];
  const srcPath = join(root, "dist", fileName);
  if (!existsSync(srcPath)) {
    throw new Error(`Missing built bundle ${srcPath}; run "npm run build" first`);
  }
  const body = readFileSync(srcPath, "utf8");
  const { stamped, digest } = stampBundleContent(body, { version: pkg.version, bundle });

  const resolvedTarget = resolve(target);
  const destPath = (existsSync(resolvedTarget) && statSync(resolvedTarget).isDirectory()) || (!existsSync(resolvedTarget) && !resolvedTarget.endsWith(".css"))
    ? join(resolvedTarget, fileName)
    : resolvedTarget;

  if (check) {
    if (!existsSync(destPath)) {
      return { ok: false, destPath, reason: `Target file does not exist: ${destPath}` };
    }
    const existing = readFileSync(destPath, "utf8");
    const parsed = parseStampedBundle(existing);
    if (!parsed) {
      return { ok: false, destPath, reason: `Missing or malformed @platinum-ui provenance header in ${destPath}` };
    }
    if (parsed.actualSha256 !== parsed.declaredSha256) {
      return { ok: false, destPath, reason: `Hand-edit detected in ${destPath}: body sha256 ${parsed.actualSha256.slice(0, 12)} != header ${parsed.declaredSha256.slice(0, 12)}` };
    }
    if (parsed.actualSha256 !== digest || parsed.bundle !== bundle) {
      return { ok: false, destPath, reason: `Outdated bundle in ${destPath} (found v${parsed.version} ${parsed.bundle} ${parsed.actualSha256.slice(0, 12)}, expected v${pkg.version} ${bundle} ${digest.slice(0, 12)})` };
    }
    return { ok: true, destPath, version: pkg.version, bundle, digest };
  }

  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, stamped, "utf8");
  return { ok: true, destPath, version: pkg.version, bundle, digest };
}

function main() {
  const argv = process.argv.slice(2);
  const getOpt = (flag) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const target = getOpt("--target");
  const bundle = getOpt("--bundle") || "scoped";
  const check = argv.includes("--check");

  try {
    const res = syncVendor({ target, bundle, check });
    if (!res.ok) {
      console.error(`[platinum-sync] FAIL — ${res.reason}`);
      process.exit(1);
    }
    console.log(`[platinum-sync] ${check ? "VERIFIED" : "SYNCED"} v${res.version} (${res.bundle}, sha256:${res.digest.slice(0, 12)}) -> ${res.destPath}`);
  } catch (err) {
    console.error(`[platinum-sync] ERROR — ${err.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
