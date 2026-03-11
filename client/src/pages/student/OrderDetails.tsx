import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { ORDER_STATUSES, formatStatus, getTimelineStep } from "@/components/student/order-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { studentApi } from "@/lib/api/studentApi";
import { formatCurrencyINR, formatDateTimeCompact } from "@/lib/utils";

export default function OrderDetails() {
  const [, setLocation] = useLocation();
  const [matches, params] = useRoute<{ orderId: string }>("/student/orders/:orderId");
  const orderId = Number(params?.orderId ?? "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const orderQuery = useQuery({
    queryKey: ["student", "order", orderId],
    queryFn: () => studentApi.getOrderById(orderId),
    enabled: matches && Number.isInteger(orderId) && orderId > 0,
  });

  const reorderMutation = useMutation({
    mutationFn: async () => {
      const order = orderQuery.data;
      if (!order) return null;
      return studentApi.reorder(
        order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["student", "orders"] });
      toast({
        title: "Reorder placed",
        description: "Your previous order has been queued again.",
      });
    },
  });

  const timelineStep = useMemo(
    () => (orderQuery.data ? getTimelineStep(orderQuery.data.status) : 0),
    [orderQuery.data],
  );

  if (!matches || !Number.isInteger(orderId) || orderId <= 0) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardContent className="p-6 text-sm text-zinc-400">
          Invalid order ID.
        </CardContent>
      </Card>
    );
  }

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl bg-zinc-800" />
        <Skeleton className="h-52 rounded-2xl bg-zinc-800" />
        <Skeleton className="h-56 rounded-2xl bg-zinc-800" />
      </div>
    );
  }

  if (!orderQuery.data) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-100">Order not found</h2>
          <p className="text-sm text-zinc-400">
            The requested order may have been removed or belongs to another account.
          </p>
          <Button
            variant="outline"
            className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() => setLocation("/student/orders")}
          >
            Back to Orders
          </Button>
        </CardContent>
      </Card>
    );
  }

  const order = orderQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={() => setLocation("/student/orders")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
        <Button
          className="bg-zinc-100 text-zinc-950 hover:bg-white"
          onClick={() => reorderMutation.mutate()}
          disabled={reorderMutation.isPending}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {reorderMutation.isPending ? "Reordering..." : "Reorder"}
        </Button>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Order Details</p>
            <CardTitle className="mt-1 text-zinc-100">Order #{order.id}</CardTitle>
            <p className="mt-2 text-sm text-zinc-400">
              Placed on {formatDateTimeCompact(order.createdAt)}
            </p>
          </div>
          <Badge variant="outline" className="border-zinc-700 bg-zinc-900 capitalize text-zinc-200">
            {formatStatus(order.status)}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="relative grid grid-cols-4 gap-2">
            <div className="absolute left-4 right-4 top-4 h-[2px] bg-zinc-700" />
            {ORDER_STATUSES.map((status, index) => {
              const isComplete = index <= timelineStep;
              return (
                <div key={status} className="z-10 flex flex-col items-center gap-2">
                  <span
                    className={`h-8 w-8 rounded-full border ${
                      isComplete
                        ? "border-emerald-400/70 bg-emerald-500/20"
                        : "border-zinc-700 bg-zinc-900"
                    }`}
                  />
                  <span className={`text-[10px] uppercase ${isComplete ? "text-zinc-200" : "text-zinc-500"}`}>
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader>
          <CardTitle className="text-zinc-100">Ordered Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 p-3"
            >
              <div>
                <p className="font-medium text-zinc-100">{item.product.name}</p>
                <p className="text-xs text-zinc-500">
                  {item.quantity} x {formatCurrencyINR(item.price)}
                </p>
              </div>
              <p className="text-sm font-semibold text-zinc-200">
                {formatCurrencyINR(Number(item.price) * item.quantity)}
              </p>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
            <p className="text-sm text-zinc-400">Total</p>
            <p className="text-xl font-semibold text-zinc-100">{formatCurrencyINR(order.total)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
