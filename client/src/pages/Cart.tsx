import { useCart } from "@/hooks/use-cart";
import { useCreateOrder } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="container mx-auto px-4 max-w-2xl py-8 mb-20">
      <h1 className="text-3xl font-display font-bold mb-8">Your Cart</h1>
      
      <div className="space-y-6">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-4 bg-card p-4 rounded-2xl border shadow-sm"
            >
              {/* Image Thumbnail */}
              <div className="h-20 w-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                <img 
                  src={item.imageUrl || `https://placehold.co/200x200?text=${encodeURIComponent(item.name)}`} 
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{item.name}</h3>
                <p className="text-primary font-medium">₹{parseFloat(item.price).toFixed(2)}</p>
              </div>

              <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-1">
                <button
                  onClick={() => updateQuantity(item.id, -1)}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-background transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-semibold w-4 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-background transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => removeFromCart(item.id)}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 md:relative md:bg-transparent md:border-0 md:p-0 md:mt-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span className="text-2xl text-primary">₹{total.toFixed(2)}</span>
          </div>
          <Button 
            size="lg" 
            className="w-full rounded-xl text-lg h-14 shadow-xl shadow-primary/25" 
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
