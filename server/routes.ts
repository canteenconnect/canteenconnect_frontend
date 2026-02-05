import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  setupAuth(app);

  // Products
  app.get("/api/products", async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  // Orders
  app.post("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Parse body... simplified
    const items = req.body.items;
    if (!items || !Array.isArray(items)) return res.status(400).json({ message: "Invalid items" });

    try {
        const order = await storage.createOrder((req.user as any).id, items);
        res.status(201).json(order);
    } catch (e) {
        res.status(400).json({ message: (e as Error).message });
    }
  });

  app.get("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const orders = await storage.getOrders((req.user as any).id);
    res.json(orders);
  });

  // Seed Data
  if ((await storage.getProducts()).length === 0) {
    console.log("Seeding database...");
    await storage.createProduct({
        name: "Veggie Burger",
        description: "Delicious veggie burger with cheese",
        price: "150",
        category: "Meals",
        imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80",
        available: true
    } as any);
    await storage.createProduct({
        name: "Chicken Biryani",
        description: "Spicy and flavorful chicken biryani",
        price: "250",
        category: "Meals",
        imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80",
        available: true
    } as any);
    await storage.createProduct({
        name: "Masala Dosa",
        description: "Crispy dosa with potato filling",
        price: "120",
        category: "Snacks",
        imageUrl: "https://images.unsplash.com/photo-1589301760014-d929645e3b6c?w=800&q=80",
        available: true
    } as any);
    await storage.createProduct({
        name: "Cold Coffee",
        description: "Refreshing cold coffee with ice cream",
        price: "80",
        category: "Drinks",
        imageUrl: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&q=80",
        available: true
    } as any);
  }

  return httpServer;
}
