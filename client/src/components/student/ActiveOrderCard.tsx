import { Clock3, Package, CheckCircle2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyINR } from "@/lib/utils";
import type { StudentOrder } from "@/lib/api/studentApi";
import { ORDER_STATUSES, formatStatus, getStatusBadgeClass, getTimelineStep } from "./order-helpers";

type ActiveOrderCardProps = {
  order: StudentOrder | null;
  onReorder?: (order: StudentOrder) => void;
  isReordering?: boolean;
};

export function ActiveOrderCard({
  order,
  onReorder,
  isReordering,
}: ActiveOrderCardProps) {
  if (!order) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader>
          <CardTitle className="text-zinc-100">No Active Orders</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          Your next meal order will appear here with live progress.
        </CardContent>
      </Card>
    );
  }

  const step = getTimelineStep(order.status);

  return (
    <Card className="border-zinc-800 bg-zinc-900/70 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.9)]">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Active Order</p>
          <CardTitle className="mt-2 text-xl text-zinc-50">Order #{order.id}</CardTitle>
        </div>
        <Badge variant="outline" className={`${getStatusBadgeClass(order.status)} border`}>
          {formatStatus(order.status)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <p className="text-xs text-zinc-400">Items</p>
            <p className="text-lg font-semibold text-zinc-100">{order.items.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <p className="text-xs text-zinc-400">Total</p>
            <p className="text-lg font-semibold text-zinc-100">{formatCurrencyINR(order.total)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <p className="text-xs text-zinc-400">Status</p>
            <p className="text-lg font-semibold text-zinc-100">{formatStatus(order.status)}</p>
          </div>
        </div>

        {order.status !== "cancelled" && (
          <div className="relative grid grid-cols-4 gap-2">
            <div className="absolute left-4 right-4 top-4 h-[2px] bg-zinc-700" />
            {ORDER_STATUSES.map((status, index) => {
              const isDone = index <= step;
              return (
                <div key={status} className="z-10 flex flex-col items-center gap-2">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs ${
                      isDone
                        ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
                        : "border-zinc-700 bg-zinc-900 text-zinc-500"
                    }`}
                  >
                    {index === 0 && <Clock3 className="h-4 w-4" />}
                    {index === 1 && <Package className="h-4 w-4" />}
                    {(index === 2 || index === 3) && <CheckCircle2 className="h-4 w-4" />}
                  </span>
                  <span className={`text-[10px] uppercase ${isDone ? "text-zinc-200" : "text-zinc-500"}`}>
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {onReorder && (
          <Button
            type="button"
            className="h-10 w-full bg-zinc-100 text-zinc-950 hover:bg-white"
            onClick={() => onReorder(order)}
            disabled={isReordering}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {isReordering ? "Reordering..." : "Quick Reorder"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
