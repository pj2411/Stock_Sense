export function calculateFreeToUse(onHand: number, reserved: number) {
  return onHand - reserved;
}

export function calculateAdjustmentDifference(countedQuantity: number, systemQuantity: number) {
  return countedQuantity - systemQuantity;
}

export const documentTransitions = {
  receipt: { DRAFT: ["READY", "CANCELLED"], READY: ["CANCELLED", "DONE"] },
  delivery: { DRAFT: ["WAITING", "CANCELLED"], WAITING: ["READY", "CANCELLED"], READY: ["CANCELLED", "DONE"] },
} as const;
