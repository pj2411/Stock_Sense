import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { asyncHandler, ok } from "../lib/http";
import * as auth from "../services/auth.service";

const router = Router();
const password = z.string().min(8).max(128);

router.post("/register", asyncHandler(async (req, res) => ok(res, await auth.register(z.object({ name: z.string().min(1).max(120), email: z.string().email(), password }).parse(req.body)), 201)));
router.post("/login", asyncHandler(async (req, res) => ok(res, await auth.login(z.object({ email: z.string().email(), password }).parse(req.body)))));
router.post("/refresh", asyncHandler(async (req, res) => ok(res, await auth.refresh(z.object({ refreshToken: z.string().min(1) }).parse(req.body).refreshToken))));
router.post("/logout", asyncHandler(async (req, res) => { await auth.logout(z.object({ refreshToken: z.string().min(1) }).parse(req.body).refreshToken); return ok(res, { loggedOut: true }); }));
router.get("/me", authenticate, asyncHandler(async (req, res) => ok(res, await auth.me(req.user!.id))));
router.post("/password/forgot", asyncHandler(async (req, res) => ok(res, await auth.forgotPassword(z.object({ email: z.string().email() }).parse(req.body).email))));
router.post("/password/verify-otp", asyncHandler(async (req, res) => ok(res, await auth.verifyOtp(z.object({ email: z.string().email(), otp: z.string().length(6) }).parse(req.body)))));
router.post("/password/reset", asyncHandler(async (req, res) => { await auth.resetPassword(z.object({ resetToken: z.string().min(1), password }).parse(req.body)); return ok(res, { reset: true }); }));

export default router;
