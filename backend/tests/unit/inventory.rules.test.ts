import { calculateAdjustmentDifference, calculateFreeToUse, documentTransitions } from "../../src/services/inventory.rules";

describe("inventory rules", () => {
  it("calculates free-to-use as on-hand less reserved", () => {
    expect(calculateFreeToUse(92, 1)).toBe(91);
  });

  it("calculates adjustment differences from the system quantity", () => {
    expect(calculateAdjustmentDifference(56, 50)).toBe(6);
    expect(calculateAdjustmentDifference(48, 50)).toBe(-2);
  });

  it("models the UI workflows", () => {
    expect(documentTransitions.receipt.DRAFT).toContain("READY");
    expect(documentTransitions.delivery.WAITING).toContain("READY");
    expect(documentTransitions.delivery.DRAFT).not.toContain("DONE");
  });
});
