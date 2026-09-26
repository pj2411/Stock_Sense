import "dotenv/config";
import { AdjustmentType, DocumentStatus, PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { validateAdjustment, validateDelivery, validateReceipt, validateTransfer } from "../src/services/inventory.service";

const prisma = new PrismaClient();

const demoProducts = [
  ["DESK-001", "Desk", 10.99, "Office Furniture"], ["CHAIR-002", "Ergonomic Chair", 7.5, "Office Furniture"], ["LAMP-003", "Desk Lamp", 3.25, "Office Furniture"], ["MONITOR-004", "24-inch Monitor", 14.99, "Electronics"], ["KEYBOARD-005", "Mechanical Keyboard", 5.8, "Electronics"],
  ["MOUSE-006", "Wireless Mouse", 2.4, "Electronics"], ["DOCK-007", "USB-C Dock", 9.75, "Electronics"], ["CABLE-008", "HDMI Cable", 1.3, "Electronics"], ["PAPER-009", "Printer Paper Pack", 1.15, "Packaging"], ["BOX-010", "Shipping Box", 0.8, "Packaging"],
  ["TAPE-011", "Packing Tape", 0.55, "Packaging"], ["LABEL-012", "Label Roll", 0.95, "Packaging"], ["VEST-013", "Safety Vest", 2.1, "Safety"], ["GLOVE-014", "Work Gloves", 1.75, "Safety"], ["HELMET-015", "Safety Helmet", 4.25, "Safety"],
  ["SCANNER-016", "Barcode Scanner", 12.5, "Electronics"], ["TABLE-017", "Packing Table", 18.25, "Office Furniture"], ["SHELF-018", "Storage Shelf", 22.0, "Office Furniture"], ["BIN-019", "Parts Bin", 1.9, "Packaging"], ["TROLLEY-020", "Warehouse Trolley", 16.5, "Office Furniture"],
] as const;

const demoStatuses: DocumentStatus[] = [DocumentStatus.READY, DocumentStatus.DRAFT, DocumentStatus.READY, DocumentStatus.CANCELLED, DocumentStatus.DRAFT];

async function main() {
  const passwordHash = await argon2.hash("ChangeMe123!");
  const [admin, manager, operator, auditor] = await Promise.all([
    prisma.user.upsert({ where: { email: "admin@stocksense.local" }, update: {}, create: { name: "StockSense Admin", email: "admin@stocksense.local", passwordHash, role: "ADMIN" } }),
    prisma.user.upsert({ where: { email: "manager@stocksense.local" }, update: {}, create: { name: "Warehouse Manager", email: "manager@stocksense.local", passwordHash, role: "MANAGER" } }),
    prisma.user.upsert({ where: { email: "operator@stocksense.local" }, update: {}, create: { name: "Warehouse Operator", email: "operator@stocksense.local", passwordHash, role: "OPERATOR" } }),
    prisma.user.upsert({ where: { email: "auditor@stocksense.local" }, update: {}, create: { name: "Stock Auditor", email: "auditor@stocksense.local", passwordHash, role: "AUDITOR" } }),
  ]);

  const categories = new Map<string, string>();
  for (const name of ["Office Furniture", "Electronics", "Packaging", "Safety"]) {
    const category = await prisma.category.upsert({ where: { name }, update: {}, create: { name, description: "StockSense demo catalog category" } });
    categories.set(name, category.id);
  }
  const uom = await prisma.uom.upsert({ where: { code: "UNIT" }, update: {}, create: { name: "Unit", code: "UNIT" } });

  const warehouse = await prisma.warehouse.upsert({ where: { shortCode: "WH" }, update: {}, create: { name: "Main Warehouse", shortCode: "WH", address: "StockSense Demo Warehouse" } });
  const overflowWarehouse = await prisma.warehouse.upsert({ where: { shortCode: "OVF" }, update: {}, create: { name: "Overflow Warehouse", shortCode: "OVF", address: "StockSense Overflow Facility" } });
  const locations = [
    await prisma.location.upsert({ where: { warehouseId_shortCode: { warehouseId: warehouse.id, shortCode: "STOCK" } }, update: {}, create: { warehouseId: warehouse.id, name: "Main Stock", shortCode: "STOCK" } }),
    await prisma.location.upsert({ where: { warehouseId_shortCode: { warehouseId: warehouse.id, shortCode: "PICK" } }, update: {}, create: { warehouseId: warehouse.id, name: "Dispatch Zone", shortCode: "PICK" } }),
    await prisma.location.upsert({ where: { warehouseId_shortCode: { warehouseId: overflowWarehouse.id, shortCode: "OVERFLOW" } }, update: {}, create: { warehouseId: overflowWarehouse.id, name: "Overflow Storage", shortCode: "OVERFLOW" } }),
  ];

  const suppliers = [];
  for (let index = 0; index < 20; index += 1) {
    const suffix = String(index + 1).padStart(3, "0");
    const id = `00000000-0000-0000-0000-000000000${suffix}`;
    suppliers.push(await prisma.supplier.upsert({ where: { id }, update: {}, create: { id, name: index === 0 ? "Demo Supplier" : `Demo Supplier ${suffix}`, email: `supplier${suffix}@stocksense.local`, phone: `+91 90000 00${suffix}` } }));
  }

  const products = [];
  for (const [sku, name, unitCost, categoryName] of demoProducts) {
    products.push(await prisma.product.upsert({ where: { sku }, update: { name, unitCost, categoryId: categories.get(categoryName), uomId: uom.id }, create: { sku, name, unitCost, categoryId: categories.get(categoryName)!, uomId: uom.id } }));
  }

  for (const [productIndex, product] of products.entries()) {
    for (const [locationIndex, location] of locations.entries()) {
      const initialQuantity = locationIndex === 0 ? 70 + (productIndex % 8) : locationIndex === 1 ? 30 + (productIndex % 5) : 12 + (productIndex % 4);
      const balance = await prisma.inventoryBalance.upsert({ where: { productId_locationId: { productId: product.id, locationId: location.id } }, update: {}, create: { productId: product.id, locationId: location.id, onHand: initialQuantity } });
      const opening = await prisma.stockLedger.findFirst({ where: { referenceType: "OPENING", referenceId: balance.id } });
      if (!opening) await prisma.stockLedger.create({ data: { productId: product.id, locationId: location.id, type: "OPENING", quantityDelta: balance.onHand, balanceAfter: balance.onHand, referenceType: "OPENING", referenceId: balance.id, actorId: admin.id } });
      if (locationIndex < 2) await prisma.reorderRule.upsert({ where: { productId_locationId: { productId: product.id, locationId: location.id } }, update: {}, create: { productId: product.id, locationId: location.id, minQty: locationIndex === 0 ? 18 : 10, maxQty: locationIndex === 0 ? 100 : 60 } });
    }
  }

  for (let index = 0; index < 20; index += 1) {
    const product = products[index % products.length];
    const supplier = suppliers[index % suppliers.length];
    const destination = locations[index % locations.length];
    const source = locations[(index + 1) % locations.length];
    const scheduledDate = new Date(Date.now() + (index - 5) * 86400000);
    const receiptReference = `WH/IN/DEMO-${String(index + 1).padStart(3, "0")}`;
    const receipt = await prisma.receipt.upsert({ where: { reference: receiptReference }, update: {}, create: { reference: receiptReference, destinationId: destination.id, supplierId: supplier.id, responsibleId: manager.id, scheduledDate, status: demoStatuses[index % demoStatuses.length] } });
    await prisma.receiptItem.upsert({ where: { receiptId_productId: { receiptId: receipt.id, productId: product.id } }, update: {}, create: { receiptId: receipt.id, productId: product.id, quantity: 8 + (index % 7) } });

    const deliveryReference = `WH/OUT/DEMO-${String(index + 1).padStart(3, "0")}`;
    const delivery = await prisma.delivery.upsert({ where: { reference: deliveryReference }, update: {}, create: { reference: deliveryReference, sourceId: source.id, deliveryAddress: `${index + 1} Demo Customer Road`, contact: `Customer ${String(index + 1).padStart(2, "0")}`, responsibleId: operator.id, scheduledDate, status: [DocumentStatus.READY, DocumentStatus.READY, DocumentStatus.DRAFT, DocumentStatus.CANCELLED][index % 4] } });
    if (index === 0 && delivery.status === DocumentStatus.WAITING) await prisma.delivery.update({ where: { id: delivery.id }, data: { status: DocumentStatus.READY } });
    await prisma.deliveryItem.upsert({ where: { deliveryId_productId: { deliveryId: delivery.id, productId: product.id } }, update: {}, create: { deliveryId: delivery.id, productId: product.id, quantity: 2 + (index % 4) } });

    const transferReference = `WH/MOVE/DEMO-${String(index + 1).padStart(3, "0")}`;
    const transfer = await prisma.transfer.upsert({ where: { reference: transferReference }, update: {}, create: { reference: transferReference, sourceId: source.id, destinationId: destination.id, responsibleId: manager.id, scheduledDate, status: demoStatuses[index % demoStatuses.length] } });
    await prisma.transferItem.upsert({ where: { transferId_productId: { transferId: transfer.id, productId: product.id } }, update: {}, create: { transferId: transfer.id, productId: product.id, quantity: 3 + (index % 5) } });

    const adjustmentReference = `WH/ADJ/DEMO-${String(index + 1).padStart(3, "0")}`;
    const adjustment = await prisma.adjustment.upsert({ where: { reference: adjustmentReference }, update: {}, create: { reference: adjustmentReference, locationId: destination.id, reason: index % 2 === 0 ? "Cycle count" : "Damaged stock review", type: AdjustmentType.COUNT, responsibleId: auditor.id, status: demoStatuses[index % demoStatuses.length] } });
    await prisma.adjustmentItem.upsert({ where: { adjustmentId_productId: { adjustmentId: adjustment.id, productId: product.id } }, update: {}, create: { adjustmentId: adjustment.id, productId: product.id, countedQuantity: 60 + (index % 9) } });
  }

  const [demoReceipt, demoDelivery, demoTransfer, demoAdjustment] = await Promise.all([
    prisma.receipt.findUnique({ where: { reference: "WH/IN/DEMO-001" } }),
    prisma.delivery.findUnique({ where: { reference: "WH/OUT/DEMO-001" } }),
    prisma.transfer.findUnique({ where: { reference: "WH/MOVE/DEMO-001" } }),
    prisma.adjustment.findUnique({ where: { reference: "WH/ADJ/DEMO-001" } }),
  ]);
  if (demoReceipt && demoReceipt.status === DocumentStatus.READY) await validateReceipt(demoReceipt.id, admin.id);
  if (demoDelivery && demoDelivery.status === DocumentStatus.READY) await validateDelivery(demoDelivery.id, operator.id);
  if (demoTransfer && demoTransfer.status === DocumentStatus.READY) await validateTransfer(demoTransfer.id, manager.id);
  if (demoAdjustment && demoAdjustment.status === DocumentStatus.READY) await validateAdjustment(demoAdjustment.id, auditor.id);

  await prisma.notification.upsert({ where: { id: "00000000-0000-0000-0000-000000000901" }, update: {}, create: { id: "00000000-0000-0000-0000-000000000901", userId: admin.id, productId: products[0].id, locationId: locations[0].id, type: "LOW_STOCK", severity: "WARNING", title: "Demo stock review", message: "Demo data is ready across all operational workflows." } });
  console.log(`Seeded users: ${[admin, manager, operator, auditor].map((user) => user.email).join(", ")}`);
  console.log("Seed password for local development: ChangeMe123!");
  console.log("Seeded demo data: 20 products, 20 receipts, 20 deliveries, 20 transfers, 20 adjustments.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
