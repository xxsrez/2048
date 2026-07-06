import { chromium } from "@playwright/test";
import { stat } from "node:fs/promises";

const url = process.env.APP_URL ?? "http://127.0.0.1:5173";
const screenshotPath = "test-results/2048-home.png";
const mobileScreenshotPath = "test-results/2048-mobile.png";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "2048" }).waitFor();

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
