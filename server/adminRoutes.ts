import type { Express, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { sendFailure } from "./http.js";
import {
  createOutlet,
  createUser,
  deleteOutlet,
  getAdminSessionFromToken,
  getEodRows,
  getExecutiveSnapshot,
  getOrderById,
  getOrders,
  getOutlets,
  getReportsSnapshot,
  getSettings,
  getTenants,
  getUsers,
  login,
  refreshLiveOrders,
  toggleUserStatus,
  updateOrderStatus,
  updateOutlet,
  updateSettings,
  updateUser,
} from "./adminService.js";

const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  CAMPUS_ADMIN: "CAMPUS_ADMIN",
  VENDOR_MANAGER: "VENDOR_MANAGER",
  KITCHEN_STAFF: "KITCHEN_STAFF",
} as const;

const REPORT_RANGES = ["Today", "Week", "Month"] as const;
const ORDER_STATUSES = ["Pending", "Preparing", "Ready", "Collected"] as const;
const OUTLET_STATUSES = ["Active", "Inactive"] as const;

const rateLimitMessage = {
  success: false,
  message: "Too many requests. Please try again later.",
  code: "RATE_LIMIT_EXCEEDED",
};

const adminLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ...rateLimitMessage,
    message: "Too many login attempts. Please try again in 10 minutes.",
  },
});

const adminWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const tenantIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9-]+$/i, "Invalid tenant id");

const idSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-zA-Z0-9._:-]+$/, "Invalid resource id");

const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

const outletBaseSchema = z.object({
  tenantId: tenantIdSchema,
  name: z.string().trim().min(2).max(120),
  vendorName: z.string().trim().min(2).max(120),
  commissionRate: z.coerce.number().min(0).max(100),
  status: z.enum(OUTLET_STATUSES),
});

const createOutletSchema = outletBaseSchema;
const updateOutletSchema = outletBaseSchema
  .omit({ tenantId: true })
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one outlet field is required",
  });

const userBaseSchema = z.object({
  tenantId: tenantIdSchema,
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  role: z.enum([
    ROLES.SUPER_ADMIN,
    ROLES.CAMPUS_ADMIN,
    ROLES.VENDOR_MANAGER,
    ROLES.KITCHEN_STAFF,
  ]),
  status: z.enum(OUTLET_STATUSES),
  assignedOutletIds: z.array(idSchema).max(50).default([]),
});

const createUserSchema = userBaseSchema;
const updateUserSchema = userBaseSchema
  .omit({ tenantId: true })
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one user field is required",
  });

const settingsUpdateSchema = z
  .object({
    campusName: z.string().trim().min(2).max(120).optional(),
    logoName: z.string().trim().min(2).max(160).optional(),
    theme: z.enum(["light", "dark"]).optional(),
    taxRate: z.coerce.number().min(0).max(30).optional(),
    serviceChargeEnabled: z.coerce.boolean().optional(),
    serviceChargeRate: z.coerce.number().min(0).max(30).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one settings field is required",
  });

const reportsQuerySchema = z.object({
  range: z.enum(REPORT_RANGES).optional(),
});

type AdminSession = {
  userId: string;
  role: string;
  tenantId: string | null;
  tenantAccess: string[];
  selectedTenantId: string | null;
  token: string;
};

type AdminAuthRequest = Request & {
  adminSession?: AdminSession;
};

function withAdminAuth(req: AdminAuthRequest, res: Response, next: NextFunction) {
  const authHeader = String(req.headers.authorization || "").trim();
  if (!authHeader.startsWith("Bearer ")) {
    return sendFailure(res, 401, "Unauthorized", "UNAUTHORIZED");
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.length < 16) {
    return sendFailure(res, 401, "Unauthorized", "UNAUTHORIZED");
  }

  const session = getAdminSessionFromToken(token);
  if (!session) {
    return sendFailure(res, 401, "Unauthorized", "UNAUTHORIZED");
  }

  req.adminSession = {
    token: String(session.token || token),
    userId: String(session.userId || ""),
    role: String(session.role || ""),
    tenantId: typeof session.tenantId === "string" ? session.tenantId : null,
    tenantAccess: Array.isArray(session.tenantAccess)
      ? session.tenantAccess.map((entry: unknown) => String(entry))
      : [],
    selectedTenantId:
      typeof session.selectedTenantId === "string" ? session.selectedTenantId : null,
  };
  next();
}

function requireRoles(...allowedRoles: string[]) {
  return (req: AdminAuthRequest, res: Response, next: NextFunction) => {
    const role = req.adminSession?.role;
    if (!role || !allowedRoles.includes(role)) {
      return sendFailure(res, 403, "Insufficient permissions", "ROLE_FORBIDDEN");
    }
    next();
  };
}

