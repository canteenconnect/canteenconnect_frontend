import session from "express-session";
import connectPg from "connect-pg-simple";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  orderItems,
  orders,
  products,
  studentFavorites,
  users,
  type InsertProduct,
  type InsertUser,
  type Order,
  type OrderItem,
  type Product,
  type StudentFavorite,
  type StudentProfile,
  type User,
} from "../shared/schema.js";
import { db, hasDatabase, pool } from "./db.js";

const PostgresSessionStore = connectPg(session);

export type OrderWithItems = Order & { items: (OrderItem & { product: Product })[] };
export type FavoriteWithProduct = StudentFavorite & { product: Product };

export type StudentOrdersListResponse = {
  items: OrderWithItems[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  metrics: {
    totalOrders: number;
    totalSpent: number;
    activeOrder: OrderWithItems | null;
    lastOrder: OrderWithItems | null;
  };
};

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;

  createOrder(userId: number, items: { productId: number; quantity: number }[]): Promise<Order>;
  getOrders(userId: number): Promise<OrderWithItems[]>;

  getStudentProfile(userId: number): Promise<StudentProfile | undefined>;
  updateStudentProfile(
    userId: number,
    input: Partial<{
      fullName: string;
      email: string;
      phoneNumber: string;
      collegeId: string;
      department: string;
      profileImage: string;
      dietaryPreference: "veg" | "non-veg" | "both";
    }>,
  ): Promise<StudentProfile | undefined>;
  getStudentOrders(
    userId: number,
    options: { page: number; limit: number; q?: string },
  ): Promise<StudentOrdersListResponse>;
  getStudentOrderById(userId: number, orderId: number): Promise<OrderWithItems | undefined>;
  getStudentFavorites(userId: number): Promise<FavoriteWithProduct[]>;
  addStudentFavorite(userId: number, productId: number): Promise<FavoriteWithProduct>;
  removeStudentFavorite(userId: number, productId: number): Promise<boolean>;

  sessionStore: session.Store;
}

function sanitizeNullable(value?: string | null) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function normalizeDietaryPreference(value: unknown): "veg" | "non-veg" | "both" {
  if (value === "veg" || value === "non-veg" || value === "both") {
    return value;
  }
  return "both";
}

