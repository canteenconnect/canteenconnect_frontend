import { z } from "zod";
import type { Product } from "@shared/schema";
import { withApiOrigin } from "./base";

export const backendUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email().nullable().optional(),
  full_name: z.string(),
  role: z.string(),
  is_active: z.boolean(),
  created_at: z.string().datetime().or(z.date()),
  updated_at: z.string().datetime().or(z.date()),
});

export const backendTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  user: backendUserSchema,
});

export const backendMenuItemSchema = z.object({
  id: z.number(),
  outlet_id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  price: z.union([z.string(), z.number()]).transform((value) => String(value)),
  stock_quantity: z.number(),
  is_available: z.boolean(),
  created_at: z.string().datetime().or(z.date()).optional(),
  updated_at: z.string().datetime().or(z.date()).optional(),
});

export const backendOrderItemSchema = z.object({
  id: z.number(),
  menu_item_id: z.number(),
  quantity: z.number(),
  unit_price: z.union([z.string(), z.number()]).transform((value) => String(value)),
  line_total: z.union([z.string(), z.number()]).transform((value) => String(value)),
});

export const backendOrderSchema = z.object({
  id: z.number(),
  order_number: z.string(),
  student_id: z.number(),
  outlet_id: z.number(),
  status: z.string(),
  payment_status: z.string(),
  total_amount: z.union([z.string(), z.number()]).transform((value) => String(value)),
  created_at: z.string().datetime().or(z.date()),
  updated_at: z.string().datetime().or(z.date()),
  items: z.array(backendOrderItemSchema),
});

export type SessionUser = {
  id: number;
  username: string;
  role: "student" | "admin" | "vendor";
  name: string;
  fullName: string | null;
  email: string | null;
  phoneNumber: string | null;
  collegeId: string | null;
  department: string | null;
  profileImage: string | null;
  dietaryPreference: "veg" | "non-veg" | "both";
  createdAt: string | null;
  updatedAt: string | null;
  accessToken?: string;
};

export type CatalogProduct = Product & {
  outletId?: number;
};

export type FrontendOrderItem = {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: string;
  product: CatalogProduct;
};

export type FrontendOrder = {
  id: number;
  userId: number;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  total: string;
  createdAt: string;
  items: FrontendOrderItem[];
};

function normalizeRole(role: string | null | undefined): SessionUser["role"] {
  const normalized = (role || "").trim().toLowerCase();
  if (normalized === "admin" || normalized === "super_admin") return "admin";
  if (normalized === "vendor") return "vendor";
  return "student";
}

function categoryFromName(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("fried rice")) return "Fried Rice";
  if (normalized.includes("noodles")) return "Noodles";
  if (normalized.includes("puff")) return "Puff";
  if (
    normalized.includes("cola") ||
    normalized.includes("soda") ||
    normalized.includes("fizz") ||
    normalized.includes("drink")
  ) {
    return "Cool Drinks";
  }
  return "Canteen Specials";
}

function placeholderImage(name: string): string {
  return `https://placehold.co/600x400?text=${encodeURIComponent(name)}`;
}

function normalizeOrderStatus(status: string): FrontendOrder["status"] {
  const normalized = status.trim().toLowerCase();
  if (normalized === "preparing") return "preparing";
  if (normalized === "completed") return "completed";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "ready") return "ready";
  return "pending";
}

export function mapBackendUserToSessionUser(
  user: z.infer<typeof backendUserSchema>,
  accessToken?: string,
): SessionUser {
  const fullName = user.full_name || user.username;

  return {
    id: user.id,
    username: user.username,
    role: normalizeRole(user.role),
    name: fullName,
    fullName,
    email: user.email ?? null,
    phoneNumber: null,
    collegeId: null,
    department: null,
    profileImage: null,
    dietaryPreference: "both",
    createdAt:
      user.created_at instanceof Date
        ? user.created_at.toISOString()
        : user.created_at ?? null,
    updatedAt:
      user.updated_at instanceof Date
        ? user.updated_at.toISOString()
        : user.updated_at ?? null,
    accessToken,
  };
}

export function mapBackendTokenToSessionUser(
  payload: z.infer<typeof backendTokenSchema>,
): SessionUser {
  return mapBackendUserToSessionUser(payload.user, payload.access_token);
}

export function mapBackendMenuItemToProduct(
  item: z.infer<typeof backendMenuItemSchema>,
): CatalogProduct {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "Freshly prepared canteen item.",
    price: String(item.price),
    category: categoryFromName(item.name),
    imageUrl: placeholderImage(item.name),
    available: item.is_available && item.stock_quantity > 0,
    outletId: item.outlet_id,
  };
}

function fallbackProduct(productId: number, price: string): CatalogProduct {
  return {
    id: productId,
    name: `Menu Item #${productId}`,
    description: "Previously ordered menu item.",
    price,
    category: "Canteen Specials",
    imageUrl: placeholderImage(`Item ${productId}`),
    available: true,
  };
}

export function mapBackendOrderToFrontendOrder(
  order: z.infer<typeof backendOrderSchema>,
  products: CatalogProduct[],
): FrontendOrder {
  const productIndex = new Map(products.map((product) => [product.id, product]));

  return {
    id: order.id,
    userId: order.student_id,
    status: normalizeOrderStatus(order.status),
    total: String(order.total_amount),
    createdAt:
      order.created_at instanceof Date
        ? order.created_at.toISOString()
        : order.created_at,
    items: order.items.map((item) => ({
      id: item.id,
      orderId: order.id,
      productId: item.menu_item_id,
      quantity: item.quantity,
      price: String(item.unit_price),
      product: productIndex.get(item.menu_item_id) ?? fallbackProduct(item.menu_item_id, String(item.unit_price)),
    })),
  };
}

export async function loadCatalogProducts(): Promise<CatalogProduct[]> {
  const response = await fetch(withApiOrigin("/menu"), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to load menu");
  }

  const payload = z.array(backendMenuItemSchema).parse(await response.json());
  return payload.map(mapBackendMenuItemToProduct);
}