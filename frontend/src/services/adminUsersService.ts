import { httpClient } from "./httpClient";

// A2 — user management API client. Mirrors backend/src/admin/users.ts.

export type UserRole = "CHASER" | "DROPPER" | "ADMIN";
export type UserStatus = "ACTIVE" | "DISABLED";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string; // ISO
  purchaseCount: number;
}

// Every account, newest first, with sold-unit purchase count.
export async function getUsers(): Promise<AdminUser[]> {
  const res = await httpClient.get<AdminUser[]>("/admin/users");
  return res.data;
}

// Change a user's role. Backend refuses self (400 cannot_modify_self).
export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  await httpClient.patch(`/admin/users/${id}/role`, { role });
}

// Enable / disable an account. Backend refuses self.
export async function updateUserStatus(id: string, status: UserStatus): Promise<void> {
  await httpClient.patch(`/admin/users/${id}/status`, { status });
}

// Permanent hard-delete. Irreversible — caller double-confirms. Refuses self.
export async function deleteUser(id: string): Promise<void> {
  await httpClient.delete(`/admin/users/${id}`);
}

// Permanent hard-delete of several accounts at once. Backend excludes the
// caller's own id and returns how many rows it actually removed.
export async function bulkDeleteUsers(ids: string[]): Promise<number> {
  const res = await httpClient.post<{ deleted: number }>("/admin/users/bulk-delete", { ids });
  return res.data.deleted;
}