function toStudentProfile(user: User): StudentProfile {
  const resolvedFullName =
    (typeof user.fullName === "string" && user.fullName.trim().length > 0
      ? user.fullName
      : typeof user.name === "string" && user.name.trim().length > 0
        ? user.name
        : typeof user.username === "string" && user.username.trim().length > 0
          ? user.username
          : "Student");

  return {
    id: user.id,
    fullName: resolvedFullName,
    email: user.email ?? null,
    phoneNumber: user.phoneNumber ?? null,
    collegeId: user.collegeId ?? null,
    department: user.department ?? null,
    profileImage: user.profileImage ?? null,
    dietaryPreference: normalizeDietaryPreference(user.dietaryPreference),
    createdAt: normalizeDate(user.createdAt),
    updatedAt: normalizeDate(user.updatedAt),
  };
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    if (!pool) {
      throw new Error("Database pool is unavailable");
    }

    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const now = new Date();
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        fullName: sanitizeNullable(insertUser.fullName) ?? sanitizeNullable(insertUser.name),
        email: sanitizeNullable(insertUser.email),
        phoneNumber: sanitizeNullable(insertUser.phoneNumber),
        collegeId: sanitizeNullable(insertUser.collegeId),
        department: sanitizeNullable(insertUser.department),
        profileImage: sanitizeNullable(insertUser.profileImage),
        dietaryPreference: insertUser.dietaryPreference ?? "both",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return user;
  }

  async getProducts(): Promise<Product[]> {
    return db.select().from(products);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async createOrder(
    userId: number,
    items: { productId: number; quantity: number }[],
  ): Promise<Order> {
    let total = 0;
    const orderItemsData: { productId: number; quantity: number; price: string }[] = [];

    for (const item of items) {
      const product = await this.getProduct(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);

      const price = Number(product.price);
      total += price * item.quantity;
      orderItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        price: price.toString(),
      });
    }

    return db.transaction(async (tx: any) => {
      const [order] = await tx
        .insert(orders)
        .values({
          userId,
          total: total.toString(),
          status: "pending",
        })
        .returning();

      await tx.insert(orderItems).values(
        orderItemsData.map((item) => ({
          orderId: order.id,
          ...item,
        })),
      );

      return order;
    });
  }

  private async hydrateOrders(orderRows: Order[]): Promise<OrderWithItems[]> {
    if (!orderRows.length) {
      return [];
    }

    const orderIds = orderRows.map((order) => order.id);
    const itemsRows = await db
      .select({
        item: orderItems,
        product: products,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrderId = new Map<number, (OrderItem & { product: Product })[]>();
    for (const row of itemsRows) {
      const currentItems = itemsByOrderId.get(row.item.orderId) ?? [];
      currentItems.push({
        ...row.item,
        product: row.product,
      });
      itemsByOrderId.set(row.item.orderId, currentItems);
    }

    return orderRows.map((order) => ({
      ...order,
      items: itemsByOrderId.get(order.id) ?? [],
    }));
  }

  async getOrders(userId: number): Promise<OrderWithItems[]> {
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
    return this.hydrateOrders(orderRows);
  }

  async getStudentProfile(userId: number): Promise<StudentProfile | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.role, "student")));

    return user ? toStudentProfile(user) : undefined;
  }

  async updateStudentProfile(
    userId: number,
    input: Partial<{
      fullName: string;
      email: string;
      phoneNumber: string;
      collegeId: string;
      department: string;
      profileImage: string;
      dietaryPreference: "veg" | "non-veg" | "both";
    }>,
  ): Promise<StudentProfile | undefined> {
    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.fullName !== undefined) {
      const fullName = sanitizeNullable(input.fullName);
      updates.fullName = fullName;
      if (fullName) {
        updates.name = fullName;
      }
    }

    if (input.email !== undefined) updates.email = sanitizeNullable(input.email);
    if (input.phoneNumber !== undefined) updates.phoneNumber = sanitizeNullable(input.phoneNumber);
    if (input.collegeId !== undefined) updates.collegeId = sanitizeNullable(input.collegeId);
    if (input.department !== undefined) updates.department = sanitizeNullable(input.department);
    if (input.profileImage !== undefined) updates.profileImage = sanitizeNullable(input.profileImage);
    if (input.dietaryPreference !== undefined) updates.dietaryPreference = input.dietaryPreference;

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(and(eq(users.id, userId), eq(users.role, "student")))
      .returning();

    return updated ? toStudentProfile(updated) : undefined;
  }

  async getStudentOrders(
    userId: number,
    options: { page: number; limit: number; q?: string },
  ): Promise<StudentOrdersListResponse> {
    const { page, limit } = options;
    const search = options.q?.trim();
    const offset = (page - 1) * limit;

    const whereClause = search
      ? and(
          eq(orders.userId, userId),
          sql`(${orders.status} ILIKE ${`%${search}%`} OR CAST(${orders.id} AS TEXT) ILIKE ${`%${search}%`})`,
        )
      : eq(orders.userId, userId);

    const [totalCountRow] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(whereClause);

    const totalItems = Number(totalCountRow?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    const rows = await db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    const hydratedOrders = await this.hydrateOrders(rows);

    const [metricRow] = await db
      .select({
        totalOrders: sql<number>`count(*)`,
        totalSpent: sql<string>`coalesce(sum(${orders.total}), 0)`,
      })
      .from(orders)
      .where(eq(orders.userId, userId));

    const activeOrderRows = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          inArray(orders.status, ["pending", "preparing", "ready"]),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(1);

    const [activeOrder] = await this.hydrateOrders(activeOrderRows);

    const lastOrderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(1);

    const [lastOrder] = await this.hydrateOrders(lastOrderRows);

    return {
      items: hydratedOrders,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
      metrics: {
        totalOrders: Number(metricRow?.totalOrders ?? 0),
        totalSpent: Number(metricRow?.totalSpent ?? 0),
        activeOrder: activeOrder ?? null,
        lastOrder: lastOrder ?? null,
      },
    };
  }

  async getStudentOrderById(
    userId: number,
    orderId: number,
  ): Promise<OrderWithItems | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)));

    if (!order) {
      return undefined;
    }

    const [hydratedOrder] = await this.hydrateOrders([order]);
    return hydratedOrder;
  }

  async getStudentFavorites(userId: number): Promise<FavoriteWithProduct[]> {
    const rows = await db
      .select({
        favorite: studentFavorites,
        product: products,
      })
      .from(studentFavorites)
      .innerJoin(products, eq(studentFavorites.productId, products.id))
      .where(eq(studentFavorites.userId, userId))
      .orderBy(desc(studentFavorites.createdAt));

    return rows.map((row: { favorite: StudentFavorite; product: Product }) => ({
      ...row.favorite,
      product: row.product,
    }));
  }

  async addStudentFavorite(userId: number, productId: number): Promise<FavoriteWithProduct> {
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) {
      throw new Error("Product not found");
    }

    const [inserted] = await db
      .insert(studentFavorites)
      .values({ userId, productId })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      return {
        ...inserted,
        product,
      };
    }

    const [existing] = await db
      .select()
      .from(studentFavorites)
      .where(and(eq(studentFavorites.userId, userId), eq(studentFavorites.productId, productId)));

    if (!existing) {
      throw new Error("Favorite record not found after insert conflict");
    }

    return {
      ...existing,
      product,
    };
  }

  async removeStudentFavorite(userId: number, productId: number): Promise<boolean> {
    const deleted = await db
      .delete(studentFavorites)
      .where(and(eq(studentFavorites.userId, userId), eq(studentFavorites.productId, productId)))
      .returning({ id: studentFavorites.id });

    return deleted.length > 0;
  }
}

