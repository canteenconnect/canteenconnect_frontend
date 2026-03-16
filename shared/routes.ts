import { z } from "zod";
import {
  dietaryPreferences,
  insertOrderSchema,
  insertUserSchema,
  products,
  userRoles,
} from "./schema";

const apiErrorSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
});

const apiSuccess = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: dataSchema,
  });

const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  role: z.enum(userRoles),
  name: z.string(),
  fullName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  collegeId: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  profileImage: z.string().nullable().optional(),
  dietaryPreference: z.enum(dietaryPreferences),
  createdAt: z.string().datetime().or(z.date()).nullable().optional(),
  updatedAt: z.string().datetime().or(z.date()).nullable().optional(),
});

const authUserSchema = userSchema.extend({
  accessToken: z.string().optional(),
});

const backendUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  roll_number: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  created_at: z.string().datetime().or(z.date()).nullable().optional(),
  updated_at: z.string().datetime().or(z.date()).nullable().optional(),
});

const googleAuthResponseSchema = z.object({
  user: backendUserSchema,
  access_token: z.string(),
  refresh_token: z.string(),
});

const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  price: z.string(),
  category: z.string(),
  imageUrl: z.string(),
  available: z.boolean(),
});

const orderStatusSchema = z.enum([
  "pending",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

const orderItemSchema = z.object({
  id: z.number(),
  orderId: z.number(),
  productId: z.number(),
  quantity: z.number(),
  price: z.string(),
  product: productSchema,
});

const orderSchema = z.object({
  id: z.number(),
  userId: z.number(),
  status: orderStatusSchema,
  total: z.string(),
  createdAt: z.string().datetime().or(z.date()),
  items: z.array(orderItemSchema),
});

const favoriteSchema = z.object({
  id: z.number(),
  userId: z.number(),
  productId: z.number(),
  createdAt: z.string().datetime().or(z.date()),
  product: productSchema,
});

const studentProfileSchema = z.object({
  id: z.number(),
  fullName: z.string(),
  email: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  collegeId: z.string().nullable(),
  department: z.string().nullable(),
  profileImage: z.string().nullable(),
  dietaryPreference: z.enum(dietaryPreferences),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
});

const studentProfileInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[+]?[\d\s\-()]{7,20}$/)
    .optional(),
  collegeId: z.string().trim().max(64).optional(),
  department: z.string().trim().max(128).optional(),
  dietaryPreference: z.enum(dietaryPreferences).optional(),
  profileImage: z.string().trim().max(512).optional(),
});

const studentOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(25).default(10),
  q: z.string().trim().optional(),
});

const studentOrdersListSchema = z.object({
  items: z.array(orderSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
  metrics: z.object({
    totalOrders: z.number(),
    totalSpent: z.number(),
    activeOrder: orderSchema.nullable(),
    lastOrder: orderSchema.nullable(),
  }),
});

export const errorSchemas = {
  apiError: apiErrorSchema,
};

export const api = {
  auth: {
    login: {
      method: "POST" as const,
      path: "/api/login",
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: authUserSchema,
        401: apiErrorSchema,
      },
    },
    register: {
      method: "POST" as const,
      path: "/api/register",
      input: insertUserSchema,
      responses: {
        201: authUserSchema,
        400: apiErrorSchema,
      },
    },
    logout: {
      method: "POST" as const,
      path: "/api/logout",
      responses: {
        200: apiSuccess(z.object({})),
      },
    },
    me: {
      method: "GET" as const,
      path: "/api/user",
      responses: {
        200: userSchema,
        401: apiErrorSchema,
      },
    },
    studentToken: {
      method: "GET" as const,
      path: "/api/auth/token",
      responses: {
        200: apiSuccess(z.object({ accessToken: z.string() })),
        401: apiErrorSchema,
        403: apiErrorSchema,
      },
    },
    refresh: {
      method: "POST" as const,
      path: "/api/auth/refresh",
      responses: {
        200: apiSuccess(z.object({ accessToken: z.string() })),
        401: apiErrorSchema,
      },
    },
    google: {
      method: "POST" as const,
      path: "/api/auth/google",
      input: z.object({
        credential: z.string().min(20),
      }),
      responses: {
        200: googleAuthResponseSchema,
        201: googleAuthResponseSchema,
        400: apiErrorSchema,
        401: apiErrorSchema,
        403: apiErrorSchema,
        409: apiErrorSchema,
      },
    },
  },
  products: {
    list: {
      method: "GET" as const,
      path: "/api/products",
      responses: {
        200: z.array(z.custom<typeof products.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/products/:id",
      responses: {
        200: productSchema,
        404: apiErrorSchema,
      },
    },
  },
  orders: {
    create: {
      method: "POST" as const,
      path: "/api/orders",
      input: z.object({
        items: z.array(
          z.object({
            productId: z.number(),
            quantity: z.number().int().min(1),
          }),
        ),
      }),
      responses: {
        201: insertOrderSchema.extend({
          id: z.number(),
          userId: z.number(),
          status: orderStatusSchema,
          createdAt: z.string().datetime().or(z.date()),
        }),
        400: apiErrorSchema,
        401: apiErrorSchema,
      },
    },
    list: {
      method: "GET" as const,
      path: "/api/orders",
      responses: {
        200: z.array(orderSchema),
      },
    },
  },
  student: {
    profile: {
      get: {
        method: "GET" as const,
        path: "/api/student/profile",
        responses: {
          200: apiSuccess(studentProfileSchema),
          401: apiErrorSchema,
          403: apiErrorSchema,
        },
      },
      update: {
        method: "PUT" as const,
        path: "/api/student/profile",
        input: studentProfileInputSchema,
        responses: {
          200: apiSuccess(studentProfileSchema),
          400: apiErrorSchema,
          401: apiErrorSchema,
        },
      },
    },
    orders: {
      list: {
        method: "GET" as const,
        path: "/api/student/orders",
        query: studentOrdersQuerySchema,
        responses: {
          200: apiSuccess(studentOrdersListSchema),
          401: apiErrorSchema,
        },
      },
      detail: {
        method: "GET" as const,
        path: "/api/student/orders/:orderId",
        responses: {
          200: apiSuccess(orderSchema),
          401: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
    },
    favorites: {
      list: {
        method: "GET" as const,
        path: "/api/student/favorites",
        responses: {
          200: apiSuccess(z.array(favoriteSchema)),
          401: apiErrorSchema,
        },
      },
      add: {
        method: "POST" as const,
        path: "/api/student/favorites",
        input: z.object({
          itemId: z.number().int().positive(),
        }),
        responses: {
          201: apiSuccess(favoriteSchema),
          400: apiErrorSchema,
          401: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
      remove: {
        method: "DELETE" as const,
        path: "/api/student/favorites/:itemId",
        responses: {
          200: apiSuccess(z.object({ itemId: z.number() })),
          401: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
