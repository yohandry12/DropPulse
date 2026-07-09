import type { NotificationType } from "@prisma/client";
import { prisma } from "../prisma.js";
import { emailShell, sendMail } from "./mailer.js";

// Create one in-app notification, and optionally send a transactional email.
// The single write-path used everywhere a notification is raised (routes,
// worker) so the shape stays consistent. Fire-and-persist: callers await it,
// but it never throws a domain error — a failed notify must not break the
// action that triggered it, so callers wrap accordingly.
//
// email: when true, also email the user (the same title/body). Only high-value
// events set this (payment confirmed, drop opened) — see callers. The email is
// best-effort (sendMail swallows failures); a bad SMTP never fails the action.
//
// force: when true, send the email even if the user opted out of notifications.
// Reserve for transactional messages the user needs regardless of preference
// (e.g. the dropper upgrade code) — the opt-out covers marketing-ish events, not
// a code they explicitly requested and are waiting on.
export async function notify(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  productId?: string | null;
  email?: boolean;
  force?: boolean;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      productId: input.productId ?? null,
    },
  });

  if (input.email) {
    // Fetch the address only when an email is actually requested.
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, emailNotifications: true },
    });
    // Respect the user's opt-out: in-app notification still persisted above,
    // but no email when they've disabled them — unless `force` (transactional).
    if (user?.email && (user.emailNotifications || input.force)) {
      await sendMail({
        to: user.email,
        subject: input.title,
        html: emailShell(
          input.title,
          `<p style="margin:0;font-size:15px;line-height:1.5;color:#334155;">${input.body}</p>`
        ),
      });
    }
  }
}
