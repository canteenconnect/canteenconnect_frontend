import { useOrders } from "@/hooks/use-orders";
import { Loader2, Package, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { format } from "date-fns";

export default function Orders() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: orders, isLoading } = useOrders();

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200";
      case "preparing": return "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200";
      case "ready": return "bg-green-100 text-green-800 hover:bg-green-200 border-green-200";
      case "completed": return "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200";
      case "cancelled": return "bg-red-100 text-red-800 hover:bg-red-200 border-red-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="w-4 h-4 mr-1" />;
      case "preparing": return <Package className="w-4 h-4 mr-1" />;
      case "ready": return <CheckCircle2 className="w-4 h-4 mr-1" />;
      case "completed": return <CheckCircle2 className="w-4 h-4 mr-1" />;
      case "cancelled": return <XCircle className="w-4 h-4 mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto px-4 max-w-3xl py-8 mb-20">
      <h1 className="text-3xl font-display font-bold mb-8">My Orders</h1>

      {orders?.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-3xl border border-dashed border-border">
          <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
          <p className="text-muted-foreground">Start ordering delicious food now!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders?.map((order: any) => (
            <Card key={order.id} className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">Order #{order.id}</CardTitle>
                    <CardDescription>
                      {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={`${getStatusColor(order.status)} capitalize px-3 py-1`}>
                    {getStatusIcon(order.status)}
                    {order.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Since order items aren't strictly typed in the list response by default based on schema,
                      we assume backend might join them or fetch them. 
                      If API returns items, map them. If not, showing total is fallback.
                      For this demo, assuming standard relational join from backend.
                  */}
                  
                  {/* Placeholder for items if backend joins them, otherwise just summary */}
                  <div className="flex justify-between items-center pt-2 border-t border-border/50 mt-4">
                    <span className="font-semibold text-muted-foreground">Total Amount</span>
                    <span className="text-xl font-bold text-primary">${parseFloat(order.total).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
