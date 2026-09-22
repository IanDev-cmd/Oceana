import type { Order, OrderKind } from "@prisma/client";
import { prisma } from "../db.js";

export async function createOrderForSession(input: {
  id: string;
  userId: string;
  sessionId: string;
  amount: number;
  currency: string;
  kind: OrderKind;
}): Promise<Order> {
  return prisma.order.create({
    data: {
      id: input.id,
      userId: input.userId,
      stripeSessionId: input.sessionId,
      amount: input.amount,
      currency: input.currency,
      kind: input.kind,
      status: "pending",
    },
  });
}

export async function createPendingSubscription(input: {
  userId: string;
  sessionId: string;
  amount: number;
  currency: string;
}): Promise<void> {
  await prisma.subscription.create({
    data: {
      userId: input.userId,
      stripeSessionId: input.sessionId,
      amount: input.amount,
      currency: input.currency,
      status: "pending",
    },
  });
}
