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

  await expectHelperCounts(page, { undo: 0, swap: 0, delete: 0 });

  for (const helperId of ["undo", "swap", "delete"]) {
    if (!(await page.locator(`#${helperId}`).isDisabled())) {
      throw new Error(`Expected #${helperId} to start disabled with zero charges.`);
    }
  }

  await setSavedGame(page, {
    board: [
      [64, 128, 1024, 2048],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    keepPlaying: true,
  });
  await expectTileFontScale(page);

  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "local-2048-game-state",
      JSON.stringify({
        version: 1,
        board: [
          [512, 2, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 512,
        bestScore: 512,
        keepPlaying: false,
        history: [],
      }),
    );
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "2048" }).waitFor();
  await expectHelperCounts(page, { undo: 2, swap: 2, delete: 1 });

  const migratedGameCharges = await readStoredGameHelperCounts(page);
  const mirroredCharges = await readMirroredHelperCounts(page);
  if (
    JSON.stringify(migratedGameCharges) !==
      JSON.stringify({ undo: 2, swap: 2, delete: 1 }) ||
    JSON.stringify(mirroredCharges) !==
      JSON.stringify({ undo: 2, swap: 2, delete: 1 })
  ) {
    throw new Error(
      `Expected legacy helper charges to migrate into both stores, got game=${JSON.stringify(migratedGameCharges)} mirror=${JSON.stringify(mirroredCharges)}`,
    );
  }

  await setSavedGame(page, {
    board: [
      [64, 64, 64, 64],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  await expectHelperCounts(page, { undo: 2, swap: 0, delete: 0 });

  const persistedTiles = await collectTiles(page);
  const persistedCounts = await collectHelperCounts(page);
  const mirroredPersistedCounts = await readMirroredHelperCounts(page);
  if (JSON.stringify(mirroredPersistedCounts) !== JSON.stringify(persistedCounts)) {
    throw new Error("Helper charges were not mirrored into their dedicated storage key.");
  }

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "2048" }).waitFor();

  const restoredTiles = await collectTiles(page);
  if (JSON.stringify(restoredTiles) !== JSON.stringify(persistedTiles)) {
    throw new Error("Reload did not restore the saved board.");
  }

  const restoredCounts = await collectHelperCounts(page);
  if (JSON.stringify(restoredCounts) !== JSON.stringify(persistedCounts)) {
    throw new Error("Reload did not restore helper charges.");
  }

  const undoDisabled = await page.locator("#undo").isDisabled();
  if (undoDisabled) {
    throw new Error("Reload did not restore charged undo availability.");
  }

  await page.locator("#undo").click();
  await expectHelperCounts(page, { undo: 1, swap: 0, delete: 0 });
  const tilesAfterUndo = await collectTiles(page);
  const restoredSixtyFours = tilesAfterUndo.filter((tile) => tile.value === "64").length;
  if (restoredSixtyFours !== 4) {
    throw new Error(`Expected undo to restore four 64 tiles, got ${JSON.stringify(tilesAfterUndo)}`);
  }

  await setSavedGame(page, {
    board: [
      [128, 128, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    helperCharges: { undo: 2, swap: 0, delete: 0 },
  });
  await page.evaluate(() => {
    window.localStorage.setItem(
      "__test_random_values",
      JSON.stringify([0, 0, 0, 0, 0.5, 0]),
    );
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  const firstRandomizedMove = await collectTiles(page);
  await page.locator("#undo").click();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  const repeatedRandomizedMove = await collectTiles(page);

  if (JSON.stringify(repeatedRandomizedMove) === JSON.stringify(firstRandomizedMove)) {
    throw new Error(
      `Expected the repeated move after undo to reroll its spawn, got ${JSON.stringify(repeatedRandomizedMove)}`,
    );
  }

  await setSavedGame(page, {
    board: [
      [128, 128, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  await expectHelperCounts(page, { undo: 0, swap: 1, delete: 0 });
  await page.locator("#swap").click();
  await page.locator(".tile").nth(0).click();
  await page.locator(".tile").nth(1).click();
  await expectHelperCounts(page, { undo: 0, swap: 0, delete: 0 });

  await setSavedGame(page, {
    board: [
      [256, 256, 512, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(150);
  await expectHelperCounts(page, { undo: 0, swap: 0, delete: 1 });
  const tilesBeforeDelete = await collectTiles(page);
  const matchingTilesBeforeDelete = tilesBeforeDelete.filter((tile) => tile.value === "512");

  if (matchingTilesBeforeDelete.length !== 2) {
    throw new Error(`Expected two 512 tiles before delete, got ${JSON.stringify(tilesBeforeDelete)}`);
  }

  await page.locator("#delete").click();
  await clickLocatorCenter(page, page.locator(".tile", { hasText: "512" }).first());
  await expectHelperCounts(page, { undo: 0, swap: 0, delete: 0 });

  const tilesAfterDelete = await collectTiles(page);
  if (tilesAfterDelete.some((tile) => tile.value === "512")) {
    throw new Error(`Expected delete to remove every matching 512 tile, got ${JSON.stringify(tilesAfterDelete)}`);
  }

  if (tilesAfterDelete.length !== tilesBeforeDelete.length - matchingTilesBeforeDelete.length) {
    throw new Error(`Unexpected tile count after charged delete flow: ${JSON.stringify(tilesAfterDelete)}`);
  }

  await setSavedGame(page, {
    board: [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ],
    history: [
      {
        board: [
          [2, 4, 2, 0],
          [4, 2, 4, 2],
          [2, 4, 2, 4],
          [4, 2, 4, 2],
        ],
        score: 0,
        keepPlaying: false,
      },
    ],
  });
  await expectGameOverActions(page, { undoDisabled: true });

  await setSavedGame(page, {
    board: [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ],
    helperCharges: { undo: 1, swap: 0, delete: 0 },
    history: [
      {
        board: [
          [2, 4, 2, 0],
          [4, 2, 4, 2],
          [2, 4, 2, 4],
          [4, 2, 4, 2],
        ],
        score: 0,
        keepPlaying: false,
      },
    ],
  });
  await expectGameOverActions(page, { undoDisabled: false });
  await page.locator("#overlay-undo").click();
  await expectHelperCounts(page, { undo: 0, swap: 0, delete: 0 });

  if (!(await page.locator("#result-overlay").isHidden())) {
    throw new Error("Expected game-over overlay to close after charged undo.");
  }

  const restoredAfterGameOverUndo = await collectTiles(page);
  if (restoredAfterGameOverUndo.length !== 15) {
    throw new Error(
      `Expected overlay undo to restore the previous board, got ${JSON.stringify(restoredAfterGameOverUndo)}`,
    );
  }

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
        helperCharges: { undo: 0, swap: 0, delete: 0 },
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
        helperCharges: { undo: 0, swap: 0, delete: 0 },
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

  await setSavedGame(page, {
    board: [
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  });
  const touchStart = await getBoardCenter(page);
  await dispatchBoardPointer(page, "pointerdown", {
    pointerId: 41,
    pointerType: "touch",
    clientX: touchStart.x,
    clientY: touchStart.y,
  });
  await dispatchBoardPointer(page, "pointermove", {
    pointerId: 41,
    pointerType: "touch",
    clientX: touchStart.x,
    clientY: touchStart.y + 20,
  });
  await page.waitForTimeout(20);

  const touchTurnsAfterMove = await page.locator("#turns-count").textContent();
  if (touchTurnsAfterMove?.trim() !== "1") {
    throw new Error(
      `Expected short touch swipe to move before pointerup, got turns=${touchTurnsAfterMove}`,
    );
  }

  await dispatchBoardPointer(page, "pointerup", {
    pointerId: 41,
    pointerType: "touch",
    clientX: touchStart.x,
    clientY: touchStart.y + 20,
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await setSavedGame(page, {
    board: [
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  });
  const mouseStart = await getBoardCenter(page);
  await dispatchBoardPointer(page, "pointerdown", {
    pointerId: 42,
    pointerType: "mouse",
    clientX: mouseStart.x,
    clientY: mouseStart.y,
  });
  await dispatchBoardPointer(page, "pointermove", {
    pointerId: 42,
    pointerType: "mouse",
    clientX: mouseStart.x,
    clientY: mouseStart.y + 60,
  });
  await page.waitForTimeout(20);

  const mouseTurnsAfterMove = await page.locator("#turns-count").textContent();
  if (mouseTurnsAfterMove?.trim() !== "0") {
    throw new Error(
      `Expected desktop pointer drag to wait for pointerup, got turns=${mouseTurnsAfterMove}`,
    );
  }

  await dispatchBoardPointer(page, "pointerup", {
    pointerId: 42,
    pointerType: "mouse",
    clientX: mouseStart.x,
    clientY: mouseStart.y + 60,
  });
  await page.waitForTimeout(20);

  const mouseTurnsAfterUp = await page.locator("#turns-count").textContent();
  if (mouseTurnsAfterUp?.trim() !== "1") {
    throw new Error(
      `Expected desktop pointer drag to move on pointerup, got turns=${mouseTurnsAfterUp}`,
    );
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

async function clickLocatorCenter(page, locator) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Could not find a clickable tile bounding box.");
  }

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function getBoardCenter(page) {
  const box = await page.locator("#board").boundingBox();

  if (!box) {
    throw new Error("Could not find board bounding box.");
  }

  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

async function dispatchBoardPointer(page, type, details) {
  await page.dispatchEvent("#board", type, {
    bubbles: true,
    cancelable: true,
    isPrimary: true,
    ...details,
  });
}

async function setSavedGame(page, game) {
  await page.evaluate((nextGame) => {
    window.localStorage.setItem("__test_random_values", JSON.stringify([0, 0, 0, 0]));
    window.localStorage.setItem(
      "local-2048-game-state",
      JSON.stringify({
        version: 1,
        board: [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 0,
        bestScore: 0,
        helperCharges: { undo: 0, swap: 0, delete: 0 },
        keepPlaying: false,
        history: [],
        ...nextGame,
      }),
    );
  }, game);

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "2048" }).waitFor();
}

async function collectHelperCounts(page) {
  return page.locator(".helper-dock .tool-button").evaluateAll((buttons) =>
    Object.fromEntries(
      buttons.map((button) => [
        button.id,
        Number(button.getAttribute("data-charges") ?? "0"),
      ]),
    ),
  );
}

async function readStoredGameHelperCounts(page) {
  return page.evaluate(() => {
    const stored = window.localStorage.getItem("local-2048-game-state");
    return stored ? JSON.parse(stored).helperCharges : null;
  });
}

async function readMirroredHelperCounts(page) {
  return page.evaluate(() => {
    const stored = window.localStorage.getItem("local-2048-helper-charges");
    return stored ? JSON.parse(stored) : null;
  });
}

async function expectGameOverActions(page, { undoDisabled }) {
  await page.locator("#result-overlay").waitFor({ state: "visible" });

  const title = await page.locator("#result-title").textContent();
  if (title?.trim() !== "Game over") {
    throw new Error(`Expected Game over overlay, got ${title}`);
  }

  if (await page.locator("#keep-going").isVisible()) {
    throw new Error("Keep button should not be visible on game over.");
  }

  if (!(await page.locator("#overlay-undo").isVisible())) {
    throw new Error("Overlay Undo button should be visible on game over.");
  }

  if (!(await page.locator("#restart").isVisible())) {
    throw new Error("Restart button should be visible on game over.");
  }

  const actualUndoDisabled = await page.locator("#overlay-undo").isDisabled();
  if (actualUndoDisabled !== undoDisabled) {
    throw new Error(
      `Expected overlay Undo disabled=${undoDisabled}, got ${actualUndoDisabled}`,
    );
  }

  if (await page.locator("#restart").isDisabled()) {
    throw new Error("Restart should remain available on game over.");
  }
}

async function expectTileFontScale(page) {
  const fontSizes = await page.locator(".tile").evaluateAll((tiles) =>
    Object.fromEntries(
      tiles.map((tile) => [
        tile.textContent?.trim(),
        Number.parseFloat(
          getComputedStyle(tile.querySelector(".tile-inner")).fontSize,
        ),
      ]),
    ),
  );

  const baseSize = fontSizes["64"];
  const mediumSize = fontSizes["128"];
  const largeSize = fontSizes["1024"];

  if (!baseSize || !mediumSize || !largeSize) {
    throw new Error(`Could not read expected tile font sizes: ${JSON.stringify(fontSizes)}`);
  }

  const mediumRatio = mediumSize / baseSize;
  const largeRatio = largeSize / baseSize;

  if (mediumRatio <= 0.72 || mediumRatio >= 0.86) {
    throw new Error(`Expected 128 font to be close to original scale, got ratio=${mediumRatio}`);
  }

  if (largeRatio <= 0.56 || largeRatio >= mediumRatio) {
    throw new Error(`Expected 1024 font to be smaller than 128, got ratio=${largeRatio}`);
  }
}

async function expectHelperCounts(page, expected) {
  const counts = await collectHelperCounts(page);

  for (const [helper, count] of Object.entries(expected)) {
    if (counts[helper] !== count) {
      throw new Error(
        `Expected ${helper} charges to be ${count}, got ${counts[helper]} in ${JSON.stringify(counts)}`,
      );
    }

    const visiblePips = await page.locator(`#${helper} .charge-pip.is-filled`).count();
    if (visiblePips !== count) {
      throw new Error(`Expected ${helper} to show ${count} filled charge pips, got ${visiblePips}`);
    }
  }
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
