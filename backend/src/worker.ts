import "./loadEnv.js";
import { config } from "./config.js";
import { releaseExpiredHolds } from "./holds/release.js";
import { expireLiveDrops } from "./drops/expire.js";
import { notifyExpiringHolds } from "./holds/notifyExpiring.js";
import { notifyOpenedDrops, notifySoonDrops } from "./drops/notifyOpen.js";
import { banner, log } from "./logger.js";

async function tick(): Promise<void> {
  try {
    // Warn about expiring holds BEFORE releasing — once released the unit is no
    // longer held and the buyer could never be warned.
    const warned = await notifyExpiringHolds();
    if (warned > 0) {
      log.ok(`Warned ${warned} expiring hold(s)`);
    }
    const released = await releaseExpiredHolds();
    if (released > 0) {
      log.ok(`Released ${released} expired hold(s)`);
    }
    const paused = await expireLiveDrops();
    if (paused > 0) {
      log.ok(`Auto-paused ${paused} expired drop(s)`);
    }
    const reminded = await notifySoonDrops();
    if (reminded > 0) {
      log.ok(`Reminded ${reminded} subscriber(s) of a soon-opening drop`);
    }
    const opened = await notifyOpenedDrops();
    if (opened > 0) {
      log.ok(`Notified ${opened} subscriber(s) of an opened drop`);
    }
  } catch (e) {
    log.error("Tick failed", e instanceof Error ? e.message : String(e));
  }
}

const intervalMs = config.cronIntervalSeconds * 1000;
banner("DropPulse Worker", [
  ["interval", `${config.cronIntervalSeconds}s`],
  ["tasks", "holds · drop expiry · open/soon alerts"],
]);
log.ok("Ready — sweeping");
tick(); // run once immediately, then on interval
setInterval(tick, intervalMs);
