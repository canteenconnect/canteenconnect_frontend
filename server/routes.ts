import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { promises as fs } from "fs";
import path from "path";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { studentProfileUpdateSchema } from "../shared/schema.js";
import { setupAuth } from "./auth.js";
import { registerAdminRoutes } from "./adminRoutes.js";
import { AppError, asyncHandler, sendFailure, sendSuccess } from "./http.js";
import { storage } from "./storage.js";
import { requireStudentJwt } from "./studentAuth.js";
import os from "os";

const studentOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(25).default(10),
  q: z.string().trim().optional(),
});

const studentFavoriteCreateSchema = z.object({
  itemId: z.number().int().positive(),
});

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1, "At least one order item is required"),
});

const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

const studentProfileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many profile update requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
});

const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const CURATED_PRODUCTS = [
  {
    name: "Veg Fried Rice",
    description: "Street-style vegetable fried rice with spring onions.",
    price: "110",
    category: "Fried Rice",
    imageUrl: "https://placehold.co/600x400?text=Veg+Fried+Rice",
    available: true,
  },
  {
    name: "Egg Fried Rice",
    description: "Classic egg fried rice with pepper and soy flavor.",
    price: "130",
    category: "Fried Rice",
    imageUrl: "https://placehold.co/600x400?text=Egg+Fried+Rice",
    available: true,
  },
  {
    name: "Chicken Fried Rice",
    description: "Wok-tossed fried rice with spicy chicken pieces.",
    price: "150",
    category: "Fried Rice",
    imageUrl: "https://placehold.co/600x400?text=Chicken+Fried+Rice",
    available: true,
  },
  {
    name: "Gobi Fried Rice",
    description: "Crispy gobi fried rice with indo-chinese masala.",
    price: "125",
    category: "Fried Rice",
    imageUrl: "https://placehold.co/600x400?text=Gobi+Fried+Rice",
    available: true,
  },
  {
    name: "Veg Noodles",
    description: "Hakka noodles loaded with fresh vegetables.",
    price: "105",
    category: "Noodles",
    imageUrl: "https://placehold.co/600x400?text=Veg+Noodles",
    available: true,
  },
  {
    name: "Egg Noodles",
    description: "Spicy noodles tossed with scrambled egg.",
    price: "125",
    category: "Noodles",
    imageUrl: "https://placehold.co/600x400?text=Egg+Noodles",
    available: true,
  },
  {
    name: "Chicken Noodles",
    description: "Chicken noodles with garlic-chilli wok flavor.",
    price: "145",
    category: "Noodles",
    imageUrl: "https://placehold.co/600x400?text=Chicken+Noodles",
    available: true,
  },
  {
    name: "Gobi Noodles",
    description: "Crunchy gobi noodles with spicy sauce.",
    price: "120",
    category: "Noodles",
    imageUrl: "https://placehold.co/600x400?text=Gobi+Noodles",
    available: true,
  },
  {
    name: "Veg Puff",
    description: "Flaky bakery puff filled with spicy veggies.",
    price: "35",
    category: "Puff",
    imageUrl: "https://placehold.co/600x400?text=Veg+Puff",
    available: true,
  },
  {
    name: "Egg Puff",
    description: "Golden puff pastry with masala egg filling.",
    price: "45",
    category: "Puff",
    imageUrl: "https://placehold.co/600x400?text=Egg+Puff",
    available: true,
  },
  {
    name: "Chicken Puff",
    description: "Bakery-style puff with spicy chicken mince.",
    price: "55",
    category: "Puff",
    imageUrl: "https://placehold.co/600x400?text=Chicken+Puff",
    available: true,
  },
  {
    name: "Cola (300ml)",
    description: "Chilled cola served ice cold.",
    price: "40",
    category: "Cool Drinks",
    imageUrl: "https://placehold.co/600x400?text=Cola",
    available: true,
  },
  {
    name: "Lemon Soda",
    description: "Fresh lemon soda with a fizzy kick.",
    price: "35",
    category: "Cool Drinks",
    imageUrl: "https://placehold.co/600x400?text=Lemon+Soda",
    available: true,
  },
  {
    name: "Orange Fizz",
    description: "Refreshing orange flavored cool drink.",
    price: "40",
    category: "Cool Drinks",
    imageUrl: "https://placehold.co/600x400?text=Orange+Fizz",
    available: true,
  },
  {
    name: "Mango Drink",
    description: "Sweet chilled mango drink.",
    price: "45",
    category: "Cool Drinks",
    imageUrl: "https://placehold.co/600x400?text=Mango+Drink",
    available: true,
  },
];

