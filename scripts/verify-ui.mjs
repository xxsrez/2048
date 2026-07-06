import { chromium } from "@playwright/test";
import { stat } from "node:fs/promises";

const url = process.env.APP_URL ?? "http://127.0.0.1:5173";
const screenshotPath = "test-results/2048-home.png";
const mobileScreenshotPath = "test-results/2048-mobile.png";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "2048" }).waitFor();

  const initialTiles = await page.locator(".tile").count();
  if (initialTiles !== 2) {
    throw new Error(`Expected 2 initial tiles, got ${initialTiles}`);
  }

  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Swap 2" }).click();
  await page.locator(".tile").nth(0).click();
  await page.locator(".tile").nth(1).click();
  await page.getByRole("button", { name: "Delete tile" }).click();
  await page.locator(".tile").first().click();

  const tilesAfterDelete = await page.locator(".tile").count();
  if (tilesAfterDelete < 1 || tilesAfterDelete > 2) {
    throw new Error(`Unexpected tile count after helper flow: ${tilesAfterDelete}`);
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
