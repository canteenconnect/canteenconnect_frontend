import { useCart } from "@/hooks/use-cart";
import { useCreateOrder } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrencyINR } from "@/lib/utils";

export default function Cart() {
  const { items, removeFromCart, updateQuantity, total, clearCart } = useCart();
  const { mutate: createOrder, isPending } = useCreateOrder();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleCheckout = () => {
    if (!user) {
      setLocation("/login");
      return;
    }

    createOrder(
      {
        items: items.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      },
      {
        onSuccess: () => {
          clearCart();
          setLocation("/orders");
        },
      }
    );
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 space-y-6 text-center">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
          <ShoppingBag className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold font-display">Your cart is empty</h2>
          <p className="text-muted-foreground">Looks like you haven't added anything yet.</p>
        </div>
        <Link href="/">
          <Button size="lg" className="rounded-full px-8">Start Ordering</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto mb-24 max-w-2xl px-3 py-6 sm:px-4 sm:py-8 md:mb-8">
      <h1 className="mb-6 text-2xl font-display font-bold sm:mb-8 sm:text-3xl">Your Cart</h1>
      
      <div className="space-y-6">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center"
            >
              {/* Image Thumbnail */}
              <div className="h-24 w-full flex-shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">
                <img 
                  src={item.imageUrl || `https://placehold.co/200x200?text=${encodeURIComponent(item.name)}`} 
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{item.name}</h3>
                <p className="text-primary font-medium">{formatCurrencyINR(item.price)}</p>
              </div>

              <div className="flex items-center justify-between sm:justify-end sm:gap-3">
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-1">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-background"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-4 text-center font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-background"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div
        data-testid="cart-summary"
        className="fixed bottom-0 left-0 right-0 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:relative md:mt-8 md:border-0 md:bg-transparent md:p-0"
      >
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between text-base font-bold sm:text-lg">
            <span>Total</span>
            <span className="text-xl text-primary sm:text-2xl">{formatCurrencyINR(total)}</span>
          </div>
          <Button 
            size="lg" 
            className="h-12 w-full rounded-xl text-base shadow-xl shadow-primary/25 sm:h-14 sm:text-lg" 
            onClick={handleCheckout}
            disabled={isPending}
          >
            {isPending ? "Placing Order..." : (
              <span className="flex items-center gap-2">
                Checkout <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}



