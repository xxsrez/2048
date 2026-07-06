import { describe, expect, it } from "vitest";
import {
  awardHelperCharges,
  consumeHelperCharge,
  createEmptyHelperCharges,
  inferHelperChargesFromBoard,
  parseHelperCharges,
} from "./helpers";

describe("helper charge rules", () => {
  it("awards capped charges for 128, 256, and 512 merges", () => {
    const charges = awardHelperCharges(createEmptyHelperCharges(), [
      128,
      128,
      128,
      256,
      512,
      1024,
    ]);

    expect(charges).toEqual({
      undo: 2,
      swap: 1,
      delete: 1,
    });
  });

  it("spends helper charges without going below zero", () => {
    const charges = consumeHelperCharge(
      { undo: 1, swap: 0, delete: 2 },
      "swap",
    );

    expect(charges).toEqual({
      undo: 1,
      swap: 0,
      delete: 2,
    });
    expect(consumeHelperCharge(charges, "delete").delete).toBe(1);
  });

  it("parses and clamps persisted charges", () => {
    expect(parseHelperCharges({ undo: 10, swap: 1, delete: 0 })).toEqual({
      undo: 2,
      swap: 1,
      delete: 0,
    });
    expect(parseHelperCharges({ undo: 1, swap: -1, delete: 0 })).toBeNull();
  });

  it("infers legacy charges from the largest tile", () => {
    expect(
      inferHelperChargesFromBoard([
        [512, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
    ).toEqual({
      undo: 2,
      swap: 2,
      delete: 1,
    });
  });
});
