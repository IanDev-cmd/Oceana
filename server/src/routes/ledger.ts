import type { Request, Response, NextFunction } from "express";
import type Stripe from "stripe";
import { HttpError } from "../http.js";
import { buildLedger, orderStatusBySession } from "../services/ledger.js";

export function createLedgerHandler(stripe: Stripe) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = await buildLedger(stripe, req.query.email);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  };
}

export function createOrderStatusHandler() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = String(req.query.session_id || "");
      if (!sessionId) throw new HttpError(400, "session_id is required");
      res.json(await orderStatusBySession(sessionId));
    } catch (err) {
      next(err);
    }
  };
}
