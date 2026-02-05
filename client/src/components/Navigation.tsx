import { Link, useLocation } from "wouter";
import { Home, Search, ShoppingBag, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Navigation() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { itemCount } = useCart();

  const isActive = (path: string) => location === path;

  const NavIcon = ({
    path,
    icon: Icon,
    label,
    badge,
  }: {
    path: string;
    icon: any;
    label: string;
    badge?: number;
  }) => (
    <Link href={path}>
      <div
        className={`flex flex-col items-center justify-center space-y-1 w-full p-2 rounded-xl transition-all duration-200 cursor-pointer ${
          isActive(path)
            ? "text-primary font-medium bg-primary/10"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        <div className="relative">
          <Icon size={24} strokeWidth={isActive(path) ? 2.5 : 2} />
          {badge ? (
            <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-background">
              {badge}
            </span>
          ) : null}
        </div>
        <span className="text-xs">{label}</span>
      </div>
    </Link>
  );

  // Desktop Navbar
  const DesktopNav = () => (
    <nav className="hidden md:flex items-center justify-between py-4 px-8 bg-background/80 backdrop-blur-lg border-b sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <ShoppingBag className="text-white w-5 h-5" />
        </div>
        <span className="text-xl font-display font-bold bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
          CanteenConnect
        </span>
      </div>

      <div className="flex items-center gap-6">
        <Link href="/" className={`text-sm font-medium transition-colors hover:text-primary ${isActive("/") ? "text-primary" : "text-muted-foreground"}`}>
          Home
        </Link>
        <Link href="/orders" className={`text-sm font-medium transition-colors hover:text-primary ${isActive("/orders") ? "text-primary" : "text-muted-foreground"}`}>
          Orders
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/cart">
          <Button variant="ghost" size="icon" className="relative">
            <ShoppingBag className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full">
                {itemCount}
              </span>
            )}
          </Button>
        </Link>
        
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{user.username}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                </div>
              </div>
              <DropdownMenuItem onClick={() => logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/login">
            <Button size="sm">Sign In</Button>
          </Link>
        )}
      </div>
    </nav>
  );

  // Mobile Bottom Bar
  const MobileNav = () => (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border z-50 pb-safe">
      <div className="grid grid-cols-4 gap-1 p-2">
        <NavIcon path="/" icon={Home} label="Home" />
        <NavIcon path="/search" icon={Search} label="Search" />
        <NavIcon path="/cart" icon={ShoppingBag} label="Cart" badge={itemCount} />
        {user ? (
          <NavIcon path="/profile" icon={User} label="Profile" />
        ) : (
          <NavIcon path="/login" icon={User} label="Sign In" />
        )}
      </div>
    </div>
  );

  return (
    <>
      <DesktopNav />
      <MobileNav />
    </>
  );
}
