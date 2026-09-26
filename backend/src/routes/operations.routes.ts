import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler, ok, requireId } from "../lib/http";
import * as ops from "../services/operations.service";

const router = Router();
router.use(authenticate);
const id = z.string().uuid();

router.get("/reorder-rules", asyncHandler(async (_req, res) => ok(res, await ops.listReorderRules())));
router.post("/reorder-rules", authorize(Role.ADMIN, Role.MANAGER), asyncHandler(async (req, res) => ok(res, await ops.createReorderRule(z.object({ productId: id, locationId: id, minQty: z.number().nonnegative(), maxQty: z.number().nonnegative().optional() }).parse(req.body)), 201)));
router.patch("/reorder-rules/:id", authorize(Role.ADMIN, Role.MANAGER), asyncHandler(async (req, res) => {
  return ok(res, await ops.updateReorderRule(
    id.parse(requireId(req.params.id)),
    z.object({ minQty: z.number().nonnegative().optional(), maxQty: z.number().nonnegative().optional() }).parse(req.body),
  ));
}));
router.delete("/reorder-rules/:id", authorize(Role.ADMIN, Role.MANAGER), asyncHandler(async (req, res) => { await ops.deleteReorderRule(id.parse(requireId(req.params.id))); return ok(res, { deleted: true }); }));

router.get("/notifications", asyncHandler(async (req, res) => ok(res, await ops.listNotifications(req.user!.id, req.query.unreadOnly === "true"))));
router.patch("/notifications/:id/read", asyncHandler(async (req, res) => ok(res, await ops.markNotificationRead(id.parse(requireId(req.params.id)), req.user!.id))));
router.get("/audit-logs", authorize(Role.ADMIN, Role.MANAGER, Role.AUDITOR), asyncHandler(async (req, res) => ok(res, await ops.listAuditLogs({ entityType: typeof req.query.entityType === "string" ? req.query.entityType : undefined, entityId: typeof req.query.entityId === "string" ? req.query.entityId : undefined, actorId: typeof req.query.actorId === "string" ? req.query.actorId : undefined }))));

export default router;
