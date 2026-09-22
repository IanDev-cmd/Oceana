CREATE TYPE "OrderKind" AS ENUM ('payment', 'subscription_setup');
CREATE TYPE "StripeEventStatus" AS ENUM ('received', 'processed', 'failed');

ALTER TABLE "orders" ADD COLUMN "kind" "OrderKind" NOT NULL DEFAULT 'payment';
CREATE INDEX "orders_kind_status_idx" ON "orders"("kind", "status");

UPDATE "orders" AS o
SET "kind" = 'subscription_setup'
FROM "subscriptions" AS s
WHERE s."stripe_session_id" = o."stripe_session_id";

UPDATE "orders"
SET "status" = 'canceled'
WHERE "status" = 'pending'
  AND "stripe_session_id" LIKE 'pending_%';

ALTER TABLE "stripe_events" ADD COLUMN "status" "StripeEventStatus" NOT NULL DEFAULT 'processed';
ALTER TABLE "stripe_events" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "stripe_events" ADD COLUMN "last_error" TEXT;
ALTER TABLE "stripe_events" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "stripe_events" ALTER COLUMN "processed_at" DROP NOT NULL;
CREATE INDEX "stripe_events_status_idx" ON "stripe_events"("status");

DO $$
DECLARE
  r RECORD;
  keep_id TEXT;
BEGIN
  FOR r IN
    SELECT lower(email) AS e, array_agg(id ORDER BY created_at ASC) AS ids
    FROM users
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
  LOOP
    keep_id := r.ids[1];
    UPDATE orders SET user_id = keep_id WHERE user_id = ANY (r.ids[2:]);
    UPDATE subscriptions SET user_id = keep_id WHERE user_id = ANY (r.ids[2:]);
    UPDATE users AS k
    SET
      email = r.e,
      stripe_customer_id = COALESCE(
        k.stripe_customer_id,
        (
          SELECT u.stripe_customer_id
          FROM users AS u
          WHERE u.id = ANY (r.ids)
            AND u.stripe_customer_id IS NOT NULL
          ORDER BY u.created_at ASC
          LIMIT 1
        )
      )
    WHERE k.id = keep_id;
    DELETE FROM users WHERE id = ANY (r.ids[2:]);
  END LOOP;
END $$;

UPDATE users SET email = lower(email) WHERE email <> lower(email);
