// First-login intro gate. Client-side flag only (V1): the 3D welcome plays once
// per browser. Not synced across devices — acceptable for a portfolio flourish.

const INTRO_KEY = "flashdrop.introSeen";

export function hasSeenIntro(): boolean {
  return localStorage.getItem(INTRO_KEY) === "1";
}

export function markIntroSeen(): void {
  localStorage.setItem(INTRO_KEY, "1");
}
