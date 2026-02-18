import { useState } from "react";
import { useProducts } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Loader2, Search, Leaf } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Home() {
  const { data: products, isLoading, error } = useProducts();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);

  // Moved heuristic before it's used
  const isVegetarian = (product: any) => {
    const nonVegKeywords = ["chicken", "meat", "fish", "egg", "beef", "mutton", "biryani"];
    const content = (product.name + product.description).toLowerCase();
    return !nonVegKeywords.some(keyword => content.includes(keyword));
  };

  const categories = products
    ? Array.from(new Set(products.map((p) => p.category)))
    : [];

  const trendingProducts = products?.slice(0, 3) || [];

  const isVegetarian = (product: any) => {
    const nonVegKeywords = ["chicken", "meat", "fish", "egg", "beef", "mutton", "biryani"];
    const content = (product.name + product.description).toLowerCase();
    return !nonVegKeywords.some(keyword => content.includes(keyword));
  };

  const filteredProducts = products?.filter((product) => {
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVeg = !vegOnly || isVegetarian(product);
    return matchesCategory && matchesSearch && matchesVeg;
  });

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-destructive">
        Error loading products. Please try again.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      {/* Hero Section */}
      <section className="bg-primary/5 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 text-center md:text-left"
          >
            <h1 className="text-4xl md:text-6xl font-display font-bold text-foreground leading-tight">
              Hungry? <br/>
              <span className="text-primary">We got you covered.</span>
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-lg">
              Order fresh food from the college canteen and skip the long lines.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 max-w-5xl -mt-6">
        {/* Trending Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-bold">Trending Now</h2>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-none">Chef's Choice</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
          className="bg-card p-2 rounded-2xl shadow-lg border border-border/50 flex items-center gap-2 mb-8"
        >
          <Search className="ml-3 text-muted-foreground w-5 h-5" />
          <Input 
            placeholder="Search for food, snacks, drinks..." 
            className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-12 text-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </motion.div>

        {/* Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex-1 min-w-0">
            <CategoryFilter 
              categories={categories} 
              selected={selectedCategory} 
              onSelect={setSelectedCategory} 
            />
          </div>
          <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-full border border-border/50 shadow-sm self-start">
            <Leaf className={`w-4 h-4 ${vegOnly ? "text-green-500" : "text-muted-foreground"}`} />
            <Label htmlFor="veg-only" className="text-sm font-medium cursor-pointer">Veg Only</Label>
            <Switch 
              id="veg-only" 
              checked={vegOnly} 
              onCheckedChange={setVegOnly}
              data-testid="switch-veg-only"
            />
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts?.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">No items found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts?.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
