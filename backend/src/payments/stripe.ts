import Stripe from "stripe";

// Lazily-built Stripe client. Null when STRIPE_SECRET_KEY is unset — the
// checkout route then returns a clean "payment not configured" error rather than
// crashing, mirroring the mailer's no-op-when-unconfigured pattern.
let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) {
    // apiVersion omitted → SDK pins its built-in default, which matches the
    // account's API version shown in the dashboard.
    client = new Stripe(key);
  }
  return client;
}

export function stripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET ?? "";
}
