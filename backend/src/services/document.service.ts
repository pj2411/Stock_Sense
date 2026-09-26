import { DocumentStatus, Prisma } from "@prisma/client";
import { AppError } from "../lib/http";
import { prisma } from "../lib/prisma";

const receiptInclude = { items: { include: { product: { include: { uom: true } } } }, destination: { include: { warehouse: true } }, supplier: true, responsible: { select: { id: true, name: true, email: true } } } as const;
const deliveryInclude = { items: { include: { product: { include: { uom: true } } } }, source: { include: { warehouse: true } }, responsible: { select: { id: true, name: true, email: true } } } as const;
const transferInclude = { items: { include: { product: { include: { uom: true } } } }, source: { include: { warehouse: true } }, destination: { include: { warehouse: true } } } as const;
const adjustmentInclude = { items: { include: { product: { include: { uom: true } } } }, location: { include: { warehouse: true } } } as const;

const allowedTransitions: Record<string, Record<string, DocumentStatus[]>> = {
  receipt: { DRAFT: ["READY", "CANCELLED"], READY: ["CANCELLED", "DONE"] },
  delivery: { DRAFT: ["WAITING", "CANCELLED"], WAITING: ["READY", "CANCELLED"], READY: ["CANCELLED", "DONE"] },
  transfer: { DRAFT: ["READY", "CANCELLED"], READY: ["CANCELLED", "DONE"] },
  adjustment: { DRAFT: ["READY", "CANCELLED"], READY: ["CANCELLED", "DONE"] },
};

function assertTransition(type: string, current: DocumentStatus, next: DocumentStatus) {
  if (!allowedTransitions[type]?.[current]?.includes(next)) throw new AppError(409, "INVALID_DOCUMENT_STATE", `Cannot move ${type} from ${current} to ${next}`, { currentStatus: current, requestedStatus: next });
}

export async function transitionDocument(type: "receipt" | "delivery" | "transfer" | "adjustment", id: string, next: DocumentStatus, actorId: string) {
  return prisma.$transaction(async (tx: any) => {
    if (type === "receipt") {
      const record = await tx.receipt.findUnique({ where: { id } });
      if (!record) throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
      assertTransition(type, record.status, next);
      return tx.receipt.update({ where: { id }, data: { status: next }, include: receiptInclude });
    }
    if (type === "delivery") {
      const record = await tx.delivery.findUnique({ where: { id } });
      if (!record) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");
      assertTransition(type, record.status, next);
      return tx.delivery.update({ where: { id }, data: { status: next }, include: deliveryInclude });
    }
    if (type === "transfer") {
      const record = await tx.transfer.findUnique({ where: { id } });
      if (!record) throw new AppError(404, "TRANSFER_NOT_FOUND", "Transfer not found");
      assertTransition(type, record.status, next);
      return tx.transfer.update({ where: { id }, data: { status: next }, include: transferInclude });
    }
    const record = await tx.adjustment.findUnique({ where: { id } });
    if (!record) throw new AppError(404, "ADJUSTMENT_NOT_FOUND", "Adjustment not found");
    assertTransition(type, record.status, next);
    return tx.adjustment.update({ where: { id }, data: { status: next }, include: adjustmentInclude });
  });
}

export async function createReceipt(input: { reference: string; destinationId: string; supplierId?: string; responsibleId?: string; scheduledDate?: string }) {
  return prisma.receipt.create({ data: { reference: input.reference, destinationId: input.destinationId, supplierId: input.supplierId, responsibleId: input.responsibleId, scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : undefined }, include: receiptInclude });
}

export async function addReceiptItem(receiptId: string, input: { productId: string; quantity: number }) {
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt) throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
  if (receipt.status !== "DRAFT") throw new AppError(409, "INVALID_DOCUMENT_STATE", "Receipt items can only be edited while the receipt is Draft");
  return prisma.receiptItem.upsert({ where: { receiptId_productId: { receiptId, productId: input.productId } }, create: { receiptId, productId: input.productId, quantity: input.quantity }, update: { quantity: input.quantity }, include: { product: true } });
}

export async function createDelivery(input: { reference: string; sourceId: string; deliveryAddress?: string; contact?: string; responsibleId?: string; scheduledDate?: string }) {
  return prisma.delivery.create({ data: { reference: input.reference, sourceId: input.sourceId, deliveryAddress: input.deliveryAddress, contact: input.contact, responsibleId: input.responsibleId, scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : undefined }, include: deliveryInclude });
}

