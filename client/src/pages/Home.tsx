import { useState } from "react";
import { useProducts } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Loader2, Search, Leaf, WifiOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data, isLoading, error, refetch, isFetching } = useProducts();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const products = data?.items ?? [];
  const isFallbackMode = data?.source === "fallback";
  const hasProducts = products.length > 0;

  const categories = hasProducts ? Array.from(new Set(products.map((p) => p.category))) : [];

  const trendingProducts = products.slice(0, 3);

  const isVegetarian = (product: any) => {
    const nonVegKeywords = ["chicken", "meat", "fish", "egg", "beef", "mutton", "biryani"];
    const content = (product.name + product.description).toLowerCase();
    return !nonVegKeywords.some(keyword => content.includes(keyword));
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVeg = !vegOnly || isVegetarian(product);
    return matchesCategory && matchesSearch && matchesVeg;
  });

  if (isLoading && !hasProducts) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-10 flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading menu...
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-[320px] animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/70" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !hasProducts) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 text-center">
          <p className="font-medium text-zinc-100">Unable to load products right now.</p>
          <Button className="mt-4 bg-zinc-100 text-zinc-900 hover:bg-white" onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(120%_120%_at_0%_0%,#1f2937_0%,#111827_38%,#030712_100%)] pb-20 text-zinc-100 md:pb-8">
      {/* Hero Section */}
      <section className="border-b border-zinc-800/80 bg-zinc-900/40 py-6 sm:py-8 md:py-12">
        <div className="mx-auto max-w-5xl px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 text-center md:text-left"
          >
            <h1 className="text-3xl font-display font-bold leading-tight text-zinc-100 sm:text-4xl md:text-6xl">
              Hungry? <br className="hidden sm:block" />
              <span className="text-zinc-200">We got you covered.</span>
            </h1>
            <p className="max-w-lg text-base text-zinc-400 sm:text-lg md:text-xl">
              Order fresh food from the college canteen and skip the long lines.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        {isFallbackMode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-zinc-200"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <WifiOff className="h-4 w-4 text-amber-400" />
              Showing demo menu because the live API is unavailable.
            </div>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                size="sm"
                variant="outline"
                className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? "Checking..." : "Retry Live Data"}
              </Button>
              <span className="text-xs text-zinc-400 sm:text-sm">
                You can still browse and add items to cart.
              </span>
            </div>
          </motion.div>
        )}

        {/* Trending Section */}
        <section className="mb-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-display font-bold text-zinc-100">Trending Now</h2>
            <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-300">Chef's Choice</Badge>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {trendingProducts.map((product) => (
              <ProductCard key={`trending-${product.id}`} product={product} />
            ))}
          </div>
        </section>

        {/* Search Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-1.5 shadow-lg sm:p-2"
        >
          <Search className="ml-2 h-5 w-5 text-zinc-500 sm:ml-3" />
          <Input 
            placeholder="Search for food, snacks, drinks..." 
            className="h-10 border-0 bg-transparent text-base text-zinc-100 shadow-none placeholder:text-zinc-500 focus-visible:ring-0 sm:h-12 sm:text-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </motion.div>

        {/* Filter Controls */}
        <div className="mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex-1 min-w-0">
            <CategoryFilter 
              categories={categories} 
              selected={selectedCategory} 
              onSelect={setSelectedCategory} 
            />
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-zinc-800 bg-zinc-900/70 px-4 py-2 shadow-sm">
            <Leaf className={`h-4 w-4 ${vegOnly ? "text-emerald-400" : "text-zinc-500"}`} />
            <Label htmlFor="veg-only" className="cursor-pointer text-sm font-medium text-zinc-300">Veg Only</Label>
            <Switch 
              id="veg-only" 
              checked={vegOnly} 
              onCheckedChange={setVegOnly}
              data-testid="switch-veg-only"
            />
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-zinc-400">
            <p className="text-lg">No items found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
