import { prisma } from "../prisma.js";
import { getStripe } from "./stripe.js";
import { mailConfig } from "../config.js";

// Stripe Connect onboarding for droppers. We create an Express connected
// account (Stripe hosts the bank-details form), store only its id, and mirror
// its charges_enabled flag. No bank data ever touches our DB.

export type PayoutStatus = {
  hasAccount: boolean;
  chargesEnabled: boolean;
};

// Read the caller's current payout status from our DB (cheap, no Stripe call).
export async function getPayoutStatus(userId: string): Promise<PayoutStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeAccountId: true, stripeChargesEnabled: true },
  });
  return {
    hasAccount: !!user?.stripeAccountId,
    chargesEnabled: user?.stripeChargesEnabled ?? false,
  };
}

// Ensure the user has a connected account, then return a fresh onboarding link
// (Account Links are single-use, short-lived). Called when the dropper clicks
// A single-use login link to the Stripe Express dashboard, where an already-
// onboarded dropper manages their account: change bank account, update details,
// view payouts. Returns null if Stripe isn't configured or the user has no
// connected account yet (they must onboard first).
export async function createDashboardLink(userId: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeAccountId: true },
  });
  if (!user?.stripeAccountId) return null;

  const link = await stripe.accounts.createLoginLink(user.stripeAccountId);
  return link.url;
}

// "Configurer les paiements". Returns null if Stripe/Connect isn't configured.
export async function createOnboardingLink(userId: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeAccountId: true, email: true },
  });
  if (!user) return null;

  let accountId = user.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      capabilities: { transfers: { requested: true } },
    });
    accountId = account.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeAccountId: accountId },
    });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    // Both point back to the settings page; it re-syncs status on load.
    refresh_url: `${mailConfig.appUrl}/settings/payments?refresh=1`,
    return_url: `${mailConfig.appUrl}/settings/payments?done=1`,
    type: "account_onboarding",
  });
  return link.url;
}

// Pull the live charges_enabled flag from Stripe and persist it. Called on the
// settings page load (after the user returns from onboarding) so our badge
// reflects reality. Returns the refreshed status.
export async function refreshPayoutStatus(userId: string): Promise<PayoutStatus> {
  const stripe = getStripe();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeAccountId: true, stripeChargesEnabled: true },
  });
  if (!stripe || !user?.stripeAccountId) {
    return {
      hasAccount: !!user?.stripeAccountId,
      chargesEnabled: user?.stripeChargesEnabled ?? false,
    };
  }

  const account = await stripe.accounts.retrieve(user.stripeAccountId);
  const chargesEnabled = account.charges_enabled ?? false;
  if (chargesEnabled !== user.stripeChargesEnabled) {
    await prisma.user.update({
      where: { id: userId },
      data: { stripeChargesEnabled: chargesEnabled },
    });
  }
  return { hasAccount: true, chargesEnabled };
}
