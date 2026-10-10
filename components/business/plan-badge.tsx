import type { PlanState } from "@/lib/business";

export function PlanBadge({ plan, label }: { plan: PlanState; label: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-sm font-black ${
        plan === "pro" ? "bg-signal" : plan === "trial" ? "bg-ink text-paper" : "border border-mist"
      }`}
    >
      {label}
    </span>
  );
}
