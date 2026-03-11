import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { studentApi, type StudentFavorite, type StudentOrder, type StudentProfile } from "@/lib/api/studentApi";
import { useAuth } from "@/hooks/use-auth";

type StudentMetrics = {
  totalOrders: number;
  totalSpent: number;
  activeOrder: StudentOrder | null;
  lastOrder: StudentOrder | null;
};

type StudentContextValue = {
  profile: StudentProfile | null;
  favorites: StudentFavorite[];
  metrics: StudentMetrics;
  dashboardOrders: StudentOrder[];
  isLoading: boolean;
  refreshAll: () => Promise<void>;
};

const defaultMetrics: StudentMetrics = {
  totalOrders: 0,
  totalSpent: 0,
  activeOrder: null,
  lastOrder: null,
};

const StudentContext = createContext<StudentContextValue | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["student", "profile"],
    queryFn: studentApi.getProfile,
  });

  const favoritesQuery = useQuery({
    queryKey: ["student", "favorites"],
    queryFn: studentApi.getFavorites,
  });

  const dashboardQuery = useQuery({
    queryKey: ["student", "orders", "dashboard"],
    queryFn: () => studentApi.getOrders({ page: 1, limit: 5 }),
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([
      profileQuery.refetch(),
      favoritesQuery.refetch(),
      dashboardQuery.refetch(),
    ]);
  }, [dashboardQuery, favoritesQuery, profileQuery]);

  const value = useMemo<StudentContextValue>(() => {
    const dashboardData = dashboardQuery.data;
    const nowIso = new Date().toISOString();
    const sessionProfile: StudentProfile | null =
      user?.role === "student"
        ? {
            id: user.id,
            fullName: user.fullName ?? user.name ?? user.username ?? "Student",
            email: user.email ?? null,
            phoneNumber: user.phoneNumber ?? null,
            collegeId: user.collegeId ?? null,
            department: user.department ?? null,
            profileImage: user.profileImage ?? null,
            dietaryPreference: user.dietaryPreference,
            createdAt: user.createdAt ?? nowIso,
            updatedAt: user.updatedAt ?? nowIso,
          }
        : null;
    const resolvedProfile = profileQuery.data ?? sessionProfile;

    return {
      profile: resolvedProfile,
      favorites: favoritesQuery.data ?? [],
      metrics: dashboardData?.metrics ?? defaultMetrics,
      dashboardOrders: dashboardData?.items ?? [],
      isLoading:
        profileQuery.isLoading || favoritesQuery.isLoading || dashboardQuery.isLoading,
      refreshAll,
    };
  }, [
    dashboardQuery.data,
    dashboardQuery.isLoading,
    favoritesQuery.data,
    favoritesQuery.isLoading,
    profileQuery.data,
    profileQuery.isLoading,
    refreshAll,
    user,
  ]);

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudentContext() {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error("useStudentContext must be used inside StudentProvider");
  }
  return context;
}
