import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Archivo 500/900 (latin + latin-ext for Hungarian accents) for next/og images.
export async function archivoFonts() {
  const file = (name: string) => readFile(join(process.cwd(), "assets/fonts", name));
  const [l5, l9, e5, e9] = await Promise.all([
    file("archivo-latin-500-normal.woff"),
    file("archivo-latin-900-normal.woff"),
    file("archivo-latin-ext-500-normal.woff"),
    file("archivo-latin-ext-900-normal.woff"),
  ]);
  return [
    { name: "Archivo", data: l5, weight: 500 as const, style: "normal" as const },
    { name: "Archivo", data: l9, weight: 900 as const, style: "normal" as const },
    { name: "Archivo", data: e5, weight: 500 as const, style: "normal" as const },
    { name: "Archivo", data: e9, weight: 900 as const, style: "normal" as const },
  ];
}
