import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.ocsUser.createMany({
    data: [
      { id: "pd-001", email: "director@trackaroo.dev", displayName: "Project Director", role: "project_director" },
      { id: "ops-001", email: "ops@trackaroo.dev", displayName: "Operations", role: "operations" },
      { id: "contrib-001", email: "contributor@trackaroo.dev", displayName: "Contributor", role: "contributor" },
    ],
    skipDuplicates: true,
  });

  await prisma.mobileUser.createMany({
    data: [
      { firebaseUid: "mobile-001", displayName: "Demo Hiker", archetype: "hiker", preferences: {} },
      { firebaseUid: "mobile-002", displayName: "Demo Driver", archetype: "4wd", preferences: {} },
    ],
    skipDuplicates: true,
  });

  console.log("Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
