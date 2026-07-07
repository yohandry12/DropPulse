import { useEffect, useState } from "react";

// 10-minute hold countdown. Ticks each second, turns red under 2 min, and
// reports when it hits zero (unit goes back on sale).

const HOLD_MS = 10 * 60 * 1000;
const WARN_MS = 2 * 60 * 1000; // switch to red under 2 minutes

export interface HoldTimer {
  minutes: string;
  seconds: string;
  pct: number; // % of time remaining, for the bar
  warning: boolean; // under 2 min
  expired: boolean;
}

function pad(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

function compute(deadlineMs: number): HoldTimer {
  const remaining = Math.max(0, deadlineMs - Date.now());
  const totalSec = Math.floor(remaining / 1000);
  return {
    minutes: pad(Math.floor(totalSec / 60)),
    seconds: pad(totalSec % 60),
    pct: Math.round((remaining / HOLD_MS) * 100),
    warning: remaining > 0 && remaining <= WARN_MS,
    expired: remaining <= 0,
  };
}

export function useHoldTimer(deadlineMs: number): HoldTimer {
  const [state, setState] = useState<HoldTimer>(() => compute(deadlineMs));

  useEffect(() => {
    const id = setInterval(() => setState(compute(deadlineMs)), 1000);
    return () => clearInterval(id);
  }, [deadlineMs]);

  return state;
}

export { HOLD_MS };
