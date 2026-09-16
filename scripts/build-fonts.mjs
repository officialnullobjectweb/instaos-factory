/**
 * Converts the self-hosted woff2 fonts to TTF.
 *
 * Why this script exists: the server-side PNG renderer (resvg) loads fonts
 * through its own fontdb, which supports only sfnt containers (TTF/OTF). A
 * woff2 file registered via `fontFiles` is silently ignored, so every
 * server-rendered slide came out with decoration but **no text** — and, worse,
 * all slides were byte-identical, which is how this was caught.
 *
 * Runs before `next build` and `next dev` (see package.json). Output is
 * deterministic and git-ignored; `designAssets()` reads the TTFs when present
 * and falls back to the woff2s for anything else that can parse them.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import wawoff2 from "wawoff2";

const FONTS_DIR = path.join(process.cwd(), "src", "design", "fonts");
const TTF_DIR = path.join(FONTS_DIR, "ttf");

async function main() {
  const files = (await fs.readdir(FONTS_DIR)).filter((f) => f.endsWith(".woff2"));

  await fs.mkdir(TTF_DIR, { recursive: true });

  let converted = 0;
  let skipped = 0;
  for (const file of files) {
    const source = path.join(FONTS_DIR, file);
    const target = path.join(TTF_DIR, file.replace(/\.woff2$/, ".ttf"));

    // Skip when the TTF is newer than its woff2 source (incremental dev runs).
    try {
      const [srcStat, outStat] = await Promise.all([fs.stat(source), fs.stat(target)]);
      if (outStat.mtimeMs > srcStat.mtimeMs) {
        skipped += 1;
        continue;
      }
    } catch {
      // target missing — convert below
    }

    const woff2 = await fs.readFile(source);
    const ttf = Buffer.from(await wawoff2.decompress(woff2));
    if (ttf.subarray(0, 4).toString("ascii") !== "\x00\x01\x00\x00") {
      throw new Error(`${file}: decompression did not produce a valid TTF`);
    }
    await fs.writeFile(target, ttf);
    converted += 1;
  }

  console.log(
    `[build-fonts] ${converted} converted, ${skipped} up-to-date → ${path.relative(process.cwd(), TTF_DIR)}`,
  );
}

main().catch((error) => {
  console.error("[build-fonts] FAILED:", error.message);
  process.exit(1);
});