class MemoryStorage implements IStorage {
  sessionStore: session.Store;
  private users: User[] = [];
  private products: Product[] = [];
  private orders: Order[] = [];
  private orderItemsData: OrderItem[] = [];
  private favorites: StudentFavorite[] = [];
  private userId = 1;
  private productId = 1;
  private orderId = 1;
  private orderItemId = 1;
  private favoriteId = 1;

  constructor() {
    this.sessionStore = new session.MemoryStore();
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find((user) => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find((user) => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const now = new Date();
    const user: User = {
      id: this.userId++,
      username: insertUser.username,
      password: insertUser.password,
      role: insertUser.role ?? "student",
      name: insertUser.name,
      fullName: sanitizeNullable(insertUser.fullName) ?? insertUser.name,
      email: sanitizeNullable(insertUser.email) ?? null,
      phoneNumber: sanitizeNullable(insertUser.phoneNumber) ?? null,
      collegeId: sanitizeNullable(insertUser.collegeId) ?? null,
      department: sanitizeNullable(insertUser.department) ?? null,
      profileImage: sanitizeNullable(insertUser.profileImage) ?? null,
      dietaryPreference: insertUser.dietaryPreference ?? "both",
      createdAt: now,
      updatedAt: now,
    };

    this.users.push(user);
    return user;
  }

  async getProducts(): Promise<Product[]> {
    return [...this.products];
  }

  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.find((product) => product.id === id);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const newProduct: Product = {
      id: this.productId++,
      name: product.name,
      description: product.description,
      price: String(product.price),
      category: product.category,
      imageUrl: product.imageUrl,
      available: product.available ?? true,
    };
    this.products.push(newProduct);
    return newProduct;
  }

  async createOrder(
    userId: number,
    items: { productId: number; quantity: number }[],
  ): Promise<Order> {
    let total = 0;
    const now = new Date();

    for (const item of items) {
      const product = await this.getProduct(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      total += Number(product.price) * item.quantity;
    }

    const order: Order = {
      id: this.orderId++,
      userId,
      status: "pending",
      total: total.toString(),
      createdAt: now,
    };
    this.orders.push(order);

    for (const item of items) {
      const product = await this.getProduct(item.productId);
      if (!product) continue;

      this.orderItemsData.push({
        id: this.orderItemId++,
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      });
    }

    return order;
  }

  private hydrateOrders(orderRows: Order[]): OrderWithItems[] {
    return orderRows.map((order) => {
      const hydratedItems = this.orderItemsData
        .filter((item) => item.orderId === order.id)
        .map((item) => ({
          ...item,
          product: this.products.find((product) => product.id === item.productId) as Product,
        }))
        .filter((item) => Boolean(item.product));

      return {
        ...order,
        items: hydratedItems,
      };
    });
  }

  async getOrders(userId: number): Promise<OrderWithItems[]> {
    const orderRows = this.orders
      .filter((order) => order.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return this.hydrateOrders(orderRows);
  }

  async getStudentProfile(userId: number): Promise<StudentProfile | undefined> {
    const user = this.users.find((entry) => entry.id === userId && entry.role === "student");
    return user ? toStudentProfile(user) : undefined;
  }

  async updateStudentProfile(
    userId: number,
    input: Partial<{
      fullName: string;
      email: string;
      phoneNumber: string;
      collegeId: string;
      department: string;
      profileImage: string;
      dietaryPreference: "veg" | "non-veg" | "both";
    }>,
  ): Promise<StudentProfile | undefined> {
    const user = this.users.find((entry) => entry.id === userId && entry.role === "student");
    if (!user) return undefined;

    if (input.fullName !== undefined) {
      const fullName = sanitizeNullable(input.fullName) ?? null;
      user.fullName = fullName;
      if (fullName) {
        user.name = fullName;
      }
    }
    if (input.email !== undefined) user.email = sanitizeNullable(input.email) ?? null;
    if (input.phoneNumber !== undefined) user.phoneNumber = sanitizeNullable(input.phoneNumber) ?? null;
    if (input.collegeId !== undefined) user.collegeId = sanitizeNullable(input.collegeId) ?? null;
    if (input.department !== undefined) user.department = sanitizeNullable(input.department) ?? null;
    if (input.profileImage !== undefined) user.profileImage = sanitizeNullable(input.profileImage) ?? null;
    if (input.dietaryPreference !== undefined) user.dietaryPreference = input.dietaryPreference;
    user.updatedAt = new Date();

    return toStudentProfile(user);
  }

  async getStudentOrders(
    userId: number,
    options: { page: number; limit: number; q?: string },
  ): Promise<StudentOrdersListResponse> {
    const page = options.page;
    const limit = options.limit;
    const query = options.q?.trim().toLowerCase();
    const userOrders = this.orders
      .filter((order) => order.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const filteredOrders = query
      ? userOrders.filter(
          (order) =>
            order.status.toLowerCase().includes(query) ||
            String(order.id).includes(query),
        )
      : userOrders;

    const totalItems = filteredOrders.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const offset = (page - 1) * limit;
    const paginatedOrders = filteredOrders.slice(offset, offset + limit);

    const activeOrder = userOrders.find((order) =>
      ["pending", "preparing", "ready"].includes(order.status),
    );
    const lastOrder = userOrders[0];
    const totalSpent = userOrders.reduce((acc, order) => acc + Number(order.total), 0);

    return {
      items: this.hydrateOrders(paginatedOrders),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
      metrics: {
        totalOrders: userOrders.length,
        totalSpent,
        activeOrder: activeOrder ? this.hydrateOrders([activeOrder])[0] : null,
        lastOrder: lastOrder ? this.hydrateOrders([lastOrder])[0] : null,
      },
    };
  }

  async getStudentOrderById(
    userId: number,
    orderId: number,
  ): Promise<OrderWithItems | undefined> {
    const order = this.orders.find((entry) => entry.id === orderId && entry.userId === userId);
    if (!order) return undefined;
    return this.hydrateOrders([order])[0];
  }

  async getStudentFavorites(userId: number): Promise<FavoriteWithProduct[]> {
    return this.favorites
      .filter((favorite) => favorite.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((favorite) => ({
        ...favorite,
        product: this.products.find((product) => product.id === favorite.productId) as Product,
      }))
      .filter((favorite) => Boolean(favorite.product));
  }

  async addStudentFavorite(userId: number, productId: number): Promise<FavoriteWithProduct> {
    const product = this.products.find((entry) => entry.id === productId);
    if (!product) {
      throw new Error("Product not found");
    }

    const existing = this.favorites.find(
      (favorite) => favorite.userId === userId && favorite.productId === productId,
    );

    if (existing) {
      return { ...existing, product };
    }

    const favorite: StudentFavorite = {
      id: this.favoriteId++,
      userId,
      productId,
      createdAt: new Date(),
    };
    this.favorites.push(favorite);

    return {
      ...favorite,
      product,
    };
  }

  async removeStudentFavorite(userId: number, productId: number): Promise<boolean> {
    const index = this.favorites.findIndex(
      (favorite) => favorite.userId === userId && favorite.productId === productId,
    );
    if (index < 0) return false;

    this.favorites.splice(index, 1);
    return true;
  }
}

export const storage: IStorage = hasDatabase ? new DatabaseStorage() : new MemoryStorage();
