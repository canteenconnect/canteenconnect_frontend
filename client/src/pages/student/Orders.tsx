import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { useLocation } from "wouter";
import { OrderCard } from "@/components/student/OrderCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToast } from "@/hooks/use-toast";
import { studentApi, type StudentOrder } from "@/lib/api/studentApi";

const PAGE_LIMIT = 6;

export default function Orders() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ordersQuery = useInfiniteQuery({
    queryKey: ["student", "orders", "history", debouncedSearch],
    queryFn: ({ pageParam }) =>
      studentApi.getOrders({
        page: pageParam as number,
        limit: PAGE_LIMIT,
        q: debouncedSearch || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
  });

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
        queryClient.invalidateQueries({ queryKey: ["student", "orders"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
      ]);
      toast({
        title: "Reorder successful",
        description: "Order has been submitted again.",
      });
    },
    onError: () => {
      toast({
        title: "Reorder failed",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const orders = useMemo(
    () => ordersQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [ordersQuery.data],
  );

  useEffect(() => {
    if (!loadMoreRef.current || !ordersQuery.hasNextPage || ordersQuery.isFetchingNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void ordersQuery.fetchNextPage();
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [ordersQuery.fetchNextPage, ordersQuery.hasNextPage, ordersQuery.isFetchingNextPage]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Order History</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-100">My Orders</h2>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by order ID or status..."
            className="h-11 border-zinc-700 bg-zinc-900 pl-10 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
      </section>

      {ordersQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-2xl bg-zinc-800" />
          <Skeleton className="h-48 rounded-2xl bg-zinc-800" />
          <Skeleton className="h-48 rounded-2xl bg-zinc-800" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-8 text-center">
          <h3 className="text-lg font-semibold text-zinc-100">No orders found</h3>
          <p className="mt-2 text-sm text-zinc-400">
            {debouncedSearch
              ? "Try a different search keyword."
              : "Place your first order to start tracking timeline updates."}
          </p>
          {!debouncedSearch && (
            <Button
              className="mt-5 bg-zinc-100 text-zinc-950 hover:bg-white"
              onClick={() => setLocation("/")}
            >
              Browse Menu
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onReorder={(targetOrder) => reorderMutation.mutate(targetOrder)}
                onViewDetails={(orderId) => setLocation(`/student/orders/${orderId}`)}
                isReordering={reorderMutation.isPending}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <div ref={loadMoreRef} />

      {ordersQuery.hasNextPage && (
        <Button
          variant="outline"
          className="w-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
          onClick={() => ordersQuery.fetchNextPage()}
          disabled={ordersQuery.isFetchingNextPage}
        >
          {ordersQuery.isFetchingNextPage ? "Loading more..." : "Load More Orders"}
        </Button>
      )}
    </div>
  );
}