const CURATED_PRODUCT_NAMES = new Set(
  CURATED_PRODUCTS.map((product) => product.name.toLowerCase()),
);

function sanitizeTextInput(value: string) {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function sanitizeOptionalField(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  return sanitizeTextInput(value);
}

function requireAuthenticatedSession(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    sendFailure(res, 401, "Unauthorized", "UNAUTHORIZED");
    return false;
  }
  return true;
}

async function persistProfileImage(file: Express.Multer.File, studentId: number) {
  if (!allowedImageMimeTypes.has(file.mimetype)) {
    throw new AppError(
      400,
      "Only JPEG, PNG, or WEBP image uploads are allowed",
      "INVALID_IMAGE_TYPE",
    );
  }

  // Vercel serverless storage is ephemeral and not directly publicly served.
  // For that runtime, keep image bytes in a data URL path field.
  if (process.env.VERCEL) {
    return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  }

  const extension = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
  const uploadRoot = process.env.NODE_ENV === "production" ? os.tmpdir() : process.cwd();
  const uploadDir = path.resolve(uploadRoot, "uploads", "student-profiles");
  await fs.mkdir(uploadDir, { recursive: true });

  const fileName = `student-${studentId}-${Date.now()}.${extension}`;
  const absolutePath = path.join(uploadDir, fileName);
  await fs.writeFile(absolutePath, file.buffer);

  return `/uploads/student-profiles/${fileName}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  setupAuth(app);
  registerAdminRoutes(app);

  app.get(
    "/api/products",
    asyncHandler(async (_req, res) => {
      const products = await storage.getProducts();
      const curatedProducts = products.filter((product) =>
        CURATED_PRODUCT_NAMES.has(product.name.toLowerCase()),
      );
      return res.json(curatedProducts);
    }),
  );

  app.get(
    "/api/products/:id",
    asyncHandler(async (req, res) => {
      const productId = Number(req.params.id);
      if (!Number.isInteger(productId) || productId <= 0) {
        return sendFailure(res, 400, "Invalid product ID", "VALIDATION_ERROR");
      }

      const product = await storage.getProduct(productId);
      if (!product) {
        return sendFailure(res, 404, "Product not found", "NOT_FOUND");
      }

      return res.json(product);
    }),
  );

  app.post(
    "/api/orders",
    asyncHandler(async (req, res) => {
      if (!requireAuthenticatedSession(req, res)) return;
      const sessionUser = req.user as { id: number; role: string };
      if (sessionUser.role !== "student") {
        return sendFailure(res, 403, "Student role required", "ROLE_FORBIDDEN");
      }

      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendFailure(
          res,
          400,
          "Invalid order payload",
          "VALIDATION_ERROR",
          parsed.error.flatten(),
        );
      }

      const order = await storage.createOrder(sessionUser.id, parsed.data.items);
      return res.status(201).json(order);
    }),
  );

  app.get(
    "/api/orders",
    asyncHandler(async (req, res) => {
      if (!requireAuthenticatedSession(req, res)) return;
      const sessionUser = req.user as { id: number; role: string };
      if (sessionUser.role !== "student") {
        return sendFailure(res, 403, "Student role required", "ROLE_FORBIDDEN");
      }

      const orders = await storage.getOrders(sessionUser.id);
      return res.json(orders);
    }),
  );

  const getStudentProfileHandler = asyncHandler(async (req, res) => {
    const profile = await storage.getStudentProfile(req.studentUser!.id);
    if (!profile) {
      throw new AppError(404, "Student profile not found", "NOT_FOUND");
    }

    return sendSuccess(res, profile, "Student profile fetched");
  });

  const putStudentProfileHandler = asyncHandler(async (req, res) => {
    const incoming = {
      fullName: sanitizeOptionalField(req.body?.fullName),
      email: sanitizeOptionalField(req.body?.email),
      phoneNumber: sanitizeOptionalField(req.body?.phoneNumber),
      collegeId: sanitizeOptionalField(req.body?.collegeId),
      department: sanitizeOptionalField(req.body?.department),
      dietaryPreference: sanitizeOptionalField(req.body?.dietaryPreference),
    } as Record<string, unknown>;

    if (req.file) {
      incoming.profileImage = await persistProfileImage(req.file, req.studentUser!.id);
    } else if (req.body?.profileImage) {
      incoming.profileImage = sanitizeOptionalField(req.body.profileImage);
    }

    const parsed = studentProfileUpdateSchema.safeParse(incoming);
    if (!parsed.success) {
      return sendFailure(
        res,
        400,
        "Invalid profile update payload",
        "VALIDATION_ERROR",
        parsed.error.flatten(),
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return sendFailure(
        res,
        400,
        "No profile changes were provided",
        "VALIDATION_ERROR",
      );
    }

    const updatedProfile = await storage.updateStudentProfile(req.studentUser!.id, parsed.data);
    if (!updatedProfile) {
      throw new AppError(404, "Student profile not found", "NOT_FOUND");
    }

    return sendSuccess(res, updatedProfile, "Profile updated successfully");
  });

  const getStudentOrdersHandler = asyncHandler(async (req, res) => {
    const parsed = studentOrdersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendFailure(
        res,
        400,
        "Invalid orders query",
        "VALIDATION_ERROR",
        parsed.error.flatten(),
      );
    }

    const data = await storage.getStudentOrders(req.studentUser!.id, parsed.data);
    return sendSuccess(res, data, "Orders fetched successfully");
  });

  const getStudentOrderByIdHandler = asyncHandler(async (req, res) => {
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return sendFailure(res, 400, "Invalid order ID", "VALIDATION_ERROR");
    }

    const order = await storage.getStudentOrderById(req.studentUser!.id, orderId);
    if (!order) {
      return sendFailure(res, 404, "Order not found", "NOT_FOUND");
    }

    return sendSuccess(res, order, "Order details fetched");
  });

  const getStudentFavoritesHandler = asyncHandler(async (req, res) => {
    const favorites = await storage.getStudentFavorites(req.studentUser!.id);
    return sendSuccess(res, favorites, "Favorites fetched successfully");
  });

  const postStudentFavoritesHandler = asyncHandler(async (req, res) => {
    const parsed = studentFavoriteCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendFailure(
        res,
        400,
        "Invalid favorites payload",
        "VALIDATION_ERROR",
        parsed.error.flatten(),
      );
    }

    const product = await storage.getProduct(parsed.data.itemId);
    if (!product) {
      return sendFailure(res, 404, "Item not found", "NOT_FOUND");
    }

    const favorite = await storage.addStudentFavorite(req.studentUser!.id, parsed.data.itemId);
    return sendSuccess(res, favorite, "Item added to favorites", 201);
  });

  const deleteStudentFavoriteHandler = asyncHandler(async (req, res) => {
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return sendFailure(res, 400, "Invalid item ID", "VALIDATION_ERROR");
    }

    const removed = await storage.removeStudentFavorite(req.studentUser!.id, itemId);
    if (!removed) {
      return sendFailure(res, 404, "Favorite item not found", "NOT_FOUND");
    }

    return sendSuccess(res, { itemId }, "Favorite removed successfully");
  });

  for (const basePath of ["/student", "/api/student"]) {
    app.get(`${basePath}/profile`, requireStudentJwt, getStudentProfileHandler);
    app.put(
      `${basePath}/profile`,
      studentProfileUpdateLimiter,
      requireStudentJwt,
      profileUpload.single("profile_image"),
      putStudentProfileHandler,
    );
    app.get(`${basePath}/orders`, requireStudentJwt, getStudentOrdersHandler);
    app.get(
      `${basePath}/orders/:orderId`,
      requireStudentJwt,
      getStudentOrderByIdHandler,
    );
    app.get(`${basePath}/favorites`, requireStudentJwt, getStudentFavoritesHandler);
    app.post(`${basePath}/favorites`, requireStudentJwt, postStudentFavoritesHandler);
    app.delete(
      `${basePath}/favorites/:itemId`,
      requireStudentJwt,
      deleteStudentFavoriteHandler,
    );
  }

  const existingProducts = await storage.getProducts();
  const existingNames = new Set(
    existingProducts.map((product) => product.name.toLowerCase()),
  );

  const missingProducts = CURATED_PRODUCTS.filter(
    (product) => !existingNames.has(product.name.toLowerCase()),
  );

  if (missingProducts.length > 0) {
    console.log(`Adding curated canteen menu items: ${missingProducts.length}`);
    for (const product of missingProducts) {
      await storage.createProduct(product);
    }
  }

  return httpServer;
}
