import { useEffect, useState } from "react";
import { getProfile, type UserProfile } from "../services/userService";

// Module-level cache + in-flight promise so the many AppHeader mounts across
// pages share a single GET /auth/me instead of firing one per navigation.
let cached: UserProfile | null = null;
let inflight: Promise<UserProfile> | null = null;

function load(): Promise<UserProfile> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = getProfile()
      .then((p) => {
        cached = p;
        return p;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Clear on logout so the next login refetches.
export function clearProfileCache(): void {
  cached = null;
  inflight = null;
}

export function useProfile(): { profile: UserProfile | null; error: string | null } {
  const [profile, setProfile] = useState<UserProfile | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    load()
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch(() => {
        if (alive) setError("load_failed");
      });
    return () => {
      alive = false;
    };
  }, []);

  return { profile, error };
}
