import { execSync } from "node:child_process";

// Create/migrate a dedicated test database so tests never touch dev data.
export default function globalSetup(): void {
  process.loadEnvFile(".env.test");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
  });
}
