import { LedgerType, Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/http";
import { prisma } from "../lib/prisma";

type Tx = any;
const balanceInclude = { product: { include: { uom: true, category: true } }, location: { include: { warehouse: true } } } as const;

function decimal(value: Prisma.Decimal | number | string) { return new Prisma.Decimal(value); }
function freeToUse(onHand: Prisma.Decimal, reserved: Prisma.Decimal) { return onHand.minus(reserved); }

async function lockBalance(tx: Tx, productId: string, locationId: string, createIfMissing = false) {
  await tx.$queryRaw`SELECT id FROM inventory_balances WHERE product_id = CAST(${productId} AS uuid) AND location_id = CAST(${locationId} AS uuid) FOR UPDATE`;
  let balance = await tx.inventoryBalance.findUnique({ where: { productId_locationId: { productId, locationId } }, include: balanceInclude });
  if (!balance && createIfMissing) {
    balance = await tx.inventoryBalance.create({ data: { productId, locationId }, include: balanceInclude });
    await tx.$queryRaw`SELECT id FROM inventory_balances WHERE id = CAST(${balance.id} AS uuid) FOR UPDATE`;
  }
  if (!balance) throw new AppError(409, "INVENTORY_BALANCE_MISSING", "Inventory balance does not exist for this product and location", { productId, locationId });
  return balance;
}

async function audit(tx: Tx, actorId: string | undefined, action: string, entityType: string, entityId: string, after: unknown, metadata: unknown = {}) {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, after: after as Prisma.InputJsonValue, metadata: metadata as Prisma.InputJsonValue } });
}

async function ledger(tx: Tx, input: { productId: string; locationId: string; type: LedgerType; quantityDelta: Prisma.Decimal; balanceAfter: Prisma.Decimal; referenceType: string; referenceId: string; actorId?: string }) {
  await tx.stockLedger.create({ data: { ...input, quantityDelta: input.quantityDelta, balanceAfter: input.balanceAfter, actorId: input.actorId } });
}

export async function createOpeningInventory(input: { productId: string; locationId: string; quantity: number; actorId?: string }) {
  if (input.quantity < 0) throw new AppError(400, "INVALID_OPENING_QUANTITY", "Opening quantity cannot be negative");
  return prisma.$transaction(async (tx: Tx) => {
    const existing = await tx.inventoryBalance.findUnique({ where: { productId_locationId: { productId: input.productId, locationId: input.locationId } } });
    if (existing) throw new AppError(409, "OPENING_ALREADY_EXISTS", "An opening inventory record already exists for this product and location");
    const balance = await tx.inventoryBalance.create({ data: { productId: input.productId, locationId: input.locationId, onHand: decimal(input.quantity) }, include: balanceInclude });
    await ledger(tx, { productId: input.productId, locationId: input.locationId, type: LedgerType.OPENING, quantityDelta: decimal(input.quantity), balanceAfter: decimal(input.quantity), referenceType: "OPENING", referenceId: balance.id, actorId: input.actorId });
    await audit(tx, input.actorId, "INVENTORY_OPENING_CREATED", "InventoryBalance", balance.id, { onHand: input.quantity }, { productId: input.productId, locationId: input.locationId });
    return balance;
  });
}

export async function listInventory(query: { productId?: string; locationId?: string; search?: string }) {
  const balances = await prisma.inventoryBalance.findMany({
    where: { productId: query.productId, locationId: query.locationId, ...(query.search ? { product: { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { sku: { contains: query.search, mode: "insensitive" } }] } } : {}) },
    include: balanceInclude,
    orderBy: { updatedAt: "desc" },
  });
  return balances.map((item: any) => ({ ...item, freeToUse: freeToUse(item.onHand, item.reserved) }));
}

export async function listLedger(query: { productId?: string; locationId?: string; referenceType?: string; search?: string }) {
  return prisma.stockLedger.findMany({ where: { productId: query.productId, locationId: query.locationId, referenceType: query.referenceType, ...(query.search ? { OR: [{ referenceType: { contains: query.search, mode: "insensitive" } }, { type: { equals: query.search.toUpperCase() as LedgerType } }] } : {}) }, include: { product: true, location: { include: { warehouse: true } }, actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } });
}

