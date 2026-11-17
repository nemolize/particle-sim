import { expect, type Locator, type Page, test } from "@playwright/test";

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

const startScene = async (page: Page, scene: string): Promise<Locator> => {
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
  await page.getByLabel("Scene").selectOption(scene);
  await page.getByRole("button", { name: "Reset" }).click();
  return page.getByLabel("Simulation statistics");
};

const readStat = async (stats: Locator, name: string): Promise<number> => {
  const text = await stats.innerText();
  return Number(
    new RegExp(`${name}\\s*([\\d.]+)`).exec(text)?.[1] ?? Number.NaN,
  );
};

const restingSolidArea = async (stats: Locator): Promise<number> => {
  const area = await readStat(stats, "Solid area");
  const speed = await readStat(stats, "Max speed");
  return area > 0 && speed < 0.05 ? area : Number.NaN;
};

const BLOCK_AREA = 0.2 ** 2;
const POOL_BLOCK_AREA = 0.15 ** 2;
const SOLID_TEST_TIMEOUT_MS = 150_000;

const restsWithin =
  (stats: Locator, start: number, low: number, high: number) =>
  async (): Promise<boolean> => {
    const ratio = (await restingSolidArea(stats)) / start;
    return ratio >= low && ratio <= high;
  };

const stableReads = (stats: Locator) => {
  let reads = 0;
  return async (): Promise<number> => {
    reads = (await stats.innerText()).includes("Stable") ? reads + 1 : 0;
    return reads;
  };
};

test("should let a solid block land and recover its shape", async ({
  page,
}) => {
  test.setTimeout(SOLID_TEST_TIMEOUT_MS);
  const stats = await startScene(page, "block");

  await expect
    .poll(restsWithin(stats, BLOCK_AREA, 0.9, 1.1), { timeout: 70_000 })
    .toBe(true);
  await expect(stats).toContainText("Stable");
});

test("should keep a solid block recognisable in a fluid pool", async ({
  page,
}) => {
  test.setTimeout(SOLID_TEST_TIMEOUT_MS);
  const stats = await startScene(page, "splash");

  await expect
    .poll(restsWithin(stats, POOL_BLOCK_AREA, 0.5, 1.5), { timeout: 70_000 })
    .toBe(true);
  await expect(stats).toContainText("Stable");
});

const PRESS_AT_BLOCK_CENTRE = { x: 0.5, y: 0.9 };
/** Beside the resting block, 0.08 from its edge and inside the pointer radius. */
const PRESS_BESIDE_BLOCK = { x: 0.68, y: 0.9 };
const PRESS_OUT_OF_REACH = { x: 0.9, y: 0.9 };
const ATTRACT_REACH_SPEED = 0.3;
const REPEL_REACH_SPEED = 0.2;
const RESTING_SPEED_CEILING = 0.2;
const OUT_OF_REACH_WINDOW_MS = 5_000;

/** Attract pulls a resting block toward its own centre, so only a press beside it moves it. */
const POINTER_MODES = [
  { mode: "attract", press: PRESS_BESIDE_BLOCK, minSpeed: ATTRACT_REACH_SPEED },
  { mode: "repel", press: PRESS_AT_BLOCK_CENTRE, minSpeed: REPEL_REACH_SPEED },
];

const pressOnCanvas = async (
  page: Page,
  press: { x: number; y: number },
): Promise<void> => {
  const canvas = page.getByLabel("Particle simulation");
  const side = await canvas.evaluate((element) => element.clientWidth);
  await canvas.hover({ position: { x: side * press.x, y: side * press.y } });
  await page.mouse.down();
};

for (const { mode, press, minSpeed } of POINTER_MODES) {
  for (const stiffness of ["50", "250"]) {
    test(`should stay stable while the pointer is held on a solid (${mode}, stiffness ${stiffness})`, async ({
      page,
    }) => {
      test.setTimeout(SOLID_TEST_TIMEOUT_MS);
      const stats = await startScene(page, "block");
      await page.getByLabel("Solid stiffness").fill(stiffness);
      await page.getByLabel("Pointer").selectOption(mode);
      await page.getByRole("button", { name: "Reset" }).click();

      await expect
        .poll(async () => restingSolidArea(stats), { timeout: 70_000 })
        .toBeGreaterThan(0);
      await pressOnCanvas(page, press);
      await expect
        .poll(async () => readStat(stats, "Max speed"), { timeout: 10_000 })
        .toBeGreaterThanOrEqual(minSpeed);
      await expect
        .poll(stableReads(stats), { intervals: [500], timeout: 30_000 })
        .toBeGreaterThanOrEqual(12);
      await page.mouse.up();
    });
  }
}

test("should leave a solid block at rest when attract is pressed out of its reach", async ({
  page,
}) => {
  test.setTimeout(SOLID_TEST_TIMEOUT_MS);
  const stats = await startScene(page, "block");
  await page.getByLabel("Pointer").selectOption("attract");

  await expect
    .poll(async () => restingSolidArea(stats), { timeout: 70_000 })
    .toBeGreaterThan(0);
  await pressOnCanvas(page, PRESS_OUT_OF_REACH);
  let peakSpeed = 0;
  const windowEnd = Date.now() + OUT_OF_REACH_WINDOW_MS;
  while (Date.now() < windowEnd) {
    peakSpeed = Math.max(peakSpeed, await readStat(stats, "Max speed"));
  }
  await page.mouse.up();

  expect(peakSpeed).toBeLessThan(RESTING_SPEED_CEILING);
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
