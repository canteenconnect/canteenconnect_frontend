import { Link, useLocation } from "wouter";
import { Home, Search, ShoppingBag, User, LogOut, LayoutDashboard } from "lucide-react";
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

import { ThemeToggle } from "./ThemeToggle";

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
        className={`flex h-full w-full cursor-pointer flex-col items-center justify-center space-y-1 rounded-xl p-1.5 transition-all duration-200 ${
          isActive(path)
            ? "bg-zinc-800 font-medium text-zinc-100"
            : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
        }`}
      >
        <div className="relative">
          <Icon size={20} strokeWidth={isActive(path) ? 2.4 : 2} />
          {badge ? (
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-zinc-950 bg-zinc-100 text-[10px] font-bold text-zinc-950">
              {badge}
            </span>
          ) : null}
        </div>
        <span className="text-[10px] leading-none">{label}</span>
      </div>
    </Link>
  );

  // Desktop Navbar
  const DesktopNav = () => (
    <nav
      data-testid="desktop-nav"
      className="sticky top-0 z-50 hidden items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur-lg md:flex lg:px-8 lg:py-4"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
          <ShoppingBag className="h-5 w-5 text-zinc-950" />
        </div>
        <span className="text-lg font-display font-bold text-zinc-100 lg:text-xl">
          CanteenConnect
        </span>
      </div>

      <div className="hidden items-center gap-6 lg:flex">
        <Link href="/" className={`text-sm font-medium transition-colors hover:text-zinc-100 ${isActive("/") ? "text-zinc-100" : "text-zinc-400"}`}>
          Home
        </Link>
        {user?.role === "student" && (
          <Link href="/student" className={`text-sm font-medium transition-colors hover:text-zinc-100 ${isActive("/student") ? "text-zinc-100" : "text-zinc-400"}`}>
            Dashboard
          </Link>
        )}
        <Link href="/orders" className={`text-sm font-medium transition-colors hover:text-zinc-100 ${isActive("/orders") ? "text-zinc-100" : "text-zinc-400"}`}>
          Orders
        </Link>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <ThemeToggle />
        <Link href="/cart">
          <Button variant="ghost" size="icon" className="relative text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100">
            <ShoppingBag className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-950">
                {itemCount}
              </span>
            )}
          </Button>
        </Link>
        
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-zinc-900">
                <Avatar className="h-9 w-9 border border-zinc-700">
                  <AvatarFallback className="bg-zinc-800 text-zinc-100">
                    {user.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-zinc-800 bg-zinc-950 text-zinc-100">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{user.username}</p>
                  <p className="text-xs capitalize text-zinc-500">{user.role}</p>
                </div>
              </div>
              <DropdownMenuItem
                className="cursor-pointer text-zinc-200 focus:bg-zinc-900 focus:text-zinc-100"
                onClick={() => logout()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/login">
            <Button size="sm" className="bg-zinc-100 text-zinc-950 hover:bg-white">Sign In</Button>
          </Link>
        )}
      </div>
    </nav>
  );

  // Mobile Bottom Bar
  const MobileNav = () => (
    <div
      data-testid="mobile-nav"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-lg md:hidden"
    >
      <div className="grid grid-cols-5 gap-1 p-2">
        <NavIcon path="/" icon={Home} label="Home" />
        <NavIcon path={user?.role === "student" ? "/student" : "/search"} icon={user?.role === "student" ? LayoutDashboard : Search} label={user?.role === "student" ? "Dashboard" : "Search"} />
        <NavIcon path="/cart" icon={ShoppingBag} label="Cart" badge={itemCount} />
        <div className="flex flex-col items-center justify-center">
           <ThemeToggle />
           <span className="text-[10px] text-zinc-500">Theme</span>
        </div>
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
