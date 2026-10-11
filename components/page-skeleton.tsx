// Loading placeholder for loading.tsx files: grey blocks in the page's rough shape (no text, so it
// can be prerendered for every language).
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "form" | "dashboard" }) {
  const block = "animate-pulse rounded-3xl bg-[#E8E6E1]";
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="h-10 w-2/3 max-w-md animate-pulse rounded-2xl bg-[#E8E6E1]" />
      <div className="h-5 w-1/2 max-w-sm animate-pulse rounded-xl bg-[#E8E6E1]" />
      {variant === "form" ? (
        <div className="flex max-w-md flex-col gap-3">
          <div className={`h-16 ${block}`} />
          <div className={`h-16 ${block}`} />
          <div className={`h-14 ${block}`} />
        </div>
      ) : variant === "dashboard" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={`h-28 ${block}`} />
          <div className={`h-28 ${block}`} />
          <div className={`h-28 ${block}`} />
          <div className={`h-64 sm:col-span-3 ${block}`} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`h-24 ${block}`} />
          ))}
        </div>
      )}
    </div>
  );
}
