/** Single-series column chart: one baseline, value labels on hover and in the table below. */
export function BarChart({ bars }: { bars: { label: string; value: number | null; height: number; text: string }[] }) {
  return (
    <figure className="mt-4">
      <div className="flex h-40 items-end gap-1.5 border-b border-mist/60" aria-hidden="true">
        {bars.map((b, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" title={`${b.label}: ${b.text}`}>
            <span className="pointer-events-none absolute -top-1 left-1/2 hidden -translate-x-1/2 -translate-y-full rounded-md bg-ink px-2 py-1 text-xs font-black whitespace-nowrap text-paper group-hover:block">
              {b.label}: {b.text}
            </span>
            {b.value != null && b.height > 0 && (
              <div
                className="rounded-t-[4px] bg-ink group-hover:bg-slate"
                style={{ height: `${Math.max(2, b.height * 100)}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-center text-[11px] text-slate" aria-hidden="true">
        {bars.map((b, i) => (
          <span key={i} className="flex-1 truncate">
            {b.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <tbody>
          {bars.map((b, i) => (
            <tr key={i}>
              <th>{b.label}</th>
              <td>{b.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
