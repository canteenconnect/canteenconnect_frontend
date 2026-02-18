import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Product } from "@shared/schema";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

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
      className="group relative bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-border/50"
    >
      <div className="aspect-[4/3] overflow-hidden bg-muted relative">
        {/* Descriptive alt text for accessibility */}
        {/* Using placeholder as per instructions since we don't have real images yet */}
        <img
          src={product.imageUrl || `https://placehold.co/600x400?text=${encodeURIComponent(product.name)}`}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {!product.available && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-bold shadow-lg">
              Sold Out
            </span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-display font-bold text-lg leading-tight group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            <span className="font-semibold text-primary whitespace-nowrap">
              ${parseFloat(product.price).toFixed(2)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="pt-2">
          <Button
            onClick={handleAdd}
            disabled={!product.available}
            className="w-full rounded-xl h-10 font-semibold shadow-md shadow-primary/10 hover:shadow-primary/20"
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
