import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler, ok, requireId } from "../lib/http";
import * as catalog from "../services/catalog.service";
import { createOpeningInventory } from "../services/inventory.service";

const router = Router();
router.use(authenticate);
const id = z.string().uuid();
const searchQuery = z.object({ search: z.string().optional() });
const positive = z.number().nonnegative();
const resourceSchemas = {
  categories: z.object({ name: z.string().min(1), description: z.string().optional() }),
  uoms: z.object({ name: z.string().min(1), code: z.string().min(1).max(16) }),
  warehouses: z.object({ name: z.string().min(1), shortCode: z.string().min(1).max(16), address: z.string().optional() }),
  locations: z.object({ warehouseId: id, name: z.string().min(1), shortCode: z.string().min(1).max(16) }),
  suppliers: z.object({ name: z.string().min(1), email: z.string().email().optional(), phone: z.string().optional(), address: z.string().optional() }),
} as const;

router.get("/products", asyncHandler(async (req, res) => ok(res, await catalog.listProducts(searchQuery.parse(req.query).search))));
router.get("/products/:id", asyncHandler(async (req, res) => ok(res, await catalog.getProduct(id.parse(requireId(req.params.id, "product id"))))));
router.post("/products", authorize(Role.ADMIN, Role.MANAGER), asyncHandler(async (req, res) => ok(res, await catalog.createProduct({ ...z.object({ sku: z.string().min(1).max(64), name: z.string().min(1).max(160), unitCost: positive, categoryId: id, uomId: id, openingStock: z.object({ locationId: id, quantity: positive }).optional() }).parse(req.body), actorId: req.user!.id }), 201)));
router.patch("/products/:id", authorize(Role.ADMIN, Role.MANAGER), asyncHandler(async (req, res) => ok(res, await catalog.updateProduct(id.parse(requireId(req.params.id, "product id")), z.object({ sku: z.string().min(1).max(64).optional(), name: z.string().min(1).max(160).optional(), unitCost: positive.optional(), categoryId: id.optional(), uomId: id.optional(), isActive: z.boolean().optional() }).parse(req.body)))));

const resources = ["categories", "uoms", "warehouses", "locations", "suppliers"] as const;
for (const resource of resources) {
  router.get(`/${resource}`, asyncHandler(async (req, res) => ok(res, await catalog.crudList(resource, searchQuery.parse(req.query).search))));
  router.post(`/${resource}`, authorize(Role.ADMIN, Role.MANAGER), asyncHandler(async (req, res) => {
    return ok(res, await catalog.crudCreate(resource, resourceSchemas[resource].parse(req.body)), 201);
  }));
  router.patch(`/${resource}/:id`, authorize(Role.ADMIN, Role.MANAGER), asyncHandler(async (req, res) => ok(res, await catalog.crudUpdate(resource, id.parse(requireId(req.params.id)), resourceSchemas[resource].partial().parse(req.body)))));
}

router.post("/inventory/opening", authorize(Role.ADMIN, Role.MANAGER), asyncHandler(async (req, res) => ok(res, await createOpeningInventory({ ...z.object({ productId: id, locationId: id, quantity: positive }).parse(req.body), actorId: req.user!.id }), 201)));

export default router;
