import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Heart, House, LayoutDashboard, LogOut, PackageCheck, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useStudentContext } from "@/context/StudentContext";

type StudentLayoutProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/student", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/orders", label: "My Orders", icon: PackageCheck },
  { href: "/student/favorites", label: "Favorites", icon: Heart },
  { href: "/student/profile", label: "Profile", icon: UserRound },
];

export default function StudentLayout({ children }: StudentLayoutProps) {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();
  const { profile } = useStudentContext();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(120%_120%_at_0%_0%,#1f2937_0%,#111827_38%,#030712_100%)] text-zinc-100">
      <div className="mx-auto flex max-w-[1280px] gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 lg:px-8">
        <aside className="hidden w-72 flex-none rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 lg:block">
          <div className="mb-8 space-y-1">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Canteen Connect</p>
            <h1 className="text-2xl font-semibold text-zinc-100">Student Module</h1>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/student"
                  ? location === "/student"
                  : location.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <span
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                      isActive
                        ? "border-zinc-600 bg-zinc-800 text-zinc-50"
                        : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-200",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <Button
            type="button"
            variant="outline"
            className="mt-8 w-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Student Dashboard</p>
                <p className="text-base font-semibold text-zinc-100 sm:text-lg">
                  {profile?.fullName ?? "Student"}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 border-zinc-700 bg-zinc-900 px-3 text-zinc-100 hover:bg-zinc-800 sm:px-4"
                  onClick={() => setLocation("/")}
                >
                  <House className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Home</span>
                </Button>
                <Avatar className="h-9 w-9 border border-zinc-700 sm:h-10 sm:w-10">
                  <AvatarImage src={profile?.profileImage ?? ""} alt={profile?.fullName ?? "Student"} />
                  <AvatarFallback className="bg-zinc-800 text-zinc-100">
                    {(profile?.fullName ?? "S").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>

          <main className="pb-24 sm:pb-28 lg:pb-8">{children}</main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/student"
                ? location === "/student"
                : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <span className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg py-1.5 sm:py-2">
                  <Icon className={cn("h-4 w-4", isActive ? "text-zinc-100" : "text-zinc-500")} />
                  <span className={cn("text-[10px] sm:text-[11px]", isActive ? "text-zinc-100" : "text-zinc-500")}>
                    {item.label.split(" ")[0]}
                  </span>
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 sm:py-2"
          >
            <LogOut className="h-4 w-4 text-zinc-500" />
            <span className="text-[10px] text-zinc-500 sm:text-[11px]">Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
