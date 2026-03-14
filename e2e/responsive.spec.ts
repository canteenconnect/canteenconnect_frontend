import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
];

const cartFixture = [
  {
    id: 1001,
    name: "Masala Dosa",
    description: "Crispy dosa with chutney",
    price: "89.00",
    imageUrl: "",
    quantity: 2,
  },
];

for (const viewport of VIEWPORTS) {
  test.describe(`Responsive ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("navigation adapts to viewport", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const desktopNav = page.getByTestId("desktop-nav");
      const mobileNav = page.getByTestId("mobile-nav");
      const isMobile = viewport.width < 768;

      if (isMobile) {
        await expect(mobileNav).toBeVisible();
        await expect(desktopNav).toBeHidden();
      } else {
        await expect(desktopNav).toBeVisible();
        await expect(mobileNav).toBeHidden();
      }
    });

    test("cart summary switches between fixed and relative layouts", async ({ page }) => {
      await page.addInitScript((items) => {
        window.localStorage.setItem("canteen-cart", JSON.stringify(items));
      }, cartFixture);

      await page.goto("/cart", { waitUntil: "domcontentloaded" });

      const cartSummary = page.getByTestId("cart-summary");
      await expect(cartSummary).toBeVisible();

      const position = await cartSummary.evaluate((element) => {
        return window.getComputedStyle(element).position;
      });

      if (viewport.width < 768) {
        expect(position).toBe("fixed");
      } else {
        expect(position).toBe("relative");
      }
    });
  });
}
