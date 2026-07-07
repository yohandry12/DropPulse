import "./loadEnv.js";
import { config } from "./config.js";
import { releaseExpiredHolds } from "./holds/release.js";
import { expireLiveDrops } from "./drops/expire.js";
import { banner, log } from "./logger.js";

async function tick(): Promise<void> {
  try {
    const released = await releaseExpiredHolds();
    if (released > 0) {
      log.ok(`Released ${released} expired hold(s)`);
    }
    const paused = await expireLiveDrops();
    if (paused > 0) {
      log.ok(`Auto-paused ${paused} expired drop(s)`);
    }
  } catch (e) {
    log.error("Tick failed", e instanceof Error ? e.message : String(e));
  }
}

const intervalMs = config.cronIntervalSeconds * 1000;
banner("DropPulse Worker", [
  ["interval", `${config.cronIntervalSeconds}s`],
  ["tasks", "release expired holds · auto-pause expired drops"],
]);
log.ok("Ready — sweeping");
tick(); // run once immediately, then on interval
setInterval(tick, intervalMs);
