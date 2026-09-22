import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import type Stripe from "stripe";
import type { Env } from "../env.js";
import { HttpError } from "../http.js";
import { normalizeEmail } from "../domain/email.js";
import { ensureStripeCustomer, upsertUserByEmail } from "../services/users.js";
import { createOrderForSession, createPendingSubscription } from "../services/orders.js";

const checkoutBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  mode: z.enum(["payment", "subscription"]).default("payment"),
  amount: z.number().int().min(50).max(1_000_000).optional(),
  currency: z.string().min(3).max(3).optional(),
  source: z.enum(["desktop", "pwa"]).optional(),
});

function originFrom(env: Env): string {
  return env.APP_BASE_URL.replace(/\/$/, "");
}

export function createCheckoutHandler(stripe: Stripe, env: Env) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = checkoutBody.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, "Valid email is required");
      }

      const email = normalizeEmail(parsed.data.email);
      if (!email) {
        throw new HttpError(400, "Valid email is required");
      }

      const { mode, source } = parsed.data;
      const amount = parsed.data.amount ?? env.CHECKOUT_AMOUNT_CENTS;
      const currency = (parsed.data.currency ?? env.CHECKOUT_CURRENCY).toLowerCase();
      const origin = originFrom(env);
      const orderId = crypto.randomUUID();
      const kind = mode === "subscription" ? "subscription_setup" : "payment";

      const user = await upsertUserByEmail(email);
      const stripeCustomerId = await ensureStripeCustomer(stripe, user);

      const from = source === "pwa" ? "&from=pwa" : "";
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode,
        customer: stripeCustomerId,
        client_reference_id: user.id,
        success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}${from}`,
        cancel_url: `${origin}/cancel.html`,
        metadata: {
          userId: user.id,
          orderId,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amount,
              product_data: {
                name: "Guardians of the Ocean · restoration credit",
                description: "Direct restoration payout for coastal schools and field teams",
              },
            },
          },
        ],
      };

      if (mode === "payment") {
        sessionParams.payment_intent_data = {
          metadata: { userId: user.id, orderId },
        };
      }

      if (mode === "subscription") {
        sessionParams.line_items = [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amount,
              recurring: { interval: "month" },
              product_data: {
                name: "Guardians of the Ocean · monthly restoration",
              },
            },
          },
        ];
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      if (!session.url) {
        throw new HttpError(502, "Stripe did not return a checkout URL");
      }

      await createOrderForSession({
        id: orderId,
        userId: user.id,
        sessionId: session.id,
        amount,
        currency,
        kind,
      });

      if (mode === "subscription") {
        await createPendingSubscription({
          userId: user.id,
          sessionId: session.id,
          amount,
          currency,
        });
      }

      res.json({ url: session.url, orderId, sessionId: session.id });
    } catch (err) {
      next(err);
    }
  };
}
