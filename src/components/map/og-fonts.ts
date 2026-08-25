import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Raster at 2× so social cards and downloads stay sharp. */
export const OG_SCALE = 2;
export const px = (n: number) => n * OG_SCALE;

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]> | null =
  null;

export function loadOgFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/DMSans-Regular.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/DMSans-Bold.ttf")),
  ]).then(([regular, bold]) => [
    { name: "DM Sans", data: regular, weight: 400, style: "normal" },
    { name: "DM Sans", data: bold, weight: 700, style: "normal" },
  ]);
  return fonts;
}

export const OG_SIZE = { width: px(1200), height: px(630) };
