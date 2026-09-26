import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { asyncHandler, ok, requireId } from "../lib/http";
import * as documents from "../services/document.service";
import * as inventory from "../services/inventory.service";

const router = Router();
router.use(authenticate);
const id = z.string().uuid();
const quantity = z.number().positive();

router.get("/inventory", asyncHandler(async (req, res) => ok(res, await inventory.listInventory({ productId: typeof req.query.productId === "string" ? req.query.productId : undefined, locationId: typeof req.query.locationId === "string" ? req.query.locationId : undefined, search: typeof req.query.search === "string" ? req.query.search : undefined }))));
router.get("/stock-ledger", asyncHandler(async (req, res) => ok(res, await inventory.listLedger({ productId: typeof req.query.productId === "string" ? req.query.productId : undefined, locationId: typeof req.query.locationId === "string" ? req.query.locationId : undefined, referenceType: typeof req.query.referenceType === "string" ? req.query.referenceType : undefined, search: typeof req.query.search === "string" ? req.query.search : undefined }))));
router.get("/dashboard", asyncHandler(async (_req, res) => ok(res, await inventory.dashboard())));

router.get("/receipts", asyncHandler(async (req, res) => ok(res, await documents.listDocuments("receipt", typeof req.query.search === "string" ? req.query.search : undefined))));
router.get("/receipts/:id", asyncHandler(async (req, res) => ok(res, await documents.getDocument("receipt", id.parse(requireId(req.params.id, "receipt id"))))));
router.post("/receipts", asyncHandler(async (req, res) => ok(res, await documents.createReceipt(z.object({ reference: z.string().min(1).max(80), destinationId: id, supplierId: id.optional(), responsibleId: id.optional(), scheduledDate: z.string().datetime().optional() }).parse(req.body)), 201)));
router.post("/receipts/:id/items", asyncHandler(async (req, res) => ok(res, await documents.addReceiptItem(id.parse(requireId(req.params.id, "receipt id")), z.object({ productId: id, quantity }).parse(req.body)), 201)));
router.post("/receipts/:id/ready", asyncHandler(async (req, res) => ok(res, await documents.transitionDocument("receipt", id.parse(requireId(req.params.id, "receipt id")), "READY", req.user!.id))));
router.post("/receipts/:id/cancel", asyncHandler(async (req, res) => ok(res, await documents.transitionDocument("receipt", id.parse(requireId(req.params.id, "receipt id")), "CANCELLED", req.user!.id))));
router.post("/receipts/:id/validate", asyncHandler(async (req, res) => ok(res, await inventory.validateReceipt(id.parse(requireId(req.params.id, "receipt id")), req.user!.id))));

router.get("/deliveries", asyncHandler(async (req, res) => ok(res, await documents.listDocuments("delivery", typeof req.query.search === "string" ? req.query.search : undefined))));
router.get("/deliveries/:id", asyncHandler(async (req, res) => ok(res, await documents.getDocument("delivery", id.parse(requireId(req.params.id, "delivery id"))))));
router.post("/deliveries", asyncHandler(async (req, res) => ok(res, await documents.createDelivery(z.object({ reference: z.string().min(1).max(80), sourceId: id, deliveryAddress: z.string().optional(), contact: z.string().optional(), responsibleId: id.optional(), scheduledDate: z.string().datetime().optional() }).parse(req.body)), 201)));
router.post("/deliveries/:id/items", asyncHandler(async (req, res) => ok(res, await documents.addDeliveryItem(id.parse(requireId(req.params.id, "delivery id")), z.object({ productId: id, quantity }).parse(req.body)), 201)));
router.post("/deliveries/:id/pick", asyncHandler(async (req, res) => ok(res, await documents.transitionDocument("delivery", id.parse(requireId(req.params.id, "delivery id")), "WAITING", req.user!.id))));
router.post("/deliveries/:id/pack", asyncHandler(async (req, res) => ok(res, await documents.transitionDocument("delivery", id.parse(requireId(req.params.id, "delivery id")), "READY", req.user!.id))));
router.post("/deliveries/:id/cancel", asyncHandler(async (req, res) => ok(res, await documents.transitionDocument("delivery", id.parse(requireId(req.params.id, "delivery id")), "CANCELLED", req.user!.id))));
router.post("/deliveries/:id/validate", asyncHandler(async (req, res) => ok(res, await inventory.validateDelivery(id.parse(requireId(req.params.id, "delivery id")), req.user!.id))));

router.get("/transfers", asyncHandler(async (req, res) => ok(res, await documents.listDocuments("transfer", typeof req.query.search === "string" ? req.query.search : undefined))));
router.get("/transfers/:id", asyncHandler(async (req, res) => ok(res, await documents.getDocument("transfer", id.parse(requireId(req.params.id, "transfer id"))))));
router.post("/transfers", asyncHandler(async (req, res) => ok(res, await documents.createTransfer(z.object({ reference: z.string().min(1).max(80), sourceId: id, destinationId: id, responsibleId: id.optional(), scheduledDate: z.string().datetime().optional() }).parse(req.body)), 201)));
router.post("/transfers/:id/items", asyncHandler(async (req, res) => ok(res, await documents.addTransferItem(id.parse(requireId(req.params.id, "transfer id")), z.object({ productId: id, quantity }).parse(req.body)), 201)));
router.post("/transfers/:id/ready", asyncHandler(async (req, res) => ok(res, await documents.transitionDocument("transfer", id.parse(requireId(req.params.id, "transfer id")), "READY", req.user!.id))));
router.post("/transfers/:id/validate", asyncHandler(async (req, res) => ok(res, await inventory.validateTransfer(id.parse(requireId(req.params.id, "transfer id")), req.user!.id))));

router.get("/adjustments", asyncHandler(async (req, res) => ok(res, await documents.listDocuments("adjustment", typeof req.query.search === "string" ? req.query.search : undefined))));
router.get("/adjustments/:id", asyncHandler(async (req, res) => ok(res, await documents.getDocument("adjustment", id.parse(requireId(req.params.id, "adjustment id"))))));
router.post("/adjustments", asyncHandler(async (req, res) => ok(res, await documents.createAdjustment(z.object({ reference: z.string().min(1).max(80), locationId: id, reason: z.string().optional(), type: z.enum(["COUNT", "INCREASE", "DECREASE"]).optional(), responsibleId: id.optional() }).parse(req.body)), 201)));
router.post("/adjustments/:id/items", asyncHandler(async (req, res) => ok(res, await documents.addAdjustmentItem(id.parse(requireId(req.params.id, "adjustment id")), z.object({ productId: id, countedQuantity: z.number().nonnegative() }).parse(req.body)), 201)));
router.post("/adjustments/:id/ready", asyncHandler(async (req, res) => ok(res, await documents.transitionDocument("adjustment", id.parse(requireId(req.params.id, "adjustment id")), "READY", req.user!.id))));
router.post("/adjustments/:id/validate", asyncHandler(async (req, res) => ok(res, await inventory.validateAdjustment(id.parse(requireId(req.params.id, "adjustment id")), req.user!.id))));

export default router;