export async function validateReceipt(receiptId: string, actorId: string) {
  return prisma.$transaction(async (tx: Tx) => {
    const receipt = await tx.receipt.findUnique({ where: { id: receiptId }, include: { items: true, destination: true } });
    if (!receipt) throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
    if (receipt.status === "DONE") return receipt;
    if (receipt.status === "CANCELLED") throw new AppError(409, "DOCUMENT_CANCELLED", "Cancelled receipts cannot be validated");
    if (receipt.status !== "READY") throw new AppError(409, "INVALID_DOCUMENT_STATE", "Receipt must be Ready before validation", { currentStatus: receipt.status });
    if (receipt.items.length === 0) throw new AppError(409, "EMPTY_DOCUMENT", "Receipt must contain at least one product");
    for (const item of receipt.items) {
      const current = await lockBalance(tx, item.productId, receipt.destinationId, true);
      const nextOnHand = current.onHand.plus(item.quantity);
      await tx.inventoryBalance.update({ where: { id: current.id }, data: { onHand: nextOnHand } });
      await tx.receiptItem.update({ where: { id: item.id }, data: { processedQuantity: item.quantity } });
      await ledger(tx, { productId: item.productId, locationId: receipt.destinationId, type: LedgerType.RECEIPT, quantityDelta: item.quantity, balanceAfter: nextOnHand, referenceType: "RECEIPT", referenceId: receipt.id, actorId });
    }
    const updated = await tx.receipt.update({ where: { id: receipt.id }, data: { status: "DONE" }, include: { items: true, destination: true } });
    await audit(tx, actorId, "RECEIPT_VALIDATED", "Receipt", receipt.id, { status: "DONE" }, { reference: receipt.reference });
    return updated;
  });
}

export async function validateDelivery(deliveryId: string, actorId: string) {
  return prisma.$transaction(async (tx: Tx) => {
    const delivery = await tx.delivery.findUnique({ where: { id: deliveryId }, include: { items: true, source: true } });
    if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");
    if (delivery.status === "DONE") return delivery;
    if (delivery.status === "CANCELLED") throw new AppError(409, "DOCUMENT_CANCELLED", "Cancelled deliveries cannot be validated");
    if (delivery.status !== "READY") throw new AppError(409, "INVALID_DOCUMENT_STATE", "Delivery must be Ready before validation", { currentStatus: delivery.status });
    if (delivery.items.length === 0) throw new AppError(409, "EMPTY_DOCUMENT", "Delivery must contain at least one product");
    for (const item of delivery.items) {
      const current = await lockBalance(tx, item.productId, delivery.sourceId);
      const available = freeToUse(current.onHand, current.reserved);
      if (available.lt(item.quantity)) throw new AppError(409, "INSUFFICIENT_STOCK", "Delivery quantity exceeds free stock", { productId: item.productId, requested: item.quantity.toString(), freeToUse: available.toString() });
      const nextOnHand = current.onHand.minus(item.quantity);
      await tx.inventoryBalance.update({ where: { id: current.id }, data: { onHand: nextOnHand } });
      await tx.deliveryItem.update({ where: { id: item.id }, data: { processedQuantity: item.quantity } });
      await ledger(tx, { productId: item.productId, locationId: delivery.sourceId, type: LedgerType.DELIVERY, quantityDelta: item.quantity.negated(), balanceAfter: nextOnHand, referenceType: "DELIVERY", referenceId: delivery.id, actorId });
    }
    const updated = await tx.delivery.update({ where: { id: delivery.id }, data: { status: "DONE" }, include: { items: true, source: true } });
    await audit(tx, actorId, "DELIVERY_VALIDATED", "Delivery", delivery.id, { status: "DONE" }, { reference: delivery.reference });
    return updated;
  });
}

