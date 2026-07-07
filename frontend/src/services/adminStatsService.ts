import { httpClient } from "./httpClient";

// A1 — admin dashboard counters. Mirrors backend/src/admin/stats.ts.

export interface AdminStats {
  users: { total: number; chasers: number; droppers: number; admins: number };
  drops: { active: number; live: number; scheduled: number };
  pendingRequests: number;
}

export async function getStats(): Promise<AdminStats> {
  const res = await httpClient.get<AdminStats>("/admin/stats");
  return res.data;
}
