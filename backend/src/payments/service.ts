import { confirmPayment } from "../units/service.js";
import { prisma } from "../prisma.js";
import { notify } from "../notifications/service.js";
import { log } from "../logger.js";

// Fulfill a paid unit: flip held→sold (confirmPayment), then raise the
// PAYMENT_CONFIRMED notification (+ email). The single fulfilment path shared by
// the simulated /confirm-payment route AND the Stripe webhook, so both behave
// identically. Returns the sold unit. The notification is best-effort — a
// notify failure is logged and swallowed so it never undoes a completed
// payment; the confirmPayment itself may throw (caller handles).
export async function fulfillPaidUnit(
  unitId: string,
  userId: string
): Promise<{ id: string; status: string; soldAt: Date | null }> {
  const unit = await confirmPayment(unitId, userId);

  try {
    const product = await prisma.product.findUnique({
      where: { id: unit.productId },
      select: { name: true },
    });
    const serial = `#${unit.serialNumber.split("-").pop()}`;
    await notify({
      userId,
      type: "PAYMENT_CONFIRMED",
      title: "Paiement confirmé",
      body: `L'exemplaire ${serial} de ${product?.name ?? "ton drop"} est à toi.`,
      productId: unit.productId,
      email: true,
    });
  } catch (notifyErr) {
    log.error(
      "notify(PAYMENT_CONFIRMED) failed",
      notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
    );
  }

  return { id: unit.id, status: unit.status, soldAt: unit.soldAt };
}
