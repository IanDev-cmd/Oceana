import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../http.js";
import type { Env } from "../env.js";

export function requireCheckoutAuth(env: Env) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!env.CHECKOUT_USER_SECRET) {
      next();
      return;
    }
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (token !== env.CHECKOUT_USER_SECRET) {
      next(new HttpError(401, "Unauthorized"));
      return;
    }
    next();
  };
}
