import { motion } from "framer-motion";
import { Eye, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyINR, formatDateTimeCompact } from "@/lib/utils";
import type { StudentOrder } from "@/lib/api/studentApi";
import { formatStatus, getStatusBadgeClass } from "./order-helpers";

type OrderCardProps = {
  order: StudentOrder;
  onReorder: (order: StudentOrder) => void;
  onViewDetails: (orderId: number) => void;
  isReordering?: boolean;
};

export function OrderCard({
  order,
  onReorder,
  onViewDetails,
  isReordering,
}: OrderCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-zinc-800 bg-zinc-900/70 transition-colors hover:border-zinc-700">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-zinc-100">Order #{order.id}</CardTitle>
            <p className="mt-2 text-xs text-zinc-400">
              {formatDateTimeCompact(order.createdAt)}
            </p>
          </div>
          <Badge variant="outline" className={`${getStatusBadgeClass(order.status)} border capitalize`}>
            {formatStatus(order.status)}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-sm text-zinc-300">
            {order.items.slice(0, 3).map((item) => (
              <p key={item.id} className="truncate">
                {item.quantity} x {item.product.name}
              </p>
            ))}
            {order.items.length > 3 && (
              <p className="text-zinc-500">+{order.items.length - 3} more items</p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">Total Amount</p>
              <p className="text-xl font-semibold text-zinc-100">
                {formatCurrencyINR(order.total)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                onClick={() => onViewDetails(order.id)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Details
              </Button>
              <Button
                onClick={() => onReorder(order)}
                className="bg-zinc-100 text-zinc-950 hover:bg-white"
                disabled={isReordering}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {isReordering ? "..." : "Reorder"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
