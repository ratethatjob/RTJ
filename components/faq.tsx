/** Questions and answers as native disclosure widgets (no JS), plus FAQPage data for search. */
export function Faq({ title, items }: { title: string; items: { q: string; a: string }[] }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:gap-12">
      <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{title}</h2>
      <div className="flex flex-col gap-3">
        {items.map((i) => (
          <details key={i.q} className="group rounded-3xl bg-white p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black">
              {i.q}
              <span className="text-2xl transition-transform group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="mt-3 text-slate">{i.a}</p>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    </section>
  );
}
