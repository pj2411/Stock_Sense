import { Prisma } from "@prisma/client";
import { AppError } from "../lib/http";
import { prisma } from "../lib/prisma";

export async function listProducts(search?: string) {
  return prisma.product.findMany({ where: search ? { OR: [{ sku: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] } : undefined, include: { category: true, uom: true }, orderBy: { name: "asc" } });
}

export async function getProduct(id: string) {
  const value = await prisma.product.findUnique({ where: { id }, include: { category: true, uom: true, inventoryBalances: { include: { location: { include: { warehouse: true } } } } } });
  if (!value) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  return value;
}

export async function createProduct(input: { sku: string; name: string; unitCost: number; categoryId: string; uomId: string; openingStock?: { locationId: string; quantity: number }; actorId: string }) {
  return prisma.$transaction(async (tx: any) => {
    const product = await tx.product.create({ data: { sku: input.sku, name: input.name, unitCost: input.unitCost, categoryId: input.categoryId, uomId: input.uomId }, include: { category: true, uom: true } });
    if (input.openingStock) {
      if (input.openingStock.quantity < 0) throw new AppError(400, "INVALID_OPENING_QUANTITY", "Opening quantity cannot be negative");
      const balance = await tx.inventoryBalance.create({ data: { productId: product.id, locationId: input.openingStock.locationId, onHand: input.openingStock.quantity } });
      await tx.stockLedger.create({ data: { productId: product.id, locationId: input.openingStock.locationId, type: "OPENING", quantityDelta: input.openingStock.quantity, balanceAfter: input.openingStock.quantity, referenceType: "OPENING", referenceId: balance.id, actorId: input.actorId } });
      await tx.auditLog.create({ data: { actorId: input.actorId, action: "INVENTORY_OPENING_CREATED", entityType: "InventoryBalance", entityId: balance.id, after: { onHand: input.openingStock.quantity }, metadata: { productId: product.id, locationId: input.openingStock.locationId } } });
    }
    return product;
  });
}

export async function updateProduct(id: string, input: { sku?: string; name?: string; unitCost?: number; categoryId?: string; uomId?: string; isActive?: boolean }) {
  return prisma.product.update({ where: { id }, data: input, include: { category: true, uom: true } });
}

export async function crudList(resource: "categories" | "uoms" | "warehouses" | "locations" | "suppliers", search?: string) {
  if (resource === "categories") return prisma.category.findMany({ where: search ? { name: { contains: search, mode: "insensitive" } } : undefined, orderBy: { name: "asc" } });
  if (resource === "uoms") return prisma.uom.findMany({ where: search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }] } : undefined, orderBy: { name: "asc" } });
  if (resource === "warehouses") return prisma.warehouse.findMany({ where: search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { shortCode: { contains: search, mode: "insensitive" } }] } : undefined, include: { locations: true }, orderBy: { name: "asc" } });
  if (resource === "locations") return prisma.location.findMany({ where: search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { shortCode: { contains: search, mode: "insensitive" } }] } : undefined, include: { warehouse: true }, orderBy: { name: "asc" } });
  return prisma.supplier.findMany({ where: search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : undefined, orderBy: { name: "asc" } });
}

export async function crudCreate(resource: "categories" | "uoms" | "warehouses" | "locations" | "suppliers", input: Record<string, unknown>) {
  if (resource === "categories") return prisma.category.create({ data: input as Prisma.CategoryCreateInput });
  if (resource === "uoms") return prisma.uom.create({ data: input as Prisma.UomCreateInput });
  if (resource === "warehouses") return prisma.warehouse.create({ data: input as Prisma.WarehouseCreateInput });
  if (resource === "locations") return prisma.location.create({ data: input as Prisma.LocationCreateInput, include: { warehouse: true } });
  return prisma.supplier.create({ data: input as Prisma.SupplierCreateInput });
}

export async function crudUpdate(resource: "categories" | "uoms" | "warehouses" | "locations" | "suppliers", id: string, input: Record<string, unknown>) {
  if (resource === "categories") return prisma.category.update({ where: { id }, data: input as Prisma.CategoryUpdateInput });
  if (resource === "uoms") return prisma.uom.update({ where: { id }, data: input as Prisma.UomUpdateInput });
  if (resource === "warehouses") return prisma.warehouse.update({ where: { id }, data: input as Prisma.WarehouseUpdateInput });
  if (resource === "locations") return prisma.location.update({ where: { id }, data: input as Prisma.LocationUpdateInput, include: { warehouse: true } });
  return prisma.supplier.update({ where: { id }, data: input as Prisma.SupplierUpdateInput });
}
