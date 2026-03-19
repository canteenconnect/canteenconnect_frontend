import { z } from "zod";
import { apiClient } from "./client";
import {
  backendOrderSchema,
  backendUserSchema,
  loadCatalogProducts,
  mapBackendOrderToFrontendOrder,
  mapBackendUserToSessionUser,
  type CatalogProduct,
  type FrontendOrder,
} from "./fastapiAdapters";

const profileSchema = z.object({
  id: z.number(),
  fullName: z.string(),
  email: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  collegeId: z.string().nullable(),
  department: z.string().nullable(),
  profileImage: z.string().nullable(),
  dietaryPreference: z.enum(["veg", "non-veg", "both"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const favoriteSchema = z.object({
  id: z.number(),
  productId: z.number(),
  createdAt: z.string(),
  product: z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    price: z.string(),
    category: z.string(),
    imageUrl: z.string(),
    available: z.boolean(),
    outletId: z.number().optional(),
  }),
});

export type StudentProfile = z.infer<typeof profileSchema>;
export type StudentProfileUpdateInput = {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  collegeId?: string;
  department?: string;
  dietaryPreference?: "veg" | "non-veg" | "both";
  profileImage?: string;
};
export type StudentOrder = FrontendOrder;
export type StudentFavorite = z.infer<typeof favoriteSchema>;
export type StudentOrdersPayload = {
  items: StudentOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  metrics: {
    totalOrders: number;
    totalSpent: number;
    activeOrder: StudentOrder | null;
    lastOrder: StudentOrder | null;
  };
};

type OrderItemInput = {
  productId: number;
  quantity: number;
};

const PROFILE_STORAGE_KEY = "canteenconnect.student.profile";
const FAVORITES_STORAGE_KEY = "canteenconnect.student.favorites";

function nowIso() {
  return new Date().toISOString();
}

function safeStorageGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeStorageSet<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures in privacy-restricted browsers.
  }
}

function buildStudentProfile(payload: z.infer<typeof backendUserSchema>): StudentProfile {
  const sessionUser = mapBackendUserToSessionUser(payload);
  const currentTime = nowIso();
  const localOverrides = safeStorageGet<Partial<StudentProfileUpdateInput>>(PROFILE_STORAGE_KEY, {});

  return profileSchema.parse({
    id: sessionUser.id,
    fullName: localOverrides.fullName ?? sessionUser.fullName ?? sessionUser.name,
    email: localOverrides.email ?? sessionUser.email,
    phoneNumber: localOverrides.phoneNumber ?? sessionUser.phoneNumber,
    collegeId: localOverrides.collegeId ?? sessionUser.collegeId,
    department: localOverrides.department ?? sessionUser.department,
    profileImage: localOverrides.profileImage ?? sessionUser.profileImage,
    dietaryPreference:
      localOverrides.dietaryPreference ?? sessionUser.dietaryPreference ?? "both",
    createdAt: sessionUser.createdAt ?? currentTime,
    updatedAt: sessionUser.updatedAt ?? currentTime,
  });
}

function computeOrderMetrics(orders: StudentOrder[]) {
  const sortedOrders = [...orders].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return {
    totalOrders: orders.length,
    totalSpent: orders.reduce((sum, order) => sum + Number(order.total), 0),
    activeOrder:
      sortedOrders.find(
        (order) => order.status !== "completed" && order.status !== "cancelled",
      ) ?? null,
    lastOrder: sortedOrders[0] ?? null,
  };
}

function applyOrderSearch(orders: StudentOrder[], query?: string) {
  const normalizedQuery = query?.trim().toLowerCase();
  if (!normalizedQuery) {
    return orders;
  }

  return orders.filter((order) => {
    if (String(order.id).includes(normalizedQuery)) {
      return true;
    }
    if (order.status.toLowerCase().includes(normalizedQuery)) {
      return true;
    }
    return order.items.some((item) =>
      item.product.name.toLowerCase().includes(normalizedQuery),
    );
  });
}

function paginateOrders(
  orders: StudentOrder[],
  page: number,
  limit: number,
): StudentOrdersPayload["pagination"] & { pagedItems: StudentOrder[] } {
  const safeLimit = Math.max(1, limit);
  const total = orders.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * safeLimit;

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
    pagedItems: orders.slice(startIndex, startIndex + safeLimit),
  };
}

function getStoredFavorites(): StudentFavorite[] {
  const favorites = safeStorageGet<StudentFavorite[]>(FAVORITES_STORAGE_KEY, []);
  return favorites
    .map((favorite) => {
      const parsed = favoriteSchema.safeParse(favorite);
      return parsed.success ? parsed.data : null;
    })
    .filter((favorite): favorite is StudentFavorite => favorite !== null);
}

function setStoredFavorites(favorites: StudentFavorite[]) {
  safeStorageSet(FAVORITES_STORAGE_KEY, favorites);
}

