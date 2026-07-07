import type { UnitStatus } from "@prisma/client";

// Allowed ProductUnit status transitions. Any pair not listed is rejected.
//   available -> held   (reservation)
//   held      -> sold   (payment confirmed)
//   held      -> available (expiration / release)
const ALLOWED: Record<UnitStatus, UnitStatus[]> = {
  available: ["held"],
  held: ["sold", "available"],
  sold: [],
};

export class InvalidTransitionError extends Error {
  constructor(from: UnitStatus, to: UnitStatus) {
    super(`invalid_transition:${from}->${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: UnitStatus, to: UnitStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}
