import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Promote (or create) the first Admin. The first Admin can NEVER be minted via
// the UI — this is the only path. Idempotent: run it again and it re-asserts the
// role without harm.
//
// Usage:
//   ADMIN_EMAIL=you@example.com npm run seed:admin
//     → promotes an existing user to ADMIN (fails loudly if absent)
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret123 npm run seed:admin
//     → creates the user as ADMIN if absent, otherwise promotes + resets nothing

try {
  process.loadEnvFile();
} catch {
  // no .env present
}

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Admin";

  if (!email) {
    throw new Error("ADMIN_EMAIL env var is required.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role === "ADMIN") {
      console.log(`${email} is already ADMIN — nothing to do.`);
    } else {
      await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      console.log(`Promoted ${email} (${existing.role} → ADMIN).`);
    }
    return;
  }

  if (!password) {
    throw new Error(
      `No user with email ${email}. To create one, also pass ADMIN_PASSWORD (min 8 chars).`
    );
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, role: "ADMIN" },
  });
  console.log(`Created ADMIN ${user.email}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e.message ?? e);
    await prisma.$disconnect();
    process.exit(1);
  });
