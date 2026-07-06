import { chromium } from "@playwright/test";
import { stat } from "node:fs/promises";

const url = process.env.APP_URL ?? "http://127.0.0.1:5173";
const screenshotPath = "test-results/2048-home.png";
const mobileScreenshotPath = "test-results/2048-mobile.png";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => {
  const originalRandom = Math.random;

  Math.random = () => {
    try {
      const rawValues = window.localStorage.getItem("__test_random_values");
      const values = rawValues ? JSON.parse(rawValues) : [];

      if (Array.isArray(values) && values.length > 0) {
        const value = Number(values.shift());
        window.localStorage.setItem("__test_random_values", JSON.stringify(values));
        return value;
      }
    } catch {
      // Fall through to browser randomness.
    }

    return originalRandom();
  };
});

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "2048" }).waitFor();
  await assertFavicon(page);

  const initialTiles = await page.locator(".tile").count();
  if (initialTiles !== 2) {
    throw new Error(`Expected 2 initial tiles, got ${initialTiles}`);
  }

  await page.getByRole("button", { name: "Delete tile" }).click();
  await page.locator(".tile").first().click();

  const tilesAfterDelete = await page.locator(".tile").count();
  if (tilesAfterDelete !== 1) {
    throw new Error(`Unexpected tile count after helper flow: ${tilesAfterDelete}`);
  }

  const persistedTiles = await collectTiles(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "2048" }).waitFor();

  const restoredTiles = await collectTiles(page);
  if (JSON.stringify(restoredTiles) !== JSON.stringify(persistedTiles)) {
    throw new Error("Reload did not restore the saved board.");
  }

  const undoDisabled = await page.getByRole("button", { name: "Undo" }).isDisabled();
  if (undoDisabled) {
    throw new Error("Reload did not restore undo history.");
  }

  await page.getByRole("button", { name: "Undo" }).click();
  const tilesAfterUndo = await page.locator(".tile").count();
  if (tilesAfterUndo !== 2) {
    throw new Error(`Expected undo to restore 2 tiles, got ${tilesAfterUndo}`);
  }

  await page.getByRole("button", { name: "Swap 2" }).click();
  await page.locator(".tile").nth(0).click();
  await page.locator(".tile").nth(1).click();

  await page.evaluate(() => {
    window.localStorage.setItem(
      "local-2048-game-state",
      JSON.stringify({
        version: 1,
        board: [
          [2, 2, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 0,
        bestScore: 0,
        keepPlaying: false,
        history: [],
      }),
    );
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(30);

  const slidingTexts = await page.locator(".tile").allTextContents();
  const sourceTwos = slidingTexts.filter((text) => text.trim() === "2").length;

  if (sourceTwos < 2 || !slidingTexts.some((text) => text.trim() === "4")) {
    throw new Error(
      `Expected source tiles and delayed merged tile during merge slide, got ${slidingTexts.join(", ")}`,
    );
  }

  await page.waitForTimeout(180);
  const settledTexts = await page.locator(".tile").allTextContents();
  if (!settledTexts.some((text) => text.trim() === "4")) {
    throw new Error(`Expected merged tile after settle, got ${settledTexts.join(", ")}`);
  }

  await page.evaluate(() => {
    window.localStorage.setItem("__test_random_values", JSON.stringify([0, 0, 0, 0]));
    window.localStorage.setItem(
      "local-2048-game-state",
      JSON.stringify({
        version: 1,
        board: [
          [2, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 0,
        bestScore: 0,
        keepPlaying: false,
        history: [],
      }),
    );
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(320);

  const fastMoveTiles = await collectTiles(page);
  const fastMoveTurns = await page.locator("#turns-count").textContent();
  const queuedMoveWorked = fastMoveTiles.some(
    (tile) => tile.row === "3" && tile.col === "3" && tile.value === "2",
  );

  if (!queuedMoveWorked || fastMoveTurns?.trim() !== "2") {
    throw new Error(
      `Expected rapid ArrowDown+ArrowRight to queue both moves, got turns=${fastMoveTurns} tiles=${JSON.stringify(fastMoveTiles)}`,
    );
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  const screenshot = await stat(screenshotPath);

  if (screenshot.size < 10_000) {
    throw new Error(`Screenshot looks too small: ${screenshot.size} bytes`);
  }

  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "2048" }).waitFor();
  await page.screenshot({ path: mobileScreenshotPath, fullPage: true });

  const mobileScreenshot = await stat(mobileScreenshotPath);
  if (mobileScreenshot.size < 10_000) {
    throw new Error(`Mobile screenshot looks too small: ${mobileScreenshot.size} bytes`);
  }
} finally {
  await browser.close();
}

async function collectTiles(page) {
  return page.locator(".tile").evaluateAll((tiles) =>
    tiles
      .map((tile) => ({
        row: tile.getAttribute("data-row"),
        col: tile.getAttribute("data-col"),
        value: tile.textContent?.trim(),
      }))
      .sort((first, second) =>
        `${first.row}:${first.col}:${first.value}`.localeCompare(
          `${second.row}:${second.col}:${second.value}`,
        ),
      ),
  );
}

async function assertFavicon(page) {
  const faviconHref = await page
    .locator('link[rel="icon"][type="image/png"][sizes="32x32"]')
    .getAttribute("href");

  if (faviconHref !== "/favicon-32x32.png") {
    throw new Error(`Expected PNG favicon link, got ${faviconHref}`);
  }

  const response = await page.request.get(new URL(faviconHref, url).toString());
  const contentType = response.headers()["content-type"];

  if (!response.ok() || !contentType?.includes("image/png")) {
    throw new Error(`PNG favicon did not load correctly: ${response.status()} ${contentType}`);
  }
}
