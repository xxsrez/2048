export const BEST_SCORE_KEY = "local-2048-best-score";
export const BEST_SCORE_BACKUP_KEY = "local-2048-best-score-v2";

type BestScoreStorage = Pick<Storage, "getItem" | "setItem">;

export function readBestScore(storage: BestScoreStorage): number {
  return Math.max(
    readStoredScore(storage, BEST_SCORE_KEY),
    readStoredScore(storage, BEST_SCORE_BACKUP_KEY),
  );
}

export function preserveBestScore(
  storage: BestScoreStorage,
  candidate: number,
): number {
  const bestScore = Math.max(readBestScore(storage), normalizeScore(candidate));

  writeStoredScore(storage, BEST_SCORE_BACKUP_KEY, bestScore);
  writeStoredScore(storage, BEST_SCORE_KEY, bestScore);

  return bestScore;
}

function readStoredScore(storage: BestScoreStorage, key: string): number {
  try {
    return normalizeScore(storage.getItem(key));
  } catch {
    return 0;
  }
}

function writeStoredScore(
  storage: BestScoreStorage,
  key: string,
  bestScore: number,
): void {
  try {
    storage.setItem(key, String(bestScore));
  } catch {
    // The in-memory record remains available when browser storage is blocked.
  }
}

function normalizeScore(value: unknown): number {
  if (value === null || value === "") {
    return 0;
  }

  const score = Number(value);
  return Number.isSafeInteger(score) && score >= 0 ? score : 0;
}
