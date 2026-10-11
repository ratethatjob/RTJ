// Checks that every message namespace used by a client component is passed to the
// NextIntlClientProvider of the layout it renders under (pickMessages in the root, app/,
// business/ and admin/ layouts). Follows imports from every page and layout.
// Usage: node scripts/check-client-messages.mjs  (exits 1 when something is missing)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const exts = [".tsx", ".ts", "/index.tsx", "/index.ts"];

function resolve(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(root, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const e of ["", ...exts]) if (fs.existsSync(base + e) && fs.statSync(base + e).isFile()) return base + e;
  return null;
}

const cache = new Map();
function info(file) {
  if (cache.has(file)) return cache.get(file);
  const src = fs.readFileSync(file, "utf8");
  const imports = [...src.matchAll(/(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)]
    .map((m) => resolve(file, m[1] ?? m[2]))
    .filter(Boolean);
  const namespaces = [...src.matchAll(/useTranslations\(\s*["'`]([\w.]+)["'`]/g)].map((m) => m[1].split(".")[0]);
  const r = { client: /^\s*["']use client["']/.test(src), imports, namespaces };
  cache.set(file, r);
  return r;
}

const SHARED = (fs.readFileSync(path.join(root, "lib/client-messages.ts"), "utf8").match(/SHARED_CLIENT_NAMESPACES = \[([^\]]*)\]/)?.[1] ?? "")
  .match(/"(\w+)"/g).map((s) => s.slice(1, -1));

function providerFor(dir) {
  // Closest layout (from the page up to app/[locale]) that calls pickMessages.
  let d = dir;
  while (d.startsWith(path.join(root, "app"))) {
    const layout = path.join(d, "layout.tsx");
    if (fs.existsSync(layout)) {
      const src = fs.readFileSync(layout, "utf8");
      const m = src.match(/pickMessages\(\s*(\[[\s\S]*?\]|SHARED_CLIENT_NAMESPACES)\s*\)/);
      if (m) {
        const list = m[1] === "SHARED_CLIENT_NAMESPACES" ? [] : (m[1].match(/"(\w+)"/g) ?? []).map((s) => s.slice(1, -1));
        return { layout: path.relative(root, layout), namespaces: new Set([...SHARED, ...list]) };
      }
    }
    d = path.dirname(d);
  }
  return null;
}

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/^(page|layout|not-found|error|loading|template)\.tsx$/.test(f)) out.push(p);
  }
  return out;
}

const problems = new Map();
for (const entry of walk(path.join(root, "app"))) {
  const provider = providerFor(path.dirname(entry));
  if (!provider) continue;
  const seen = new Set();
  const visit = (file, inClient) => {
    const key = file + inClient;
    if (seen.has(key)) return;
    seen.add(key);
    const i = info(file);
    const client = inClient || i.client;
    if (client) {
      for (const ns of i.namespaces) {
        if (!provider.namespaces.has(ns)) {
          const k = `${provider.layout}: "${ns}" (${path.relative(root, file)})`;
          problems.set(k, (problems.get(k) ?? new Set()).add(path.relative(root, entry)));
        }
      }
    }
    for (const dep of i.imports) if (/\.tsx?$/.test(dep) && !dep.includes("node_modules")) visit(dep, client);
  };
  visit(entry, false);
}

if (problems.size) {
  console.log("Missing client message namespaces:");
  for (const [k, pages] of problems) console.log(`- ${k}\n    used on: ${[...pages].slice(0, 3).join(", ")}${pages.size > 3 ? " …" : ""}`);
  process.exit(1);
}
console.log("All client message namespaces are provided.");
