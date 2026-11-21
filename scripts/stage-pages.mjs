// CI publishing layout; all URLs remain relative to the deployed project path.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.argv[2] || "_site");
mkdirSync(target, { recursive: true });
writeFileSync(`${target}/.nojekyll`, "");
cpSync("dist", `${target}/dist`, { recursive: true });
cpSync("gallery", `${target}/gallery`, { recursive: true });
const html = readFileSync("gallery/index.html", "utf8")
  .replaceAll("../dist/", "./dist/")
  // Covers both the HTML link and localized JavaScript assignments with ?lang=.
  .replaceAll("./reference/index.html", "./gallery/reference/index.html");
writeFileSync(`${target}/index.html`, html);
console.log(`Staged gallery, reference pages, and CSS at ${target}`);
