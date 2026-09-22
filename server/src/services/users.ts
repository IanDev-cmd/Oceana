import { Prisma } from "@prisma/client";
import type { User } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "../db.js";

export async function upsertUserByEmail(email: string): Promise<User> {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing) {
    if (existing.email !== email) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { email },
      });
    }
    return existing;
  }
  try {
    return await prisma.user.create({ data: { email } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return prisma.user.findUniqueOrThrow({ where: { email } });
    }
    throw err;
  }
}

export async function ensureStripeCustomer(
  stripe: Stripe,
  user: User
): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      if (fresh.stripeCustomerId) return fresh.stripeCustomerId;
    }
    throw err;
  }
}
