import { lazy, Suspense, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch, useLocation } from "wouter";
import { ThemeProvider } from "next-themes";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Navigation } from "@/components/Navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { StudentErrorBoundary } from "@/components/student/StudentErrorBoundary";
import { StudentProvider } from "@/context/StudentContext";
import StudentLayout from "@/layouts/StudentLayout";
import { useAuth } from "@/hooks/use-auth";
import Home from "@/pages/Home";

const StudentDashboard = lazy(() => import("@/pages/student/Dashboard"));
const StudentOrders = lazy(() => import("@/pages/student/Orders"));
const StudentOrderDetails = lazy(() => import("@/pages/student/OrderDetails"));
const StudentProfile = lazy(() => import("@/pages/student/Profile"));
const StudentFavorites = lazy(() => import("@/pages/student/Favorites"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const Cart = lazy(() => import("@/pages/Cart"));
const Orders = lazy(() => import("@/pages/Orders"));
const Profile = lazy(() => import("@/pages/Profile"));
const NotFound = lazy(() => import("@/pages/not-found"));

function StudentModuleLoader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 rounded-2xl bg-zinc-800" />
      <Skeleton className="h-64 rounded-2xl bg-zinc-800" />
      <Skeleton className="h-48 rounded-2xl bg-zinc-800" />
    </div>
  );
}

function RouteLoader() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <Skeleton className="h-14 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-44 rounded-2xl" />
    </div>
  );
}

function StudentRoutes() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      setLocation("/login");
      return;
    }

    if (user.role !== "student") {
      setLocation("/");
    }
  }, [isLoading, setLocation, user]);

  if (isLoading || !user || user.role !== "student") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <StudentModuleLoader />
      </div>
    );
  }

  return (
    <StudentProvider>
      <StudentErrorBoundary>
        <StudentLayout>
          <Suspense fallback={<StudentModuleLoader />}>
            <Switch>
              <Route path="/student" component={StudentDashboard} />
              <Route path="/student/orders" component={StudentOrders} />
              <Route path="/student/orders/:orderId" component={StudentOrderDetails} />
              <Route path="/student/profile" component={StudentProfile} />
              <Route path="/student/favorites" component={StudentFavorites} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </StudentLayout>
      </StudentErrorBoundary>
    </StudentProvider>
  );
}

function Router() {
  const [location] = useLocation();
  const isStudentPath = location.startsWith("/student");

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {!isStudentPath && <Navigation />}
      <main>
        <Suspense fallback={<RouteLoader />}>
          <Switch>
            <Route path="/student" component={StudentRoutes} />
            <Route path="/student/:rest*" component={StudentRoutes} />
            <Route path="/" component={Home} />
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/cart" component={Cart} />
            <Route path="/orders" component={Orders} />
            <Route path="/profile" component={Profile} />
            <Route path="/search" component={Home} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <Router />
        <SpeedInsights />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
