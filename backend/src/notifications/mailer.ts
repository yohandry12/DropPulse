import nodemailer, { type Transporter } from "nodemailer";
import { mailConfig } from "../config.js";
import { log } from "../logger.js";

// Lazily-built SMTP transport, reused across sends. Null until first use or when
// SMTP is not configured (host empty) — in which case the mailer no-ops.
let transport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!mailConfig.host) return null; // email disabled
  if (!transport) {
    transport = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: mailConfig.user, pass: mailConfig.pass },
    });
  }
  return transport;
}

// Send one transactional email. Best-effort: never throws — a failure is logged
// and swallowed so the caller's action (payment, drop-open) is unaffected.
// Returns true if sent, false if skipped/failed.
export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const t = getTransport();
  if (!t) {
    log.warn("Email skipped (SMTP not configured)", input.subject);
    return false;
  }
  try {
    await t.sendMail({
      from: mailConfig.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return true;
  } catch (e) {
    log.error("Email send failed", e instanceof Error ? e.message : String(e));
    return false;
  }
}

// Minimal branded HTML shell around body content. Inline styles only (email
// clients strip <style>/external CSS). Neutral, on-brand dark header.
export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:24px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:2px solid #323232;border-radius:6px;overflow:hidden;">
        <tr><td style="background:#0F172A;padding:20px 28px;">
          <span style="color:#ffffff;font-size:20px;font-weight:800;">DropPulse</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#0F172A;">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #E2E8F0;">
          <span style="font-size:12px;color:#64748B;">Séries limitées, numérotées, premier arrivé premier servi.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
