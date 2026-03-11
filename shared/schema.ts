import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoles = ["student", "admin", "vendor"] as const;
export const dietaryPreferences = ["veg", "non-veg", "both"] as const;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: userRoles }).default("student").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  phoneNumber: text("phone_number"),
  collegeId: text("college_id"),
  department: text("department"),
  profileImage: text("profile_image"),
  dietaryPreference: text("dietary_preference", { enum: dietaryPreferences })
    .default("both")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: numeric("price").notNull(),
  category: text("category").notNull(),
  imageUrl: text("image_url").notNull(),
  available: boolean("available").default(true).notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["pending", "preparing", "ready", "completed", "cancelled"],
  })
    .default("pending")
    .notNull(),
  total: numeric("total").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  price: numeric("price").notNull(),
});

export const studentFavorites = pgTable(
  "student_favorites",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueFavoriteByStudent: uniqueIndex("student_favorites_user_product_unique").on(
      table.userId,
      table.productId,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  favorites: many(studentFavorites),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const studentFavoritesRelations = relations(studentFavorites, ({ one }) => ({
  user: one(users, {
    fields: [studentFavorites.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [studentFavorites.productId],
    references: [products.id],
  }),
}));

export const insertUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only include letters, numbers, _, ., -"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(userRoles).default("student"),
  name: z.string().trim().min(1, "Name is required").max(120),
  fullName: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[+]?[\d\s\-()]{7,20}$/)
    .optional(),
  collegeId: z.string().trim().max(64).optional(),
  department: z.string().trim().max(128).optional(),
  profileImage: z.string().trim().optional(),
  dietaryPreference: z.enum(dietaryPreferences).default("both"),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  userId: true,
  createdAt: true,
  status: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  orderId: true,
});

export const studentProfileUpdateSchema = z.object({
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

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;
export type StudentFavorite = typeof studentFavorites.$inferSelect;

export type StudentProfile = Pick<
  User,
  | "id"
  | "fullName"
  | "email"
  | "phoneNumber"
  | "collegeId"
  | "department"
  | "profileImage"
  | "dietaryPreference"
  | "createdAt"
  | "updatedAt"
>;
