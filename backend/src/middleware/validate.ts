import type { RequestHandler } from "express";
import { z } from "zod";

export function validate(schema: { body?: z.ZodTypeAny; params?: z.ZodTypeAny; query?: z.ZodTypeAny }): RequestHandler {
  return (req, _res, next) => {
    if (schema.body) req.body = schema.body.parse(req.body);
    if (schema.params) req.params = schema.params.parse(req.params);
    if (schema.query) req.query = schema.query.parse(req.query);
    next();
  };
}
