import { useState } from "react";
import { useProducts } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

export default function Home() {
  const { data: products, isLoading, error } = useProducts();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const categories = products 
    ? Array.from(new Set(products.map((p) => p.category)))
    : [];

  const filteredProducts = products?.filter((product) => {
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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

        {/* Categories */}
        <div className="mb-8">
          <CategoryFilter 
            categories={categories} 
            selected={selectedCategory} 
            onSelect={setSelectedCategory} 
          />
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
