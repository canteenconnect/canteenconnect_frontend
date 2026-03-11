import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStudentContext } from "@/context/StudentContext";
import { useCart } from "@/hooks/use-cart";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useProducts } from "@/hooks/use-products";
import { useToast } from "@/hooks/use-toast";
import { studentApi } from "@/lib/api/studentApi";
import { formatCurrencyINR } from "@/lib/utils";

export default function Favorites() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const queryClient = useQueryClient();
  const { favorites } = useStudentContext();
  const { data: productsResponse } = useProducts();
  const { addToCart } = useCart();
  const { toast } = useToast();

  const addFavoriteMutation = useMutation({
    mutationFn: studentApi.addFavorite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["student", "favorites"] });
      await queryClient.invalidateQueries({ queryKey: ["student", "orders", "dashboard"] });
      toast({
        title: "Added to favorites",
        description: "Item has been saved to your favorites.",
      });
    },
    onError: () => {
      toast({
        title: "Unable to add favorite",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: studentApi.removeFavorite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["student", "favorites"] });
      await queryClient.invalidateQueries({ queryKey: ["student", "orders", "dashboard"] });
      toast({
        title: "Favorite removed",
        description: "Item removed from your saved list.",
      });
    },
    onError: () => {
      toast({
        title: "Unable to remove favorite",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const favoriteProductIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.productId)),
    [favorites],
  );

  const discoverItems = useMemo(() => {
    const products = productsResponse?.items ?? [];
    const normalizedSearch = debouncedSearch.toLowerCase();

    return products
      .filter((product) => !favoriteProductIds.has(product.id))
      .filter((product) => {
        if (!normalizedSearch) return true;
        return (
          product.name.toLowerCase().includes(normalizedSearch) ||
          product.description.toLowerCase().includes(normalizedSearch)
        );
      })
      .slice(0, 10);
  }, [debouncedSearch, favoriteProductIds, productsResponse?.items]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Favorites</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Saved Menu Items</h2>
      </section>

      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader>
          <CardTitle className="text-zinc-100">My Favorites</CardTitle>
        </CardHeader>
        <CardContent>
          {favorites.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">
              You have not added favorites yet.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {favorites.map((favorite) => (
                <div
                  key={favorite.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-100">{favorite.product.name}</p>
                      <p className="text-xs text-zinc-500">{favorite.product.category}</p>
                      <p className="mt-2 text-sm text-zinc-300">
                        {formatCurrencyINR(favorite.product.price)}
                      </p>
                    </div>
                    <Badge className="bg-rose-500/20 text-rose-200">
                      <Heart className="mr-1 h-3 w-3 fill-current" />
                      Favorite
                    </Badge>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1 bg-zinc-100 text-zinc-950 hover:bg-white"
                      onClick={() => addToCart(favorite.product)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add to Cart
                    </Button>
                    <Button
                      variant="outline"
                      className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                      onClick={() => removeFavoriteMutation.mutate(favorite.productId)}
                      disabled={removeFavoriteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader>
          <CardTitle className="text-zinc-100">Discover & Add More</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search menu items..."
              className="h-11 border-zinc-700 bg-zinc-900 pl-10 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          {discoverItems.length === 0 ? (
            <p className="text-sm text-zinc-400">No matching items available to add.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {discoverItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 p-3"
                >
                  <div>
                    <p className="font-medium text-zinc-100">{item.name}</p>
                    <p className="text-xs text-zinc-500">{formatCurrencyINR(item.price)}</p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-zinc-100 text-zinc-950 hover:bg-white"
                    onClick={() => addFavoriteMutation.mutate(item.id)}
                    disabled={addFavoriteMutation.isPending}
                  >
                    <Heart className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
