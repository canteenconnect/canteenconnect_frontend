import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Repeat2, ShoppingBag, Wallet } from "lucide-react";
import { ActiveOrderCard } from "@/components/student/ActiveOrderCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentContext } from "@/context/StudentContext";
import { useToast } from "@/hooks/use-toast";
import { studentApi, type StudentOrder } from "@/lib/api/studentApi";
import { formatCurrencyINR, formatDayMonth } from "@/lib/utils";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { metrics, favorites, isLoading, refreshAll } = useStudentContext();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const reorderMutation = useMutation({
    mutationFn: async (order: StudentOrder) =>
      studentApi.reorder(
        order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["student"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
      ]);
      await refreshAll();
      toast({
        title: "Reorder placed",
        description: "Your order has been submitted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Reorder failed",
        description: "Unable to place reorder at the moment.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-52 w-full rounded-2xl bg-zinc-800" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 rounded-2xl bg-zinc-800" />
          <Skeleton className="h-32 rounded-2xl bg-zinc-800" />
        </div>
        <Skeleton className="h-44 rounded-2xl bg-zinc-800" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ActiveOrderCard
        order={metrics.activeOrder}
        onReorder={(order) => reorderMutation.mutate(order)}
        isReordering={reorderMutation.isPending}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardHeader className="space-y-1 pb-2">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Total Orders</p>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <ShoppingBag className="h-5 w-5 text-zinc-400" />
              {metrics.totalOrders}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400">Orders placed across your account lifecycle.</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardHeader className="space-y-1 pb-2">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Total Spent</p>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Wallet className="h-5 w-5 text-zinc-400" />
              {formatCurrencyINR(metrics.totalSpent)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400">Cumulative spend for canteen purchases.</p>
          </CardContent>
        </Card>
      </section>

      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Quick Action</p>
            <CardTitle className="mt-1 text-zinc-100">Reorder Last Purchase</CardTitle>
          </div>
          {metrics.lastOrder && (
            <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-300">
              {formatDayMonth(metrics.lastOrder.createdAt)}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics.lastOrder ? (
            <>
              <p className="text-sm text-zinc-300">
                Last order #{metrics.lastOrder.id} for{" "}
                <span className="font-semibold">{formatCurrencyINR(metrics.lastOrder.total)}</span>
              </p>
              <Button
                className="bg-zinc-100 text-zinc-950 hover:bg-white"
                disabled={reorderMutation.isPending}
                onClick={() => reorderMutation.mutate(metrics.lastOrder!)}
              >
                <Repeat2 className="mr-2 h-4 w-4" />
                {reorderMutation.isPending ? "Reordering..." : "Quick Reorder"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-zinc-400">No completed orders yet for quick reorder.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Favorite Items</p>
            <CardTitle className="mt-1 text-zinc-100">Your Saved Picks</CardTitle>
          </div>
          <Button
            variant="outline"
            className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() => setLocation("/student/favorites")}
          >
            Manage
          </Button>
        </CardHeader>
        <CardContent>
          {favorites.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">
              No favorites yet. Add items to build a faster reordering flow.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {favorites.slice(0, 4).map((favorite) => (
                <div
                  key={favorite.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {favorite.product.name}
                    </p>
                    <p className="text-xs text-zinc-500">{favorite.product.category}</p>
                  </div>
                  <Heart className="h-4 w-4 fill-rose-500 text-rose-400" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
