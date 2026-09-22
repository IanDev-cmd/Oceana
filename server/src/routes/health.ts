import type { Request, Response } from "express";
import { prisma } from "../db.js";

export function createHealthHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: true });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  };
}
