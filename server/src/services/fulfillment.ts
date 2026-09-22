import type Stripe from "stripe";
import { prisma } from "../db.js";

function paymentIntentIdOf(session: Stripe.Checkout.Session): string | null {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? null;
}

function subscriptionIdOf(session: Stripe.Checkout.Session): string | null {
  if (!session.subscription) return null;
  if (typeof session.subscription === "string") return session.subscription;
  return session.subscription.id;
}

export async function fulfillCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId;
  const paymentIntentId = paymentIntentIdOf(session);

  await prisma.$transaction(async (tx) => {
    if (orderId) {
      const existing = await tx.order.findUnique({ where: { id: orderId } });
      if (!existing) {
        const userId = session.metadata?.userId || session.client_reference_id;
        if (userId) {
          await tx.order.create({
            data: {
              id: orderId,
              userId,
              stripeSessionId: session.id,
              stripePaymentIntentId: paymentIntentId,
              amount: session.amount_total ?? 0,
              currency: (session.currency || "usd").toLowerCase(),
              kind: session.mode === "subscription" ? "subscription_setup" : "payment",
              status: "paid",
            },
          });
        }
      } else if (existing.status !== "paid") {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "paid",
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
          },
        });
      }
    } else {
      await tx.order.updateMany({
        where: { stripeSessionId: session.id, status: { not: "paid" } },
        data: {
          status: "paid",
          stripePaymentIntentId: paymentIntentId,
        },
      });
    }

    if (session.mode === "subscription") {
      const subId = subscriptionIdOf(session);
      if (subId) {
        await tx.subscription.updateMany({
          where: { stripeSessionId: session.id },
          data: { status: "active", stripeSubscriptionId: subId },
        });
      }
    }
  });
}

export async function expireCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId;
  await prisma.order.updateMany({
    where: orderId
      ? { id: orderId, status: "pending" }
      : { stripeSessionId: session.id, status: "pending" },
    data: { status: "canceled" },
  });
}

export async function failCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId;
  const paymentIntentId = paymentIntentIdOf(session);
  await prisma.order.updateMany({
    where: orderId
      ? { id: orderId, status: { not: "paid" } }
      : { stripeSessionId: session.id, status: { not: "paid" } },
    data: {
      status: "failed",
      stripePaymentIntentId: paymentIntentId,
    },
  });
}

export async function failPaymentIntent(pi: Stripe.PaymentIntent): Promise<void> {
  const orderId = pi.metadata?.orderId;
  if (orderId) {
    await prisma.order.updateMany({
      where: { id: orderId, status: { not: "paid" } },
      data: { status: "failed", stripePaymentIntentId: pi.id },
    });
    return;
  }
  await prisma.order.updateMany({
    where: { stripePaymentIntentId: pi.id, status: { not: "paid" } },
    data: { status: "failed" },
  });
}

export async function cancelSubscription(sub: Stripe.Subscription): Promise<void> {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: { status: "canceled" },
  });
}
