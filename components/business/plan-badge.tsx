export function PlanBadge({ plan, label }: { plan: "free" | "pro"; label: string }) {
  return (
    <span
      className={`rounded-lg px-2.5 py-1 text-sm font-black ${
        plan === "pro" ? "bg-signal" : "border border-mist"
      }`}
    >
      {label}
    </span>
  );
}
