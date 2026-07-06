import { getLargestTile, type Board } from "./game";

export type BoardHelperMode = "swap" | "delete";
export type HelperAction = "undo" | BoardHelperMode;
export type HelperMode = "move" | BoardHelperMode;
export type HelperCharges = Record<HelperAction, number>;

export const HELPER_MAX_CHARGES = 2;
export const HELPER_ACTIONS: HelperAction[] = ["undo", "swap", "delete"];
export const HELPER_LABELS: Record<HelperAction, string> = {
  undo: "Undo",
  swap: "Swap 2",
  delete: "Delete tile",
};

const HELPER_REWARD_BY_TILE = new Map<number, HelperAction>([
  [128, "undo"],
  [256, "swap"],
  [512, "delete"],
]);

export function createEmptyHelperCharges(): HelperCharges {
  return {
    undo: 0,
    swap: 0,
    delete: 0,
  };
}

export function awardHelperCharges(
  currentCharges: HelperCharges,
  mergedTileValues: number[],
): HelperCharges {
  const nextCharges = { ...currentCharges };

  mergedTileValues.forEach((tileValue) => {
    const action = HELPER_REWARD_BY_TILE.get(tileValue);

    if (!action) {
      return;
    }

    nextCharges[action] = Math.min(
      nextCharges[action] + 1,
      HELPER_MAX_CHARGES,
    );
  });

  return nextCharges;
}

export function consumeHelperCharge(
  currentCharges: HelperCharges,
  action: HelperAction,
): HelperCharges {
  return {
    ...currentCharges,
    [action]: Math.max(currentCharges[action] - 1, 0),
  };
}

export function parseHelperCharges(value: unknown): HelperCharges | null {
  if (!isRecord(value)) {
    return null;
  }

  const charges = createEmptyHelperCharges();

  for (const action of HELPER_ACTIONS) {
    const parsedCharge = parseNonNegativeInteger(value[action]);

    if (parsedCharge === null) {
      return null;
    }

    charges[action] = Math.min(parsedCharge, HELPER_MAX_CHARGES);
  }

  return charges;
}

export function inferHelperChargesFromBoard(board: Board | null): HelperCharges {
  const charges = createEmptyHelperCharges();

  if (!board) {
    return charges;
  }

  const largestTile = getLargestTile(board);

  charges.undo = largestTile >= 256 ? 2 : largestTile >= 128 ? 1 : 0;
  charges.swap = largestTile >= 512 ? 2 : largestTile >= 256 ? 1 : 0;
  charges.delete = largestTile >= 1024 ? 2 : largestTile >= 512 ? 1 : 0;

  return charges;
}

function parseNonNegativeInteger(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && numberValue >= 0
    ? numberValue
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
