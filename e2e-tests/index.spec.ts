import { expect, type Page, test } from "@playwright/test";

import { isPreviewTarget } from "./target";

/** A software fallback adapter cannot present to the canvas, so only hardware counts. */
const hasUsableWebGpu = (page: Page): Promise<boolean> =>
  page.evaluate(async () => {
    if (!("gpu" in navigator)) return false;
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null && !adapter.info.isFallbackAdapter;
  });

test("should load the simulator page with its controls", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Particle Sim");
  await expect(
    page.getByRole("heading", { name: "Particle Sim" }),
  ).toBeVisible();
  await expect(page.getByLabel("Scene")).toHaveValue("dam");
  await expect(page.getByLabel("Simulation statistics")).toBeVisible();
});

test("should run the dam break without diverging", async ({ page }) => {
  await page.goto("/");
  test.skip(
    !(await hasUsableWebGpu(page)),
    "no hardware WebGPU in this browser",
  );

  const canvas = page.getByLabel("Particle simulation");
  await expect(canvas).toHaveAttribute("data-ready", "true", {
    timeout: 30_000,
  });
  const stats = page.getByLabel("Simulation statistics");
  await expect(stats).toContainText(/Particles\s*[1-9]\d{3,}/, {
    timeout: 30_000,
  });

  const meanHeight = async (): Promise<number> => {
    const text = await stats.innerText();
    return Number(/Mean height\s*([\d.]+)/.exec(text)?.[1] ?? Number.NaN);
  };
  const before = await meanHeight();
  // The column of water collapses, so its mean height falls well below the start.
  await expect
    .poll(meanHeight, { timeout: 30_000 })
    .toBeLessThan(before - 0.05);
  await expect(stats).toContainText("Stable");
});

test("should rebuild the scene when Reset is pressed", async ({ page }) => {
  await page.goto("/");
  test.skip(
    !(await hasUsableWebGpu(page)),
    "no hardware WebGPU in this browser",
  );

  await expect(page.getByLabel("Particle simulation")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 30_000 },
  );
  await page.getByLabel("Scene").selectOption("collision");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByLabel("Simulation statistics")).toContainText(
    "Stable",
  );
});

test("should explain a browser without WebGPU", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Navigator.prototype, "gpu");
  });
  await page.goto("/");

  await expect(page.getByRole("alert")).toContainText("no WebGPU");
});

test("should serve the SPA shell for a deep route with no file on disk", async ({
  page,
}) => {
  await page.goto("/some/deep/route");

  await expect(page).toHaveTitle("Particle Sim");
  await expect(
    page.getByRole("heading", { name: "Particle Sim" }),
  ).toBeVisible();
});

test("should serve the app from hashed production assets", async ({ page }) => {
  test.skip(!isPreviewTarget, "only meaningful against the production build");

  await page.goto("/");

  const scriptSrc =
    (await page.locator('script[type="module"]').getAttribute("src")) ?? "";
  expect(scriptSrc).toMatch(/^\/assets\/index-[\w-]+\.js$/);

  const response = await page.request.get(scriptSrc);
  expect(response.status()).toBe(200);

  const stylesheet = page.locator('link[rel="stylesheet"]');
  await expect(stylesheet).toHaveAttribute(
    "href",
    /^\/assets\/index-[\w-]+\.css$/,
  );
  const stylesheetHref = (await stylesheet.getAttribute("href")) ?? "";
  const stylesheetResponse = await page.request.get(stylesheetHref);
  expect(stylesheetResponse.status()).toBe(200);
  expect(stylesheetResponse.headers()["content-type"]).toMatch(/^text\/css\b/);

  await expect(page.getByRole("heading", { name: "Particle Sim" })).toHaveCSS(
    "font-size",
    "24px",
  );
});
