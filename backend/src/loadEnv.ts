// Load .env explicitly (Node >=20.6) instead of relying on import-order side
// effects. Silent if the file is absent (e.g. in Docker where env is injected).
try {
  process.loadEnvFile();
} catch {
  // no .env file present — env vars come from the environment
}
