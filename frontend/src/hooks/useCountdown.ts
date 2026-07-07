import { useEffect, useState } from "react";

// Live countdown to a target time. Returns zero-padded H/M/S strings that tick
// every second. Used by the upcoming-drop landing.

export interface Countdown {
  days: string;
  hours: string; // total hours (may exceed 24) — for the 3-cell landing hero
  hoursOfDay: string; // 0–23, for the days+hours+min+sec detail view
  minutes: string;
  seconds: string;
  done: boolean;
}

function pad(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

function compute(targetMs: number): Countdown {
  const diff = targetMs - Date.now();
  if (diff <= 0) {
    return { days: "0", hours: "00", hoursOfDay: "00", minutes: "00", seconds: "00", done: true };
  }
  const totalSec = Math.floor(diff / 1000);
  return {
    days: String(Math.floor(totalSec / 86400)),
    hours: pad(Math.floor(totalSec / 3600)),
    hoursOfDay: pad(Math.floor((totalSec % 86400) / 3600)),
    minutes: pad(Math.floor((totalSec % 3600) / 60)),
    seconds: pad(totalSec % 60),
    done: false,
  };
}

export function useCountdown(targetMs: number): Countdown {
  const [state, setState] = useState<Countdown>(() => compute(targetMs));

  useEffect(() => {
    const id = setInterval(() => setState(compute(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  return state;
}
