import type { Request, Response, NextFunction } from "express";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import type { Env } from "../env.js";
import { prisma } from "../db.js";
import { HttpError } from "../http.js";
import {
  cancelSubscription,
  expireCheckout,
  failCheckout,
  failPaymentIntent,
  fulfillCheckout,
} from "../services/fulfillment.js";

type Claim = "fresh" | "retry" | "done";

async function claimEvent(eventId: string, type: string): Promise<Claim> {
  try {
    await prisma.stripeEvent.create({
      data: { id: eventId, type, status: "received", attempts: 1 },
    });
    return "fresh";
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.stripeEvent.findUnique({ where: { id: eventId } });
      if (!existing || existing.status === "processed") return "done";
      await prisma.stripeEvent.update({
        where: { id: eventId },
        data: { status: "received", attempts: { increment: 1 } },
      });
      return "retry";
    }
    throw err;
  }
}

async function markProcessed(eventId: string): Promise<void> {
  await prisma.stripeEvent.update({
    where: { id: eventId },
    data: { status: "processed", processedAt: new Date(), lastError: null },
  });
}

async function markFailed(eventId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message.slice(0, 500) : "fulfillment failed";
  await prisma.stripeEvent.update({
    where: { id: eventId },
    data: { status: "failed", lastError: message },
  });
}

async function applyEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await fulfillCheckout(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.expired":
      await expireCheckout(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.async_payment_failed":
      await failCheckout(event.data.object as Stripe.Checkout.Session);
      break;
    case "payment_intent.payment_failed":
      await failPaymentIntent(event.data.object as Stripe.PaymentIntent);
      break;
    case "customer.subscription.deleted":
      await cancelSubscription(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }
}

export function createWebhookHandler(stripe: Stripe, env: Env) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string") {
        throw new HttpError(400, "Missing Stripe-Signature header");
      }

      const raw = req.body;
      if (!Buffer.isBuffer(raw)) {
        throw new HttpError(400, "Webhook body must be raw");
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
      } catch {
        throw new HttpError(400, "Invalid webhook signature");
      }

      const claim = await claimEvent(event.id, event.type);
      if (claim === "done") {
        res.json({ received: true, duplicate: true });
        return;
      }

      try {
        await applyEvent(event);
        await markProcessed(event.id);
      } catch (err) {
        await markFailed(event.id, err);
        throw err;
      }

      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  };
}
