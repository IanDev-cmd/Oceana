import { useState, type CSSProperties } from "react";

type CheckoutButtonProps = {
  email: string;
  apiBase: string;
  authToken?: string;
  mode?: "payment" | "subscription";
  className?: string;
  style?: CSSProperties;
  onError?: (message: string) => void;
};

export function CheckoutButton({
  email,
  apiBase,
  authToken,
  mode = "payment",
  className,
  style,
  onError,
}: CheckoutButtonProps) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    const trimmed = email.trim().toLowerCase();
    const emailOk =
      /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+.\-]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/.test(
        trimmed
      );
    if (!emailOk) {
      onError?.("Enter a valid email before checkout.");
      return;
    }
    setBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/checkout`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email: trimmed, mode }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        throw new Error(body.error || "Could not start Checkout");
      }
      window.location.href = body.url;
    } catch (err) {
      setBusy(false);
      onError?.(err instanceof Error ? err.message : "Checkout failed");
    }
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => void onClick()}
      disabled={busy}
      aria-busy={busy}
      aria-live="polite"
    >
      {busy ? <span aria-hidden="true" className="checkout-spin" /> : null}
      <span>{busy ? "Redirecting to Stripe…" : "Checkout"}</span>
    </button>
  );
}
