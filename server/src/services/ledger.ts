import type Stripe from "stripe";
import { prisma } from "../db.js";
import { normalizeEmail } from "../domain/email.js";
import { FIELD_SHARE, money } from "../domain/money.js";

const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

function openPendingWhere(since: Date) {
  return {
    status: "pending" as const,
    kind: "payment" as const,
    createdAt: { gte: since },
    NOT: { stripeSessionId: { startsWith: "pending_" } },
  };
}

export async function buildLedger(
  stripe: Stripe,
  rawEmail: unknown
): Promise<Record<string, unknown>> {
  const email = normalizeEmail(rawEmail);
  const since = new Date(Date.now() - PENDING_WINDOW_MS);
  const pendingWhere = openPendingWhere(since);

  const [paidAgg, pendingAgg, personalPaid, personalPending, personalAny, recent, stripeBal] =
    await Promise.all([
      prisma.order.aggregate({
        where: { status: "paid", kind: "payment" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: pendingWhere,
        _sum: { amount: true },
        _count: true,
      }),
      email
        ? prisma.order.aggregate({
            where: { status: "paid", kind: "payment", user: { email } },
            _sum: { amount: true },
            _count: true,
          })
        : Promise.resolve(null),
      email
        ? prisma.order.aggregate({
            where: { ...pendingWhere, user: { email } },
            _sum: { amount: true },
            _count: true,
          })
        : Promise.resolve(null),
      email
        ? prisma.order.count({ where: { user: { email } } })
        : Promise.resolve(0),
      email
        ? prisma.order.findMany({
            where: { user: { email }, kind: "payment" },
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      stripe.balance.retrieve().catch(() => null),
    ]);

  const available = stripeBal?.available?.[0];
  const pendingStripe = stripeBal?.pending?.[0];
  const currency = (available?.currency || pendingStripe?.currency || "usd").toLowerCase();
  const availableCents = available?.amount ?? 0;
  const pendingStripeCents = pendingStripe?.amount ?? 0;
  const paidCents = paidAgg._sum.amount ?? 0;
  const pendingOrderCents = pendingAgg._sum.amount ?? 0;
  const persPaidCents = personalPaid?._sum.amount ?? 0;
  const persPendCents = personalPending?._sum.amount ?? 0;
  const persPaidCount = personalPaid?._count ?? 0;
  const persPendCount = personalPending?._count ?? 0;

  let personalStatus = "ENTER EMAIL";
  if (email) personalStatus = personalAny > 0 ? "LINKED" : "NO PAYOUTS";

  return {
    live: !!stripeBal,
    currency,
    fund: {
      available: {
        cents: availableCents,
        label: money(availableCents, currency),
        status: availableCents > 0 ? "FUNDED" : "EMPTY",
      },
      pending: {
        cents: pendingStripeCents + pendingOrderCents,
        count: pendingAgg._count,
        label: money(pendingStripeCents + pendingOrderCents, currency),
      },
      paid: {
        cents: paidCents,
        count: paidAgg._count,
        label: money(paidCents, currency),
      },
      split: {
        field: FIELD_SHARE,
        ops: 100 - FIELD_SHARE,
        label: `${FIELD_SHARE}/${100 - FIELD_SHARE} SPLIT`,
      },
    },
    personal: {
      email: email || null,
      status: personalStatus,
      paid: {
        cents: persPaidCents,
        count: persPaidCount,
        label: money(persPaidCents, currency),
      },
      pending: {
        cents: persPendCents,
        count: persPendCount,
        label: money(persPendCents, currency),
      },
      recent: recent.map((row) => ({
        id: row.id,
        amount: money(row.amount, row.currency),
        status: row.status,
        at: row.createdAt.toISOString(),
      })),
    },
  };
}

export async function orderStatusBySession(sessionId: string) {
  const order = await prisma.order.findUnique({
    where: { stripeSessionId: sessionId },
    include: { user: { select: { email: true } } },
  });
  if (!order) {
    return { status: "pending", found: false, fulfilled: false };
  }
  return {
    found: true,
    status: order.status,
    amount: order.amount,
    currency: order.currency,
    email: order.user.email,
    orderId: order.id,
    kind: order.kind,
    fulfilled: order.status === "paid",
  };
}
