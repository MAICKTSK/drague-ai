import dotenv from "dotenv";
import { prisma } from "../src/config/db.js";

dotenv.config();

const plans = [
  {
    name: "Gratuit",
    priceUSD: 0,
    durationDays: 30,
    features: ["5 suggestions / mois", "1 ton disponible", "Import texte uniquement"],
  },
  {
    name: "Mensuel",
    priceUSD: 1.99,
    durationDays: 30,
    features: ["Suggestions illimitées", "Tous les tons", "Import texte et capture d'écran"],
  },
  {
    name: "Annuel",
    priceUSD: 19.99,
    durationDays: 365,
    features: ["Tout le plan Mensuel", "2 mois offerts", "Support prioritaire"],
  },
];

async function main() {
  for (const plan of plans) {
    const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
    if (existing) {
      await prisma.plan.update({ where: { id: existing.id }, data: plan });
    } else {
      await prisma.plan.create({ data: plan });
    }
    console.log(`Plan prêt : ${plan.name} (${plan.priceUSD} $)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
