export type Role = "ADMIN" | "MANAGER" | "OPERATOR" | "AUDITOR";
export type Status = "DRAFT" | "READY" | "WAITING" | "DONE" | "CANCELLED";

export interface User { id: string; email: string; name: string; role: Role; isActive: boolean; createdAt: string; }
export interface Product { id: string; sku: string; name: string; unitCost: number | string; isActive: boolean; category?: { id: string; name: string }; uom?: { id: string; name: string; code: string }; }
export interface Category { id: string; name: string; description?: string; }
export interface Uom { id: string; name: string; code: string; }
export interface Warehouse { id: string; name: string; shortCode: string; address?: string; locations?: Location[]; }
export interface Location { id: string; name: string; shortCode: string; warehouseId: string; warehouse?: Warehouse; }
export interface Supplier { id: string; name: string; email?: string; phone?: string; address?: string; }
export interface InventoryBalance { id: string; onHand: number | string; reserved: number | string; freeToUse: number | string; product: Product; location: Location; }
export interface LedgerEntry { id: string; type: string; quantityDelta: number | string; balanceAfter: number | string; referenceType: string; referenceId: string; createdAt: string; product: Product; location: Location; actor?: { id: string; name: string; email: string }; }
export interface LineItem { id: string; productId: string; quantity?: number | string; countedQuantity?: number | string; processedQuantity?: number | string; difference?: number | string; product: Product; }
export interface Document { id: string; reference: string; status: Status; createdAt: string; scheduledDate?: string; items: LineItem[]; destination?: Location; source?: Location; supplier?: Supplier; contact?: string; deliveryAddress?: string; reason?: string; type?: string; location?: Location; }
export interface Dashboard { stock: { onHand: number | string; reserved: number | string; freeToUse: number | string }; receipts: Array<{ status: Status; _count: { _all: number } }>; deliveries: Array<{ status: Status; _count: { _all: number } }>; lowStock: Array<{ rule: { minQty: number | string; product: Product; location: Location }; balance?: InventoryBalance }> }
export interface ReorderRule { id: string; minQty: number | string; maxQty?: number | string; product: Product; location: Location; }
export interface Notification { id: string; title: string; message: string; severity: "INFO" | "WARNING" | "CRITICAL"; readAt?: string; createdAt: string; }
export interface AuditLog { id: string; action: string; entityType: string; entityId: string; createdAt: string; actor?: { name: string; email: string }; }
