import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Product } from "@shared/schema";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { formatCurrencyINR } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const { toast } = useToast();

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(product);
    toast({
      title: "Added to cart",
      description: `${product.name} added to your cart`,
      duration: 1500,
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 transition-all duration-300 hover:shadow-xl"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-900">
        {/* Descriptive alt text for accessibility */}
        {/* Using placeholder as per instructions since we don't have real images yet */}
        <img
          src={product.imageUrl || `https://placehold.co/600x400?text=${encodeURIComponent(product.name)}`}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {!product.available && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm">
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-bold text-zinc-950 shadow-lg">
              Sold Out
            </span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-lg font-display font-bold leading-tight text-zinc-100 transition-colors group-hover:text-zinc-300">
              {product.name}
            </h3>
            <span className="whitespace-nowrap font-semibold text-zinc-200">
              {formatCurrencyINR(product.price)}
            </span>
          </div>
          <p className="line-clamp-2 text-sm leading-relaxed text-zinc-400">
            {product.description}
          </p>
        </div>

        <div className="pt-2">
          <Button
            onClick={handleAdd}
            disabled={!product.available}
            className="h-10 w-full rounded-xl bg-zinc-100 font-semibold text-zinc-950 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500"
            size="sm"
          >
            {product.available ? (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add to Cart
              </>
            ) : (
              "Currently Unavailable"
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