export async function validateTransfer(transferId: string, actorId: string) {
  return prisma.$transaction(async (tx: Tx) => {
    const transfer = await tx.transfer.findUnique({ where: { id: transferId }, include: { items: true, source: true, destination: true } });
    if (!transfer) throw new AppError(404, "TRANSFER_NOT_FOUND", "Transfer not found");
    if (transfer.status === "DONE") return transfer;
    if (transfer.status === "CANCELLED") throw new AppError(409, "DOCUMENT_CANCELLED", "Cancelled transfers cannot be validated");
    if (transfer.status !== "READY") throw new AppError(409, "INVALID_DOCUMENT_STATE", "Transfer must be Ready before validation", { currentStatus: transfer.status });
    if (transfer.sourceId === transfer.destinationId) throw new AppError(409, "INVALID_TRANSFER", "Source and destination locations must differ");
    if (transfer.items.length === 0) throw new AppError(409, "EMPTY_DOCUMENT", "Transfer must contain at least one product");
    for (const item of transfer.items) {
      const ordered = [transfer.sourceId, transfer.destinationId].sort();
      const first = await lockBalance(tx, item.productId, ordered[0], ordered[0] === transfer.destinationId);
      const second = await lockBalance(tx, item.productId, ordered[1], ordered[1] === transfer.destinationId);
      const source = transfer.sourceId === ordered[0] ? first : second;
      const destination = transfer.destinationId === ordered[0] ? first : second;
      const available = freeToUse(source.onHand, source.reserved);
      if (available.lt(item.quantity)) throw new AppError(409, "INSUFFICIENT_STOCK", "Transfer quantity exceeds free stock", { productId: item.productId, requested: item.quantity.toString(), freeToUse: available.toString() });
      const sourceOnHand = source.onHand.minus(item.quantity);
      const destinationOnHand = destination.onHand.plus(item.quantity);
      await tx.inventoryBalance.update({ where: { id: source.id }, data: { onHand: sourceOnHand } });
      await tx.inventoryBalance.update({ where: { id: destination.id }, data: { onHand: destinationOnHand } });
      await ledger(tx, { productId: item.productId, locationId: transfer.sourceId, type: LedgerType.TRANSFER_OUT, quantityDelta: item.quantity.negated(), balanceAfter: sourceOnHand, referenceType: "TRANSFER", referenceId: transfer.id, actorId });
      await ledger(tx, { productId: item.productId, locationId: transfer.destinationId, type: LedgerType.TRANSFER_IN, quantityDelta: item.quantity, balanceAfter: destinationOnHand, referenceType: "TRANSFER", referenceId: transfer.id, actorId });
    }
    const updated = await tx.transfer.update({ where: { id: transfer.id }, data: { status: "DONE" }, include: { items: true, source: true, destination: true } });
    await audit(tx, actorId, "TRANSFER_VALIDATED", "Transfer", transfer.id, { status: "DONE" }, { reference: transfer.reference });
    return updated;
  });
}

export async function validateAdjustment(adjustmentId: string, actorId: string) {
  return prisma.$transaction(async (tx: Tx) => {
    const adjustment = await tx.adjustment.findUnique({ where: { id: adjustmentId }, include: { items: true, location: true } });
    if (!adjustment) throw new AppError(404, "ADJUSTMENT_NOT_FOUND", "Adjustment not found");
    if (adjustment.status === "DONE") return adjustment;
    if (adjustment.status === "CANCELLED") throw new AppError(409, "DOCUMENT_CANCELLED", "Cancelled adjustments cannot be validated");
    if (adjustment.status !== "READY") throw new AppError(409, "INVALID_DOCUMENT_STATE", "Adjustment must be Ready before validation", { currentStatus: adjustment.status });
    if (adjustment.items.length === 0) throw new AppError(409, "EMPTY_DOCUMENT", "Adjustment must contain at least one product");
    for (const item of adjustment.items) {
      const current = await lockBalance(tx, item.productId, adjustment.locationId, true);
      const difference = decimal(item.countedQuantity).minus(current.onHand);
      const nextOnHand = current.onHand.plus(difference);
      if (nextOnHand.lt(0)) throw new AppError(409, "INVALID_ADJUSTMENT", "Adjustment cannot make stock negative", { productId: item.productId });
      await tx.inventoryBalance.update({ where: { id: current.id }, data: { onHand: nextOnHand } });
      await tx.adjustmentItem.update({ where: { id: item.id }, data: { systemQuantity: current.onHand, difference } });
      await ledger(tx, { productId: item.productId, locationId: adjustment.locationId, type: LedgerType.ADJUSTMENT, quantityDelta: difference, balanceAfter: nextOnHand, referenceType: "ADJUSTMENT", referenceId: adjustment.id, actorId });
    }
    const updated = await tx.adjustment.update({ where: { id: adjustment.id }, data: { status: "DONE" }, include: { items: true, location: true } });
    await audit(tx, actorId, "ADJUSTMENT_VALIDATED", "Adjustment", adjustment.id, { status: "DONE" }, { reference: adjustment.reference });
    return updated;
  });
}

export async function dashboard() {
  const [stock, receipts, deliveries, lowStockRules] = await Promise.all([
    prisma.inventoryBalance.aggregate({ _sum: { onHand: true, reserved: true } }),
    prisma.receipt.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.delivery.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.reorderRule.findMany({ include: { product: true, location: true } }),
  ]);
  const lowStock = [];
  for (const rule of lowStockRules) {
    const balance = await prisma.inventoryBalance.findUnique({ where: { productId_locationId: { productId: rule.productId, locationId: rule.locationId } } });
    if (!balance || balance.onHand.lt(rule.minQty)) lowStock.push({ rule, balance });
  }
  return { stock: { onHand: stock._sum.onHand ?? 0, reserved: stock._sum.reserved ?? 0, freeToUse: decimal(stock._sum.onHand ?? 0).minus(stock._sum.reserved ?? 0) }, receipts, deliveries, lowStock };
}
