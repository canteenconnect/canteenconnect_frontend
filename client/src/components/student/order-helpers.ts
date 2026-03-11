export const ORDER_STATUSES = [
  "pending",
  "preparing",
  "ready",
  "completed",
] as const;

export function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getStatusBadgeClass(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "preparing":
      return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    case "ready":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "completed":
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    case "cancelled":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }
}

export function getTimelineStep(status: string) {
  const index = ORDER_STATUSES.indexOf(status as (typeof ORDER_STATUSES)[number]);
  return index >= 0 ? index : 0;
}
