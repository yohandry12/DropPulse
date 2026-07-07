import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {
  // no .env present
}

const prisma = new PrismaClient();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// One drop per entry. dropAt offsets from now so the landing countdown ticks;
// the first (soonest) is the hero, the rest fill the "à venir" list.
const DROPS = [
  { name: "VOLT-01 « Ardoise Émeraude »", price: 17900, units: 100, dropInMs: 3 * HOUR + 42 * 60 * 1000, prefix: "VOLT01" },
  { name: "AERO-02 « Blanc Craie »", price: 18900, units: 80, dropInMs: 3 * DAY, prefix: "AERO02" },
  { name: "NOVA-03 « Rouge Brique »", price: 19900, units: 60, dropInMs: 7 * DAY, prefix: "NOVA03" },
  { name: "PULSE-04 « Noir Encre »", price: 20900, units: 120, dropInMs: 14 * DAY, prefix: "PULSE04" },
];

async function main() {
  // Idempotent-ish: wipe drop data, reseed.
  await prisma.productUnit.deleteMany();
  await prisma.product.deleteMany();

  for (const d of DROPS) {
    const product = await prisma.product.create({
      data: {
        name: d.name,
        description: `Édition numérotée, ${d.units} unités.`,
        price: d.price,
        dropAt: new Date(Date.now() + d.dropInMs),
        units: {
          create: Array.from({ length: d.units }, (_, i) => ({
            serialNumber: `${d.prefix}-${String(i + 1).padStart(4, "0")}`,
          })),
        },
      },
      include: { units: true },
    });
    console.log(`Seeded ${product.name} (${product.units.length} units, drops ${product.dropAt?.toISOString()}).`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
