import { prisma } from "../lib/prisma";

export async function listReorderRules() {
  return prisma.reorderRule.findMany({ include: { product: true, location: { include: { warehouse: true } } }, orderBy: { createdAt: "desc" } });
}

export async function createReorderRule(input: { productId: string; locationId: string; minQty: number; maxQty?: number }) {
  return prisma.reorderRule.upsert({ where: { productId_locationId: { productId: input.productId, locationId: input.locationId } }, create: input, update: { minQty: input.minQty, maxQty: input.maxQty }, include: { product: true, location: true } });
}

export async function updateReorderRule(id: string, input: { minQty?: number; maxQty?: number }) {
  return prisma.reorderRule.update({ where: { id }, data: input, include: { product: true, location: true } });
}

export async function deleteReorderRule(id: string) {
  await prisma.reorderRule.delete({ where: { id } });
}

export async function listNotifications(userId: string, unreadOnly = false) {
  return prisma.notification.findMany({ where: { OR: [{ userId }, { userId: null }], ...(unreadOnly ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" } });
}

export async function markNotificationRead(id: string, userId: string) {
  return prisma.notification.updateMany({ where: { id, OR: [{ userId }, { userId: null }] }, data: { readAt: new Date() } });
}

export async function listAuditLogs(query: { entityType?: string; entityId?: string; actorId?: string }) {
  return prisma.auditLog.findMany({ where: query, include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
}