function hasTenantAccess(session: AdminSession, tenantId: string) {
  if (session.role === ROLES.SUPER_ADMIN) {
    return session.tenantAccess.includes(tenantId);
  }

  if (session.tenantId) {
    return session.tenantId === tenantId;
  }

  return session.tenantAccess.includes(tenantId);
}

function resolveTenantId(
  req: AdminAuthRequest,
  res: Response,
  options: { required?: boolean; explicitTenantId?: string } = {},
) {
  const required = options.required ?? true;
  const explicitTenantId = options.explicitTenantId;
  const fromQuery = typeof req.query.tenantId === "string" ? req.query.tenantId : "";
  const candidate =
    String(explicitTenantId || "").trim() ||
    String(fromQuery || "").trim() ||
    req.adminSession?.selectedTenantId ||
    req.adminSession?.tenantId ||
    "";

  if (!candidate) {
    if (required) {
      sendFailure(res, 400, "tenantId is required", "VALIDATION_ERROR");
      return null;
    }
    return undefined;
  }

  const parsedTenantId = tenantIdSchema.safeParse(candidate);
  if (!parsedTenantId.success) {
    sendFailure(res, 400, "Invalid tenantId", "VALIDATION_ERROR", parsedTenantId.error.flatten());
    return null;
  }

  if (!req.adminSession || !hasTenantAccess(req.adminSession, parsedTenantId.data)) {
    sendFailure(res, 403, "Tenant access denied", "TENANT_FORBIDDEN");
    return null;
  }

  return parsedTenantId.data;
}

