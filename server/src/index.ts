import "dotenv/config";
import express from "express";
import cors from "cors";
import { loadEnv } from "./env.js";
import { createStripe } from "./stripe.js";
import { requireCheckoutAuth } from "./middleware/auth.js";
import { errorHandler } from "./http.js";
import { createCheckoutHandler } from "./routes/checkout.js";
import { createWebhookHandler } from "./routes/webhook.js";
import { createLedgerHandler, createOrderStatusHandler } from "./routes/ledger.js";
import { createHealthHandler } from "./routes/health.js";
import { prisma } from "./db.js";

const env = loadEnv();
const stripe = createStripe(env);
const app = express();

const allowed = env.FRONTEND_ORIGIN.split(",").map((s) => s.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes(origin) || allowed.includes("*")) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
  })
);

app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  createWebhookHandler(stripe, env)
);

app.use(express.json({ limit: "32kb" }));

app.get("/health", createHealthHandler());
app.post("/api/checkout", requireCheckoutAuth(env), createCheckoutHandler(stripe, env));
app.get("/api/ledger", createLedgerHandler(stripe));
app.get("/api/orders/status", createOrderStatusHandler());

app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`Stripe API listening on :${env.PORT}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await prisma.$disconnect();
}

process.on("SIGTERM", () => {
  void shutdown();
});
process.on("SIGINT", () => {
  void shutdown();
});
