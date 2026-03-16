import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { ensureStudentAccessToken } from "@/lib/api/client";
import { clearAccessToken, setAccessToken } from "@/lib/api/tokenStore";

type LoginInput = z.infer<typeof api.auth.login.input>;
type RegisterInput = z.infer<typeof api.auth.register.input>;
type User = z.infer<typeof api.auth.me.responses[200]>;
type AuthUser = z.infer<typeof api.auth.login.responses[200]>;
type GoogleAuthResponse = z.infer<typeof api.auth.google.responses[200]>;

async function extractApiErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    // Ignore malformed/non-JSON error payloads and return fallback below.
  }

  return fallbackMessage;
}

function toPublicUser(user: AuthUser | User): User {
  const { accessToken: _accessToken, ...safeUser } = user as AuthUser & {
    accessToken?: string;
  };
  return safeUser as User;
}

function normalizeRole(role: string | null | undefined): User["role"] {
  const normalized = (role || "").trim().toLowerCase();
  if (normalized === "vendor") return "vendor";
  if (normalized === "admin" || normalized === "super_admin") return "admin";
  return "student";
}

function toAuthUserFromGoogle(payload: GoogleAuthResponse): AuthUser {
  const email = payload.user.email ?? null;
  const username = email ? email.split("@")[0] : `user${payload.user.id}`;

  return {
    id: payload.user.id,
    username,
    role: normalizeRole(payload.user.role),
    name: payload.user.name,
    fullName: payload.user.name,
    email,
    phoneNumber: payload.user.phone ?? null,
    collegeId: payload.user.roll_number ?? null,
    department: payload.user.department ?? null,
    profileImage: payload.user.avatar_url ?? null,
    dietaryPreference: "both",
    createdAt: payload.user.created_at ?? null,
    updatedAt: payload.user.updated_at ?? null,
    accessToken: payload.access_token,
  };
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return api.auth.me.responses[200].parse(await res.json());
    },
    retry: false,
  });

  useEffect(() => {
    if (!user || user.role !== "student") {
      clearAccessToken();
      return;
    }

    void ensureStudentAccessToken();
  }, [user?.id, user?.role]);

  function handleAuthSuccess(data: AuthUser, title: string, description: string) {
    queryClient.setQueryData([api.auth.me.path], toPublicUser(data));

    if (data.role === "student") {
      if (data.accessToken) {
        setAccessToken(data.accessToken);
      } else {
        void ensureStudentAccessToken();
      }
    }

    toast({
      title,
      description,
    });
  }

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginInput) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!res.ok) {
        const message = await extractApiErrorMessage(
          res,
          "Invalid username or password",
        );
        throw new Error(message);
      }

      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      handleAuthSuccess(data, "Welcome back", `Logged in as ${data.username}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (payload: RegisterInput) => {
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        const message = await extractApiErrorMessage(res, "Registration failed");
        throw new Error(message);
      }

      return api.auth.register.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      handleAuthSuccess(data, "Account created", "Welcome to Canteen Connect");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const googleLoginMutation = useMutation({
    mutationFn: async (credential: string) => {
      const res = await fetch(api.auth.google.path, {
        method: api.auth.google.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
        credentials: "include",
      });

      if (!res.ok) {
        const message = await extractApiErrorMessage(res, "Google sign-in failed");
        throw new Error(message);
      }

      if (res.status === 201) {
        return toAuthUserFromGoogle(api.auth.google.responses[201].parse(await res.json()));
      }

      return toAuthUserFromGoogle(api.auth.google.responses[200].parse(await res.json()));
    },
    onSuccess: (data) => {
      handleAuthSuccess(data, "Google sign-in successful", `Logged in as ${data.username}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Google sign-in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch(api.auth.logout.path, {
        method: api.auth.logout.method,
        credentials: "include",
      });
    },
    onSuccess: () => {
      clearAccessToken();
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.clear();
      toast({
        title: "Logged out",
        description: "See you soon.",
      });
    },
  });

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    loginWithGoogle: googleLoginMutation.mutate,
    isGoogleLoggingIn: googleLoginMutation.isPending,
    logout: logoutMutation.mutate,
  };
}
