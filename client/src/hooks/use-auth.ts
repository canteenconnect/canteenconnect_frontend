import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { withApiOrigin } from "@/lib/api/base";
import {
  backendTokenSchema,
  backendUserSchema,
  mapBackendTokenToSessionUser,
  mapBackendUserToSessionUser,
  type SessionUser,
} from "@/lib/api/fastapiAdapters";
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  setSessionTokens,
} from "@/lib/api/tokenStore";
import { ensureStudentAccessToken } from "@/lib/api/client";

type LoginInput = {
  username: string;
  password: string;
};

type RegisterInput = {
  name: string;
  username: string;
  email: string;
  password: string;
  role: "student";
};

async function extractApiErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  try {
    const payload = (await response.json()) as { detail?: unknown; message?: unknown };
    if (typeof payload?.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    // Ignore malformed responses and fall back below.
  }

  return fallbackMessage;
}

async function loginAgainstBackend(credentials: LoginInput): Promise<SessionUser> {
  const body = new URLSearchParams({
    username: credentials.username,
    password: credentials.password,
  });

  const response = await fetch(withApiOrigin("/token"), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, "Invalid username or password"));
  }

  const payload = backendTokenSchema.parse(await response.json());
  return mapBackendTokenToSessionUser(payload);
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery<SessionUser | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const token = await ensureStudentAccessToken();
      if (!token) return null;

      const response = await fetch(withApiOrigin("/auth/me"), {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        clearSessionTokens();
        return null;
      }

      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, "Unable to load current user"));
      }

      return mapBackendUserToSessionUser(backendUserSchema.parse(await response.json()), token);
    },
    retry: false,
  });

  function handleAuthSuccess(data: SessionUser, title: string, description: string) {
    setSessionTokens({
      accessToken: data.accessToken ?? null,
      refreshToken: data.refreshToken ?? null,
    });

    queryClient.setQueryData(["auth", "me"], {
      ...data,
      accessToken: undefined,
      refreshToken: undefined,
    });
    toast({ title, description });
  }

  const loginMutation = useMutation({
    mutationFn: loginAgainstBackend,
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
      const response = await fetch(withApiOrigin("/auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: payload.username,
          email: payload.email,
          full_name: payload.name,
          password: payload.password,
          role: payload.role,
        }),
      });

      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, "Registration failed"));
      }

      await backendUserSchema.parseAsync(await response.json());
      return loginAgainstBackend({ username: payload.username, password: payload.password });
    },
    onSuccess: (data) => {
      handleAuthSuccess(data, "Account created", "Welcome to CanteenConnect");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();

      if (!accessToken) {
        clearSessionTokens();
        return;
      }

      await fetch(withApiOrigin("/auth/logout"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          refresh_token: refreshToken ?? null,
        }),
      }).catch(() => undefined);
    },
    onSuccess: () => {
      clearSessionTokens();
      queryClient.clear();
      toast({
        title: "Logged out",
        description: "See you soon.",
      });
    },
    onError: () => {
      clearSessionTokens();
      queryClient.clear();
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
    logout: logoutMutation.mutate,
  };
}
