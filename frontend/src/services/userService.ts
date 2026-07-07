import { httpClient } from "./httpClient";

export type Role = "CHASER" | "DROPPER" | "ADMIN";

// Authed user profile. Shape mirrors GET /auth/me
// (backend/src/auth/routes.ts).
export interface UserProfile {
  id: string;
  email: string;
  name: string | null; // collected at sign-up; null for pre-name accounts
  role: Role;
  status: "ACTIVE" | "DISABLED";
  createdAt: string; // ISO
  emailNotifications: boolean;
  purchaseCount: number;
}

// Fetch the current user's profile.
export async function getProfile(): Promise<UserProfile> {
  const res = await httpClient.get<UserProfile>("/auth/me");
  return res.data;
}

// Toggle email notifications for the current user.
export async function setEmailNotifications(enabled: boolean): Promise<void> {
  await httpClient.patch("/auth/me/email-notifications", { enabled });
}

// Two-letter avatar initials from an email local-part ("zangoul@…" → "ZA").
export function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

// A human-readable name derived from the email local-part when no stored name
// exists ("marco.d@gmail.com" → "Marco D"). Splits on . - _ and capitalises.
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[.\-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Preferred display name: the stored name, else derived from the email.
export function displayName(user: { name?: string | null; email: string }): string {
  const n = user.name?.trim();
  return n && n.length > 0 ? n : nameFromEmail(user.email);
}

// Two-letter initials from the preferred display name.
export function initialsFor(user: { name?: string | null; email: string }): string {
  const label = displayName(user);
  const parts = label.split(/\s+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : label.slice(0, 2);
  return chars.toUpperCase();
}