async function resolveCatalogProduct(productId: number): Promise<CatalogProduct> {
  const [catalog, favorites] = await Promise.all([
    loadCatalogProducts().catch(() => []),
    Promise.resolve(getStoredFavorites()),
  ]);

  const fromCatalog = catalog.find((product) => product.id === productId);
  if (fromCatalog) {
    return fromCatalog;
  }

  const fromFavorites = favorites.find((favorite) => favorite.productId === productId)?.product;
  if (fromFavorites) {
    return fromFavorites;
  }

  return {
    id: productId,
    name: `Menu Item #${productId}`,
    description: "Previously ordered canteen item.",
    price: "0",
    category: "Canteen Specials",
    imageUrl: `https://placehold.co/600x400?text=${encodeURIComponent(`Item ${productId}`)}`,
    available: true,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read profile image."));
    reader.readAsDataURL(file);
  });
}

export const studentApi = {
  async getProfile(): Promise<StudentProfile> {
    const response = await apiClient.get("/auth/me");
    return buildStudentProfile(backendUserSchema.parse(response.data));
  },

  async updateProfile(input: StudentProfileUpdateInput | FormData): Promise<StudentProfile> {
    const currentProfile = await this.getProfile();
    const nextValues: Partial<StudentProfileUpdateInput> = {};

    if (input instanceof FormData) {
      for (const [key, value] of input.entries()) {
        if (value instanceof File) {
          if (key === "profile_image") {
            nextValues.profileImage = await fileToDataUrl(value);
          }
          continue;
        }

        if (
          key === "fullName" ||
          key === "email" ||
          key === "phoneNumber" ||
          key === "collegeId" ||
          key === "department"
        ) {
          nextValues[key] = String(value);
        }
        if (key === "dietaryPreference") {
          nextValues.dietaryPreference = value as StudentProfile["dietaryPreference"];
        }
      }
    } else {
      Object.assign(nextValues, input);
    }

    const mergedProfile = profileSchema.parse({
      ...currentProfile,
      ...nextValues,
      updatedAt: nowIso(),
    });

    safeStorageSet(PROFILE_STORAGE_KEY, {
      fullName: mergedProfile.fullName,
      email: mergedProfile.email ?? undefined,
      phoneNumber: mergedProfile.phoneNumber ?? undefined,
      collegeId: mergedProfile.collegeId ?? undefined,
      department: mergedProfile.department ?? undefined,
      dietaryPreference: mergedProfile.dietaryPreference,
      profileImage: mergedProfile.profileImage ?? undefined,
    });

    return mergedProfile;
  },

  async getOrders(params: { page: number; limit: number; q?: string }): Promise<StudentOrdersPayload> {
    const [ordersResponse, catalog] = await Promise.all([
      apiClient.get("/orders/me"),
      loadCatalogProducts().catch(() => []),
    ]);

    const orders = backendOrderSchema
      .array()
      .parse(ordersResponse.data)
      .map((order) => mapBackendOrderToFrontendOrder(order, catalog))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    const filteredOrders = applyOrderSearch(orders, params.q);
    const pagination = paginateOrders(filteredOrders, params.page, params.limit);

    return {
      items: pagination.pagedItems,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
      metrics: computeOrderMetrics(orders),
    };
  },

  async getOrderById(orderId: number): Promise<StudentOrder> {
    const [orderResponse, catalog] = await Promise.all([
      apiClient.get(`/orders/${orderId}`),
      loadCatalogProducts().catch(() => []),
    ]);

    return mapBackendOrderToFrontendOrder(
      backendOrderSchema.parse(orderResponse.data),
      catalog,
    );
  },

  async getFavorites(): Promise<StudentFavorite[]> {
    return getStoredFavorites();
  },

  async addFavorite(itemId: number): Promise<StudentFavorite> {
    const favorites = getStoredFavorites();
    const existingFavorite = favorites.find((favorite) => favorite.productId === itemId);
    if (existingFavorite) {
      return existingFavorite;
    }

    const product = await resolveCatalogProduct(itemId);
    const favorite = favoriteSchema.parse({
      id: Date.now(),
      productId: itemId,
      createdAt: nowIso(),
      product,
    });

    setStoredFavorites([favorite, ...favorites]);
    return favorite;
  },

  async removeFavorite(itemId: number): Promise<void> {
    const favorites = getStoredFavorites().filter((favorite) => favorite.productId !== itemId);
    setStoredFavorites(favorites);
  },

  async reorder(items: OrderItemInput[]) {
    if (items.length === 0) {
      throw new Error("No order items supplied.");
    }

    const catalog = await loadCatalogProducts().catch(() => []);
    const indexedCatalog = new Map(catalog.map((product) => [product.id, product]));
    const firstProduct = indexedCatalog.get(items[0].productId) ?? (await resolveCatalogProduct(items[0].productId));
    const outletId = firstProduct.outletId;

    if (!outletId) {
      throw new Error("Unable to determine outlet for reorder.");
    }

    const response = await apiClient.post("/orders", {
      outlet_id: outletId,
      payment_method: "cash",
      items: items.map((item) => ({
        menu_item_id: item.productId,
        quantity: item.quantity,
      })),
    });

    const resolvedCatalog = catalog.length > 0
      ? catalog
      : await Promise.all(items.map((item) => resolveCatalogProduct(item.productId)));

    return mapBackendOrderToFrontendOrder(
      backendOrderSchema.parse(response.data),
      resolvedCatalog,
    );
  },
};