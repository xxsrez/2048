import { describe, expect, it } from "vitest";
import {
  BEST_SCORE_BACKUP_KEY,
  BEST_SCORE_KEY,
  preserveBestScore,
  readBestScore,
} from "./best-score";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("best score persistence", () => {
  it("migrates the existing record into a protected backup", () => {
    const storage = new MemoryStorage();
    storage.setItem(BEST_SCORE_KEY, "1700000");

    expect(preserveBestScore(storage, 32000)).toBe(1700000);
    expect(storage.getItem(BEST_SCORE_KEY)).toBe("1700000");
    expect(storage.getItem(BEST_SCORE_BACKUP_KEY)).toBe("1700000");
  });

  it("recovers after an older tab overwrites the legacy key", () => {
    const storage = new MemoryStorage();
    preserveBestScore(storage, 1700000);

    storage.setItem(BEST_SCORE_KEY, "32000");

    expect(readBestScore(storage)).toBe(1700000);
    expect(preserveBestScore(storage, 32000)).toBe(1700000);
    expect(storage.getItem(BEST_SCORE_KEY)).toBe("1700000");
  });

  it("accepts a new higher record and rejects invalid stored values", () => {
    const storage = new MemoryStorage();
    storage.setItem(BEST_SCORE_KEY, "not-a-score");
    storage.setItem(BEST_SCORE_BACKUP_KEY, "-1");

    expect(preserveBestScore(storage, 64000)).toBe(64000);
    expect(readBestScore(storage)).toBe(64000);
  });
});