export async function addDeliveryItem(deliveryId: string, input: { productId: string; quantity: number }) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");
  if (delivery.status !== "DRAFT") throw new AppError(409, "INVALID_DOCUMENT_STATE", "Delivery items can only be edited while the delivery is Draft");
  return prisma.deliveryItem.upsert({ where: { deliveryId_productId: { deliveryId, productId: input.productId } }, create: { deliveryId, productId: input.productId, quantity: input.quantity }, update: { quantity: input.quantity }, include: { product: true } });
}

export async function createTransfer(input: { reference: string; sourceId: string; destinationId: string; responsibleId?: string; scheduledDate?: string }) {
  if (input.sourceId === input.destinationId) throw new AppError(400, "INVALID_TRANSFER", "Source and destination locations must differ");
  return prisma.transfer.create({ data: { reference: input.reference, sourceId: input.sourceId, destinationId: input.destinationId, responsibleId: input.responsibleId, scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : undefined }, include: transferInclude });
}

export async function addTransferItem(transferId: string, input: { productId: string; quantity: number }) {
  const transfer = await prisma.transfer.findUnique({ where: { id: transferId } });
  if (!transfer) throw new AppError(404, "TRANSFER_NOT_FOUND", "Transfer not found");
  if (transfer.status !== "DRAFT") throw new AppError(409, "INVALID_DOCUMENT_STATE", "Transfer items can only be edited while the transfer is Draft");
  return prisma.transferItem.upsert({ where: { transferId_productId: { transferId, productId: input.productId } }, create: { transferId, productId: input.productId, quantity: input.quantity }, update: { quantity: input.quantity }, include: { product: true } });
}

export async function createAdjustment(input: { reference: string; locationId: string; reason?: string; type?: "COUNT" | "INCREASE" | "DECREASE"; responsibleId?: string }) {
  return prisma.adjustment.create({ data: { reference: input.reference, locationId: input.locationId, reason: input.reason, type: input.type ?? "COUNT", responsibleId: input.responsibleId }, include: adjustmentInclude });
}

export async function addAdjustmentItem(adjustmentId: string, input: { productId: string; countedQuantity: number }) {
  const adjustment = await prisma.adjustment.findUnique({ where: { id: adjustmentId } });
  if (!adjustment) throw new AppError(404, "ADJUSTMENT_NOT_FOUND", "Adjustment not found");
  if (adjustment.status !== "DRAFT") throw new AppError(409, "INVALID_DOCUMENT_STATE", "Adjustment items can only be edited while the adjustment is Draft");
  return prisma.adjustmentItem.upsert({ where: { adjustmentId_productId: { adjustmentId, productId: input.productId } }, create: { adjustmentId, productId: input.productId, countedQuantity: input.countedQuantity }, update: { countedQuantity: input.countedQuantity }, include: { product: true } });
}

export async function listDocuments(type: "receipt" | "delivery" | "transfer" | "adjustment", search?: string) {
  const contains = search ? { contains: search, mode: "insensitive" as const } : undefined;
  if (type === "receipt") return prisma.receipt.findMany({ where: search ? { OR: [{ reference: contains }, { supplier: { name: contains } }, { destination: { name: contains } }] } : undefined, include: receiptInclude, orderBy: { createdAt: "desc" } });
  if (type === "delivery") return prisma.delivery.findMany({ where: search ? { OR: [{ reference: contains }, { contact: contains }, { source: { name: contains } }] } : undefined, include: deliveryInclude, orderBy: { createdAt: "desc" } });
  if (type === "transfer") return prisma.transfer.findMany({ where: search ? { OR: [{ reference: contains }, { source: { name: contains } }, { destination: { name: contains } }] } : undefined, include: transferInclude, orderBy: { createdAt: "desc" } });
  return prisma.adjustment.findMany({ where: search ? { OR: [{ reference: contains }, { reason: contains }, { location: { name: contains } }] } : undefined, include: adjustmentInclude, orderBy: { createdAt: "desc" } });
}

export async function getDocument(type: "receipt" | "delivery" | "transfer" | "adjustment", id: string) {
  if (type === "receipt") return prisma.receipt.findUnique({ where: { id }, include: receiptInclude });
  if (type === "delivery") return prisma.delivery.findUnique({ where: { id }, include: deliveryInclude });
  if (type === "transfer") return prisma.transfer.findUnique({ where: { id }, include: transferInclude });
  return prisma.adjustment.findUnique({ where: { id }, include: adjustmentInclude });
}
