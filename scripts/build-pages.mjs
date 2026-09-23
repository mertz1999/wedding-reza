import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "pages-dist");

const publicFiles = [
  "styles.css",
  "script.js",
  "invitation-page.js",
  "invitation-data.js",
  "wedding-config.js",
  "src/assets/pink-water-lily-mobile.png",
  "src/assets/white-swan-mobile.png",
  "src/assets/pink-orchid-branch-mobile.png",
  "src/assets/hands-bouquet-cutout-mobile.png",
  "src/assets/swan-lake-background-mobile.jpg",
  "src/assets/wedding-hands-bg-mobile.jpg",
  "src/assets/sokoote-asheghane.mp3",
  "src/fonts/IranNastaliq.ttf",
  "src/fonts/NotoNastaliqUrdu-Variable.ttf",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const relativePath of publicFiles) {
  const destination = join(output, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, relativePath), destination);
}

const sourceHtml = await readFile(join(root, "index.html"), "utf8");
const pagesHtml = sourceHtml.replace(/\s*<base href="\/" \/>\s*/, "\n");

await writeFile(join(output, "index.html"), pagesHtml, "utf8");
await writeFile(join(output, ".nojekyll"), "", "utf8");

console.log(`GitHub Pages artifact created at ${output}`);

