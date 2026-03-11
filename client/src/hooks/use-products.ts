import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

type Product = z.infer<typeof api.products.list.responses[200]>[number];

type ProductsResponse = {
  items: Product[];
  source: "api" | "fallback";
};

const ALLOWED_PRODUCT_NAMES = new Set(
  [
    "Veg Fried Rice",
    "Egg Fried Rice",
    "Chicken Fried Rice",
    "Gobi Fried Rice",
    "Veg Noodles",
    "Egg Noodles",
    "Chicken Noodles",
    "Gobi Noodles",
    "Veg Puff",
    "Egg Puff",
    "Chicken Puff",
    "Cola (300ml)",
    "Lemon Soda",
    "Orange Fizz",
    "Mango Drink",
  ].map((item) => item.toLowerCase()),
);

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Veg Fried Rice",
    description: "Street-style vegetable fried rice with spring onions.",
    price: "110",
    category: "Fried Rice",
    imageUrl:
      "https://placehold.co/600x400?text=Veg+Fried+Rice",
    available: true,
  },
  {
    id: 2,
    name: "Egg Fried Rice",
    description: "Classic egg fried rice with pepper and soy flavor.",
    price: "130",
    category: "Fried Rice",
    imageUrl:
      "https://placehold.co/600x400?text=Egg+Fried+Rice",
    available: true,
  },
  {
    id: 3,
    name: "Chicken Fried Rice",
    description: "Wok-tossed fried rice with spicy chicken pieces.",
    price: "150",
    category: "Fried Rice",
    imageUrl:
      "https://placehold.co/600x400?text=Chicken+Fried+Rice",
    available: true,
  },
  {
    id: 4,
    name: "Gobi Fried Rice",
    description: "Crispy gobi fried rice with indo-chinese masala.",
    price: "125",
    category: "Fried Rice",
    imageUrl:
      "https://placehold.co/600x400?text=Gobi+Fried+Rice",
    available: true,
  },
  {
    id: 5,
    name: "Veg Noodles",
    description: "Hakka noodles loaded with fresh vegetables.",
    price: "105",
    category: "Noodles",
    imageUrl: "https://placehold.co/600x400?text=Veg+Noodles",
    available: true,
  },
  {
    id: 6,
    name: "Egg Noodles",
    description: "Spicy noodles tossed with scrambled egg.",
    price: "125",
    category: "Noodles",
    imageUrl: "https://placehold.co/600x400?text=Egg+Noodles",
    available: true,
  },
  {
    id: 7,
    name: "Chicken Noodles",
    description: "Chicken noodles with garlic-chilli wok flavor.",
    price: "145",
    category: "Noodles",
    imageUrl: "https://placehold.co/600x400?text=Chicken+Noodles",
    available: true,
  },
  {
    id: 8,
    name: "Gobi Noodles",
    description: "Crunchy gobi noodles with spicy sauce.",
    price: "120",
    category: "Noodles",
    imageUrl: "https://placehold.co/600x400?text=Gobi+Noodles",
    available: true,
  },
  {
    id: 9,
    name: "Veg Puff",
    description: "Flaky bakery puff filled with spicy veggies.",
    price: "35",
    category: "Puff",
    imageUrl: "https://placehold.co/600x400?text=Veg+Puff",
    available: true,
  },
  {
    id: 10,
    name: "Egg Puff",
    description: "Golden puff pastry with masala egg filling.",
    price: "45",
    category: "Puff",
    imageUrl: "https://placehold.co/600x400?text=Egg+Puff",
    available: true,
  },
  {
    id: 11,
    name: "Chicken Puff",
    description: "Bakery-style puff with spicy chicken mince.",
    price: "55",
    category: "Puff",
    imageUrl: "https://placehold.co/600x400?text=Chicken+Puff",
    available: true,
  },
  {
    id: 12,
    name: "Cola (300ml)",
    description: "Chilled cola served ice cold.",
    price: "40",
    category: "Cool Drinks",
    imageUrl: "https://placehold.co/600x400?text=Cola",
    available: true,
  },
  {
    id: 13,
    name: "Lemon Soda",
    description: "Fresh lemon soda with a fizzy kick.",
    price: "35",
    category: "Cool Drinks",
    imageUrl: "https://placehold.co/600x400?text=Lemon+Soda",
    available: true,
  },
  {
    id: 14,
    name: "Orange Fizz",
    description: "Refreshing orange flavored cool drink.",
    price: "40",
    category: "Cool Drinks",
    imageUrl: "https://placehold.co/600x400?text=Orange+Fizz",
    available: true,
  },
  {
    id: 15,
    name: "Mango Drink",
    description: "Sweet chilled mango drink.",
    price: "45",
    category: "Cool Drinks",
    imageUrl: "https://placehold.co/600x400?text=Mango+Drink",
    available: true,
  },
];

export function useProducts() {
  return useQuery<ProductsResponse>({
    queryKey: [api.products.list.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.products.list.path, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Failed to fetch products");
        const items = api.products.list.responses[200]
          .parse(await res.json())
          .filter((item) => ALLOWED_PRODUCT_NAMES.has(item.name.toLowerCase()));

        if (items.length === 0) {
          return {
            items: FALLBACK_PRODUCTS,
            source: "fallback",
          };
        }

        return {
          items,
          source: "api",
        };
      } catch {
        return {
          items: FALLBACK_PRODUCTS,
          source: "fallback",
        };
      }
    },
  });
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: [api.products.get.path, id],
    queryFn: async () => {
      try {
        const url = api.products.get.path.replace(":id", id.toString());
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("Failed to fetch product");
        return api.products.get.responses[200].parse(await res.json());
      } catch {
        const fallback = FALLBACK_PRODUCTS.find((product) => product.id === id);
        if (fallback) return fallback;
        throw new Error("Failed to fetch product");
      }
    },
    enabled: !!id,
  });
}