function parseIdParam(
  value: unknown,
  res: Response,
  fieldLabel: string,
) {
  const parsed = idSchema.safeParse(String(value || ""));
  if (!parsed.success) {
    sendFailure(res, 400, `Invalid ${fieldLabel}`, "VALIDATION_ERROR", parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

function wrap(
  fn: (req: AdminAuthRequest, res: Response) => Promise<unknown>,
): (req: AdminAuthRequest, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export function registerAdminRoutes(app: Express) {
  app.post(
    "/api/admin-app/login",
    adminLoginLimiter,
    wrap(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendFailure(
          res,
          400,
          "Invalid login payload",
          "VALIDATION_ERROR",
          parsed.error.flatten(),
        );
      }
      const payload = await login(parsed.data);
      return res.status(200).json(payload);
    }),
  );

  app.get(
    "/api/admin-app/tenants",
    withAdminAuth,
    wrap(async (req, res) => {
      const payload = await getTenants(req.adminSession?.tenantAccess);
      return res.status(200).json(payload);
    }),
  );

  app.get(
    "/api/admin-app/executive-snapshot",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.VENDOR_MANAGER),
    wrap(async (req, res) => {
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;
      const payload = await getExecutiveSnapshot(tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.get(
    "/api/admin-app/orders",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.VENDOR_MANAGER, ROLES.KITCHEN_STAFF),
    wrap(async (req, res) => {
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;
      const payload = await getOrders(tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.get(
    "/api/admin-app/orders/live",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.VENDOR_MANAGER, ROLES.KITCHEN_STAFF),
    wrap(async (req, res) => {
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;
      const payload = await refreshLiveOrders(tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.get(
    "/api/admin-app/orders/:orderId",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.VENDOR_MANAGER, ROLES.KITCHEN_STAFF),
    wrap(async (req, res) => {
      const orderId = parseIdParam(req.params.orderId, res, "order id");
      if (!orderId) return;
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;
      const payload = await getOrderById(orderId, tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.patch(
    "/api/admin-app/orders/:orderId/status",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.VENDOR_MANAGER, ROLES.KITCHEN_STAFF),
    adminWriteLimiter,
    wrap(async (req, res) => {
      const orderId = parseIdParam(req.params.orderId, res, "order id");
      if (!orderId) return;
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;

      const parsed = orderStatusUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendFailure(
          res,
          400,
          "Invalid order status payload",
          "VALIDATION_ERROR",
          parsed.error.flatten(),
        );
      }

      const payload = await updateOrderStatus(orderId, parsed.data.status, tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.get(
    "/api/admin-app/outlets",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.VENDOR_MANAGER, ROLES.KITCHEN_STAFF),
    wrap(async (req, res) => {
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;
      const payload = await getOutlets(tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.post(
    "/api/admin-app/outlets",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.VENDOR_MANAGER),
    adminWriteLimiter,
    wrap(async (req, res) => {
      const parsed = createOutletSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendFailure(
          res,
          400,
          "Invalid outlet payload",
          "VALIDATION_ERROR",
          parsed.error.flatten(),
        );
      }

      const tenantId = resolveTenantId(req, res, { explicitTenantId: parsed.data.tenantId });
      if (!tenantId) return;

      const payload = await createOutlet({ ...parsed.data, tenantId });
      return res.status(201).json(payload);
    }),
  );

  app.put(
    "/api/admin-app/outlets/:outletId",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.VENDOR_MANAGER),
    adminWriteLimiter,
    wrap(async (req, res) => {
      const outletId = parseIdParam(req.params.outletId, res, "outlet id");
      if (!outletId) return;
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;

      const parsed = updateOutletSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendFailure(
          res,
          400,
          "Invalid outlet update payload",
          "VALIDATION_ERROR",
          parsed.error.flatten(),
        );
      }

      const payload = await updateOutlet(outletId, parsed.data, tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.delete(
    "/api/admin-app/outlets/:outletId",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.VENDOR_MANAGER),
    adminWriteLimiter,
    wrap(async (req, res) => {
      const outletId = parseIdParam(req.params.outletId, res, "outlet id");
      if (!outletId) return;
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;
      const payload = await deleteOutlet(outletId, tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.get(
    "/api/admin-app/users",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN),
    wrap(async (req, res) => {
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;
      const payload = await getUsers(tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.post(
    "/api/admin-app/users",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN),
    adminWriteLimiter,
    wrap(async (req, res) => {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendFailure(
          res,
          400,
          "Invalid user payload",
          "VALIDATION_ERROR",
          parsed.error.flatten(),
        );
      }

      const tenantId = resolveTenantId(req, res, { explicitTenantId: parsed.data.tenantId });
      if (!tenantId) return;

      if (req.adminSession?.role !== ROLES.SUPER_ADMIN && parsed.data.role === ROLES.SUPER_ADMIN) {
        return sendFailure(res, 403, "Insufficient permissions", "ROLE_FORBIDDEN");
      }

      const payload = await createUser({ ...parsed.data, tenantId });
      return res.status(201).json(payload);
    }),
  );

  app.put(
    "/api/admin-app/users/:userId",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN),
    adminWriteLimiter,
    wrap(async (req, res) => {
      const userId = parseIdParam(req.params.userId, res, "user id");
      if (!userId) return;
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;

      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendFailure(
          res,
          400,
          "Invalid user update payload",
          "VALIDATION_ERROR",
          parsed.error.flatten(),
        );
      }

      if (req.adminSession?.role !== ROLES.SUPER_ADMIN && parsed.data.role === ROLES.SUPER_ADMIN) {
        return sendFailure(res, 403, "Insufficient permissions", "ROLE_FORBIDDEN");
      }

      const payload = await updateUser(userId, parsed.data, tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.patch(
    "/api/admin-app/users/:userId/toggle-status",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN),
    adminWriteLimiter,
    wrap(async (req, res) => {
      const userId = parseIdParam(req.params.userId, res, "user id");
      if (!userId) return;
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;
      const payload = await toggleUserStatus(userId, tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.get(
    "/api/admin-app/settings",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN),
    wrap(async (req, res) => {
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;
      const payload = await getSettings(tenantId);
      return res.status(200).json(payload);
    }),
  );

  app.put(
    "/api/admin-app/settings",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN),
    adminWriteLimiter,
    wrap(async (req, res) => {
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;

      const parsed = settingsUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendFailure(
          res,
          400,
          "Invalid settings payload",
          "VALIDATION_ERROR",
          parsed.error.flatten(),
        );
      }

      const payload = await updateSettings(tenantId, parsed.data);
      return res.status(200).json(payload);
    }),
  );

  app.get(
    "/api/admin-app/reports",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.VENDOR_MANAGER),
    wrap(async (req, res) => {
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;

      const queryParse = reportsQuerySchema.safeParse(req.query);
      if (!queryParse.success) {
        return sendFailure(
          res,
          400,
          "Invalid reports query",
          "VALIDATION_ERROR",
          queryParse.error.flatten(),
        );
      }

      const payload = await getReportsSnapshot(tenantId, queryParse.data.range || "Week");
      return res.status(200).json(payload);
    }),
  );

  app.get(
    "/api/admin-app/eod",
    withAdminAuth,
    requireRoles(ROLES.SUPER_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.VENDOR_MANAGER),
    wrap(async (req, res) => {
      const tenantId = resolveTenantId(req, res);
      if (!tenantId) return;
      const payload = await getEodRows(tenantId);
      return res.status(200).json(payload);
    }),
  );
}
