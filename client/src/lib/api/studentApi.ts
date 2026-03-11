import { z } from "zod";
import { api } from "@shared/routes";
import { apiClient, ensureStudentAccessToken } from "./client";

type StudentProfile = z.infer<typeof api.student.profile.get.responses[200]>["data"];
type StudentOrdersPayload = z.infer<typeof api.student.orders.list.responses[200]>["data"];
type StudentOrder = z.infer<typeof api.student.orders.detail.responses[200]>["data"];
type StudentFavorite = z.infer<typeof api.student.favorites.list.responses[200]>["data"][number];

type OrderItemInput = {
  productId: number;
  quantity: number;
};

export type StudentProfileUpdateInput = z.infer<typeof api.student.profile.update.input>;

function parseSuccess<T extends z.ZodTypeAny>(schema: T, payload: unknown, label: string) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Invalid ${label} response`);
  }
  return parsed.data;
}

function profileFromSessionUser(
  user: z.infer<typeof api.auth.me.responses[200]>,
): StudentProfile {
  const nowIso = new Date().toISOString();

  return {
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
  };
}

export const studentApi = {
  ensureToken: ensureStudentAccessToken,

  async getProfile(): Promise<StudentProfile> {
    try {
      await ensureStudentAccessToken();
      const response = await apiClient.get(api.student.profile.get.path);
      return parseSuccess(
        api.student.profile.get.responses[200],
        response.data,
        "profile",
      ).data;
    } catch (error) {
      const response = await fetch(api.auth.me.path, { credentials: "include" });
      if (!response.ok) {
        throw error;
      }

      const parsedUser = api.auth.me.responses[200].safeParse(await response.json());
      if (!parsedUser.success || parsedUser.data.role !== "student") {
        throw error;
      }

      return profileFromSessionUser(parsedUser.data);
    }
  },

  async updateProfile(input: StudentProfileUpdateInput | FormData): Promise<StudentProfile> {
    await ensureStudentAccessToken();
    const response =
      input instanceof FormData
        ? await apiClient.put(api.student.profile.update.path, input, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        : await apiClient.put(api.student.profile.update.path, input);

    return parseSuccess(
      api.student.profile.update.responses[200],
      response.data,
      "profile update",
    ).data;
  },

  async getOrders(params: { page: number; limit: number; q?: string }): Promise<StudentOrdersPayload> {
    await ensureStudentAccessToken();
    const response = await apiClient.get(api.student.orders.list.path, {
      params,
    });
    return parseSuccess(
      api.student.orders.list.responses[200],
      response.data,
      "orders list",
    ).data;
  },

  async getOrderById(orderId: number): Promise<StudentOrder> {
    await ensureStudentAccessToken();
    const path = api.student.orders.detail.path.replace(":orderId", String(orderId));
    const response = await apiClient.get(path);
    return parseSuccess(
      api.student.orders.detail.responses[200],
      response.data,
      "order detail",
    ).data;
  },

  async getFavorites(): Promise<StudentFavorite[]> {
    await ensureStudentAccessToken();
    const response = await apiClient.get(api.student.favorites.list.path);
    return parseSuccess(
      api.student.favorites.list.responses[200],
      response.data,
      "favorites",
    ).data;
  },

  async addFavorite(itemId: number): Promise<StudentFavorite> {
    await ensureStudentAccessToken();
    const response = await apiClient.post(api.student.favorites.add.path, { itemId });
    return parseSuccess(
      api.student.favorites.add.responses[201],
      response.data,
      "favorite add",
    ).data;
  },

  async removeFavorite(itemId: number): Promise<void> {
    await ensureStudentAccessToken();
    const path = api.student.favorites.remove.path.replace(":itemId", String(itemId));
    await apiClient.delete(path);
  },

  async reorder(items: OrderItemInput[]) {
    const response = await apiClient.post(api.orders.create.path, { items });
    return response.data;
  },
};

export type { StudentProfile, StudentOrdersPayload, StudentOrder, StudentFavorite };
