import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Link } from "@/i18n/navigation";
import { OPERATOR } from "./site-config";

// Minimal Markdown for the legal pages: headings, paragraphs, lists, **bold**, [links](url).
// {{name}} placeholders are filled from OPERATOR.

export async function readLegal(slug: string, locale: string) {
  "use cache";
  const file = join(process.cwd(), "content/legal", `${slug}.${locale}.md`);
  const text = await readFile(file, "utf8").catch(() => readFile(join(process.cwd(), "content/legal", `${slug}.en.md`), "utf8"));
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => (OPERATOR as Record<string, string>)[key] ?? `{{${key}}}`);
}

function inline(text: string, key: string) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((\S+?)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={`${key}-${i++}`} className="font-black">{m[1]}</strong>);
    else if (m[3].startsWith("/"))
      parts.push(
        <Link key={`${key}-${i++}`} href={m[3]} className="font-black text-ink underline underline-offset-4">
          {m[2]}
        </Link>,
      );
    else
      parts.push(
        <a key={`${key}-${i++}`} href={m[3]} className="font-black text-ink underline underline-offset-4">
          {m[2]}
        </a>,
      );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-4 text-lg leading-relaxed">
      {blocks.map((block, b) => {
        const key = `b${b}`;
        if (block.startsWith("### ")) return <h3 key={key} className="mt-2 text-xl font-black">{inline(block.slice(4), key)}</h3>;
        if (block.startsWith("## ")) return <h2 key={key} className="mt-6 text-2xl font-black tracking-brand">{inline(block.slice(3), key)}</h2>;
        if (block.startsWith("# ")) return <h1 key={key} className="text-4xl font-black tracking-brand lg:text-5xl">{inline(block.slice(2), key)}</h1>;
        const lines = block.split("\n");
        if (lines.every((l) => /^- /.test(l))) {
          return (
            <ul key={key} className="flex list-disc flex-col gap-1.5 pl-6">
              {lines.map((l, i) => <li key={i}>{inline(l.slice(2), `${key}-${i}`)}</li>)}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\. /.test(l))) {
          return (
            <ol key={key} className="flex list-decimal flex-col gap-1.5 pl-6">
              {lines.map((l, i) => <li key={i}>{inline(l.replace(/^\d+\. /, ""), `${key}-${i}`)}</li>)}
            </ol>
          );
        }
        return <p key={key} className="text-slate">{inline(lines.join(" "), key)}</p>;
      })}
    </div>
  );
}
