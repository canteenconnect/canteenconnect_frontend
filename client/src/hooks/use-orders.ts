import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import {
  backendOrderSchema,
  loadCatalogProducts,
  mapBackendOrderToFrontendOrder,
} from "@/lib/api/fastapiAdapters";
import { withApiOrigin } from "@/lib/api/base";

type CreateOrderInput = {
  outletId?: number;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
};

export function useOrders() {
  return useQuery({
    queryKey: [api.orders.list.path],
    queryFn: async () => {
      const [ordersResponse, products] = await Promise.all([
        fetch(withApiOrigin("/orders/me"), {
          headers: { Accept: "application/json" },
        }),
        loadCatalogProducts().catch(() => []),
      ]);

      if (!ordersResponse.ok) {
        throw new Error("Failed to fetch orders");
      }

      const payload = await ordersResponse.json();
      return backendOrderSchema.array().parse(payload).map((order) =>
        mapBackendOrderToFrontendOrder(order, products),
      );
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateOrderInput) => {
      const outletId = data.outletId;
      if (!outletId) {
        throw new Error("Unable to determine outlet for this order.");
      }

      const response = await fetch(withApiOrigin("/orders"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          outlet_id: outletId,
          payment_method: "cash",
          items: data.items.map((item) => ({
            menu_item_id: item.productId,
            quantity: item.quantity,
          })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail || "Failed to create order");
      }

      const products = await loadCatalogProducts().catch(() => []);
      return mapBackendOrderToFrontendOrder(
        backendOrderSchema.parse(await response.json()),
        products,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.orders.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      toast({
        title: "Order Placed!",
        description: "Your delicious food is being prepared.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Order Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}