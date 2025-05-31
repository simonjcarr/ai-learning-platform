import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding subscription pricing...");

  const pricingData = [
    {
      tier: "FREE",
      stripePriceId: "price_free",
      monthlyPriceCents: 0,
      yearlyPriceCents: 0,
      features: [
        "Access to basic articles",
        "Limited quiz attempts",
        "Community support",
      ],
      isActive: true,
      displayOrder: 0,
    },
    {
      tier: "STANDARD",
      stripePriceId: process.env.STRIPE_STANDARD_PRICE_ID || "price_standard",
      monthlyPriceCents: 999, // $9.99
      yearlyPriceCents: 9990, // $99.90
      features: [
        "Access to all articles",
        "Unlimited quiz attempts",
        "Priority support",
        "Download resources",
        "Track progress",
      ],
      isActive: true,
      displayOrder: 1,
    },
    {
      tier: "PRO",
      stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "price_pro",
      monthlyPriceCents: 1499, // $14.99
      yearlyPriceCents: 14990, // $149.90
      features: [
        "Everything in Standard",
        "AI content generation",
        "AI chat assistance",
        "Advanced analytics",
      ],
      isActive: true,
      displayOrder: 2,
    },
    {
      tier: "MAX",
      stripePriceId: process.env.STRIPE_MAX_PRICE_ID || "price_max",
      monthlyPriceCents: 1999, // $19.99
      yearlyPriceCents: 19990, // $199.90
      features: [
        "Everything in Pro",
        "Unlimited AI features",
        "Early access to new content",
        "1-on-1 mentoring sessions",
        "Custom learning paths",
        "Certificate of completion",
        "API access",
      ],
      isActive: true,
      displayOrder: 3,
    },
  ];

  for (const pricing of pricingData) {
    await prisma.subscriptionPricing.upsert({
      where: { tier: pricing.tier },
      update: pricing,
      create: pricing,
    });
    console.log(`✅ Seeded pricing for ${pricing.tier}`);
  }

  console.log("✅ Subscription pricing seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding pricing:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });