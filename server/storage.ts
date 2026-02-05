import { users, products, orders, orderItems, type User, type InsertUser, type Product, type Order, type OrderItem } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: Product): Promise<Product>;

  createOrder(userId: number, items: { productId: number; quantity: number }[]): Promise<Order>;
  getOrders(userId: number): Promise<(Order & { items: (OrderItem & { product: Product })[] })[]>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
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
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: Product): Promise<Product> {
    // Note: This expects all fields including ID if passed, but usually we use InsertProduct. 
    // Simplified for now or we can change signature.
    // Actually, createProduct logic usually handled by seed or admin.
    const [newProduct] = await db.insert(products).values(product as any).returning();
    return newProduct;
  }

  async createOrder(userId: number, items: { productId: number; quantity: number }[]): Promise<Order> {
    // Calculate total
    let total = 0;
    const orderItemsData = [];

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

    // Transaction
    return await db.transaction(async (tx) => {
        const [order] = await tx.insert(orders).values({
            userId,
            total: total.toString(),
            status: "pending"
        }).returning();

        for (const item of orderItemsData) {
            await tx.insert(orderItems).values({
                orderId: order.id,
                ...item
            });
        }
        return order;
    });
  }

  async getOrders(userId: number): Promise<(Order & { items: (OrderItem & { product: Product })[] })[]> {
    const userOrders = await db.select().from(orders).where(eq(orders.userId, userId));
    
    // Enrich with items
    const result = [];
    for (const order of userOrders) {
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        const itemsWithProduct = [];
        for (const item of items) {
            const [product] = await db.select().from(products).where(eq(products.id, item.productId));
            itemsWithProduct.push({ ...item, product });
        }
        result.push({ ...order, items: itemsWithProduct });
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
